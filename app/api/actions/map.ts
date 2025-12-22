"use server"

import { createClient } from "@/utils/supabase/server"
import { CafeWithRatings } from "@/utils/types/extra"

export interface MapBounds {
    swLat: number
    swLng: number
    neLat: number
    neLng: number
}

export async function getCafesInBounds(bounds: MapBounds): Promise<CafeWithRatings[]> {
    const db = await createClient()

    // Query cafes within the bounding box
    const { data: cafes, error } = await db
        .from("cafes")
        .select("*, cafe_rating_stats(average_rating, total_reviews)")
        .eq("is_published", true)
        .gte("lat", bounds.swLat)
        .lte("lat", bounds.neLat)
        .gte("lng", bounds.swLng)
        .lte("lng", bounds.neLng)
        .limit(200)

    if (error || !cafes) return []

    return cafes.map((c: any) => {
        const flat = {
            ...c,
            average_rating: c.cafe_rating_stats?.average_rating ?? null,
            total_reviews: c.cafe_rating_stats?.total_reviews ?? null,
        }
        delete flat.cafe_rating_stats
        return flat
    }) as CafeWithRatings[]
}
