"use server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import {
    BlogPost,
    BlogPostInput,
    BlogCategory,
    BlogStatus,
    generateSlug,
} from "@/utils/types/blog"
import { BlogPostRow } from "@/utils/types/blog"

// ============================================
// Helper Functions
// ============================================

async function isAdminOrModerator(): Promise<boolean> {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return false

    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

    return profile?.role === "admin" || profile?.role === "moderator"
}

async function isCafeOwner(cafeId: string): Promise<boolean> {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return false

    const { data: cafe } = await supabase
        .from("cafes")
        .select("owner_ids")
        .eq("id", cafeId)
        .single()

    return cafe?.owner_ids?.includes(user.id) ?? false
}

async function getCurrentUserId(): Promise<string | null> {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    return user?.id ?? null
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

// Type for the raw query result with joined tables
type BlogPostQueryResult = BlogPostRow & {
    author: { id: string; display_name: string; avatar_url: string | null; username: string } | { id: string; display_name: string; avatar_url: string | null; username: string }[] | null
    cafe: { id: string; name: string; slug: string; thumbnail: string } | { id: string; name: string; slug: string; thumbnail: string }[] | null
}

export async function getPublishedBlogPosts(
    params: BlogPaginationParams = {}
): Promise<PaginatedBlogResult> {
    const supabase = await createClient()
    const {
        page = 1,
        pageSize = 12,
        category,
        cafeId,
        search,
        featured,
    } = params
    const offset = (page - 1) * pageSize

    let query = supabase
        .from("blog_posts")
        .select(
            `
            id, title, slug, excerpt, content, cover_image, author_id, cafe_id,
            category, status, tags, featured, views_count, published_at, created_at, updated_at,
            author:profiles!blog_posts_author_id_fkey(id, display_name, avatar_url, username),
            cafe:cafes!blog_posts_cafe_id_fkey(id, name, slug, thumbnail)
        `,
            { count: "exact" }
        )
        .eq("status", "published")
        .order("published_at", { ascending: false })

    if (category) {
        query = query.eq("category", category)
    }
    if (cafeId) {
        query = query.eq("cafe_id", cafeId)
    }
    if (featured !== undefined) {
        query = query.eq("featured", featured)
    }
    if (search) {
        query = query.textSearch("search_vector", search)
    }

    const { data, count, error } = await query.range(
        offset,
        offset + pageSize - 1
    )

    if (error) {
        console.error("Error fetching blog posts:", error)
        return { posts: [], total: 0, page, pageSize, hasMore: false }
    }

    const posts: BlogPost[] = ((data || []) as unknown as BlogPostQueryResult[]).map((post) => ({
        ...post,
        author: Array.isArray(post.author) ? post.author[0] : post.author,
        cafe: Array.isArray(post.cafe) ? post.cafe[0] : post.cafe,
    }))

    return {
        posts,
        total: count || 0,
        page,
        pageSize,
        hasMore: offset + pageSize < (count || 0),
    }
}

export async function getBlogPostBySlug(
    slug: string
): Promise<BlogPost | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from("blog_posts")
        .select(
            `
            id, title, slug, excerpt, content, cover_image, author_id, cafe_id,
            category, status, tags, featured, views_count, published_at, created_at, updated_at,
            author:profiles!blog_posts_author_id_fkey(id, display_name, avatar_url, username),
            cafe:cafes!blog_posts_cafe_id_fkey(id, name, slug, thumbnail)
        `
        )
        .eq("slug", slug)
        .single()

    if (error || !data) {
        return null
    }

    const typedData = data as unknown as BlogPostQueryResult

    // Check access: published posts are public, drafts need author/admin access
    if (typedData.status !== "published") {
        const userId = await getCurrentUserId()
        const isAdmin = await isAdminOrModerator()
        const isOwner = typedData.cafe_id
            ? await isCafeOwner(typedData.cafe_id)
            : false

        if (typedData.author_id !== userId && !isAdmin && !isOwner) {
            return null
        }
    }

    return {
        ...typedData,
        author: Array.isArray(typedData.author) ? typedData.author[0] : typedData.author,
        cafe: Array.isArray(typedData.cafe) ? typedData.cafe[0] : typedData.cafe,
    }
}

export async function getFeaturedPosts(limit: number = 5): Promise<BlogPost[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from("blog_posts")
        .select(
            `
            id, title, slug, excerpt, cover_image, author_id, cafe_id,
            category, status, tags, featured, views_count, published_at, created_at, updated_at,
            author:profiles!blog_posts_author_id_fkey(id, display_name, avatar_url, username),
            cafe:cafes!blog_posts_cafe_id_fkey(id, name, slug, thumbnail)
        `
        )
        .eq("status", "published")
        .eq("featured", true)
        .order("published_at", { ascending: false })
        .limit(limit)

    if (error) {
        console.error("Error fetching featured posts:", error)
        return []
    }

    return ((data || []) as unknown as BlogPostQueryResult[]).map((post) => ({
        ...post,
        content: "", // Don't load full content for list views
        author: Array.isArray(post.author) ? post.author[0] : post.author,
        cafe: Array.isArray(post.cafe) ? post.cafe[0] : post.cafe,
    }))
}

export async function incrementViewCount(postId: string): Promise<void> {
    // Use admin client to bypass RLS for incrementing view count
    const adminClient = await createAdminClient()

    // Get current view count and increment it
    const { data: current } = await adminClient
        .from("blog_posts")
        .select("views_count")
        .eq("id", postId)
        .single()

    if (current) {
        await adminClient
            .from("blog_posts")
            .update({ views_count: (current.views_count || 0) + 1 })
            .eq("id", postId)
    }
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

export async function getAdminBlogPosts(
    params: AdminBlogParams = {}
): Promise<PaginatedBlogResult> {
    if (!(await isAdminOrModerator())) {
        return { posts: [], total: 0, page: 1, pageSize: 20, hasMore: false }
    }

    const adminClient = await createAdminClient()
    const { page = 1, pageSize = 20, status, category, search } = params
    const offset = (page - 1) * pageSize

    let query = adminClient
        .from("blog_posts")
        .select(
            `
            id, title, slug, excerpt, content, cover_image, author_id, cafe_id,
            category, status, tags, featured, views_count, published_at, created_at, updated_at,
            author:profiles!blog_posts_author_id_fkey(id, display_name, avatar_url, username),
            cafe:cafes!blog_posts_cafe_id_fkey(id, name, slug, thumbnail)
        `,
            { count: "exact" }
        )
        .order("created_at", { ascending: false })

    if (status) {
        query = query.eq("status", status)
    }
    if (category) {
        query = query.eq("category", category)
    }
    if (search) {
        query = query.textSearch("search_vector", search)
    }

    const { data, count, error } = await query.range(
        offset,
        offset + pageSize - 1
    )

    if (error) {
        console.error("Error fetching admin blog posts:", error)
        return { posts: [], total: 0, page, pageSize, hasMore: false }
    }

    const posts: BlogPost[] = ((data || []) as unknown as BlogPostQueryResult[]).map((post) => ({
        ...post,
        author: Array.isArray(post.author) ? post.author[0] : post.author,
        cafe: Array.isArray(post.cafe) ? post.cafe[0] : post.cafe,
    }))

    return {
        posts,
        total: count || 0,
        page,
        pageSize,
        hasMore: offset + pageSize < (count || 0),
    }
}

// ============================================
// Cafe Owner Operations
// ============================================

export async function getOwnerBlogPosts(
    cafeId: string
): Promise<BlogPost[]> {
    if (!(await isCafeOwner(cafeId)) && !(await isAdminOrModerator())) {
        return []
    }

    const supabase = await createClient()

    const { data, error } = await supabase
        .from("blog_posts")
        .select(
            `
            id, title, slug, excerpt, content, cover_image, author_id, cafe_id,
            category, status, tags, featured, views_count, published_at, created_at, updated_at,
            author:profiles!blog_posts_author_id_fkey(id, display_name, avatar_url, username)
        `
        )
        .eq("cafe_id", cafeId)
        .order("created_at", { ascending: false })

    if (error) {
        console.error("Error fetching owner blog posts:", error)
        return []
    }

    type OwnerBlogQueryResult = BlogPostRow & {
        author: { id: string; display_name: string; avatar_url: string | null; username: string } | { id: string; display_name: string; avatar_url: string | null; username: string }[] | null
    }

    return ((data || []) as unknown as OwnerBlogQueryResult[]).map((post) => ({
        ...post,
        author: Array.isArray(post.author) ? post.author[0] : post.author,
    }))
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

export async function createBlogPost(
    input: BlogPostInput
): Promise<BlogActionResult> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: "Not authenticated" }
    }

    // Check permissions
    const isAdmin = await isAdminOrModerator()
    const isOwner = input.cafe_id ? await isCafeOwner(input.cafe_id) : false

    if (!isAdmin && !isOwner) {
        return { success: false, error: "Not authorized to create blog posts" }
    }

    // If cafe owner, require cafe_id
    if (!isAdmin && !input.cafe_id) {
        return { success: false, error: "Cafe owners must link posts to a cafe" }
    }

    // Generate slug if not provided
    const baseSlug = input.slug || generateSlug(input.title)
    let slug = baseSlug
    let counter = 1

    const adminClient = await createAdminClient()

    // Ensure unique slug
    while (true) {
        const { data: existing } = await adminClient
            .from("blog_posts")
            .select("id")
            .eq("slug", slug)
            .single()

        if (!existing) break
        slug = `${baseSlug}-${counter++}`
    }

    const { data, error } = await adminClient
        .from("blog_posts")
        .insert({
            title: input.title,
            slug,
            excerpt: input.excerpt || null,
            content: input.content,
            cover_image: input.cover_image || null,
            author_id: userId,
            cafe_id: input.cafe_id || null,
            category: input.category,
            status: input.status,
            tags: input.tags || [],
            featured: input.featured || false,
            published_at:
                input.status === "published" ? new Date().toISOString() : null,
        })
        .select()
        .single()

    if (error) {
        console.error("Error creating blog post:", error)
        return { success: false, error: error.message }
    }

    return { success: true, slug: data.slug }
}

export async function updateBlogPost(
    postId: string,
    input: Partial<BlogPostInput>
): Promise<BlogActionResult> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: "Not authenticated" }
    }

    const adminClient = await createAdminClient()

    // Get existing post
    const { data: existing } = await adminClient
        .from("blog_posts")
        .select("author_id, cafe_id, status")
        .eq("id", postId)
        .single()

    if (!existing) {
        return { success: false, error: "Post not found" }
    }

    // Check permissions
    const isAdmin = await isAdminOrModerator()
    const isOwner = existing.cafe_id
        ? await isCafeOwner(existing.cafe_id)
        : false
    const isAuthor = existing.author_id === userId

    if (!isAdmin && !isOwner && !isAuthor) {
        return { success: false, error: "Not authorized to edit this post" }
    }

    // Handle slug update
    let slug = input.slug
    if (input.title && !input.slug) {
        slug = generateSlug(input.title)
        let counter = 1
        const baseSlug = slug

        while (true) {
            const { data: existingSlug } = await adminClient
                .from("blog_posts")
                .select("id")
                .eq("slug", slug)
                .neq("id", postId)
                .single()

            if (!existingSlug) break
            slug = `${baseSlug}-${counter++}`
        }
    }

    // Set published_at if publishing for first time
    const isPublishing =
        input.status === "published" && existing.status !== "published"

    const updateData: Record<string, unknown> = {
        ...input,
        updated_at: new Date().toISOString(),
    }

    if (slug) {
        updateData.slug = slug
    }

    if (isPublishing) {
        updateData.published_at = new Date().toISOString()
    }

    const { error } = await adminClient
        .from("blog_posts")
        .update(updateData)
        .eq("id", postId)

    if (error) {
        console.error("Error updating blog post:", error)
        return { success: false, error: error.message }
    }

    return { success: true, slug: slug || undefined }
}

export async function deleteBlogPost(postId: string): Promise<BlogActionResult> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: "Not authenticated" }
    }

    const adminClient = await createAdminClient()

    // Get existing post
    const { data: existing } = await adminClient
        .from("blog_posts")
        .select("author_id, cafe_id, cover_image")
        .eq("id", postId)
        .single()

    if (!existing) {
        return { success: false, error: "Post not found" }
    }

    // Check permissions
    const isAdmin = await isAdminOrModerator()
    const isAuthor = existing.author_id === userId

    if (!isAdmin && !isAuthor) {
        return { success: false, error: "Not authorized to delete this post" }
    }

    // Delete the post (images will be cleaned up by storage cleanup job)
    const { error } = await adminClient
        .from("blog_posts")
        .delete()
        .eq("id", postId)

    if (error) {
        console.error("Error deleting blog post:", error)
        return { success: false, error: error.message }
    }

    return { success: true }
}

export async function publishBlogPost(
    postId: string
): Promise<BlogActionResult> {
    return updateBlogPost(postId, { status: "published" })
}

export async function archiveBlogPost(
    postId: string
): Promise<BlogActionResult> {
    return updateBlogPost(postId, { status: "archived" })
}

export async function toggleFeatured(
    postId: string,
    featured: boolean
): Promise<BlogActionResult> {
    if (!(await isAdminOrModerator())) {
        return { success: false, error: "Not authorized" }
    }

    const adminClient = await createAdminClient()

    const { error } = await adminClient
        .from("blog_posts")
        .update({ featured })
        .eq("id", postId)

    if (error) {
        console.error("Error toggling featured:", error)
        return { success: false, error: error.message }
    }

    return { success: true }
}

// ============================================
// Get single blog post by ID (for editing)
// ============================================

export async function getBlogPostById(postId: string): Promise<BlogPost | null> {
    const userId = await getCurrentUserId()

    const adminClient = await createAdminClient()

    const { data, error } = await adminClient
        .from("blog_posts")
        .select(
            `
            id, title, slug, excerpt, content, cover_image, author_id, cafe_id,
            category, status, tags, featured, views_count, published_at, created_at, updated_at,
            author:profiles!blog_posts_author_id_fkey(id, display_name, avatar_url, username),
            cafe:cafes!blog_posts_cafe_id_fkey(id, name, slug, thumbnail)
        `
        )
        .eq("id", postId)
        .single()

    if (error || !data) {
        return null
    }

    const typedData = data as unknown as BlogPostQueryResult

    // Check access
    const isAdmin = await isAdminOrModerator()
    const isOwner = typedData.cafe_id ? await isCafeOwner(typedData.cafe_id) : false
    const isAuthor = typedData.author_id === userId

    if (!isAdmin && !isOwner && !isAuthor) {
        return null
    }

    return {
        ...typedData,
        author: Array.isArray(typedData.author) ? typedData.author[0] : typedData.author,
        cafe: Array.isArray(typedData.cafe) ? typedData.cafe[0] : typedData.cafe,
    }
}
