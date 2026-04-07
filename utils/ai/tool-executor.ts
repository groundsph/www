import { runCafeQuery } from "@/utils/ai/tools/cafe-query-runner"
import {
    getCafeBySlug,
    compareCafes,
    listCitiesWithCounts,
    getNearbyCafes,
    getTopRatedCafes,
} from "@/utils/ai/tools/cafe-insights"
import { CafeQueryInput } from "@/utils/ai/tools/cafe-query"
import { GeoPoint } from "@/utils/ai/tools/cafe-geo"

export async function executeTool(toolName: string, args: string): Promise<unknown> {
    let parsed: unknown
    try {
        parsed = JSON.parse(args)
    } catch {
        return { error: "Invalid tool arguments" }
    }

    switch (toolName) {
        case "query_cafes":
            return runCafeQuery(parsed as CafeQueryInput)
        case "get_cafe_by_slug":
            return getCafeBySlug(parsed.slug as string)
        case "compare_cafes":
            return compareCafes(parsed.slugA as string, parsed.slugB as string)
        case "list_cities":
            return listCitiesWithCounts()
        case "get_nearby_cafes":
            return getNearbyCafes({ lat: parsed.lat, lng: parsed.lng } as GeoPoint, parsed.radiusKm as number)
        case "get_top_rated":
            return getTopRatedCafes(parsed.city as string, parsed.limit ?? 10)
        case "get_grounds_info": {
            const { getGroundsInfo } = await import("@/utils/ai/grounds-info")
            return await getGroundsInfo()
        }
        case "get_cafe_reviews": {
            const { getCafeReviews } = await import("@/utils/ai/tools/cafe-reviews")
            return getCafeReviews(parsed.slug as string, parsed.limit ?? 5)
        }
        case "get_cafe_menu": {
            const { getCafeMenu } = await import("@/utils/ai/tools/cafe-menu")
            return getCafeMenu(parsed.slug as string, parsed.category)
        }
        case "get_cafe_hours": {
            const { getCafeHours } = await import("@/utils/ai/tools/cafe-hours")
            return getCafeHours(parsed.slug as string)
        }
        case "search_blog_posts": {
            const { searchBlogPosts } = await import("@/utils/ai/tools/blog-search")
            return searchBlogPosts(parsed.query as string, parsed.limit ?? 5)
        }
        case "get_upcoming_events": {
            const { getUpcomingEvents } = await import("@/utils/ai/tools/events")
            return getUpcomingEvents(parsed.city, parsed.limit ?? 10)
        }
        case "find_hidden_gems": {
            const { findHiddenGems } = await import("@/utils/ai/tools/hidden-gems")
            return findHiddenGems(parsed.city, parsed.limit ?? 10)
        }
        case "find_cafes_with_feature": {
            const { findCafesWithFeature } = await import("@/utils/ai/tools/feature-search")
            return findCafesWithFeature(parsed)
        }
        case "get_cafe_stats": {
            const { getCafeStats } = await import("@/utils/ai/tools/cafe-stats")
            return getCafeStats(parsed.city)
        }
        default:
            throw new Error(`Unknown tool: ${toolName}`)
    }
}
