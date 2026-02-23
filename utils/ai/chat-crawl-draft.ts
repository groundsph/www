import type { ChatCrawlDraft } from "@/utils/types/chat"
import type { ToolCallRecord } from "@/utils/ai/chat-tools"
import type { OperatingHours } from "@/utils/types/cafe"
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
    message: string
): Promise<ChatCrawlDraft | null> {
    if (!hasCrawlIntent(message)) return null

    const prefs = parseCrawlTimePreferences(message)

    for (const record of records) {
        if (!record || typeof record !== "object") continue
        const { toolName, params, result } = record
        if (!result || typeof result !== "object") continue

        if (toolName === "query_cafes" && Array.isArray((result as Record<string, unknown>).cafes)) {
            const cafes = (result as Record<string, unknown>).cafes as Record<string, unknown>[]
            if (!cafes.length) return null
            const routeCafes = toRouteCafes(cafes)
            const plan = await buildRoutePlan(routeCafes, {
                startDay: prefs.day,
                startTime: prefs.time,
                travelMode: "foot",
            })
            const cafeMap = new Map(cafes.map((c) => [String(c.id), c]))
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
            const routeCafes = toRouteCafes(cafes)
            const plan = await buildRoutePlan(routeCafes, {
                startDay: prefs.day,
                startTime: prefs.time,
                travelMode: "foot",
            })
            const cafeMap = new Map(cafes.map((c) => [String(c.id), c]))
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
