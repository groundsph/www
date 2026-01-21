"use server"

import { db } from "@/db"
import {
    profiles,
    cafes,
    reviews,
    badgeDefinitions,
    userBadges,
    cafeVisits,
} from "@/db/schema"
import { eq, and, count } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"

// ============================================
// Island Group Classification
// ============================================

type IslandGroup = "luzon" | "visayas" | "mindanao"

/**
 * Map Philippine regions to their respective island groups
 * Based on official PSGC region classifications
 */
const REGION_TO_ISLAND_GROUP: Record<string, IslandGroup> = {
    // Luzon Island Group
    "NCR - National Capital Region": "luzon",
    "Region I - Ilocos Region": "luzon",
    "Region II - Cagayan Valley": "luzon",
    "Region III - Central Luzon": "luzon",
    "Region IV-A - CALABARZON": "luzon",
    "Region IV-B - MIMAROPA": "luzon",
    "Region V - Bicol Region": "luzon",
    "CAR - Cordillera Administrative Region": "luzon",

    // Visayas Island Group
    "Region VI - Western Visayas": "visayas",
    "Region VII - Central Visayas": "visayas",
    "Region VIII - Eastern Visayas": "visayas",

    // Mindanao Island Group
    "Region IX - Zamboanga Peninsula": "mindanao",
    "Region X - Northern Mindanao": "mindanao",
    "Region XI - Davao Region": "mindanao",
    "Region XII - SOCCSKSARGEN": "mindanao",
    "Region XIII - Caraga": "mindanao",
    "BARMM - Bangsamoro": "mindanao",
}

/**
 * Get the island group for a given region name
 */
function getIslandGroup(regionName: string): IslandGroup | null {
    return REGION_TO_ISLAND_GROUP[regionName] || null
}

// ============================================
// Badge Name Constants
// ============================================

const BADGE_NAMES = {
    SCOUT: "Scout",
    EXPLORER: "Explorer",
    PATHFINDER: "Pathfinder",
    CONNOISSEUR: "Connoisseur",
    ISLAND_HOPPER: "Island Hopper",
    KAPE_NG_PAMBANSA: "Kape-ng Pambansa",
    EYE_SPY: "Eye Spy",
    GROUNDS_SUPPORTER: "Grounds Supporter",
    // Visit badges
    REGULAR: "Regular",
    LOYAL_CUSTOMER: "Loyal Customer",
} as const

// ============================================
// Badge Checking Logic
// ============================================

/**
 * Get badge definition ID by name
 */
async function getBadgeIdByName(name: string): Promise<string | null> {
    const result = await db
        .select({ id: badgeDefinitions.id })
        .from(badgeDefinitions)
        .where(eq(badgeDefinitions.name, name))
        .limit(1)

    return result[0]?.id || null
}

/**
 * Check if user already has a specific badge
 */
async function userHasBadge(userId: string, badgeId: string): Promise<boolean> {
    const result = await db
        .select({ id: userBadges.id })
        .from(userBadges)
        .where(and(eq(userBadges.userId, userId), eq(userBadges.badgeId, badgeId)))
        .limit(1)

    return result.length > 0
}

/**
 * Award a badge to a user (internal helper)
 */
async function awardBadge(userId: string, badgeId: string): Promise<boolean> {
    try {
        await db.insert(userBadges).values({
            userId,
            badgeId,
            awardedAt: new Date(),
        })

        console.log(`[Badge] Awarded badge ${badgeId} to user ${userId}`)
        return true
    } catch (error) {
        console.error(`[Badge] Failed to award badge ${badgeId} to ${userId}:`, error)
        return false
    }
}

/**
 * Check scouting badges (Scout, Explorer, Pathfinder)
 * Based on number of published cafes contributed by user
 */
async function checkScoutBadges(userId: string): Promise<string[]> {
    const awardedBadges: string[] = []

    // Count published cafes contributed by this user
    const result = await db
        .select({ count: count() })
        .from(cafes)
        .where(and(eq(cafes.contributorId, userId), eq(cafes.isPublished, true)))

    const scoutedCount = result[0]?.count || 0

    // Define thresholds
    const scoutThresholds = [
        { count: 5, badge: BADGE_NAMES.SCOUT },
        { count: 10, badge: BADGE_NAMES.EXPLORER },
        { count: 20, badge: BADGE_NAMES.PATHFINDER },
    ]

    for (const threshold of scoutThresholds) {
        if (scoutedCount >= threshold.count) {
            const badgeId = await getBadgeIdByName(threshold.badge)
            if (badgeId && !(await userHasBadge(userId, badgeId))) {
                if (await awardBadge(userId, badgeId)) {
                    awardedBadges.push(threshold.badge)
                }
            }
        }
    }

    return awardedBadges
}

/**
 * Check review badges (Connoisseur)
 * Based on number of published reviews by user
 */
async function checkReviewBadges(userId: string): Promise<string[]> {
    const awardedBadges: string[] = []

    // Count published reviews by this user
    const result = await db
        .select({ count: count() })
        .from(reviews)
        .where(and(eq(reviews.userId, userId), eq(reviews.status, "published")))

    const reviewCount = result[0]?.count || 0

    if (reviewCount >= 5) {
        const badgeId = await getBadgeIdByName(BADGE_NAMES.CONNOISSEUR)
        if (badgeId && !(await userHasBadge(userId, badgeId))) {
            if (await awardBadge(userId, badgeId)) {
                awardedBadges.push(BADGE_NAMES.CONNOISSEUR)
            }
        }
    }

    return awardedBadges
}

/**
 * Check geographic badges (Island Hopper, Kape-ng Pambansa)
 * Based on regions of cafes the user has reviewed
 */
async function checkGeographicBadges(userId: string): Promise<string[]> {
    const awardedBadges: string[] = []

    // Get distinct regions from cafes the user has reviewed
    const reviewsWithCafes = await db
        .select({ region: cafes.region })
        .from(reviews)
        .innerJoin(cafes, eq(reviews.cafeId, cafes.id))
        .where(and(eq(reviews.userId, userId), eq(reviews.status, "published")))

    if (!reviewsWithCafes || reviewsWithCafes.length === 0) {
        return awardedBadges
    }

    // Map regions to island groups
    const islandGroups = new Set<IslandGroup>()
    for (const review of reviewsWithCafes) {
        if (review.region) {
            const group = getIslandGroup(review.region)
            if (group) {
                islandGroups.add(group)
            }
        }
    }

    // Island Hopper: 2+ different island groups
    if (islandGroups.size >= 2) {
        const badgeId = await getBadgeIdByName(BADGE_NAMES.ISLAND_HOPPER)
        if (badgeId && !(await userHasBadge(userId, badgeId))) {
            if (await awardBadge(userId, badgeId)) {
                awardedBadges.push(BADGE_NAMES.ISLAND_HOPPER)
            }
        }
    }

    // Kape-ng Pambansa: All 3 island groups
    if (islandGroups.size >= 3) {
        const badgeId = await getBadgeIdByName(BADGE_NAMES.KAPE_NG_PAMBANSA)
        if (badgeId && !(await userHasBadge(userId, badgeId))) {
            if (await awardBadge(userId, badgeId)) {
                awardedBadges.push(BADGE_NAMES.KAPE_NG_PAMBANSA)
            }
        }
    }

    return awardedBadges
}

/**
 * Check supporter badge
 */
async function checkSupporterBadge(userId: string): Promise<string[]> {
    const awardedBadges: string[] = []

    const result = await db
        .select({ isSupporter: profiles.isSupporter })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1)

    if (result[0]?.isSupporter) {
        const badgeId = await getBadgeIdByName(BADGE_NAMES.GROUNDS_SUPPORTER)
        if (badgeId && !(await userHasBadge(userId, badgeId))) {
            if (await awardBadge(userId, badgeId)) {
                awardedBadges.push(BADGE_NAMES.GROUNDS_SUPPORTER)
            }
        }
    }

    return awardedBadges
}

/**
 * Check visit badges (Regular, Loyal Customer)
 * Based on number of visits to the same cafe
 * @param userId - The user ID to check
 * @param cafeId - Optional specific cafe ID to check (for targeted checks after check-in)
 */
async function checkVisitBadges(userId: string, cafeId?: string): Promise<string[]> {
    const awardedBadges: string[] = []

    // Get visit counts per cafe for this user
    // If cafeId is provided, only check that cafe (more efficient for check-in flow)
    const query = cafeId
        ? db
            .select({ cafeId: cafeVisits.cafeId, visitCount: count() })
            .from(cafeVisits)
            .where(and(eq(cafeVisits.userId, userId), eq(cafeVisits.cafeId, cafeId)))
            .groupBy(cafeVisits.cafeId)
        : db
            .select({ cafeId: cafeVisits.cafeId, visitCount: count() })
            .from(cafeVisits)
            .where(eq(cafeVisits.userId, userId))
            .groupBy(cafeVisits.cafeId)

    const visitCounts = await query

    // Define thresholds
    const visitThresholds = [
        { count: 5, badge: BADGE_NAMES.REGULAR },
        { count: 10, badge: BADGE_NAMES.LOYAL_CUSTOMER },
    ]

    for (const threshold of visitThresholds) {
        // Check if any cafe has enough visits
        const qualifies = visitCounts.some(vc => vc.visitCount >= threshold.count)

        if (qualifies) {
            const badgeId = await getBadgeIdByName(threshold.badge)
            if (badgeId && !(await userHasBadge(userId, badgeId))) {
                if (await awardBadge(userId, badgeId)) {
                    awardedBadges.push(threshold.badge)
                }
            }
        }
    }

    return awardedBadges
}

// ============================================
// Main Badge Check Function
// ============================================

export interface BadgeTriggers {
    scout?: boolean
    reviews?: boolean
    geographic?: boolean
    supporter?: boolean
    map?: boolean
    visits?: boolean
    cafeId?: string // Optional: specific cafe to check for visit badges
}

/**
 * Check and award badges to a user based on their activity
 * @param userId - The user ID to check badges for
 * @param triggers - Optional object to specify which badge types to check.
 *                   If not provided, checks all applicable badges.
 * @returns Array of badge names that were awarded
 */
export async function checkAndAwardBadges(
    userId: string,
    triggers?: BadgeTriggers
): Promise<string[]> {
    const awardedBadges: string[] = []

    try {
        // Default to checking scout and geographic if no triggers specified
        const shouldCheckScout = triggers?.scout ?? true
        const shouldCheckReviews = triggers?.reviews ?? false
        const shouldCheckGeographic = triggers?.geographic ?? true
        const shouldCheckSupporter = triggers?.supporter ?? false
        const shouldCheckMap = triggers?.map ?? false

        if (shouldCheckScout) {
            const badges = await checkScoutBadges(userId)
            awardedBadges.push(...badges)
        }

        if (shouldCheckReviews) {
            const badges = await checkReviewBadges(userId)
            awardedBadges.push(...badges)
        }

        if (shouldCheckGeographic) {
            const badges = await checkGeographicBadges(userId)
            awardedBadges.push(...badges)
        }

        if (shouldCheckSupporter) {
            const badges = await checkSupporterBadge(userId)
            awardedBadges.push(...badges)
        }

        if (shouldCheckMap) {
            // Map badge is handled separately via trackMapUsage()
            // This is just a placeholder for future expansion
        }

        // Check visit badges
        if (triggers?.visits) {
            const badges = await checkVisitBadges(userId, triggers.cafeId)
            awardedBadges.push(...badges)
        }

        if (awardedBadges.length > 0) {
            console.log(`[Badge] User ${userId} earned badges:`, awardedBadges)
        }
    } catch (error) {
        console.error(`[Badge] Error checking badges for user ${userId}:`, error)
    }

    return awardedBadges
}

/**
 * Track map usage and award Eye Spy badge
 * Should be called when user interacts with map feature
 */
export async function trackMapUsage(): Promise<{ awarded: boolean; badgeName?: string; error?: string }> {
    const user = await getCurrentUser()
    if (!user) {
        return { awarded: false, error: "Not authenticated" }
    }

    try {
        const badgeId = await getBadgeIdByName(BADGE_NAMES.EYE_SPY)
        if (!badgeId) {
            return { awarded: false, error: "Badge not found" }
        }

        // Check if user already has this badge
        if (await userHasBadge(user.id, badgeId)) {
            return { awarded: false } // Already has badge, no error
        }

        // Award badge
        const success = await awardBadge(user.id, badgeId)
        return { awarded: success, badgeName: BADGE_NAMES.EYE_SPY }
    } catch (error) {
        console.error("[Badge] Error tracking map usage:", error)
        return { awarded: false, error: "Failed to track map usage" }
    }
}


// ============================================
// Badge Backfill Function (Admin Only)
// ============================================

/**
 * Backfill badges for all existing users
 * Checks scout, review, geographic, and supporter badges for each user
 * This is an admin-only operation for one-time badge backfill
 */
export async function backfillBadgesForAllUsers(): Promise<{
    success: boolean
    usersProcessed: number
    badgesAwarded: number
    errors: string[]
}> {
    const user = await getCurrentUser()
    if (!user) {
        return { success: false, usersProcessed: 0, badgesAwarded: 0, errors: ["Not authenticated"] }
    }

    // Verify admin access
    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, user.id))
        .limit(1)

    if (profileResult[0]?.role !== "admin") {
        return { success: false, usersProcessed: 0, badgesAwarded: 0, errors: ["Unauthorized - Admin only"] }
    }

    // Get all user IDs
    const allProfiles = await db
        .select({ id: profiles.id })
        .from(profiles)

    if (!allProfiles || allProfiles.length === 0) {
        return {
            success: false,
            usersProcessed: 0,
            badgesAwarded: 0,
            errors: ["Failed to fetch users"],
        }
    }

    let usersProcessed = 0
    let totalBadgesAwarded = 0
    const errors: string[] = []

    console.log(`[Badge Backfill] Starting backfill for ${allProfiles.length} users...`)

    for (const userProfile of allProfiles) {
        try {
            // Check all badge types for this user
            const awardedBadges = await checkAndAwardBadges(userProfile.id, {
                scout: true,
                reviews: true,
                geographic: true,
                supporter: true,
            })

            totalBadgesAwarded += awardedBadges.length
            usersProcessed++

            if (awardedBadges.length > 0) {
                console.log(`[Badge Backfill] User ${userProfile.id} earned: ${awardedBadges.join(", ")}`)
            }
        } catch (error) {
            const errorMsg = `Error processing user ${userProfile.id}: ${error}`
            console.error(`[Badge Backfill] ${errorMsg}`)
            errors.push(errorMsg)
        }
    }

    console.log(
        `[Badge Backfill] Complete. Processed ${usersProcessed} users, awarded ${totalBadgesAwarded} badges.`
    )

    return {
        success: true,
        usersProcessed,
        badgesAwarded: totalBadgesAwarded,
        errors,
    }
}
