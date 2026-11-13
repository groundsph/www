"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { getNearbyCafes, type NearbyCafeDetail } from "@/app/api/actions/nearby"
import { useUserLocation, type UseUserLocationReturn } from "@/hooks/useUserLocation"
import {
    evaluatePresence,
    hasAutoOpenedThisLoad,
    markAutoOpenedThisLoad,
    markDismissed,
    markPrompted,
    type PresenceSample,
    type StorageLike,
} from "@/utils/cafe-presence"

/**
 * Watches the visitor's position and decides when it is defensible to ask
 * "Are you at <cafe>?".
 *
 * See `utils/cafe-presence.ts` for the rules; this hook only owns the browser
 * plumbing (watchPosition, visibility) and the cafe lookup.
 */

/** Radius we look up cafes in. Slightly wider than the presence radius so the gate, not the query, decides. */
const LOOKUP_RADIUS_METERS = 150
/** How often we push a sample into the presence window. */
const SAMPLE_INTERVAL_MS = 15_000
/** Only the tail of the visit matters; bounded so memory stays flat. */
const MAX_SAMPLES = 40

export interface UseCafePresenceReturn {
    /** Nearest cafe within the check-in radius, with display detail. */
    nearbyCafe: NearbyCafeDetail | null
    /** True once the confidence gate passes and the prompt has not been suppressed. */
    shouldPrompt: boolean
    /** Why we are not prompting — for debugging and analytics, not for UI. */
    reason: string | null
    /** Metres to the nearest cafe, when known. */
    distance: number | null
    /** Reported GPS accuracy in metres. */
    accuracy: number | null
    /** Call when an auto-open prompt is actually shown. */
    markPromptShown: () => void
    /** Call when the visitor declines. Suppresses this cafe for a week. */
    dismiss: () => void
    /** Call after an explicit tap, so the same cafe is not offered again today. */
    markManualPrompt: () => void
}

function getStorage(): StorageLike | null {
    if (typeof window === "undefined") return null
    try {
        return window.localStorage
    } catch {
        return null
    }
}

export interface UseCafePresenceOptions {
    /**
     * Location state from an existing `useUserLocation` call. Pass it when the
     * page already tracks location, so we do not fire a second GPS request and
     * a second Nominatim reverse geocode on page load.
     */
    userLocation?: UseUserLocationReturn
}

export function useCafePresence(
    options: UseCafePresenceOptions = {}
): UseCafePresenceReturn {
    const externalLocation = options.userLocation
    // Skip the internal fetch when the caller already owns one. The hook is
    // still called unconditionally to respect the rules of hooks.
    const internalLocation = useUserLocation({
        skipInitialFetch: Boolean(externalLocation),
    })
    const { location, source, isEstimate, permissionState } =
        externalLocation ?? internalLocation

    const [samples, setSamples] = useState<PresenceSample[]>([])
    const [nearbyCafe, setNearbyCafe] = useState<NearbyCafeDetail | null>(null)
    const [visible, setVisible] = useState(
        () => typeof document === "undefined" || document.visibilityState === "visible"
    )
    const [autoOpenedThisLoad, setAutoOpenedThisLoad] = useState(false)
    const [now, setNow] = useState(() => Date.now())

    // Storage handles never change for a page load, so a lazy initialiser is
    // both correct and cheaper than memoising the lookup.
    const [storage] = useState<StorageLike | null>(getStorage)
    const lastSampleAtRef = useRef(0)
    const lastLookupAtRef = useRef(0)
    const lastLookupCoordsRef = useRef<{ lat: number; lng: number } | null>(null)

    const gpsLat = location.lat
    const gpsLng = location.lng

    // ------------------------------------------------------------------
    // Visibility: never interrupt from a background tab
    // ------------------------------------------------------------------
    useEffect(() => {
        if (typeof document === "undefined") return

        const onChange = () => setVisible(document.visibilityState === "visible")
        document.addEventListener("visibilitychange", onChange)
        return () => document.removeEventListener("visibilitychange", onChange)
    }, [])

    // ------------------------------------------------------------------
    // Sampling
    //
    // useUserLocation gives us a single fix. Presence needs a series, so we
    // watch the position once we know GPS is permitted. watchPosition also
    // keeps working when the tab regains focus, which is exactly when a
    // visitor has walked into a cafe.
    // ------------------------------------------------------------------
    useEffect(() => {
        if (typeof window === "undefined" || !navigator.geolocation) return
        if (source !== "gps" || isEstimate) return
        if (permissionState === "denied") return

        let watchId: number | null = null

        const pushSample = (position: GeolocationPosition) => {
            const timestamp = Date.now()
            if (timestamp - lastSampleAtRef.current < SAMPLE_INTERVAL_MS) return
            lastSampleAtRef.current = timestamp

            const sample: PresenceSample = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp,
            }

            setSamples((previous) => {
                const next = [...previous, sample]
                return next.length > MAX_SAMPLES ? next.slice(-MAX_SAMPLES) : next
            })
            setNow(timestamp)
        }

        try {
            watchId = navigator.geolocation.watchPosition(
                pushSample,
                () => {
                    // watchPosition already surfaced the error via useUserLocation.
                },
                {
                    enableHighAccuracy: false,
                    maximumAge: 10_000,
                    timeout: 20_000,
                }
            )
        } catch {
            watchId = null
        }

        return () => {
            if (watchId !== null) navigator.geolocation.clearWatch(watchId)
        }
    }, [source, isEstimate, permissionState])

    // ------------------------------------------------------------------
    // Cafe lookup
    //
    // Cached per ~40m of movement so walking around a mall does not hammer
    // the server with a query per GPS tick.
    // ------------------------------------------------------------------
    useEffect(() => {
        if (gpsLat == null || gpsLng == null) return
        if (source !== "gps" || isEstimate) return

        const previous = lastLookupCoordsRef.current
        const movedMeters = previous
            ? Math.abs(gpsLat - previous.lat) * 111_000 +
              Math.abs(gpsLng - previous.lng) * 111_000 * Math.cos((gpsLat * Math.PI) / 180)
            : Number.POSITIVE_INFINITY

        if (movedMeters < 40) return
        if (Date.now() - lastLookupAtRef.current < 30_000) return

        let cancelled = false
        lastLookupAtRef.current = Date.now()
        lastLookupCoordsRef.current = { lat: gpsLat, lng: gpsLng }

        getNearbyCafes(gpsLat, gpsLng, 3, LOOKUP_RADIUS_METERS)
            .then((results) => {
                if (cancelled) return
                // Clearing to null when nothing is near is deliberate: the
                // previous implementation kept a stale cafe forever, so a
                // visitor who drove home still saw "Are you at <cafe>?".
                setNearbyCafe(results[0] ?? null)
            })
            .catch(() => {
                if (cancelled) return
                setNearbyCafe(null)
            })

        return () => {
            cancelled = true
        }
    }, [gpsLat, gpsLng, source, isEstimate])

    // ------------------------------------------------------------------
    // Ticker so dwell progress resolves without waiting for a new GPS fix
    // ------------------------------------------------------------------
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 15_000)
        return () => clearInterval(interval)
    }, [])

    const decision = useMemo(() => {
        if (!nearbyCafe || nearbyCafe.lat == null || nearbyCafe.lng == null) {
            return { shouldPrompt: false, reason: "no-cafe", distance: null, accuracy: null }
        }

        return evaluatePresence(
            samples,
            {
                cafeId: nearbyCafe.id,
                cafeLat: nearbyCafe.lat,
                cafeLng: nearbyCafe.lng,
            },
            {
                source,
                isEstimate,
                visible,
                autoOpenedThisLoad: autoOpenedThisLoad || hasAutoOpenedThisLoad(storage),
                now,
                storage,
            }
        )
    }, [
        nearbyCafe,
        samples,
        source,
        isEstimate,
        visible,
        autoOpenedThisLoad,
        now,
        storage,
    ])

    const markPromptShown = useCallback(() => {
        setAutoOpenedThisLoad(true)
        if (!nearbyCafe) return
        markPrompted(storage, nearbyCafe.id, Date.now())
        markAutoOpenedThisLoad(storage)
    }, [nearbyCafe, storage])

    const dismiss = useCallback(() => {
        if (!nearbyCafe) return
        markDismissed(storage, nearbyCafe.id, Date.now())
        setAutoOpenedThisLoad(true)
    }, [nearbyCafe, storage])

    const markManualPrompt = useCallback(() => {
        if (!nearbyCafe) return
        markPrompted(storage, nearbyCafe.id, Date.now())
    }, [nearbyCafe, storage])

    return {
        nearbyCafe,
        shouldPrompt: decision.shouldPrompt,
        reason: decision.reason,
        distance: decision.distance,
        accuracy: decision.accuracy,
        markPromptShown,
        dismiss,
        markManualPrompt,
    }
}
