"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export async function createReview(
    cafeId: string,
    rating: number,
    comment: string,
    images: string[] = []
) {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()

    if (!user) {
        return { error: "Unauthorized" }
    }

    // Check if user already reviewed this cafe
    const { data: existing } = await db
        .from("reviews")
        .select("id")
        .eq("cafe_id", cafeId)
        .eq("user_id", user.id)
        .single()

    if (existing) {
        return { error: "You have already reviewed this cafe" }
    }

    // Insert review
    const { data, error } = await db
        .from("reviews")
        .insert({
            cafe_id: cafeId,
            user_id: user.id,
            rating,
            comment,
            images: images && images.length > 0 ? images : null,
            status: "published"
        })
        .select()
        .single()

    if (error) {
        console.error("Create review error:", error)
        return { error: "Failed to create review" }
    }

    // Update passport (visited list)
    try {
        const { data: profile } = await db
            .from("profiles")
            .select("passport")
            .eq("id", user.id)
            .single()

        if (profile) {
            const passport = (profile.passport as any) || { visited_ids: [], wishlist_ids: [] }
            const visitedIds = new Set(passport.visited_ids || [])

            if (!visitedIds.has(cafeId)) {
                visitedIds.add(cafeId)
                await db
                    .from("profiles")
                    .update({
                        passport: {
                            ...passport,
                            visited_ids: Array.from(visitedIds)
                        }
                    })
                    .eq("id", user.id)
            }
        }
    } catch (err) {
        console.error("Error updating passport:", err)
        // Don't fail the review creation if passport update fails
    }

    revalidatePath(`/cafes/[slug]`)
    return { success: true, data }
}

export async function updateReview(
    reviewId: string,
    rating: number,
    comment: string,
    images: string[] = []
) {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()

    if (!user) {
        return { error: "Unauthorized" }
    }

    // Verify ownership
    const { data: existing } = await db
        .from("reviews")
        .select("user_id")
        .eq("id", reviewId)
        .single()

    if (!existing || existing.user_id !== user.id) {
        return { error: "Unauthorized" }
    }

    const { data, error } = await db
        .from("reviews")
        .update({
            rating,
            comment,
            images: images && images.length > 0 ? images : null,
            is_edited: true,
            updated_at: new Date().toISOString()
        })
        .eq("id", reviewId)
        .eq("user_id", user.id) // Ensure ownership
        .select()
        .single()

    if (error) {
        return { error: "Failed to update review" }
    }

    revalidatePath(`/cafes/[slug]`)
    return { success: true, data }
}

export async function deleteReview(reviewId: string) {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()

    if (!user) {
        return { error: "Unauthorized" }
    }

    // Verify ownership
    const { data: existing } = await db
        .from("reviews")
        .select("user_id")
        .eq("id", reviewId)
        .single()

    if (!existing || existing.user_id !== user.id) {
        return { error: "Unauthorized" }
    }

    const { error } = await db.from("reviews").delete().eq("id", reviewId)

    if (error) {
        console.error("Error deleting review:", error)
        return { error: "Failed to delete review" }
    }

    revalidatePath(`/cafes/[slug]`)
    return { success: true }
}

export async function getUserReviewForCafe(cafeId: string) {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return null
    const { data } = await db
        .from("reviews")
        .select("*")
        .eq("cafe_id", cafeId)
        .eq("user_id", user.id)
        .maybeSingle()

    return data
}

export async function toggleReviewLike(reviewId: string) {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()

    if (!user) {
        return { error: "Unauthorized" }
    }

    // Check if interaction exists
    const { data: existing } = await db
        .from("review_interactions")
        .select("id")
        .eq("review_id", reviewId)
        .eq("user_id", user.id)
        .eq("interaction_type", "like")
        .single()

    if (existing) {
        // Unlike: delete interaction and decrement count
        await db
            .from("review_interactions")
            .delete()
            .eq("id", existing.id)

        // Manual update
        const { data: review } = await db
            .from("reviews")
            .select("likes_count")
            .eq("id", reviewId)
            .single()

        if (review) {
            await db
                .from("reviews")
                .update({ likes_count: Math.max(0, (review.likes_count || 0) - 1) })
                .eq("id", reviewId)
        }

        return { liked: false }
    } else {
        // Like: insert interaction and increment count
        await db
            .from("review_interactions")
            .insert({
                review_id: reviewId,
                user_id: user.id,
                interaction_type: "like"
            })

        // Manual update
        const { data: review } = await db
            .from("reviews")
            .select("likes_count")
            .eq("id", reviewId)
            .single()

        if (review) {
            await db
                .from("reviews")
                .update({ likes_count: (review.likes_count || 0) + 1 })
                .eq("id", reviewId)
        }

        return { liked: true }
    }
}
