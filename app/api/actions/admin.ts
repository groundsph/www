/* eslint-disable @typescript-eslint/no-explicit-any -- Drizzle relational queries return complex nested types that require any for flattening */
'use server'

import { db } from "@/db"
import {
    cafes,
    cafeRatingStats,
    cafeClaims,
    contributionLogs,
    profiles,
    user,
} from "@/db/schema"
import { eq, and, or, desc, asc, sql, ilike, count as drizzleCount } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
import { deleteCafeImagesAction, deleteSingleCafeImageAction, cleanupOrphanedImages, processAvatarDeletionQueue } from "@/utils/storage/actions"
import { sendCafeApprovedEmail, sendCafeRejectedEmail, sendSubscriptionApprovedEmail, sendSubscriptionRejectedEmail } from "@/utils/email"
import { CafeWithRatings, ProfileStats } from "@/utils/types/extra"
import { checkAndAwardBadges } from "@/utils/badges/badge-logic"
import { logContribution, getChangedFields, generateChangeSummary } from "@/utils/contribution-logging"

type ScoutRank = 'novice' | 'expert' | 'vanguard'

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

    try {
        // Count total published cafes for this contributor
        const countResult = await db
            .select({ count: drizzleCount() })
            .from(cafes)
            .where(and(
                eq(cafes.contributorId, contributorId),
                eq(cafes.isPublished, true)
            ))

        const totalScouted = countResult[0]?.count ?? 0
        const newRank = calculateScoutRank(totalScouted)

        // Get current profile stats
        const profileResult = await db
            .select({ stats: profiles.stats })
            .from(profiles)
            .where(eq(profiles.id, contributorId))
            .limit(1)

        const profile = profileResult[0]
        if (!profile) {
            console.error("Error fetching contributor profile: not found")
            return
        }

        // Merge with existing stats
        const currentStats = (profile.stats as ProfileStats | null) ?? {
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
        await db.update(profiles)
            .set({ stats: updatedStats })
            .where(eq(profiles.id, contributorId))
    } catch (error) {
        console.error("Error updating contributor stats:", error)
    }
}

/**
 * Check if the current user has admin or moderator role
 */
export async function isAdmin(): Promise<boolean> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return false

    const result = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    const role = result[0]?.role
    return role === 'admin' || role === 'moderator'
}

/**
 * Get the current user's role
 * Returns 'admin', 'moderator', 'writer', 'user', or null if not authenticated
 */
export async function getUserRole(): Promise<'admin' | 'moderator' | 'writer' | 'user' | null> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return null

    const result = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    return (result[0]?.role as 'admin' | 'moderator' | 'writer' | 'user') ?? 'user'
}

/**
 * Helper to map cafe from Drizzle to CafeWithRatings type
 */
function mapCafeToCafeWithRatings(cafe: any, contributor?: any, ratings?: any): CafeWithRatings {
    return {
        id: cafe.id,
        name: cafe.name,
        slug: cafe.slug,
        description: cafe.description,
        thumbnail: cafe.thumbnail,
        gallery: cafe.gallery,
        address_display: cafe.addressDisplay,
        area: cafe.area,
        city_municipality: cafe.cityMunicipality,
        province: cafe.province,
        region: cafe.region,
        lat: cafe.lat,
        lng: cafe.lng,
        price_level: cafe.priceLevel,
        coffee_style: cafe.coffeeStyle,
        membership_tier: cafe.membershipTier,
        roaster: cafe.roaster,
        brew_methods: cafe.brewMethods,
        specialty: cafe.specialty,
        milk_options: cafe.milkOptions,
        tags: cafe.tags,
        operating_hours: cafe.operatingHours as CafeWithRatings['operating_hours'],
        socials: cafe.socials as CafeWithRatings['socials'],
        phone: cafe.phone,
        email: cafe.email,
        website_url: cafe.websiteUrl,
        payment_methods: cafe.paymentMethods,
        has_wifi: cafe.hasWifi,
        has_sockets: cafe.hasSockets,
        has_aircon: cafe.hasAircon,
        has_parking: cafe.hasParking,
        has_outdoor_seating: cafe.hasOutdoorSeating,
        has_indoor_seating: cafe.hasIndoorSeating,
        has_restroom: cafe.hasRestroom,
        has_bidet: cafe.hasBidet,
        has_non_dairy: cafe.hasNonDairy,
        has_decaf: cafe.hasDecaf,
        is_pet_friendly: cafe.isPetFriendly,
        is_work_friendly: cafe.isWorkFriendly,
        serves_food: cafe.servesFood,
        is_active: cafe.isActive,
        is_published: cafe.isPublished,
        is_verified: cafe.isVerified,
        is_claimed: cafe.isClaimed,
        owner_ids: cafe.ownerIds,
        contributor_id: cafe.contributorId,
        featured_until: cafe.featuredUntil?.toISOString() ?? null,
        created_at: cafe.createdAt?.toISOString() ?? null,
        updated_at: cafe.updatedAt?.toISOString() ?? null,
        average_rating: ratings?.averageRating ?? null,
        total_reviews: ratings?.totalReviews ?? 0,
        rating_distribution: ratings?.ratingDistribution ?? null,
        contributor: contributor ? {
            id: contributor.id,
            username: contributor.username,
            display_name: contributor.displayName,
            avatar_url: contributor.avatarUrl,
        } : undefined,
    }
}

/**
 * Get all pending (unpublished) cafe submissions
 * Only accessible by admins/moderators
 */
export async function getPendingCafes(): Promise<CafeWithRatings[]> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return []

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return []
    }

    // Fetch pending cafes
    const cafesResult = await db
        .select()
        .from(cafes)
        .where(eq(cafes.isPublished, false))
        .orderBy(desc(cafes.createdAt))

    if (!cafesResult.length) return []

    // Get contributor info for these cafes
    const contributorIds = [...new Set(cafesResult.map(c => c.contributorId).filter(Boolean))] as string[]

    const contributorsResult = contributorIds.length > 0
        ? await db
            .select({
                id: profiles.id,
                username: profiles.username,
                displayName: profiles.displayName,
                avatarUrl: profiles.avatarUrl,
            })
            .from(profiles)
            .where(inArray(profiles.id, contributorIds))
        : []

    const contributorMap = new Map(contributorsResult.map(c => [c.id, c]))

    return cafesResult.map(cafe =>
        mapCafeToCafeWithRatings(cafe, contributorMap.get(cafe.contributorId || ''))
    )
}

export interface AdminActionResult {
    success: boolean
    error?: string
}

/**
 * Approve a cafe submission (set is_published = true)
 */
export async function approveCafe(cafeId: string): Promise<AdminActionResult> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    // Get cafe info before updating
    const cafeResult = await db
        .select({
            name: cafes.name,
            slug: cafes.slug,
            contributorId: cafes.contributorId,
        })
        .from(cafes)
        .where(eq(cafes.id, cafeId))
        .limit(1)

    const cafe = cafeResult[0]
    if (!cafe) {
        return { success: false, error: "Cafe not found" }
    }

    try {
        await db.update(cafes)
            .set({ isPublished: true })
            .where(eq(cafes.id, cafeId))
    } catch (error) {
        console.error("Error approving cafe:", error)
        return { success: false, error: "Failed to approve cafe" }
    }

    // Auto-approve any pending ownership claim from the contributor
    if (cafe.contributorId) {
        const pendingClaimResult = await db
            .select({ id: cafeClaims.id })
            .from(cafeClaims)
            .where(and(
                eq(cafeClaims.cafeId, cafeId),
                eq(cafeClaims.userId, cafe.contributorId),
                eq(cafeClaims.status, 'pending')
            ))
            .limit(1)

        const pendingClaim = pendingClaimResult[0]
        if (pendingClaim) {
            // Approve the claim
            await db.update(cafeClaims)
                .set({
                    status: 'approved',
                    reviewedAt: new Date(),
                    reviewedBy: currentUser.id,
                    adminNotes: 'Auto-approved with cafe approval',
                })
                .where(eq(cafeClaims.id, pendingClaim.id))

            // Update cafe ownership
            await db.update(cafes)
                .set({
                    isClaimed: true,
                    ownerIds: [cafe.contributorId],
                })
                .where(eq(cafes.id, cafeId))

            console.log(`[approveCafe] Auto-approved ownership claim for cafe ${cafeId}`)
        }
    }

    // Update contributor's scout stats and send notification email
    if (cafe.contributorId) {
        await updateContributorScoutStats(cafe.contributorId)

        // Check and award any earned scout badges
        await checkAndAwardBadges(cafe.contributorId, {
            scout: true,
            geographic: false
        })

        // Get contributor's email from Better Auth user table
        try {
            const userResult = await db
                .select({ email: user.email })
                .from(user)
                .where(eq(user.id, cafe.contributorId))
                .limit(1)

            const contributorProfileResult = await db
                .select({ displayName: profiles.displayName })
                .from(profiles)
                .where(eq(profiles.id, cafe.contributorId))
                .limit(1)

            const userEmail = userResult[0]?.email
            if (userEmail && cafe.name && cafe.slug) {
                await sendCafeApprovedEmail(
                    userEmail,
                    cafe.name,
                    cafe.slug,
                    contributorProfileResult[0]?.displayName || undefined
                )
            }
        } catch (emailError) {
            console.error("Error sending cafe approval email:", emailError)
        }
    }

    return { success: true }
}

/**
 * Reject a cafe submission (delete it and its images)
 */
export async function rejectCafe(cafeId: string, reason?: string): Promise<AdminActionResult> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    // Fetch cafe to get image URLs, name, and contributor info before deletion
    const cafeResult = await db
        .select({
            name: cafes.name,
            thumbnail: cafes.thumbnail,
            gallery: cafes.gallery,
            contributorId: cafes.contributorId,
            isPublished: cafes.isPublished,
        })
        .from(cafes)
        .where(eq(cafes.id, cafeId))
        .limit(1)

    const cafe = cafeResult[0]

    // Store cafe info for email before deletion
    const cafeName = cafe?.name
    const contributorId = cafe?.contributorId
    const wasPublished = cafe?.isPublished

    // Delete images from storage
    if (cafe) {
        await deleteCafeImagesAction(cafe.thumbnail, cafe.gallery)
    }

    // Delete related cafe_claims first (foreign key constraint)
    try {
        await db.delete(cafeClaims)
            .where(eq(cafeClaims.cafeId, cafeId))
    } catch (error) {
        console.error("Error deleting cafe claims:", error)
    }

    // Delete related contribution_logs (foreign key constraint)
    try {
        await db.delete(contributionLogs)
            .where(eq(contributionLogs.cafeId, cafeId))
    } catch (error) {
        console.error("Error deleting contribution logs:", error)
    }

    // Delete the cafe record
    try {
        await db.delete(cafes)
            .where(eq(cafes.id, cafeId))
    } catch (error) {
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
            const userResult = await db
                .select({ email: user.email })
                .from(user)
                .where(eq(user.id, contributorId))
                .limit(1)

            const contributorProfileResult = await db
                .select({ displayName: profiles.displayName })
                .from(profiles)
                .where(eq(profiles.id, contributorId))
                .limit(1)

            const userEmail = userResult[0]?.email
            if (userEmail) {
                await sendCafeRejectedEmail(
                    userEmail,
                    cafeName,
                    contributorProfileResult[0]?.displayName || undefined,
                    reason
                )
            }
        } catch (emailError) {
            console.error("Error sending cafe rejection email:", emailError)
        }
    }

    return { success: true }
}

/**
 * Get a single cafe by ID (for admin preview/edit)
 */
export async function getCafeById(cafeId: string): Promise<CafeWithRatings | null> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return null

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return null
    }

    const cafeResult = await db
        .select()
        .from(cafes)
        .where(eq(cafes.id, cafeId))
        .limit(1)

    const cafe = cafeResult[0]
    if (!cafe) return null

    // Get contributor info if exists
    let contributor = null
    if (cafe.contributorId) {
        const contributorResult = await db
            .select({
                id: profiles.id,
                username: profiles.username,
                displayName: profiles.displayName,
                avatarUrl: profiles.avatarUrl,
            })
            .from(profiles)
            .where(eq(profiles.id, cafe.contributorId))
            .limit(1)
        contributor = contributorResult[0]
    }

    // Get rating stats
    const ratingsResult = await db
        .select()
        .from(cafeRatingStats)
        .where(eq(cafeRatingStats.cafeId, cafeId))
        .limit(1)

    return mapCafeToCafeWithRatings(cafe, contributor, ratingsResult[0])
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
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    // Fetch current cafe data for change detection
    const currentCafeResult = await db
        .select({ name: cafes.name })
        .from(cafes)
        .where(eq(cafes.id, cafeId))
        .limit(1)

    const currentCafe = currentCafeResult[0]

    // Map snake_case updates to camelCase for Drizzle
    const fieldMap: Record<string, string> = {
        address_display: 'addressDisplay',
        has_wifi: 'hasWifi',
        has_sockets: 'hasSockets',
        has_parking: 'hasParking',
        has_aircon: 'hasAircon',
        is_pet_friendly: 'isPetFriendly',
        has_outdoor_seating: 'hasOutdoorSeating',
        has_indoor_seating: 'hasIndoorSeating',
        has_restroom: 'hasRestroom',
        has_bidet: 'hasBidet',
        has_non_dairy: 'hasNonDairy',
        milk_options: 'milkOptions',
        serves_food: 'servesFood',
        is_work_friendly: 'isWorkFriendly',
        price_level: 'priceLevel',
        payment_methods: 'paymentMethods',
        brew_methods: 'brewMethods',
        operating_hours: 'operatingHours',
        website_url: 'websiteUrl',
        is_verified: 'isVerified',
        owner_ids: 'ownerIds',
    }

    const drizzleUpdates: Record<string, unknown> = { updatedAt: new Date() }
    for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
            const drizzleKey = fieldMap[key] || key
            drizzleUpdates[drizzleKey] = value
        }
    }

    try {
        await db.update(cafes)
            .set(drizzleUpdates)
            .where(eq(cafes.id, cafeId))
    } catch (error) {
        console.error("Error updating cafe:", error)
        return { success: false, error: "Failed to update cafe" }
    }

    // Log contribution
    const changedFields = currentCafe ? getChangedFields(currentCafe as Record<string, unknown>, updates as Record<string, unknown>) : Object.keys(updates)
    const summary = generateChangeSummary(changedFields)

    await logContribution(currentUser.id, cafeId, 'UPDATE', {
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
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    // Use the storage action to delete the image
    return deleteSingleCafeImageAction(imageUrl)
}

/**
 * Get all published cafes (for admin management)
 */
export async function getPublishedCafes(): Promise<CafeWithRatings[]> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return []

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return []
    }

    const cafesResult = await db
        .select()
        .from(cafes)
        .where(eq(cafes.isPublished, true))
        .orderBy(asc(cafes.name))

    if (!cafesResult.length) return []

    // Get contributor info
    const contributorIds = [...new Set(cafesResult.map(c => c.contributorId).filter(Boolean))] as string[]

    const contributorsResult = contributorIds.length > 0
        ? await db
            .select({
                id: profiles.id,
                username: profiles.username,
                displayName: profiles.displayName,
                avatarUrl: profiles.avatarUrl,
            })
            .from(profiles)
            .where(inArray(profiles.id, contributorIds))
        : []

    const contributorMap = new Map(contributorsResult.map(c => [c.id, c]))

    return cafesResult.map(cafe =>
        mapCafeToCafeWithRatings(cafe, contributorMap.get(cafe.contributorId || ''))
    )
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

    const currentUser = await getCurrentUser()
    if (!currentUser) return { cafes: [], total: 0, page, pageSize, hasMore: false }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return { cafes: [], total: 0, page, pageSize, hasMore: false }
    }

    // Build conditions array
    const conditions = [eq(cafes.isPublished, isPublished)]

    if (province) {
        conditions.push(eq(cafes.province, province))
    }

    if (city) {
        conditions.push(eq(cafes.cityMunicipality, city))
    }

    if (search && search.trim()) {
        const searchTerm = `%${search.trim()}%`
        conditions.push(or(
            ilike(cafes.name, searchTerm),
            ilike(cafes.addressDisplay, searchTerm),
            ilike(cafes.cityMunicipality, searchTerm),
            ilike(cafes.province, searchTerm)
        )!)
    }

    const whereClause = and(...conditions)

    // Get total count
    const countResult = await db
        .select({ count: drizzleCount() })
        .from(cafes)
        .where(whereClause)

    const total = countResult[0]?.count ?? 0

    // Determine sort order
    const sortFn = sortOrder === 'asc' ? asc : desc
    let orderByColumn
    switch (sortBy) {
        case 'name':
            orderByColumn = cafes.name
            break
        case 'date':
            orderByColumn = cafes.createdAt
            break
        case 'city':
            orderByColumn = cafes.cityMunicipality
            break
        case 'province':
            orderByColumn = cafes.province
            break
        default:
            orderByColumn = cafes.name
    }

    // For date, we want newest first by default (reverse the sort)
    const effectiveSortFn = sortBy === 'date'
        ? (sortOrder === 'asc' ? desc : asc)
        : sortFn

    // Get paginated results
    const offset = (page - 1) * pageSize
    const cafesResult = await db
        .select()
        .from(cafes)
        .where(whereClause)
        .orderBy(effectiveSortFn(orderByColumn))
        .limit(pageSize)
        .offset(offset)

    if (!cafesResult.length) {
        return { cafes: [], total, page, pageSize, hasMore: false }
    }

    // Get contributor info
    const contributorIds = [...new Set(cafesResult.map(c => c.contributorId).filter(Boolean))] as string[]

    const contributorsResult = contributorIds.length > 0
        ? await db
            .select({
                id: profiles.id,
                username: profiles.username,
                displayName: profiles.displayName,
                avatarUrl: profiles.avatarUrl,
            })
            .from(profiles)
            .where(inArray(profiles.id, contributorIds))
        : []

    const contributorMap = new Map(contributorsResult.map(c => [c.id, c]))

    const mappedCafes = cafesResult.map(cafe =>
        mapCafeToCafeWithRatings(cafe, contributorMap.get(cafe.contributorId || ''))
    )

    const hasMore = offset + pageSize < total

    return {
        cafes: mappedCafes,
        total,
        page,
        pageSize,
        hasMore
    }
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
    const currentUser = await getCurrentUser()
    if (!currentUser) return { provinces: [], cities: [], totalPublished: 0, totalPending: 0 }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return { provinces: [], cities: [], totalPublished: 0, totalPending: 0 }
    }

    // Get all unique provinces
    const provincesResult = await db
        .selectDistinct({ province: cafes.province })
        .from(cafes)
        .orderBy(asc(cafes.province))

    const provinces = provincesResult.map(p => p.province).filter(Boolean) as string[]

    // Get cities grouped by province
    const citiesResult = await db
        .selectDistinct({
            province: cafes.province,
            city: cafes.cityMunicipality,
        })
        .from(cafes)
        .orderBy(asc(cafes.province), asc(cafes.cityMunicipality))

    const citiesMap = new Map<string, string[]>()
    for (const row of citiesResult) {
        if (row.province && row.city) {
            if (!citiesMap.has(row.province)) {
                citiesMap.set(row.province, [])
            }
            citiesMap.get(row.province)!.push(row.city)
        }
    }

    const cities = Array.from(citiesMap.entries()).map(([province, cityList]) => ({
        province,
        cities: cityList,
    }))

    // Get counts
    const publishedCountResult = await db
        .select({ count: drizzleCount() })
        .from(cafes)
        .where(eq(cafes.isPublished, true))

    const pendingCountResult = await db
        .select({ count: drizzleCount() })
        .from(cafes)
        .where(eq(cafes.isPublished, false))

    return {
        provinces,
        cities,
        totalPublished: publishedCountResult[0]?.count ?? 0,
        totalPending: pendingCountResult[0]?.count ?? 0,
    }
}

// ============================================
// Manual Payments / Subscriptions
// ============================================

import { cafeSubscriptions, cafeStories } from "@/db/schema"

/**
 * Get all manual subscriptions (pending and verified)
 */
export async function getManualSubscriptions(): Promise<any[]> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return []

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return []
    }

    // Fetch subscriptions with cafe details
    const subscriptionsResult = await db
        .select({
            id: cafeSubscriptions.id,
            cafeId: cafeSubscriptions.cafeId,
            tier: cafeSubscriptions.tier,
            status: cafeSubscriptions.status,
            helixSubscriptionId: cafeSubscriptions.helixSubscriptionId,
            currentPeriodStart: cafeSubscriptions.currentPeriodStart,
            currentPeriodEnd: cafeSubscriptions.currentPeriodEnd,
            isManualPayment: cafeSubscriptions.isManualPayment,
            paymentVerified: cafeSubscriptions.paymentVerified,
            proofOfPaymentUrl: cafeSubscriptions.proofOfPaymentUrl,
            createdAt: cafeSubscriptions.createdAt,
            updatedAt: cafeSubscriptions.updatedAt,
            cafeName: cafes.name,
            cafeSlug: cafes.slug,
        })
        .from(cafeSubscriptions)
        .leftJoin(cafes, eq(cafeSubscriptions.cafeId, cafes.id))
        .where(eq(cafeSubscriptions.isManualPayment, true))
        .orderBy(desc(cafeSubscriptions.createdAt))

    return subscriptionsResult.map(sub => ({
        id: sub.id,
        cafe_id: sub.cafeId,
        tier: sub.tier,
        status: sub.status,
        helix_subscription_id: sub.helixSubscriptionId,
        current_period_start: sub.currentPeriodStart?.toISOString() ?? null,
        current_period_end: sub.currentPeriodEnd?.toISOString() ?? null,
        is_manual_payment: sub.isManualPayment,
        payment_verified: sub.paymentVerified,
        proof_of_payment_url: sub.proofOfPaymentUrl,
        created_at: sub.createdAt?.toISOString() ?? null,
        updated_at: sub.updatedAt?.toISOString() ?? null,
        cafes: sub.cafeName ? {
            id: sub.cafeId,
            name: sub.cafeName,
            slug: sub.cafeSlug,
        } : null,
    }))
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
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    // 1. Get subscription with proof and cafe info
    const subResult = await db
        .select({
            tier: cafeSubscriptions.tier,
            proofOfPaymentUrl: cafeSubscriptions.proofOfPaymentUrl,
            createdAt: cafeSubscriptions.createdAt,
            cafeName: cafes.name,
            cafeSlug: cafes.slug,
            ownerIds: cafes.ownerIds,
        })
        .from(cafeSubscriptions)
        .leftJoin(cafes, eq(cafeSubscriptions.cafeId, cafes.id))
        .where(and(
            eq(cafeSubscriptions.id, subscriptionId),
            eq(cafeSubscriptions.cafeId, cafeId)
        ))
        .limit(1)

    const sub = subResult[0]
    if (!sub) {
        return { success: false, error: "Subscription not found" }
    }

    // 2. Update subscription status
    try {
        await db.update(cafeSubscriptions)
            .set({
                paymentVerified: true,
                status: 'active',
                proofOfPaymentUrl: null,
                updatedAt: new Date(),
            })
            .where(and(
                eq(cafeSubscriptions.id, subscriptionId),
                eq(cafeSubscriptions.cafeId, cafeId)
            ))
    } catch (error) {
        console.error("Error verifying subscription:", error)
        return { success: false, error: "Failed to verify subscription" }
    }

    // 3. Update cafe tier and verification status
    await db.update(cafes)
        .set({
            membershipTier: sub.tier,
            isVerified: true,
            updatedAt: new Date(),
        })
        .where(eq(cafes.id, cafeId))

    // 4. Prepare proof info for client download
    let proofInfo: { url: string; filename: string } | undefined
    const cafeName = sub.cafeName || 'cafe'
    const cafeSlug = sub.cafeSlug || ''
    if (sub.proofOfPaymentUrl) {
        const uploadDate = sub.createdAt ? sub.createdAt.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
        const ext = sub.proofOfPaymentUrl.split('.').pop()?.split('?')[0] || 'jpg'
        const sanitizedCafeName = cafeName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
        const filename = `${sanitizedCafeName}_${uploadDate}.${ext}`

        proofInfo = {
            url: sub.proofOfPaymentUrl,
            filename
        }
    }

    // 5. Send email notification to cafe owner
    const ownerIds = sub.ownerIds
    if (ownerIds && ownerIds.length > 0) {
        try {
            const [userResult, profileResultOwner] = await Promise.all([
                db.select({ email: user.email }).from(user).where(eq(user.id, ownerIds[0])).limit(1),
                db.select({ displayName: profiles.displayName }).from(profiles).where(eq(profiles.id, ownerIds[0])).limit(1)
            ])

            const ownerEmail = userResult[0]?.email
            if (ownerEmail) {
                const displayTier = sub.tier === 'basic' ? 'Pro' : 'Premium'
                await sendSubscriptionApprovedEmail(
                    ownerEmail,
                    cafeName,
                    cafeSlug,
                    displayTier,
                    profileResultOwner[0]?.displayName || undefined
                )
            }
        } catch (emailError) {
            console.error("Error sending subscription approval email:", emailError)
        }
    }

    return { success: true, proofInfo }
}

/**
 * Delete a subscription proof of payment file from storage
 */
export async function deleteSubscriptionProof(proofUrl: string): Promise<AdminActionResult> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    await deleteSingleCafeImageAction(proofUrl)
    return { success: true }
}

/**
 * Reject a manual payment
 */
export async function rejectManualPayment(cafeId: string, subscriptionId: string, reason?: string): Promise<AdminActionResult> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    // Get subscription with cafe info before deleting
    const subResult = await db
        .select({
            tier: cafeSubscriptions.tier,
            proofOfPaymentUrl: cafeSubscriptions.proofOfPaymentUrl,
            cafeName: cafes.name,
            ownerIds: cafes.ownerIds,
        })
        .from(cafeSubscriptions)
        .leftJoin(cafes, eq(cafeSubscriptions.cafeId, cafes.id))
        .where(and(
            eq(cafeSubscriptions.id, subscriptionId),
            eq(cafeSubscriptions.cafeId, cafeId)
        ))
        .limit(1)

    const sub = subResult[0]

    // Delete the subscription record
    try {
        await db.delete(cafeSubscriptions)
            .where(and(
                eq(cafeSubscriptions.id, subscriptionId),
                eq(cafeSubscriptions.cafeId, cafeId)
            ))
    } catch (error) {
        console.error("Error rejecting subscription:", error)
        return { success: false, error: "Failed to reject subscription" }
    }

    // Delete proof file
    if (sub?.proofOfPaymentUrl) {
        await deleteSingleCafeImageAction(sub.proofOfPaymentUrl)
    }

    // Downgrade cafe
    await db.update(cafes)
        .set({ membershipTier: 'free', isVerified: false, updatedAt: new Date() })
        .where(eq(cafes.id, cafeId))

    // Send rejection email
    if (sub?.ownerIds && sub.ownerIds.length > 0 && sub.tier) {
        try {
            const [userResult, ownerProfileResult] = await Promise.all([
                db.select({ email: user.email }).from(user).where(eq(user.id, sub.ownerIds[0])).limit(1),
                db.select({ displayName: profiles.displayName }).from(profiles).where(eq(profiles.id, sub.ownerIds[0])).limit(1)
            ])

            if (userResult[0]?.email) {
                const displayTier = sub.tier === 'basic' ? 'Pro' : 'Premium'
                await sendSubscriptionRejectedEmail(
                    userResult[0].email,
                    sub.cafeName || 'cafe',
                    displayTier,
                    ownerProfileResult[0]?.displayName || undefined,
                    reason
                )
            }
        } catch (emailError) {
            console.error("Error sending rejection email:", emailError)
        }
    }

    return { success: true }
}

/**
 * Unpublish a cafe (set is_published = false)
 */
export async function unpublishCafe(cafeId: string): Promise<AdminActionResult> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    const cafeResult = await db
        .select({ contributorId: cafes.contributorId })
        .from(cafes)
        .where(eq(cafes.id, cafeId))
        .limit(1)

    try {
        await db.update(cafes)
            .set({ isPublished: false })
            .where(eq(cafes.id, cafeId))
    } catch (error) {
        console.error("Error unpublishing cafe:", error)
        return { success: false, error: "Failed to unpublish cafe" }
    }

    if (cafeResult[0]?.contributorId) {
        await updateContributorScoutStats(cafeResult[0].contributorId)
    }

    return { success: true }
}

// ============================================
// Cafe Story Functions
// ============================================

/**
 * Get cafe story by cafe ID
 */
export async function getCafeStory(cafeId: string): Promise<{ id: string; content: string } | null> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return null

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return null
    }

    const storyResult = await db
        .select({ id: cafeStories.id, content: cafeStories.content })
        .from(cafeStories)
        .where(eq(cafeStories.cafeId, cafeId))
        .limit(1)

    return storyResult[0] || null
}

/**
 * Create or update cafe story
 */
export async function upsertCafeStory(cafeId: string, content: string): Promise<AdminActionResult> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    const existingResult = await db
        .select({ id: cafeStories.id })
        .from(cafeStories)
        .where(eq(cafeStories.cafeId, cafeId))
        .limit(1)

    try {
        if (existingResult[0]) {
            await db.update(cafeStories)
                .set({ content, updatedAt: new Date() })
                .where(eq(cafeStories.id, existingResult[0].id))
        } else {
            await db.insert(cafeStories).values({ cafeId, content })
        }
    } catch (error) {
        console.error("Error upserting cafe story:", error)
        return { success: false, error: "Failed to save story" }
    }

    return { success: true }
}

/**
 * Delete cafe story
 */
export async function deleteCafeStory(cafeId: string): Promise<AdminActionResult> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    try {
        await db.delete(cafeStories).where(eq(cafeStories.cafeId, cafeId))
    } catch (error) {
        console.error("Error deleting cafe story:", error)
        return { success: false, error: "Failed to delete story" }
    }

    return { success: true }
}

// ============================================
// Cleanup Functions
// ============================================

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
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin') {
        return { success: false, error: "Admin access required" }
    }

    return await cleanupOrphanedImages()
}

/**
 * Admin action to process avatar deletion queue
 */
export async function adminProcessAvatarQueue(): Promise<{
    success: boolean
    processed?: number
    error?: string
}> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin') {
        return { success: false, error: "Admin access required" }
    }

    return await processAvatarDeletionQueue()
}

// ============================================
// Review Moderation Functions
// ============================================

import { reviews, reviewInteractions } from "@/db/schema"
import { deleteReviewImagesAction } from '@/utils/storage/actions'

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
 * Get all reviews that have been reported
 */
export async function getReportedReviews(): Promise<ReviewForModeration[]> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return []

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return []
    }

    // Get all review IDs that have report interactions
    const reportedReviewIdsResult = await db
        .select({ reviewId: reviewInteractions.reviewId })
        .from(reviewInteractions)
        .where(eq(reviewInteractions.interactionType, 'report'))

    if (!reportedReviewIdsResult.length) {
        return []
    }

    const uniqueReviewIds = [...new Set(reportedReviewIdsResult.map(r => r.reviewId))]

    // Fetch the reviews with those IDs
    const reviewsResult = await db
        .select({
            id: reviews.id,
            rating: reviews.rating,
            comment: reviews.comment,
            images: reviews.images,
            status: reviews.status,
            createdAt: reviews.createdAt,
            updatedAt: reviews.updatedAt,
            userId: reviews.userId,
            cafeId: reviews.cafeId,
        })
        .from(reviews)
        .where(inArray(reviews.id, uniqueReviewIds))
        .orderBy(desc(reviews.updatedAt))

    if (!reviewsResult.length) return []

    // Get author and cafe info
    const userIds = [...new Set(reviewsResult.map(r => r.userId).filter(Boolean))] as string[]
    const cafeIds = [...new Set(reviewsResult.map(r => r.cafeId).filter(Boolean))] as string[]

    const [authorsResult, cafesInfoResult] = await Promise.all([
        userIds.length > 0 ? db.select({
            id: profiles.id,
            username: profiles.username,
            displayName: profiles.displayName,
            avatarUrl: profiles.avatarUrl,
        }).from(profiles).where(inArray(profiles.id, userIds)) : [],
        cafeIds.length > 0 ? db.select({
            id: cafes.id,
            name: cafes.name,
            slug: cafes.slug,
            thumbnail: cafes.thumbnail,
        }).from(cafes).where(inArray(cafes.id, cafeIds)) : []
    ])

    const authorMap = new Map(authorsResult.map(a => [a.id, a]))
    const cafeInfoMap = new Map(cafesInfoResult.map(c => [c.id, c]))

    // Count reports per review
    const reportMap = new Map<string, number>()
    reportedReviewIdsResult.forEach(r => {
        const current = reportMap.get(r.reviewId) || 0
        reportMap.set(r.reviewId, current + 1)
    })

    return reviewsResult.map(r => {
        const author = r.userId ? authorMap.get(r.userId) : null
        const cafe = r.cafeId ? cafeInfoMap.get(r.cafeId) : null
        return {
            id: r.id,
            rating: r.rating,
            comment: r.comment ?? '',
            images: r.images,
            status: r.status as ReviewForModeration['status'],
            created_at: r.createdAt?.toISOString() ?? null,
            updated_at: r.updatedAt?.toISOString() ?? null,
            report_count: reportMap.get(r.id) || 0,
            author: author ? {
                id: author.id,
                username: author.username ?? '',
                display_name: author.displayName ?? '',
                avatar_url: author.avatarUrl,
            } : null,
            cafe: cafe ? {
                id: cafe.id,
                name: cafe.name,
                slug: cafe.slug,
                thumbnail: cafe.thumbnail ?? '',
            } : null,
        }
    }).sort((a, b) => b.report_count - a.report_count)
}

/**
 * Get all flagged reviews for moderation
 */
export async function getFlaggedReviews(): Promise<ReviewForModeration[]> {
    return getReviewsForModeration('flagged')
}

/**
 * Get reviews for moderation by status
 */
export async function getReviewsForModeration(
    status?: 'published' | 'hidden' | 'flagged'
): Promise<ReviewForModeration[]> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return []

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return []
    }

    // Fetch reviews
    const conditions = status ? [eq(reviews.status, status)] : []
    const reviewsResult = await db
        .select({
            id: reviews.id,
            rating: reviews.rating,
            comment: reviews.comment,
            images: reviews.images,
            status: reviews.status,
            createdAt: reviews.createdAt,
            updatedAt: reviews.updatedAt,
            userId: reviews.userId,
            cafeId: reviews.cafeId,
        })
        .from(reviews)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(reviews.updatedAt))

    if (!reviewsResult.length) return []

    // Get author and cafe info
    const userIds = [...new Set(reviewsResult.map(r => r.userId).filter(Boolean))] as string[]
    const cafeIds = [...new Set(reviewsResult.map(r => r.cafeId).filter(Boolean))] as string[]
    const reviewIds = reviewsResult.map(r => r.id)

    const [authorsResult, cafesInfoResult, reportCountsResult] = await Promise.all([
        userIds.length > 0 ? db.select({
            id: profiles.id,
            username: profiles.username,
            displayName: profiles.displayName,
            avatarUrl: profiles.avatarUrl,
        }).from(profiles).where(inArray(profiles.id, userIds)) : [],
        cafeIds.length > 0 ? db.select({
            id: cafes.id,
            name: cafes.name,
            slug: cafes.slug,
            thumbnail: cafes.thumbnail,
        }).from(cafes).where(inArray(cafes.id, cafeIds)) : [],
        reviewIds.length > 0 ? db.select({ reviewId: reviewInteractions.reviewId })
            .from(reviewInteractions)
            .where(and(
                inArray(reviewInteractions.reviewId, reviewIds),
                eq(reviewInteractions.interactionType, 'report')
            )) : []
    ])

    const authorMap = new Map(authorsResult.map(a => [a.id, a]))
    const cafeInfoMap = new Map(cafesInfoResult.map(c => [c.id, c]))

    const reportMap = new Map<string, number>()
    reportCountsResult.forEach(r => {
        const current = reportMap.get(r.reviewId) || 0
        reportMap.set(r.reviewId, current + 1)
    })

    return reviewsResult.map(r => {
        const author = r.userId ? authorMap.get(r.userId) : null
        const cafe = r.cafeId ? cafeInfoMap.get(r.cafeId) : null
        return {
            id: r.id,
            rating: r.rating,
            comment: r.comment ?? '',
            images: r.images,
            status: r.status as ReviewForModeration['status'],
            created_at: r.createdAt?.toISOString() ?? null,
            updated_at: r.updatedAt?.toISOString() ?? null,
            report_count: reportMap.get(r.id) || 0,
            author: author ? {
                id: author.id,
                username: author.username ?? '',
                display_name: author.displayName ?? '',
                avatar_url: author.avatarUrl,
            } : null,
            cafe: cafe ? {
                id: cafe.id,
                name: cafe.name,
                slug: cafe.slug,
                thumbnail: cafe.thumbnail ?? '',
            } : null,
        }
    })
}

/**
 * Moderate a review (change its status)
 */
export async function moderateReview(
    reviewId: string,
    newStatus: 'published' | 'hidden' | 'flagged'
): Promise<AdminActionResult> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    try {
        await db.update(reviews)
            .set({ status: newStatus, updatedAt: new Date() })
            .where(eq(reviews.id, reviewId))
    } catch (error) {
        console.error("Error moderating review:", error)
        return { success: false, error: "Failed to moderate review" }
    }

    // If approving (publishing), clear all report interactions
    if (newStatus === 'published') {
        await db.delete(reviewInteractions)
            .where(and(
                eq(reviewInteractions.reviewId, reviewId),
                eq(reviewInteractions.interactionType, 'report')
            ))
    }

    return { success: true }
}

/**
 * Delete a review as admin (permanently removes it)
 */
export async function deleteReviewAsAdmin(reviewId: string): Promise<AdminActionResult> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    // Get review images first
    const reviewResult = await db
        .select({ images: reviews.images })
        .from(reviews)
        .where(eq(reviews.id, reviewId))
        .limit(1)

    const review = reviewResult[0]

    // Delete review images from storage
    if (review?.images && review.images.length > 0) {
        await deleteReviewImagesAction(review.images)
    }

    // Delete review interactions
    await db.delete(reviewInteractions)
        .where(eq(reviewInteractions.reviewId, reviewId))

    // Delete the review
    try {
        await db.delete(reviews)
            .where(eq(reviews.id, reviewId))
    } catch (error) {
        console.error("Error deleting review:", error)
        return { success: false, error: "Failed to delete review" }
    }

    return { success: true }
}

// ============================================
// Badge Management Functions
// ============================================

import { badgeDefinitions, userBadges, featuredSchedules } from "@/db/schema"
import { deleteBadgeImageAction } from '@/utils/storage/actions'
import { inArray } from "drizzle-orm"

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
    const currentUser = await getCurrentUser()
    if (!currentUser) return []

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return []
    }

    const result = await db
        .select()
        .from(badgeDefinitions)
        .orderBy(asc(badgeDefinitions.rarity), asc(badgeDefinitions.name))

    return result.map(b => ({
        id: b.id,
        name: b.name,
        description: b.description,
        image_url: b.imageUrl,
        category: b.category as BadgeDefinition['category'],
        rarity: b.rarity as BadgeDefinition['rarity'],
        metadata: b.metadata as Record<string, unknown> | null,
        created_at: b.createdAt?.toISOString() ?? null,
    }))
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
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    if (!badge.name?.trim()) return { success: false, error: "Badge name is required" }
    if (!badge.description?.trim()) return { success: false, error: "Badge description is required" }
    if (!badge.image_url?.trim()) return { success: false, error: "Badge image is required" }

    try {
        const result = await db.insert(badgeDefinitions)
            .values({
                name: badge.name.trim(),
                description: badge.description.trim(),
                imageUrl: badge.image_url,
                category: badge.category,
                rarity: badge.rarity,
                metadata: badge.metadata || null,
            })
            .returning()

        const newBadge = result[0]
        return {
            success: true,
            badge: {
                id: newBadge.id,
                name: newBadge.name,
                description: newBadge.description,
                image_url: newBadge.imageUrl,
                category: newBadge.category as BadgeDefinition['category'],
                rarity: newBadge.rarity as BadgeDefinition['rarity'],
                metadata: newBadge.metadata as Record<string, unknown> | null,
                created_at: newBadge.createdAt?.toISOString() ?? null,
            }
        }
    } catch (error) {
        console.error("Error creating badge:", error)
        return { success: false, error: "Failed to create badge" }
    }
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
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    // Map snake_case to camelCase
    const drizzleUpdates: Record<string, unknown> = {}
    if (updates.name !== undefined) drizzleUpdates.name = updates.name
    if (updates.description !== undefined) drizzleUpdates.description = updates.description
    if (updates.image_url !== undefined) drizzleUpdates.imageUrl = updates.image_url
    if (updates.category !== undefined) drizzleUpdates.category = updates.category
    if (updates.rarity !== undefined) drizzleUpdates.rarity = updates.rarity
    if (updates.metadata !== undefined) drizzleUpdates.metadata = updates.metadata

    try {
        await db.update(badgeDefinitions)
            .set(drizzleUpdates)
            .where(eq(badgeDefinitions.id, badgeId))
    } catch (error) {
        console.error("Error updating badge:", error)
        return { success: false, error: "Failed to update badge" }
    }

    return { success: true }
}

/**
 * Delete a badge definition (cascades to user_badges)
 */
export async function deleteBadgeDefinition(badgeId: string): Promise<AdminActionResult> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    // Get badge image URL
    const badgeResult = await db
        .select({ imageUrl: badgeDefinitions.imageUrl })
        .from(badgeDefinitions)
        .where(eq(badgeDefinitions.id, badgeId))
        .limit(1)

    try {
        await db.delete(badgeDefinitions)
            .where(eq(badgeDefinitions.id, badgeId))
    } catch (error) {
        console.error("Error deleting badge:", error)
        return { success: false, error: "Failed to delete badge" }
    }

    // Delete badge image from storage
    if (badgeResult[0]?.imageUrl) {
        await deleteBadgeImageAction(badgeResult[0].imageUrl)
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
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    // Check if user already has this badge
    const existingResult = await db
        .select({ id: userBadges.id })
        .from(userBadges)
        .where(and(
            eq(userBadges.userId, userId),
            eq(userBadges.badgeId, badgeId)
        ))
        .limit(1)

    if (existingResult[0]) {
        return { success: false, error: "User already has this badge" }
    }

    try {
        await db.insert(userBadges).values({
            userId,
            badgeId,
            evidenceUrl: evidenceUrl || null,
            awardedAt: new Date(),
        })
    } catch (error) {
        console.error("Error awarding badge:", error)
        return { success: false, error: "Failed to award badge" }
    }

    return { success: true }
}

/**
 * Revoke a badge from a user
 */
export async function revokeBadgeFromUser(userId: string, badgeId: string): Promise<AdminActionResult> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    try {
        await db.delete(userBadges)
            .where(and(
                eq(userBadges.userId, userId),
                eq(userBadges.badgeId, badgeId)
            ))
    } catch (error) {
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
    const currentUser = await getCurrentUser()
    if (!currentUser) return []

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return []
    }

    if (!query || query.length < 2) return []

    const searchTerm = `%${query}%`
    const result = await db
        .select({
            id: profiles.id,
            username: profiles.username,
            displayName: profiles.displayName,
            avatarUrl: profiles.avatarUrl,
        })
        .from(profiles)
        .where(or(
            ilike(profiles.username, searchTerm),
            ilike(profiles.displayName, searchTerm)
        ))
        .limit(10)

    return result.map(u => ({
        id: u.id,
        username: u.username ?? '',
        display_name: u.displayName ?? '',
        avatar_url: u.avatarUrl,
    }))
}

/**
 * Search users for cafe owner assignment
 */
export async function searchUsersForOwner(query: string): Promise<{
    id: string
    username: string
    display_name: string
    avatar_url: string | null
}[]> {
    return searchUsersForBadge(query)
}

/**
 * Get owner profiles by IDs
 */
export async function getOwnerProfiles(ownerIds: string[]): Promise<{
    id: string
    username: string
    display_name: string
    avatar_url: string | null
}[]> {
    if (!ownerIds || ownerIds.length === 0) return []

    const currentUser = await getCurrentUser()
    if (!currentUser) return []

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return []
    }

    const result = await db
        .select({
            id: profiles.id,
            username: profiles.username,
            displayName: profiles.displayName,
            avatarUrl: profiles.avatarUrl,
        })
        .from(profiles)
        .where(inArray(profiles.id, ownerIds))

    return result.map(u => ({
        id: u.id,
        username: u.username ?? '',
        display_name: u.displayName ?? '',
        avatar_url: u.avatarUrl,
    }))
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
    const currentUser = await getCurrentUser()
    if (!currentUser) return { users: [], total: 0, hasMore: false }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return { users: [], total: 0, hasMore: false }
    }

    // Get total count
    const countResult = await db
        .select({ count: drizzleCount() })
        .from(userBadges)
        .where(eq(userBadges.badgeId, badgeId))

    const total = countResult[0]?.count ?? 0

    // Get paginated users with badge
    const result = await db
        .select({
            userId: userBadges.userId,
            awardedAt: userBadges.awardedAt,
            username: profiles.username,
            displayName: profiles.displayName,
            avatarUrl: profiles.avatarUrl,
        })
        .from(userBadges)
        .leftJoin(profiles, eq(userBadges.userId, profiles.id))
        .where(eq(userBadges.badgeId, badgeId))
        .orderBy(desc(userBadges.awardedAt))
        .limit(limit)
        .offset(offset)

    return {
        users: result.map(u => ({
            user_id: u.userId,
            username: u.username ?? '',
            display_name: u.displayName ?? '',
            avatar_url: u.avatarUrl ?? null,
            awarded_at: u.awardedAt?.toISOString() ?? null,
        })),
        total,
        hasMore: offset + limit < total,
    }
}

/**
 * Award a badge to ALL users (chunked for performance)
 */
export async function awardBadgeToAllUsers(badgeId: string): Promise<{ success: boolean; error?: string }> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    // Fetch all user IDs
    const allProfiles = await db.select({ id: profiles.id }).from(profiles)

    if (!allProfiles.length) return { success: true }

    const CHUNK_SIZE = 1000
    for (let i = 0; i < allProfiles.length; i += CHUNK_SIZE) {
        const chunk = allProfiles.slice(i, i + CHUNK_SIZE)
        try {
            await db.insert(userBadges)
                .values(chunk.map(p => ({ userId: p.id, badgeId, awardedAt: new Date() })))
                .onConflictDoNothing()
        } catch (error) {
            console.error(`Error awarding badge chunk ${i}:`, error)
            return { success: false, error: `Partial failure at chunk ${i}` }
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
    const currentUser = await getCurrentUser()
    if (!currentUser) return []

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return []
    }

    const result = await db
        .select({
            id: featuredSchedules.id,
            cafeId: featuredSchedules.cafeId,
            startDate: featuredSchedules.startDate,
            endDate: featuredSchedules.endDate,
            slotType: featuredSchedules.slotType,
            regionContext: featuredSchedules.regionContext,
            isActive: featuredSchedules.isActive,
            priority: featuredSchedules.priority,
            customTitle: featuredSchedules.customTitle,
            customDescription: featuredSchedules.customDescription,
            customImage: featuredSchedules.customImage,
            createdAt: featuredSchedules.createdAt,
            cafeName: cafes.name,
            cafeSlug: cafes.slug,
            cafeThumbnail: cafes.thumbnail,
            cafeCity: cafes.cityMunicipality,
            cafeRegion: cafes.region,
        })
        .from(featuredSchedules)
        .leftJoin(cafes, eq(featuredSchedules.cafeId, cafes.id))
        .orderBy(desc(featuredSchedules.startDate))

    return result.map(r => ({
        id: r.id,
        cafe_id: r.cafeId,
        start_date: r.startDate instanceof Date ? r.startDate.toISOString().split('T')[0] : r.startDate,
        end_date: r.endDate instanceof Date ? r.endDate.toISOString().split('T')[0] : r.endDate,
        slot_type: r.slotType as FeaturedSchedule['slot_type'],
        region_context: r.regionContext,
        is_active: r.isActive,
        priority: r.priority,
        custom_title: r.customTitle,
        custom_description: r.customDescription,
        custom_image: r.customImage,
        created_at: r.createdAt?.toISOString() ?? null,
        cafe: r.cafeName ? {
            id: r.cafeId,
            name: r.cafeName,
            slug: r.cafeSlug!,
            thumbnail: r.cafeThumbnail ?? '',
            city_municipality: r.cafeCity ?? '',
            region: r.cafeRegion ?? '',
        } : null,
    }))
}

/**
 * Check for conflicting featured schedules
 */
export async function checkFeaturedConflict(
    startDate: string,
    endDate: string,
    regionContext: string | null,
    excludeId?: string
): Promise<{ hasConflict: boolean; conflictingCafe?: string }> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return { hasConflict: false }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return { hasConflict: false }
    }

    // Check for overlapping schedules with same region_context
    const conditions = [
        eq(featuredSchedules.slotType, 'hero'),
        eq(featuredSchedules.isActive, true),
        sql`${featuredSchedules.startDate} <= ${endDate}`,
        sql`${featuredSchedules.endDate} >= ${startDate}`,
    ]

    if (regionContext) {
        conditions.push(eq(featuredSchedules.regionContext, regionContext))
    } else {
        conditions.push(sql`${featuredSchedules.regionContext} IS NULL`)
    }

    if (excludeId) {
        conditions.push(sql`${featuredSchedules.id} != ${excludeId}`)
    }

    const conflicts = await db
        .select({
            id: featuredSchedules.id,
            cafeName: cafes.name,
        })
        .from(featuredSchedules)
        .leftJoin(cafes, eq(featuredSchedules.cafeId, cafes.id))
        .where(and(...conditions))
        .limit(1)

    if (conflicts.length > 0) {
        return { hasConflict: true, conflictingCafe: conflicts[0].cafeName || 'Another cafe' }
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
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    const conflict = await checkFeaturedConflict(schedule.start_date, schedule.end_date, schedule.region_context)
    if (conflict.hasConflict) {
        return { success: false, error: `Conflict: ${conflict.conflictingCafe} is already featured` }
    }

    try {
        const result = await db.insert(featuredSchedules)
            .values({
                cafeId: schedule.cafe_id,
                startDate: new Date(schedule.start_date),
                endDate: new Date(schedule.end_date),
                regionContext: schedule.region_context,
                slotType: 'hero',
                isActive: true,
                priority: schedule.priority ?? 1,
                customTitle: schedule.custom_title ?? null,
                customDescription: schedule.custom_description ?? null,
            })
            .returning()

        const newSchedule = result[0]

        // Get cafe info
        const cafeResult = await db
            .select({
                name: cafes.name,
                slug: cafes.slug,
                thumbnail: cafes.thumbnail,
                city: cafes.cityMunicipality,
                region: cafes.region,
            })
            .from(cafes)
            .where(eq(cafes.id, schedule.cafe_id))
            .limit(1)

        const cafe = cafeResult[0]

        return {
            success: true,
            schedule: {
                id: newSchedule.id,
                cafe_id: newSchedule.cafeId,
                start_date: typeof newSchedule.startDate === 'string' ? newSchedule.startDate : (newSchedule.startDate instanceof Date ? newSchedule.startDate.toISOString().split('T')[0] : ''),
                end_date: typeof newSchedule.endDate === 'string' ? newSchedule.endDate : (newSchedule.endDate instanceof Date ? newSchedule.endDate.toISOString().split('T')[0] : ''),
                slot_type: newSchedule.slotType as FeaturedSchedule['slot_type'],
                region_context: newSchedule.regionContext,
                is_active: newSchedule.isActive,
                priority: newSchedule.priority,
                custom_title: newSchedule.customTitle,
                custom_description: newSchedule.customDescription,
                custom_image: newSchedule.customImage,
                created_at: newSchedule.createdAt?.toISOString() ?? null,
                cafe: cafe ? {
                    id: schedule.cafe_id,
                    name: cafe.name,
                    slug: cafe.slug,
                    thumbnail: cafe.thumbnail ?? '',
                    city_municipality: cafe.city ?? '',
                    region: cafe.region ?? '',
                } : null,
            }
        }
    } catch (error) {
        console.error("Error creating featured schedule:", error)
        return { success: false, error: "Failed to create featured schedule" }
    }
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
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    // Check for conflicts if dates/region are being updated
    if (updates.start_date || updates.end_date || updates.region_context !== undefined) {
        const currentResult = await db
            .select({ startDate: featuredSchedules.startDate, endDate: featuredSchedules.endDate, regionContext: featuredSchedules.regionContext })
            .from(featuredSchedules)
            .where(eq(featuredSchedules.id, scheduleId))
            .limit(1)

        const current = currentResult[0]
        if (current) {
            const conflict = await checkFeaturedConflict(
                (updates.start_date ?? (current.startDate instanceof Date ? current.startDate.toISOString().split('T')[0] : current.startDate)),
                (updates.end_date ?? (current.endDate instanceof Date ? current.endDate.toISOString().split('T')[0] : current.endDate)),
                updates.region_context !== undefined ? updates.region_context : current.regionContext,
                scheduleId
            )

            if (conflict.hasConflict) {
                return { success: false, error: `Conflict: ${conflict.conflictingCafe} is already featured` }
            }
        }
    }

    // Map snake_case to camelCase
    const drizzleUpdates: Record<string, unknown> = {}
    if (updates.cafe_id !== undefined) drizzleUpdates.cafeId = updates.cafe_id
    if (updates.start_date !== undefined) drizzleUpdates.startDate = updates.start_date
    if (updates.end_date !== undefined) drizzleUpdates.endDate = updates.end_date
    if (updates.region_context !== undefined) drizzleUpdates.regionContext = updates.region_context
    if (updates.is_active !== undefined) drizzleUpdates.isActive = updates.is_active
    if (updates.priority !== undefined) drizzleUpdates.priority = updates.priority
    if (updates.custom_title !== undefined) drizzleUpdates.customTitle = updates.custom_title
    if (updates.custom_description !== undefined) drizzleUpdates.customDescription = updates.custom_description

    try {
        await db.update(featuredSchedules)
            .set(drizzleUpdates)
            .where(eq(featuredSchedules.id, scheduleId))
    } catch (error) {
        console.error("Error updating featured schedule:", error)
        return { success: false, error: "Failed to update featured schedule" }
    }

    return { success: true }
}

/**
 * Delete a featured schedule
 */
export async function deleteFeaturedSchedule(scheduleId: string): Promise<AdminActionResult> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    try {
        await db.delete(featuredSchedules)
            .where(eq(featuredSchedules.id, scheduleId))
    } catch (error) {
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

    const currentUser = await getCurrentUser()
    if (!currentUser) return []

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return []
    }

    const result = await db
        .select({
            id: cafes.id,
            name: cafes.name,
            slug: cafes.slug,
            thumbnail: cafes.thumbnail,
            city: cafes.cityMunicipality,
            region: cafes.region,
        })
        .from(cafes)
        .where(and(
            eq(cafes.isPublished, true),
            sql`${cafes.thumbnail} != 'placeholder'`,
            ilike(cafes.name, `%${query}%`)
        ))
        .orderBy(asc(cafes.name))
        .limit(10)

    return result.map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        thumbnail: c.thumbnail ?? '',
        city_municipality: c.city ?? '',
        region: c.region,
    }))
}

// ============================================
// Owner Verification Management Functions
// ============================================

import { ownerVerificationRequests, featuredSlotRequests } from "@/db/schema"

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
    const currentUser = await getCurrentUser()
    if (!currentUser) return []

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return []
    }

    const result = await db
        .select({
            id: ownerVerificationRequests.id,
            cafeId: ownerVerificationRequests.cafeId,
            userId: ownerVerificationRequests.userId,
            verificationType: ownerVerificationRequests.verificationType,
            proofUrls: ownerVerificationRequests.proofUrls,
            notes: ownerVerificationRequests.notes,
            status: ownerVerificationRequests.status,
            adminNotes: ownerVerificationRequests.adminNotes,
            createdAt: ownerVerificationRequests.createdAt,
            cafeName: cafes.name,
            cafeSlug: cafes.slug,
            cafeThumbnail: cafes.thumbnail,
            cafeEmail: cafes.email,
            userName: profiles.username,
            userDisplayName: profiles.displayName,
            userAvatarUrl: profiles.avatarUrl,
        })
        .from(ownerVerificationRequests)
        .leftJoin(cafes, eq(ownerVerificationRequests.cafeId, cafes.id))
        .leftJoin(profiles, eq(ownerVerificationRequests.userId, profiles.id))
        .where(eq(ownerVerificationRequests.status, 'pending'))
        .orderBy(asc(ownerVerificationRequests.createdAt))

    return result.map(r => ({
        id: r.id,
        cafe_id: r.cafeId,
        user_id: r.userId,
        verification_type: r.verificationType as OwnerVerificationForAdmin['verification_type'],
        proof_urls: r.proofUrls ?? [],
        notes: r.notes,
        status: r.status as OwnerVerificationForAdmin['status'],
        admin_notes: r.adminNotes,
        created_at: r.createdAt?.toISOString() ?? null,
        cafe: r.cafeName ? {
            id: r.cafeId,
            name: r.cafeName,
            slug: r.cafeSlug!,
            thumbnail: r.cafeThumbnail ?? '',
            email: r.cafeEmail,
        } : null,
        user: r.userName ? {
            id: r.userId,
            username: r.userName,
            display_name: r.userDisplayName ?? '',
            avatar_url: r.userAvatarUrl,
        } : null,
    }))
}

/**
 * Get all verification requests (for history view)
 */
export async function getAllVerifications(status?: 'pending' | 'approved' | 'rejected'): Promise<OwnerVerificationForAdmin[]> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return []

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return []
    }

    const conditions = status ? [eq(ownerVerificationRequests.status, status)] : []

    const result = await db
        .select({
            id: ownerVerificationRequests.id,
            cafeId: ownerVerificationRequests.cafeId,
            userId: ownerVerificationRequests.userId,
            verificationType: ownerVerificationRequests.verificationType,
            proofUrls: ownerVerificationRequests.proofUrls,
            notes: ownerVerificationRequests.notes,
            status: ownerVerificationRequests.status,
            adminNotes: ownerVerificationRequests.adminNotes,
            createdAt: ownerVerificationRequests.createdAt,
            cafeName: cafes.name,
            cafeSlug: cafes.slug,
            cafeThumbnail: cafes.thumbnail,
            cafeEmail: cafes.email,
            userName: profiles.username,
            userDisplayName: profiles.displayName,
            userAvatarUrl: profiles.avatarUrl,
        })
        .from(ownerVerificationRequests)
        .leftJoin(cafes, eq(ownerVerificationRequests.cafeId, cafes.id))
        .leftJoin(profiles, eq(ownerVerificationRequests.userId, profiles.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(ownerVerificationRequests.createdAt))
        .limit(100)

    return result.map(r => ({
        id: r.id,
        cafe_id: r.cafeId,
        user_id: r.userId,
        verification_type: r.verificationType as OwnerVerificationForAdmin['verification_type'],
        proof_urls: r.proofUrls ?? [],
        notes: r.notes,
        status: r.status as OwnerVerificationForAdmin['status'],
        admin_notes: r.adminNotes,
        created_at: r.createdAt?.toISOString() ?? null,
        cafe: r.cafeName ? {
            id: r.cafeId,
            name: r.cafeName,
            slug: r.cafeSlug!,
            thumbnail: r.cafeThumbnail ?? '',
            email: r.cafeEmail,
        } : null,
        user: r.userName ? {
            id: r.userId,
            username: r.userName,
            display_name: r.userDisplayName ?? '',
            avatar_url: r.userAvatarUrl,
        } : null,
    }))
}

/**
 * Approve an owner verification request
 */
export async function approveVerification(requestId: string): Promise<AdminActionResult> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    // Get the verification request
    const requestResult = await db
        .select({ cafeId: ownerVerificationRequests.cafeId, userId: ownerVerificationRequests.userId, status: ownerVerificationRequests.status })
        .from(ownerVerificationRequests)
        .where(eq(ownerVerificationRequests.id, requestId))
        .limit(1)

    const request = requestResult[0]
    if (!request) {
        return { success: false, error: "Verification request not found" }
    }

    if (request.status !== 'pending') {
        return { success: false, error: "Request has already been processed" }
    }

    // Get current cafe owner_ids
    const cafeResult = await db
        .select({ ownerIds: cafes.ownerIds })
        .from(cafes)
        .where(eq(cafes.id, request.cafeId))
        .limit(1)

    const currentOwners = cafeResult[0]?.ownerIds || []
    const newOwners = currentOwners.includes(request.userId)
        ? currentOwners
        : [...currentOwners, request.userId]

    // Update cafe with new owner
    try {
        await db.update(cafes)
            .set({
                ownerIds: newOwners,
                isClaimed: true,
                updatedAt: new Date(),
            })
            .where(eq(cafes.id, request.cafeId))
    } catch (error) {
        console.error("Error updating cafe owners:", error)
        return { success: false, error: "Failed to update cafe ownership" }
    }

    // Update verification request status
    try {
        await db.update(ownerVerificationRequests)
            .set({
                status: 'approved',
                reviewedBy: currentUser.id,
                reviewedAt: new Date(),
            })
            .where(eq(ownerVerificationRequests.id, requestId))
    } catch (error) {
        console.error("Error updating verification status:", error)
        return { success: false, error: "Failed to update verification status" }
    }

    // Create a free subscription for the cafe if one doesn't exist
    const existingSubResult = await db
        .select({ id: cafeSubscriptions.id })
        .from(cafeSubscriptions)
        .where(eq(cafeSubscriptions.cafeId, request.cafeId))
        .limit(1)

    if (!existingSubResult[0]) {
        await db.insert(cafeSubscriptions).values({
            cafeId: request.cafeId,
            tier: 'free',
            status: 'active',
        })
    }

    return { success: true }
}

/**
 * Reject an owner verification request
 */
export async function rejectVerification(requestId: string, reason: string): Promise<AdminActionResult> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    // Verify request exists and is pending
    const requestResult = await db
        .select({ status: ownerVerificationRequests.status })
        .from(ownerVerificationRequests)
        .where(eq(ownerVerificationRequests.id, requestId))
        .limit(1)

    if (!requestResult[0]) {
        return { success: false, error: "Verification request not found" }
    }

    if (requestResult[0].status !== 'pending') {
        return { success: false, error: "Request has already been processed" }
    }

    try {
        await db.update(ownerVerificationRequests)
            .set({
                status: 'rejected',
                adminNotes: reason,
                reviewedBy: currentUser.id,
                reviewedAt: new Date(),
            })
            .where(eq(ownerVerificationRequests.id, requestId))
    } catch (error) {
        console.error("Error rejecting verification:", error)
        return { success: false, error: "Failed to reject verification" }
    }

    return { success: true }
}

/**
 * Send verification email to cafe's listed email
 */
export async function sendVerificationEmail(requestId: string): Promise<AdminActionResult> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    // Get request with cafe email
    const requestResult = await db
        .select({
            id: ownerVerificationRequests.id,
            cafeEmail: cafes.email,
            cafeName: cafes.name,
        })
        .from(ownerVerificationRequests)
        .leftJoin(cafes, eq(ownerVerificationRequests.cafeId, cafes.id))
        .where(eq(ownerVerificationRequests.id, requestId))
        .limit(1)

    const request = requestResult[0]
    if (!request) {
        return { success: false, error: "Verification request not found" }
    }

    if (!request.cafeEmail) {
        return { success: false, error: "Cafe does not have an email address" }
    }

    // TODO: Implement email sending with verification link
    console.log(`Would send verification email to ${request.cafeEmail} for request ${requestId}`)

    return { success: true }
}

// ============================================
// User Role Management (Admin Only)
// ============================================

type UserRole = 'admin' | 'moderator' | 'writer' | 'user'

export interface TeamMember {
    id: string
    username: string
    display_name: string
    avatar_url: string | null
    role: UserRole | null
    created_at: string | null
}

/**
 * Search users for role assignment
 */
export async function searchUsersForRoleAssignment(query: string, limit: number = 10): Promise<TeamMember[]> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return []

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin') {
        return []
    }

    if (!query || query.length < 2) return []

    const searchTerm = `%${query.trim()}%`
    const result = await db
        .select({
            id: profiles.id,
            username: profiles.username,
            displayName: profiles.displayName,
            avatarUrl: profiles.avatarUrl,
            role: profiles.role,
            createdAt: profiles.createdAt,
        })
        .from(profiles)
        .where(or(
            ilike(profiles.username, searchTerm),
            ilike(profiles.displayName, searchTerm)
        ))
        .limit(limit)

    return result.map(u => ({
        id: u.id,
        username: u.username ?? '',
        display_name: u.displayName ?? '',
        avatar_url: u.avatarUrl,
        role: u.role as UserRole | null,
        created_at: u.createdAt?.toISOString() ?? null,
    }))
}

/**
 * Update a user's role
 */
export async function updateUserRole(targetUserId: string, newRole: UserRole): Promise<AdminActionResult> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin') {
        return { success: false, error: "Only admins can change user roles" }
    }

    if (targetUserId === currentUser.id) {
        return { success: false, error: "You cannot change your own role" }
    }

    try {
        await db.update(profiles)
            .set({ role: newRole })
            .where(eq(profiles.id, targetUserId))
    } catch (error) {
        console.error("Error updating user role:", error)
        return { success: false, error: "Failed to update user role" }
    }

    return { success: true }
}

/**
 * Get all admins and moderators
 */
export async function getAdminsAndModerators(): Promise<TeamMember[]> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return []

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin') {
        return []
    }

    const result = await db
        .select({
            id: profiles.id,
            username: profiles.username,
            displayName: profiles.displayName,
            avatarUrl: profiles.avatarUrl,
            role: profiles.role,
            createdAt: profiles.createdAt,
        })
        .from(profiles)
        .where(inArray(profiles.role, ['admin', 'moderator', 'writer']))
        .orderBy(asc(profiles.role), asc(profiles.createdAt))

    return result.map(u => ({
        id: u.id,
        username: u.username ?? '',
        display_name: u.displayName ?? '',
        avatar_url: u.avatarUrl,
        role: u.role as UserRole | null,
        created_at: u.createdAt?.toISOString() ?? null,
    }))
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

    const conditions = status ? [eq(featuredSlotRequests.status, status)] : []

    const result = await db
        .select({
            id: featuredSlotRequests.id,
            ownerId: featuredSlotRequests.ownerId,
            cafeId: featuredSlotRequests.cafeId,
            requestedMonth: featuredSlotRequests.requestedMonth,
            status: featuredSlotRequests.status,
            adminNotes: featuredSlotRequests.adminNotes,
            processedAt: featuredSlotRequests.processedAt,
            createdAt: featuredSlotRequests.createdAt,
            cafeName: cafes.name,
            cafeSlug: cafes.slug,
            cafeThumbnail: cafes.thumbnail,
            cafeCity: cafes.cityMunicipality,
            cafeRegion: cafes.region,
            ownerUsername: profiles.username,
            ownerDisplayName: profiles.displayName,
        })
        .from(featuredSlotRequests)
        .leftJoin(cafes, eq(featuredSlotRequests.cafeId, cafes.id))
        .leftJoin(profiles, eq(featuredSlotRequests.ownerId, profiles.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(featuredSlotRequests.createdAt))

    return result.map(r => ({
        id: r.id,
        owner_id: r.ownerId,
        cafe_id: r.cafeId,
        requested_month: r.requestedMonth,
        status: r.status,
        admin_notes: r.adminNotes,
        processed_at: r.processedAt?.toISOString() ?? null,
        created_at: r.createdAt?.toISOString() ?? null,
        cafe: r.cafeName && r.cafeId ? {
            id: r.cafeId,
            name: r.cafeName,
            slug: r.cafeSlug!,
            thumbnail: r.cafeThumbnail ?? '',
            city_municipality: r.cafeCity ?? '',
            region: r.cafeRegion ?? '',
        } : null,
        owner: r.ownerUsername && r.ownerId ? {
            id: r.ownerId,
            username: r.ownerUsername,
            display_name: r.ownerDisplayName ?? '',
        } : null,
    }))
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

    const updates: Record<string, unknown> = {
        status,
        processedAt: new Date(),
    }

    if (adminNotes !== undefined) {
        updates.adminNotes = adminNotes
    }

    try {
        await db.update(featuredSlotRequests)
            .set(updates)
            .where(eq(featuredSlotRequests.id, requestId))
    } catch (error) {
        console.error('Error updating featured request:', error)
        return { success: false, error: 'Failed to update request' }
    }

    return { success: true }
}

// ============================================
// MIGRATION COMPLETE - All admin.ts functions migrated to Drizzle ORM
// ============================================
// Total migrated: ~58 functions across 5 phases
// Phase 1: Core Cafe Functions (permission, cafe CRUD, pagination)
// Phase 2: Subscriptions, Stories, Cleanup
// Phase 3: Review Moderation
// Phase 4: Badges & Featured Schedules
// Phase 5: Verification & User Roles
