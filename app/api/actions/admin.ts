/* eslint-disable @typescript-eslint/no-explicit-any -- Drizzle relational queries return complex nested types that require any for flattening */
'use server'

import { db } from "@/db"
import {
    cafes,
    cafeRatingStats,
    cafeClaims,
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
            .where(sql`${profiles.id} = ANY(${contributorIds})`)
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
            .where(sql`${profiles.id} = ANY(${contributorIds})`)
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
            .where(sql`${profiles.id} = ANY(${contributorIds})`)
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
// END OF PHASE 2 - Subscriptions, Stories, Cleanup
// ============================================
// The remaining phases will be added incrementally:
// Phase 3: Review Moderation
// Phase 4: Badges & Featured Schedules
// Phase 5: Verification & User Roles
