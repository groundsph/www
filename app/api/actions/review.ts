"use server"

import { db } from "@/db"
import { reviews, profiles, reviewInteractions, cafes } from "@/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
import { deleteReviewImagesAction } from "@/utils/storage/actions"
import { notifyDiscordReviewReport } from "./notify"
import { revalidatePath } from "next/cache"
import { checkAndAwardBadges } from "@/utils/badges/badge-logic"
import { ProfilePassport } from "@/utils/types/extra"

export async function createReview(
    cafeId: string,
    rating: number,
    comment: string,
    images: string[] = []
) {
    const user = await getCurrentUser()
    if (!user) return { error: "Unauthorized" }

    // Check if user already reviewed this cafe
    const existing = await db
        .select({ id: reviews.id })
        .from(reviews)
        .where(and(eq(reviews.cafeId, cafeId), eq(reviews.userId, user.id)))
        .limit(1)

    if (existing.length > 0) {
        return { error: "You have already reviewed this cafe" }
    }

    // Insert review
    const [inserted] = await db
        .insert(reviews)
        .values({
            cafeId,
            userId: user.id,
            rating,
            comment,
            images: images?.length > 0 ? images : null,
            status: "published",
        })
        .returning()

    if (!inserted) {
        return { error: "Failed to create review" }
    }

    // Update passport (visited list)
    try {
        const profileResult = await db
            .select({ passport: profiles.passport })
            .from(profiles)
            .where(eq(profiles.id, user.id))
            .limit(1)

        if (profileResult[0]) {
            const passport = (profileResult[0].passport as ProfilePassport) || {
                visited_ids: [],
                wishlist_ids: [],
                favorite_ids: [],
            }
            const visitedIds = new Set(passport.visited_ids || [])

            if (!visitedIds.has(cafeId)) {
                visitedIds.add(cafeId)
                await db
                    .update(profiles)
                    .set({
                        passport: {
                            ...passport,
                            visited_ids: Array.from(visitedIds),
                        },
                    })
                    .where(eq(profiles.id, user.id))
            }
        }
    } catch (err) {
        console.error("Error updating passport:", err)
    }

    // Check and award badges
    await checkAndAwardBadges(user.id, { reviews: true, geographic: true })

    revalidatePath(`/cafes/[slug]`)
    return { success: true, data: inserted }
}

export async function updateReview(
    reviewId: string,
    rating: number,
    comment: string,
    images: string[] = []
) {
    const user = await getCurrentUser()
    if (!user) return { error: "Unauthorized" }

    // Verify ownership
    const existing = await db
        .select({ userId: reviews.userId })
        .from(reviews)
        .where(eq(reviews.id, reviewId))
        .limit(1)

    if (!existing[0] || existing[0].userId !== user.id) {
        return { error: "Unauthorized" }
    }

    const [updated] = await db
        .update(reviews)
        .set({
            rating,
            comment,
            images: images?.length > 0 ? images : null,
            isEdited: true,
            updatedAt: new Date(),
        })
        .where(and(eq(reviews.id, reviewId), eq(reviews.userId, user.id)))
        .returning()

    if (!updated) {
        return { error: "Failed to update review" }
    }

    revalidatePath(`/cafes/[slug]`)
    return { success: true, data: updated }
}

export async function deleteReview(reviewId: string) {
    const user = await getCurrentUser()
    if (!user) return { error: "Unauthorized" }

    // Verify ownership and get images
    const existing = await db
        .select({ userId: reviews.userId, images: reviews.images })
        .from(reviews)
        .where(eq(reviews.id, reviewId))
        .limit(1)

    if (!existing[0] || existing[0].userId !== user.id) {
        return { error: "Unauthorized" }
    }

    // Delete review images from storage
    if (existing[0].images?.length) {
        await deleteReviewImagesAction(existing[0].images)
    }

    await db.delete(reviews).where(eq(reviews.id, reviewId))

    revalidatePath(`/cafes/[slug]`)
    return { success: true }
}

export async function getUserReviewForCafe(cafeId: string) {
    const user = await getCurrentUser()
    if (!user) return null

    const result = await db
        .select()
        .from(reviews)
        .where(and(eq(reviews.cafeId, cafeId), eq(reviews.userId, user.id)))
        .limit(1)

    if (!result[0]) return null

    // Map to snake_case for compatibility
    const r = result[0]
    return {
        id: r.id,
        cafe_id: r.cafeId,
        user_id: r.userId,
        rating: r.rating,
        comment: r.comment,
        images: r.images,
        status: r.status,
        is_edited: r.isEdited,
        is_verified_visit: r.isVerifiedVisit,
        is_pinned_by_owner: r.isPinnedByOwner,
        pinned_at: r.pinnedAt?.toISOString() ?? null,
        likes_count: r.likesCount,
        created_at: r.createdAt?.toISOString() ?? null,
        updated_at: r.updatedAt?.toISOString() ?? null,
    }
}

export async function toggleReviewLike(reviewId: string) {
    const user = await getCurrentUser()
    if (!user) return { error: "Unauthorized" }

    // Check if interaction exists
    const existing = await db
        .select({ id: reviewInteractions.id })
        .from(reviewInteractions)
        .where(
            and(
                eq(reviewInteractions.reviewId, reviewId),
                eq(reviewInteractions.userId, user.id),
                eq(reviewInteractions.interactionType, "like")
            )
        )
        .limit(1)

    if (existing[0]) {
        // Unlike: delete interaction and decrement count
        await db.delete(reviewInteractions).where(eq(reviewInteractions.id, existing[0].id))

        await db
            .update(reviews)
            .set({
                likesCount: sql`GREATEST(0, COALESCE(${reviews.likesCount}, 0) - 1)`,
            })
            .where(eq(reviews.id, reviewId))

        return { liked: false }
    } else {
        // Like: insert interaction and increment count
        await db.insert(reviewInteractions).values({
            reviewId,
            userId: user.id,
            interactionType: "like",
        })

        await db
            .update(reviews)
            .set({
                likesCount: sql`COALESCE(${reviews.likesCount}, 0) + 1`,
            })
            .where(eq(reviews.id, reviewId))

        return { liked: true }
    }
}

const REPORT_THRESHOLD = 3

/**
 * Report a review for inappropriate content
 */
export async function reportReview(reviewId: string) {
    const user = await getCurrentUser()
    if (!user) return { error: "Unauthorized" }

    // Check if review exists and get details
    const reviewResult = await db
        .select({
            id: reviews.id,
            userId: reviews.userId,
            status: reviews.status,
            cafeName: cafes.name,
            cafeSlug: cafes.slug,
        })
        .from(reviews)
        .leftJoin(cafes, eq(reviews.cafeId, cafes.id))
        .where(eq(reviews.id, reviewId))
        .limit(1)

    const review = reviewResult[0]
    if (!review) return { error: "Review not found" }

    if (review.userId === user.id) {
        return { error: "You cannot report your own review" }
    }

    // Check if already reported
    const existingReport = await db
        .select({ id: reviewInteractions.id })
        .from(reviewInteractions)
        .where(
            and(
                eq(reviewInteractions.reviewId, reviewId),
                eq(reviewInteractions.userId, user.id),
                eq(reviewInteractions.interactionType, "report")
            )
        )
        .limit(1)

    if (existingReport[0]) {
        return { error: "You have already reported this review" }
    }

    // Insert report interaction
    await db.insert(reviewInteractions).values({
        reviewId,
        userId: user.id,
        interactionType: "report",
    })

    // Count total reports
    const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(reviewInteractions)
        .where(
            and(
                eq(reviewInteractions.reviewId, reviewId),
                eq(reviewInteractions.interactionType, "report")
            )
        )

    const reportCount = countResult[0]?.count ?? 0

    // Auto-flag if threshold reached
    if (reportCount >= REPORT_THRESHOLD && review.status === "published") {
        await db
            .update(reviews)
            .set({ status: "flagged", updatedAt: new Date() })
            .where(eq(reviews.id, reviewId))
    }

    // Notify Discord
    if (review.cafeName && review.cafeSlug) {
        const reporterProfile = await db
            .select({ displayName: profiles.displayName, username: profiles.username })
            .from(profiles)
            .where(eq(profiles.id, user.id))
            .limit(1)

        const reporterName = reporterProfile[0]?.displayName || reporterProfile[0]?.username

        await notifyDiscordReviewReport(
            reviewId,
            { name: review.cafeName, slug: review.cafeSlug },
            reportCount,
            reporterName ?? undefined
        )
    }

    return { reported: true }
}
