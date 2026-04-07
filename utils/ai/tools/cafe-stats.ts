import { db } from "@/db"
import { cafes, cafeRatingStats } from "@/db/schema"
import { eq, and, avg, count, ilike, isNotNull } from "drizzle-orm"

export interface CafeStats {
    totalCafes: number
    totalCities: number
    averageRating: number | null
    cafesWithWifi: number
    cafesWithAircon: number
    cafesPetFriendly: number
    cafesWorkFriendly: number
    hiddenGems: number
    verifiedCafes: number
}

export interface CityStats {
    city: string
    province: string
    totalCafes: number
    averageRating: number | null
    hiddenGems: number
}

export async function getCafeStats(
    city?: string
): Promise<{ stats: CafeStats | CityStats; scope: string } | { error: string }> {
    try {
        if (city) {
            const conditions = [
                eq(cafes.isPublished, true),
                ilike(cafes.cityMunicipality, `%${city}%`),
            ]

            const [aggregates, ratingResult] = await Promise.all([
                db
                    .select({
                        total: count(),
                        hiddenGems: count(cafes.isHiddenGem),
                    })
                    .from(cafes)
                    .where(and(...conditions)),
                db
                    .select({ avgRating: avg(cafeRatingStats.averageRating) })
                    .from(cafeRatingStats)
                    .innerJoin(cafes, eq(cafes.id, cafeRatingStats.cafeId))
                    .where(and(...conditions, isNotNull(cafeRatingStats.averageRating))),
            ])

            return {
                stats: {
                    city,
                    province: "",
                    totalCafes: Number(aggregates[0]?.total ?? 0),
                    averageRating: ratingResult[0]?.avgRating ? Number(ratingResult[0].avgRating) : null,
                    hiddenGems: 0,
                },
                scope: city,
            }
        }

        const [totalResult, cityCountResult, ratingResult, featureCounts] = await Promise.all([
            db.select({ count: count() }).from(cafes).where(eq(cafes.isPublished, true)),
            db
                .select({ count: count() })
                .from(cafes)
                .where(eq(cafes.isPublished, true))
                .groupBy(cafes.cityMunicipality),
            db
                .select({ avgRating: avg(cafeRatingStats.averageRating) })
                .from(cafeRatingStats)
                .innerJoin(cafes, eq(cafes.id, cafeRatingStats.cafeId))
                .where(
                    and(
                        eq(cafes.isPublished, true),
                        isNotNull(cafeRatingStats.averageRating)
                    )
                ),
            Promise.all([
                db.select({ count: count() }).from(cafes).where(and(eq(cafes.isPublished, true), eq(cafes.hasWifi, true))),
                db.select({ count: count() }).from(cafes).where(and(eq(cafes.isPublished, true), eq(cafes.hasAircon, true))),
                db.select({ count: count() }).from(cafes).where(and(eq(cafes.isPublished, true), eq(cafes.isPetFriendly, true))),
                db.select({ count: count() }).from(cafes).where(and(eq(cafes.isPublished, true), eq(cafes.isWorkFriendly, true))),
                db.select({ count: count() }).from(cafes).where(and(eq(cafes.isPublished, true), eq(cafes.isHiddenGem, true))),
                db.select({ count: count() }).from(cafes).where(and(eq(cafes.isPublished, true), eq(cafes.isVerified, true))),
            ]),
        ])

        return {
            stats: {
                totalCafes: Number(totalResult[0]?.count ?? 0),
                totalCities: cityCountResult.length,
                averageRating: ratingResult[0]?.avgRating ? Number(ratingResult[0].avgRating) : null,
                cafesWithWifi: Number(featureCounts[0][0]?.count ?? 0),
                cafesWithAircon: Number(featureCounts[1][0]?.count ?? 0),
                cafesPetFriendly: Number(featureCounts[2][0]?.count ?? 0),
                cafesWorkFriendly: Number(featureCounts[3][0]?.count ?? 0),
                hiddenGems: Number(featureCounts[4][0]?.count ?? 0),
                verifiedCafes: Number(featureCounts[5][0]?.count ?? 0),
            },
            scope: "all",
        }
    } catch (error) {
        console.error("getCafeStats error:", error)
        return { error: "Failed to get cafe statistics" }
    }
}
