"use client"

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import { getCurrentWeather, type WeatherResult } from "@/app/api/actions/weather"

/**
 * One weather observation per visitor, held on the client.
 *
 * Weather is a property of *where you are*, not of what you are looking at, so it
 * is fetched once for a location and reused by everything that needs it. Before
 * this, every "Surprise Me" roll re-fetched the forecast because the request was
 * bundled into a per-cafe server action — the same observation, fetched again and
 * again, with the previous result thrown away each time.
 *
 * Rules:
 * - Keyed by a ~5 km grid cell, the same grid the server snaps to, so walking
 *   across a mall does not refetch and moving to another city does.
 * - Fresh for ten minutes, then refreshed in the background.
 * - The last value is kept while a refresh is in flight, so the chip does not
 *   blink out and the pick does not disappear.
 * - Memory only. Nothing is persisted: a reload is a new session and a fresh look.
 */

/** How long an observation stays fresh. */
export const WEATHER_TTL_MS = 10 * 60 * 1000
/** Must match `COORD_GRID` in `app/api/actions/weather.ts`. */
const COORD_GRID = 0.05

function snap(value: number): number {
    return Math.round(value / COORD_GRID) * COORD_GRID
}

function gridKey(lat: number, lng: number): string {
    return `${snap(lat).toFixed(4)},${snap(lng).toFixed(4)}`
}

interface WeatherContextValue {
    /** The current observation, or null before the first successful lookup. */
    weather: WeatherResult | null
    /** True while a lookup is in flight. Never clears `weather`. */
    isLoading: boolean
    /** When `weather` was retrieved, in epoch ms. */
    fetchedAt: number | null
    /**
     * Tell the provider where the visitor is. Call it whenever location becomes
     * available; repeated calls with the same grid cell are free.
     */
    setLocation: (lat: number | null | undefined, lng: number | null | undefined) => void
    /** Force a lookup now, e.g. a pull-to-refresh. */
    refresh: () => void
}

const WeatherContext = createContext<WeatherContextValue>({
    weather: null,
    isLoading: false,
    fetchedAt: null,
    setLocation: () => {},
    refresh: () => {},
})

export function useWeather(): WeatherContextValue {
    return useContext(WeatherContext)
}

interface WeatherProviderProps {
    children: React.ReactNode
    /** Injectable clock, for tests. */
    now?: () => number
}

export default function WeatherProvider({ children, now = Date.now }: WeatherProviderProps) {
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
    const [weather, setWeather] = useState<WeatherResult | null>(null)
    const [fetchedAt, setFetchedAt] = useState<number | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    /** Grid cell the held observation belongs to. */
    const heldKeyRef = useRef<string | null>(null)
    /** Mirrors `fetchedAt` so `load` can stay referentially stable. */
    const fetchedAtRef = useRef<number | null>(null)
    /** Monotonic request id, so a slow response cannot overwrite a newer one. */
    const requestIdRef = useRef(0)

    const setLocation = useCallback(
        (lat: number | null | undefined, lng: number | null | undefined) => {
            if (typeof lat !== "number" || typeof lng !== "number") return
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return

            // Round before storing so a jittery GPS fix does not churn state.
            const snappedLat = snap(lat)
            const snappedLng = snap(lng)

            setCoords((previous) => {
                if (
                    previous &&
                    previous.lat === snappedLat &&
                    previous.lng === snappedLng
                ) {
                    return previous
                }
                return { lat: snappedLat, lng: snappedLng }
            })
        },
        []
    )

    const load = useCallback(
        async (lat: number, lng: number, force: boolean) => {
            const key = gridKey(lat, lng)
            const isSamePlace = heldKeyRef.current === key
            const heldAt = fetchedAtRef.current

            // A different place: the held observation describes somewhere else,
            // so drop it rather than label this city with another's weather. The
            // keep-the-last-value rule only applies to refreshing the same cell.
            if (!isSamePlace && heldKeyRef.current !== null) {
                setWeather(null)
                setFetchedAt(null)
                fetchedAtRef.current = null
            }

            if (
                !force &&
                isSamePlace &&
                heldAt !== null &&
                now() - heldAt < WEATHER_TTL_MS
            ) {
                return
            }

            const requestId = ++requestIdRef.current
            setIsLoading(true)

            const result = await getCurrentWeather(lat, lng)

            // A newer request superseded this one, or the component unmounted.
            if (requestId !== requestIdRef.current) return

            if (result) {
                const at = now()
                setWeather(result)
                setFetchedAt(at)
                fetchedAtRef.current = at
                heldKeyRef.current = key
            }
            // On failure the previous observation is kept: a stale forecast beats
            // an empty chip, and the next tick will try again.

            setIsLoading(false)
        },
        [now]
    )

    // Fetch when the location changes, and keep it fresh while it stays put.
    useEffect(() => {
        if (!coords) return

        // Fetching when the location changes is this effect's entire job; the
        // state it sets is the incoming observation, not a render loop.
        // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch keyed on location
        void load(coords.lat, coords.lng, false)

        const interval = setInterval(() => {
            void load(coords.lat, coords.lng, true)
        }, WEATHER_TTL_MS)

        return () => clearInterval(interval)
    }, [coords, load])

    const refresh = useCallback(() => {
        if (!coords) return
        void load(coords.lat, coords.lng, true)
    }, [coords, load])

    const value = useMemo<WeatherContextValue>(
        () => ({ weather, isLoading, fetchedAt, setLocation, refresh }),
        [weather, isLoading, fetchedAt, setLocation, refresh]
    )

    return <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>
}
