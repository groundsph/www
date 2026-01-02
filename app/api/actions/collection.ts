"use server"

import { db } from "@/db"
import { collections, collectionLikes, cafes, cafeRatingStats, profiles } from "@/db/schema"
import { eq, and, desc, sql, inArray } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"

// Helper to generate a URL-friendly slug from title
function generateSlug(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .substring(0, 50)
}

// Helper to ensure slug uniqueness
async function ensureUniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
    let slug = baseSlug
    let counter = 1
    while (true) {
        const existing = await db
            .select({ id: collections.id })
            .from(collections)
            .where(excludeId
                ? and(eq(collections.slug, slug), sql`${collections.id} != ${excludeId}`)
                : eq(collections.slug, slug)
            )
            .limit(1)
        if (existing.length === 0) break
        slug = `${baseSlug}-${counter}`
        counter++
    }
    return slug
}

// Get current user helper
async function getCurrentUser() {
    const session = await auth.api.getSession({ headers: await headers() })
    return session?.user ?? null
}

// =============================================================================
// CREATE COLLECTION
// =============================================================================
export async function createCollection(data: {
    title: string
    description?: string
    coverImage?: string
    isPublic?: boolean
}) {
    const user = await getCurrentUser()
    if (!user) throw new Error("You must be logged in to create a collection")

    const baseSlug = generateSlug(data.title)
    const slug = await ensureUniqueSlug(baseSlug || "collection")

    const result = await db
        .insert(collections)
        .values({
            userId: user.id,
            title: data.title,
            slug,
            description: data.description ?? null,
            coverImage: data.coverImage ?? null,
            isPublic: data.isPublic ?? true,
            items: [],
            itemCount: 0,
        })
        .returning({ id: collections.id, slug: collections.slug })

    revalidatePath("/profile/collections")
    return result[0]
}

// =============================================================================
// UPDATE COLLECTION
// =============================================================================
export async function updateCollection(
    id: string,
    data: {
        title?: string
        description?: string
        coverImage?: string
        isPublic?: boolean
        items?: { cafeId: string; note?: string }[]
    }
) {
    const user = await getCurrentUser()
    if (!user) throw new Error("You must be logged in to update a collection")

    // Verify ownership
    const existing = await db
        .select({ userId: collections.userId, slug: collections.slug })
        .from(collections)
        .where(eq(collections.id, id))
        .limit(1)

    if (existing.length === 0) throw new Error("Collection not found")
    if (existing[0].userId !== user.id) throw new Error("You do not own this collection")

    const updates: Partial<typeof collections.$inferInsert> = {
        updatedAt: new Date(),
    }

    if (data.title !== undefined) {
        updates.title = data.title
        const baseSlug = generateSlug(data.title)
        updates.slug = await ensureUniqueSlug(baseSlug || "collection", id)
    }
    if (data.description !== undefined) updates.description = data.description
    if (data.coverImage !== undefined) updates.coverImage = data.coverImage
    if (data.isPublic !== undefined) updates.isPublic = data.isPublic
    if (data.items !== undefined) {
        updates.items = data.items
        updates.itemCount = data.items.length
    }

    await db.update(collections).set(updates).where(eq(collections.id, id))

    revalidatePath("/profile/collections")
    revalidatePath(`/community/${existing[0].slug}`)
    if (updates.slug && updates.slug !== existing[0].slug) {
        revalidatePath(`/community/${updates.slug}`)
    }

    return { success: true }
}

// =============================================================================
// DELETE COLLECTION
// =============================================================================
export async function deleteCollection(id: string) {
    const user = await getCurrentUser()
    if (!user) throw new Error("You must be logged in to delete a collection")

    const existing = await db
        .select({ userId: collections.userId, slug: collections.slug })
        .from(collections)
        .where(eq(collections.id, id))
        .limit(1)

    if (existing.length === 0) throw new Error("Collection not found")
    if (existing[0].userId !== user.id) throw new Error("You do not own this collection")

    await db.delete(collections).where(eq(collections.id, id))

    revalidatePath("/profile/collections")
    revalidatePath(`/community/${existing[0].slug}`)

    return { success: true }
}

// =============================================================================
// TOGGLE LIKE COLLECTION
// =============================================================================
export async function toggleLikeCollection(collectionId: string) {
    const user = await getCurrentUser()
    if (!user) throw new Error("You must be logged in to like a collection")

    const existingLike = await db
        .select({ id: collectionLikes.id })
        .from(collectionLikes)
        .where(and(eq(collectionLikes.collectionId, collectionId), eq(collectionLikes.userId, user.id)))
        .limit(1)

    if (existingLike.length > 0) {
        // Unlike
        await db.delete(collectionLikes).where(eq(collectionLikes.id, existingLike[0].id))
        await db
            .update(collections)
            .set({ likesCount: sql`${collections.likesCount} - 1` })
            .where(eq(collections.id, collectionId))
        return { liked: false }
    } else {
        // Like
        await db.insert(collectionLikes).values({
            collectionId,
            userId: user.id,
        })
        await db
            .update(collections)
            .set({ likesCount: sql`${collections.likesCount} + 1` })
            .where(eq(collections.id, collectionId))
        return { liked: true }
    }
}

// =============================================================================
// GET COLLECTION BY SLUG (Public)
// =============================================================================
export async function getCollectionBySlug(slug: string) {
    const collectionResult = await db
        .select({
            id: collections.id,
            userId: collections.userId,
            title: collections.title,
            slug: collections.slug,
            description: collections.description,
            coverImage: collections.coverImage,
            items: collections.items,
            itemCount: collections.itemCount,
            isPublic: collections.isPublic,
            viewsCount: collections.viewsCount,
            likesCount: collections.likesCount,
            createdAt: collections.createdAt,
            updatedAt: collections.updatedAt,
            authorDisplayName: profiles.displayName,
            authorUsername: profiles.username,
            authorAvatarUrl: profiles.avatarUrl,
        })
        .from(collections)
        .leftJoin(profiles, eq(collections.userId, profiles.id))
        .where(eq(collections.slug, slug))
        .limit(1)

    if (collectionResult.length === 0) return null

    const collection = collectionResult[0]

    // Check visibility
    const user = await getCurrentUser()
    if (!collection.isPublic && collection.userId !== user?.id) {
        return null
    }

    // Increment view count (async, don't wait)
    db.update(collections)
        .set({ viewsCount: sql`${collections.viewsCount} + 1` })
        .where(eq(collections.id, collection.id))
        .then(() => { })
        .catch(() => { })

    // Fetch cafe details for items
    const items = (collection.items as { cafeId: string; note?: string }[]) || []
    const cafeIds = items.map((item) => item.cafeId)

    let cafesData: {
        id: string
        name: string
        slug: string
        thumbnail: string
        cityMunicipality: string
        region: string
        averageRating: number | null
        totalReviews: number | null
    }[] = []

    if (cafeIds.length > 0) {
        cafesData = await db
            .select({
                id: cafes.id,
                name: cafes.name,
                slug: cafes.slug,
                thumbnail: cafes.thumbnail,
                cityMunicipality: cafes.cityMunicipality,
                region: cafes.region,
                averageRating: cafeRatingStats.averageRating,
                totalReviews: cafeRatingStats.totalReviews,
            })
            .from(cafes)
            .leftJoin(cafeRatingStats, eq(cafes.id, cafeRatingStats.cafeId))
            .where(inArray(cafes.id, cafeIds))
    }

    // Map cafes to items order
    const cafesMap = new Map(cafesData.map((c) => [c.id, c]))
    const orderedCafes = items
        .map((item) => {
            const cafe = cafesMap.get(item.cafeId)
            if (!cafe) return null
            return {
                ...cafe,
                note: item.note,
            }
        })
        .filter(Boolean)

    // Check if current user has liked
    let hasLiked = false
    if (user) {
        const like = await db
            .select({ id: collectionLikes.id })
            .from(collectionLikes)
            .where(and(eq(collectionLikes.collectionId, collection.id), eq(collectionLikes.userId, user.id)))
            .limit(1)
        hasLiked = like.length > 0
    }

    return {
        id: collection.id,
        title: collection.title,
        slug: collection.slug,
        description: collection.description,
        coverImage: collection.coverImage,
        itemCount: collection.itemCount,
        viewsCount: collection.viewsCount,
        likesCount: collection.likesCount,
        isPublic: collection.isPublic,
        createdAt: collection.createdAt?.toISOString() ?? null,
        updatedAt: collection.updatedAt?.toISOString() ?? null,
        author: {
            id: collection.userId,
            displayName: collection.authorDisplayName ?? "",
            username: collection.authorUsername ?? "",
            avatarUrl: collection.authorAvatarUrl,
        },
        cafes: orderedCafes,
        hasLiked,
        isOwner: user?.id === collection.userId,
    }
}

// =============================================================================
// GET USER COLLECTIONS
// =============================================================================
export async function getUserCollections(userId?: string) {
    const user = await getCurrentUser()
    const targetUserId = userId ?? user?.id
    if (!targetUserId) return []

    const isOwner = user?.id === targetUserId

    const result = await db
        .select({
            id: collections.id,
            title: collections.title,
            slug: collections.slug,
            description: collections.description,
            coverImage: collections.coverImage,
            itemCount: collections.itemCount,
            isPublic: collections.isPublic,
            viewsCount: collections.viewsCount,
            likesCount: collections.likesCount,
            createdAt: collections.createdAt,
        })
        .from(collections)
        .where(
            isOwner
                ? eq(collections.userId, targetUserId)
                : and(eq(collections.userId, targetUserId), eq(collections.isPublic, true))
        )
        .orderBy(desc(collections.createdAt))

    return result.map((c) => ({
        ...c,
        createdAt: c.createdAt?.toISOString() ?? null,
    }))
}

// =============================================================================
// GET COLLECTION FOR EDITING
// =============================================================================
export async function getCollectionForEdit(id: string) {
    const user = await getCurrentUser()
    if (!user) throw new Error("You must be logged in")

    const result = await db
        .select()
        .from(collections)
        .where(eq(collections.id, id))
        .limit(1)

    if (result.length === 0) throw new Error("Collection not found")
    if (result[0].userId !== user.id) throw new Error("You do not own this collection")

    return {
        ...result[0],
        createdAt: result[0].createdAt?.toISOString() ?? null,
        updatedAt: result[0].updatedAt?.toISOString() ?? null,
    }
}

// =============================================================================
// ADD CAFE TO COLLECTION
// =============================================================================
export async function addCafeToCollection(collectionId: string, cafeId: string, note?: string) {
    const user = await getCurrentUser()
    if (!user) throw new Error("You must be logged in")

    // Verify ownership
    const existing = await db
        .select({ userId: collections.userId, items: collections.items, slug: collections.slug })
        .from(collections)
        .where(eq(collections.id, collectionId))
        .limit(1)

    if (existing.length === 0) throw new Error("Collection not found")
    if (existing[0].userId !== user.id) throw new Error("You do not own this collection")

    const currentItems = (existing[0].items as { cafeId: string; note?: string }[]) || []

    // Check if cafe already in collection
    if (currentItems.some(item => item.cafeId === cafeId)) {
        return { success: true, alreadyExists: true }
    }

    const newItems = [...currentItems, { cafeId, note }]

    await db.update(collections).set({
        items: newItems,
        itemCount: newItems.length,
        updatedAt: new Date(),
    }).where(eq(collections.id, collectionId))

    revalidatePath("/profile/collections")
    revalidatePath(`/community/${existing[0].slug}`)

    return { success: true, alreadyExists: false }
}

// =============================================================================
// REMOVE CAFE FROM COLLECTION
// =============================================================================
export async function removeCafeFromCollection(collectionId: string, cafeId: string) {
    const user = await getCurrentUser()
    if (!user) throw new Error("You must be logged in")

    // Verify ownership
    const existing = await db
        .select({ userId: collections.userId, items: collections.items, slug: collections.slug })
        .from(collections)
        .where(eq(collections.id, collectionId))
        .limit(1)

    if (existing.length === 0) throw new Error("Collection not found")
    if (existing[0].userId !== user.id) throw new Error("You do not own this collection")

    const currentItems = (existing[0].items as { cafeId: string; note?: string }[]) || []
    const newItems = currentItems.filter(item => item.cafeId !== cafeId)

    await db.update(collections).set({
        items: newItems,
        itemCount: newItems.length,
        updatedAt: new Date(),
    }).where(eq(collections.id, collectionId))

    revalidatePath("/profile/collections")
    revalidatePath(`/community/${existing[0].slug}`)

    return { success: true }
}

// =============================================================================
// GET USER COLLECTIONS WITH CAFE STATUS
// =============================================================================
export async function getCollectionsWithCafeStatus(cafeId: string) {
    const user = await getCurrentUser()
    if (!user) return []

    const result = await db
        .select({
            id: collections.id,
            title: collections.title,
            slug: collections.slug,
            coverImage: collections.coverImage,
            itemCount: collections.itemCount,
            isPublic: collections.isPublic,
            items: collections.items,
        })
        .from(collections)
        .where(eq(collections.userId, user.id))
        .orderBy(desc(collections.createdAt))

    return result.map((c) => {
        const items = (c.items as { cafeId: string; note?: string }[]) || []
        const hasCafe = items.some(item => item.cafeId === cafeId)
        return {
            id: c.id,
            title: c.title,
            slug: c.slug,
            coverImage: c.coverImage,
            itemCount: c.itemCount,
            isPublic: c.isPublic,
            hasCafe,
        }
    })
}

// =============================================================================
// SEARCH CAFES FOR ADDING TO COLLECTION
// =============================================================================
export async function searchCafesForCollection(query: string) {
    if (!query || query.length < 2) return []

    const result = await db
        .select({
            id: cafes.id,
            name: cafes.name,
            slug: cafes.slug,
            thumbnail: cafes.thumbnail,
            cityMunicipality: cafes.cityMunicipality,
            region: cafes.region,
        })
        .from(cafes)
        .where(and(eq(cafes.isPublished, true), sql`${cafes.name} ILIKE ${`%${query}%`}`))
        .limit(10)

    return result
}

