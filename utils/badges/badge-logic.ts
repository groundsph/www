"use server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"

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
} as const

// ============================================
// Badge Checking Logic
// ============================================



/**
 * Get badge definition ID by name
 */
async function getBadgeIdByName(
    db: Awaited<ReturnType<typeof createClient>>,
    name: string
): Promise<string | null> {
    const { data } = await db
        .from("badge_definitions")
        .select("id")
        .eq("name", name)
        .single()

    return data?.id || null
}

/**
 * Check if user already has a specific badge
 */
async function userHasBadge(
    db: Awaited<ReturnType<typeof createClient>>,
    userId: string,
    badgeId: string
): Promise<boolean> {
    const { data } = await db
        .from("user_badges")
        .select("id")
        .eq("user_id", userId)
        .eq("badge_id", badgeId)
        .single()

    return !!data
}

/**
 * Award a badge to a user (internal helper)
 */
async function awardBadge(
    adminDb: Awaited<ReturnType<typeof createAdminClient>>,
    userId: string,
    badgeId: string
): Promise<boolean> {
    const { error } = await adminDb.from("user_badges").insert({
        user_id: userId,
        badge_id: badgeId,
        awarded_at: new Date().toISOString(),
    })

    if (error) {
        console.error(`[Badge] Failed to award badge ${badgeId} to ${userId}:`, error)
        return false
    }

    console.log(`[Badge] Awarded badge ${badgeId} to user ${userId}`)
    return true
}

/**
 * Check scouting badges (Scout, Explorer, Pathfinder)
 * Based on number of published cafes contributed by user
 */
async function checkScoutBadges(
    db: Awaited<ReturnType<typeof createClient>>,
    adminDb: Awaited<ReturnType<typeof createAdminClient>>,
    userId: string
): Promise<string[]> {
    const awardedBadges: string[] = []

    // Count published cafes contributed by this user
    const { count } = await db
        .from("cafes")
        .select("id", { count: "exact", head: true })
        .eq("contributor_id", userId)
        .eq("is_published", true)

    const scoutedCount = count || 0

    // Define thresholds
    const scoutThresholds = [
        { count: 5, badge: BADGE_NAMES.SCOUT },
        { count: 10, badge: BADGE_NAMES.EXPLORER },
        { count: 20, badge: BADGE_NAMES.PATHFINDER },
    ]

    for (const threshold of scoutThresholds) {
        if (scoutedCount >= threshold.count) {
            const badgeId = await getBadgeIdByName(db, threshold.badge)
            if (badgeId && !(await userHasBadge(db, userId, badgeId))) {
                if (await awardBadge(adminDb, userId, badgeId)) {
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
async function checkReviewBadges(
    db: Awaited<ReturnType<typeof createClient>>,
    adminDb: Awaited<ReturnType<typeof createAdminClient>>,
    userId: string
): Promise<string[]> {
    const awardedBadges: string[] = []

    // Count published reviews by this user
    const { count } = await db
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "published")

    const reviewCount = count || 0

    if (reviewCount >= 5) {
        const badgeId = await getBadgeIdByName(db, BADGE_NAMES.CONNOISSEUR)
        if (badgeId && !(await userHasBadge(db, userId, badgeId))) {
            if (await awardBadge(adminDb, userId, badgeId)) {
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
async function checkGeographicBadges(
    db: Awaited<ReturnType<typeof createClient>>,
    adminDb: Awaited<ReturnType<typeof createAdminClient>>,
    userId: string
): Promise<string[]> {
    const awardedBadges: string[] = []

    // Get distinct regions from cafes the user has reviewed
    const { data: reviews } = await db
        .from("reviews")
        .select(`
            cafe:cafes(region)
        `)
        .eq("user_id", userId)
        .eq("status", "published")

    if (!reviews || reviews.length === 0) {
        return awardedBadges
    }

    // Map regions to island groups
    const islandGroups = new Set<IslandGroup>()
    for (const review of reviews) {
        // Supabase relational query type
        const cafe = review.cafe as { region: string } | null
        if (cafe?.region) {
            const group = getIslandGroup(cafe.region)
            if (group) {
                islandGroups.add(group)
            }
        }
    }

    // Island Hopper: 2+ different island groups
    if (islandGroups.size >= 2) {
        const badgeId = await getBadgeIdByName(db, BADGE_NAMES.ISLAND_HOPPER)
        if (badgeId && !(await userHasBadge(db, userId, badgeId))) {
            if (await awardBadge(adminDb, userId, badgeId)) {
                awardedBadges.push(BADGE_NAMES.ISLAND_HOPPER)
            }
        }
    }

    // Kape-ng Pambansa: All 3 island groups
    if (islandGroups.size >= 3) {
        const badgeId = await getBadgeIdByName(db, BADGE_NAMES.KAPE_NG_PAMBANSA)
        if (badgeId && !(await userHasBadge(db, userId, badgeId))) {
            if (await awardBadge(adminDb, userId, badgeId)) {
                awardedBadges.push(BADGE_NAMES.KAPE_NG_PAMBANSA)
            }
        }
    }

    return awardedBadges
}

/**
 * Check supporter badge
 */
async function checkSupporterBadge(
    db: Awaited<ReturnType<typeof createClient>>,
    adminDb: Awaited<ReturnType<typeof createAdminClient>>,
    userId: string
): Promise<string[]> {
    const awardedBadges: string[] = []

    const { data: profile } = await db
        .from("profiles")
        .select("is_supporter")
        .eq("id", userId)
        .single()

    if (profile?.is_supporter) {
        const badgeId = await getBadgeIdByName(db, BADGE_NAMES.GROUNDS_SUPPORTER)
        if (badgeId && !(await userHasBadge(db, userId, badgeId))) {
            if (await awardBadge(adminDb, userId, badgeId)) {
                awardedBadges.push(BADGE_NAMES.GROUNDS_SUPPORTER)
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
    const db = await createClient()
    const adminDb = await createAdminClient()

    const awardedBadges: string[] = []

    try {
        // Default to checking scout and geographic if no triggers specified
        const shouldCheckScout = triggers?.scout ?? true
        const shouldCheckReviews = triggers?.reviews ?? false
        const shouldCheckGeographic = triggers?.geographic ?? true
        const shouldCheckSupporter = triggers?.supporter ?? false
        const shouldCheckMap = triggers?.map ?? false

        if (shouldCheckScout) {
            const badges = await checkScoutBadges(db, adminDb, userId)
            awardedBadges.push(...badges)
        }

        if (shouldCheckReviews) {
            const badges = await checkReviewBadges(db, adminDb, userId)
            awardedBadges.push(...badges)
        }

        if (shouldCheckGeographic) {
            const badges = await checkGeographicBadges(db, adminDb, userId)
            awardedBadges.push(...badges)
        }

        if (shouldCheckSupporter) {
            const badges = await checkSupporterBadge(db, adminDb, userId)
            awardedBadges.push(...badges)
        }

        if (shouldCheckMap) {
            // Map badge is handled separately via trackMapUsage()
            // This is just a placeholder for future expansion
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
 * Should be called when user interacts with the map feature
 */
export async function trackMapUsage(): Promise<{ awarded: boolean; error?: string }> {
    const db = await createClient()

    // Get current user
    const {
        data: { user },
    } = await db.auth.getUser()
    if (!user) {
        return { awarded: false, error: "Not authenticated" }
    }

    try {
        const badgeId = await getBadgeIdByName(db, BADGE_NAMES.EYE_SPY)
        if (!badgeId) {
            return { awarded: false, error: "Badge not found" }
        }

        // Check if user already has this badge
        if (await userHasBadge(db, user.id, badgeId)) {
            return { awarded: false } // Already has badge, no error
        }

        // Award the badge
        const adminDb = await createAdminClient()
        const success = await awardBadge(adminDb, user.id, badgeId)

        return { awarded: success }
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
    const db = await createClient()

    // Verify admin access
    const {
        data: { user },
    } = await db.auth.getUser()
    if (!user) {
        return { success: false, usersProcessed: 0, badgesAwarded: 0, errors: ["Not authenticated"] }
    }

    const { data: profile } = await db
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

    if (profile?.role !== "admin") {
        return { success: false, usersProcessed: 0, badgesAwarded: 0, errors: ["Unauthorized - Admin only"] }
    }

    const adminDb = await createAdminClient()

    // Get all user IDs
    const { data: profiles, error: fetchError } = await adminDb
        .from("profiles")
        .select("id")

    if (fetchError || !profiles) {
        return {
            success: false,
            usersProcessed: 0,
            badgesAwarded: 0,
            errors: [`Failed to fetch users: ${fetchError?.message}`],
        }
    }

    let usersProcessed = 0
    let totalBadgesAwarded = 0
    const errors: string[] = []

    console.log(`[Badge Backfill] Starting backfill for ${profiles.length} users...`)

    for (const userProfile of profiles) {
        try {
            // Check all badge types for this user
            const awardedBadges = await checkAndAwardBadgesInternal(
                db,
                adminDb,
                userProfile.id,
                {
                    scout: true,
                    reviews: true,
                    geographic: true,
                    supporter: true,
                }
            )

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

/**
 * Internal badge check function that accepts db clients as parameters
 * Used by both regular checks and backfill
 */
async function checkAndAwardBadgesInternal(
    db: Awaited<ReturnType<typeof createClient>>,
    adminDb: Awaited<ReturnType<typeof createAdminClient>>,
    userId: string,
    triggers: BadgeTriggers
): Promise<string[]> {
    const awardedBadges: string[] = []

    try {
        if (triggers.scout) {
            const badges = await checkScoutBadges(db, adminDb, userId)
            awardedBadges.push(...badges)
        }

        if (triggers.reviews) {
            const badges = await checkReviewBadges(db, adminDb, userId)
            awardedBadges.push(...badges)
        }

        if (triggers.geographic) {
            const badges = await checkGeographicBadges(db, adminDb, userId)
            awardedBadges.push(...badges)
        }

        if (triggers.supporter) {
            const badges = await checkSupporterBadge(db, adminDb, userId)
            awardedBadges.push(...badges)
        }
    } catch (error) {
        console.error(`[Badge] Error in internal check for user ${userId}:`, error)
    }

    return awardedBadges
}

