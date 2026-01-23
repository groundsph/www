"use server"

import { db } from "@/db"
import { cafes } from "@/db/schema"
import { and, between, eq, sql } from "drizzle-orm"

export interface NearbyCafe {
    id: string
    name: string
    slug: string
    thumbnail: string
    distance: number
    address: string
}

/**
 * Find cafes within a certain radius of given coordinates.
 *
 * @param lat Latitude
 * @param lng Longitude
 * @param limit Max number of results (default 5)
 * @param radiusInMeters Search radius (default 150m for check-in)
 */
export async function getNearbyCafes(
    lat: number,
    lng: number,
    limit: number = 5,
    radiusInMeters: number = 150
): Promise<NearbyCafe[]> {
    try {
        // 1 degree of latitude is approximately 111km (111,000 meters)
        // We can use a rough bounding box to filter significantly.
        const delta = (radiusInMeters / 111000) * 1.5 // 1.5x buffer

        const minLat = lat - delta
        const maxLat = lat + delta
        const minLng = lng - delta
        const maxLng = lng + delta

        // Use Haversine formula in SQL for distance
        // d = 2 * R * asin(sqrt(sin^2(dLat/2) + cos(lat1)*cos(lat2)*sin^2(dLon/2)))
        // R = 6371000 meters
        const results = await db
            .select({
                id: cafes.id,
                name: cafes.name,
                slug: cafes.slug,
                thumbnail: cafes.thumbnail,
                address: cafes.addressDisplay,
                lat: cafes.lat,
                lng: cafes.lng,
                // We calculate distance in the query
                distance: sql<number>`
                    (
                        6371000 * acos(
                            cos(radians(${lat})) * cos(radians(${cafes.lat})) *
                            cos(radians(${cafes.lng}) - radians(${lng})) +
                            sin(radians(${lat})) * sin(radians(${cafes.lat}))
                        )
                    )
                `,
            })
            .from(cafes)
            .where(
                and(
                    between(cafes.lat, minLat, maxLat),
                    between(cafes.lng, minLng, maxLng),
                    eq(cafes.isPublished, true),
                    eq(cafes.isActive, true)
                )
            )
            .orderBy(sql`
                (
                    6371000 * acos(
                        cos(radians(${lat})) * cos(radians(${cafes.lat})) *
                        cos(radians(${cafes.lng}) - radians(${lng})) +
                        sin(radians(${lat})) * sin(radians(${cafes.lat}))
                    )
                ) ASC
            `)
            .limit(limit)

        // Filter by actual radius (bounding box is square, radius is circle)
        return results
            .filter((r) => r.distance <= radiusInMeters)
            .map((r) => ({
                id: r.id,
                name: r.name,
                slug: r.slug,
                thumbnail: r.thumbnail,
                distance: Math.round(r.distance), // Round to nearest meter
                address: r.address,
            }))
    } catch (error) {
        console.error("Error fetching nearby cafes:", error)
        return []
    }
}
