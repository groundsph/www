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
