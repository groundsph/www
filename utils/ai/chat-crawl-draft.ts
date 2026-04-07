import type { ChatCrawlDraft, ChatContext, ToolCallRecord } from "@/utils/types/chat"
import type { OperatingHours } from "@/utils/types/cafe"
import { buildRoutePlan } from "@/utils/crawls/route-planner"

const CRAWL_KEYWORDS = ["crawl", "route", "trail", "itinerary", "tour"]
const CONTEXT_REFERENCE_KEYWORDS = [
    "from those",
    "from them",
    "from these",
    "from that",
    "from that list",
    "from the list",
    "previous list",
    "last list",
    "those cafes",
    "these cafes",
    "closest",
    "nearby",
    "near me",
    "first",
    "top",
    "same list",
]
const MAX_ITEMS = 8

function hasCrawlIntent(message: string): boolean {
    const text = message.toLowerCase()
    return CRAWL_KEYWORDS.some((k) => text.includes(k))
}

function shouldUseRecentContext(message: string): boolean {
    const text = message.toLowerCase()
    return CONTEXT_REFERENCE_KEYWORDS.some((k) => text.includes(k))
}

function getRequestedCount(message: string, fallback: number): number {
    const text = message.toLowerCase()
    const match = text.match(/\b(first|top|closest)\s+(\d+)\b/)
    if (!match) return fallback
    const count = Number.parseInt(match[2], 10)
    if (Number.isNaN(count) || count <= 0) return fallback
    return Math.min(count, fallback)
}

function toRouteCafes(items: Record<string, unknown>[]) {
    return items.slice(0, MAX_ITEMS).map((cafe) => ({
        id: String(cafe.id ?? ""),
        name: String(cafe.name ?? cafe.title ?? ""),
        slug: String(cafe.slug ?? ""),
        lat: typeof cafe.lat === "number" ? cafe.lat : null,
        lng: typeof cafe.lng === "number" ? cafe.lng : null,
        operatingHours: (cafe.operatingHours as OperatingHours) ?? null,
    }))
}

function buildTitle(params: Record<string, unknown>): string {
    if (typeof params.city === "string" && params.city) return `${params.city} Coffee Crawl`
    if (typeof params.province === "string" && params.province) return `${params.province} Coffee Crawl`
    if (typeof params.region === "string" && params.region) return `${params.region} Coffee Crawl`
    return "Custom Coffee Crawl"
}

function parseCrawlTimePreferences(message: string) {
    const lower = message.toLowerCase()
    const dayMap: Record<string, "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat"> = {
        sunday: "sun",
        sun: "sun",
        monday: "mon",
        mon: "mon",
        tuesday: "tue",
        tue: "tue",
        wednesday: "wed",
        wed: "wed",
        thursday: "thu",
        thu: "thu",
        friday: "fri",
        fri: "fri",
        saturday: "sat",
        sat: "sat",
    }
    const dayMatch = Object.keys(dayMap).find((d) => lower.includes(d))
    const timeMatch = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/)
    const day = dayMatch ? dayMap[dayMatch] : "sat"
    let time = "09:00"
    if (timeMatch) {
        const h = Number(timeMatch[1]) % 12
        const m = Number(timeMatch[2] ?? "00")
        const isPm = timeMatch[3] === "pm"
        const hh = String(h + (isPm ? 12 : 0)).padStart(2, "0")
        const mm = String(m).padStart(2, "0")
        time = `${hh}:${mm}`
    }
    return { day, time }
}

export async function buildChatCrawlDraft(
    records: ToolCallRecord[],
    message: string,
    context?: ChatContext
): Promise<ChatCrawlDraft | null> {
    const recentCafesCount = context?.recentCafes?.length ?? 0
    const crawlIntent = hasCrawlIntent(message)
    const useContext = shouldUseRecentContext(message)



    // Check for recent cafes when crawl intent is present
    if (recentCafesCount > 0 && crawlIntent && useContext) {
        const prefs = parseCrawlTimePreferences(message)
        const requestedCount = getRequestedCount(message, Math.min(recentCafesCount, MAX_ITEMS))
        const limitedCafes = context!.recentCafes!.slice(0, requestedCount)
        const routeCafes = limitedCafes.map((cafe) => ({
            id: cafe.id,
            name: cafe.title,
            slug: cafe.slug,
            lat: cafe.lat ?? null,
            lng: cafe.lng ?? null,
            operatingHours: null,
        }))

        const plan = await buildRoutePlan(routeCafes, {
            startDay: prefs.day,
            startTime: prefs.time,
            travelMode: "foot",
        })

        const items = plan.ordered.map((item, index) => {
            const originalCafe = limitedCafes.find((c) => c.id === item.id)
            const scheduleItem = plan.schedule.find((s) => s.cafeId === item.id)
            return {
                cafeId: item.id,
                name: item.name,
                slug: item.slug,
                thumbnail: originalCafe?.coverImageUrl ?? null,
                cityMunicipality: originalCafe?.city ?? null,
                region: null,
                lat: item.lat,
                lng: item.lng,
                sortOrder: index,
                note: scheduleItem?.note ?? null,
            }
        })

        return {
            title: "Coffee Crawl",
            description: plan.reason,
            isPublic: false,
            items,
        }
    }

    if (!hasCrawlIntent(message)) return null

    const prefs = parseCrawlTimePreferences(message)

    for (const record of records) {
        if (!record || typeof record !== "object") continue
        const { toolName, params, result } = record
        if (!result || typeof result !== "object") continue

        if (toolName === "query_cafes" && Array.isArray((result as Record<string, unknown>).cafes)) {
            const cafes = (result as Record<string, unknown>).cafes as Record<string, unknown>[]
            if (!cafes.length) return null
            const requestedCount = getRequestedCount(message, Math.min(cafes.length, MAX_ITEMS))
            const limitedCafes = cafes.slice(0, requestedCount)
            const routeCafes = toRouteCafes(limitedCafes)
            const plan = await buildRoutePlan(routeCafes, {
                startDay: prefs.day,
                startTime: prefs.time,
                travelMode: "foot",
            })
            const cafeMap = new Map(limitedCafes.map((c) => [String(c.id), c]))
            const items = plan.ordered.map((item, index) => {
                const originalCafe = cafeMap.get(item.id)
                const scheduleItem = plan.schedule.find((s) => s.cafeId === item.id)
                return {
                    cafeId: item.id,
                    name: item.name,
                    slug: item.slug,
                    thumbnail: typeof originalCafe?.thumbnail === "string" ? (originalCafe?.thumbnail as string) : null,
                    cityMunicipality: typeof originalCafe?.cityMunicipality === "string" ? (originalCafe?.cityMunicipality as string) : null,
                    region: typeof originalCafe?.region === "string" ? (originalCafe?.region as string) : null,
                    lat: item.lat,
                    lng: item.lng,
                    sortOrder: index,
                    note: scheduleItem?.note ?? null,
                }
            })
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
            const requestedCount = getRequestedCount(message, Math.min(cafes.length, MAX_ITEMS))
            const limitedCafes = cafes.slice(0, requestedCount)
            const routeCafes = toRouteCafes(limitedCafes)
            const plan = await buildRoutePlan(routeCafes, {
                startDay: prefs.day,
                startTime: prefs.time,
                travelMode: "foot",
            })
            const cafeMap = new Map(limitedCafes.map((c) => [String(c.id), c]))
            const items = plan.ordered.map((item, index) => {
                const originalCafe = cafeMap.get(item.id)
                const scheduleItem = plan.schedule.find((s) => s.cafeId === item.id)
                return {
                    cafeId: item.id,
                    name: item.name,
                    slug: item.slug,
                    thumbnail: typeof originalCafe?.thumbnail === "string" ? (originalCafe?.thumbnail as string) : null,
                    cityMunicipality: typeof originalCafe?.cityMunicipality === "string" ? (originalCafe?.cityMunicipality as string) : null,
                    region: typeof originalCafe?.region === "string" ? (originalCafe?.region as string) : null,
                    lat: item.lat,
                    lng: item.lng,
                    sortOrder: index,
                    note: scheduleItem?.note ?? null,
                }
            })
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
