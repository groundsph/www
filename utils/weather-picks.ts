/**
 * Weather-driven drink recommendations.
 *
 * Kept as pure functions (no fetch, no DB) so the ranking is deterministic and
 * testable in isolation — the network layer lives in `app/api/actions/weather.ts`.
 */

export interface WeatherSummary {
    /** Temperature in Celsius as reported by the station */
    tempC: number
    /** Apparent ("feels like") temperature in Celsius */
    feelsLikeC: number
    humidity: number
    /** Millimetres of precipitation in the current observation */
    precipMM: number
    /** Human readable condition, e.g. "Partly cloudy" */
    condition: string
    /** wttr.in weather code (113 = clear, 296 = light rain, ...) */
    weatherCode: number
}

export type WeatherClass = "rainy" | "hot" | "humid" | "cool" | "mild"

/** Minimal shape needed to rank a menu item. Mirrors the `cafe_menu_items` row. */
export interface RankableMenuItem {
    id: string
    name: string
    price: number
    isSignature?: boolean | null
    isAvailable?: boolean | null
    isFood?: boolean | null
    isHot?: boolean | null
    isCold?: boolean | null
    sortOrder?: number | null
}

export interface WeatherPick<T extends RankableMenuItem = RankableMenuItem> {
    item: T
    /** Short user-facing justification, e.g. "34°C and humid out" */
    reason: string
}

/**
 * wttr.in codes that mean "water is falling from the sky": drizzle, rain,
 * freezing rain, showers and thunder. Everything else is dry.
 */
const RAIN_CODES = new Set([
    176, 185, 263, 266, 281, 284, 293, 296, 299, 302, 305, 308, 311, 314, 317,
    320, 350, 353, 356, 359, 362, 365, 368, 371, 374, 377, 386, 389, 392, 395,
])

const HOT_FELT_C = 32
const COOL_TEMP_C = 22
const HUMID_PERCENT = 75
const HUMID_FELT_C = 28

export function isRainyWeather(weather: WeatherSummary): boolean {
    return weather.precipMM > 0 || RAIN_CODES.has(weather.weatherCode)
}

/**
 * Collapse a raw observation into the class that drives the recommendation.
 * Order matters: rain wins over heat (a rainy 34°C afternoon still wants a
 * warm drink far less than it wants to be acknowledged), heat wins over
 * humidity, and humidity only matters when it is genuinely sticky.
 */
export function classifyWeather(weather: WeatherSummary): WeatherClass {
    if (isRainyWeather(weather)) return "rainy"
    if (weather.feelsLikeC >= HOT_FELT_C) return "hot"
    if (weather.humidity >= HUMID_PERCENT && weather.feelsLikeC >= HUMID_FELT_C) {
        return "humid"
    }
    if (weather.tempC <= COOL_TEMP_C) return "cool"
    return "mild"
}

const WANTS_COLD: Record<WeatherClass, boolean> = {
    hot: true,
    humid: true,
    rainy: false,
    cool: false,
    mild: false,
}

/**
 * Use the station temperature, not the "feels like" figure: the UI chip shows
 * the actual reading, and a reason that silently quotes a different number
 * (26°C in the chip, 29°C in the sentence) reads like a bug.
 */
function formatTemperature(weather: WeatherSummary): string {
    return `${Math.round(weather.tempC)}°C`
}

/**
 * The one-line "why" shown next to the pick. This is what makes the
 * recommendation feel earned instead of decorative.
 */
export function weatherReason(weather: WeatherSummary): string {
    const temperature = formatTemperature(weather)

    switch (classifyWeather(weather)) {
        case "rainy":
            return `${temperature} and rainy — something warm`
        case "hot":
            return `${temperature} out — go cold`
        case "humid":
            return `${temperature} and ${Math.round(weather.humidity)}% humidity — go cold`
        case "cool":
            return `Cool at ${temperature} — a hot cup fits`
        default:
            return `${temperature} and mild — take your pick`
    }
}

/**
 * Price an item against the weather.
 *
 * Temperature match dominates because it is the whole point of the feature;
 * a signature drink and availability are tie-breakers; the opposite
 * temperature is a penalty rather than a hard exclusion so a cafe that only
 * sells hot coffee can still recommend its best cup on a hot day.
 */
function scoreItem(
    item: RankableMenuItem,
    weatherClass: WeatherClass,
    allowFood: boolean
): number {
    let score = 0

    if (item.isFood && !allowFood) return Number.NEGATIVE_INFINITY

    const wantsCold = WANTS_COLD[weatherClass]
    if (item.isCold && wantsCold) score += 3
    if (item.isHot && !wantsCold) score += 3
    if (item.isCold && !wantsCold) score -= 2
    if (item.isHot && wantsCold) score -= 2

    // An item that is neither hot nor cold (food, or a drink with no temperature
    // flag) is neutral on temperature but still eligible.
    if (item.isSignature) score += 2
    score += item.isAvailable === false ? -5 : 2

    return score
}

/**
 * Pick the best menu item for the current weather.
 *
 * Drinks are preferred. Food only participates when the cafe has no drinks at
 * all, which keeps a bakery from answering "what should I drink" with a
 * croissant. Returns `null` when there is nothing usable.
 */
export function rankMenuItemsForWeather<T extends RankableMenuItem>(
    items: readonly T[],
    weather: WeatherSummary
): WeatherPick<T> | null {
    if (items.length === 0) return null

    const weatherClass = classifyWeather(weather)
    const drinks = items.filter((item) => !item.isFood)
    const pool = drinks.length > 0 ? drinks : items
    const allowFood = drinks.length === 0

    const ranked = pool
        .map((item) => ({ item, score: scoreItem(item, weatherClass, allowFood) }))
        .filter((entry) => Number.isFinite(entry.score))
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score
            const orderA = a.item.sortOrder ?? 0
            const orderB = b.item.sortOrder ?? 0
            if (orderA !== orderB) return orderA - orderB
            return a.item.name.localeCompare(b.item.name)
        })

    if (ranked.length === 0) return null

    return { item: ranked[0].item, reason: weatherReason(weather) }
}

/**
 * Compact label for the UI chip, e.g. "32°C · Humid".
 */
export function weatherLabel(weather: WeatherSummary): string {
    const temperature = `${Math.round(weather.tempC)}°C`
    const condition = weather.condition?.trim()

    if (!condition) return temperature
    return `${temperature} · ${condition}`
}
