import type { ChatCrawlDraft } from "@/utils/types/chat"
import type { ToolCallRecord } from "@/utils/ai/chat-tools"
import { buildRoutePlan } from "@/utils/crawls/route-planner"

const CRAWL_KEYWORDS = ["crawl", "route", "trail", "itinerary", "tour"]
const MAX_ITEMS = 8

function hasCrawlIntent(message: string): boolean {
    const text = message.toLowerCase()
    return CRAWL_KEYWORDS.some((k) => text.includes(k))
}

function toRouteCafes(items: Record<string, unknown>[]) {
    return items.slice(0, MAX_ITEMS).map((cafe) => ({
        id: String(cafe.id ?? ""),
        name: String(cafe.name ?? cafe.title ?? ""),
        slug: String(cafe.slug ?? ""),
        lat: typeof cafe.lat === "number" ? cafe.lat : null,
        lng: typeof cafe.lng === "number" ? cafe.lng : null,
    }))
}

function buildTitle(params: Record<string, unknown>): string {
    if (typeof params.city === "string" && params.city) return `${params.city} Coffee Crawl`
    if (typeof params.province === "string" && params.province) return `${params.province} Coffee Crawl`
    if (typeof params.region === "string" && params.region) return `${params.region} Coffee Crawl`
    return "Custom Coffee Crawl"
}

export async function buildChatCrawlDraft(
    records: ToolCallRecord[],
    message: string
): Promise<ChatCrawlDraft | null> {
    if (!hasCrawlIntent(message)) return null

    for (const record of records) {
        if (!record || typeof record !== "object") continue
        const { toolName, params, result } = record
        if (!result || typeof result !== "object") continue

        if (toolName === "query_cafes" && Array.isArray((result as Record<string, unknown>).cafes)) {
            const cafes = (result as Record<string, unknown>).cafes as Record<string, unknown>[]
            if (!cafes.length) return null
            const routeCafes = toRouteCafes(cafes)
            const plan = await buildRoutePlan(routeCafes, {
                startDay: "mon",
                startTime: "09:00",
                travelMode: "foot",
            })
            const items = plan.ordered.map((item, index) => ({
                cafeId: item.id,
                name: item.name,
                slug: item.slug,
                thumbnail: typeof cafes[index]?.thumbnail === "string" ? (cafes[index]?.thumbnail as string) : null,
                cityMunicipality: typeof cafes[index]?.cityMunicipality === "string" ? (cafes[index]?.cityMunicipality as string) : null,
                region: typeof cafes[index]?.region === "string" ? (cafes[index]?.region as string) : null,
                lat: item.lat,
                lng: item.lng,
                sortOrder: index,
                note: null,
            }))
            return {
                title: buildTitle(params as Record<string, unknown>),
                description: plan.reason,
                isPublic: false,
                items,
            }
        }

        if ((toolName === "get_nearby_cafes" || toolName === "get_top_rated") && Array.isArray(result)) {
            const cafes = result as Record<string, unknown>[]
            if (!cafes.length) return null
            const routeCafes = toRouteCafes(cafes)
            const plan = await buildRoutePlan(routeCafes, {
                startDay: "mon",
                startTime: "09:00",
                travelMode: "foot",
            })
            const items = plan.ordered.map((item, index) => ({
                cafeId: item.id,
                name: item.name,
                slug: item.slug,
                thumbnail: typeof cafes[index]?.thumbnail === "string" ? (cafes[index]?.thumbnail as string) : null,
                cityMunicipality: typeof cafes[index]?.cityMunicipality === "string" ? (cafes[index]?.cityMunicipality as string) : null,
                region: typeof cafes[index]?.region === "string" ? (cafes[index]?.region as string) : null,
                lat: item.lat,
                lng: item.lng,
                sortOrder: index,
                note: null,
            }))
            return {
                title: buildTitle(params as Record<string, unknown>),
                description: plan.reason,
                isPublic: false,
                items,
            }
        }
    }

    return null
}
