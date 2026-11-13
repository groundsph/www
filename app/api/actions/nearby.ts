"use server"

import { db } from "@/db"
import { toStoredThumbnail } from "@/utils/extras"
import { cafeRatingStats, cafes } from "@/db/schema"
import { and, between, eq, isNotNull, sql } from "drizzle-orm"
import type { OperatingHours } from "@/utils/types/cafe"
import type { Database } from "@/utils/types/database.types"

export interface NearbyCafe {
    id: string
    name: string
    slug: string
    thumbnail: string
    distance: number
    address: string
}

/**
 * The detail a check-in prompt needs to describe the cafe convincingly:
 * where it is, whether it is open, how good it is, and what it offers.
 */
export interface NearbyCafeDetail extends NearbyCafe {
    city: string | null
    lat: number | null
    lng: number | null
    priceLevel: Database["public"]["Enums"]["price_level"] | null
    averageRating: number | null
    totalReviews: number | null
    operatingHours: OperatingHours | null
    hasWifi: boolean | null
    hasSockets: boolean | null
    hasAircon: boolean | null
    isPetFriendly: boolean | null
    hasOutdoorSeating: boolean | null
    isWorkFriendly: boolean | null
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
): Promise<NearbyCafeDetail[]> {
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
                city: cafes.cityMunicipality,
                lat: cafes.lat,
                lng: cafes.lng,
                priceLevel: cafes.priceLevel,
                operatingHours: cafes.operatingHours,
                hasWifi: cafes.hasWifi,
                hasSockets: cafes.hasSockets,
                hasAircon: cafes.hasAircon,
                isPetFriendly: cafes.isPetFriendly,
                hasOutdoorSeating: cafes.hasOutdoorSeating,
                isWorkFriendly: cafes.isWorkFriendly,
                averageRating: cafeRatingStats.averageRating,
                totalReviews: cafeRatingStats.totalReviews,
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
            .leftJoin(cafeRatingStats, eq(cafes.id, cafeRatingStats.cafeId))
            .where(
                and(
                    // acos() over a null coordinate yields NaN, and a NaN sort key
                    // can float an unusable row to the front of the results.
                    isNotNull(cafes.lat),
                    isNotNull(cafes.lng),
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
                thumbnail: toStoredThumbnail(r.thumbnail),
                distance: Math.round(r.distance), // Round to nearest meter
                address: r.address,
                city: r.city ?? null,
                lat: r.lat ?? null,
                lng: r.lng ?? null,
                priceLevel: r.priceLevel ?? null,
                averageRating: r.averageRating ?? null,
                totalReviews: r.totalReviews ?? null,
                operatingHours: (r.operatingHours as OperatingHours | null) ?? null,
                hasWifi: r.hasWifi ?? null,
                hasSockets: r.hasSockets ?? null,
                hasAircon: r.hasAircon ?? null,
                isPetFriendly: r.isPetFriendly ?? null,
                hasOutdoorSeating: r.hasOutdoorSeating ?? null,
                isWorkFriendly: r.isWorkFriendly ?? null,
            }))
    } catch (error) {
        console.error("Error fetching nearby cafes:", error)
        return []
    }
}
