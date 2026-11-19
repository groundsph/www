"use server"

import { db } from "@/db"
import { toStoredThumbnail } from "@/utils/extras"
import { cafes, cafeVisits, reviews, cafePageViews, monthlyLeaderboardSnapshots } from "@/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { applyTieRanking } from "@/utils/leaderboard"
import {
    currentMonthKey,
    formatYearMonthKey,
    getMonthWindow,
    resolveLeaderboardMonth,
    type YearMonth,
} from "@/utils/date/leaderboard-months"
import { omitTestCafes, publicCafeConditions } from "@/utils/filters"
import { CafeLeaderboardEntry } from "@/utils/types/leaderboard"

/**
 * Which Manila month a call is asking about, defaulting to the one it is in and
 * refusing to serve a month that has not happened yet.
 *
 * The default comes from `currentMonthKey()` rather than a local `Date`, because
 * "current month" is a Manila question. A browser (or server) in another
 * timezone would otherwise pick the wrong month for eight hours around each
 * boundary.
 */
/** Per-cafe activity for one month, aggregated in its own subquery. */
function monthlyCafeActivity(startIso: string, endIso: string) {
    const visits = db
        .select({
            cafeId: cafeVisits.cafeId,
            visitCount: sql<number>`count(${cafeVisits.id})`.as("visit_count"),
            uniqueVisitors: sql<number>`count(distinct ${cafeVisits.userId})`.as("unique_visitors"),
        })
        .from(cafeVisits)
        .where(
            and(
                sql`${cafeVisits.visitedAt} >= ${startIso}`,
                sql`${cafeVisits.visitedAt} < ${endIso}`
            )
        )
        .groupBy(cafeVisits.cafeId)
        .as("monthly_visits")

    const monthlyReviews = db
        .select({
            cafeId: reviews.cafeId,
            reviewCount: sql<number>`count(distinct ${reviews.id}) filter (where ${reviews.status} = 'published')`.as("review_count"),
            avgRating: sql<number | null>`avg(${reviews.rating}) filter (where ${reviews.status} = 'published')`.as("avg_rating"),
            likesCount: sql<number>`coalesce(sum(${reviews.likesCount}) filter (where ${reviews.status} = 'published'), 0)`.as("likes_count"),
        })
        .from(reviews)
        .where(
            and(
                sql`${reviews.createdAt} >= ${startIso}`,
                sql`${reviews.createdAt} < ${endIso}`
            )
        )
        .groupBy(reviews.cafeId)
        .as("monthly_reviews")

    const monthlyViews = db
        .select({
            cafeId: cafePageViews.cafeId,
            pageViews: sql<number>`count(distinct ${cafePageViews.visitorId})`.as("page_views"),
        })
        .from(cafePageViews)
        .where(
            and(
                sql`${cafePageViews.viewedAt} >= ${startIso}`,
                sql`${cafePageViews.viewedAt} < ${endIso}`
            )
        )
        .groupBy(cafePageViews.cafeId)
        .as("monthly_page_views")

    return { visits, monthlyReviews, monthlyViews }
}

/**
 * Compute the cafe leaderboard live for a given month.
 *
 * Each activity table is aggregated in its own subquery before being joined.
 * The previous version left-joined `cafe_visits`, `reviews` and `cafe_page_views`
 * all off `cafes.id` in one query, which fans out: a cafe with four visits, two
 * reviews and thirty pageviews produced `count(visits) = 240`. Every score on the
 * board was popularity multiplied by itself.
 */
async function computeCafeLeaderboardLive(
    selectedYearMonth: YearMonth,
    region: string | null | undefined,
    limit: number,
    /**
     * Historical months relax to the test-cafe rule only: a cafe that was
     * published in October and has since been deactivated earned its October
     * rank. A month with no snapshot is recomputed with the same scope as one
     * that has a snapshot, so the answer cannot depend on whether a snapshot
     * happens to exist.
     */
    historical = false
): Promise<CafeLeaderboardEntry[]> {
    const window = getMonthWindow(formatYearMonthKey(selectedYearMonth))
    if (!window) return []

    const { visits, monthlyReviews, monthlyViews } = monthlyCafeActivity(
        window.startIso,
        window.endIso
    )

    const results = await db
        .select({
            cafeId: cafes.id,
            name: cafes.name,
            slug: cafes.slug,
            thumbnail: cafes.thumbnail,
            region: cafes.region,
            visitCount: sql<number>`coalesce(${visits.visitCount}, 0)`,
            uniqueVisitors: sql<number>`coalesce(${visits.uniqueVisitors}, 0)`,
            reviewCount: sql<number>`coalesce(${monthlyReviews.reviewCount}, 0)`,
            avgRating: monthlyReviews.avgRating,
            likesCount: sql<number>`coalesce(${monthlyReviews.likesCount}, 0)`,
            pageViews: sql<number>`coalesce(${monthlyViews.pageViews}, 0)`,
        })
        .from(cafes)
        .leftJoin(visits, eq(visits.cafeId, cafes.id))
        .leftJoin(monthlyReviews, eq(monthlyReviews.cafeId, cafes.id))
        .leftJoin(monthlyViews, eq(monthlyViews.cafeId, cafes.id))
        .where(
            and(
                ...(historical ? omitTestCafes([]) : publicCafeConditions()),
                region ? eq(cafes.region, region) : undefined,
                // A cafe with no activity at all this month does not make the
                // board — without this the tail fills with every published cafe
                // ranked by nothing, which is what made the board look populated
                // in months where nothing happened.
                //
                // "Activity" is any of the three things the score counts, not
                // visits alone: most months have browsing but few check-ins, and
                // requiring a visit emptied months that genuinely had traffic.
                sql`(
                    coalesce(${visits.visitCount}, 0)
                    + coalesce(${monthlyReviews.reviewCount}, 0)
                    + coalesce(${monthlyViews.pageViews}, 0)
                ) > 0`
            )
        )

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
            // Rank on the number the visitor sees, so two cafes that both render
            // "12" cannot be ordered 1st and 2nd.
            score: Math.round(score),
            visitCount,
            reviewCount,
            avgRating,
        }
    })

    scoredResults.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return a.name.localeCompare(b.name)
    })

    return applyTieRanking(scoredResults.slice(0, limit), { scoreKey: "score" }).map((r) => ({
        rank: r.rank,
        cafeId: r.cafeId as string,
        name: r.name as string,
        slug: r.slug as string,
        thumbnail: r.thumbnail as string,
        region: r.region as string,
        score: r.score as number,
        visitCount: r.visitCount as number,
        reviewCount: r.reviewCount as number,
        avgRating: r.avgRating as number | null,
    }))
}

/**
 * Cafe leaderboard entries for a month: live for the current month, from the
 * stored snapshot for a past one.
 *
 * Reads never write. A past month with no snapshot is computed live and returned
 * un-stored; the daily cron owns snapshot creation. The previous implementation
 * inserted a snapshot from this path *and* the cron inserted the same rows,
 * which double-counted every backfilled month.
 */
async function computeCafeLeaderboardCore(
    region: string | null,
    limit: number,
    yearMonth: string | null,
    options?: { computeLive?: boolean }
): Promise<CafeLeaderboardEntry[]> {
    const resolved = resolveLeaderboardMonth(yearMonth)
    const selectedMonth = formatYearMonthKey(resolved)
    const isCurrentMonth = selectedMonth === currentMonthKey()

    // A backfill must recompute from the raw tables. Without this the caller
    // reads the stored snapshot it is about to replace and rewrites the same
    // wrong numbers.
    if (isCurrentMonth || options?.computeLive) {
        return await computeCafeLeaderboardLive(resolved, region, limit)
    }

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
                region
                    ? eq(monthlyLeaderboardSnapshots.region, region)
                    : sql`${monthlyLeaderboardSnapshots.region} IS NULL`,
                // Only the test-cafe half of the visibility rules applies to
                // history: a cafe that was published in October and has since
                // been deactivated genuinely earned its October rank, but a test
                // cafe was never part of the story.
                ...omitTestCafes([])
            )
        )
        .orderBy(monthlyLeaderboardSnapshots.rank)
        .limit(limit)

    if (snapshotResults.length === 0) {
        return await computeCafeLeaderboardLive(resolved, region, limit, true)
    }

    // Deduplicate by cafeId: the snapshot table has no working unique key yet,
    // so a month backfilled by two writers can hold the same cafe twice.
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
            thumbnail: toStoredThumbnail(r.thumbnail),
            region: r.region,
            score: Math.round(r.score),
            visitCount: r.visitCount || 0,
            reviewCount: r.reviewCount || 0,
            avgRating: r.avgRating ?? null,
        })
    }

    return leaderboard
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
    yearMonth?: string | null,
    options?: { computeLive?: boolean }
): Promise<{
    leaderboard: CafeLeaderboardEntry[]
    selectedMonth: string
    region: string | null
}> {
    const resolved = resolveLeaderboardMonth(yearMonth)
    const selectedMonth = formatYearMonthKey(resolved)

    try {
        const leaderboard = await computeCafeLeaderboardCore(
            region || null,
            limit,
            selectedMonth,
            options
        )

        // If viewing a regional leaderboard, also fetch nationwide rankings
        const nationwideRankMap = new Map<string, number>()
        if (region) {
            const nationwideLeaderboard = await computeCafeLeaderboardCore(
                null,
                100,
                selectedMonth,
                options
            )
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
            selectedMonth,
            region: region || null,
        }
    }
}
