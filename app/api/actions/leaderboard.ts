"use server"

import { db } from "@/db"
import { cafes, cafeVisits, reviews, cafePageViews, monthlyLeaderboardSnapshots } from "@/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { applyTieRanking } from "@/utils/leaderboard"
import { parseYearMonth, isFutureMonth, getMonthDateRange } from "@/utils/date/leaderboard-months"
import { getPHTime } from "@/utils/featured"
import { CafeLeaderboardEntry } from "@/utils/types/leaderboard"

/**
 * Internal helper: compute cafe leaderboard live for any given month.
 * Used by getCafeMonthlyLeaderboard for the current month and for on-demand backfills.
 */
async function computeCafeLeaderboardLive(
    selectedYearMonth: { year: number; month: number },
    region: string | null | undefined,
    limit: number
): Promise<CafeLeaderboardEntry[]> {
    const { startDate: monthStartUTC, endDate: monthEndUTC } = getMonthDateRange(selectedYearMonth)

    const baseQuery = db
        .select({
            cafeId: cafes.id,
            name: cafes.name,
            slug: cafes.slug,
            thumbnail: cafes.thumbnail,
            region: cafes.region,
            visitCount: sql<number>`count(${cafeVisits.id})`.as("visitCount"),
            uniqueVisitors: sql<number>`count(distinct ${cafeVisits.userId})`.as("uniqueVisitors"),
            reviewCount: sql<number>`count(distinct case when ${reviews.status} = 'published' then ${reviews.id} end)`.as("reviewCount"),
            avgRating: sql<number | null>`avg(case when ${reviews.status} = 'published' then ${reviews.rating} end)`.as("avgRating"),
            likesCount: sql<number>`coalesce(sum(${reviews.likesCount}), 0)`.as("likesCount"),
            pageViews: sql<number>`count(distinct ${cafePageViews.visitorId})`.as("pageViews"),
        })
        .from(cafes)
        .leftJoin(cafeVisits, and(
            eq(cafeVisits.cafeId, cafes.id),
            sql`${cafeVisits.visitedAt} >= ${monthStartUTC.toISOString()}`,
            sql`${cafeVisits.visitedAt} < ${monthEndUTC.toISOString()}`
        ))
        .leftJoin(reviews, and(
            eq(reviews.cafeId, cafes.id),
            sql`${reviews.createdAt} >= ${monthStartUTC.toISOString()}`,
            sql`${reviews.createdAt} < ${monthEndUTC.toISOString()}`
        ))
        .leftJoin(cafePageViews, and(
            eq(cafePageViews.cafeId, cafes.id),
            sql`${cafePageViews.viewedAt} >= ${monthStartUTC.toISOString()}`,
            sql`${cafePageViews.viewedAt} < ${monthEndUTC.toISOString()}`
        ))
        .where(
            and(
                eq(cafes.isPublished, true),
                region ? eq(cafes.region, region) : undefined
            )
        )

    const results = await baseQuery
        .groupBy(cafes.id, cafes.name, cafes.slug, cafes.thumbnail, cafes.region)

    const scoredResults = results.map((r) => {
        const visitCount = Number(r.visitCount) || 0
        const uniqueVisitors = Number(r.uniqueVisitors) || 0
        const reviewCount = Number(r.reviewCount) || 0
        const avgRating = r.avgRating ? Number(r.avgRating) : null
        const likesCount = Number(r.likesCount) || 0
        const pageViews = Number(r.pageViews) || 0

        const score =
            visitCount * 3 +
            uniqueVisitors * 2 +
            reviewCount * 5 +
            (avgRating ?? 0) * 10 +
            likesCount * 1 +
            pageViews * 0.5

        return {
            cafeId: r.cafeId,
            name: r.name,
            slug: r.slug,
            thumbnail: r.thumbnail,
            region: r.region,
            score,
            visitCount,
            reviewCount,
            avgRating,
        }
    })

    scoredResults.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return a.name.localeCompare(b.name)
    })

    const rankedResults = applyTieRanking(
        scoredResults.slice(0, limit),
        { scoreKey: "score" }
    )

    return rankedResults.map((r) => ({
        rank: r.rank,
        cafeId: r.cafeId as string,
        name: r.name as string,
        slug: r.slug as string,
        thumbnail: r.thumbnail as string,
        region: r.region as string,
        score: Math.round(r.score as number),
        visitCount: r.visitCount as number,
        reviewCount: r.reviewCount as number,
        avgRating: r.avgRating as number | null,
    }))
}

/**
 * Internal helper: get leaderboard entries without nationwide rank lookup.
 * Used by getCafeMonthlyLeaderboard to compute both regional and nationwide rankings.
 */
async function computeCafeLeaderboardCore(
    region: string | null,
    limit: number,
    yearMonth: string | null
): Promise<CafeLeaderboardEntry[]> {
    // Parse and validate yearMonth, default to current month (in PH time)
    let selectedYearMonth = parseYearMonth(yearMonth || "")
    const nowPH = getPHTime()
    const currentMonth = {
        year: nowPH.getFullYear(),
        month: nowPH.getMonth() + 1, // 1-12
    }

    if (!selectedYearMonth || isFutureMonth(selectedYearMonth)) {
        selectedYearMonth = currentMonth
    }

    const selectedMonth = `${selectedYearMonth.year}-${selectedYearMonth.month.toString().padStart(2, "0")}`
    const isCurrentMonth = selectedYearMonth.year === currentMonth.year && selectedYearMonth.month === currentMonth.month

    // For past months, read from snapshot (backfill on-demand if missing)
    if (!isCurrentMonth) {
        const snapshotResults = await db
            .select({
                rank: monthlyLeaderboardSnapshots.rank,
                cafeId: monthlyLeaderboardSnapshots.cafeId,
                name: cafes.name,
                slug: cafes.slug,
                thumbnail: cafes.thumbnail,
                region: cafes.region,
                score: monthlyLeaderboardSnapshots.score,
                visitCount: monthlyLeaderboardSnapshots.visitCount,
                reviewCount: monthlyLeaderboardSnapshots.reviewCount,
                avgRating: monthlyLeaderboardSnapshots.avgRating,
            })
            .from(monthlyLeaderboardSnapshots)
            .innerJoin(cafes, eq(monthlyLeaderboardSnapshots.cafeId, cafes.id))
            .where(
                and(
                    eq(monthlyLeaderboardSnapshots.yearMonth, selectedMonth),
                    eq(monthlyLeaderboardSnapshots.type, "cafe"),
                    region ? eq(monthlyLeaderboardSnapshots.region, region) : sql`${monthlyLeaderboardSnapshots.region} IS NULL`
                )
            )
            .orderBy(monthlyLeaderboardSnapshots.rank)
            .limit(limit)

        // If no snapshot exists, compute live and backfill
        if (snapshotResults.length === 0) {
            console.log(`[Leaderboard] No snapshot for ${selectedMonth} (cafe, region=${region ?? "global"}), backfilling...`)
            const liveResult = await computeCafeLeaderboardLive(selectedYearMonth, region, 100)

            if (liveResult.length > 0) {
                const entries = liveResult.map((entry) => ({
                    yearMonth: selectedMonth,
                    type: "cafe" as const,
                    cafeId: entry.cafeId,
                    rank: entry.rank,
                    score: entry.score,
                    visitCount: entry.visitCount,
                    reviewCount: entry.reviewCount,
                    region: region ?? null,
                }))

                try {
                    await db.insert(monthlyLeaderboardSnapshots).values(entries)
                    console.log(`[Leaderboard] Backfilled ${entries.length} cafe entries for ${selectedMonth}`)
                } catch (err) {
                    console.error("[Leaderboard] Backfill insert failed:", err)
                }
            }

            return liveResult.slice(0, limit)
        }

        // Deduplicate by cafeId (safety check for data integrity)
        const seenCafeIds = new Set<string>()
        const leaderboard: CafeLeaderboardEntry[] = []
        
        for (const r of snapshotResults) {
            if (!r.cafeId || seenCafeIds.has(r.cafeId)) continue
            seenCafeIds.add(r.cafeId)
            leaderboard.push({
                rank: r.rank,
                cafeId: r.cafeId,
                name: r.name,
                slug: r.slug,
                thumbnail: r.thumbnail,
                region: r.region,
                score: Math.round(r.score),
                visitCount: r.visitCount || 0,
                reviewCount: r.reviewCount || 0,
                avgRating: r.avgRating ?? null,
            })
        }

        return leaderboard
    }

    // For current month, calculate composite score live
    return await computeCafeLeaderboardLive(selectedYearMonth, region, limit)
}

/**
 * Get monthly cafe leaderboard with live aggregation for current month
 * or snapshot data for past months.
 *
 * @param region - Optional region filter
 * @param limit - Maximum number of cafes to return (default 20)
 * @param yearMonth - Optional YYYY-MM string to select a specific month
 * @returns Leaderboard data with cafe rankings
 */
export async function getCafeMonthlyLeaderboard(
    region?: string | null,
    limit: number = 20,
    yearMonth?: string | null
): Promise<{
    leaderboard: CafeLeaderboardEntry[]
    selectedMonth: string
    region: string | null
}> {
    try {
        // Parse and validate yearMonth to get selectedMonth
        let selectedYearMonth = parseYearMonth(yearMonth || "")
        const nowPH = getPHTime()
        const currentMonth = {
            year: nowPH.getFullYear(),
            month: nowPH.getMonth() + 1, // 1-12
        }

        if (!selectedYearMonth || isFutureMonth(selectedYearMonth)) {
            selectedYearMonth = currentMonth
        }

        const selectedMonth = `${selectedYearMonth.year}-${selectedYearMonth.month.toString().padStart(2, "0")}`

        // Get regional leaderboard
        const leaderboard = await computeCafeLeaderboardCore(region || null, limit, yearMonth || null)

        // If viewing a regional leaderboard, also fetch nationwide rankings
        const nationwideRankMap = new Map<string, number>()
        if (region) {
            const nationwideLeaderboard = await computeCafeLeaderboardCore(null, 100, yearMonth || null)
            nationwideLeaderboard.forEach((entry) => {
                nationwideRankMap.set(entry.cafeId, entry.rank)
            })
        }

        return {
            leaderboard: leaderboard.map((entry) => ({
                ...entry,
                nationwideRank: region ? (nationwideRankMap.get(entry.cafeId) ?? null) : null,
            })),
            selectedMonth,
            region: region || null,
        }
    } catch (error) {
        console.error("Error fetching cafe leaderboard:", error)
        return {
            leaderboard: [],
            selectedMonth: yearMonth || "",
            region: region || null,
        }
    }
}
