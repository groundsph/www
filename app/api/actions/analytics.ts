"use server"

import { db } from "@/db"
import { cafes, cafeSubscriptions, cafePageViews } from "@/db/schema"
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

    // Check subscription tier - analytics requires Pro or higher
    const subscriptionResult = await db
        .select({ tier: cafeSubscriptions.tier })
        .from(cafeSubscriptions)
        .where(eq(cafeSubscriptions.cafeId, cafeId))
        .limit(1)

    const dbTier = subscriptionResult[0]?.tier || "free"
    const displayTier = dbTier === "basic" ? "pro" : (dbTier as "free" | "pro" | "premium")

    // Analytics requires Pro+ tier
    if (displayTier === "free") {
        return null
    }

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
