import { db } from "@/db"
import { cafes, cafeRatingStats } from "@/db/schema"
import { eq, and, desc, ilike } from "drizzle-orm"

export interface HiddenGemResult {
    id: string
    name: string
    slug: string
    thumbnail: string
    cityMunicipality: string
    province: string
    area: string | null
    description: string | null
    averageRating: number | null
    totalReviews: number | null
    findingHint: string | null
}

export async function findHiddenGems(
    city?: string,
    limit: number = 10
): Promise<{ gems: HiddenGemResult[]; total: number } | { error: string }> {
    try {
        const conditions = [
            eq(cafes.isPublished, true),
            eq(cafes.isHiddenGem, true),
        ]

        if (city) {
            conditions.push(ilike(cafes.cityMunicipality, `%${city}%`))
        }

        const results = await db
            .select({
                id: cafes.id,
                name: cafes.name,
                slug: cafes.slug,
                thumbnail: cafes.thumbnail,
                cityMunicipality: cafes.cityMunicipality,
                province: cafes.province,
                area: cafes.area,
                description: cafes.description,
                averageRating: cafeRatingStats.averageRating,
                totalReviews: cafeRatingStats.totalReviews,
                findingHint: cafes.findingHint,
            })
            .from(cafes)
            .leftJoin(cafeRatingStats, eq(cafes.id, cafeRatingStats.cafeId))
            .where(and(...conditions))
            .orderBy(desc(cafeRatingStats.averageRating))
            .limit(limit)

        return {
            gems: results.map((r) => ({
                ...r,
                averageRating: r.averageRating ?? null,
                totalReviews: r.totalReviews ?? null,
            })),
            total: results.length,
        }
    } catch (error) {
        console.error("findHiddenGems error:", error)
        return { error: "Failed to find hidden gems" }
    }
}
