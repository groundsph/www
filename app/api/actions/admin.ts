'use server'

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { deleteCafeImages, cleanupOrphanedImages, processAvatarDeletionQueue } from "@/utils/supabase/storage"
import { CafeWithRatings } from "@/utils/types/extra"

/**
 * Check if the current user has admin or moderator role
 */
export async function isAdmin(): Promise<boolean> {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()

    if (!user) return false

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    return profile?.role === 'admin' || profile?.role === 'moderator'
}

/**
 * Get all pending (unpublished) cafe submissions
 * Only accessible by admins/moderators
 */
export async function getPendingCafes(): Promise<CafeWithRatings[]> {
    const db = await createClient()

    // Verify admin access
    const { data: { user } } = await db.auth.getUser()
    if (!user) return []

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        return []
    }

    // Fetch pending cafes with contributor info
    const { data: cafes, error } = await db
        .from('cafes')
        .select(`
            *,
            contributor:profiles!cafes_contributor_id_fkey(
                id,
                username,
                display_name,
                avatar_url
            )
        `)
        .eq('is_published', false)
        .order('created_at', { ascending: false })

    if (error) {
        console.error("Error fetching pending cafes:", error)
        return []
    }

    return cafes as unknown as CafeWithRatings[]
}

export interface AdminActionResult {
    success: boolean
    error?: string
}

/**
 * Approve a cafe submission (set is_published = true)
 */
export async function approveCafe(cafeId: string): Promise<AdminActionResult> {
    const db = await createClient()

    // Verify admin access
    const { data: { user } } = await db.auth.getUser()
    if (!user) return { success: false, error: "Not authenticated" }

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    // Use admin client to bypass RLS for the update
    const adminDb = await createAdminClient()
    const { error } = await adminDb
        .from('cafes')
        .update({
            is_published: true,
            is_verified: true
        })
        .eq('id', cafeId)

    if (error) {
        console.error("Error approving cafe:", error)
        return { success: false, error: "Failed to approve cafe" }
    }

    return { success: true }
}

/**
 * Reject a cafe submission (delete it and its images)
 */
export async function rejectCafe(cafeId: string): Promise<AdminActionResult> {
    const db = await createClient()

    // Verify admin access
    const { data: { user } } = await db.auth.getUser()
    if (!user) return { success: false, error: "Not authenticated" }

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    // Use admin client to bypass RLS
    const adminDb = await createAdminClient()

    // Fetch cafe to get image URLs before deletion
    const { data: cafe } = await adminDb
        .from('cafes')
        .select('thumbnail, gallery')
        .eq('id', cafeId)
        .single()

    // Delete images from storage
    if (cafe) {
        await deleteCafeImages(cafe.thumbnail, cafe.gallery)
    }

    // Delete the cafe record
    const { error } = await adminDb
        .from('cafes')
        .delete()
        .eq('id', cafeId)

    if (error) {
        console.error("Error rejecting cafe:", error)
        return { success: false, error: "Failed to reject cafe" }
    }

    return { success: true }
}

/**
 * Get a single cafe by ID (for admin preview/edit)
 */
export async function getCafeById(cafeId: string): Promise<CafeWithRatings | null> {
    const db = await createClient()

    // Verify admin access
    const { data: { user } } = await db.auth.getUser()
    if (!user) return null

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        return null
    }

    const { data: cafe, error } = await db
        .from('cafes')
        .select(`
            *,
            contributor:profiles!cafes_contributor_id_fkey(
                id,
                username,
                display_name,
                avatar_url
            )
        `)
        .eq('id', cafeId)
        .single()

    if (error) {
        console.error("Error fetching cafe:", error)
        return null
    }

    return cafe as unknown as CafeWithRatings
}

/**
 * Update cafe details (admin only)
 */
export async function updateCafe(
    cafeId: string,
    updates: Partial<{
        name: string
        description: string
        address_display: string
        area: string
        lat: number
        lng: number
        has_wifi: boolean
        has_sockets: boolean
        has_parking: boolean
        has_aircon: boolean
        is_pet_friendly: boolean
        has_outdoor_seating: boolean
        serves_food: boolean
        is_work_friendly: boolean
        price_level: "low" | "medium" | "high"
        specialty: string[]
        tags: string[]
        brew_methods: string[]
        payment_methods: string
        roaster: string
        operating_hours: Record<string, unknown>[] | null
        website_url: string
        phone: string
        email: string
        socials: Record<string, unknown>[] | null
    }>
): Promise<AdminActionResult> {
    const db = await createClient()

    // Verify admin access
    const { data: { user } } = await db.auth.getUser()
    if (!user) return { success: false, error: "Not authenticated" }

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    // Use admin client to bypass RLS for the update
    const adminDb = await createAdminClient()
    const { error } = await adminDb
        .from('cafes')
        .update(updates as Record<string, unknown>)
        .eq('id', cafeId)

    if (error) {
        console.error("Error updating cafe:", error)
        return { success: false, error: "Failed to update cafe" }
    }

    return { success: true }
}

/**
 * Get all published cafes (for admin management)
 */
export async function getPublishedCafes(): Promise<CafeWithRatings[]> {
    const db = await createClient()

    // Verify admin access
    const { data: { user } } = await db.auth.getUser()
    if (!user) return []

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        return []
    }

    const { data: cafes, error } = await db
        .from('cafes')
        .select(`
            *,
            contributor:profiles!cafes_contributor_id_fkey(
                id,
                username,
                display_name,
                avatar_url
            )
        `)
        .eq('is_published', true)
        .order('name', { ascending: true })

    if (error) {
        console.error("Error fetching published cafes:", error)
        return []
    }

    return cafes as unknown as CafeWithRatings[]
}

/**
 * Unpublish a cafe (set is_published = false)
 */
export async function unpublishCafe(cafeId: string): Promise<AdminActionResult> {
    const db = await createClient()

    // Verify admin access using regular client
    const { data: { user } } = await db.auth.getUser()
    if (!user) return { success: false, error: "Not authenticated" }

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    // Use admin client to bypass RLS for the update
    const adminDb = await createAdminClient()
    const { error } = await adminDb
        .from('cafes')
        .update({
            is_published: false
        })
        .eq('id', cafeId)

    if (error) {
        console.error("Error unpublishing cafe:", error)
        return { success: false, error: "Failed to unpublish cafe" }
    }

    return { success: true }
}

/**
 * Get cafe story by cafe ID
 */
export async function getCafeStory(cafeId: string): Promise<{ id: string; content: string } | null> {
    const db = await createClient()

    // Verify admin access
    const { data: { user } } = await db.auth.getUser()
    if (!user) return null

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        return null
    }

    const { data: story, error } = await db
        .from('cafe_stories')
        .select('id, content')
        .eq('cafe_id', cafeId)
        .single()

    if (error) {
        // No story exists, that's ok
        return null
    }

    return story
}

/**
 * Create or update cafe story
 */
export async function upsertCafeStory(
    cafeId: string,
    content: string
): Promise<AdminActionResult> {
    const db = await createClient()

    // Verify admin access
    const { data: { user } } = await db.auth.getUser()
    if (!user) return { success: false, error: "Not authenticated" }

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    // Check if story exists
    const { data: existing } = await db
        .from('cafe_stories')
        .select('id')
        .eq('cafe_id', cafeId)
        .single()

    if (existing) {
        // Update existing story
        const { error } = await db
            .from('cafe_stories')
            .update({ content, updated_at: new Date().toISOString() })
            .eq('id', existing.id)

        if (error) {
            console.error("Error updating cafe story:", error)
            return { success: false, error: "Failed to update story" }
        }
    } else {
        // Create new story
        const { error } = await db
            .from('cafe_stories')
            .insert({ cafe_id: cafeId, content })

        if (error) {
            console.error("Error creating cafe story:", error)
            return { success: false, error: "Failed to create story" }
        }
    }

    return { success: true }
}

/**
 * Delete cafe story
 */
export async function deleteCafeStory(cafeId: string): Promise<AdminActionResult> {
    const db = await createClient()

    // Verify admin access
    const { data: { user } } = await db.auth.getUser()
    if (!user) return { success: false, error: "Not authenticated" }

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    const { error } = await db
        .from('cafe_stories')
        .delete()
        .eq('cafe_id', cafeId)

    if (error) {
        console.error("Error deleting cafe story:", error)
        return { success: false, error: "Failed to delete story" }
    }

    return { success: true }
}

/**
 * Admin action to clean up orphaned images from storage
 */
export async function adminCleanupOrphanedImages(): Promise<{
    success: boolean
    deleted?: { cafes: number; reviews: number; avatars: number }
    error?: string
}> {
    const db = await createClient()

    // Verify admin access
    const { data: { user } } = await db.auth.getUser()
    if (!user) return { success: false, error: "Not authenticated" }

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        return { success: false, error: "Admin access required" }
    }

    const result = await cleanupOrphanedImages()
    return result
}

/**
 * Admin action to process avatar deletion queue
 */
export async function adminProcessAvatarQueue(): Promise<{
    success: boolean
    processed?: number
    error?: string
}> {
    const db = await createClient()

    // Verify admin access
    const { data: { user } } = await db.auth.getUser()
    if (!user) return { success: false, error: "Not authenticated" }

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        return { success: false, error: "Admin access required" }
    }

    const result = await processAvatarDeletionQueue()
    return result
}

// ============================================
// Review Moderation Functions
// ============================================

export interface ReviewForModeration {
    id: string
    rating: number
    comment: string
    images: string[] | null
    status: 'published' | 'hidden' | 'flagged' | null
    created_at: string | null
    updated_at: string | null
    report_count: number
    author: {
        id: string
        username: string
        display_name: string
        avatar_url: string | null
    } | null
    cafe: {
        id: string
        name: string
        slug: string
        thumbnail: string
    } | null
}

/**
 * Get all flagged reviews for moderation
 */
export async function getFlaggedReviews(): Promise<ReviewForModeration[]> {
    return getReviewsForModeration('flagged')
}

/**
 * Get reviews for moderation by status
 * @param status - Filter by review status (optional, defaults to all non-published)
 */
export async function getReviewsForModeration(
    status?: 'published' | 'hidden' | 'flagged'
): Promise<ReviewForModeration[]> {
    const db = await createClient()

    // Verify admin access
    const { data: { user } } = await db.auth.getUser()
    if (!user) return []

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        return []
    }

    // Build query
    let query = db
        .from('reviews')
        .select(`
            id,
            rating,
            comment,
            images,
            status,
            created_at,
            updated_at,
            author:profiles!reviews_user_id_fkey(
                id,
                username,
                display_name,
                avatar_url
            ),
            cafe:cafes!reviews_cafe_id_fkey(
                id,
                name,
                slug,
                thumbnail
            )
        `)
        .order('updated_at', { ascending: false })

    if (status) {
        query = query.eq('status', status)
    }

    const { data: reviews, error } = await query

    if (error) {
        console.error("Error fetching reviews for moderation:", error)
        return []
    }

    // Get report counts for each review
    const reviewIds = reviews?.map(r => r.id) || []
    const { data: reportCounts } = await db
        .from('review_interactions')
        .select('review_id')
        .in('review_id', reviewIds)
        .eq('interaction_type', 'report')

    // Count reports per review
    const reportMap = new Map<string, number>()
    reportCounts?.forEach(r => {
        const current = reportMap.get(r.review_id) || 0
        reportMap.set(r.review_id, current + 1)
    })

    return (reviews || []).map(r => ({
        ...r,
        author: r.author as ReviewForModeration['author'],
        cafe: r.cafe as ReviewForModeration['cafe'],
        report_count: reportMap.get(r.id) || 0
    }))
}

/**
 * Moderate a review (change its status)
 * @param reviewId - The review to moderate
 * @param newStatus - The new status to set
 */
export async function moderateReview(
    reviewId: string,
    newStatus: 'published' | 'hidden' | 'flagged'
): Promise<AdminActionResult> {
    const db = await createClient()

    // Verify admin access
    const { data: { user } } = await db.auth.getUser()
    if (!user) return { success: false, error: "Not authenticated" }

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    // Use admin client to bypass RLS
    const adminDb = await createAdminClient()
    const { error } = await adminDb
        .from('reviews')
        .update({
            status: newStatus,
            updated_at: new Date().toISOString()
        })
        .eq('id', reviewId)

    if (error) {
        console.error("Error moderating review:", error)
        return { success: false, error: "Failed to moderate review" }
    }

    // If approving (publishing), clear all report interactions
    if (newStatus === 'published') {
        await adminDb
            .from('review_interactions')
            .delete()
            .eq('review_id', reviewId)
            .eq('interaction_type', 'report')
    }

    return { success: true }
}

/**
 * Delete a review as admin (permanently removes it)
 * @param reviewId - The review to delete
 */
export async function deleteReviewAsAdmin(reviewId: string): Promise<AdminActionResult> {
    const db = await createClient()

    // Verify admin access
    const { data: { user } } = await db.auth.getUser()
    if (!user) return { success: false, error: "Not authenticated" }

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    // Use admin client to bypass RLS
    const adminDb = await createAdminClient()

    // Get review images first
    const { data: review } = await adminDb
        .from('reviews')
        .select('images')
        .eq('id', reviewId)
        .single()

    // Delete review images from storage
    if (review?.images && review.images.length > 0) {
        const { deleteReviewImages } = await import('@/utils/supabase/storage')
        await deleteReviewImages(review.images)
    }

    // Delete review interactions
    await adminDb
        .from('review_interactions')
        .delete()
        .eq('review_id', reviewId)

    // Delete the review
    const { error } = await adminDb
        .from('reviews')
        .delete()
        .eq('id', reviewId)

    if (error) {
        console.error("Error deleting review:", error)
        return { success: false, error: "Failed to delete review" }
    }

    return { success: true }
}
