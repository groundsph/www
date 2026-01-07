"use server"

import { db } from "@/db"
import { cafes, cafeVisits } from "@/db/schema"
import { eq, and, sql } from "drizzle-orm"

// Threshold for unique visitors per month to graduate from hidden gem status
const HIDDEN_GEM_VISITOR_THRESHOLD = parseInt(
    process.env.HIDDEN_GEM_VISITOR_THRESHOLD || "50"
)

interface MonthBounds {
    start: Date
    end: Date
    period: string
}

/**
 * Get the bounds of the previous calendar month
 * Handles leap years and variable month lengths correctly
 * 
 * Note: This is a pure helper function, not exported as a server action
 */
function getPreviousMonthBounds(): MonthBounds {
    const now = new Date()

    // Get first day of current month
    const firstOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // Go back one day to get last day of previous month
    const lastOfPrevMonth = new Date(firstOfCurrentMonth.getTime() - 1)

    // Get first day of previous month
    const firstOfPrevMonth = new Date(
        lastOfPrevMonth.getFullYear(),
        lastOfPrevMonth.getMonth(),
        1
    )

    // Set time bounds
    const start = new Date(firstOfPrevMonth)
    start.setHours(0, 0, 0, 0)

    const end = new Date(lastOfPrevMonth)
    end.setHours(23, 59, 59, 999)

    // Period string like "2026-01"
    const period = `${firstOfPrevMonth.getFullYear()}-${String(
        firstOfPrevMonth.getMonth() + 1
    ).padStart(2, "0")}`

    return { start, end, period }
}

/**
 * Get the count of unique visitors for a cafe in a specific date range
 */
async function getUniqueVisitorCount(
    cafeId: string,
    startDate: Date,
    endDate: Date
): Promise<number> {
    const result = await db
        .select({
            uniqueVisitors: sql<number>`COUNT(DISTINCT ${cafeVisits.userId})`,
        })
        .from(cafeVisits)
        .where(
            and(
                eq(cafeVisits.cafeId, cafeId),
                sql`${cafeVisits.visitedAt} >= ${startDate.toISOString()}`,
                sql`${cafeVisits.visitedAt} <= ${endDate.toISOString()}`
            )
        )

    return result[0]?.uniqueVisitors ?? 0
}

/**
 * Graduate a cafe from hidden gem status
 */
async function graduateCafe(cafeId: string): Promise<void> {
    await db
        .update(cafes)
        .set({
            isHiddenGem: false,
            hiddenGemGraduatedAt: new Date(),
            updatedAt: new Date(),
        })
        .where(eq(cafes.id, cafeId))
}

/**
 * Mark a cafe as evaluated for the current period
 */
async function markCafeEvaluated(
    cafeId: string,
    period: string
): Promise<void> {
    await db
        .update(cafes)
        .set({
            hiddenGemLastEvaluatedPeriod: period,
        })
        .where(eq(cafes.id, cafeId))
}

interface EvaluationResult {
    cafeId: string
    cafeName: string
    uniqueVisitors: number
    threshold: number
    graduated: boolean
}

interface EvaluationReport {
    period: string
    threshold: number
    cafesEvaluated: number
    cafesGraduated: number
    results: EvaluationResult[]
    startDate: string
    endDate: string
}

/**
 * Evaluate all hidden gem cafes for the previous calendar month
 * This is idempotent - safe to run multiple times per month
 */
export async function evaluateHiddenGems(): Promise<EvaluationReport> {
    const { start, end, period } = getPreviousMonthBounds()

    // Find all hidden gem cafes that haven't been evaluated for this period
    const hiddenGemCafes = await db
        .select({
            id: cafes.id,
            name: cafes.name,
            lastEvaluatedPeriod: cafes.hiddenGemLastEvaluatedPeriod,
        })
        .from(cafes)
        .where(
            and(
                eq(cafes.isHiddenGem, true),
                eq(cafes.isActive, true),
                // Not yet evaluated for this period
                sql`(${cafes.hiddenGemLastEvaluatedPeriod} IS NULL OR ${cafes.hiddenGemLastEvaluatedPeriod} != ${period})`
            )
        )

    const results: EvaluationResult[] = []
    let graduatedCount = 0

    for (const cafe of hiddenGemCafes) {
        // Count unique visitors for the previous month
        const uniqueVisitors = await getUniqueVisitorCount(cafe.id, start, end)

        const shouldGraduate = uniqueVisitors >= HIDDEN_GEM_VISITOR_THRESHOLD

        if (shouldGraduate) {
            await graduateCafe(cafe.id)
            graduatedCount++
        }

        // Mark as evaluated regardless of outcome
        await markCafeEvaluated(cafe.id, period)

        results.push({
            cafeId: cafe.id,
            cafeName: cafe.name,
            uniqueVisitors,
            threshold: HIDDEN_GEM_VISITOR_THRESHOLD,
            graduated: shouldGraduate,
        })
    }

    return {
        period,
        threshold: HIDDEN_GEM_VISITOR_THRESHOLD,
        cafesEvaluated: hiddenGemCafes.length,
        cafesGraduated: graduatedCount,
        results,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
    }
}

/**
 * Get hidden gem stats for a specific cafe
 * Useful for admin dashboard or debugging
 */
export async function getHiddenGemStats(cafeId: string): Promise<{
    isHiddenGem: boolean
    hiddenGemSince: Date | null
    lastEvaluatedPeriod: string | null
    graduatedAt: Date | null
    currentMonthVisitors: number
    previousMonthVisitors: number
}> {
    const cafe = await db
        .select({
            isHiddenGem: cafes.isHiddenGem,
            hiddenGemSince: cafes.hiddenGemSince,
            lastEvaluatedPeriod: cafes.hiddenGemLastEvaluatedPeriod,
            graduatedAt: cafes.hiddenGemGraduatedAt,
        })
        .from(cafes)
        .where(eq(cafes.id, cafeId))
        .limit(1)

    if (!cafe[0]) {
        throw new Error("Cafe not found")
    }

    // Get current month bounds
    const now = new Date()
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    // Get previous month bounds
    const { start: prevStart, end: prevEnd } = getPreviousMonthBounds()

    const [currentMonthVisitors, previousMonthVisitors] = await Promise.all([
        getUniqueVisitorCount(cafeId, currentMonthStart, currentMonthEnd),
        getUniqueVisitorCount(cafeId, prevStart, prevEnd),
    ])

    return {
        isHiddenGem: cafe[0].isHiddenGem ?? false,
        hiddenGemSince: cafe[0].hiddenGemSince,
        lastEvaluatedPeriod: cafe[0].lastEvaluatedPeriod,
        graduatedAt: cafe[0].graduatedAt,
        currentMonthVisitors,
        previousMonthVisitors,
    }
}
