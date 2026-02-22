import type { ChatCrawlDraft, ChatCrawlItem } from "@/utils/types/chat"
import type { ToolCallRecord } from "@/utils/ai/chat-tools"

const CRAWL_KEYWORDS = ["crawl", "route", "trail", "itinerary", "tour"]
const MAX_ITEMS = 8

function hasCrawlIntent(message: string): boolean {
    const text = message.toLowerCase()
    return CRAWL_KEYWORDS.some((k) => text.includes(k))
}

function toDraftItems(items: Record<string, unknown>[]): ChatCrawlItem[] {
    return items.slice(0, MAX_ITEMS).map((cafe, index) => ({
        cafeId: String(cafe.id ?? ""),
        name: String(cafe.name ?? cafe.title ?? ""),
        slug: String(cafe.slug ?? ""),
        thumbnail: typeof cafe.thumbnail === "string" ? cafe.thumbnail : null,
        cityMunicipality: typeof cafe.cityMunicipality === "string" ? cafe.cityMunicipality : null,
        region: typeof cafe.region === "string" ? cafe.region : null,
        lat: typeof cafe.lat === "number" ? cafe.lat : null,
        lng: typeof cafe.lng === "number" ? cafe.lng : null,
        sortOrder: index,
        note: null,
    }))
}

function buildTitle(params: Record<string, unknown>): string {
    if (typeof params.city === "string" && params.city) return `${params.city} Coffee Crawl`
    if (typeof params.province === "string" && params.province) return `${params.province} Coffee Crawl`
    if (typeof params.region === "string" && params.region) return `${params.region} Coffee Crawl`
    return "Custom Coffee Crawl"
}

export function buildChatCrawlDraft(
    records: ToolCallRecord[],
    message: string
): ChatCrawlDraft | null {
    if (!hasCrawlIntent(message)) return null

    for (const record of records) {
        if (!record || typeof record !== "object") continue
        const { toolName, params, result } = record
        if (!result || typeof result !== "object") continue

        if (toolName === "query_cafes" && Array.isArray((result as any).cafes)) {
            const items = toDraftItems((result as any).cafes)
            if (!items.length) return null
            return {
                title: buildTitle(params as Record<string, unknown>),
                description: "A short crawl curated from your request.",
                isPublic: false,
                items,
            }
        }

        if ((toolName === "get_nearby_cafes" || toolName === "get_top_rated") && Array.isArray(result)) {
            const items = toDraftItems(result as Record<string, unknown>[])
            if (!items.length) return null
            return {
                title: buildTitle(params as Record<string, unknown>),
                description: "A short crawl curated from your request.",
                isPublic: false,
                items,
            }
        }
    }

    return null
}
