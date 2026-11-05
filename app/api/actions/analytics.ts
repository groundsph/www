"use server"

import { db } from "@/db"
import { cafes, cafePageViews } from "@/db/schema"
// TODO: Re-import cafeSubscriptions after beta ends when re-enabling tier checks
import { eq, and, gte, lte } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
import { parse } from "tldts"

export interface CafeAnalytics {
    totalViews: number
    uniqueVisitors: number
    periodStart: string
    periodEnd: string
    viewsByDay: {
        date: string
        views: number
        uniqueVisitors: number
    }[]
    deviceBreakdown: {
        mobile: number
        desktop: number
        tablet: number
    }
    topReferrers: {
        referrer: string
        count: number
    }[]
}

/**
 * Get analytics data for a cafe
 * Only accessible by cafe owners
 */
export async function getCafeAnalytics(
    cafeId: string,
    days: number = 30
): Promise<CafeAnalytics | null> {
    const user = await getCurrentUser()
    if (!user) return null

    // Check ownership
    const cafeResult = await db
        .select({ ownerIds: cafes.ownerIds })
        .from(cafes)
        .where(eq(cafes.id, cafeId))
        .limit(1)

    const cafe = cafeResult[0]
    if (!cafe?.ownerIds?.includes(user.id)) {
        return null // Not an owner
    }

    // Tier check disabled during beta - all features unlocked
    // TODO: Re-enable after beta ends
    // const subscriptionResult = await db
    //     .select({ tier: cafeSubscriptions.tier })
    //     .from(cafeSubscriptions)
    //     .where(eq(cafeSubscriptions.cafeId, cafeId))
    //     .limit(1)

    // const dbTier = subscriptionResult[0]?.tier || "free"
    // const displayTier = dbTier === "basic" ? "pro" : (dbTier as "free" | "pro" | "premium")

    // Analytics requires Pro+ tier
    // if (displayTier === "free") {
    //     return null
    // }

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const startStr = startDate.toISOString()
    const endStr = endDate.toISOString()

    // Get all page views in the period
    const pageViews = await db
        .select()
        .from(cafePageViews)
        .where(
            and(
                eq(cafePageViews.cafeId, cafeId),
                gte(cafePageViews.viewedAt, startDate),
                lte(cafePageViews.viewedAt, endDate)
            )
        )

    // Calculate unique visitors
    const uniqueVisitorIds = new Set(
        pageViews.map((v) => v.visitorId).filter(Boolean)
    )

    // Group views by day
    const viewsByDayMap = new Map<string, { views: number; visitors: Set<string> }>()

    // Initialize all days in the range
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateKey = d.toISOString().split("T")[0]
        viewsByDayMap.set(dateKey, { views: 0, visitors: new Set() })
    }

    // Populate with actual data
    for (const view of pageViews) {
        const dateKey = view.viewedAt?.toISOString().split("T")[0]
        if (!dateKey) continue

        const dayData = viewsByDayMap.get(dateKey)
        if (dayData) {
            dayData.views++
            if (view.visitorId) {
                dayData.visitors.add(view.visitorId)
            }
        }
    }

    const viewsByDay = Array.from(viewsByDayMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, data]) => ({
            date,
            views: data.views,
            uniqueVisitors: data.visitors.size,
        }))

    // Device breakdown
    const deviceBreakdown = { mobile: 0, desktop: 0, tablet: 0 }
    for (const view of pageViews) {
        const device = view.deviceType as keyof typeof deviceBreakdown
        if (device && deviceBreakdown[device] !== undefined) {
            deviceBreakdown[device]++
        }
    }

    // Top referrers
    const referrerCounts = new Map<string, number>()
    for (const view of pageViews) {
        if (view.referrer) {
            try {
                const url = new URL(view.referrer)
                const parsed = parse(url.hostname)
                const domain = parsed.domain || url.hostname

                // Skip localhost
                if (domain.includes("localhost")) {
                    continue
                }

                // Replace grounds.ph with Internal
                const displayName = domain === "grounds.ph" ? "Internal" : domain

                referrerCounts.set(displayName, (referrerCounts.get(displayName) || 0) + 1)
            } catch {
                referrerCounts.set(view.referrer, (referrerCounts.get(view.referrer) || 0) + 1)
            }
        }
    }

    const topReferrers = Array.from(referrerCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([referrer, count]) => ({ referrer, count }))

    return {
        totalViews: pageViews.length,
        uniqueVisitors: uniqueVisitorIds.size,
        periodStart: startStr,
        periodEnd: endStr,
        viewsByDay,
        deviceBreakdown,
        topReferrers,
    }
}

interface AnalyticsExportResult<T = unknown> {
    success: boolean
    error?: string
    data?: T
}

const EXPORT_PERIODS = [7, 30, 90] as const

/**
 * Export page analytics as CSV.
 *
 * Rows are always daily for the full period — the chart bucketing in
 * `utils/analytics/series.ts` is presentational. Per-day unique visitors come
 * from a server-side visitor-ID set and cannot be re-aggregated into weeks
 * without re-querying raw views, so the export reports ground truth.
 *
 * Authorization is delegated to `getCafeAnalytics`, which returns `null` for
 * unauthenticated callers and non-owners. Do not add a second ownership check
 * here: two gates would drift.
 */
export async function exportCafeAnalyticsCSV(
    cafeId: string,
    days: 7 | 30 | 90
): Promise<AnalyticsExportResult<{ csv: string; filename: string }>> {
    if (!EXPORT_PERIODS.includes(days)) {
        return { success: false, error: "Invalid period" }
    }

    const analytics = await getCafeAnalytics(cafeId, days)
    if (!analytics) {
        return { success: false, error: "Not authorized" }
    }

    const escapeCsv = (value: string | number) => {
        const text = String(value)
        return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
    }

    // `getCafeAnalytics` zero-fills an inclusive range that starts `days` ago,
    // so `viewsByDay` holds `days + 1` entries (8 for 7 days, 91 for 90). Trim
    // to the window the chart actually draws (`buildChartSeries` also slices)
    // so the export is exactly `days` rows instead of silently including a
    // second partial day.
    const window = analytics.viewsByDay.slice(-days)

    const rows = window.map((point) =>
        [point.date, point.views, point.uniqueVisitors]
            .map(escapeCsv)
            .join(",")
    )

    const csv = ["date,views,unique_visitors", ...rows].join("\n")
    const today = new Date().toISOString().split("T")[0]

    return {
        success: true,
        data: { csv, filename: `analytics-${cafeId}-${days}d-${today}.csv` },
    }
}
