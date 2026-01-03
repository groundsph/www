'use server'

/**
 * Migration script to migrate existing passport visits to the new cafe_visits table
 * Run this once after deploying the cafe_visits table
 * 
 * Usage: bun run scripts/migrate-visits-data.ts
 * Dry run: bun run scripts/migrate-visits-data.ts --dry-run
 */

import { db } from "@/db"
import { profiles, cafeVisits, cafes } from "@/db/schema"
import { eq, inArray } from "drizzle-orm"

interface PassportVisit {
    cafe_id: string
    visited_at: string
}

interface ProfilePassport {
    visited_ids?: string[]
    visits?: PassportVisit[]
    wishlist_ids?: string[]
    favorite_ids?: string[]
}

async function migrateVisitsData() {
    const isDryRun = process.argv.includes('--dry-run')

    if (isDryRun) {
        console.log("🔍 DRY RUN MODE - No changes will be made\n")
    }

    console.log("🚀 Starting visits data migration...")

    // Get all profiles with passport data
    const allProfiles = await db.select({
        id: profiles.id,
        passport: profiles.passport,
        createdAt: profiles.createdAt,
    }).from(profiles)

    console.log(`Found ${allProfiles.length} profiles to check\n`)

    // Get all valid cafe IDs for validation
    const validCafes = await db.select({ id: cafes.id }).from(cafes)
    const validCafeIds = new Set(validCafes.map(c => c.id))
    console.log(`Found ${validCafeIds.size} valid cafes\n`)

    let totalMigrated = 0
    let totalSkipped = 0
    let totalInvalidCafes = 0
    let errors = 0

    for (const profile of allProfiles) {
        const passport = profile.passport as ProfilePassport | null
        if (!passport) continue

        const visitedIds = passport.visited_ids ?? []
        const visits = passport.visits ?? []

        if (visitedIds.length === 0 && visits.length === 0) continue

        // Build a map of cafe_id -> visited_at from the visits array
        const visitDatesMap = new Map<string, string>()
        for (const visit of visits) {
            visitDatesMap.set(visit.cafe_id, visit.visited_at)
        }

        // Collect all unique cafe IDs from both sources
        const allCafeIds = [...new Set([...visitedIds, ...visits.map(v => v.cafe_id)])]

        for (const cafeId of allCafeIds) {
            // Validate that cafe exists
            if (!validCafeIds.has(cafeId)) {
                totalInvalidCafes++
                continue
            }

            // Get the visited_at date, or fall back to profile creation date
            const visitedAt = visitDatesMap.get(cafeId) ?? profile.createdAt?.toISOString() ?? new Date().toISOString()

            if (isDryRun) {
                console.log(`  Would insert: user=${profile.id.slice(0, 8)}..., cafe=${cafeId.slice(0, 8)}..., visited_at=${visitedAt}`)
                totalMigrated++
            } else {
                try {
                    // Check if record already exists (in case of re-run)
                    const existing = await db.select({ id: cafeVisits.id })
                        .from(cafeVisits)
                        .where(
                            eq(cafeVisits.userId, profile.id),
                        )
                        .limit(1)

                    // For existing users, we'll check if they already have a visit for this cafe
                    const existingForCafe = existing.length > 0 ? await db.select({ id: cafeVisits.id })
                        .from(cafeVisits)
                        .where(eq(cafeVisits.userId, profile.id))
                        .then(records => records.some(r => r.id === cafeId))
                        : false

                    if (existingForCafe) {
                        totalSkipped++
                        continue
                    }

                    await db.insert(cafeVisits).values({
                        userId: profile.id,
                        cafeId: cafeId,
                        visitedAt: new Date(visitedAt),
                    })

                    totalMigrated++
                } catch (error) {
                    // Unique constraint violation means record already exists
                    if (String(error).includes('unique constraint')) {
                        totalSkipped++
                    } else {
                        errors++
                        console.error(`  ✗ Error migrating visit for user ${profile.id.slice(0, 8)}..., cafe ${cafeId.slice(0, 8)}...:`, error)
                    }
                }
            }
        }
    }

    console.log(`\n✅ Migration ${isDryRun ? 'preview' : 'complete'}!`)
    console.log(`   Migrated: ${totalMigrated}`)
    console.log(`   Skipped (already exists): ${totalSkipped}`)
    console.log(`   Invalid cafes (not found): ${totalInvalidCafes}`)
    console.log(`   Errors: ${errors}`)

    if (isDryRun) {
        console.log(`\n💡 Run without --dry-run to apply changes`)
    }
}

migrateVisitsData()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Migration failed:", err)
        process.exit(1)
    })
