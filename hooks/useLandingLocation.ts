"use client"

import { useState, useEffect, useRef } from "react"
import { getLocationFeatured } from "@/app/api/actions/cafe"
import { getNearbyCafes, NearbyCafe } from "@/app/api/actions/nearby"
import { CafeWithRatings } from "@/utils/types/extra"
import {
    useUserLocation,
    GeolocationError,
    LocationSource
} from "@/hooks/useUserLocation"
import { useNotification } from "@/components/NotificationProvider"

// ============================================================================
// Types
// ============================================================================

interface CachedLocationData {
    city: string | null
    region: string | null
    featured: CafeWithRatings
    isEstimate: boolean
    timestamp: number
}

export interface UseLandingLocationReturn {
    featured: CafeWithRatings | null
    isLocalFeatured: boolean
    locationName: string | null
    isEstimate: boolean
    loading: boolean
    nearbyCafe: NearbyCafe | null
    source: LocationSource
}

// ============================================================================
// Constants
// ============================================================================

const CACHE_KEY = "grounds_location"
const CACHE_MAX_AGE = 5 * 60 * 1000 // 5 minutes

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook specifically for the landing page that:
 * - Uses useUserLocation for location detection
 * - Fetches featured cafes based on location
 * - Manages sessionStorage caching
 * - Shows notifications for location errors
 */
export function useLandingLocation(
    initialFeatured: CafeWithRatings | null
): UseLandingLocationReturn {
    const { addNotification } = useNotification()
    const [featured, setFeatured] = useState<CafeWithRatings | null>(
        initialFeatured
    )
    const [isLocalFeatured, setIsLocalFeatured] = useState(false)
    const [locationName, setLocationName] = useState<string | null>(null)
    const [isEstimate, setIsEstimate] = useState(false)
    const [hasFetched, setHasFetched] = useState(false)
    const [nearbyCafe, setNearbyCafe] = useState<NearbyCafe | null>(null)

    // Track if we've shown a notification to avoid duplicates
    const hasShownNotificationRef = useRef(false)

    // Handle location errors with notifications
    const handleLocationError = (error: GeolocationError) => {
        // Only show notification once and only for certain error types
        if (hasShownNotificationRef.current) return

        // Don't spam user with IP fallback failed if we already showed another error
        if (error.code === "IP_FALLBACK_FAILED") {
            hasShownNotificationRef.current = true
            addNotification(error.message, "warning")
        } else if (error.code === "PERMISSION_DENIED") {
            hasShownNotificationRef.current = true
            addNotification(error.message, "info")
        }
        // For TIMEOUT and POSITION_UNAVAILABLE, we silently fall back to IP
        // and only notify if that also fails
    }

    const {
        location,
        loading: locationLoading,
        isEstimate: locationIsEstimate,
        source,
    } = useUserLocation({
        onError: handleLocationError,
    })

    // Check cache on mount
    useEffect(() => {
        const cachedData = sessionStorage.getItem(CACHE_KEY)
        if (cachedData) {
            try {
                const parsed: CachedLocationData = JSON.parse(cachedData)
                // Check if cache is still valid
                if (Date.now() - parsed.timestamp < CACHE_MAX_AGE) {
                    // eslint-disable-next-line react-hooks/set-state-in-effect -- intended to run on mount to avoiding hydration mismatch
                    setFeatured(parsed.featured)
                    setIsLocalFeatured(true)
                    setLocationName(parsed.city || parsed.region || null)
                    setIsEstimate(parsed.isEstimate)
                    setHasFetched(true)
                }
            } catch {
                // Invalid cache, will fetch fresh
            }
        }
    }, [])

    // Fetch featured cafe when location changes
    useEffect(() => {
        // Skip if already fetched from cache or still loading
        if (hasFetched || locationLoading) return

        // Skip if no location data
        if (!location.city && !location.region) return

        const fetchFeatured = async () => {
            try {
                const localFeatured = await getLocationFeatured(
                    location.city ?? undefined,
                    location.region ?? undefined
                )

                if (localFeatured) {
                    setFeatured(localFeatured)
                    setIsLocalFeatured(true)
                    setLocationName(location.city || location.region || null)
                    setIsEstimate(locationIsEstimate)

                    // Cache the result
                    const cacheData: CachedLocationData = {
                        city: location.city,
                        region: location.region,
                        featured: localFeatured,
                        isEstimate: locationIsEstimate,
                        timestamp: Date.now(),
                    }
                    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cacheData))
                }
            } catch (err) {
                console.error("[LandingLocation] Failed to fetch featured cafe:", err)
            }

            setHasFetched(true)
        }

        fetchFeatured()
    }, [location, locationLoading, locationIsEstimate, hasFetched])

    // Automatically fetch nearby cafes if source is GPS
    useEffect(() => {
        // Only fetch if we have GPS source and valid coordinates
        if (source === "gps" && location.lat && location.lng) {
            const fetchNearby = async () => {
                try {
                    // Search within 150m for check-ins
                    const nearby = await getNearbyCafes(location.lat!, location.lng!, 1, 150)
                    if (nearby.length > 0) {
                        setNearbyCafe(nearby[0])
                    }
                } catch (err) {
                    console.error("[LandingLocation] Failed to fetch nearby cafe:", err)
                }
            }

            fetchNearby()
        }
    }, [source, location.lat, location.lng])

    return {
        featured,
        isLocalFeatured,
        locationName,
        isEstimate,
        loading: locationLoading && !hasFetched,
        nearbyCafe,
        source,
    }
}
