"use server"

import { db } from "@/db"
import { cafePageViews, cafes, profiles } from "@/db/schema"
import { eq, gte, lte, and, inArray } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"

export interface SiteAnalytics {
    // Overview stats
    totalViews: number
    uniqueVisitors: number
    avgViewsPerDay: number
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

    // Top cafes by views
    topCafes: {
        cafeId: string
        cafeName: string
        cafeSlug: string
        views: number
        uniqueVisitors: number
    }[]
}

export interface CafeAnalyticsSummary {
    cafeId: string
    cafeName: string
    cafeSlug: string
    thumbnail: string | null
    region: string
    totalViews: number
    uniqueVisitors: number
    viewsLastWeek: number
    trend: "up" | "down" | "stable"
    isChain: boolean
}

async function isAdmin(): Promise<boolean> {
    const user = await getCurrentUser()
    if (!user) return false

    const result = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, user.id))
        .limit(1)

    return result[0]?.role === "admin"
}

/**
 * Get site-wide analytics aggregated from all cafe page views
 * Only accessible by admins
 */
export async function getSiteAnalytics(days: number = 30): Promise<SiteAnalytics | null> {
    const hasAccess = await isAdmin()
    if (!hasAccess) return null

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
        .where(and(
            gte(cafePageViews.viewedAt, startDate),
            lte(cafePageViews.viewedAt, endDate)
        ))

    // Return empty data if no views
    if (!pageViews || pageViews.length === 0) {
        return {
            totalViews: 0,
            uniqueVisitors: 0,
            avgViewsPerDay: 0,
            periodStart: startStr,
            periodEnd: endStr,
            viewsByDay: [],
            deviceBreakdown: { mobile: 0, desktop: 0, tablet: 0 },
            topReferrers: [],
            topCafes: [],
        }
    }

    // Calculate unique visitors
    const uniqueVisitorIds = new Set(pageViews.map(v => v.visitorId).filter(Boolean))

    // Group views by day
    const viewsByDayMap = new Map<string, { views: number; visitors: Set<string> }>()

    // Initialize all days in the range
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateKey = d.toISOString().split("T")[0]
        viewsByDayMap.set(dateKey, { views: 0, visitors: new Set() })
    }

    // Group views by cafe
    const cafeViewsMap = new Map<string, { views: number; visitors: Set<string> }>()

    // Populate with actual data
    for (const view of pageViews) {
        const dateKey = view.viewedAt!.toISOString().split("T")[0]
        const dayData = viewsByDayMap.get(dateKey)
        if (dayData) {
            dayData.views++
            if (view.visitorId) {
                dayData.visitors.add(view.visitorId)
            }
        }

        // Track cafe views
        const cafeId = view.cafeId
        if (!cafeViewsMap.has(cafeId)) {
            cafeViewsMap.set(cafeId, { views: 0, visitors: new Set() })
        }
        const cafeData = cafeViewsMap.get(cafeId)!
        cafeData.views++
        if (view.visitorId) {
            cafeData.visitors.add(view.visitorId)
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
                const domain = url.hostname
                referrerCounts.set(domain, (referrerCounts.get(domain) || 0) + 1)
            } catch {
                referrerCounts.set(view.referrer, (referrerCounts.get(view.referrer) || 0) + 1)
            }
        }
    }

    const topReferrers = Array.from(referrerCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([referrer, count]) => ({ referrer, count }))

    // Get top cafes with their names
    const topCafeIds = Array.from(cafeViewsMap.entries())
        .sort((a, b) => b[1].views - a[1].views)
        .slice(0, 10)
        .map(([id]) => id)

    const cafeResult = await db
        .select({ id: cafes.id, name: cafes.name, slug: cafes.slug })
        .from(cafes)
        .where(inArray(cafes.id, topCafeIds))

    const cafeMap = new Map(cafeResult.map(c => [c.id, c]))

    const topCafes = topCafeIds
        .filter(id => cafeMap.has(id))
        .map(id => {
            const cafe = cafeMap.get(id)!
            const data = cafeViewsMap.get(id)!
            return {
                cafeId: id,
                cafeName: cafe.name,
                cafeSlug: cafe.slug,
                views: data.views,
                uniqueVisitors: data.visitors.size,
            }
        })

    const avgViewsPerDay = days > 0 ? pageViews.length / days : 0

    return {
        totalViews: pageViews.length,
        uniqueVisitors: uniqueVisitorIds.size,
        avgViewsPerDay: Math.round(avgViewsPerDay * 10) / 10,
        periodStart: startStr,
        periodEnd: endStr,
        viewsByDay,
        deviceBreakdown,
        topReferrers,
        topCafes,
    }
}

/**
 * Get analytics summary for all cafes (for the breakdown table)
 * Only accessible by admins
 */
export async function getCafeAnalyticsSummary(): Promise<CafeAnalyticsSummary[]> {
    const hasAccess = await isAdmin()
    if (!hasAccess) return []

    // Calculate date ranges
    const lastWeekStart = new Date()
    lastWeekStart.setDate(lastWeekStart.getDate() - 7)
    const twoWeeksAgoStart = new Date()
    twoWeeksAgoStart.setDate(twoWeeksAgoStart.getDate() - 14)

    // Get all page views for the last 2 weeks
    const pageViews = await db
        .select({
            cafeId: cafePageViews.cafeId,
            visitorId: cafePageViews.visitorId,
            viewedAt: cafePageViews.viewedAt,
        })
        .from(cafePageViews)
        .where(gte(cafePageViews.viewedAt, twoWeeksAgoStart))

    // Get all published cafes
    const cafesResult = await db
        .select({
            id: cafes.id,
            name: cafes.name,
            slug: cafes.slug,
            thumbnail: cafes.thumbnail,
            region: cafes.region,
            isChain: cafes.isChain,
        })
        .from(cafes)
        .where(eq(cafes.isPublished, true))
        .orderBy(cafes.name)

    if (!cafesResult.length) return []

    // Aggregate views by cafe
    const cafeStats = new Map<string, {
        totalViews: number
        visitors: Set<string>
        viewsLastWeek: number
        viewsPreviousWeek: number
    }>()

    // Initialize all cafes
    for (const cafe of cafesResult) {
        cafeStats.set(cafe.id, {
            totalViews: 0,
            visitors: new Set(),
            viewsLastWeek: 0,
            viewsPreviousWeek: 0,
        })
    }

    // Process views
    for (const view of pageViews) {
        const stats = cafeStats.get(view.cafeId)
        if (!stats) continue

        const viewDate = view.viewedAt!
        stats.totalViews++
        if (view.visitorId) {
            stats.visitors.add(view.visitorId)
        }

        if (viewDate >= lastWeekStart) {
            stats.viewsLastWeek++
        } else {
            stats.viewsPreviousWeek++
        }
    }

    // Build result
    return cafesResult.map(cafe => {
        const stats = cafeStats.get(cafe.id)!
        let trend: "up" | "down" | "stable" = "stable"
        if (stats.viewsLastWeek > stats.viewsPreviousWeek) {
            trend = "up"
        } else if (stats.viewsLastWeek < stats.viewsPreviousWeek) {
            trend = "down"
        }

        return {
            cafeId: cafe.id,
            cafeName: cafe.name,
            cafeSlug: cafe.slug,
            thumbnail: cafe.thumbnail,
            region: cafe.region,
            totalViews: stats.totalViews,
            uniqueVisitors: stats.visitors.size,
            viewsLastWeek: stats.viewsLastWeek,
            trend,
            isChain: cafe.isChain ?? false,
        }
    }).sort((a, b) => b.totalViews - a.totalViews)
}
