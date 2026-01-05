"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { getLocationFromIP } from "@/app/api/actions/location"

// ============================================================================
// Types
// ============================================================================

export interface UserLocation {
    city: string | null
    region: string | null
    lat: number | null
    lng: number | null
}

export type PermissionState = "granted" | "denied" | "prompt" | "unknown"

export type LocationSource = "gps" | "ip" | "cache" | null

export type GeolocationErrorCode =
    | "PERMISSION_DENIED"
    | "POSITION_UNAVAILABLE"
    | "TIMEOUT"
    | "IP_FALLBACK_FAILED"
    | "GEOCODING_FAILED"
    | "NOT_SUPPORTED"

export interface GeolocationError {
    code: GeolocationErrorCode
    message: string // User-friendly message
    technical?: string // Technical details for debugging
}

export interface UseUserLocationOptions {
    /** Callback fired when an error occurs */
    onError?: (error: GeolocationError) => void
    /** Number of retry attempts for geolocation (default: 1) */
    retryAttempts?: number
    /** Timeout in milliseconds (default: 10000) */
    timeout?: number
    /** Whether to skip initial fetch (useful for manual trigger) */
    skipInitialFetch?: boolean
}

export interface UseUserLocationReturn {
    location: UserLocation
    loading: boolean
    error: GeolocationError | null
    permissionState: PermissionState
    isEstimate: boolean
    source: LocationSource
    refresh: () => void
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TIMEOUT = 10000
const DEFAULT_RETRY_ATTEMPTS = 1
const CACHE_MAX_AGE = 300000 // 5 minutes

/** User-friendly error messages */
const ERROR_MESSAGES: Record<GeolocationErrorCode, string> = {
    PERMISSION_DENIED:
        "Location access denied. Showing cafes based on estimated location.",
    POSITION_UNAVAILABLE:
        "Could not determine precise location. Using estimated location.",
    TIMEOUT: "Location request timed out. Using estimated location.",
    IP_FALLBACK_FAILED:
        "Unable to estimate your location. Showing featured cafes.",
    GEOCODING_FAILED: "Could not determine your city. Using estimated location.",
    NOT_SUPPORTED: "Your browser doesn't support location services.",
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a GeolocationError object with consistent structure
 */
function createError(
    code: GeolocationErrorCode,
    technical?: string
): GeolocationError {
    return {
        code,
        message: ERROR_MESSAGES[code],
        technical,
    }
}

/**
 * Reverse geocode coordinates to get city/region using OpenStreetMap Nominatim
 */
async function reverseGeocode(
    latitude: number,
    longitude: number
): Promise<{ city: string | null; region: string | null }> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
            {
                headers: { "User-Agent": "Grounds Coffee App" },
                signal: controller.signal,
            }
        )

        clearTimeout(timeoutId)

        if (!response.ok) {
            throw new Error(`Nominatim returned ${response.status}`)
        }

        const data = await response.json()

        const city =
            data.address?.city ||
            data.address?.town ||
            data.address?.municipality ||
            data.address?.village ||
            null
        const region = data.address?.state || data.address?.region || null

        return { city, region }
    } catch (err) {
        clearTimeout(timeoutId)
        throw err
    }
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to get user's location via browser geolocation and reverse geocoding
 * Uses OpenStreetMap Nominatim for reverse geocoding
 * Falls back to IP-based geolocation if browser geolocation fails
 */
export function useUserLocation(
    options: UseUserLocationOptions = {}
): UseUserLocationReturn {
    const {
        onError,
        retryAttempts = DEFAULT_RETRY_ATTEMPTS,
        timeout = DEFAULT_TIMEOUT,
        skipInitialFetch = false,
    } = options

    const [location, setLocation] = useState<UserLocation>({
        city: null,
        region: null,
        lat: null,
        lng: null,
    })
    const [loading, setLoading] = useState(!skipInitialFetch)
    const [error, setError] = useState<GeolocationError | null>(null)
    const [permissionState, setPermissionState] =
        useState<PermissionState>("unknown")
    const [isEstimate, setIsEstimate] = useState(false)
    const [source, setSource] = useState<LocationSource>(null)

    // Refs to prevent re-fetching and loops
    const hasFetchedRef = useRef(false)
    const isFetchingRef = useRef(false)
    const hasNotifiedRef = useRef(false)

    // Store onError in ref to avoid dependency issues
    const onErrorRef = useRef(onError)
    onErrorRef.current = onError

    /**
     * Main fetch function - stable reference via useCallback with empty deps
     */
    const fetchLocation = useCallback(async () => {
        // Prevent concurrent fetches
        if (isFetchingRef.current) {
            console.log("[Geolocation] Already fetching, skipping")
            return
        }

        isFetchingRef.current = true
        hasNotifiedRef.current = false

        const notifyError = (geoError: GeolocationError) => {
            setError(geoError)
            console.log(
                `[Geolocation] ${geoError.code}: ${geoError.technical || geoError.message}`
            )
            if (onErrorRef.current && !hasNotifiedRef.current) {
                hasNotifiedRef.current = true
                onErrorRef.current(geoError)
            }
        }

        const tryIPFallback = async (): Promise<boolean> => {
            console.log("[Geolocation] Trying IP-based location fallback...")
            try {
                const ipLocation = await getLocationFromIP()
                if (ipLocation && (ipLocation.city || ipLocation.region)) {
                    setLocation(ipLocation)
                    setIsEstimate(true)
                    setSource("ip")
                    console.log("[Geolocation] IP fallback successful:", ipLocation)
                    return true
                }
            } catch (err) {
                console.error("[Geolocation] IP fallback error:", err)
            }
            return false
        }

        // Check if geolocation is supported
        if (typeof window === "undefined" || !navigator.geolocation) {
            notifyError(createError("NOT_SUPPORTED"))
            const success = await tryIPFallback()
            if (!success) {
                notifyError(createError("IP_FALLBACK_FAILED"))
            }
            setLoading(false)
            isFetchingRef.current = false
            return
        }

        setLoading(true)
        setError(null)
        setIsEstimate(false)
        setSource(null)

        // Check permission status first
        if (navigator.permissions) {
            try {
                const permission = await navigator.permissions.query({
                    name: "geolocation",
                })
                setPermissionState(permission.state as PermissionState)

                if (permission.state === "denied") {
                    console.log("[Geolocation] Permission denied, trying IP fallback")
                    notifyError(createError("PERMISSION_DENIED"))
                    const success = await tryIPFallback()
                    if (!success) {
                        notifyError(createError("IP_FALLBACK_FAILED"))
                    }
                    setLoading(false)
                    isFetchingRef.current = false
                    return
                }
            } catch {
                console.log("[Geolocation] Permissions API not available")
            }
        }

        // Get position with promise wrapper
        const getPosition = (): Promise<GeolocationPosition> => {
            return new Promise((resolve, reject) => {
                let attempts = 0
                const maxAttempts = retryAttempts + 1

                const tryGetPosition = () => {
                    attempts++
                    navigator.geolocation.getCurrentPosition(
                        resolve,
                        (err) => {
                            if (attempts < maxAttempts && err.code !== err.PERMISSION_DENIED) {
                                console.log(`[Geolocation] Attempt ${attempts} failed, retrying...`)
                                setTimeout(tryGetPosition, 500)
                            } else {
                                reject(err)
                            }
                        },
                        {
                            timeout: timeout,
                            maximumAge: CACHE_MAX_AGE,
                            enableHighAccuracy: false,
                        }
                    )
                }

                tryGetPosition()
            })
        }

        try {
            const position = await getPosition()
            const { latitude, longitude } = position.coords
            setPermissionState("granted")

            // Try reverse geocoding, but don't fail if it doesn't work
            let city: string | null = null
            let region: string | null = null

            try {
                const geocoded = await reverseGeocode(latitude, longitude)
                city = geocoded.city
                region = geocoded.region
            } catch (geocodeErr) {
                console.error("[Geolocation] Reverse geocoding failed:", geocodeErr)
                // Try to get city/region from IP instead
                try {
                    const ipLocation = await getLocationFromIP()
                    if (ipLocation) {
                        city = ipLocation.city
                        region = ipLocation.region
                    }
                } catch {
                    // Ignore IP fallback error for city/region
                }
            }

            setLocation({
                city,
                region,
                lat: latitude,
                lng: longitude,
            })
            setIsEstimate(false)
            setSource("gps")
            setLoading(false)
        } catch (positionErr) {
            const geoErr = positionErr as GeolocationPositionError

            let errorCode: GeolocationErrorCode = "POSITION_UNAVAILABLE"
            if (geoErr.code === geoErr.PERMISSION_DENIED) {
                errorCode = "PERMISSION_DENIED"
                setPermissionState("denied")
            } else if (geoErr.code === geoErr.TIMEOUT) {
                errorCode = "TIMEOUT"
            }

            notifyError(createError(errorCode, geoErr.message))

            const success = await tryIPFallback()
            if (!success) {
                notifyError(createError("IP_FALLBACK_FAILED"))
            }
            setLoading(false)
        }

        isFetchingRef.current = false
    }, [retryAttempts, timeout]) // Only depend on config values

    // Initial fetch - runs only once
    useEffect(() => {
        if (skipInitialFetch || hasFetchedRef.current) return

        hasFetchedRef.current = true
        fetchLocation()
    }, [skipInitialFetch, fetchLocation])

    return {
        location,
        loading,
        error,
        permissionState,
        isEstimate,
        source,
        refresh: fetchLocation,
    }
}
