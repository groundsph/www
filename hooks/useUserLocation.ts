"use client"

import { useState, useEffect, useCallback } from "react"

export interface UserLocation {
    city: string | null
    region: string | null
    lat: number | null
    lng: number | null
}

export interface UseUserLocationReturn {
    location: UserLocation
    loading: boolean
    error: string | null
    refresh: () => void
}

/**
 * Hook to get user's location via browser geolocation and reverse geocoding
 * Uses OpenStreetMap Nominatim for reverse geocoding
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

    const fetchLocation = useCallback(() => {
        // Check if geolocation is supported
        if (typeof window === "undefined" || !navigator.geolocation) {
            setError("Geolocation is not supported by your browser")
            setLoading(false)
            return
        }

        setLoading(true)
        setError(null)

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords

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
                    setLoading(false)
                }
            },
            (err) => {
                let errorMessage = "Unknown location error"
                switch (err.code) {
                    case err.PERMISSION_DENIED:
                        errorMessage = "Location access denied by user"
                        break
                    case err.POSITION_UNAVAILABLE:
                        errorMessage = "Location position unavailable"
                        break
                    case err.TIMEOUT:
                        errorMessage = "Location request timed out"
                        break
                }
                console.log(
                    `${errorMessage}:`,
                    err.message
                )
                setError(errorMessage)
                setLoading(false)
            },
            {
                timeout: 10000,
                maximumAge: 300000, // Cache for 5 minutes
                enableHighAccuracy: false,
            }
        )
    }, [])

    useEffect(() => {
        // Use a timeout to avoid the synchronous setState issue
        const timeoutId = setTimeout(fetchLocation, 0)
        return () => clearTimeout(timeoutId)
    }, [fetchLocation])

    return {
        location,
        loading,
        error,
        refresh: fetchLocation,
    }
}
