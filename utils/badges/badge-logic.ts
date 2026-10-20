// Server-side badge engine.
//
// NOTE: this module must NOT carry a "use server" directive. A "use server"
// module turns *every* export into a client-callable server action, which would
// expose `checkAndAwardBadges(userId)` and `backfillBadgesForAllUsers()` to any
// browser session. The badge logic lives here as plain server code; the
// client-callable entrypoints live in `app/api/actions/badges.ts`.

import { db } from "@/db"
import {
    profiles,
    cafes,
    reviews,
    badgeDefinitions,
    userBadges,
    cafeVisits,
} from "@/db/schema"
import { eq, and, count, inArray } from "drizzle-orm"

import { getIslandGroupsFromRegions } from "@/utils/badges/island-groups"
import type { IslandGroup } from "@/utils/badges/island-groups"
import {
    BADGE_NAMES,
    CONNOISSEUR_THRESHOLD,
    getGeographicBadgesForGroups,
    SCOUT_THRESHOLDS,
    VISIT_THRESHOLDS,
} from "@/utils/badges/badge-catalog"
import type { ProfilePassport } from "@/utils/types/extra"

// Re-exported so existing call sites keep importing the catalogue from here.
export {
    BADGE_NAMES,
    CONNOISSEUR_THRESHOLD,
    ISLAND_GROUP_THRESHOLDS,
    SCOUT_THRESHOLDS,
    VISIT_THRESHOLDS,
    getGeographicBadgesForGroups,
} from "@/utils/badges/badge-catalog"
export type { BadgeName } from "@/utils/badges/badge-catalog"

// ============================================
// Small primitives
// ============================================

/**
 * Get badge definition ID by name
 */
export async function getBadgeIdByName(name: string): Promise<string | null> {
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
export async function userHasBadge(userId: string, badgeId: string): Promise<boolean> {
    const result = await db
        .select({ id: userBadges.id })
        .from(userBadges)
        .where(and(eq(userBadges.userId, userId), eq(userBadges.badgeId, badgeId)))
        .limit(1)

    return result.length > 0
}

/**
 * Award a badge to a user (internal helper).
 * Returns true only when this call actually created the award.
 */
async function awardBadge(userId: string, badgeId: string): Promise<boolean> {
    try {
        const inserted = await db
            .insert(userBadges)
            .values({ userId, badgeId, awardedAt: new Date() })
            .onConflictDoNothing({
                target: [userBadges.userId, userBadges.badgeId],
            })
            .returning({ id: userBadges.id })

        if (inserted.length === 0) return false

        console.log(`[Badge] Awarded badge ${badgeId} to user ${userId}`)
        return true
    } catch (error) {
        console.error(`[Badge] Failed to award badge ${badgeId} to user ${userId}:`, error)
        return false
    }
}

/**
 * Resolve a badge name and award it when the user does not have it yet.
 * Keeps the per-rule code below short and consistently guarded.
 */
async function grantIfEligible(userId: string, name: string): Promise<boolean> {
    const badgeId = await getBadgeIdByName(name)
    if (!badgeId) {
        console.warn(`[Badge] Badge definition missing for "${name}" — skipping award`)
        return false
    }
    if (await userHasBadge(userId, badgeId)) return false
    return awardBadge(userId, badgeId)
}

// ============================================
// Geographic progress
// ============================================

export interface GeographicProgress {
    /** Every distinct region the user has set foot in (visits, passport, reviews). */
    regions: string[]
    /** Island groups covered by those regions. */
    islandGroups: IslandGroup[]
    /** Island groups still missing, useful for "X of 3" progress copy. */
    missingIslandGroups: IslandGroup[]
}

/**
 * Collect every region the user has interacted with.
 *
 * The app records "I have been to this cafe" in three places and any one of
 * them counts as a visit:
 *   1. `cafe_visits` — the check-in ledger (authoritative going forward)
 *   2. `profiles.passport.visited_ids` — legacy passport data, plus cafes that
 *      were imported for the user by `scripts/migrate-visits-data.ts`
 *   3. `reviews` — writing a review implies you were there
 *
 * Geographic badges used to look at reviews only, so anyone who checked in
 * without reviewing never unlocked Island Hopper / Kape-ng Pambansa.
 */
export async function getVisitedRegions(userId: string): Promise<string[]> {
    const [visitRows, reviewRows, passportResult] = await Promise.all([
        db
            .selectDistinct({ region: cafes.region })
            .from(cafeVisits)
            .innerJoin(cafes, eq(cafeVisits.cafeId, cafes.id))
            .where(eq(cafeVisits.userId, userId)),
        db
            .selectDistinct({ region: cafes.region })
            .from(reviews)
            .innerJoin(cafes, eq(reviews.cafeId, cafes.id))
            .where(and(eq(reviews.userId, userId), eq(reviews.status, "published"))),
        db
            .select({ passport: profiles.passport })
            .from(profiles)
            .where(eq(profiles.id, userId))
            .limit(1),
    ])

    const visitedIds = (passportResult[0]?.passport as ProfilePassport | null)?.visited_ids ?? []

    let passportRows: { region: string }[] = []
    if (visitedIds.length > 0) {
        passportRows = await db
            .selectDistinct({ region: cafes.region })
            .from(cafes)
            .where(inArray(cafes.id, visitedIds))
    }

    const regions = new Set<string>()
    for (const row of [...visitRows, ...reviewRows, ...passportRows]) {
        if (row.region) regions.add(row.region)
    }

    return Array.from(regions)
}

/**
 * Island-group coverage for a user. Exported so profiles, admin tooling and
 * tests can reason about progress without duplicating the travel model.
 */
export async function getGeographicProgress(userId: string): Promise<GeographicProgress> {
    const regions = await getVisitedRegions(userId)
    const groups = getIslandGroupsFromRegions(regions)
    const allGroups: IslandGroup[] = ["luzon", "visayas", "mindanao"]

    return {
        regions,
        islandGroups: allGroups.filter((group) => groups.has(group)),
        missingIslandGroups: allGroups.filter((group) => !groups.has(group)),
    }
}

// ============================================
// Per-category checks
// ============================================

/**
 * Check scouting badges (Scout, Explorer, Pathfinder)
 * Based on number of published cafes contributed by user
 */
export async function checkScoutBadges(userId: string): Promise<string[]> {
    const awardedBadges: string[] = []

    const result = await db
        .select({ count: count() })
        .from(cafes)
        .where(and(eq(cafes.contributorId, userId), eq(cafes.isPublished, true)))

    const scoutedCount = result[0]?.count || 0

    for (const threshold of SCOUT_THRESHOLDS) {
        if (scoutedCount >= threshold.count && (await grantIfEligible(userId, threshold.badge))) {
            awardedBadges.push(threshold.badge)
        }
    }

    return awardedBadges
}

/**
 * Check review badges (Connoisseur)
 * Based on number of published reviews by user
 */
export async function checkReviewBadges(userId: string): Promise<string[]> {
    const awardedBadges: string[] = []

    const result = await db
        .select({ count: count() })
        .from(reviews)
        .where(and(eq(reviews.userId, userId), eq(reviews.status, "published")))

    const reviewCount = result[0]?.count || 0

    if (
        reviewCount >= CONNOISSEUR_THRESHOLD &&
        (await grantIfEligible(userId, BADGE_NAMES.CONNOISSEUR))
    ) {
        awardedBadges.push(BADGE_NAMES.CONNOISSEUR)
    }

    return awardedBadges
}

/**
 * Check geographic badges (Island Hopper, Kape-ng Pambansa)
 * Based on the island groups of every cafe the user has visited.
 */
export async function checkGeographicBadges(userId: string): Promise<string[]> {
    const awardedBadges: string[] = []
    const { islandGroups } = await getGeographicProgress(userId)

    for (const badge of getGeographicBadgesForGroups(islandGroups)) {
        if (await grantIfEligible(userId, badge)) {
            awardedBadges.push(badge)
        }
    }

    return awardedBadges
}

/**
 * Check supporter badge
 */
export async function checkSupporterBadge(userId: string): Promise<string[]> {
    const awardedBadges: string[] = []

    const result = await db
        .select({ isSupporter: profiles.isSupporter })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1)

    if (result[0]?.isSupporter && (await grantIfEligible(userId, BADGE_NAMES.GROUNDS_SUPPORTER))) {
        awardedBadges.push(BADGE_NAMES.GROUNDS_SUPPORTER)
    }

    return awardedBadges
}

/**
 * Check visit badges (Regular, Loyal Customer)
 * Based on number of visits to the same cafe
 * @param userId - The user ID to check
 * @param cafeId - Optional specific cafe ID to check (for targeted checks after check-in)
 */
export async function checkVisitBadges(userId: string, cafeId?: string): Promise<string[]> {
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

    for (const threshold of VISIT_THRESHOLDS) {
        // Check if any cafe has enough visits
        const qualifies = visitCounts.some(vc => vc.visitCount >= threshold.count)

        if (qualifies && (await grantIfEligible(userId, threshold.badge))) {
            awardedBadges.push(threshold.badge)
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
 * Check and award badges to a user based on their activity.
 *
 * Every trigger defaults to `false` so a targeted call (e.g. after a check-in)
 * never pays for unrelated queries. Pass `{}` to run the full sweep.
 *
 * @param userId - The user ID to check badges for
 * @param triggers - Which badge families to evaluate
 * @returns Array of badge names that were awarded
 */
export async function checkAndAwardBadges(
    userId: string,
    triggers: BadgeTriggers = {}
): Promise<string[]> {
    const awardedBadges: string[] = []

    try {
        if (triggers.scout) {
            awardedBadges.push(...(await checkScoutBadges(userId)))
        }

        if (triggers.reviews) {
            awardedBadges.push(...(await checkReviewBadges(userId)))
        }

        if (triggers.geographic) {
            awardedBadges.push(...(await checkGeographicBadges(userId)))
        }

        if (triggers.supporter) {
            awardedBadges.push(...(await checkSupporterBadge(userId)))
        }

        if (triggers.visits) {
            awardedBadges.push(...(await checkVisitBadges(userId, triggers.cafeId)))
        }

        // Map badge is awarded via the `trackMapUsage` server action.
        if (triggers.map) {
            // Reserved for future expansion.
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
 * Award the Eye Spy badge for map usage.
 * Internal helper — the client-callable wrapper lives in app/api/actions/badges.ts.
 */
export async function awardMapUsageBadge(
    userId: string
): Promise<{ awarded: boolean; badgeName?: string; error?: string }> {
    try {
        const badgeId = await getBadgeIdByName(BADGE_NAMES.EYE_SPY)
        if (!badgeId) {
            return { awarded: false, error: "Badge not found" }
        }

        if (await userHasBadge(userId, badgeId)) {
            return { awarded: false } // Already has badge, no error
        }

        const success = await awardBadge(userId, badgeId)
        return { awarded: success, badgeName: BADGE_NAMES.EYE_SPY }
    } catch (error) {
        console.error("[Badge] Error tracking map usage:", error)
        return { awarded: false, error: "Failed to track map usage" }
    }
}

// ============================================
// Backfill (admin)
// ============================================

export interface BadgeBackfillResult {
    success: boolean
    usersProcessed: number
    badgesAwarded: number
    errors: string[]
}

/**
 * Backfill badges for all existing users.
 *
 * Safe to re-run: every award is guarded by the unique
 * (`user_id`, `badge_id`) index, so only genuinely missing badges are added.
 * Covers the visit + geographic families too, which is what repairs accounts
 * that checked in before those rules looked at check-ins.
 */
export async function backfillBadgesForAllUsersInternal(): Promise<BadgeBackfillResult> {
    const allProfiles = await db.select({ id: profiles.id }).from(profiles)

    if (!allProfiles || allProfiles.length === 0) {
        return { success: false, usersProcessed: 0, badgesAwarded: 0, errors: ["No profiles found"] }
    }

    let usersProcessed = 0
    let totalBadgesAwarded = 0
    const errors: string[] = []

    console.log(`[Badge Backfill] Starting backfill for ${allProfiles.length} users...`)

    for (const userProfile of allProfiles) {
        try {
            const awardedBadges = await checkAndAwardBadges(userProfile.id, {
                scout: true,
                reviews: true,
                geographic: true,
                supporter: true,
                visits: true,
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
