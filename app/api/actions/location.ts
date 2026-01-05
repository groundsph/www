"use server"

/**
 * Server action to get user's location from their IP address
 * This runs server-side to avoid CORS issues with external IP APIs
 */

interface IPLocationResult {
    city: string | null
    region: string | null
    lat: number | null
    lng: number | null
}

/**
 * Get location from IP using ip-api.com (server-side, no CORS issues)
 * Falls back to multiple providers if one fails
 */
export async function getLocationFromIP(): Promise<IPLocationResult | null> {
    // Try ip-api.com first (HTTP, but server-side so OK)
    try {
        const response = await fetch(
            "http://ip-api.com/json/?fields=city,regionName,lat,lon,status",
            {
                next: { revalidate: 300 }, // Cache for 5 minutes
            }
        )

        if (response.ok) {
            const data = await response.json()
            if (data.status === "success") {
                return {
                    city: data.city || null,
                    region: data.regionName || null,
                    lat: data.lat || null,
                    lng: data.lon || null,
                }
            }
        }
    } catch (err) {
        console.error("[getLocationFromIP] ip-api.com failed:", err)
    }

    // Fallback to ipinfo.io
    try {
        const response = await fetch("https://ipinfo.io/json", {
            next: { revalidate: 300 },
        })

        if (response.ok) {
            const data = await response.json()
            // ipinfo.io returns loc as "lat,lng" string
            const [lat, lng] = (data.loc || "").split(",").map(Number)
            return {
                city: data.city || null,
                region: data.region || null,
                lat: isNaN(lat) ? null : lat,
                lng: isNaN(lng) ? null : lng,
            }
        }
    } catch (err) {
        console.error("[getLocationFromIP] ipinfo.io failed:", err)
    }

    return null
}

/**
 * Extract coordinates from a Google Maps URL
 * Handles both shortened (maps.app.goo.gl) and full URLs
 */
export async function extractCoordsFromGoogleMapsUrl(
    inputUrl: string
): Promise<{ lat: number; lng: number } | null> {
    try {
        let fullUrl = inputUrl.trim()

        // Helper to check if coordinates are valid (roughly within bounds)
        const isValidCoord = (lat: number, lng: number): boolean => {
            return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
        }

        // Helper to extract from URL patterns
        const extractFromUrl = (url: string): { lat: number; lng: number } | null => {
            // Pattern 1: @lat,lng in URL (most common)
            const atPattern = /@(-?\d+\.?\d*),(-?\d+\.?\d*)/
            const atMatch = url.match(atPattern)
            if (atMatch) {
                const lat = parseFloat(atMatch[1])
                const lng = parseFloat(atMatch[2])
                if (!isNaN(lat) && !isNaN(lng) && isValidCoord(lat, lng)) {
                    return { lat, lng }
                }
            }

            // Pattern 2: !3d and !4d format (embed/place URLs)
            const embedPattern = /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/
            const embedMatch = url.match(embedPattern)
            if (embedMatch) {
                const lat = parseFloat(embedMatch[1])
                const lng = parseFloat(embedMatch[2])
                if (!isNaN(lat) && !isNaN(lng) && isValidCoord(lat, lng)) {
                    return { lat, lng }
                }
            }

            // Pattern 3: ll= query parameter
            const llPattern = /[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/
            const llMatch = url.match(llPattern)
            if (llMatch) {
                const lat = parseFloat(llMatch[1])
                const lng = parseFloat(llMatch[2])
                if (!isNaN(lat) && !isNaN(lng) && isValidCoord(lat, lng)) {
                    return { lat, lng }
                }
            }

            // Pattern 4: q= query parameter with coordinates
            const qPattern = /[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/
            const qMatch = url.match(qPattern)
            if (qMatch) {
                const lat = parseFloat(qMatch[1])
                const lng = parseFloat(qMatch[2])
                if (!isNaN(lat) && !isNaN(lng) && isValidCoord(lat, lng)) {
                    return { lat, lng }
                }
            }

            return null
        }

        // If it's a shortened URL, first try to get the redirect URL
        if (
            fullUrl.includes("maps.app.goo.gl") ||
            fullUrl.includes("goo.gl/maps")
        ) {
            const headResponse = await fetch(fullUrl, {
                method: "HEAD",
                redirect: "follow",
            })
            fullUrl = headResponse.url
        }

        // Try to extract from the URL first
        const urlResult = extractFromUrl(fullUrl)
        if (urlResult) {
            return urlResult
        }

        // If URL patterns don't work, fetch the page content
        // Google embeds coordinates in APP_INITIALIZATION_STATE for place pages
        const response = await fetch(fullUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; GroundsApp/1.0)",
            },
        })

        if (!response.ok) {
            return null
        }

        const html = await response.text()

        // Google Maps embeds coordinates in APP_INITIALIZATION_STATE
        // Format: [distorted_value, lng, lat] like [3944.8563...,123.34751...,8.60978...]
        // We look for the pattern: ,lng,lat] where lat is a small number (0-90) and lng is larger (100-180 for Asia)

        // Pattern 1: Look for APP_INITIALIZATION_STATE coordinates array [x, lng, lat]
        // The pattern is ,lng,lat] where lng ~100-180 and lat ~0-90
        const appStatePattern = /,(\d{2,3}\.\d{5,}),(\d{1,2}\.\d{5,})\]/g
        const appStateMatches = [...html.matchAll(appStatePattern)]

        for (const match of appStateMatches) {
            const lng = parseFloat(match[1])
            const lat = parseFloat(match[2])

            // Validate - for Philippines: lat 4-22, lng 116-128
            if (
                !isNaN(lat) && !isNaN(lng) &&
                lat >= 4 && lat <= 22 &&
                lng >= 116 && lng <= 128
            ) {
                return { lat, lng }
            }
        }

        // Fallback: Try to find coordinates in reverse order (lat, lng)
        const reversedPattern = /,(\d{1,2}\.\d{5,}),(\d{2,3}\.\d{5,})\]/g
        const reversedMatches = [...html.matchAll(reversedPattern)]

        for (const match of reversedMatches) {
            const lat = parseFloat(match[1])
            const lng = parseFloat(match[2])

            if (
                !isNaN(lat) && !isNaN(lng) &&
                lat >= 4 && lat <= 22 &&
                lng >= 116 && lng <= 128
            ) {
                return { lat, lng }
            }
        }

        // Fallback 2: Generic global coordinates
        for (const match of appStateMatches) {
            const lng = parseFloat(match[1])
            const lat = parseFloat(match[2])

            if (
                !isNaN(lat) && !isNaN(lng) &&
                isValidCoord(lat, lng)
            ) {
                return { lat, lng }
            }
        }

        return null
    } catch (err) {
        console.error("[extractCoordsFromGoogleMapsUrl] Error:", err)
        return null
    }
}
