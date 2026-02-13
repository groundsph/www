"use server"

import { db } from "@/db"
import {
    cafeCrawls,
    cafeCrawlItems,
    cafeCrawlSaves,
    cafeCrawlReports,
    cafes,
    cafeRatingStats,
    profiles,
} from "@/db/schema"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { and, eq, desc, inArray, or, sql, count as drizzleCount } from "drizzle-orm"
import {
    createCafeCrawlSchema,
    updateCafeCrawlSchema,
    reorderCafeCrawlSchema,
} from "@/utils/validation/cafe-crawls"

// =============================================================================
// Helper Functions
// =============================================================================

async function getCurrentUser() {
    const session = await auth.api.getSession({ headers: await headers() })
    return session?.user ?? null
}

function generateSlug(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .substring(0, 50)
}

async function ensureUniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
    let slug = baseSlug
    let counter = 1
    while (true) {
        const existing = await db
            .select({ id: cafeCrawls.id })
            .from(cafeCrawls)
            .where(
                excludeId
                    ? and(eq(cafeCrawls.slug, slug), sql`${cafeCrawls.id} != ${excludeId}`)
                    : eq(cafeCrawls.slug, slug)
            )
            .limit(1)
        if (existing.length === 0) break
        slug = `${baseSlug}-${counter}`
        counter++
    }
    return slug
}

// =============================================================================
// CREATE CAFE CRAWL
// =============================================================================

export interface CreateCafeCrawlResult {
    success: boolean
    error?: string
    data?: { id: string; slug: string }
}

export async function createCafeCrawl(input: unknown): Promise<CreateCafeCrawlResult> {
    const user = await getCurrentUser()
    if (!user) {
        return { success: false, error: "You must be logged in." }
    }

    const parsed = createCafeCrawlSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.message }
    }

    const { title, description, coverImage, isPublic, status, items } = parsed.data

    const baseSlug = generateSlug(title)
    const slug = await ensureUniqueSlug(baseSlug || "crawl")

    try {
        const result = await db
            .insert(cafeCrawls)
            .values({
                userId: user.id,
                title,
                slug,
                description: description ?? null,
                coverImage: coverImage ?? null,
                isPublic: isPublic ?? true,
                status: status ?? "draft",
                itemCount: items?.length ?? 0,
            })
            .returning({ id: cafeCrawls.id, slug: cafeCrawls.slug })

        const crawlId = result[0].id

        // Insert items if provided
        if (items && items.length > 0) {
            await db.insert(cafeCrawlItems).values(
                items.map((item, index) => ({
                    crawlId,
                    cafeId: item.cafeId,
                    sortOrder: item.sortOrder ?? index,
                    note: item.note ?? null,
                }))
            )
        }

        revalidatePath("/crawls")
        return { success: true, data: { id: crawlId, slug } }
    } catch (error) {
        console.error("Error creating cafe crawl:", error)
        return { success: false, error: "Failed to create cafe crawl" }
    }
}

// =============================================================================
// GET PUBLIC CAFE CRAWLS
// =============================================================================

export interface CafeCrawlListItem {
    id: string
    title: string
    slug: string
    description: string | null
    coverImage: string | null
    itemCount: number
    viewsCount: number
    savesCount: number
    createdAt: string
    author: {
        id: string
        username: string
        displayName: string
        avatarUrl: string | null
    }
}

export interface GetPublicCafeCrawlsResult {
    crawls: CafeCrawlListItem[]
    total: number
}

export async function getPublicCafeCrawls(
    page = 1,
    pageSize = 12,
    sortBy: "recent" | "popular" = "recent",
    search?: string
): Promise<GetPublicCafeCrawlsResult> {
    const offset = (page - 1) * pageSize

    const orderBy = sortBy === "popular" ? desc(cafeCrawls.savesCount) : desc(cafeCrawls.createdAt)

    const searchFilter = search
        ? or(
              sql`${cafeCrawls.title} ILIKE ${`%${search}%`}`,
              sql`${cafeCrawls.description} ILIKE ${`%${search}%`}`
          )
        : undefined

    const results = await db
        .select({
            id: cafeCrawls.id,
            title: cafeCrawls.title,
            slug: cafeCrawls.slug,
            description: cafeCrawls.description,
            coverImage: cafeCrawls.coverImage,
            itemCount: cafeCrawls.itemCount,
            viewsCount: cafeCrawls.viewsCount,
            savesCount: cafeCrawls.savesCount,
            createdAt: cafeCrawls.createdAt,
            userId: cafeCrawls.userId,
        })
        .from(cafeCrawls)
        .where(
            and(
                eq(cafeCrawls.isPublic, true),
                eq(cafeCrawls.status, "published"),
                searchFilter
            )
        )
        .orderBy(orderBy)
        .limit(pageSize)
        .offset(offset)

    // Get total count
    const countResult = await db
        .select({ count: drizzleCount() })
        .from(cafeCrawls)
        .where(
            and(
                eq(cafeCrawls.isPublic, true),
                eq(cafeCrawls.status, "published"),
                searchFilter
            )
        )

    const total = countResult[0]?.count ?? 0

    if (results.length === 0) {
        return { crawls: [], total }
    }

    // Fetch authors
    const userIds = [...new Set(results.map((c) => c.userId))]
    const authors = await db
        .select({
            id: profiles.id,
            username: profiles.username,
            displayName: profiles.displayName,
            avatarUrl: profiles.avatarUrl,
        })
        .from(profiles)
        .where(inArray(profiles.id, userIds))

    const authorMap = new Map(authors.map((a) => [a.id, a]))

    return {
        crawls: results.map((c) => ({
            id: c.id,
            title: c.title,
            slug: c.slug,
            description: c.description,
            coverImage: c.coverImage,
            itemCount: c.itemCount ?? 0,
            viewsCount: c.viewsCount ?? 0,
            savesCount: c.savesCount ?? 0,
            createdAt: c.createdAt?.toISOString() ?? new Date().toISOString(),
            author: authorMap.get(c.userId) ?? {
                id: c.userId,
                username: "unknown",
                displayName: "Unknown User",
                avatarUrl: null,
            },
        })),
        total,
    }
}

// =============================================================================
// GET CAFE CRAWL BY SLUG
// =============================================================================

export interface CafeCrawlDetail extends CafeCrawlListItem {
    status: string
    updatedAt: string
    items: {
        id: string
        cafeId: string
        name: string
        slug: string
        thumbnail: string | null
        cityMunicipality: string
        region: string
        lat: number | null
        lng: number | null
        averageRating: number | null
        totalReviews: number | null
        sortOrder: number
        note: string | null
    }[]
    hasSaved: boolean
    isOwner: boolean
}

export async function getCafeCrawlBySlug(slug: string): Promise<CafeCrawlDetail | null> {
    const crawlResult = await db
        .select({
            id: cafeCrawls.id,
            userId: cafeCrawls.userId,
            title: cafeCrawls.title,
            slug: cafeCrawls.slug,
            description: cafeCrawls.description,
            coverImage: cafeCrawls.coverImage,
            status: cafeCrawls.status,
            isPublic: cafeCrawls.isPublic,
            itemCount: cafeCrawls.itemCount,
            viewsCount: cafeCrawls.viewsCount,
            savesCount: cafeCrawls.savesCount,
            createdAt: cafeCrawls.createdAt,
            updatedAt: cafeCrawls.updatedAt,
            authorDisplayName: profiles.displayName,
            authorUsername: profiles.username,
            authorAvatarUrl: profiles.avatarUrl,
        })
        .from(cafeCrawls)
        .leftJoin(profiles, eq(cafeCrawls.userId, profiles.id))
        .where(eq(cafeCrawls.slug, slug))
        .limit(1)

    if (crawlResult.length === 0) return null

    const crawl = crawlResult[0]

    // Check visibility
    const user = await getCurrentUser()
    if (!crawl.isPublic && crawl.userId !== user?.id) {
        return null
    }

    // Increment view count (async, don't wait)
    db.update(cafeCrawls)
        .set({ viewsCount: sql`${cafeCrawls.viewsCount} + 1` })
        .where(eq(cafeCrawls.id, crawl.id))
        .then(() => {})
        .catch(() => {})

    // Fetch items with cafe details
    const itemsResult = await db
        .select({
            id: cafeCrawlItems.id,
            cafeId: cafeCrawlItems.cafeId,
            sortOrder: cafeCrawlItems.sortOrder,
            note: cafeCrawlItems.note,
            cafeName: cafes.name,
            cafeSlug: cafes.slug,
            cafeThumbnail: cafes.thumbnail,
            cafeCity: cafes.cityMunicipality,
            cafeRegion: cafes.region,
            cafeLat: cafes.lat,
            cafeLng: cafes.lng,
            averageRating: cafeRatingStats.averageRating,
            totalReviews: cafeRatingStats.totalReviews,
        })
        .from(cafeCrawlItems)
        .innerJoin(cafes, eq(cafeCrawlItems.cafeId, cafes.id))
        .leftJoin(cafeRatingStats, eq(cafeCrawlItems.cafeId, cafeRatingStats.cafeId))
        .where(eq(cafeCrawlItems.crawlId, crawl.id))
        .orderBy(cafeCrawlItems.sortOrder)

    // Check if user has saved
    let hasSaved = false
    if (user) {
        const saveResult = await db
            .select({ id: cafeCrawlSaves.id })
            .from(cafeCrawlSaves)
            .where(and(eq(cafeCrawlSaves.crawlId, crawl.id), eq(cafeCrawlSaves.userId, user.id)))
            .limit(1)
        hasSaved = saveResult.length > 0
    }

    return {
        id: crawl.id,
        title: crawl.title,
        slug: crawl.slug,
        description: crawl.description,
        coverImage: crawl.coverImage,
        itemCount: crawl.itemCount ?? 0,
        viewsCount: crawl.viewsCount ?? 0,
        savesCount: crawl.savesCount ?? 0,
        status: crawl.status ?? "draft",
        createdAt: crawl.createdAt?.toISOString() ?? new Date().toISOString(),
        updatedAt: crawl.updatedAt?.toISOString() ?? new Date().toISOString(),
        author: {
            id: crawl.userId,
            displayName: crawl.authorDisplayName ?? "",
            username: crawl.authorUsername ?? "unknown",
            avatarUrl: crawl.authorAvatarUrl,
        },
        items: itemsResult.map((item) => ({
            id: item.id,
            cafeId: item.cafeId,
            name: item.cafeName,
            slug: item.cafeSlug,
            thumbnail: item.cafeThumbnail,
            cityMunicipality: item.cafeCity,
            region: item.cafeRegion,
            lat: item.cafeLat,
            lng: item.cafeLng,
            averageRating: item.averageRating,
            totalReviews: item.totalReviews,
            sortOrder: item.sortOrder ?? 0,
            note: item.note,
        })),
        hasSaved,
        isOwner: user?.id === crawl.userId,
    }
}

// =============================================================================
// UPDATE CAFE CRAWL
// =============================================================================

export interface UpdateCafeCrawlResult {
    success: boolean
    error?: string
}

export async function updateCafeCrawl(id: string, input: unknown): Promise<UpdateCafeCrawlResult> {
    const user = await getCurrentUser()
    if (!user) {
        return { success: false, error: "You must be logged in." }
    }

    // Verify ownership
    const existing = await db
        .select({ userId: cafeCrawls.userId, slug: cafeCrawls.slug })
        .from(cafeCrawls)
        .where(eq(cafeCrawls.id, id))
        .limit(1)

    if (existing.length === 0) {
        return { success: false, error: "Crawl not found" }
    }
    if (existing[0].userId !== user.id) {
        return { success: false, error: "You do not own this crawl" }
    }

    const parsed = updateCafeCrawlSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.message }
    }

    const { title, description, coverImage, isPublic, status, items } = parsed.data

    const updates: Partial<typeof cafeCrawls.$inferInsert> = {
        updatedAt: new Date(),
    }

    if (title !== undefined) {
        updates.title = title
        const baseSlug = generateSlug(title)
        updates.slug = await ensureUniqueSlug(baseSlug || "crawl", id)
    }
    if (description !== undefined) updates.description = description
    if (coverImage !== undefined) updates.coverImage = coverImage
    if (isPublic !== undefined) updates.isPublic = isPublic
    if (status !== undefined) updates.status = status

    try {
        await db.update(cafeCrawls).set(updates).where(eq(cafeCrawls.id, id))

        // Update items if provided
        if (items !== undefined) {
            // Delete existing items
            await db.delete(cafeCrawlItems).where(eq(cafeCrawlItems.crawlId, id))

            // Insert new items
            if (items.length > 0) {
                await db.insert(cafeCrawlItems).values(
                    items.map((item, index) => ({
                        crawlId: id,
                        cafeId: item.cafeId,
                        sortOrder: item.sortOrder ?? index,
                        note: item.note ?? null,
                    }))
                )
            }

            // Update item count
            await db
                .update(cafeCrawls)
                .set({ itemCount: items.length })
                .where(eq(cafeCrawls.id, id))
        }

        revalidatePath("/crawls")
        revalidatePath(`/crawls/${updates.slug || existing[0].slug}`)
        return { success: true }
    } catch (error) {
        console.error("Error updating cafe crawl:", error)
        return { success: false, error: "Failed to update cafe crawl" }
    }
}

// =============================================================================
// REORDER CAFE CRAWL
// =============================================================================

export interface ReorderCafeCrawlResult {
    success: boolean
    error?: string
}

export async function reorderCafeCrawl(id: string, input: unknown): Promise<ReorderCafeCrawlResult> {
    const user = await getCurrentUser()
    if (!user) {
        return { success: false, error: "You must be logged in." }
    }

    // Verify ownership
    const existing = await db
        .select({ userId: cafeCrawls.userId, slug: cafeCrawls.slug })
        .from(cafeCrawls)
        .where(eq(cafeCrawls.id, id))
        .limit(1)

    if (existing.length === 0) {
        return { success: false, error: "Crawl not found" }
    }
    if (existing[0].userId !== user.id) {
        return { success: false, error: "You do not own this crawl" }
    }

    const parsed = reorderCafeCrawlSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.message }
    }

    const { items } = parsed.data

    try {
        // Update sortOrder for each item
        await Promise.all(
            items.map((item) =>
                db
                    .update(cafeCrawlItems)
                    .set({ sortOrder: item.sortOrder })
                    .where(and(eq(cafeCrawlItems.crawlId, id), eq(cafeCrawlItems.cafeId, item.cafeId)))
            )
        )

        revalidatePath(`/crawls/${existing[0].slug}`)
        return { success: true }
    } catch (error) {
        console.error("Error reordering cafe crawl:", error)
        return { success: false, error: "Failed to reorder cafe crawl" }
    }
}

// =============================================================================
// TOGGLE SAVE CAFE CRAWL
// =============================================================================

export interface ToggleSaveCafeCrawlResult {
    success: boolean
    saved: boolean
    error?: string
}

export async function toggleSaveCafeCrawl(crawlId: string): Promise<ToggleSaveCafeCrawlResult> {
    const user = await getCurrentUser()
    if (!user) {
        return { success: false, error: "You must be logged in.", saved: false }
    }

    try {
        // Check if already saved
        const existingSave = await db
            .select({ id: cafeCrawlSaves.id })
            .from(cafeCrawlSaves)
            .where(and(eq(cafeCrawlSaves.crawlId, crawlId), eq(cafeCrawlSaves.userId, user.id)))
            .limit(1)

        if (existingSave.length > 0) {
            // Unsave
            await db.delete(cafeCrawlSaves).where(eq(cafeCrawlSaves.id, existingSave[0].id))
            await db
                .update(cafeCrawls)
                .set({ savesCount: sql`${cafeCrawls.savesCount} - 1` })
                .where(eq(cafeCrawls.id, crawlId))
            revalidatePath("/crawls")
            return { success: true, saved: false }
        } else {
            // Save
            await db.insert(cafeCrawlSaves).values({
                crawlId,
                userId: user.id,
            })
            await db
                .update(cafeCrawls)
                .set({ savesCount: sql`${cafeCrawls.savesCount} + 1` })
                .where(eq(cafeCrawls.id, crawlId))
            revalidatePath("/crawls")
            return { success: true, saved: true }
        }
    } catch (error) {
        console.error("Error toggling save:", error)
        return { success: false, error: "Failed to save crawl", saved: false }
    }
}

// =============================================================================
// REPORT CAFE CRAWL
// =============================================================================

export interface ReportCafeCrawlResult {
    success: boolean
    error?: string
}

export async function reportCafeCrawl(input: {
    crawlId: string
    reason: string
    details?: string
}): Promise<ReportCafeCrawlResult> {
    const user = await getCurrentUser()
    if (!user) {
        return { success: false, error: "You must be logged in to report content" }
    }

    // Verify crawl exists
    const crawlResult = await db
        .select({ id: cafeCrawls.id, userId: cafeCrawls.userId })
        .from(cafeCrawls)
        .where(eq(cafeCrawls.id, input.crawlId))
        .limit(1)

    if (crawlResult.length === 0) {
        return { success: false, error: "Crawl not found" }
    }

    // Prevent self-reporting
    if (crawlResult[0].userId === user.id) {
        return { success: false, error: "You cannot report your own crawl" }
    }

    // Check if already reported
    const existingReport = await db
        .select({ id: cafeCrawlReports.id })
        .from(cafeCrawlReports)
        .where(
            and(
                eq(cafeCrawlReports.crawlId, input.crawlId),
                eq(cafeCrawlReports.reporterId, user.id)
            )
        )
        .limit(1)

    if (existingReport.length > 0) {
        return { success: false, error: "You have already reported this crawl" }
    }

    try {
        await db.insert(cafeCrawlReports).values({
            crawlId: input.crawlId,
            reporterId: user.id,
            reason: input.reason,
            details: input.details ?? null,
            status: "pending",
        })

        return { success: true }
    } catch (error) {
        console.error("Error creating report:", error)
        return { success: false, error: "Failed to submit report" }
    }
}

// =============================================================================
// GET USER'S SAVED CRAWLS
// =============================================================================

export async function getSavedCafeCrawls(): Promise<CafeCrawlListItem[]> {
    const user = await getCurrentUser()
    if (!user) return []

    const results = await db
        .select({
            id: cafeCrawls.id,
            title: cafeCrawls.title,
            slug: cafeCrawls.slug,
            description: cafeCrawls.description,
            coverImage: cafeCrawls.coverImage,
            itemCount: cafeCrawls.itemCount,
            viewsCount: cafeCrawls.viewsCount,
            savesCount: cafeCrawls.savesCount,
            createdAt: cafeCrawls.createdAt,
            userId: cafeCrawls.userId,
        })
        .from(cafeCrawlSaves)
        .innerJoin(cafeCrawls, eq(cafeCrawlSaves.crawlId, cafeCrawls.id))
        .where(eq(cafeCrawlSaves.userId, user.id))
        .orderBy(desc(cafeCrawlSaves.createdAt))

    // Fetch authors
    const userIds = [...new Set(results.map((c) => c.userId))]
    const authors = await db
        .select({
            id: profiles.id,
            username: profiles.username,
            displayName: profiles.displayName,
            avatarUrl: profiles.avatarUrl,
        })
        .from(profiles)
        .where(inArray(profiles.id, userIds))

    const authorMap = new Map(authors.map((a) => [a.id, a]))

    return results.map((c) => ({
        id: c.id,
        title: c.title,
        slug: c.slug,
        description: c.description,
        coverImage: c.coverImage,
        itemCount: c.itemCount ?? 0,
        viewsCount: c.viewsCount ?? 0,
        savesCount: c.savesCount ?? 0,
        createdAt: c.createdAt?.toISOString() ?? new Date().toISOString(),
        author: authorMap.get(c.userId) ?? {
            id: c.userId,
            username: "unknown",
            displayName: "Unknown User",
            avatarUrl: null,
        },
    }))
}

// =============================================================================
// GET USER'S CRAWLS
// =============================================================================

export async function getUserCafeCrawls(userId?: string): Promise<CafeCrawlListItem[]> {
    const user = await getCurrentUser()
    const targetUserId = userId ?? user?.id
    if (!targetUserId) return []

    const isOwner = user?.id === targetUserId

    const results = await db
        .select({
            id: cafeCrawls.id,
            title: cafeCrawls.title,
            slug: cafeCrawls.slug,
            description: cafeCrawls.description,
            coverImage: cafeCrawls.coverImage,
            itemCount: cafeCrawls.itemCount,
            viewsCount: cafeCrawls.viewsCount,
            savesCount: cafeCrawls.savesCount,
            createdAt: cafeCrawls.createdAt,
            userId: cafeCrawls.userId,
        })
        .from(cafeCrawls)
        .where(
            isOwner
                ? eq(cafeCrawls.userId, targetUserId)
                : and(
                      eq(cafeCrawls.userId, targetUserId),
                      eq(cafeCrawls.isPublic, true),
                      eq(cafeCrawls.status, "published")
                  )
        )
        .orderBy(desc(cafeCrawls.createdAt))

    // Fetch authors
    const userIds = [...new Set(results.map((c) => c.userId))]
    const authors = await db
        .select({
            id: profiles.id,
            username: profiles.username,
            displayName: profiles.displayName,
            avatarUrl: profiles.avatarUrl,
        })
        .from(profiles)
        .where(inArray(profiles.id, userIds))

    const authorMap = new Map(authors.map((a) => [a.id, a]))

    return results.map((c) => ({
        id: c.id,
        title: c.title,
        slug: c.slug,
        description: c.description,
        coverImage: c.coverImage,
        itemCount: c.itemCount ?? 0,
        viewsCount: c.viewsCount ?? 0,
        savesCount: c.savesCount ?? 0,
        createdAt: c.createdAt?.toISOString() ?? new Date().toISOString(),
        author: authorMap.get(c.userId) ?? {
            id: c.userId,
            username: "unknown",
            displayName: "Unknown User",
            avatarUrl: null,
        },
    }))
}

// =============================================================================
// DELETE CAFE CRAWL
// =============================================================================

export interface DeleteCafeCrawlResult {
    success: boolean
    error?: string
}

export async function deleteCafeCrawl(id: string): Promise<DeleteCafeCrawlResult> {
    const user = await getCurrentUser()
    if (!user) {
        return { success: false, error: "You must be logged in." }
    }

    // Verify ownership
    const existing = await db
        .select({ userId: cafeCrawls.userId, slug: cafeCrawls.slug })
        .from(cafeCrawls)
        .where(eq(cafeCrawls.id, id))
        .limit(1)

    if (existing.length === 0) {
        return { success: false, error: "Crawl not found" }
    }
    if (existing[0].userId !== user.id) {
        return { success: false, error: "You do not own this crawl" }
    }

    try {
        await db.delete(cafeCrawls).where(eq(cafeCrawls.id, id))

        revalidatePath("/crawls")
        revalidatePath(`/crawls/${existing[0].slug}`)
        return { success: true }
    } catch (error) {
        console.error("Error deleting cafe crawl:", error)
        return { success: false, error: "Failed to delete cafe crawl" }
    }
}
