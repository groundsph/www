"use server"

import { db } from "@/db"
import { blogPosts, profiles, cafes, cafeSubscriptions } from "@/db/schema"
import { eq, and, desc, count, sql, ne, inArray, or, ilike } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
import { headers } from "next/headers"
import {
    BlogPost,
    BlogPostInput,
    BlogCategory,
    BlogStatus,
    generateSlug,
} from "@/utils/types/blog"
import { format } from "date-fns"
import { resolveBlogStatus } from "@/utils/blog/moderation"
import { canSubmitBlogPost } from "@/utils/blog/community-posting"
import { checkBlogPost } from "@/utils/ai/openai-compatible"
import { revalidatePath } from "next/cache"

// ============================================
// Helper Functions
// ============================================

async function isAdminOrModerator(): Promise<boolean> {
    const user = await getCurrentUser()
    if (!user) return false

    const result = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, user.id))
        .limit(1)

    const role = result[0]?.role
    return role === "admin" || role === "moderator"
}

async function isCafeOwner(cafeId: string): Promise<boolean> {
    const user = await getCurrentUser()
    if (!user) return false

    const result = await db
        .select({ ownerIds: cafes.ownerIds })
        .from(cafes)
        .where(eq(cafes.id, cafeId))
        .limit(1)

    return result[0]?.ownerIds?.includes(user.id) ?? false
}

async function getCurrentUserId(): Promise<string | null> {
    const user = await getCurrentUser()
    return user?.id ?? null
}

function normalizeSearchQuery(search: string): string {
    return search.trim().replace(/\s+/g, " ")
}

function buildBlogSearchCondition(search: string) {
    const normalized = normalizeSearchQuery(search)
    if (!normalized) return undefined

    const likePattern = `%${normalized}%`
    return or(
        sql`${blogPosts.searchVector} @@ plainto_tsquery('english', ${normalized})`,
        ilike(blogPosts.title, likePattern),
        ilike(blogPosts.excerpt, likePattern),
        ilike(blogPosts.content, likePattern)
    )
}

// Helper to map blog post
function mapBlogPost(
    b: {
        id: string
        title: string
        slug: string
        excerpt: string | null
        content: string
        coverImage: string | null
        authorId: string | null
        cafeId: string | null
        category: string | null
        status: string | null
        tags: string[] | null
        images: string[] | null
        taggedCafeIds: string[] | null
        crawlId: string | null
        featured: boolean | null
        viewsCount: number | null
        publishedAt: Date | null
        createdAt: Date | null
        updatedAt: Date | null
    },
    author?: { id: string; displayName: string; avatarUrl: string | null; username: string } | null,
    cafe?: { id: string; name: string; slug: string; thumbnail: string } | null
): BlogPost {
    return {
        id: b.id,
        title: b.title,
        slug: b.slug,
        excerpt: b.excerpt,
        content: b.content,
        cover_image: b.coverImage,
        author_id: b.authorId,
        cafe_id: b.cafeId,
        category: b.category as BlogCategory,
        status: b.status as BlogStatus,
        tags: b.tags,
        images: b.images,
        tagged_cafe_ids: b.taggedCafeIds,
        crawl_id: b.crawlId,
        featured: b.featured ?? false,
        views_count: b.viewsCount ?? 0,
        published_at: b.publishedAt?.toISOString() ?? null,
        created_at: b.createdAt?.toISOString() ?? null,
        updated_at: b.updatedAt?.toISOString() ?? null,
        author: author ? { id: author.id, display_name: author.displayName, avatar_url: author.avatarUrl, username: author.username } : null,
        cafe: cafe ? { id: cafe.id, name: cafe.name, slug: cafe.slug, thumbnail: cafe.thumbnail } : null,
    } as BlogPost
}

// ============================================
// Public Read Operations
// ============================================

export interface BlogPaginationParams {
    page?: number
    pageSize?: number
    category?: BlogCategory
    cafeId?: string
    search?: string
    featured?: boolean
}

export interface PaginatedBlogResult {
    posts: BlogPost[]
    total: number
    page: number
    pageSize: number
    hasMore: boolean
}

export async function getPublishedBlogPosts(
    params: BlogPaginationParams = {}
): Promise<PaginatedBlogResult> {
    const { page = 1, pageSize = 12, category, cafeId, search, featured } = params
    const offset = (page - 1) * pageSize

    const conditions = [eq(blogPosts.status, "published")]
    if (category) conditions.push(eq(blogPosts.category, category))
    if (cafeId) conditions.push(eq(blogPosts.cafeId, cafeId))
    if (featured !== undefined) conditions.push(eq(blogPosts.featured, featured))

    // Handle search with tsquery + ilike fallback
    let postsResult
    let countResult
    const searchCondition = search ? buildBlogSearchCondition(search) : undefined
    if (searchCondition) {
        postsResult = await db
            .select({
                id: blogPosts.id, title: blogPosts.title, slug: blogPosts.slug, excerpt: blogPosts.excerpt,
                content: blogPosts.content, coverImage: blogPosts.coverImage, authorId: blogPosts.authorId,
                cafeId: blogPosts.cafeId, category: blogPosts.category, status: blogPosts.status,
                tags: blogPosts.tags, images: blogPosts.images, taggedCafeIds: blogPosts.taggedCafeIds,
                crawlId: blogPosts.crawlId, featured: blogPosts.featured, viewsCount: blogPosts.viewsCount,
                publishedAt: blogPosts.publishedAt, createdAt: blogPosts.createdAt, updatedAt: blogPosts.updatedAt,
            })
            .from(blogPosts)
            .where(and(...conditions, searchCondition))
            .orderBy(desc(blogPosts.publishedAt))
            .limit(pageSize)
            .offset(offset)
        countResult = await db.select({ count: count() }).from(blogPosts).where(and(...conditions, searchCondition))
    } else {
        [postsResult, countResult] = await Promise.all([
            db.select({
                id: blogPosts.id, title: blogPosts.title, slug: blogPosts.slug, excerpt: blogPosts.excerpt,
                content: blogPosts.content, coverImage: blogPosts.coverImage, authorId: blogPosts.authorId,
                cafeId: blogPosts.cafeId, category: blogPosts.category, status: blogPosts.status,
                tags: blogPosts.tags, images: blogPosts.images, taggedCafeIds: blogPosts.taggedCafeIds,
                crawlId: blogPosts.crawlId, featured: blogPosts.featured, viewsCount: blogPosts.viewsCount,
                publishedAt: blogPosts.publishedAt, createdAt: blogPosts.createdAt, updatedAt: blogPosts.updatedAt,
            })
                .from(blogPosts)
                .where(and(...conditions))
                .orderBy(desc(blogPosts.publishedAt))
                .limit(pageSize)
                .offset(offset),
            db.select({ count: count() }).from(blogPosts).where(and(...conditions)),
        ])
    }

    if (postsResult.length === 0) {
        return { posts: [], total: countResult[0]?.count ?? 0, page, pageSize, hasMore: false }
    }

    // Fetch authors and cafes
    const authorIds = [...new Set(postsResult.map(p => p.authorId).filter(Boolean))] as string[]
    const cafeIds = [...new Set(postsResult.map(p => p.cafeId).filter(Boolean))] as string[]

    const [authorsResult, cafesResult] = await Promise.all([
        authorIds.length > 0 ? db.select({ id: profiles.id, displayName: profiles.displayName, avatarUrl: profiles.avatarUrl, username: profiles.username })
            .from(profiles).where(inArray(profiles.id, authorIds)) : Promise.resolve([]),
        cafeIds.length > 0 ? db.select({ id: cafes.id, name: cafes.name, slug: cafes.slug, thumbnail: cafes.thumbnail })
            .from(cafes).where(inArray(cafes.id, cafeIds)) : Promise.resolve([]),
    ])

    const authorMap = new Map(authorsResult.map(a => [a.id, a]))
    const cafeMap = new Map(cafesResult.map(c => [c.id, c]))

    const total = countResult[0]?.count ?? 0
    return {
        posts: postsResult.map(p => mapBlogPost(p, p.authorId ? authorMap.get(p.authorId) : null, p.cafeId ? cafeMap.get(p.cafeId) : null)),
        total,
        page,
        pageSize,
        hasMore: offset + pageSize < total,
    }
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
    const result = await db.select({
        id: blogPosts.id, title: blogPosts.title, slug: blogPosts.slug, excerpt: blogPosts.excerpt,
        content: blogPosts.content, coverImage: blogPosts.coverImage, authorId: blogPosts.authorId,
        cafeId: blogPosts.cafeId, category: blogPosts.category, status: blogPosts.status,
        tags: blogPosts.tags, images: blogPosts.images, taggedCafeIds: blogPosts.taggedCafeIds, crawlId: blogPosts.crawlId, featured: blogPosts.featured, viewsCount: blogPosts.viewsCount,
        publishedAt: blogPosts.publishedAt, createdAt: blogPosts.createdAt, updatedAt: blogPosts.updatedAt,
    })
        .from(blogPosts)
        .where(eq(blogPosts.slug, slug))
        .limit(1)

    const post = result[0]
    if (!post) return null

    // Draft access check
    if (post.status !== "published") {
        const userId = await getCurrentUserId()
        const isAdmin = await isAdminOrModerator()
        const isOwner = post.cafeId ? await isCafeOwner(post.cafeId) : false

        if (post.authorId !== userId && !isAdmin && !isOwner) return null
    }

    // Fetch author and cafe
    const [authorResult, cafeResult] = await Promise.all([
        post.authorId ? db.select({ id: profiles.id, displayName: profiles.displayName, avatarUrl: profiles.avatarUrl, username: profiles.username })
            .from(profiles).where(eq(profiles.id, post.authorId)).limit(1) : Promise.resolve([]),
        post.cafeId ? db.select({ id: cafes.id, name: cafes.name, slug: cafes.slug, thumbnail: cafes.thumbnail })
            .from(cafes).where(eq(cafes.id, post.cafeId)).limit(1) : Promise.resolve([]),
    ])

    return mapBlogPost(post, authorResult[0], cafeResult[0])
}

export async function getFeaturedPosts(limit: number = 5): Promise<BlogPost[]> {
    const postsResult = await db.select({
        id: blogPosts.id, title: blogPosts.title, slug: blogPosts.slug, excerpt: blogPosts.excerpt,
        content: blogPosts.content, coverImage: blogPosts.coverImage, authorId: blogPosts.authorId,
        cafeId: blogPosts.cafeId, category: blogPosts.category, status: blogPosts.status,
        tags: blogPosts.tags, images: blogPosts.images, taggedCafeIds: blogPosts.taggedCafeIds, crawlId: blogPosts.crawlId, featured: blogPosts.featured, viewsCount: blogPosts.viewsCount,
        publishedAt: blogPosts.publishedAt, createdAt: blogPosts.createdAt, updatedAt: blogPosts.updatedAt,
    })
        .from(blogPosts)
        .where(and(eq(blogPosts.status, "published"), eq(blogPosts.featured, true)))
        .orderBy(desc(blogPosts.publishedAt))
        .limit(limit)

    if (postsResult.length === 0) return []

    const authorIds = [...new Set(postsResult.map(p => p.authorId).filter(Boolean))] as string[]
    const cafeIds = [...new Set(postsResult.map(p => p.cafeId).filter(Boolean))] as string[]

    const [authorsResult, cafesResult] = await Promise.all([
        authorIds.length > 0 ? db.select({ id: profiles.id, displayName: profiles.displayName, avatarUrl: profiles.avatarUrl, username: profiles.username })
            .from(profiles).where(inArray(profiles.id, authorIds)) : Promise.resolve([]),
        cafeIds.length > 0 ? db.select({ id: cafes.id, name: cafes.name, slug: cafes.slug, thumbnail: cafes.thumbnail })
            .from(cafes).where(inArray(cafes.id, cafeIds)) : Promise.resolve([]),
    ])

    const authorMap = new Map(authorsResult.map(a => [a.id, a]))
    const cafeMap = new Map(cafesResult.map(c => [c.id, c]))

    return postsResult.map(p => {
        const mapped = mapBlogPost(p, p.authorId ? authorMap.get(p.authorId) : null, p.cafeId ? cafeMap.get(p.cafeId) : null)
        mapped.content = "" // Don't load content for list views
        return mapped
    })
}

export async function incrementViewCount(postId: string): Promise<void> {
    // Skip view tracking on localhost to prevent false views
    const headersList = await headers()
    const host = headersList.get("host") || ""
    if (host.includes("localhost") || host.includes("127.0.0.1")) {
        return
    }

    await db.update(blogPosts)
        .set({ viewsCount: sql`COALESCE(${blogPosts.viewsCount}, 0) + 1` })
        .where(eq(blogPosts.id, postId))
}

// ============================================
// Admin/Moderator Operations
// ============================================

export interface AdminBlogParams {
    page?: number
    pageSize?: number
    status?: BlogStatus
    category?: BlogCategory
    search?: string
}

export async function getAdminBlogPosts(params: AdminBlogParams = {}): Promise<PaginatedBlogResult> {
    if (!(await isAdminOrModerator())) {
        return { posts: [], total: 0, page: 1, pageSize: 20, hasMore: false }
    }

    const { page = 1, pageSize = 20, status, category, search } = params
    const offset = (page - 1) * pageSize

    const conditions: ReturnType<typeof eq>[] = []
    if (status) conditions.push(eq(blogPosts.status, status))
    if (category) conditions.push(eq(blogPosts.category, category))

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined
    const searchCondition = search ? buildBlogSearchCondition(search) : undefined
    const finalWhere = whereClause && searchCondition ? and(whereClause, searchCondition) : (whereClause || searchCondition)

    const [postsResult, countResult] = await Promise.all([
        db.select({
            id: blogPosts.id, title: blogPosts.title, slug: blogPosts.slug, excerpt: blogPosts.excerpt,
            content: blogPosts.content, coverImage: blogPosts.coverImage, authorId: blogPosts.authorId,
            cafeId: blogPosts.cafeId, category: blogPosts.category, status: blogPosts.status,
            tags: blogPosts.tags, images: blogPosts.images, taggedCafeIds: blogPosts.taggedCafeIds, crawlId: blogPosts.crawlId, featured: blogPosts.featured, viewsCount: blogPosts.viewsCount,
            publishedAt: blogPosts.publishedAt, createdAt: blogPosts.createdAt, updatedAt: blogPosts.updatedAt,
        })
            .from(blogPosts)
            .where(finalWhere)
            .orderBy(desc(blogPosts.createdAt))
            .limit(pageSize)
            .offset(offset),
        db.select({ count: count() }).from(blogPosts).where(finalWhere),
    ])

    if (postsResult.length === 0) {
        return { posts: [], total: countResult[0]?.count ?? 0, page, pageSize, hasMore: false }
    }

    const authorIds = [...new Set(postsResult.map(p => p.authorId).filter(Boolean))] as string[]
    const cafeIds = [...new Set(postsResult.map(p => p.cafeId).filter(Boolean))] as string[]

    const [authorsResult, cafesResult] = await Promise.all([
        authorIds.length > 0 ? db.select({ id: profiles.id, displayName: profiles.displayName, avatarUrl: profiles.avatarUrl, username: profiles.username })
            .from(profiles).where(inArray(profiles.id, authorIds)) : Promise.resolve([]),
        cafeIds.length > 0 ? db.select({ id: cafes.id, name: cafes.name, slug: cafes.slug, thumbnail: cafes.thumbnail })
            .from(cafes).where(inArray(cafes.id, cafeIds)) : Promise.resolve([]),
    ])

    const authorMap = new Map(authorsResult.map(a => [a.id, a]))
    const cafeMap = new Map(cafesResult.map(c => [c.id, c]))

    const total = countResult[0]?.count ?? 0
    return {
        posts: postsResult.map(p => mapBlogPost(p, p.authorId ? authorMap.get(p.authorId) : null, p.cafeId ? cafeMap.get(p.cafeId) : null)),
        total,
        page,
        pageSize,
        hasMore: offset + pageSize < total,
    }
}

/**
 * Retrieves paginated blog posts for writers and admins.
 * Supports filtering by status, category, and search query.
 * Returns empty results if user is not authenticated or lacks writer/admin role.
 *
 * @param params - Query and pagination parameters
 * @param params.page - Page number (1-indexed, defaults to 1)
 * @param params.pageSize - Number of posts per page (defaults to 20)
 * @param params.status - Filter by post status (optional)
 * @param params.category - Filter by post category (optional)
 * @param params.search - Search term to filter posts (optional)
 * @returns Promise resolving to PaginatedBlogResult containing posts and metadata
 */
export async function getWriterBlogPosts(params: AdminBlogParams = {}): Promise<PaginatedBlogResult> {
    const user = await getCurrentUser()
    if (!user) return { posts: [], total: 0, page: 1, pageSize: 20, hasMore: false }

    const profileResult = await db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, user.id)).limit(1)
    const role = profileResult[0]?.role
    if (role !== "writer" && role !== "admin") {
        return { posts: [], total: 0, page: 1, pageSize: 20, hasMore: false }
    }

    const { page = 1, pageSize = 20, status, category, search } = params

    const conditions: ReturnType<typeof eq>[] = []
    if (status) conditions.push(eq(blogPosts.status, status))
    if (category) conditions.push(eq(blogPosts.category, category))

    let additionalConditions: ReturnType<typeof and> | undefined
    if (conditions.length > 0) {
        additionalConditions = and(...conditions)
    }

    if (search) {
        const searchCondition = buildBlogSearchCondition(search)
        additionalConditions = additionalConditions ? and(additionalConditions, searchCondition) : searchCondition
    }

    return fetchUserBlogsWithPagination({ page, pageSize, userId: user.id, additionalConditions })
}

export async function getWriterBlogPostById(id: string): Promise<BlogPost | null> {
    const user = await getCurrentUser()
    if (!user) return null

    const profileResult = await db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, user.id)).limit(1)
    const role = profileResult[0]?.role
    if (role !== "writer" && role !== "admin") return null

    const postResult = await db.select({
        id: blogPosts.id, title: blogPosts.title, slug: blogPosts.slug, excerpt: blogPosts.excerpt,
        content: blogPosts.content, coverImage: blogPosts.coverImage, authorId: blogPosts.authorId,
        cafeId: blogPosts.cafeId, category: blogPosts.category, status: blogPosts.status,
        tags: blogPosts.tags, images: blogPosts.images, taggedCafeIds: blogPosts.taggedCafeIds, crawlId: blogPosts.crawlId, featured: blogPosts.featured, viewsCount: blogPosts.viewsCount,
        publishedAt: blogPosts.publishedAt, createdAt: blogPosts.createdAt, updatedAt: blogPosts.updatedAt,
    })
        .from(blogPosts)
        .where(and(eq(blogPosts.id, id), eq(blogPosts.authorId, user.id)))
        .limit(1)

    if (!postResult[0]) return null

    const authorResult = await db.select({ id: profiles.id, displayName: profiles.displayName, avatarUrl: profiles.avatarUrl, username: profiles.username })
        .from(profiles).where(eq(profiles.id, user.id)).limit(1)

    return mapBlogPost(postResult[0], authorResult[0], null)
}

// ============================================
// Cafe Owner Operations
// ============================================

export async function getOwnerBlogPosts(cafeId: string): Promise<BlogPost[]> {
    if (!(await isCafeOwner(cafeId)) && !(await isAdminOrModerator())) return []

    const postsResult = await db.select({
        id: blogPosts.id, title: blogPosts.title, slug: blogPosts.slug, excerpt: blogPosts.excerpt,
        content: blogPosts.content, coverImage: blogPosts.coverImage, authorId: blogPosts.authorId,
        cafeId: blogPosts.cafeId, category: blogPosts.category, status: blogPosts.status,
        tags: blogPosts.tags, images: blogPosts.images, taggedCafeIds: blogPosts.taggedCafeIds, crawlId: blogPosts.crawlId, featured: blogPosts.featured, viewsCount: blogPosts.viewsCount,
        publishedAt: blogPosts.publishedAt, createdAt: blogPosts.createdAt, updatedAt: blogPosts.updatedAt,
    })
        .from(blogPosts)
        .where(eq(blogPosts.cafeId, cafeId))
        .orderBy(desc(blogPosts.createdAt))

    if (postsResult.length === 0) return []

    const authorIds = [...new Set(postsResult.map(p => p.authorId).filter(Boolean))] as string[]
    const authorsResult = authorIds.length > 0
        ? await db.select({ id: profiles.id, displayName: profiles.displayName, avatarUrl: profiles.avatarUrl, username: profiles.username })
            .from(profiles).where(inArray(profiles.id, authorIds))
        : []
    const authorMap = new Map(authorsResult.map(a => [a.id, a]))

    return postsResult.map(p => mapBlogPost(p, p.authorId ? authorMap.get(p.authorId) : null, null))
}

// ============================================
// Create/Update/Delete Operations
// ============================================

export interface BlogActionResult {
    success: boolean
    error?: string
    post?: BlogPost
    slug?: string
}

export async function createBlogPost(input: BlogPostInput): Promise<BlogActionResult> {
    const userId = await getCurrentUserId()
    if (!userId) return { success: false, error: "Not authenticated" }

    const isAdminMod = await isAdminOrModerator()
    const isOwner = input.cafe_id ? await isCafeOwner(input.cafe_id) : false

    // Fetch role for non-admin/mod users
    let userRole: string | null = null
    if (!isAdminMod) {
        const profileResult = await db
            .select({ role: profiles.role })
            .from(profiles)
            .where(eq(profiles.id, userId))
            .limit(1)
        userRole = profileResult[0]?.role ?? null
    }

    // Use canSubmitBlogPost to check submission eligibility
    const submissionCheck = canSubmitBlogPost({
        role: userRole as "user" | "writer" | "admin" | "moderator" | null,
        category: input.category,
        hasCafeOwnership: isOwner,
    })

    // If not allowed, return error
    if (!submissionCheck.allowed) {
        if (userRole === "user") {
            return { success: false, error: "Regular users can only submit community posts" }
        }
        return { success: false, error: "You must link posts to a cafe you own" }
    }

    // For users, force category to "community" and status to "pending"
    let finalCategory = input.category
    let finalStatus = resolveBlogStatus(input.status, isAdminMod)

    if (userRole === "user") {
        finalCategory = "community"
        finalStatus = "pending" // Force pending for users
    }

    // Tier check for cafe owners (requires cafe_id)
    if (!isAdminMod && input.cafe_id) {
        const subResult = await db
            .select({ tier: cafeSubscriptions.tier })
            .from(cafeSubscriptions)
            .where(eq(cafeSubscriptions.cafeId, input.cafe_id))
            .limit(1)
        const tier = subResult[0]?.tier || "free"
        if (tier === "free") {
            return { success: false, error: "Blog posting requires a Pro subscription or higher. Upgrade to start sharing your cafe's story." }
        }
    }

    // Generate unique slug
    const dateStr = format(new Date(), "dd-MM-yyyy")
    const baseSlug = input.slug || generateSlug(`${input.title}-${dateStr}`)
    let slug = baseSlug
    let counter = 1

    while (true) {
        const existing = await db.select({ id: blogPosts.id }).from(blogPosts).where(eq(blogPosts.slug, slug)).limit(1)
        if (!existing[0]) break
        slug = `${baseSlug}-${counter++}`
    }

    // Run LLM check for non-admin/mod posts
    let llmReview = null
    if (!isAdminMod) {
        try {
            const model = process.env.BLOG_CHECK_MODEL || "gpt-4"
            llmReview = await checkBlogPost(model, input.content)
        } catch (error) {
            console.error("LLM check failed:", error)
            // Fail-closed: require manual review if LLM check fails
            llmReview = { approved: false, issues: ["LLM check failed - requires manual review"], suggestions: [] }
        }
    }

    const [inserted] = await db.insert(blogPosts).values({
        title: input.title,
        slug,
        excerpt: input.excerpt || null,
        content: input.content,
        coverImage: input.cover_image || null,
        authorId: userId,
        cafeId: input.cafe_id || null,
        category: finalCategory,
        status: finalStatus,
        llmReview,
        tags: input.tags || [],
        images: input.images || [],
        taggedCafeIds: input.tagged_cafe_ids || [],
        crawlId: input.crawl_id || null,
        featured: input.featured || false,
        publishedAt: finalStatus === "published" ? new Date() : null,
    }).returning()

    if (!inserted) return { success: false, error: "Failed to create blog post" }

    return { success: true, slug: inserted.slug }
}

export async function updateBlogPost(postId: string, input: Partial<BlogPostInput>): Promise<BlogActionResult> {
    const userId = await getCurrentUserId()
    if (!userId) return { success: false, error: "Not authenticated" }

    const existing = await db.select({ authorId: blogPosts.authorId, cafeId: blogPosts.cafeId, status: blogPosts.status, publishedAt: blogPosts.publishedAt })
        .from(blogPosts).where(eq(blogPosts.id, postId)).limit(1)

    if (!existing[0]) return { success: false, error: "Post not found" }

    const isAdminMod = await isAdminOrModerator()
    const isOwner = existing[0].cafeId ? await isCafeOwner(existing[0].cafeId) : false
    const isAuthor = existing[0].authorId === userId

    if (!isAdminMod && !isOwner && !isAuthor) {
        return { success: false, error: "Not authorized to edit this post" }
    }

    // Handle slug update
    let slug = input.slug
    if (input.title && !input.slug) {
        const dateStr = format(new Date(), "dd-MM-yyyy")
        slug = generateSlug(`${input.title}-${dateStr}`)
        let counter = 1
        const baseSlug = slug

        while (true) {
            const existingSlug = await db.select({ id: blogPosts.id })
                .from(blogPosts).where(and(eq(blogPosts.slug, slug), ne(blogPosts.id, postId))).limit(1)
            if (!existingSlug[0]) break
            slug = `${baseSlug}-${counter++}`
        }
    }

    // Re-run LLM check if content changes for non-admin/mod updates
    let llmReview = null
    if (!isAdminMod && input.content !== undefined) {
        try {
            const model = process.env.BLOG_CHECK_MODEL || "gpt-4"
            llmReview = await checkBlogPost(model, input.content)
        } catch (error) {
            console.error("LLM check failed during update:", error)
            // Fail-closed: require manual review if LLM check fails
            llmReview = { approved: false, issues: ["LLM check failed during update - requires manual review"], suggestions: [] }
        }
    }

    // Resolve status with moderation rules
    const resolvedStatus = input.status ? resolveBlogStatus(input.status, isAdminMod) : undefined
    const isPublishing = resolvedStatus === "published" && existing[0].status !== "published"
    const isUnpublishing = resolvedStatus && resolvedStatus !== "published" && existing[0].status === "published"

    const updateData: Partial<typeof blogPosts.$inferInsert> = { updatedAt: new Date() }
    if (input.title !== undefined) updateData.title = input.title
    if (slug) updateData.slug = slug
    if (input.excerpt !== undefined) updateData.excerpt = input.excerpt
    if (input.content !== undefined) updateData.content = input.content
    if (input.cover_image !== undefined) updateData.coverImage = input.cover_image
    if (input.cafe_id !== undefined) updateData.cafeId = input.cafe_id
    if (input.category !== undefined) updateData.category = input.category
    if (resolvedStatus !== undefined) updateData.status = resolvedStatus
    if (input.tags !== undefined) updateData.tags = input.tags
    if (input.images !== undefined) updateData.images = input.images
    if (input.tagged_cafe_ids !== undefined) updateData.taggedCafeIds = input.tagged_cafe_ids
    if (input.crawl_id !== undefined) updateData.crawlId = input.crawl_id
    if (input.featured !== undefined) updateData.featured = input.featured
    if (llmReview !== null) updateData.llmReview = llmReview

    // Only admin/mod can set publishedAt; preserve it for non-admin/mod
    if (isPublishing && isAdminMod) {
        updateData.publishedAt = new Date()
    } else if (isUnpublishing) {
        updateData.publishedAt = null
    }

    await db.update(blogPosts).set(updateData).where(eq(blogPosts.id, postId))

    return { success: true, slug: slug || undefined }
}

export async function deleteBlogPost(postId: string): Promise<BlogActionResult> {
    const userId = await getCurrentUserId()
    if (!userId) return { success: false, error: "Not authenticated" }

    const existing = await db.select({ authorId: blogPosts.authorId, cafeId: blogPosts.cafeId })
        .from(blogPosts).where(eq(blogPosts.id, postId)).limit(1)

    if (!existing[0]) return { success: false, error: "Post not found" }

    const isAdmin = await isAdminOrModerator()
    const isAuthor = existing[0].authorId === userId

    if (!isAdmin && !isAuthor) {
        return { success: false, error: "Not authorized to delete this post" }
    }

    await db.delete(blogPosts).where(eq(blogPosts.id, postId))
    return { success: true }
}

export async function publishBlogPost(postId: string): Promise<BlogActionResult> {
    return updateBlogPost(postId, { status: "published" })
}

export async function archiveBlogPost(postId: string): Promise<BlogActionResult> {
    return updateBlogPost(postId, { status: "archived" })
}

export async function approveBlogPost(postId: string): Promise<BlogActionResult> {
    if (!(await isAdminOrModerator())) {
        return { success: false, error: "Not authorized" }
    }

    const existing = await db.select({ status: blogPosts.status, slug: blogPosts.slug })
        .from(blogPosts).where(eq(blogPosts.id, postId)).limit(1)

    if (!existing[0]) return { success: false, error: "Post not found" }

    const isAlreadyPublished = existing[0].status === "published"

    await db.update(blogPosts)
        .set({
            status: "published",
            publishedAt: isAlreadyPublished ? undefined : new Date(),
            updatedAt: new Date(),
        })
        .where(eq(blogPosts.id, postId))

    revalidatePath("/blog")
    revalidatePath("/admin/blog")
    revalidatePath(`/blog/${existing[0].slug}`)

    return { success: true }
}

export async function toggleFeatured(postId: string, featured: boolean): Promise<BlogActionResult> {
    if (!(await isAdminOrModerator())) return { success: false, error: "Not authorized" }

    await db.update(blogPosts).set({ featured }).where(eq(blogPosts.id, postId))
    return { success: true }
}

// ============================================
// Helper Functions for User Blog Queries
// ============================================

interface UserBlogQueryParams {
    page: number
    pageSize: number
    userId: string
    additionalConditions?: ReturnType<typeof and>
}

async function fetchUserBlogsWithPagination(params: UserBlogQueryParams): Promise<PaginatedBlogResult> {
    const { page, pageSize, userId, additionalConditions } = params
    const offset = (page - 1) * pageSize

    const baseConditions = eq(blogPosts.authorId, userId)
    const finalWhere = additionalConditions ? and(baseConditions, additionalConditions) : baseConditions

    const [postsResult, countResult] = await Promise.all([
        db.select({
            id: blogPosts.id, title: blogPosts.title, slug: blogPosts.slug, excerpt: blogPosts.excerpt,
            content: blogPosts.content, coverImage: blogPosts.coverImage, authorId: blogPosts.authorId,
            cafeId: blogPosts.cafeId, category: blogPosts.category, status: blogPosts.status,
            tags: blogPosts.tags, images: blogPosts.images, taggedCafeIds: blogPosts.taggedCafeIds, crawlId: blogPosts.crawlId, featured: blogPosts.featured, viewsCount: blogPosts.viewsCount,
            publishedAt: blogPosts.publishedAt, createdAt: blogPosts.createdAt, updatedAt: blogPosts.updatedAt,
        })
            .from(blogPosts)
            .where(finalWhere)
            .orderBy(desc(blogPosts.createdAt))
            .limit(pageSize)
            .offset(offset),
        db.select({ count: count() }).from(blogPosts).where(finalWhere),
    ])

    if (postsResult.length === 0) {
        return { posts: [], total: countResult[0]?.count ?? 0, page, pageSize, hasMore: false }
    }

    const authorResult = await db.select({ id: profiles.id, displayName: profiles.displayName, avatarUrl: profiles.avatarUrl, username: profiles.username })
        .from(profiles).where(eq(profiles.id, userId)).limit(1)

    const total = countResult[0]?.count ?? 0
    return {
        posts: postsResult.map(p => mapBlogPost(p, authorResult[0], null)),
        total,
        page,
        pageSize,
        hasMore: offset + pageSize < total,
    }
}

// ============================================
// Community User Operations
// ============================================

/**
 * Creates a community blog post for the current user.
 * Community posts are always created with "pending" status for moderation.
 * Revalidates the /blog path on successful creation.
 *
 * @param input - The blog post data
 * @param input.title - The post title (required, must not be empty)
 * @param input.excerpt - Optional post excerpt/summary
 * @param input.content - The post content (required, must not be empty)
 * @param input.cover_image - Optional cover image URL
 * @returns Promise resolving to BlogActionResult with success status and slug on success
 */
export async function createCommunityBlogPost(input: {
    title: string
    excerpt?: string
    content: string
    cover_image?: string | null
}): Promise<BlogActionResult> {
    // Validate required fields
    if (!input.title || input.title.trim().length === 0) {
        return { success: false, error: "Title is required" }
    }
    if (!input.content || input.content.trim().length === 0) {
        return { success: false, error: "Content is required" }
    }

    const result = await createBlogPost({
        title: input.title,
        excerpt: input.excerpt,
        content: input.content,
        cover_image: input.cover_image,
        category: "community",
        status: "pending",
        tags: [],
        featured: false,
        images: [],
        tagged_cafe_ids: [],
        crawl_id: null,
        cafe_id: null,
    })

    if (result.success) {
        revalidatePath("/blog")
    }

    return result
}

/**
 * Retrieves paginated blog posts for the currently authenticated user.
 * Returns empty results if user is not authenticated.
 *
 * @param params - Pagination parameters
 * @param params.page - Page number (1-indexed, defaults to 1)
 * @param params.pageSize - Number of posts per page (defaults to 20)
 * @returns Promise resolving to PaginatedBlogResult containing posts and metadata
 */
export async function getUserBlogPosts(params: { page?: number; pageSize?: number } = {}): Promise<PaginatedBlogResult> {
    const userId = await getCurrentUserId()
    if (!userId) return { posts: [], total: 0, page: 1, pageSize: 20, hasMore: false }

    const { page = 1, pageSize = 20 } = params
    return fetchUserBlogsWithPagination({ page, pageSize, userId })
}

export async function getBlogPostById(postId: string): Promise<BlogPost | null> {
    const userId = await getCurrentUserId()

    const postResult = await db.select({
        id: blogPosts.id, title: blogPosts.title, slug: blogPosts.slug, excerpt: blogPosts.excerpt,
        content: blogPosts.content, coverImage: blogPosts.coverImage, authorId: blogPosts.authorId,
        cafeId: blogPosts.cafeId, category: blogPosts.category, status: blogPosts.status,
        tags: blogPosts.tags, images: blogPosts.images, taggedCafeIds: blogPosts.taggedCafeIds, crawlId: blogPosts.crawlId, featured: blogPosts.featured, viewsCount: blogPosts.viewsCount,
        publishedAt: blogPosts.publishedAt, createdAt: blogPosts.createdAt, updatedAt: blogPosts.updatedAt,
    })
        .from(blogPosts)
        .where(eq(blogPosts.id, postId))
        .limit(1)

    const post = postResult[0]
    if (!post) return null

    const isAdmin = await isAdminOrModerator()
    const isOwner = post.cafeId ? await isCafeOwner(post.cafeId) : false
    const isAuthor = post.authorId === userId

    if (!isAdmin && !isOwner && !isAuthor) return null

    const [authorResult, cafeResult] = await Promise.all([
        post.authorId ? db.select({ id: profiles.id, displayName: profiles.displayName, avatarUrl: profiles.avatarUrl, username: profiles.username })
            .from(profiles).where(eq(profiles.id, post.authorId)).limit(1) : Promise.resolve([]),
        post.cafeId ? db.select({ id: cafes.id, name: cafes.name, slug: cafes.slug, thumbnail: cafes.thumbnail })
            .from(cafes).where(eq(cafes.id, post.cafeId)).limit(1) : Promise.resolve([]),
    ])

    return mapBlogPost(post, authorResult[0], cafeResult[0])
}
