"use server"

import { db } from "@/db"
import { cafes, cafeVisits, reviews, cafePageViews, monthlyLeaderboardSnapshots } from "@/db/schema"
import { eq, and, count, sql, desc, avg, sum } from "drizzle-orm"
import { applyTieRanking } from "@/utils/leaderboard"
import { parseYearMonth, isFutureMonth, getMonthDateRange } from "@/utils/date/leaderboard-months"
import { CafeLeaderboardEntry } from "@/utils/types/leaderboard"

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
        // Parse and validate yearMonth, default to current month
        let selectedYearMonth = parseYearMonth(yearMonth || "")
        const now = new Date()
        const currentMonth = {
            year: now.getFullYear(),
            month: now.getMonth() + 1, // 1-12
        }

        if (!selectedYearMonth || isFutureMonth(selectedYearMonth)) {
            selectedYearMonth = currentMonth
        }

        const selectedMonth = \`\${selectedYearMonth.year}-\${selectedYearMonth.month.toString().padStart(2, "0")}\`
        const isCurrentMonth = selectedYearMonth.year === currentMonth.year && selectedYearMonth.month === currentMonth.month

        // For past months, read from snapshot
        if (!isCurrentMonth) {
            const snapshotResults = await db
                .select({
                    rank: monthlyLeaderboardSnapshots.rank,
                    cafeId: monthlyLeaderboardSnapshots.entityId,
                    name: cafes.name,
                    slug: cafes.slug,
                    thumbnail: cafes.thumbnail,
                    region: cafes.region,
                    score: monthlyLeaderboardSnapshots.score,
                    breakdown: monthlyLeaderboardSnapshots.breakdown,
                })
                .from(monthlyLeaderboardSnapshots)
                .innerJoin(cafes, eq(monthlyLeaderboardSnapshots.entityId, cafes.id))
                .where(
                    and(
                        eq(monthlyLeaderboardSnapshots.yearMonth, selectedMonth),
                        eq(monthlyLeaderboardSnapshots.type, "cafe"),
                        region ? eq(monthlyLeaderboardSnapshots.region, region) : sql\`\${monthlyLeaderboardSnapshots.region} IS NULL\`
                    )
                )
                .orderBy(monthlyLeaderboardSnapshots.rank)
                .limit(limit)

            const leaderboard: CafeLeaderboardEntry[] = snapshotResults.map((r) => {
                const breakdown = (r.breakdown as { visitCount?: number; reviewCount?: number; avgRating?: number }) || {}
                return {
                    rank: r.rank,
                    cafeId: r.cafeId,
                    name: r.name,
                    slug: r.slug,
                    thumbnail: r.thumbnail,
                    region: r.region,
                    score: Math.round(r.score),
                    visitCount: breakdown.visitCount || 0,
                    reviewCount: breakdown.reviewCount || 0,
                    avgRating: breakdown.avgRating ?? null,
                }
            })

            return {
                leaderboard,
                selectedMonth,
                region: region || null,
            }
        }

        // For current month, calculate composite score live
        const { startDate, endDate } = getMonthDateRange(selectedYearMonth)

        // Build query with composite score calculation
        const baseQuery = db
            .select({
                cafeId: cafes.id,
                name: cafes.name,
                slug: cafes.slug,
                thumbnail: cafes.thumbnail,
                region: cafes.region,
                visitCount: sql<number>\`count(\${cafeVisits.id})\`.as("visitCount"),
                uniqueVisitors: sql<number>\`count(distinct \${cafeVisits.userId})\`.as("uniqueVisitors"),
                reviewCount: sql<number>\`count(distinct case when \${reviews.status} = 'published' then \${reviews.id} end)\`.as("reviewCount"),
                avgRating: sql<number | null>\`avg(case when \${reviews.status} = 'published' then \${reviews.rating} end)\`.as("avgRating"),
                likesCount: sql<number>\`coalesce(sum(\${reviews.likesCount}), 0)\`.as("likesCount"),
                pageViews: sql<number>\`count(distinct \${cafePageViews.visitorId})\`.as("pageViews"),
            })
            .from(cafes)
            .leftJoin(cafeVisits, and(
                eq(cafeVisits.cafeId, cafes.id),
                sql\`\${cafeVisits.visitedAt} >= \${startDate.toISOString()}\`,
                sql\`\${cafeVisits.visitedAt} < \${endDate.toISOString()}\`
            ))
            .leftJoin(reviews, and(
                eq(reviews.cafeId, cafes.id),
                sql\`\${reviews.createdAt} >= \${startDate.toISOString()}\`,
                sql\`\${reviews.createdAt} < \${endDate.toISOString()}\`
            ))
            .leftJoin(cafePageViews, and(
                eq(cafePageViews.cafeId, cafes.id),
                sql\`\${cafePageViews.viewedAt} >= \${startDate.toISOString()}\`,
                sql\`\${cafePageViews.viewedAt} < \${endDate.toISOString()}\`
            ))
            .where(
                and(
                    eq(cafes.isPublished, true),
                    region ? eq(cafes.region, region) : undefined
                )
            )

        const results = await baseQuery
            .groupBy(cafes.id, cafes.name, cafes.slug, cafes.thumbnail, cafes.region)

        // Calculate composite scores
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
                userId: r.cafeId, // Required by LeaderboardEntry interface
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

        // Sort by score DESC, then name ASC for tie-breaking
        scoredResults.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score
            return a.name.localeCompare(b.name)
        })

        // Apply tie-aware ranking with scoreKey
        const rankedResults = applyTieRanking(
            scoredResults.slice(0, limit),
            { scoreKey: "score" }
        )

        // Build leaderboard
        const leaderboard: CafeLeaderboardEntry[] = rankedResults.map((r) => ({
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

        return {
            leaderboard,
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
