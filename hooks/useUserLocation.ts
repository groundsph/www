"use client"

import { useState, useEffect, useCallback } from "react"

export interface UserLocation {
    city: string | null
    region: string | null
    lat: number | null
    lng: number | null
}

export type PermissionState = "granted" | "denied" | "prompt" | "unknown"

export interface UseUserLocationReturn {
    location: UserLocation
    loading: boolean
    error: string | null
    permissionState: PermissionState
    isEstimate: boolean
    refresh: () => void
}

/**
 * Fallback: Get location from IP address using ip-api.com
 * This is less accurate but works when geolocation is denied/unavailable
 */
async function getLocationFromIP(): Promise<UserLocation | null> {
    try {
        // Using ip-api.com (free, no API key required, 45 req/min limit)
        const response = await fetch("http://ip-api.com/json/?fields=city,regionName,lat,lon,status")
        const data = await response.json()

        if (data.status === "success") {
            return {
                city: data.city || null,
                region: data.regionName || null,
                lat: data.lat || null,
                lng: data.lon || null,
            }
        }
        return null
    } catch (err) {
        console.error("Failed to get location from IP:", err)
        return null
    }
}

/**
 * Hook to get user's location via browser geolocation and reverse geocoding
 * Uses OpenStreetMap Nominatim for reverse geocoding
 * Falls back to IP-based geolocation if browser geolocation fails
 * Checks permission status before triggering location request
 */
export function useUserLocation(): UseUserLocationReturn {
    const [location, setLocation] = useState<UserLocation>({
        city: null,
        region: null,
        lat: null,
        lng: null,
    })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [permissionState, setPermissionState] =
        useState<PermissionState>("unknown")
    const [isEstimate, setIsEstimate] = useState(false)

    // Helper to try IP fallback
    const tryIPFallback = useCallback(async () => {
        console.log("Trying IP-based location fallback...")
        const ipLocation = await getLocationFromIP()
        if (ipLocation && (ipLocation.city || ipLocation.region)) {
            setLocation(ipLocation)
            setIsEstimate(true)
            setError(null)
            console.log("IP fallback successful:", ipLocation)
        }
        setLoading(false)
    }, [])

    const fetchLocation = useCallback(async () => {
        // Check if geolocation is supported
        if (typeof window === "undefined" || !navigator.geolocation) {
            setError("Geolocation is not supported by your browser")
            await tryIPFallback()
            return
        }

        setLoading(true)
        setError(null)
        setIsEstimate(false)

        // Check permission status first (if Permissions API is available)
        // This allows us to know the state without triggering a prompt
        if (navigator.permissions) {
            try {
                const permission = await navigator.permissions.query({
                    name: "geolocation",
                })
                setPermissionState(permission.state as PermissionState)

                // Listen for permission changes
                permission.onchange = () => {
                    setPermissionState(permission.state as PermissionState)
                }

                // If already denied, try IP fallback
                if (permission.state === "denied") {
                    console.log("Permission denied, trying IP fallback")
                    await tryIPFallback()
                    return
                }
            } catch {
                // Permissions API not fully supported, continue with fallback
                console.log("Permissions API not available, using fallback")
            }
        }

        // Proceed with the actual geolocation request
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords
                    setPermissionState("granted")
                    setIsEstimate(false)

                    // Reverse geocode using Nominatim (OpenStreetMap)
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
                        { headers: { "User-Agent": "Grounds Coffee App" } }
                    )
                    const data = await response.json()

                    // Extract city and region from response
                    const city =
                        data.address?.city ||
                        data.address?.town ||
                        data.address?.municipality ||
                        data.address?.village ||
                        null
                    const region =
                        data.address?.state || data.address?.region || null

                    setLocation({
                        city,
                        region,
                        lat: latitude,
                        lng: longitude,
                    })
                    setLoading(false)
                } catch (err) {
                    console.error("Failed to reverse geocode:", err)
                    setError("Failed to determine your location")
                    await tryIPFallback()
                }
            },
            async (err) => {
                let errorMessage = "Unknown location error"
                switch (err.code) {
                    case err.PERMISSION_DENIED:
                        errorMessage = "Location access denied by user"
                        setPermissionState("denied")
                        break
                    case err.POSITION_UNAVAILABLE:
                        errorMessage = "Location position unavailable"
                        break
                    case err.TIMEOUT:
                        errorMessage = "Location request timed out"
                        break
                }
                console.log(`${errorMessage}:`, err.message)
                setError(errorMessage)
                // Try IP fallback on any geolocation error
                await tryIPFallback()
            },
            {
                timeout: 10000,
                maximumAge: 300000, // Cache for 5 minutes
                enableHighAccuracy: false,
            }
        )
    }, [tryIPFallback])

    useEffect(() => {
        // Use a timeout to avoid the synchronous setState issue
        const timeoutId = setTimeout(fetchLocation, 0)
        return () => clearTimeout(timeoutId)
    }, [fetchLocation])

    return {
        location,
        loading,
        error,
        permissionState,
        isEstimate,
        refresh: fetchLocation,
    }
}
