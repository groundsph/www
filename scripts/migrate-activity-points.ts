'use server'

/**
 * Migration script to calculate activity points for all existing users
 * Run this once after deploying the activity points system
 * 
 * Usage: bun run scripts/migrate-activity-points.ts
 */

import { db } from "@/db"
import { profiles, cafes, reviews, contributionLogs } from "@/db/schema"
import { eq, and, or, count as drizzleCount } from "drizzle-orm"

// Activity point values (must match admin.ts)
const ACTIVITY_POINTS = {
    CAFE_SUBMITTED: 10,
    REVIEW_WRITTEN: 5,
    EDIT_CONTRIBUTION: 3,
    CAFE_VISITED: 1,
} as const

// Scout rank thresholds (must match admin.ts)
type ScoutRank = 'novice' | 'scout' | 'explorer' | 'expert' | 'vanguard' | 'legend'
const RANK_THRESHOLDS: { rank: ScoutRank; minPoints: number }[] = [
    { rank: 'legend', minPoints: 300 },
    { rank: 'vanguard', minPoints: 150 },
    { rank: 'expert', minPoints: 75 },
    { rank: 'explorer', minPoints: 30 },
    { rank: 'scout', minPoints: 10 },
    { rank: 'novice', minPoints: 0 },
]

function calculateScoutRank(activityPoints: number): ScoutRank {
    for (const { rank, minPoints } of RANK_THRESHOLDS) {
        if (activityPoints >= minPoints) return rank
    }
    return 'novice'
}

interface ProfileStats {
    scout_rank: ScoutRank
    activity_points: number
    total_photos: number
    total_reviews: number
    total_scouted: number
}

async function migrateActivityPoints() {
    console.log("🚀 Starting activity points migration...")

    // Get all profiles
    const allProfiles = await db.select({
        id: profiles.id,
        stats: profiles.stats,
        passport: profiles.passport,
    }).from(profiles)

    console.log(`Found ${allProfiles.length} profiles to process`)

    let updated = 0
    let errors = 0

    for (const profile of allProfiles) {
        try {
            // Count published cafes
            const cafeCountResult = await db
                .select({ count: drizzleCount() })
                .from(cafes)
                .where(and(
                    eq(cafes.contributorId, profile.id),
                    eq(cafes.isPublished, true)
                ))
            const totalScouted = cafeCountResult[0]?.count ?? 0

            // Count reviews
            const reviewCountResult = await db
                .select({ count: drizzleCount() })
                .from(reviews)
                .where(eq(reviews.userId, profile.id))
            const totalReviews = reviewCountResult[0]?.count ?? 0

            // Count contribution logs (edits)
            const editCountResult = await db
                .select({ count: drizzleCount() })
                .from(contributionLogs)
                .where(and(
                    eq(contributionLogs.userId, profile.id),
                    or(
                        eq(contributionLogs.actionType, 'UPDATE'),
                        eq(contributionLogs.actionType, 'SUGGEST'),
                        eq(contributionLogs.actionType, 'MEDIA')
                    )
                ))
            const totalEdits = editCountResult[0]?.count ?? 0

            // Count visits from passport
            const passport = profile.passport as { visited_ids?: string[]; visits?: { cafe_id: string }[] } | null
            const visitedIds = passport?.visited_ids ?? []
            const visits = passport?.visits ?? []
            const totalVisits = Math.max(visitedIds.length, visits.length)

            // Calculate total points
            const totalPoints =
                (totalScouted * ACTIVITY_POINTS.CAFE_SUBMITTED) +
                (totalReviews * ACTIVITY_POINTS.REVIEW_WRITTEN) +
                (totalEdits * ACTIVITY_POINTS.EDIT_CONTRIBUTION) +
                (totalVisits * ACTIVITY_POINTS.CAFE_VISITED)

            const newRank = calculateScoutRank(totalPoints)

            // Get current stats or create default
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

            // Update profile
            await db.update(profiles)
                .set({ stats: updatedStats })
                .where(eq(profiles.id, profile.id))

            updated++

            if (totalPoints > 0) {
                console.log(`  ✓ ${profile.id.slice(0, 8)}... → ${totalPoints} pts (${newRank})`)
            }
        } catch (error) {
            errors++
            console.error(`  ✗ Error processing ${profile.id}:`, error)
        }
    }

    console.log(`\n✅ Migration complete!`)
    console.log(`   Updated: ${updated}`)
    console.log(`   Errors: ${errors}`)
}

migrateActivityPoints()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Migration failed:", err)
        process.exit(1)
    })
