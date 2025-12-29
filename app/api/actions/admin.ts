/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase relational queries return complex nested types that require any for flattening */
'use server'

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { deleteCafeImagesAction, deleteSingleCafeImageAction } from "@/utils/storage/actions"
import { cleanupOrphanedImages, processAvatarDeletionQueue } from "@/utils/supabase/storage"
import { sendCafeApprovedEmail, sendCafeRejectedEmail, sendSubscriptionApprovedEmail, sendSubscriptionRejectedEmail } from "@/utils/email"
import { CafeWithRatings, ProfileStats } from "@/utils/types/extra"
import { Database } from "@/utils/types/database.types"
import { checkAndAwardBadges } from "@/utils/badges/badge-logic"
import { logContribution, getChangedFields, generateChangeSummary } from "@/utils/contribution-logging"

type ScoutRank = Database['public']['Enums']['scout_rank']

/**
 * Calculate scout rank based on total published cafes contributed
 */
function calculateScoutRank(totalScouted: number): ScoutRank {
    if (totalScouted >= 10) return 'vanguard'
    if (totalScouted >= 5) return 'expert'
    return 'novice'
}

/**
 * Update a contributor's scout stats (total_scouted and scout_rank)
 * Called after a cafe is published, unpublished, or deleted
 */
async function updateContributorScoutStats(contributorId: string): Promise<void> {
    if (!contributorId) return

    const adminDb = await createAdminClient()

    // Count total published cafes for this contributor
    const { count, error: countError } = await adminDb
        .from('cafes')
        .select('*', { count: 'exact', head: true })
        .eq('contributor_id', contributorId)
        .eq('is_published', true)

    if (countError) {
        console.error("Error counting contributor cafes:", countError)
        return
    }

    const totalScouted = count ?? 0
    const newRank = calculateScoutRank(totalScouted)

    // Get current profile stats
    const { data: profile, error: profileError } = await adminDb
        .from('profiles')
        .select('stats')
        .eq('id', contributorId)
        .single()

    if (profileError) {
        console.error("Error fetching contributor profile:", profileError)
        return
    }

    // Merge with existing stats
    const currentStats = (profile?.stats as ProfileStats | null) ?? {
        scout_rank: 'novice',
        total_photos: 0,
        total_reviews: 0,
        total_scouted: 0
    }

    const updatedStats: ProfileStats = {
        ...currentStats,
        total_scouted: totalScouted,
        scout_rank: newRank
    }

    // Update profile with new stats
    const { error: updateError } = await adminDb
        .from('profiles')
        .update({ stats: updatedStats as unknown as Database['public']['Tables']['profiles']['Update']['stats'] })
        .eq('id', contributorId)

    if (updateError) {
        console.error("Error updating contributor stats:", updateError)
    }
}

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
 * Get the current user's role
 * Returns 'admin', 'moderator', 'user', or null if not authenticated
 */
export async function getUserRole(): Promise<'admin' | 'moderator' | 'user' | null> {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()

    if (!user) return null

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    return profile?.role ?? 'user'
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

    // Use admin client to bypass RLS for fetching unpublished cafes
    const adminDb = await createAdminClient()

    // Fetch pending cafes with contributor info
    const { data: cafes, error } = await adminDb
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

    // Get cafe info before updating
    const { data: cafe } = await adminDb
        .from('cafes')
        .select('name, slug, contributor_id')
        .eq('id', cafeId)
        .single()

    const { error } = await adminDb
        .from('cafes')
        .update({
            is_published: true
        })
        .eq('id', cafeId)

    if (error) {
        console.error("Error approving cafe:", error)
        return { success: false, error: "Failed to approve cafe" }
    }

    // Auto-approve any pending ownership claim from the contributor
    if (cafe?.contributor_id) {
        const { data: pendingClaim } = await adminDb
            .from('cafe_claims')
            .select('id')
            .eq('cafe_id', cafeId)
            .eq('user_id', cafe.contributor_id)
            .eq('status', 'pending')
            .single()

        if (pendingClaim) {
            // Approve the claim - set is_claimed and add to owner_ids
            await adminDb
                .from('cafe_claims')
                .update({
                    status: 'approved',
                    reviewed_at: new Date().toISOString(),
                    reviewed_by: user.id,
                    admin_notes: 'Auto-approved with cafe approval',
                })
                .eq('id', pendingClaim.id)

            // Update cafe ownership
            await adminDb
                .from('cafes')
                .update({
                    is_claimed: true,
                    owner_ids: [cafe.contributor_id],
                })
                .eq('id', cafeId)

            console.log(`[approveCafe] Auto-approved ownership claim for cafe ${cafeId}`)
        }
    }

    // Update contributor's scout stats and send notification email
    if (cafe?.contributor_id) {
        await updateContributorScoutStats(cafe.contributor_id)

        // Check and award any earned scout badges
        await checkAndAwardBadges(cafe.contributor_id, {
            scout: true,
            geographic: false
        })

        // Get contributor's email and profile info for notification
        try {
            const { data: userData } = await adminDb.auth.admin.getUserById(cafe.contributor_id)
            const { data: contributorProfile } = await adminDb
                .from('profiles')
                .select('display_name')
                .eq('id', cafe.contributor_id)
                .single()

            if (userData?.user?.email && cafe.name && cafe.slug) {
                await sendCafeApprovedEmail(
                    userData.user.email,
                    cafe.name,
                    cafe.slug,
                    contributorProfile?.display_name || undefined
                )
            }
        } catch (emailError) {
            // Log email error but don't fail the approval
            console.error("Error sending cafe approval email:", emailError)
        }
    }

    return { success: true }
}


/**
 * Reject a cafe submission (delete it and its images)
 */
export async function rejectCafe(cafeId: string, reason?: string): Promise<AdminActionResult> {
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

    // Fetch cafe to get image URLs, name, and contributor info before deletion
    const { data: cafe } = await adminDb
        .from('cafes')
        .select('name, thumbnail, gallery, contributor_id, is_published')
        .eq('id', cafeId)
        .single()

    // Store cafe info for email before deletion
    const cafeName = cafe?.name
    const contributorId = cafe?.contributor_id
    const wasPublished = cafe?.is_published

    // Delete images from storage
    if (cafe) {
        await deleteCafeImagesAction(cafe.thumbnail, cafe.gallery)
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

    // Update contributor's scout stats if cafe was published
    if (wasPublished && contributorId) {
        await updateContributorScoutStats(contributorId)
    }

    // Send rejection notification email
    if (contributorId && cafeName) {
        try {
            const { data: userData } = await adminDb.auth.admin.getUserById(contributorId)
            const { data: contributorProfile } = await adminDb
                .from('profiles')
                .select('display_name')
                .eq('id', contributorId)
                .single()

            if (userData?.user?.email) {
                await sendCafeRejectedEmail(
                    userData.user.email,
                    cafeName,
                    contributorProfile?.display_name || undefined,
                    reason
                )
            }
        } catch (emailError) {
            // Log email error but don't fail the rejection
            console.error("Error sending cafe rejection email:", emailError)
        }
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

    const dbAdmin = await createAdminClient()

    const { data: cafe, error } = await dbAdmin
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
        has_indoor_seating: boolean
        has_restroom: boolean
        has_bidet: boolean
        has_non_dairy: boolean
        milk_options: string[]
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
        thumbnail: string | null
        gallery: string[] | null
        slug: string
        is_verified: boolean
        owner_ids: string[] | null
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

    // Fetch current cafe data for change detection
    const { data: currentCafe } = await adminDb
        .from('cafes')
        .select('name, description, address_display, area, lat, lng, has_wifi, has_sockets, has_parking, has_aircon, is_pet_friendly, has_outdoor_seating, serves_food, is_work_friendly, price_level, specialty, tags, brew_methods, payment_methods, roaster, operating_hours, website_url, phone, email, socials, thumbnail, gallery, slug, is_verified, owner_ids')
        .eq('id', cafeId)
        .single()

    const { error } = await adminDb
        .from('cafes')
        .update(updates as Record<string, unknown>)
        .eq('id', cafeId)

    if (error) {
        console.error("Error updating cafe:", error)
        return { success: false, error: "Failed to update cafe" }
    }

    // Log contribution
    const changedFields = currentCafe ? getChangedFields(currentCafe as Record<string, unknown>, updates as Record<string, unknown>) : Object.keys(updates)
    const summary = generateChangeSummary(changedFields)

    await logContribution(adminDb, user.id, cafeId, 'UPDATE', {
        summary,
        source: 'admin_edit',
        cafe_name: updates.name || currentCafe?.name,
        changed_fields: changedFields
    })

    return { success: true }
}

/**
 * Delete a single cafe image from storage (admin only)
 * Used when admins remove individual images from cafe thumbnail or gallery
 */
export async function adminDeleteCafeImage(imageUrl: string): Promise<AdminActionResult> {
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

    // Use the storage action to delete the image
    return deleteSingleCafeImageAction(imageUrl)
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

// ============================================
// Paginated Cafe Functions
// ============================================

export interface CafePaginationParams {
    page?: number
    pageSize?: number
    province?: string
    city?: string
    search?: string
    sortBy?: 'name' | 'date' | 'city' | 'province'
    sortOrder?: 'asc' | 'desc'
    isPublished: boolean
}

export interface PaginatedCafesResult {
    cafes: CafeWithRatings[]
    total: number
    page: number
    pageSize: number
    hasMore: boolean
}

/**
 * Get paginated cafes with server-side filtering and sorting
 * Supports filtering by province, city, search query
 * Supports sorting by name, date, city, province
 */
export async function getPaginatedCafes(params: CafePaginationParams): Promise<PaginatedCafesResult> {
    const {
        page = 1,
        pageSize = 25,
        province,
        city,
        search,
        sortBy = 'name',
        sortOrder = 'asc',
        isPublished
    } = params

    const db = await createClient()

    // Verify admin access
    const { data: { user } } = await db.auth.getUser()
    if (!user) return { cafes: [], total: 0, page, pageSize, hasMore: false }

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        return { cafes: [], total: 0, page, pageSize, hasMore: false }
    }

    // Use admin client to bypass RLS for unpublished cafes
    const adminDb = isPublished ? db : await createAdminClient()

    // Build the query
    let query = adminDb
        .from('cafes')
        .select(`
            *,
            contributor:profiles!cafes_contributor_id_fkey(
                id,
                username,
                display_name,
                avatar_url
            )
        `, { count: 'exact' })
        .eq('is_published', isPublished)

    // Apply province filter
    if (province) {
        query = query.eq('province', province)
    }

    // Apply city filter
    if (city) {
        query = query.eq('city_municipality', city)
    }

    // Apply search filter (using ilike for case-insensitive partial match)
    if (search && search.trim()) {
        const searchTerm = `%${search.trim()}%`
        query = query.or(`name.ilike.${searchTerm},address_display.ilike.${searchTerm},city_municipality.ilike.${searchTerm},province.ilike.${searchTerm}`)
    }

    // Apply sorting
    const ascending = sortOrder === 'asc'
    switch (sortBy) {
        case 'name':
            query = query.order('name', { ascending })
            break
        case 'date':
            query = query.order('created_at', { ascending: !ascending }) // Reverse for date (newest first by default)
            break
        case 'city':
            query = query.order('city_municipality', { ascending, nullsFirst: false })
            break
        case 'province':
            query = query.order('province', { ascending, nullsFirst: false })
            break
    }

    // Apply pagination
    const offset = (page - 1) * pageSize
    query = query.range(offset, offset + pageSize - 1)

    const { data: cafes, error, count } = await query

    if (error) {
        console.error("Error fetching paginated cafes:", error)
        return { cafes: [], total: 0, page, pageSize, hasMore: false }
    }

    const total = count ?? 0
    const hasMore = offset + pageSize < total

    return {
        cafes: cafes as unknown as CafeWithRatings[],
        total,
        page,
        pageSize,
        hasMore
    }
}

// ============================================
// Manual Payments / Subscriptions
// ============================================

/**
 * Get all manual subscriptions (pending and verified)
 */
export async function getManualSubscriptions(): Promise<any[]> {
    const db = await createClient()

    // Verify admin access
    const { data: { user } = {} } = await db.auth.getUser()
    if (!user) return []

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        return []
    }

    const adminDb = await createAdminClient()

    // Fetch subscriptions with cafe details
    const { data: subscriptions, error } = await adminDb
        .from('cafe_subscriptions')
        .select(`
            *,
            cafes:cafe_id (
                id,
                name,
                slug
            )
        `)
        .eq('is_manual_payment', true)
        .order('created_at', { ascending: false })

    if (error) {
        console.error("Error fetching manual subscriptions:", error)
        return []
    }

    return subscriptions
}

/**
 * Verify a manual payment
 * Returns proof info so client can download before deletion
 */
export async function verifyManualPayment(cafeId: string, subscriptionId: string): Promise<AdminActionResult & {
    proofInfo?: {
        url: string
        filename: string
    }
}> {
    const db = await createClient()

    // Verify admin access
    const { data: { user } = {} } = await db.auth.getUser()
    if (!user) return { success: false, error: "Not authenticated" }

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    const adminDb = await createAdminClient()

    // 1. Get subscription with proof and cafe info
    const { data: sub, error: fetchError } = await adminDb
        .from('cafe_subscriptions')
        .select(`
            tier,
            proof_of_payment_url,
            created_at,
            cafes:cafe_id (name, slug, owner_ids)
        `)
        .eq('id', subscriptionId)
        .eq('cafe_id', cafeId)
        .single()

    if (fetchError || !sub) {
        console.error("Error fetching subscription:", fetchError)
        return { success: false, error: "Subscription not found" }
    }

    // 2. Update subscription status
    const { error: subError } = await adminDb
        .from('cafe_subscriptions')
        .update({
            payment_verified: true,
            status: 'active',
            proof_of_payment_url: null, // Clear the URL since we'll delete the file
            updated_at: new Date().toISOString()
        })
        .eq('id', subscriptionId)
        .eq('cafe_id', cafeId)

    if (subError) {
        console.error("Error verifying subscription:", subError)
        return { success: false, error: "Failed to verify subscription" }
    }

    // 3. Update cafe tier and verification status
    await adminDb
        .from('cafes')
        .update({
            membership_tier: sub.tier,
            is_verified: true,
            updated_at: new Date().toISOString()
        })
        .eq('id', cafeId)

    // 4. Prepare proof info for client download
    let proofInfo: { url: string; filename: string } | undefined
    const cafeName = (sub.cafes as any)?.name || 'cafe'
    const cafeSlug = (sub.cafes as any)?.slug || ''
    if (sub.proof_of_payment_url) {
        const uploadDate = sub.created_at ? new Date(sub.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
        const ext = sub.proof_of_payment_url.split('.').pop()?.split('?')[0] || 'jpg'
        const sanitizedCafeName = cafeName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
        const filename = `${sanitizedCafeName}_${uploadDate}.${ext}`

        proofInfo = {
            url: sub.proof_of_payment_url,
            filename
        }
    }

    // 5. Send email notification to cafe owner (only to primary owner)
    const ownerIds = (sub.cafes as any)?.owner_ids as string[] | undefined
    if (ownerIds && ownerIds.length > 0) {
        // Get primary owner's email from auth and display name from profiles
        const [{ data: userData }, { data: profile }] = await Promise.all([
            adminDb.auth.admin.getUserById(ownerIds[0]),
            adminDb.from('profiles').select('display_name').eq('id', ownerIds[0]).single()
        ])

        if (userData?.user?.email) {
            const displayTier = sub.tier === 'basic' ? 'Pro' : 'Premium'
            await sendSubscriptionApprovedEmail(
                userData.user.email,
                cafeName,
                cafeSlug,
                displayTier,
                profile?.display_name || undefined
            )
        }
    }

    return { success: true, proofInfo }
}

/**
 * Delete a subscription proof of payment file from storage
 * Called by the client after successfully downloading the proof
 */
export async function deleteSubscriptionProof(proofUrl: string): Promise<AdminActionResult> {
    const db = await createClient()

    // Verify admin access
    const { data: { user } = {} } = await db.auth.getUser()
    if (!user) return { success: false, error: "Not authenticated" }

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    // Delete the proof file from storage
    await deleteSingleCafeImageAction(proofUrl)

    return { success: true }
}

/**
 * Reject a manual payment
 * Also deletes the proof of payment file from storage
 */
export async function rejectManualPayment(cafeId: string, subscriptionId: string, reason?: string): Promise<AdminActionResult> {
    const db = await createClient()

    // Verify admin access
    const { data: { user } = {} } = await db.auth.getUser()
    if (!user) return { success: false, error: "Not authenticated" }

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    const adminDb = await createAdminClient()

    // 1. Get the subscription with cafe info before deleting
    const { data: sub } = await adminDb
        .from('cafe_subscriptions')
        .select(`
            tier,
            proof_of_payment_url,
            cafes:cafe_id (name, owner_ids)
        `)
        .eq('id', subscriptionId)
        .eq('cafe_id', cafeId)
        .single()

    const proofUrl = sub?.proof_of_payment_url
    const cafeName = (sub?.cafes as any)?.name || 'cafe'
    const ownerIds = (sub?.cafes as any)?.owner_ids as string[] | undefined
    const tier = sub?.tier

    // 2. Delete the subscription record entirely
    const { error: subError } = await adminDb
        .from('cafe_subscriptions')
        .delete()
        .eq('id', subscriptionId)
        .eq('cafe_id', cafeId)

    if (subError) {
        console.error("Error rejecting subscription:", subError)
        return { success: false, error: "Failed to reject subscription" }
    }

    // 3. Delete the proof file from storage
    if (proofUrl) {
        await deleteSingleCafeImageAction(proofUrl)
    }

    // 4. Downgrade cafe to free tier and remove verification
    const { error: cafeError } = await adminDb
        .from('cafes')
        .update({
            membership_tier: 'free',
            is_verified: false,
            updated_at: new Date().toISOString()
        })
        .eq('id', cafeId)

    if (cafeError) {
        console.error("Error updating cafe tier:", cafeError)
        // Non-critical, continue but log
    }

    // 5. Send rejection email to primary owner
    if (ownerIds && ownerIds.length > 0 && tier) {
        const [{ data: userData }, { data: ownerProfile }] = await Promise.all([
            adminDb.auth.admin.getUserById(ownerIds[0]),
            adminDb.from('profiles').select('display_name').eq('id', ownerIds[0]).single()
        ])

        if (userData?.user?.email) {
            const displayTier = tier === 'basic' ? 'Pro' : 'Premium'
            await sendSubscriptionRejectedEmail(
                userData.user.email,
                cafeName,
                displayTier,
                ownerProfile?.display_name || undefined,
                reason
            )
        }
    }

    return { success: true }
}

export interface CafeFilterOptions {
    provinces: string[]
    cities: { province: string; cities: string[] }[]
    totalPublished: number
    totalPending: number
}

/**
 * Get filter options for cafe admin (provinces, cities, counts)
 * Used to populate filter dropdowns without loading all cafes
 */
export async function getCafeFilterOptions(): Promise<CafeFilterOptions> {
    const db = await createClient()

    // Verify admin access
    const { data: { user } } = await db.auth.getUser()
    if (!user) return { provinces: [], cities: [], totalPublished: 0, totalPending: 0 }

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        return { provinces: [], cities: [], totalPublished: 0, totalPending: 0 }
    }

    const adminDb = await createAdminClient()

    // Get all cafes (just province and city fields for efficiency)
    const { data: cafes } = await adminDb
        .from('cafes')
        .select('province, city_municipality, is_published')

    if (!cafes) {
        return { provinces: [], cities: [], totalPublished: 0, totalPending: 0 }
    }

    // Build province and city lists
    const provinceSet = new Set<string>()
    const cityMap = new Map<string, Set<string>>()
    let totalPublished = 0
    let totalPending = 0

    cafes.forEach(cafe => {
        if (cafe.is_published) {
            totalPublished++
        } else {
            totalPending++
        }

        if (cafe.province) {
            provinceSet.add(cafe.province)
            if (!cityMap.has(cafe.province)) {
                cityMap.set(cafe.province, new Set())
            }
            if (cafe.city_municipality) {
                cityMap.get(cafe.province)!.add(cafe.city_municipality)
            }
        }
    })

    const provinces = Array.from(provinceSet).sort()
    const cities = provinces.map(province => ({
        province,
        cities: Array.from(cityMap.get(province) || []).sort()
    }))

    return { provinces, cities, totalPublished, totalPending }
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

    // Get contributor_id before unpublishing
    const { data: cafe } = await adminDb
        .from('cafes')
        .select('contributor_id')
        .eq('id', cafeId)
        .single()

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

    // Update contributor's scout stats
    if (cafe?.contributor_id) {
        await updateContributorScoutStats(cafe.contributor_id)
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
    deleted?: {
        cafes: number
        reviews: number
        avatars: number
        blogs: number
        events: number
        menuPhotos: number
        badges: number
        ownershipProofs: number
    }
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
 * Get all reviews that have been reported (have report interactions)
 * This includes reviews that haven't reached the auto-flag threshold yet
 */
export async function getReportedReviews(): Promise<ReviewForModeration[]> {
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

    const dbAdmin = await createAdminClient()

    // First, get all review IDs that have report interactions
    const { data: reportedReviewIds } = await dbAdmin
        .from('review_interactions')
        .select('review_id')
        .eq('interaction_type', 'report')

    if (!reportedReviewIds || reportedReviewIds.length === 0) {
        return []
    }

    // Get unique review IDs
    const uniqueReviewIds = [...new Set(reportedReviewIds.map(r => r.review_id))]

    // Fetch the reviews with those IDs
    const { data: reviews, error } = await dbAdmin
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
        .in('id', uniqueReviewIds)
        .order('updated_at', { ascending: false })

    if (error) {
        console.error("Error fetching reported reviews:", error)
        return []
    }

    // Count reports per review
    const reportMap = new Map<string, number>()
    reportedReviewIds.forEach(r => {
        const current = reportMap.get(r.review_id) || 0
        reportMap.set(r.review_id, current + 1)
    })

    return (reviews || []).map(r => ({
        ...r,
        author: r.author as ReviewForModeration['author'],
        cafe: r.cafe as ReviewForModeration['cafe'],
        report_count: reportMap.get(r.id) || 0
    })).sort((a, b) => b.report_count - a.report_count) // Sort by most reports first
}

/**
 * Get all flagged reviews for moderation (status = 'flagged')
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

    const dbAdmin = await createAdminClient()

    // Build query
    let query = dbAdmin
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
    const { data: reportCounts } = await dbAdmin
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

// ============================================
// Badge Management Functions
// ============================================

export interface BadgeDefinition {
    id: string
    name: string
    description: string
    image_url: string
    category: 'achievement' | 'monetary' | 'social'
    rarity: 'common' | 'rare' | 'legendary'
    metadata: Record<string, unknown> | null
    created_at: string | null
}

/**
 * Get all badge definitions
 */
export async function getAllBadgeDefinitions(): Promise<BadgeDefinition[]> {
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

    const { data: badges, error } = await db
        .from('badge_definitions')
        .select('*')
        .order('rarity', { ascending: true })
        .order('name', { ascending: true })

    if (error) {
        console.error("Error fetching badge definitions:", error)
        return []
    }

    return badges as BadgeDefinition[]
}

/**
 * Create a new badge definition
 */
export async function createBadgeDefinition(badge: {
    name: string
    description: string
    image_url: string
    category: 'achievement' | 'monetary' | 'social'
    rarity: 'common' | 'rare' | 'legendary'
    metadata?: Record<string, unknown>
}): Promise<AdminActionResult & { badge?: BadgeDefinition }> {
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

    // Validate required fields
    if (!badge.name?.trim()) {
        return { success: false, error: "Badge name is required" }
    }
    if (!badge.description?.trim()) {
        return { success: false, error: "Badge description is required" }
    }
    if (!badge.image_url?.trim()) {
        return { success: false, error: "Badge image is required" }
    }

    const adminDb = await createAdminClient()
    const { data: newBadge, error } = await adminDb
        .from('badge_definitions')
        .insert({
            name: badge.name.trim(),
            description: badge.description.trim(),
            image_url: badge.image_url,
            category: badge.category,
            rarity: badge.rarity,
            metadata: badge.metadata as any || null
        } as any)
        .select()
        .single()

    if (error) {
        console.error("Error creating badge:", error)
        return { success: false, error: "Failed to create badge" }
    }

    return { success: true, badge: newBadge as BadgeDefinition }
}

/**
 * Update an existing badge definition
 */
export async function updateBadgeDefinition(
    badgeId: string,
    updates: Partial<{
        name: string
        description: string
        image_url: string
        category: 'achievement' | 'monetary' | 'social'
        rarity: 'common' | 'rare' | 'legendary'
        metadata: Record<string, unknown> | null
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

    const adminDb = await createAdminClient()
    const { error } = await adminDb
        .from('badge_definitions')
        .update(updates as Record<string, unknown>)
        .eq('id', badgeId)

    if (error) {
        console.error("Error updating badge:", error)
        return { success: false, error: "Failed to update badge" }
    }

    return { success: true }
}

/**
 * Delete a badge definition
 * Note: This will cascade delete from user_badges
 */
export async function deleteBadgeDefinition(badgeId: string): Promise<AdminActionResult> {
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

    const adminDb = await createAdminClient()

    // Get badge image URL to delete from storage
    const { data: badge } = await adminDb
        .from('badge_definitions')
        .select('image_url')
        .eq('id', badgeId)
        .single()

    // Delete from database (cascades to user_badges)
    const { error } = await adminDb
        .from('badge_definitions')
        .delete()
        .eq('id', badgeId)

    if (error) {
        console.error("Error deleting badge:", error)
        return { success: false, error: "Failed to delete badge" }
    }

    // Delete badge image from storage
    if (badge?.image_url) {
        const { deleteBadgeImage } = await import('@/utils/supabase/storage')
        await deleteBadgeImage(badge.image_url)
    }

    return { success: true }
}

/**
 * Award a badge to a user
 */
export async function awardBadgeToUser(
    userId: string,
    badgeId: string,
    evidenceUrl?: string
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

    const adminDb = await createAdminClient()

    // Check if user already has this badge
    const { data: existing } = await adminDb
        .from('user_badges')
        .select('id')
        .eq('user_id', userId)
        .eq('badge_id', badgeId)
        .single()

    if (existing) {
        return { success: false, error: "User already has this badge" }
    }

    // Award the badge
    const { error } = await adminDb
        .from('user_badges')
        .insert({
            user_id: userId,
            badge_id: badgeId,
            evidence_url: evidenceUrl || null,
            awarded_at: new Date().toISOString()
        })

    if (error) {
        console.error("Error awarding badge:", error)
        return { success: false, error: "Failed to award badge" }
    }

    return { success: true }
}

/**
 * Revoke a badge from a user
 */
export async function revokeBadgeFromUser(
    userId: string,
    badgeId: string
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

    const adminDb = await createAdminClient()
    const { error } = await adminDb
        .from('user_badges')
        .delete()
        .eq('user_id', userId)
        .eq('badge_id', badgeId)

    if (error) {
        console.error("Error revoking badge:", error)
        return { success: false, error: "Failed to revoke badge" }
    }

    return { success: true }
}

/**
 * Search users for badge awarding
 */
export async function searchUsersForBadge(query: string): Promise<{
    id: string
    username: string
    display_name: string
    avatar_url: string | null
}[]> {
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

    if (!query || query.length < 2) {
        return []
    }

    const { data: users, error } = await db
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .limit(10)

    if (error) {
        console.error("Error searching users:", error)
        return []
    }

    return users || []
}

/**
 * Search users for cafe owner assignment (admin only)
 * Same as searchUsersForBadge but semantically separate for owner management
 */
export async function searchUsersForOwner(query: string): Promise<{
    id: string
    username: string
    display_name: string
    avatar_url: string | null
}[]> {
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

    if (!query || query.length < 2) {
        return []
    }

    const { data: users, error } = await db
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .limit(10)

    if (error) {
        console.error("Error searching users for owner:", error)
        return []
    }

    return users || []
}

/**
 * Get owner profiles by IDs (admin only)
 * Used to resolve owner_ids array to full profile data
 */
export async function getOwnerProfiles(ownerIds: string[]): Promise<{
    id: string
    username: string
    display_name: string
    avatar_url: string | null
}[]> {
    if (!ownerIds || ownerIds.length === 0) return []

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

    const { data: owners, error } = await db
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', ownerIds)

    if (error) {
        console.error("Error fetching owner profiles:", error)
        return []
    }

    return owners || []
}

/**
 * Get users who have a specific badge with pagination
 */
export async function getUsersWithBadge(
    badgeId: string,
    limit: number = 20,
    offset: number = 0
): Promise<{
    users: {
        user_id: string
        username: string
        display_name: string
        avatar_url: string | null
        awarded_at: string | null
    }[]
    total: number
    hasMore: boolean
}> {
    const db = await createClient()

    // Verify admin access
    const { data: { user } } = await db.auth.getUser()
    if (!user) return { users: [], total: 0, hasMore: false }

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        return { users: [], total: 0, hasMore: false }
    }

    // Get total count
    const { count } = await db
        .from('user_badges')
        .select('*', { count: 'exact', head: true })
        .eq('badge_id', badgeId)

    const total = count || 0

    // Get paginated users
    const { data: userBadges, error } = await db
        .from('user_badges')
        .select(`
            user_id,
            awarded_at,
            profile:profiles!user_badges_user_id_fkey(
                username,
                display_name,
                avatar_url
            )
        `)
        .eq('badge_id', badgeId)
        .order('awarded_at', { ascending: false })
        .range(offset, offset + limit - 1)

    if (error) {
        console.error("Error fetching users with badge:", error)
        return { users: [], total: 0, hasMore: false }
    }

    const users = (userBadges || []).map(ub => ({
        user_id: ub.user_id,
        awarded_at: ub.awarded_at,
        username: (ub.profile as any)?.username || '',
        display_name: (ub.profile as any)?.display_name || '',
        avatar_url: (ub.profile as any)?.avatar_url || null
    }))

    return {
        users,
        total,
        hasMore: offset + limit < total
    }
}

/**
 * Award a badge to ALL users
 * This is a potentially heavy operation, so we do it in chunks
 */
export async function awardBadgeToAllUsers(badgeId: string): Promise<{ success: boolean; error?: string }> {
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

    const adminDb = await createAdminClient()

    // 1. Fetch all user IDs
    const { data: profiles, error: fetchError } = await adminDb
        .from('profiles')
        .select('id')

    if (fetchError) {
        return { success: false, error: `Failed to fetch users: ${fetchError.message}` }
    }

    if (!profiles || profiles.length === 0) {
        return { success: true }
    }

    const updates = profiles.map(p => ({
        user_id: p.id,
        badge_id: badgeId
    }))

    // 2. Bulk insert chunked
    const CHUNK_SIZE = 1000

    for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
        const chunk = updates.slice(i, i + CHUNK_SIZE)
        const { error: insertError } = await adminDb
            .from('user_badges')
            .upsert(chunk, { onConflict: 'user_id, badge_id', ignoreDuplicates: true })

        if (insertError) {
            console.error(`Error awarding badge chunk ${i}:`, insertError)
            return { success: false, error: `Partial failure at chunk ${i}: ${insertError.message}` }
        }
    }

    return { success: true }
}

// ============================================
// Featured Schedule Management Functions
// ============================================

export interface FeaturedSchedule {
    id: string
    cafe_id: string
    start_date: string
    end_date: string
    slot_type: 'hero' | 'sidebar' | 'collection' | 'regional_spotlight'
    region_context: string | null
    is_active: boolean | null
    priority: number | null
    custom_title: string | null
    custom_description: string | null
    custom_image: string | null
    created_at: string | null
    cafe: {
        id: string
        name: string
        slug: string
        thumbnail: string
        city_municipality: string
        region: string
    } | null
}

/**
 * Get all featured schedules with cafe info
 */
export async function getFeaturedSchedules(): Promise<FeaturedSchedule[]> {
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

    const { data: schedules, error } = await db
        .from('featured_schedules')
        .select(`
            *,
            cafe:cafes(
                id,
                name,
                slug,
                thumbnail,
                city_municipality,
                region
            )
        `)
        .order('start_date', { ascending: true })

    if (error) {
        console.error("Error fetching featured schedules:", error)
        return []
    }

    return schedules as unknown as FeaturedSchedule[]
}

/**
 * Check for conflicting featured schedules
 * Returns true if a conflict exists (same region_context and overlapping dates)
 */
export async function checkFeaturedConflict(
    startDate: string,
    endDate: string,
    regionContext: string | null,
    excludeId?: string
): Promise<{ hasConflict: boolean; conflictingCafe?: string }> {
    const db = await createClient()

    // Verify admin access
    const { data: { user } } = await db.auth.getUser()
    if (!user) return { hasConflict: false }

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        return { hasConflict: false }
    }

    // Check for overlapping schedules with same region_context
    // Date overlap: (start1 <= end2) AND (end1 >= start2)
    let query = db
        .from('featured_schedules')
        .select(`
            id,
            cafe:cafes(name)
        `)
        .eq('slot_type', 'hero')
        .eq('is_active', true)
        .lte('start_date', endDate)
        .gte('end_date', startDate)

    // Match region context (null matches null for global)
    if (regionContext) {
        query = query.eq('region_context', regionContext)
    } else {
        query = query.is('region_context', null)
    }

    // Exclude current schedule if editing
    if (excludeId) {
        query = query.neq('id', excludeId)
    }

    const { data: conflicts, error } = await query.limit(1)

    if (error) {
        console.error("Error checking featured conflict:", error)
        return { hasConflict: false }
    }

    if (conflicts && conflicts.length > 0) {
        const cafeName = (conflicts[0] as any).cafe?.name || 'Another cafe'
        return { hasConflict: true, conflictingCafe: cafeName }
    }

    return { hasConflict: false }
}

/**
 * Create a new featured schedule
 */
export async function createFeaturedSchedule(schedule: {
    cafe_id: string
    start_date: string
    end_date: string
    region_context: string | null
    priority?: number
    custom_title?: string
    custom_description?: string
}): Promise<AdminActionResult & { schedule?: FeaturedSchedule }> {
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

    // Check for conflicts
    const conflict = await checkFeaturedConflict(
        schedule.start_date,
        schedule.end_date,
        schedule.region_context
    )

    if (conflict.hasConflict) {
        return {
            success: false,
            error: `Conflict: ${conflict.conflictingCafe} is already featured for this region during the selected dates`
        }
    }

    const { data: newSchedule, error } = await db
        .from('featured_schedules')
        .insert({
            cafe_id: schedule.cafe_id,
            start_date: schedule.start_date,
            end_date: schedule.end_date,
            region_context: schedule.region_context,
            slot_type: 'hero',
            is_active: true,
            priority: schedule.priority ?? 1,
            custom_title: schedule.custom_title ?? null,
            custom_description: schedule.custom_description ?? null
        })
        .select(`
            *,
            cafe:cafes(
                id,
                name,
                slug,
                thumbnail,
                city_municipality,
                region
            )
        `)
        .single()

    if (error) {
        console.error("Error creating featured schedule:", error)
        return { success: false, error: "Failed to create featured schedule" }
    }

    return { success: true, schedule: newSchedule as unknown as FeaturedSchedule }
}

/**
 * Update an existing featured schedule
 */
export async function updateFeaturedSchedule(
    scheduleId: string,
    updates: Partial<{
        cafe_id: string
        start_date: string
        end_date: string
        region_context: string | null
        is_active: boolean
        priority: number
        custom_title: string | null
        custom_description: string | null
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

    // If dates or region are being updated, check for conflicts
    if (updates.start_date || updates.end_date || updates.region_context !== undefined) {
        // Get current schedule for fallback values
        const { data: current } = await db
            .from('featured_schedules')
            .select('start_date, end_date, region_context')
            .eq('id', scheduleId)
            .single()

        if (current) {
            const conflict = await checkFeaturedConflict(
                updates.start_date ?? current.start_date,
                updates.end_date ?? current.end_date,
                updates.region_context !== undefined ? updates.region_context : current.region_context,
                scheduleId
            )

            if (conflict.hasConflict) {
                return {
                    success: false,
                    error: `Conflict: ${conflict.conflictingCafe} is already featured for this region during the selected dates`
                }
            }
        }
    }

    const { error } = await db
        .from('featured_schedules')
        .update(updates as Record<string, unknown>)
        .eq('id', scheduleId)

    if (error) {
        console.error("Error updating featured schedule:", error)
        return { success: false, error: "Failed to update featured schedule" }
    }

    return { success: true }
}

/**
 * Delete a featured schedule
 */
export async function deleteFeaturedSchedule(scheduleId: string): Promise<AdminActionResult> {
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
        .from('featured_schedules')
        .delete()
        .eq('id', scheduleId)

    if (error) {
        console.error("Error deleting featured schedule:", error)
        return { success: false, error: "Failed to delete featured schedule" }
    }

    return { success: true }
}

/**
 * Search published cafes for featured selection
 */
export async function searchCafesForFeatured(query: string): Promise<{
    id: string
    name: string
    slug: string
    thumbnail: string
    city_municipality: string
    region: string
}[]> {
    if (!query || query.length < 2) return []

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
        .select('id, name, slug, thumbnail, city_municipality, region')
        .eq('is_published', true)
        .neq('thumbnail', 'placeholder') // Exclude cafes without photos from featured selection
        .ilike('name', `%${query}%`)
        .order('name')
        .limit(10)

    if (error) {
        console.error("Error searching cafes for featured:", error)
        return []
    }

    return cafes || []
}

// ============================================
// Owner Verification Management Functions
// ============================================

export interface OwnerVerificationForAdmin {
    id: string
    cafe_id: string
    user_id: string
    verification_type: 'document' | 'email' | 'social_proof'
    proof_urls: string[]
    notes: string | null
    status: 'pending' | 'approved' | 'rejected'
    admin_notes: string | null
    created_at: string | null
    cafe: {
        id: string
        name: string
        slug: string
        thumbnail: string
        email: string | null
    } | null
    user: {
        id: string
        username: string
        display_name: string
        avatar_url: string | null
    } | null
}

/**
 * Get all pending owner verification requests
 */
export async function getPendingVerifications(): Promise<OwnerVerificationForAdmin[]> {
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

    const { data: requests, error } = await db
        .from('owner_verification_requests')
        .select(`
            *,
            cafe:cafes(id, name, slug, thumbnail, email),
            user:profiles!owner_verification_requests_user_id_fkey(id, username, display_name, avatar_url)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })

    if (error) {
        console.error("Error fetching pending verifications:", error)
        return []
    }

    return requests as unknown as OwnerVerificationForAdmin[]
}

/**
 * Get all verification requests (for history view)
 */
export async function getAllVerifications(status?: 'pending' | 'approved' | 'rejected'): Promise<OwnerVerificationForAdmin[]> {
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

    let query = db
        .from('owner_verification_requests')
        .select(`
            *,
            cafe:cafes(id, name, slug, thumbnail, email),
            user:profiles!owner_verification_requests_user_id_fkey(id, username, display_name, avatar_url)
        `)
        .order('created_at', { ascending: false })

    if (status) {
        query = query.eq('status', status)
    }

    const { data: requests, error } = await query.limit(100)

    if (error) {
        console.error("Error fetching verifications:", error)
        return []
    }

    return requests as unknown as OwnerVerificationForAdmin[]
}

/**
 * Approve an owner verification request
 * This adds the user to the cafe's owner_ids and sets is_claimed = true
 */
export async function approveVerification(requestId: string): Promise<AdminActionResult> {
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

    const adminDb = await createAdminClient()

    // Get the verification request
    const { data: request, error: reqError } = await adminDb
        .from('owner_verification_requests')
        .select('cafe_id, user_id, status')
        .eq('id', requestId)
        .single()

    if (reqError || !request) {
        return { success: false, error: "Verification request not found" }
    }

    if (request.status !== 'pending') {
        return { success: false, error: "Request has already been processed" }
    }

    // Get current cafe owner_ids
    const { data: cafe } = await adminDb
        .from('cafes')
        .select('owner_ids')
        .eq('id', request.cafe_id)
        .single()

    const currentOwners = cafe?.owner_ids || []
    const newOwners = currentOwners.includes(request.user_id)
        ? currentOwners
        : [...currentOwners, request.user_id]

    // Update cafe with new owner
    const { error: cafeError } = await adminDb
        .from('cafes')
        .update({
            owner_ids: newOwners,
            is_claimed: true,
            updated_at: new Date().toISOString(),
        })
        .eq('id', request.cafe_id)

    if (cafeError) {
        console.error("Error updating cafe owners:", cafeError)
        return { success: false, error: "Failed to update cafe ownership" }
    }

    // Update verification request status
    const { error: updateError } = await adminDb
        .from('owner_verification_requests')
        .update({
            status: 'approved',
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId)

    if (updateError) {
        console.error("Error updating verification status:", updateError)
        return { success: false, error: "Failed to update verification status" }
    }

    // Create a free subscription for the cafe if one doesn't exist
    const { data: existingSub } = await adminDb
        .from('cafe_subscriptions')
        .select('id')
        .eq('cafe_id', request.cafe_id)
        .single()

    if (!existingSub) {
        await adminDb
            .from('cafe_subscriptions')
            .insert({
                cafe_id: request.cafe_id,
                tier: 'free',
                status: 'active',
            })
    }

    return { success: true }
}

/**
 * Reject an owner verification request
 */
export async function rejectVerification(
    requestId: string,
    reason: string
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

    const adminDb = await createAdminClient()

    // Verify request exists and is pending
    const { data: request } = await adminDb
        .from('owner_verification_requests')
        .select('status')
        .eq('id', requestId)
        .single()

    if (!request) {
        return { success: false, error: "Verification request not found" }
    }

    if (request.status !== 'pending') {
        return { success: false, error: "Request has already been processed" }
    }

    // Update verification request status
    const { error } = await adminDb
        .from('owner_verification_requests')
        .update({
            status: 'rejected',
            admin_notes: reason,
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId)

    if (error) {
        console.error("Error rejecting verification:", error)
        return { success: false, error: "Failed to reject verification" }
    }

    // TODO: Send email notification to user about rejection

    return { success: true }
}

/**
 * Send verification email to cafe's listed email
 * Used for semi-automated verification when cafe has an email
 */
export async function sendVerificationEmail(
    requestId: string
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

    // Get request with cafe email
    const { data: request, error: reqError } = await db
        .from('owner_verification_requests')
        .select(`
            id,
            cafe:cafes(id, name, email),
            user:profiles!owner_verification_requests_user_id_fkey(display_name)
        `)
        .eq('id', requestId)
        .single()

    if (reqError || !request) {
        return { success: false, error: "Verification request not found" }
    }

    const cafeEmail = (request.cafe as any)?.email
    if (!cafeEmail) {
        return { success: false, error: "Cafe does not have an email address" }
    }

    // TODO: Implement email sending with verification link
    // The email should contain a unique token that, when clicked,
    // confirms the cafe owner has access to the cafe's email

    console.log(`Would send verification email to ${cafeEmail} for request ${requestId}`)

    return { success: true }
}

// ============================================
// User Role Management (Admin Only)
// ============================================

type UserRole = Database['public']['Enums']['user_role']

export interface TeamMember {
    id: string
    username: string
    display_name: string
    avatar_url: string | null
    role: UserRole | null
    created_at: string | null
}

/**
 * Search users by username or display name for role assignment
 * Admin only - only full admins can change roles
 */
export async function searchUsersForRoleAssignment(
    query: string,
    limit: number = 10
): Promise<TeamMember[]> {
    const db = await createClient()

    // Verify admin access (only full admin can manage roles)
    const { data: { user } } = await db.auth.getUser()
    if (!user) return []

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        return []
    }

    if (!query || query.length < 2) {
        return []
    }

    const searchTerm = `%${query.trim()}%`

    const { data: users, error } = await db
        .from('profiles')
        .select('id, username, display_name, avatar_url, role, created_at')
        .or(`username.ilike.${searchTerm},display_name.ilike.${searchTerm}`)
        .limit(limit)

    if (error) {
        console.error("Error searching users:", error)
        return []
    }

    return users as TeamMember[]
}

/**
 * Update a user's role
 * Admin only - only full admins can change roles, and cannot change their own role
 */
export async function updateUserRole(
    targetUserId: string,
    newRole: UserRole
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

    // Only full admin can change roles
    if (profile?.role !== 'admin') {
        return { success: false, error: "Only admins can change user roles" }
    }

    // Prevent changing own role
    if (targetUserId === user.id) {
        return { success: false, error: "You cannot change your own role" }
    }

    // Use admin client to bypass RLS
    const adminDb = await createAdminClient()

    const { error } = await adminDb
        .from('profiles')
        .update({ role: newRole })
        .eq('id', targetUserId)

    if (error) {
        console.error("Error updating user role:", error)
        return { success: false, error: "Failed to update user role" }
    }

    return { success: true }
}

/**
 * Get all admins and moderators
 * Admin only
 */
export async function getAdminsAndModerators(): Promise<TeamMember[]> {
    const db = await createClient()

    // Verify admin access
    const { data: { user } } = await db.auth.getUser()
    if (!user) return []

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        return []
    }

    const { data: users, error } = await db
        .from('profiles')
        .select('id, username, display_name, avatar_url, role, created_at')
        .in('role', ['admin', 'moderator'])
        .order('role', { ascending: true })
        .order('created_at', { ascending: true })

    if (error) {
        console.error("Error fetching admins and moderators:", error)
        return []
    }

    return users as TeamMember[]
}

// ============================================
// Featured Slot Requests (Admin)
// ============================================

/**
 * Get all featured slot requests (optionally filtered by status)
 */
export async function adminGetFeaturedRequests(status?: 'pending' | 'approved' | 'rejected') {
    const isAdminUser = await isAdmin()
    if (!isAdminUser) return []

    const db = await createClient()

    let query = db
        .from('featured_slot_requests')
        .select(`
            *,
            cafe:cafes(id, name, slug, thumbnail, city_municipality, region),
            owner:profiles!featured_slot_requests_owner_id_fkey(id, username, display_name, email)
        `)
        .order('created_at', { ascending: false })

    if (status) {
        query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
        console.error('Error fetching featured requests:', error)
        return []
    }

    return data
}

/**
 * Update featured slot request status
 */
export async function adminUpdateFeaturedRequestStatus(
    requestId: string,
    status: 'approved' | 'rejected',
    adminNotes?: string
): Promise<AdminActionResult> {
    const isAdminUser = await isAdmin()
    if (!isAdminUser) {
        return { success: false, error: 'Not authorized' }
    }

    const db = await createClient()

    const updates: any = {
        status,
        processed_at: new Date().toISOString(),
    }

    if (adminNotes !== undefined) {
        updates.admin_notes = adminNotes
    }

    const { error } = await db
        .from('featured_slot_requests')
        .update(updates)
        .eq('id', requestId)

    if (error) {
        console.error('Error updating featured request:', error)
        return { success: false, error: 'Failed to update request' }
    }

    return { success: true }
}
