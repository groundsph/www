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
    monthlyLeaderboardSnapshots,
    cafeStories,
} from "@/db/schema"
import { PH_REGIONS } from "@/utils/ph-regions"
import { eq, and, or, desc, asc, sql, ilike, count as drizzleCount, isNull, inArray } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
import { deleteCafeImagesAction, deleteSingleCafeImageAction, cleanupOrphanedImages, processAvatarDeletionQueue } from "@/utils/storage/actions"
import { sendCafeApprovedEmail, sendCafeRejectedEmail } from "@/utils/email"
import { CafeWithRatings, ProfileStats } from "@/utils/types/extra"
import { checkAndAwardBadges } from "@/utils/badges/badge-logic"
import { logContribution, getChangedFields, generateChangeSummary } from "@/utils/contribution-logging"
import { logSystemAction } from "./system-logs"
import { getModeratorRegionsForCurrentUser, normalizeRegions } from "@/utils/moderation/region-access"

type ScoutRank = 'novice' | 'scout' | 'explorer' | 'expert' | 'vanguard' | 'legend'

// Activity point values
const ACTIVITY_POINTS = {
    CAFE_SUBMITTED: 10,  // New cafe submission
    REVIEW_WRITTEN: 5,   // Review written
    EDIT_CONTRIBUTION: 3, // Cafe edit contribution
    CAFE_VISITED: 1,     // Check-in to a cafe
} as const

// Scout rank thresholds based on activity points
const RANK_THRESHOLDS: { rank: ScoutRank; minPoints: number }[] = [
    { rank: 'legend', minPoints: 300 },
    { rank: 'vanguard', minPoints: 150 },
    { rank: 'expert', minPoints: 75 },
    { rank: 'explorer', minPoints: 30 },
    { rank: 'scout', minPoints: 10 },
    { rank: 'novice', minPoints: 0 },
]

/**
 * Calculate scout rank based on activity points
 */
function calculateScoutRank(activityPoints: number): ScoutRank {
    for (const { rank, minPoints } of RANK_THRESHOLDS) {
        if (activityPoints >= minPoints) return rank
    }
    return 'novice'
}

/**
 * Calculate total activity points for a user based on their contributions
 */
async function calculateActivityPoints(userId: string): Promise<{
    totalPoints: number
    totalScouted: number
    totalReviews: number
    totalVisits: number
}> {
    // Count published cafes
    const cafeCountResult = await db
        .select({ count: drizzleCount() })
        .from(cafes)
        .where(and(
            eq(cafes.contributorId, userId),
            eq(cafes.isPublished, true)
        ))
    const totalScouted = cafeCountResult[0]?.count ?? 0

    // Count reviews
    const { reviews, cafeEditSuggestions } = await import("@/db/schema")
    const reviewCountResult = await db
        .select({ count: drizzleCount() })
        .from(reviews)
        .where(eq(reviews.userId, userId))
    const totalReviews = reviewCountResult[0]?.count ?? 0

    // Count only APPROVED edit suggestions (not pending/rejected)
    const editCountResult = await db
        .select({ count: drizzleCount() })
        .from(cafeEditSuggestions)
        .where(and(
            eq(cafeEditSuggestions.userId, userId),
            eq(cafeEditSuggestions.status, 'approved')
        ))
    const totalEdits = editCountResult[0]?.count ?? 0

    // Count visits from passport
    const profileResult = await db
        .select({ passport: profiles.passport })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1)

    const passport = profileResult[0]?.passport as { visited_ids?: string[]; visits?: { cafe_id: string }[] } | null
    const visitedIds = passport?.visited_ids ?? []
    const visits = passport?.visits ?? []
    const totalVisits = Math.max(visitedIds.length, visits.length)

    // Calculate total points
    const totalPoints =
        (totalScouted * ACTIVITY_POINTS.CAFE_SUBMITTED) +
        (totalReviews * ACTIVITY_POINTS.REVIEW_WRITTEN) +
        (totalEdits * ACTIVITY_POINTS.EDIT_CONTRIBUTION) +
        (totalVisits * ACTIVITY_POINTS.CAFE_VISITED)

    return { totalPoints, totalScouted, totalReviews, totalVisits }
}

/**
 * Update a user's activity points and scout rank
 * Called after any activity that affects points (cafe published, review, edit, visit)
 */
export async function updateUserActivityStats(userId: string): Promise<void> {
    if (!userId) return

    try {
        const { totalPoints, totalScouted, totalReviews } = await calculateActivityPoints(userId)
        const newRank = calculateScoutRank(totalPoints)

        // Get current profile stats
        const profileResult = await db
            .select({ stats: profiles.stats })
            .from(profiles)
            .where(eq(profiles.id, userId))
            .limit(1)

        const profile = profileResult[0]
        if (!profile) {
            console.error("Error fetching user profile: not found")
            return
        }

        // Merge with existing stats
        const currentStats = (profile.stats as ProfileStats | null) ?? {
            scout_rank: 'novice',
            activity_points: 0,
            total_photos: 0,
            total_reviews: 0,
            total_scouted: 0
        }

        const updatedStats: ProfileStats = {
            ...currentStats,
            activity_points: totalPoints,
            total_scouted: totalScouted,
            total_reviews: totalReviews,
            scout_rank: newRank
        }

        // Update profile with new stats
        await db.update(profiles)
            .set({ stats: updatedStats })
            .where(eq(profiles.id, userId))
    } catch (error) {
        console.error("Error updating user activity stats:", error)
    }
}

// Legacy function name for backward compatibility
async function updateContributorScoutStats(contributorId: string): Promise<void> {
    return updateUserActivityStats(contributorId)
}

// ============================================
// Leaderboard Snapshot Backfill Functions
// ============================================

/**
 * Get the snapshot status for multiple months.
 * Returns user and cafe counts for each month, along with whether any are missing.
 */
export async function getLeaderboardSnapshotStatus(months: string[]): Promise<{
    success: boolean
    data?: Array<{
        yearMonth: string
        userCount: number
        cafeCount: number
        hasMissing: boolean
    }>
    error?: string
}> {
    const user = await getCurrentUser()
    if (!user || (await getUserRole()) !== "admin") {
        return { success: false, error: "Unauthorized" }
    }

    try {
        const rows = await db
            .select({
                yearMonth: monthlyLeaderboardSnapshots.yearMonth,
                type: monthlyLeaderboardSnapshots.type,
                count: sql<number>`count(*)::int`,
            })
            .from(monthlyLeaderboardSnapshots)
            .where(inArray(monthlyLeaderboardSnapshots.yearMonth, months))
            .groupBy(monthlyLeaderboardSnapshots.yearMonth, monthlyLeaderboardSnapshots.type)

        const byMonth = new Map<string, { user: number; cafe: number }>()
        for (const row of rows) {
            if (!byMonth.has(row.yearMonth)) byMonth.set(row.yearMonth, { user: 0, cafe: 0 })
            const entry = byMonth.get(row.yearMonth)!
            if (row.type === "user") entry.user = row.count
            if (row.type === "cafe") entry.cafe = row.count
        }

        return {
            success: true,
            data: months.map((ym) => {
                const counts = byMonth.get(ym) ?? { user: 0, cafe: 0 }
                return {
                    yearMonth: ym,
                    userCount: counts.user,
                    cafeCount: counts.cafe,
                    hasMissing: counts.user === 0 || counts.cafe === 0,
                }
            }),
        }
    } catch (e) {
        console.error(e)
        return { success: false, error: "Failed to fetch snapshot status" }
    }
}

/**
 * Backfill all missing leaderboard snapshots for the given months.
 * Processes each month that has missing data.
 */
export async function backfillAllMissingLeaderboardSnapshots(months: string[]): Promise<{
    success: boolean
    message: string
    processed?: number
}> {
    const user = await getCurrentUser()
    if (!user || (await getUserRole()) !== "admin") {
        return { success: false, message: "Unauthorized" }
    }

    try {
        let processed = 0
        for (const month of months) {
            const result = await backfillLeaderboardSnapshots(month)
            if (result.success) processed++
        }
        return {
            success: true,
            message: `Processed ${processed} months`,
            processed,
        }
    } catch (e) {
        console.error(e)
        return { success: false, message: String(e) }
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
        has_smoking: cafe.hasSmoking,
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
        is_hidden_gem: cafe.isHiddenGem ?? false,
        finding_hint: cafe.findingHint ?? null,
        is_chain: cafe.isChain ?? false,
        badge_stamp_url: cafe.badgeStampUrl ?? null,
        is_halal_certified: cafe.isHalalCertified ?? false,
        straw_type: cafe.strawType ?? '',
        straw_type_other: cafe.strawTypeOther ?? '',
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

    // Apply region filtering for moderators with region restrictions
    const regions = await getModeratorRegionsForCurrentUser()
    const conditions = [eq(cafes.isPublished, false)]
    if (regions.length > 0) {
        conditions.push(inArray(cafes.region, regions))
    }

    // Fetch pending cafes
    const cafesResult = await db
        .select()
        .from(cafes)
        .where(and(...conditions))
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
            region: cafes.region,
        })
        .from(cafes)
        .where(eq(cafes.id, cafeId))
        .limit(1)

    const cafe = cafeResult[0]
    if (!cafe) {
        return { success: false, error: "Cafe not found" }
    }

    // Validate region access for moderators with region restrictions
    const regions = await getModeratorRegionsForCurrentUser()
    if (regions.length > 0 && !regions.includes(cafe.region)) {
        return { success: false, error: "Unauthorized - cafe is outside your region scope" }
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

    // Log the cafe approval
    await logSystemAction(
        "approve",
        "cafe",
        cafeId,
        { isPublished: false, status: "pending" },
        { isPublished: true, status: "approved" },
        { reason: "Cafe approved by admin", cafeName: cafe.name }
    )

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
            region: cafes.region,
        })
        .from(cafes)
        .where(eq(cafes.id, cafeId))
        .limit(1)

    const cafe = cafeResult[0]

    // Validate region access for moderators with region restrictions
    const regions = await getModeratorRegionsForCurrentUser()
    if (regions.length > 0 && cafe && !regions.includes(cafe.region)) {
        return { success: false, error: "Unauthorized - cafe is outside your region scope" }
    }

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

    // Log the cafe rejection
    await logSystemAction(
        "reject",
        "cafe",
        cafeId,
        { isPublished: wasPublished ?? false, status: "pending" },
        { status: "rejected" },
        { reason: reason || "Cafe rejected by admin", cafeName, contributorId }
    )

    return { success: true }
}

/**
 * Permanently delete a cafe (published or pending)
 * Unlike rejectCafe, this does NOT send a rejection email
 * Used for removing accepted cafes that need to be completely deleted
 */
export async function deleteCafe(cafeId: string): Promise<AdminActionResult> {
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

    // Fetch cafe to get image URLs and contributor info before deletion
    const cafeResult = await db
        .select({
            name: cafes.name,
            thumbnail: cafes.thumbnail,
            gallery: cafes.gallery,
            contributorId: cafes.contributorId,
            isPublished: cafes.isPublished,
            region: cafes.region,
        })
        .from(cafes)
        .where(eq(cafes.id, cafeId))
        .limit(1)

    const cafe = cafeResult[0]
    if (!cafe) {
        return { success: false, error: "Cafe not found" }
    }

    // Validate region access for moderators with region restrictions
    const regions = await getModeratorRegionsForCurrentUser()
    if (regions.length > 0 && !regions.includes(cafe.region)) {
        return { success: false, error: "Unauthorized - cafe is outside your region scope" }
    }

    const contributorId = cafe.contributorId
    const wasPublished = cafe.isPublished

    // Delete images from storage
    await deleteCafeImagesAction(cafe.thumbnail, cafe.gallery)

    // Delete related records in correct order to avoid trigger conflicts
    // The reviews table has a trigger that updates cafe_rating_stats, so we need to:
    // 1. Delete reviews first (trigger runs but cafe still exists)
    // 2. Delete cafe_rating_stats
    // 3. Then delete the cafe
    try {
        // Delete reviews first (trigger will update rating stats while cafe exists)
        await db.delete(reviews).where(eq(reviews.cafeId, cafeId))

        // Delete cafe rating stats
        await db.delete(cafeRatingStats).where(eq(cafeRatingStats.cafeId, cafeId))

        // Now delete the cafe (cascade handles remaining related records)
        await db.delete(cafes).where(eq(cafes.id, cafeId))
    } catch (error) {
        console.error("Error deleting cafe:", error)
        return { success: false, error: "Failed to delete cafe. There may be related records preventing deletion." }
    }

    // Update contributor's scout stats if cafe was published
    if (wasPublished && contributorId) {
        await updateContributorScoutStats(contributorId)
    }

    // Log the cafe deletion
    await logSystemAction(
        "delete",
        "cafe",
        cafeId,
        { name: cafe.name, isPublished: wasPublished, region: cafe.region },
        null,
        { reason: "Cafe permanently deleted by admin", cafeName: cafe.name, contributorId }
    )

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

    // Validate region access for moderators with region restrictions
    const regions = await getModeratorRegionsForCurrentUser()
    if (regions.length > 0 && !regions.includes(cafe.region)) {
        return null
    }

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
        has_smoking: boolean
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
        price_level: "budget" | "mid" | "premium" | "luxury"
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
        is_hidden_gem: boolean
        finding_hint: string | null
        is_chain: boolean
        is_halal_certified: boolean
        straw_type: string
        straw_type_other: string
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

    // Fetch current cafe data for change detection and region validation
    const currentCafeResult = await db
        .select({ name: cafes.name, region: cafes.region })
        .from(cafes)
        .where(eq(cafes.id, cafeId))
        .limit(1)

    const currentCafe = currentCafeResult[0]

    // Validate region access for moderators with region restrictions
    const regions = await getModeratorRegionsForCurrentUser()
    if (regions.length > 0 && currentCafe && !regions.includes(currentCafe.region)) {
        return { success: false, error: "Unauthorized - cafe is outside your region scope" }
    }

    // Map snake_case updates to camelCase for Drizzle
    const fieldMap: Record<string, string> = {
        address_display: 'addressDisplay',
        has_wifi: 'hasWifi',
        has_smoking: 'hasSmoking',
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
        is_hidden_gem: 'isHiddenGem',
        finding_hint: 'findingHint',
        is_chain: 'isChain',
        is_halal_certified: 'isHalalCertified',
        straw_type: 'strawType',
        straw_type_other: 'strawTypeOther',
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

    // Log to system logs
    await logSystemAction(
        "update",
        "cafe",
        cafeId,
        currentCafe ? { name: currentCafe.name, region: currentCafe.region } : null,
        updates,
        {
            source: "admin_edit",
            cafe_name: updates.name || currentCafe?.name,
            changed_fields: changedFields,
        }
    )

    return { success: true }
}

/**
 * Bulk mark cafes as chain (admin only)
 * Marks multiple cafes as chain or removes chain status
 */
export async function bulkMarkAsChain(
    cafeIds: string[],
    isChain: boolean
): Promise<AdminActionResult & { count?: number }> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin') {
        return { success: false, error: "Only admins can bulk update chain status" }
    }

    if (!cafeIds.length) {
        return { success: false, error: "No cafes selected" }
    }

    try {
        await db.update(cafes)
            .set({ isChain, updatedAt: new Date() })
            .where(inArray(cafes.id, cafeIds))

        // Log the bulk chain marking
        await logSystemAction(
            "update",
            "cafe",
            cafeIds[0],
            null,
            { isChain },
            {
                reason: `Bulk marked ${cafeIds.length} cafes as ${isChain ? "chain" : "non-chain"}`,
                cafe_count: cafeIds.length,
                cafe_ids: cafeIds,
                is_chain: isChain,
            }
        )

        return { success: true, count: cafeIds.length }
    } catch (error) {
        console.error("Error bulk marking cafes as chain:", error)
        return { success: false, error: "Failed to update cafes" }
    }
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
    const result = await deleteSingleCafeImageAction(imageUrl)

    if (result.success) {
        await logSystemAction(
            "delete",
            "cafe",
            imageUrl,
            { imageUrl },
            null,
            { reason: "Cafe image deleted by admin", image_url: imageUrl }
        )
    }

    return result
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

    // Apply region filtering for moderators with region restrictions
    const regions = await getModeratorRegionsForCurrentUser()
    const conditions = [eq(cafes.isPublished, true)]
    if (regions.length > 0) {
        conditions.push(inArray(cafes.region, regions))
    }

    const cafesResult = await db
        .select()
        .from(cafes)
        .where(and(...conditions))
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
    chainFilter?: 'all' | 'chains_only' | 'exclude_chains'
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

    // Apply region filtering for moderators with region restrictions
    const regions = await getModeratorRegionsForCurrentUser()
    if (regions.length > 0) {
        conditions.push(inArray(cafes.region, regions))
    }

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

    // Chain filter
    if (params.chainFilter === 'chains_only') {
        conditions.push(eq(cafes.isChain, true))
    } else if (params.chainFilter === 'exclude_chains') {
        conditions.push(or(eq(cafes.isChain, false), isNull(cafes.isChain))!)
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

    // Apply region filtering for moderators with region restrictions
    const regions = await getModeratorRegionsForCurrentUser()
    const regionCondition = regions.length > 0 ? inArray(cafes.region, regions) : undefined

    // Get all unique provinces
    const provincesResult = await db
        .selectDistinct({ province: cafes.province })
        .from(cafes)
        .where(regionCondition ? and(regionCondition) : undefined)
        .orderBy(asc(cafes.province))

    const provinces = provincesResult.map(p => p.province).filter(Boolean) as string[]

    // Get cities grouped by province
    const citiesResult = await db
        .selectDistinct({
            province: cafes.province,
            city: cafes.cityMunicipality,
        })
        .from(cafes)
        .where(regionCondition ? and(regionCondition) : undefined)
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

    // Get counts with region filtering
    const publishedCountResult = await db
        .select({ count: drizzleCount() })
        .from(cafes)
        .where(regionCondition ? and(eq(cafes.isPublished, true), regionCondition) : eq(cafes.isPublished, true))

    const pendingCountResult = await db
        .select({ count: drizzleCount() })
        .from(cafes)
        .where(regionCondition ? and(eq(cafes.isPublished, false), regionCondition) : eq(cafes.isPublished, false))

    return {
        provinces,
        cities,
        totalPublished: publishedCountResult[0]?.count ?? 0,
        totalPending: pendingCountResult[0]?.count ?? 0,
    }
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
        .select({ contributorId: cafes.contributorId, region: cafes.region })
        .from(cafes)
        .where(eq(cafes.id, cafeId))
        .limit(1)

    // Validate region access for moderators with region restrictions
    const regions = await getModeratorRegionsForCurrentUser()
    if (regions.length > 0 && cafeResult[0] && !regions.includes(cafeResult[0].region)) {
        return { success: false, error: "Unauthorized - cafe is outside your region scope" }
    }

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

    // Log the cafe unpublish
    await logSystemAction(
        "update",
        "cafe",
        cafeId,
        { isPublished: true },
        { isPublished: false },
        { reason: "Cafe unpublished by admin" }
    )

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

    // Validate region access for moderators with region restrictions
    const cafeResult = await db
        .select({ region: cafes.region })
        .from(cafes)
        .where(eq(cafes.id, cafeId))
        .limit(1)

    const cafe = cafeResult[0]
    if (!cafe) return null

    const regions = await getModeratorRegionsForCurrentUser()
    if (regions.length > 0 && !regions.includes(cafe.region)) {
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

    // Validate region access for moderators with region restrictions
    const cafeResult = await db
        .select({ region: cafes.region })
        .from(cafes)
        .where(eq(cafes.id, cafeId))
        .limit(1)

    const cafe = cafeResult[0]
    if (!cafe) {
        return { success: false, error: "Cafe not found" }
    }

    const regions = await getModeratorRegionsForCurrentUser()
    if (regions.length > 0 && !regions.includes(cafe.region)) {
        return { success: false, error: "Unauthorized - cafe is outside your region scope" }
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

    // Log the story upsert
    await logSystemAction(
        existingResult[0] ? "update" : "create",
        "cafe",
        cafeId,
        existingResult[0] ? { storyExists: true } : null,
        { contentLength: content.length },
        { reason: existingResult[0] ? "Cafe story updated by admin" : "Cafe story created by admin" }
    )

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

    // Validate region access for moderators with region restrictions
    const cafeResult = await db
        .select({ region: cafes.region })
        .from(cafes)
        .where(eq(cafes.id, cafeId))
        .limit(1)

    const cafe = cafeResult[0]
    if (!cafe) {
        return { success: false, error: "Cafe not found" }
    }

    const regions = await getModeratorRegionsForCurrentUser()
    if (regions.length > 0 && !regions.includes(cafe.region)) {
        return { success: false, error: "Unauthorized - cafe is outside your region scope" }
    }

    try {
        await db.delete(cafeStories).where(eq(cafeStories.cafeId, cafeId))
    } catch (error) {
        console.error("Error deleting cafe story:", error)
        return { success: false, error: "Failed to delete story" }
    }

    // Log the story deletion
    await logSystemAction(
        "delete",
        "cafe",
        cafeId,
        { storyExists: true },
        null,
        { reason: "Cafe story deleted by admin" }
    )

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
        collections: number
        crawls: number
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

    // Apply region filtering for moderators with region restrictions
    const regions = await getModeratorRegionsForCurrentUser()

    // Fetch the reviews with those IDs, joining with cafes for region filtering
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
            cafeRegion: cafes.region,
        })
        .from(reviews)
        .leftJoin(cafes, eq(reviews.cafeId, cafes.id))
        .where(and(
            inArray(reviews.id, uniqueReviewIds),
            regions.length > 0 ? inArray(cafes.region, regions) : undefined
        ))
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

    // Apply region filtering for moderators with region restrictions
    const regions = await getModeratorRegionsForCurrentUser()

    // Fetch reviews, joining with cafes for region filtering
    const conditions = status ? [eq(reviews.status, status)] : []
    if (regions.length > 0) {
        conditions.push(inArray(cafes.region, regions))
    }

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
        .leftJoin(cafes, eq(reviews.cafeId, cafes.id))
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

    // Fetch review with cafe region for validation
    const reviewResult = await db
        .select({
            id: reviews.id,
            cafeRegion: cafes.region,
        })
        .from(reviews)
        .leftJoin(cafes, eq(reviews.cafeId, cafes.id))
        .where(eq(reviews.id, reviewId))
        .limit(1)

    const review = reviewResult[0]
    if (!review) {
        return { success: false, error: "Review not found" }
    }

    // Validate region access for moderators with region restrictions
    const regions = await getModeratorRegionsForCurrentUser()
    if (regions.length > 0 && (!review.cafeRegion || !regions.includes(review.cafeRegion))) {
        return { success: false, error: "Unauthorized - review is outside your region scope" }
    }

    // Get current status before update
    const currentReviewResult = await db
        .select({ status: reviews.status })
        .from(reviews)
        .where(eq(reviews.id, reviewId))
        .limit(1)

    const oldStatus = currentReviewResult[0]?.status

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

    // Log the moderation action
    const actionType = newStatus === 'published' ? 'approve' : newStatus === 'hidden' ? 'reject' : 'update'
    await logSystemAction(
        actionType,
        "review",
        reviewId,
        { status: oldStatus },
        { status: newStatus },
        { reason: `Review ${newStatus} by moderator` }
    )

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

    // Get review images and cafe region for validation
    const reviewResult = await db
        .select({
            images: reviews.images,
            cafeRegion: cafes.region,
        })
        .from(reviews)
        .leftJoin(cafes, eq(reviews.cafeId, cafes.id))
        .where(eq(reviews.id, reviewId))
        .limit(1)

    const review = reviewResult[0]
    if (!review) {
        return { success: false, error: "Review not found" }
    }

    // Validate region access for moderators with region restrictions
    const regions = await getModeratorRegionsForCurrentUser()
    if (regions.length > 0 && (!review.cafeRegion || !regions.includes(review.cafeRegion))) {
        return { success: false, error: "Unauthorized - review is outside your region scope" }
    }

    // Get review details before deletion for logging
    const reviewDetailsResult = await db
        .select({
            rating: reviews.rating,
            comment: reviews.comment,
            status: reviews.status,
            userId: reviews.userId,
            cafeId: reviews.cafeId,
        })
        .from(reviews)
        .where(eq(reviews.id, reviewId))
        .limit(1)

    const reviewDetails = reviewDetailsResult[0]

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

    // Log the deletion
    await logSystemAction(
        "delete",
        "review",
        reviewId,
        reviewDetails ? {
            rating: reviewDetails.rating,
            comment: reviewDetails.comment,
            status: reviewDetails.status,
            userId: reviewDetails.userId,
            cafeId: reviewDetails.cafeId,
        } : null,
        null,
        { reason: "Review deleted by admin" }
    )

    return { success: true }
}

// ============================================
// Badge Management Functions
// ============================================

import { badgeDefinitions, userBadges, featuredSchedules } from "@/db/schema"
import { deleteBadgeImageAction } from '@/utils/storage/actions'

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

        await logSystemAction(
            "create",
            "badge",
            newBadge.id,
            null,
            { name: newBadge.name, description: newBadge.description, category: newBadge.category, rarity: newBadge.rarity },
            { reason: "Badge definition created by admin" }
        )

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

    await logSystemAction(
        "update",
        "badge",
        badgeId,
        null,
        updates as Record<string, unknown>,
        { reason: "Badge definition updated by admin" }
    )

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

    await logSystemAction(
        "delete",
        "badge",
        badgeId,
        null,
        null,
        { reason: "Badge definition deleted by admin" }
    )

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

        // Log the featured schedule creation
        await logSystemAction(
            "create",
            "featured",
            newSchedule.id,
            null,
            {
                cafeId: schedule.cafe_id,
                startDate: schedule.start_date,
                endDate: schedule.end_date,
                slotType: "hero",
                cafeName: cafe?.name,
            },
            { reason: "Featured schedule created by admin", cafeName: cafe?.name }
        )

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
    if (updates.start_date !== undefined) {
        const startDate = typeof updates.start_date === 'string' 
            ? new Date(updates.start_date) 
            : updates.start_date
        drizzleUpdates.startDate = startDate
    }
    if (updates.end_date !== undefined) {
        const endDate = typeof updates.end_date === 'string' 
            ? new Date(updates.end_date) 
            : updates.end_date
        drizzleUpdates.endDate = endDate
    }
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

    // Log the featured schedule update
    await logSystemAction(
        "update",
        "featured",
        scheduleId,
        null,
        updates as Record<string, unknown>,
        { reason: "Featured schedule updated by admin" }
    )

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

    // Log the featured schedule deletion
    await logSystemAction(
        "delete",
        "featured",
        scheduleId,
        null,
        null,
        { reason: "Featured schedule deleted by admin" }
    )

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

import { ownerVerificationRequests } from "@/db/schema"

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

    // Log the verification approval
    await logSystemAction(
        "approve",
        "verification",
        requestId,
        { status: "pending" },
        { status: "approved", cafeId: request.cafeId, userId: request.userId },
        { reason: "Owner verification approved by admin" }
    )

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

    // Get request details before update for logging
    const requestDetailsResult = await db
        .select({ cafeId: ownerVerificationRequests.cafeId, userId: ownerVerificationRequests.userId })
        .from(ownerVerificationRequests)
        .where(eq(ownerVerificationRequests.id, requestId))
        .limit(1)

    const requestDetails = requestDetailsResult[0]

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

    // Log the verification rejection
    await logSystemAction(
        "reject",
        "verification",
        requestId,
        { status: "pending" },
        { status: "rejected", reason },
        { reason: reason || "Owner verification rejected by admin", cafeId: requestDetails?.cafeId, userId: requestDetails?.userId }
    )

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
    moderator_regions: string[] | null
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
        moderator_regions: null,
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

    const updates: { role: UserRole; moderatorRegions?: null } = { role: newRole }
    if (newRole !== "moderator") {
        updates.moderatorRegions = null
    }

    // Get old role before update
    const [oldProfile] = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, targetUserId))
        .limit(1)

    try {
        await db.update(profiles)
            .set(updates)
            .where(eq(profiles.id, targetUserId))
    } catch (error) {
        console.error("Error updating user role:", error)
        return { success: false, error: "Failed to update user role" }
    }

    // Log the action
    await logSystemAction(
        "role_change",
        "user",
        targetUserId,
        { role: oldProfile?.role },
        { role: newRole },
        { previousRole: oldProfile?.role, newRole }
    )

    return { success: true }
}

/**
 * Update moderator regions (admin only)
 */
export async function updateModeratorRegions(targetUserId: string, regions: string[]): Promise<AdminActionResult> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    if (!Array.isArray(regions)) {
        return { success: false, error: "Invalid regions format" }
    }

    const profileResult = await db.select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin') {
        return { success: false, error: "Only admins can update moderator regions" }
    }

    const targetResult = await db.select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, targetUserId))
        .limit(1)

    if (targetResult[0]?.role !== 'moderator') {
        return { success: false, error: "Target user is not a moderator" }
    }

    const normalized = normalizeRegions(regions)

    try {
        await db.update(profiles)
            .set({ moderatorRegions: normalized.length > 0 ? normalized : null })
            .where(eq(profiles.id, targetUserId))
    } catch (error) {
        console.error("Error updating moderator regions:", error)
        return { success: false, error: "Failed to update moderator regions" }
    }

    // Log the moderator regions update
    await logSystemAction(
        "role_change",
        "user",
        targetUserId,
        null,
        { moderatorRegions: normalized },
        { reason: "Moderator regions updated by admin", targetUserId, regions: normalized }
    )

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
            moderatorRegions: profiles.moderatorRegions,
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
        moderator_regions: u.moderatorRegions ?? null,
    }))
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

// ============================================
// User Management Functions
// ============================================

export interface UserPaginationParams {
    page?: number
    pageSize?: number
    search?: string
    role?: 'admin' | 'moderator' | 'writer' | 'user'
    sortBy?: 'createdAt' | 'name'
    sortOrder?: 'asc' | 'desc'
}

export interface PaginatedUsersResult {
    users: {
        id: string
        username: string | null
        displayName: string | null
        avatarUrl: string | null
        email: string | null
        role: string
        createdAt: Date | null
        isBanned: boolean
    }[]
    total: number
    page: number
    pageSize: number
    hasMore: boolean
}

/**
 * Get paginated users for admin management
 */
export async function getPaginatedUsers(params: UserPaginationParams): Promise<PaginatedUsersResult> {
    const {
        page = 1,
        pageSize = 20,
        search,
        role,
        sortBy = 'createdAt',
        sortOrder = 'desc'
    } = params

    const currentUser = await getCurrentUser()
    if (!currentUser) return { users: [], total: 0, page, pageSize, hasMore: false }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return { users: [], total: 0, page, pageSize, hasMore: false }
    }

    // Build conditions
    const conditions = []

    if (role) {
        conditions.push(eq(profiles.role, role))
    }

    if (search && search.trim()) {
        const searchTerm = `%${search.trim()}%`
        conditions.push(or(
            ilike(profiles.username, searchTerm),
            ilike(profiles.displayName, searchTerm),
            ilike(user.email, searchTerm)
        )!)
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // Get total count
    const countQuery = db
        .select({ count: drizzleCount() })
        .from(profiles)
        .leftJoin(user, eq(profiles.id, user.id))

    if (whereClause) {
        countQuery.where(whereClause)
    }

    const countResult = await countQuery
    const total = countResult[0]?.count ?? 0

    // Determine sorting
    const sortCol = sortBy === 'name' ? profiles.displayName : profiles.createdAt
    const orderBy = sortOrder === 'asc' ? asc(sortCol!) : desc(sortCol!)

    // Fetch users
    const usersQuery = db
        .select({
            id: profiles.id,
            username: profiles.username,
            displayName: profiles.displayName,
            avatarUrl: profiles.avatarUrl,
            role: profiles.role,
            createdAt: profiles.createdAt,
            email: user.email,
            isBanned: user.banned
        })
        .from(profiles)
        .leftJoin(user, eq(profiles.id, user.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize)
        .orderBy(orderBy)

    if (whereClause) {
        usersQuery.where(whereClause)
    }

    const users = await usersQuery

    return {
        users: users.map(u => ({
            ...u,
            role: u.role ?? 'user',
            isBanned: u.isBanned ?? false,
        })),
        total,
        page,
        pageSize,
        hasMore: total > page * pageSize
    }
}

import { auth } from "@/lib/auth"

/**
 * Delete a user (Admin only)
 * Uses Better Auth Admin API to properly remove user and all related data
 */
export async function deleteUserAsAdmin(userId: string): Promise<AdminActionResult> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin') {
        return { success: false, error: "Unauthorized: Admin access required" }
    }

    // Get user profile info before deletion for logging
    const targetProfileResult = await db
        .select({
            username: profiles.username,
            displayName: profiles.displayName,
            role: profiles.role,
        })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1)

    const targetProfile = targetProfileResult[0]

    try {
        // Use Better Auth Admin API
        // We need to use the api.removeUser method exposed by the admin plugin
        await auth.api.removeUser({
            body: {
                userId
            },
            // Empty headers as this is a server-side call
            headers: new Headers()
        })
    } catch (error) {
        console.error("Error deleting user:", error)
        return { success: false, error: "Failed to delete user" }
    }

    // Log the user deletion
    await logSystemAction(
        "delete",
        "user",
        userId,
        targetProfile ? {
            username: targetProfile.username,
            displayName: targetProfile.displayName,
            role: targetProfile.role,
        } : null,
        null,
        { reason: "User deleted by admin" }
    )

    return { success: true }
}

// ============================================
// Profile Management Functions
// ============================================

export type ProfileSortField = "created_at" | "username" | "display_name" | "role" | "total_contribution"
export type ProfileSortDirection = "asc" | "desc"

export interface ProfileForAdmin {
    id: string
    username: string
    displayName: string
    avatarUrl: string | null
    role: string | null
    isSupporter: boolean | null
    totalContribution: number | null
    createdAt: string | null
}

export interface GetProfilesResult {
    profiles: ProfileForAdmin[]
    total: number
    totalSupporters: number
    totalContribution: number
}

/**
 * Get all profiles for admin user management
 * Supports pagination, search, and sorting
 */
export async function getProfilesForAdmin(options: {
    limit?: number
    offset?: number
    search?: string
    sortField?: ProfileSortField
    sortDirection?: ProfileSortDirection
}): Promise<GetProfilesResult> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return { profiles: [], total: 0, totalSupporters: 0, totalContribution: 0 }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return { profiles: [], total: 0, totalSupporters: 0, totalContribution: 0 }
    }

    const {
        limit = 20,
        offset = 0,
        search = "",
        sortField = "created_at",
        sortDirection = "desc",
    } = options

    // Build search condition
    const searchCondition = search.trim()
        ? or(
            ilike(profiles.username, `%${search.trim()}%`),
            ilike(profiles.displayName, `%${search.trim()}%`)
        )
        : undefined

    // Build order by based on sort field
    const orderFn = sortDirection === "asc" ? asc : desc
    const orderByColumn = {
        created_at: profiles.createdAt,
        username: profiles.username,
        display_name: profiles.displayName,
        role: profiles.role,
        total_contribution: profiles.createdAt, // Sort by date when sorting by contribution since we count separately
    }[sortField]

    // Get profiles with pagination
    const profilesResult = await db
        .select({
            id: profiles.id,
            username: profiles.username,
            displayName: profiles.displayName,
            avatarUrl: profiles.avatarUrl,
            role: profiles.role,
            isSupporter: profiles.isSupporter,
            createdAt: profiles.createdAt,
            contributionCount: sql<number>`(SELECT COUNT(*) FROM contribution_logs WHERE contribution_logs.user_id = profiles.id AND (contribution_logs.details->>'source' IS NULL OR contribution_logs.details->>'source' != 'admin_edit'))`,
        })
        .from(profiles)
        .where(searchCondition)
        .orderBy(
            sortField === "total_contribution"
                ? sortDirection === "asc"
                    ? sql`(SELECT COUNT(*) FROM contribution_logs WHERE contribution_logs.user_id = profiles.id AND (contribution_logs.details->>'source' IS NULL OR contribution_logs.details->>'source' != 'admin_edit')) ASC`
                    : sql`(SELECT COUNT(*) FROM contribution_logs WHERE contribution_logs.user_id = profiles.id AND (contribution_logs.details->>'source' IS NULL OR contribution_logs.details->>'source' != 'admin_edit')) DESC`
                : orderFn(orderByColumn)
        )
        .limit(limit)
        .offset(offset)


    // Get total count (for current search)
    const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(profiles)
        .where(searchCondition)

    // Get aggregate stats (all profiles, not filtered)
    const statsResult = await db
        .select({
            total: sql<number>`count(*)`,
            totalSupporters: sql<number>`count(*) filter (where ${profiles.isSupporter} = true)`,
        })
        .from(profiles)

    // Get total contribution logs count
    const contributionCountResult = await db
        .select({
            totalContribution: sql<number>`count(*) filter (where details->>'source' IS NULL OR details->>'source' != 'admin_edit')`,
        })
        .from(contributionLogs)

    const stats = statsResult[0] || { total: 0, totalSupporters: 0 }
    const totalContribution = Number(contributionCountResult[0]?.totalContribution ?? 0)

    return {
        profiles: profilesResult.map((p) => ({
            id: p.id,
            username: p.username,
            displayName: p.displayName,
            avatarUrl: p.avatarUrl,
            role: p.role,
            isSupporter: p.isSupporter,
            totalContribution: Number(p.contributionCount ?? 0),
            createdAt: p.createdAt?.toISOString() ?? null,
        })),
        total: Number(countResult[0]?.count ?? 0),
        totalSupporters: Number(stats.totalSupporters),
        totalContribution,
    }
}

interface BackfillResult {
    success: boolean
    message: string
    userCount?: number
    cafeCount?: number
    deletedPrevious?: number
    warnings?: string[]
    details?: {
        userRegions: string[]
        cafeRegions: string[]
        skippedRegions: string[]
    }
}

/**
 * Smart backfill: Detects gaps, validates data, and safely upserts snapshots.
 * Admin-only: Used to backfill or refresh leaderboard snapshots.
 */
export async function backfillLeaderboardSnapshots(
    yearMonth: string,
    options?: { force?: boolean; dryRun?: boolean }
): Promise<BackfillResult> {
    const hasAccess = await isAdmin()
    if (!hasAccess) {
        return { success: false, message: "Unauthorized" }
    }

    const warnings: string[] = []

    try {
        const { getMonthlyLeaderboard } = await import("@/app/api/actions/profile")
        const { getCafeMonthlyLeaderboard } = await import("@/app/api/actions/leaderboard")
        const { parseYearMonth, isFutureMonth } = await import("@/utils/date/leaderboard-months")

        const parsed = parseYearMonth(yearMonth)
        if (!parsed) {
            return { success: false, message: "Invalid year-month format (use YYYY-MM)" }
        }

        if (isFutureMonth(parsed)) {
            return { success: false, message: "Cannot backfill future months" }
        }

        // Check existing snapshots
        const existingSnapshots = await db
            .select({
                type: monthlyLeaderboardSnapshots.type,
                region: monthlyLeaderboardSnapshots.region,
            })
            .from(monthlyLeaderboardSnapshots)
            .where(eq(monthlyLeaderboardSnapshots.yearMonth, yearMonth))

        const existingUserRegions = new Set(existingSnapshots.filter(s => s.type === "user").map(s => s.region ?? "global"))
        const existingCafeRegions = new Set(existingSnapshots.filter(s => s.type === "cafe").map(s => s.region ?? "global"))
        const hasExistingData = existingSnapshots.length > 0

        // Determine which regions need backfill
        const regionsToSnapshot: (string | null)[] = [null, ...PH_REGIONS]
        const allRegions = regionsToSnapshot.map(r => r ?? "global")

        let userRegionsToProcess: (string | null)[]
        let cafeRegionsToProcess: (string | null)[]

        if (options?.force && !options?.dryRun) {
            // Force mode: reprocess all regions
            userRegionsToProcess = regionsToSnapshot
            cafeRegionsToProcess = regionsToSnapshot
            warnings.push("Force mode: Will overwrite all existing snapshots")
        } else if (hasExistingData && !options?.force) {
            // Smart mode: only process missing regions
            userRegionsToProcess = regionsToSnapshot.filter(r => !existingUserRegions.has(r ?? "global"))
            cafeRegionsToProcess = regionsToSnapshot.filter(r => !existingCafeRegions.has(r ?? "global"))

            if (userRegionsToProcess.length === 0 && cafeRegionsToProcess.length === 0) {
                return {
                    success: true,
                    message: `All regions already have snapshots for ${yearMonth}. Use force=true to refresh.`,
                    userCount: existingUserRegions.size * 100, // Approximate
                    cafeCount: existingCafeRegions.size * 100,
                }
            }
        } else {
            // No existing data or dry run: process all
            userRegionsToProcess = regionsToSnapshot
            cafeRegionsToProcess = regionsToSnapshot
        }

        // Dry run: just report what would happen
        if (options?.dryRun) {
            return {
                success: true,
                message: `[DRY RUN] Would backfill ${yearMonth}`,
                userCount: userRegionsToProcess.length * 100,
                cafeCount: cafeRegionsToProcess.length * 100,
                deletedPrevious: hasExistingData && options?.force ? existingSnapshots.length : 0,
                warnings,
            }
        }

        // If force mode, delete existing snapshots first
        let deletedCount = 0
        if (options?.force && hasExistingData) {
            await db
                .delete(monthlyLeaderboardSnapshots)
                .where(eq(monthlyLeaderboardSnapshots.yearMonth, yearMonth))
            deletedCount = existingSnapshots.length
        }

        let totalUserSnapshots = 0
        let totalCafeSnapshots = 0
        const processedUserRegions: string[] = []
        const processedCafeRegions: string[] = []
        const skippedRegions: string[] = []

        // Process user leaderboards
        for (const region of userRegionsToProcess) {
            const result = await getMonthlyLeaderboard(region, 100, yearMonth, { computeLive: true })

            // Validation: warn if suspicious data
            if (result.leaderboard.length === 0) {
                skippedRegions.push(`${region ?? "global"} (users: no data)`)
                continue
            }

            if (result.leaderboard.length < 3 && regionsToSnapshot.indexOf(region) === 0) {
                warnings.push(`Low user count for ${region ?? "global"}: ${result.leaderboard.length} entries`)
            }

            const entries = result.leaderboard.map((entry) => ({
                yearMonth,
                type: "user" as const,
                userId: entry.userId,
                rank: entry.rank,
                score: entry.score,
                visitCount: entry.visitCount,
                region,
            }))

            await db.insert(monthlyLeaderboardSnapshots).values(entries)
            totalUserSnapshots += entries.length
            processedUserRegions.push(region ?? "global")
        }

        // Process cafe leaderboards
        for (const region of cafeRegionsToProcess) {
            const result = await getCafeMonthlyLeaderboard(region, 100, yearMonth)

            // Validation: warn if suspicious data
            if (result.leaderboard.length === 0) {
                skippedRegions.push(`${region ?? "global"} (cafes: no data)`)
                continue
            }

            if (result.leaderboard.length < 3 && regionsToSnapshot.indexOf(region) === 0) {
                warnings.push(`Low cafe count for ${region ?? "global"}: ${result.leaderboard.length} entries`)
            }

            const entries = result.leaderboard.map((entry) => ({
                yearMonth,
                type: "cafe" as const,
                cafeId: entry.cafeId,
                rank: entry.rank,
                score: entry.score,
                visitCount: entry.visitCount,
                reviewCount: entry.reviewCount,
                avgRating: entry.avgRating ?? null,
                region,
            }))

            await db.insert(monthlyLeaderboardSnapshots).values(entries)
            totalCafeSnapshots += entries.length
            processedCafeRegions.push(region ?? "global")
        }

        // Build success message
        const action = options?.force ? "Refreshed" : hasExistingData ? "Updated" : "Backfilled"
        const messageParts = [`${action} ${yearMonth} successfully`]
        if (deletedCount > 0) messageParts.push(`(deleted ${deletedCount} previous snapshots)`)
        if (processedUserRegions.length < allRegions.length) {
            messageParts.push(`(${processedUserRegions.length}/${allRegions.length} user regions)`)
        }

        return {
            success: true,
            message: messageParts.join(" "),
            userCount: totalUserSnapshots,
            cafeCount: totalCafeSnapshots,
            deletedPrevious: deletedCount,
            warnings: warnings.length > 0 ? warnings : undefined,
            details: {
                userRegions: processedUserRegions,
                cafeRegions: processedCafeRegions,
                skippedRegions,
            },
        }
    } catch (error) {
        console.error("[Backfill] Error:", error)
        return {
            success: false,
            message: error instanceof Error ? error.message : "Unknown error",
            warnings: warnings.length > 0 ? warnings : undefined,
        }
    }
}

/**
 * Delete existing leaderboard snapshots for a specific month.
 * Admin-only: Used before re-backfilling.
 */
export async function deleteLeaderboardSnapshots(
    yearMonth: string
): Promise<{ success: boolean; message: string; deletedCount?: number }> {
    const hasAccess = await isAdmin()
    if (!hasAccess) {
        return { success: false, message: "Unauthorized" }
    }

    try {
        const { parseYearMonth } = await import("@/utils/date/leaderboard-months")

        const parsed = parseYearMonth(yearMonth)
        if (!parsed) {
            return { success: false, message: "Invalid year-month format (use YYYY-MM)" }
        }

        // Count existing snapshots before deleting
        const countResult = await db
            .select({ count: drizzleCount() })
            .from(monthlyLeaderboardSnapshots)
            .where(eq(monthlyLeaderboardSnapshots.yearMonth, yearMonth))

        const existingCount = Number(countResult[0]?.count ?? 0)

        await db
            .delete(monthlyLeaderboardSnapshots)
            .where(eq(monthlyLeaderboardSnapshots.yearMonth, yearMonth))

        return {
            success: true,
            message: `Deleted snapshots for ${yearMonth}`,
            deletedCount: existingCount,
        }
    } catch (error) {
        console.error("[Delete Snapshots] Error:", error)
        return {
            success: false,
            message: error instanceof Error ? error.message : "Unknown error",
        }
    }
}
