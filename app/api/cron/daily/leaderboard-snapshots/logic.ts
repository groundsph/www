import { getMonthlyLeaderboard } from "@/app/api/actions/profile"
import { getCafeMonthlyLeaderboard } from "@/app/api/actions/leaderboard"
import { db } from "@/db"
import { monthlyLeaderboardSnapshots } from "@/db/schema"
import { eq, and, isNull } from "drizzle-orm"
import { currentMonthKey, getLastNMonths } from "@/utils/date/leaderboard-months"
import { PH_REGIONS } from "@/utils/ph-regions"

export interface LeaderboardSnapshotsResult {
    success: boolean
    message: string
    yearMonth: string
    summary: {
        userCount: number
        cafeCount: number
        regionsSnapshotted: number
        regionNames: string[]
    }
}

/**
 * The month a daily run snapshots: the one that just ended on the Manila
 * calendar.
 *
 * Derived in Manila on purpose. The previous implementation built a local `Date`
 * and subtracted a month, which on a UTC server pointed at the wrong month for
 * the first eight hours of every month — the window in which the cron normally
 * runs.
 */
function previousMonthKey(): string {
    // getLastNMonths is newest-first, so index 1 is the month before this one.
    return getLastNMonths(2, new Date())[1] ?? currentMonthKey()
}

/** Has this exact slice — this month, this type, this region — been written? */
async function sliceExists(
    yearMonth: string,
    type: "user" | "cafe",
    region: string | null
): Promise<boolean> {
    const existing = await db
        .select({ id: monthlyLeaderboardSnapshots.id })
        .from(monthlyLeaderboardSnapshots)
        .where(
            and(
                eq(monthlyLeaderboardSnapshots.yearMonth, yearMonth),
                eq(monthlyLeaderboardSnapshots.type, type),
                region
                    ? eq(monthlyLeaderboardSnapshots.region, region)
                    : isNull(monthlyLeaderboardSnapshots.region)
            )
        )
        .limit(1)

    return existing.length > 0
}

/**
 * Snapshot monthly leaderboard data for users and cafes.
 *
 * This is the only writer of `monthly_leaderboard_snapshots`. Reads compute live
 * and never insert, which is what stops a month being written twice.
 *
 * Idempotency is per (type, month, region): a run that only managed the global
 * user slice last time still has to do the cafes and every region, so the guard
 * cannot be "anything exists for this month" — that is what silently skipped
 * every cafe snapshot whenever one region's users had already been written.
 */
export async function runLeaderboardSnapshots(): Promise<LeaderboardSnapshotsResult> {
    const yearMonth = previousMonthKey()

    console.log(`[Leaderboard Snapshot Cron] Starting snapshot for ${yearMonth}...`)

    // null is the global leaderboard; each region is snapshotted separately.
    const regionsToSnapshot: (string | null)[] = [null, ...PH_REGIONS]
    let totalUserSnapshots = 0
    let totalCafeSnapshots = 0
    const snapshottedRegions: string[] = []

    // ------------------------------------------------------------------
    // Users
    //
    // computeLive is required: for a past month the read path prefers a stored
    // snapshot, and asking it for the snapshot it is about to create returns an
    // empty list, so the loop used to `continue` and never write anything.
    // ------------------------------------------------------------------
    for (const region of regionsToSnapshot) {
        if (await sliceExists(yearMonth, "user", region)) {
            continue
        }

        const result = await getMonthlyLeaderboard(region, 100, yearMonth, {
            computeLive: true,
        })

        if (result.leaderboard.length === 0) {
            continue
        }

        const entries = result.leaderboard.map((entry) => ({
            yearMonth,
            type: "user" as const,
            userId: entry.userId,
            rank: entry.rank,
            score: entry.score,
            visitCount: entry.visitCount,
            cafesVisited: entry.cafesVisited,
            region,
        }))

        // onConflictDoNothing needs the unique index on (type, month, region, subject)
        await db.insert(monthlyLeaderboardSnapshots).values(entries).onConflictDoNothing()

        totalUserSnapshots += entries.length
        if (region && !snapshottedRegions.includes(region)) {
            snapshottedRegions.push(region)
        }

        console.log(
            `[Leaderboard Snapshot Cron] Snapshotted ${entries.length} user entries for region: ${region ?? "global"}`
        )
    }

    // ------------------------------------------------------------------
    // Cafes
    // ------------------------------------------------------------------
    for (const region of regionsToSnapshot) {
        if (await sliceExists(yearMonth, "cafe", region)) {
            continue
        }

        const result = await getCafeMonthlyLeaderboard(region, 100, yearMonth)

        if (result.leaderboard.length === 0) {
            continue
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

        await db.insert(monthlyLeaderboardSnapshots).values(entries).onConflictDoNothing()

        totalCafeSnapshots += entries.length
        if (region && !snapshottedRegions.includes(region)) {
            snapshottedRegions.push(region)
        }

        console.log(
            `[Leaderboard Snapshot Cron] Snapshotted ${entries.length} cafe entries for region: ${region ?? "global"}`
        )
    }

    console.log(`[Leaderboard Snapshot Cron] Snapshot complete for ${yearMonth}:`, {
        userSnapshots: totalUserSnapshots,
        cafeSnapshots: totalCafeSnapshots,
        regions: snapshottedRegions.length,
    })

    return {
        success: true,
        message: `Snapshotted ${totalUserSnapshots} user entries and ${totalCafeSnapshots} cafe entries`,
        yearMonth,
        summary: {
            userCount: totalUserSnapshots,
            cafeCount: totalCafeSnapshots,
            regionsSnapshotted: snapshottedRegions.length,
            regionNames: snapshottedRegions,
        },
    }
}
