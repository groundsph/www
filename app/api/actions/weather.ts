"use server"

import { db } from "@/db"
import { cafeMenuItems } from "@/db/schema"
import { and, eq, isNotNull } from "drizzle-orm"
import {
    rankMenuItemsForWeather,
    weatherLabel,
    type RankableMenuItem,
    type WeatherPick,
    type WeatherSummary,
} from "@/utils/weather-picks"

/**
 * Weather lookups and the "Surprise Me" recommendation that depends on them.
 *
 * The provider is wttr.in: no API key, no signup, and it accepts a coordinate
 * path directly (`/10.31,123.88?format=j1`), which is exactly the shape we have.
 */

const WTTR_ENDPOINT = "https://wttr.in"
const FETCH_TIMEOUT_MS = 6000
/** 15 minutes — long enough to collapse a burst of visitors, short enough to track the afternoon. */
const WEATHER_REVALIDATE_SECONDS = 900
/**
 * Snap coordinates to a ~5km grid before requesting. Every visitor in one city
 * then shares a single cache entry instead of one entry per GPS fix.
 */
const COORD_GRID = 0.05

export interface WeatherResult {
    weather: WeatherSummary
    /** Human readable label for UI chips, e.g. "32°C · Humid" */
    label: string
}

export interface SurprisePick {
    weather: WeatherResult | null
    pick: WeatherPick<RankableMenuItem> | null
}

function snap(value: number): number {
    return Math.round(value / COORD_GRID) * COORD_GRID
}

function isFiniteCoordinate(lat: unknown, lng: unknown): boolean {
    return (
        typeof lat === "number" &&
        typeof lng === "number" &&
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
    )
}

function toNumber(value: unknown, fallback: number): number {
    const parsed =
        typeof value === "number" ? value : Number.parseFloat(String(value ?? ""))
    return Number.isFinite(parsed) ? parsed : fallback
}

/**
 * Normalise a wttr.in `current_condition[0]` payload. Missing fields fall back
 * rather than throwing, because the response shape is not versioned.
 */
function parseCondition(
    condition: Record<string, unknown> | undefined
): WeatherSummary | null {
    if (!condition || typeof condition !== "object") return null

    const tempC = toNumber(condition.temp_C, Number.NaN)
    if (!Number.isFinite(tempC)) return null

    const weatherDesc = condition.weatherDesc
    const description =
        Array.isArray(weatherDesc) && weatherDesc.length > 0
            ? String((weatherDesc[0] as Record<string, unknown>)?.value ?? "")
            : ""

    return {
        tempC,
        feelsLikeC: toNumber(condition.FeelsLikeC, tempC),
        humidity: toNumber(condition.humidity, 0),
        precipMM: toNumber(condition.precipMM, 0),
        condition: description.trim(),
        weatherCode: toNumber(condition.weatherCode, 0),
    }
}

/**
 * Get the current weather for a coordinate. Returns `null` on any failure —
 * callers degrade to "no weather context" rather than surfacing an error,
 * because a missing forecast must never block the random cafe flow.
 */
export async function getCurrentWeather(
    lat: number,
    lng: number
): Promise<WeatherResult | null> {
    if (!isFiniteCoordinate(lat, lng)) return null

    const requestLat = snap(lat).toFixed(4)
    const requestLng = snap(lng).toFixed(4)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    try {
        const response = await fetch(
            `${WTTR_ENDPOINT}/${requestLat},${requestLng}?format=j1`,
            {
                signal: controller.signal,
                headers: { "User-Agent": "GroundsPH/1.0 (+https://grounds.ph)" },
                next: { revalidate: WEATHER_REVALIDATE_SECONDS },
            }
        )

        if (!response.ok) return null

        const data = (await response.json()) as {
            current_condition?: Record<string, unknown>[]
        }

        const weather = parseCondition(data?.current_condition?.[0])
        if (!weather) return null

        return { weather, label: weatherLabel(weather) }
    } catch (error) {
        // Aborts are expected on slow networks; keep this to a single quiet line.
        console.error(
            "[weather] lookup failed:",
            error instanceof Error ? error.message : error
        )
        return null
    } finally {
        clearTimeout(timeoutId)
    }
}

async function getRankableMenuItems(cafeId: string): Promise<RankableMenuItem[]> {
    if (!cafeId) return []

    try {
        return await db
            .select({
                id: cafeMenuItems.id,
                name: cafeMenuItems.name,
                price: cafeMenuItems.price,
                isSignature: cafeMenuItems.isSignature,
                isAvailable: cafeMenuItems.isAvailable,
                isFood: cafeMenuItems.isFood,
                isHot: cafeMenuItems.isHot,
                isCold: cafeMenuItems.isCold,
                sortOrder: cafeMenuItems.sortOrder,
            })
            .from(cafeMenuItems)
            .where(
                and(
                    eq(cafeMenuItems.cafeId, cafeId),
                    isNotNull(cafeMenuItems.name)
                )
            )
    } catch (error) {
        console.error("[weather] menu lookup failed:", error)
        return []
    }
}

/**
 * Everything "Surprise Me" needs for the cafe it just rolled: the weather at the
 * visitor's location and the best-matching drink on that cafe's menu.
 *
 * Deliberately one round trip. Both halves are optional — a missing forecast or
 * an empty menu degrades to the other half rather than failing the call. With no
 * coordinates we skip the forecast entirely rather than guessing a city.
 */
export async function getSurprisePick(
    cafeId: string,
    lat?: number | null,
    lng?: number | null
): Promise<SurprisePick> {
    const [weather, menuItems] = await Promise.all([
        isFiniteCoordinate(lat, lng)
            ? getCurrentWeather(lat as number, lng as number)
            : Promise.resolve(null),
        getRankableMenuItems(cafeId),
    ])

    if (!weather || menuItems.length === 0) {
        return { weather, pick: null }
    }

    return {
        weather,
        pick: rankMenuItemsForWeather(menuItems, weather.weather),
    }
}
