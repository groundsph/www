import type { ChatCafeCard, ChatCardContext } from "@/utils/types/chat"
import type { ToolCallRecord } from "@/utils/ai/chat-tools"

type CardResult = { cafes: ChatCafeCard[]; cardContext?: ChatCardContext }

function buildFilters(cafe: Record<string, unknown>): string[] {
    const filters: string[] = []
    if (cafe.hasWifi) filters.push("WiFi")
    if (cafe.hasSockets) filters.push("Sockets")
    if (cafe.isWorkFriendly) filters.push("Work-friendly")
    if (cafe.isPetFriendly) filters.push("Pet-friendly")
    if (cafe.servesFood) filters.push("Food")
    if (cafe.hasOutdoorSeating) filters.push("Outdoor")
    return filters
}

function buildFlags(cafe: Record<string, unknown>): string[] {
    const flags: string[] = []
    if (cafe.isHalalCertified) flags.push("Halal")
    return flags
}

function buildContext(toolName: string, params: Record<string, unknown>): ChatCardContext {
    if (toolName === "get_nearby_cafes") {
        return {
            queryType: "nearby",
            title: "Near you",
            subtitle: "Based on your location",
            custom: "Near you",
        }
    }
    if (toolName === "get_top_rated") {
        return {
            queryType: "top_rated",
            title: typeof params.city === "string" ? params.city : "Top rated",
            subtitle: "Top rated cafes",
            custom: "Top rated",
        }
    }
    if (toolName === "query_cafes") {
        const label =
            (typeof params.city === "string" && params.city) ||
            (typeof params.province === "string" && params.province) ||
            (typeof params.region === "string" && params.region) ||
            "Search results"
        return {
            queryType: "search",
            title: label,
            subtitle: "Matching cafes",
            custom: label,
        }
    }
    return { queryType: "unknown" }
}

function toCard(cafe: Record<string, unknown>, custom?: string): ChatCafeCard {
    return {
        id: String(cafe.id ?? ""),
        slug: String(cafe.slug ?? ""),
        title: String(cafe.name ?? cafe.title ?? ""),
        coverImageUrl: typeof cafe.thumbnail === "string" ? cafe.thumbnail : null,
        city: typeof cafe.cityMunicipality === "string" ? cafe.cityMunicipality : null,
        province: typeof cafe.province === "string" ? cafe.province : null,
        rating: typeof cafe.rating === "number" ? cafe.rating : null,
        reviewCount: typeof cafe.totalReviews === "number" ? cafe.totalReviews : null,
        lat: typeof cafe.lat === "number" ? cafe.lat : null,
        lng: typeof cafe.lng === "number" ? cafe.lng : null,
        filters: buildFilters(cafe),
        flags: buildFlags(cafe),
        custom,
    }
}

export function buildChatCafeCards(records: ToolCallRecord[]): CardResult {
    for (const record of records) {
        if (!record || typeof record !== "object") continue
        const { toolName, params, result } = record
        if (!result || typeof result !== "object") continue

        if (toolName === "query_cafes" && "cafes" in result && Array.isArray(result.cafes)) {
            const context = buildContext(toolName, params as Record<string, unknown>)
            const cafes = result.cafes.map((cafe: Record<string, unknown>) =>
                toCard(cafe, context.custom)
            )
            return { cafes, cardContext: context }
        }

        if ((toolName === "get_nearby_cafes" || toolName === "get_top_rated") && Array.isArray(result)) {
            const context = buildContext(toolName, params as Record<string, unknown>)
            const cafes = result.map((cafe: Record<string, unknown>) => toCard(cafe, context.custom))
            return { cafes, cardContext: context }
        }

        if (toolName === "get_cafe_by_slug" && result) {
            const context = buildContext(toolName, params as Record<string, unknown>)
            return { cafes: [toCard(result as Record<string, unknown>, context.custom)], cardContext: context }
        }

        if (toolName === "compare_cafes" && result && typeof result === "object") {
            const context = buildContext(toolName, params as Record<string, unknown>)
            const compareResult = result as { cafeA?: Record<string, unknown>; cafeB?: Record<string, unknown> }
            const cafes = [
                compareResult.cafeA ? toCard(compareResult.cafeA, context.custom) : null,
                compareResult.cafeB ? toCard(compareResult.cafeB, context.custom) : null,
            ].filter(Boolean) as ChatCafeCard[]
            return { cafes, cardContext: context }
        }
    }

    return { cafes: [] }
}
