import { NextRequest, NextResponse } from "next/server"
import { getMonthlyLeaderboard } from "@/app/api/actions/profile"
import { getCafeMonthlyLeaderboard } from "@/app/api/actions/leaderboard"
import { db } from "@/db"
import { monthlyLeaderboardSnapshots } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { getPHTime } from "@/utils/featured"
import { PH_REGIONS } from "@/utils/ph-regions"

/**
 * Cron Job: Snapshot Monthly Leaderboards
 *
 * @deprecated Use `/api/cron/daily` instead. This route is kept for backward compatibility.
 *
 * This endpoint should be called daily by Dokploy or any cron service.
 * It snapshots the previous month's leaderboard data for both users and cafes.
 *
 * The job is idempotent - safe to run multiple times per month.
 * First run of each month performs snapshot; subsequent runs are no-ops.
 *
 * Security: Requires CRON_SECRET to be passed in Authorization header
 *
 * @example
 * curl -X GET https://your-domain.com/api/cron/leaderboard-snapshots \
 *   -H "Authorization: Bearer your-cron-secret"
 */

export async function GET(request: NextRequest) {
    try {
        // Verify cron secret
        const authHeader = request.headers.get("authorization")
        const cronSecret = process.env.CRON_SECRET

        if (!cronSecret) {
            console.error("[Leaderboard Snapshot Cron] CRON_SECRET not configured")
            return NextResponse.json(
                { error: "Server configuration error" },
                { status: 500 }
            )
        }

        // Support both "Bearer <token>" and plain token
        const token = authHeader?.startsWith("Bearer ")
            ? authHeader.slice(7)
            : authHeader

        if (token !== cronSecret) {
            console.error("[Leaderboard Snapshot Cron] Invalid cron secret provided")
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            )
        }

        // Compute previous month in PH time
        const nowPH = getPHTime()
        const prevMonthDate = new Date(nowPH.getFullYear(), nowPH.getMonth() - 1, 1)
        const yearMonth = `${prevMonthDate.getFullYear()}-${(prevMonthDate.getMonth() + 1).toString().padStart(2, "0")}`

        console.log(`[Leaderboard Snapshot Cron] Starting snapshot for ${yearMonth}...`)

        // Check if snapshot already exists for this month
        const existingSnapshot = await db
            .select({ id: monthlyLeaderboardSnapshots.id })
            .from(monthlyLeaderboardSnapshots)
            .where(
                and(
                    eq(monthlyLeaderboardSnapshots.yearMonth, yearMonth),
                    eq(monthlyLeaderboardSnapshots.type, "user")
                )
            )
            .limit(1)

        if (existingSnapshot.length > 0) {
            console.log(`[Leaderboard Snapshot Cron] Snapshot already exists for ${yearMonth}`)
            return NextResponse.json({
                success: true,
                message: "already snapshotted",
                yearMonth,
            })
        }

        // Generate snapshots for user and cafe leaderboards
        const regionsToSnapshot = [null, ...PH_REGIONS]
        let totalUserSnapshots = 0
        let totalCafeSnapshots = 0
        const snapshottedRegions: string[] = []

        // Snapshot user leaderboards
        for (const region of regionsToSnapshot) {
            const result = await getMonthlyLeaderboard(region, 100, yearMonth)

            if (result.leaderboard.length === 0) {
                continue
            }

            // Insert snapshot entries
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
            if (region) {
                snapshottedRegions.push(region)
            }

            console.log(`[Leaderboard Snapshot Cron] Snapshotted ${entries.length} user entries for region: ${region ?? "global"}`)
        }

        // Snapshot cafe leaderboards
        for (const region of regionsToSnapshot) {
            const result = await getCafeMonthlyLeaderboard(region, 100, yearMonth)

            if (result.leaderboard.length === 0) {
                continue
            }

            // Insert snapshot entries
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
            if (region && !snapshottedRegions.includes(region)) {
                snapshottedRegions.push(region)
            }

            console.log(`[Leaderboard Snapshot Cron] Snapshotted ${entries.length} cafe entries for region: ${region ?? "global"}`)
        }

        console.log(`[Leaderboard Snapshot Cron] Snapshot complete for ${yearMonth}:`, {
            userSnapshots: totalUserSnapshots,
            cafeSnapshots: totalCafeSnapshots,
            regions: snapshottedRegions.length,
        })

        return NextResponse.json({
            success: true,
            message: `Snapshotted ${totalUserSnapshots} user entries and ${totalCafeSnapshots} cafe entries`,
            yearMonth,
            summary: {
                userCount: totalUserSnapshots,
                cafeCount: totalCafeSnapshots,
                regionsSnapshotted: snapshottedRegions.length,
                regionNames: snapshottedRegions,
            },
        })

    } catch (error) {
        console.error("[Leaderboard Snapshot Cron] Error:", error)
        return NextResponse.json(
            {
                error: "Internal server error",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        )
    }
}
