"use server"

import { createClient } from "@/utils/supabase/server"

async function getCurrentUserId(): Promise<string | null> {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    return user?.id ?? null
}

export interface CafeAnalytics {
    // Overview stats
    totalViews: number
    uniqueVisitors: number
    periodStart: string
    periodEnd: string

    // Time series data (views per day)
    viewsByDay: {
        date: string
        views: number
        uniqueVisitors: number
    }[]

    // Device breakdown
    deviceBreakdown: {
        mobile: number
        desktop: number
        tablet: number
    }

    // Top referrers
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
    const db = await createClient()
    const userId = await getCurrentUserId()

    if (!userId) return null

    // Check ownership
    const { data: cafe } = await db
        .from("cafes")
        .select("owner_ids")
        .eq("id", cafeId)
        .single()

    if (!cafe?.owner_ids?.includes(userId)) {
        return null // Not an owner
    }

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const startStr = startDate.toISOString()
    const endStr = endDate.toISOString()

    // Get all page views in the period
    const { data: pageViews, error } = await db
        .from("cafe_page_views")
        .select("*")
        .eq("cafe_id", cafeId)
        .gte("viewed_at", startStr)
        .lte("viewed_at", endStr)

    if (error || !pageViews) {
        console.error("Error fetching analytics:", error)
        return null
    }

    // Calculate unique visitors
    const uniqueVisitorIds = new Set(pageViews.map(v => v.visitor_id).filter(Boolean))

    // Group views by day
    const viewsByDayMap = new Map<string, { views: number; visitors: Set<string> }>()

    // Initialize all days in the range
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateKey = d.toISOString().split("T")[0]
        viewsByDayMap.set(dateKey, { views: 0, visitors: new Set() })
    }

    // Populate with actual data
    for (const view of pageViews) {
        const dateKey = view.viewed_at.split("T")[0]
        const dayData = viewsByDayMap.get(dateKey)
        if (dayData) {
            dayData.views++
            if (view.visitor_id) {
                dayData.visitors.add(view.visitor_id)
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
        const device = view.device_type as keyof typeof deviceBreakdown
        if (device && deviceBreakdown[device] !== undefined) {
            deviceBreakdown[device]++
        }
    }

    // Top referrers
    const referrerCounts = new Map<string, number>()
    for (const view of pageViews) {
        if (view.referrer) {
            try {
                // Extract domain from referrer URL
                const url = new URL(view.referrer)
                const domain = url.hostname
                referrerCounts.set(domain, (referrerCounts.get(domain) || 0) + 1)
            } catch {
                // Invalid URL, use as-is
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
