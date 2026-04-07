import { db } from "@/db"
import { reviews, profiles } from "@/db/schema"
import { eq, and, desc } from "drizzle-orm"

export interface CafeReview {
    id: string
    rating: number
    comment: string
    images: string[] | null
    isVerifiedVisit: boolean
    likesCount: number
    createdAt: string
    author: {
        username: string
        displayName: string
        avatarUrl: string | null
    }
}

export interface CafeReviewsResult {
    cafeId: string
    reviews: CafeReview[]
    totalReviews: number
    averageRating: number | null
}

export async function getCafeReviews(
    cafeSlug: string,
    limit: number = 5
): Promise<CafeReviewsResult | { error: string }> {
    try {
        const { cafes, cafeRatingStats } = await import("@/db/schema")

        const cafe = await db
            .select({ id: cafes.id })
            .from(cafes)
            .where(eq(cafes.slug, cafeSlug))
            .limit(1)

        if (!cafe[0]) {
            return { error: `Cafe with slug "${cafeSlug}" not found` }
        }

        const [reviewResults, statsResult] = await Promise.all([
            db
                .select({
                    id: reviews.id,
                    rating: reviews.rating,
                    comment: reviews.comment,
                    images: reviews.images,
                    isVerifiedVisit: reviews.isVerifiedVisit,
                    likesCount: reviews.likesCount,
                    createdAt: reviews.createdAt,
                    username: profiles.username,
                    displayName: profiles.displayName,
                    avatarUrl: profiles.avatarUrl,
                })
                .from(reviews)
                .innerJoin(profiles, eq(reviews.userId, profiles.id))
                .where(
                    and(
                        eq(reviews.cafeId, cafe[0].id),
                        eq(reviews.status, "published")
                    )
                )
                .orderBy(desc(reviews.createdAt))
                .limit(limit),
            db
                .select({
                    averageRating: cafeRatingStats.averageRating,
                    totalReviews: cafeRatingStats.totalReviews,
                })
                .from(cafeRatingStats)
                .where(eq(cafeRatingStats.cafeId, cafe[0].id))
                .limit(1),
        ])

        return {
            cafeId: cafe[0].id,
            reviews: reviewResults.map((r) => ({
                id: r.id,
                rating: r.rating,
                comment: r.comment,
                images: r.images,
                isVerifiedVisit: r.isVerifiedVisit ?? false,
                likesCount: r.likesCount ?? 0,
                createdAt: r.createdAt?.toISOString() ?? "",
                author: {
                    username: r.username,
                    displayName: r.displayName,
                    avatarUrl: r.avatarUrl,
                },
            })),
            totalReviews: statsResult[0]?.totalReviews ?? 0,
            averageRating: statsResult[0]?.averageRating ?? null,
        }
    } catch (error) {
        console.error("getCafeReviews error:", error)
        return { error: "Failed to fetch cafe reviews" }
    }
}
