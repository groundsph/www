"use server"

import { db } from "@/db"
import { profiles, userBadges, badgeDefinitions, cafes, cafeRatingStats, reviews, reviewInteractions, cafeSubscriptions } from "@/db/schema"
import { eq, and, ne, desc, inArray, arrayContains } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
import { CafeWithRatings, ProfilePassport, ProfileStats, ProfileWithBadges, Tables } from "@/utils/types/extra"

// Types for consolidated profile data
export interface FullProfileData {
    profile: ProfileWithBadges | null
    allBadges: Tables<"badge_definitions">[]
    reviews: {
        id: string
        rating: number
        comment: string
        created_at: string | null
        cafe: { name: string; slug: string; thumbnail: string } | null
        images: string[] | null
        likes_count: number
        is_liked: boolean
        user_id: string
    }[]
    ownedCafes: {
        id: string
        name: string
        slug: string
        thumbnail: string
        city_municipality: string
        region: string
        is_verified: boolean | null
        is_published: boolean | null
        average_rating: number | null
        total_reviews: number | null
    }[]
    passportCafes: {
        visited: { name: string; slug: string }[]
        favorites: { name: string; slug: string }[]
        wishlist: { name: string; slug: string }[]
    }
}

/**
 * Get all profile page data in a single call
 * Reduces 7 separate API calls to 1
 */
export async function getFullProfileData(userId: string): Promise<FullProfileData> {
    // 1. Get profile with badges
    const profileResult = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1)
    const profile = profileResult[0]

    if (!profile) {
        return {
            profile: null,
            allBadges: [],
            reviews: [],
            ownedCafes: [],
            passportCafes: { visited: [], favorites: [], wishlist: [] },
        }
    }

    // 2. Fetch all data in parallel
    const [
        badgesResult,
        allBadgesResult,
        reviewsResult,
        ownedCafesResult,
    ] = await Promise.all([
        // User badges
        db.select({
            id: userBadges.id,
            userId: userBadges.userId,
            badgeId: userBadges.badgeId,
            awardedAt: userBadges.awardedAt,
            evidenceUrl: userBadges.evidenceUrl,
            badge: badgeDefinitions,
        })
            .from(userBadges)
            .leftJoin(badgeDefinitions, eq(userBadges.badgeId, badgeDefinitions.id))
            .where(eq(userBadges.userId, userId)),

        // All badge definitions
        db.select().from(badgeDefinitions).orderBy(badgeDefinitions.rarity, badgeDefinitions.name),

        // User reviews with cafe info
        db.select({
            id: reviews.id,
            rating: reviews.rating,
            comment: reviews.comment,
            createdAt: reviews.createdAt,
            userId: reviews.userId,
            images: reviews.images,
            likesCount: reviews.likesCount,
            cafeName: cafes.name,
            cafeSlug: cafes.slug,
            cafeThumbnail: cafes.thumbnail,
        })
            .from(reviews)
            .leftJoin(cafes, eq(reviews.cafeId, cafes.id))
            .where(and(eq(reviews.userId, userId), eq(reviews.status, "published")))
            .orderBy(desc(reviews.createdAt))
            .limit(20),

        // Owned cafes (from cafe_with_ratings view equivalent)
        db.select({
            id: cafes.id,
            name: cafes.name,
            slug: cafes.slug,
            thumbnail: cafes.thumbnail,
            cityMunicipality: cafes.cityMunicipality,
            region: cafes.region,
            isVerified: cafes.isVerified,
            isPublished: cafes.isPublished,
            ownerIds: cafes.ownerIds,
            averageRating: cafeRatingStats.averageRating,
            totalReviews: cafeRatingStats.totalReviews,
        })
            .from(cafes)
            .leftJoin(cafeRatingStats, eq(cafes.id, cafeRatingStats.cafeId))
            .where(arrayContains(cafes.ownerIds, [userId])),
    ])

    // 3. Get viewer's liked reviews
    const reviewIds = reviewsResult.map((r) => r.id)
    let viewerLikes: Set<string> = new Set()
    if (reviewIds.length > 0) {
        const interactions = await db
            .select({ reviewId: reviewInteractions.reviewId })
            .from(reviewInteractions)
            .where(and(eq(reviewInteractions.userId, userId), inArray(reviewInteractions.reviewId, reviewIds)))
        viewerLikes = new Set(interactions.map((i) => i.reviewId))
    }

    // 4. Get passport cafes
    const passport = profile.passport as ProfilePassport | null
    let visitedCafes: { name: string; slug: string }[] = []
    let favoriteCafes: { name: string; slug: string }[] = []
    let wishlistCafes: { name: string; slug: string }[] = []

    if (passport) {
        const allCafeIds = [
            ...(passport.visited_ids || []),
            ...(passport.favorite_ids || []),
            ...(passport.wishlist_ids || []),
        ]

        if (allCafeIds.length > 0) {
            const uniqueIds = [...new Set(allCafeIds)]
            const passportCafesResult = await db
                .select({ id: cafes.id, name: cafes.name, slug: cafes.slug })
                .from(cafes)
                .where(inArray(cafes.id, uniqueIds))

            const cafeMap = new Map(passportCafesResult.map((c) => [c.id, c]))

            visitedCafes = (passport.visited_ids || [])
                .map((id) => cafeMap.get(id))
                .filter(Boolean) as { name: string; slug: string }[]
            favoriteCafes = (passport.favorite_ids || [])
                .map((id) => cafeMap.get(id))
                .filter(Boolean) as { name: string; slug: string }[]
            wishlistCafes = (passport.wishlist_ids || [])
                .map((id) => cafeMap.get(id))
                .filter(Boolean) as { name: string; slug: string }[]
        }
    }

    // 5. Build response
    return {
        profile: {
            id: profile.id,
            username: profile.username,
            display_name: profile.displayName,
            avatar_url: profile.avatarUrl,
            bio: profile.bio,
            role: profile.role,
            is_supporter: profile.isSupporter,
            support_since: profile.supportSince?.toISOString() ?? null,
            supporter_expires_at: profile.supporterExpiresAt?.toISOString() ?? null,
            total_contribution: profile.totalContribution,
            profile_completed: profile.profileCompleted,
            passport: passport,
            stats: profile.stats as ProfileStats | null,
            created_at: profile.createdAt?.toISOString() ?? null,
            updated_at: profile.updatedAt?.toISOString() ?? null,
            badges: badgesResult.map((b) => ({
                id: b.id,
                user_id: b.userId,
                badge_id: b.badgeId,
                awarded_at: b.awardedAt?.toISOString() ?? null,
                evidence_url: b.evidenceUrl,
                badge: b.badge ? {
                    id: b.badge.id,
                    name: b.badge.name,
                    description: b.badge.description,
                    image_url: b.badge.imageUrl,
                    category: b.badge.category,
                    rarity: b.badge.rarity,
                    metadata: b.badge.metadata,
                    created_at: b.badge.createdAt?.toISOString() ?? null,
                } : null,
            })),
        } as ProfileWithBadges,
        allBadges: allBadgesResult.map((b) => ({
            id: b.id,
            name: b.name,
            description: b.description,
            image_url: b.imageUrl,
            category: b.category,
            rarity: b.rarity,
            metadata: b.metadata,
            created_at: b.createdAt?.toISOString() ?? null,
        })) as Tables<"badge_definitions">[],
        reviews: reviewsResult.map((r) => ({
            id: r.id,
            rating: r.rating,
            comment: r.comment,
            created_at: r.createdAt?.toISOString() ?? null,
            cafe: r.cafeName ? { name: r.cafeName, slug: r.cafeSlug!, thumbnail: r.cafeThumbnail! } : null,
            images: r.images,
            likes_count: r.likesCount ?? 0,
            is_liked: viewerLikes.has(r.id),
            user_id: r.userId,
        })),
        ownedCafes: ownedCafesResult.map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            thumbnail: c.thumbnail,
            city_municipality: c.cityMunicipality,
            region: c.region,
            is_verified: c.isVerified,
            is_published: c.isPublished,
            average_rating: c.averageRating ?? null,
            total_reviews: c.totalReviews ?? null,
        })),
        passportCafes: {
            visited: visitedCafes,
            favorites: favoriteCafes,
            wishlist: wishlistCafes,
        },
    }
}


/**
 * Check if a username is already taken
 */
export async function checkUsernameAvailability(
    username: string,
    excludeUserId?: string
): Promise<{ available: boolean }> {
    if (!username || username.trim().length < 3) {
        return { available: false }
    }

    const conditions = [eq(profiles.username, username.trim().toLowerCase())]
    if (excludeUserId) {
        conditions.push(ne(profiles.id, excludeUserId))
    }

    const result = await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(and(...conditions))
        .limit(1)

    return { available: result.length === 0 }
}

/**
 * Get a user's profile with their earned badges
 */
export async function getProfileWithBadges(userId: string): Promise<ProfileWithBadges | null> {
    // Fetch profile
    const profileResult = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1)

    const profile = profileResult[0]
    if (!profile) return null

    // Fetch user's badges with badge definitions
    const badgesResult = await db
        .select({
            id: userBadges.id,
            userId: userBadges.userId,
            badgeId: userBadges.badgeId,
            awardedAt: userBadges.awardedAt,
            evidenceUrl: userBadges.evidenceUrl,
            badge: badgeDefinitions,
        })
        .from(userBadges)
        .leftJoin(badgeDefinitions, eq(userBadges.badgeId, badgeDefinitions.id))
        .where(eq(userBadges.userId, userId))

    // Map to snake_case
    return {
        id: profile.id,
        username: profile.username,
        display_name: profile.displayName,
        avatar_url: profile.avatarUrl,
        bio: profile.bio,
        role: profile.role,
        is_supporter: profile.isSupporter,
        support_since: profile.supportSince?.toISOString() ?? null,
        supporter_expires_at: profile.supporterExpiresAt?.toISOString() ?? null,
        total_contribution: profile.totalContribution,
        profile_completed: profile.profileCompleted,
        passport: profile.passport as ProfilePassport | null,
        stats: profile.stats as ProfileStats | null,
        created_at: profile.createdAt?.toISOString() ?? null,
        updated_at: profile.updatedAt?.toISOString() ?? null,
        badges: badgesResult.map((b) => ({
            id: b.id,
            user_id: b.userId,
            badge_id: b.badgeId,
            awarded_at: b.awardedAt?.toISOString() ?? null,
            evidence_url: b.evidenceUrl,
            badge: b.badge ? {
                id: b.badge.id,
                name: b.badge.name,
                description: b.badge.description,
                image_url: b.badge.imageUrl,
                category: b.badge.category,
                rarity: b.badge.rarity,
                metadata: b.badge.metadata,
                created_at: b.badge.createdAt?.toISOString() ?? null,
            } : null,
        })),
    } as ProfileWithBadges
}

/**
 * Get all available badge definitions
 */
export async function getAllBadges(): Promise<Tables<"badge_definitions">[]> {
    const result = await db
        .select()
        .from(badgeDefinitions)
        .orderBy(badgeDefinitions.rarity, badgeDefinitions.name)

    return result.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        image_url: b.imageUrl,
        category: b.category,
        rarity: b.rarity,
        metadata: b.metadata,
        created_at: b.createdAt?.toISOString() ?? null,
    })) as Tables<"badge_definitions">[]
}

/**
 * Update user's profile
 */
export async function updateProfile(
    userId: string,
    data: {
        display_name?: string
        bio?: string
        avatar_url?: string
        username?: string
        profile_completed?: boolean
    }
): Promise<{ success: boolean; error?: string }> {
    if (!userId) return { success: false, error: "User ID required" }

    try {
        const updateData: Partial<typeof profiles.$inferInsert> = {
            updatedAt: new Date(),
        }
        if (data.display_name !== undefined) updateData.displayName = data.display_name
        if (data.bio !== undefined) updateData.bio = data.bio
        if (data.avatar_url !== undefined) updateData.avatarUrl = data.avatar_url
        if (data.username !== undefined) updateData.username = data.username
        if (data.profile_completed !== undefined) updateData.profileCompleted = data.profile_completed

        await db.update(profiles).set(updateData).where(eq(profiles.id, userId))

        return { success: true }
    } catch (error) {
        console.error("Error updating profile:", error)
        return { success: false, error: "Failed to update profile" }
    }
}

/**
 * Get cafes by their IDs (for passport visited/wishlist)
 */
export async function getCafesByIds(ids: string[]): Promise<CafeWithRatings[]> {
    if (!ids.length) return []

    const results = await db
        .select({
            id: cafes.id,
            name: cafes.name,
            slug: cafes.slug,
            thumbnail: cafes.thumbnail,
            description: cafes.description,
            addressDisplay: cafes.addressDisplay,
            cityMunicipality: cafes.cityMunicipality,
            province: cafes.province,
            region: cafes.region,
            priceLevel: cafes.priceLevel,
            averageRating: cafeRatingStats.averageRating,
            totalReviews: cafeRatingStats.totalReviews,
        })
        .from(cafes)
        .leftJoin(cafeRatingStats, eq(cafes.id, cafeRatingStats.cafeId))
        .where(inArray(cafes.id, ids))

    return results.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        thumbnail: c.thumbnail,
        description: c.description,
        address_display: c.addressDisplay,
        city_municipality: c.cityMunicipality,
        province: c.province,
        region: c.region,
        price_level: c.priceLevel,
        average_rating: c.averageRating ?? null,
        total_reviews: c.totalReviews ?? null,
    })) as CafeWithRatings[]
}

/**
 * Get a user's public profile by username
 */
export async function getProfileByUsername(username: string): Promise<ProfileWithBadges | null> {
    // Fetch profile by username
    const profileResult = await db
        .select()
        .from(profiles)
        .where(eq(profiles.username, username))
        .limit(1)

    const profile = profileResult[0]
    if (!profile) return null

    // Fetch user's badges
    const badgesResult = await db
        .select({
            id: userBadges.id,
            userId: userBadges.userId,
            badgeId: userBadges.badgeId,
            awardedAt: userBadges.awardedAt,
            evidenceUrl: userBadges.evidenceUrl,
            badge: badgeDefinitions,
        })
        .from(userBadges)
        .leftJoin(badgeDefinitions, eq(userBadges.badgeId, badgeDefinitions.id))
        .where(eq(userBadges.userId, profile.id))

    return {
        id: profile.id,
        username: profile.username,
        display_name: profile.displayName,
        avatar_url: profile.avatarUrl,
        bio: profile.bio,
        role: profile.role,
        is_supporter: profile.isSupporter,
        support_since: profile.supportSince?.toISOString() ?? null,
        supporter_expires_at: profile.supporterExpiresAt?.toISOString() ?? null,
        total_contribution: profile.totalContribution,
        profile_completed: profile.profileCompleted,
        passport: profile.passport as ProfilePassport | null,
        stats: profile.stats as ProfileStats | null,
        created_at: profile.createdAt?.toISOString() ?? null,
        updated_at: profile.updatedAt?.toISOString() ?? null,
        badges: badgesResult.map((b) => ({
            id: b.id,
            user_id: b.userId,
            badge_id: b.badgeId,
            awarded_at: b.awardedAt?.toISOString() ?? null,
            evidence_url: b.evidenceUrl,
            badge: b.badge ? {
                id: b.badge.id,
                name: b.badge.name,
                description: b.badge.description,
                image_url: b.badge.imageUrl,
                category: b.badge.category,
                rarity: b.badge.rarity,
                metadata: b.badge.metadata,
                created_at: b.badge.createdAt?.toISOString() ?? null,
            } : null,
        })),
    } as ProfileWithBadges
}

/**
 * Get a user's reviews with cafe info
 */
export async function getUserReviews(
    userId: string,
    viewerId?: string
): Promise<{
    id: string
    rating: number
    comment: string
    created_at: string | null
    cafe: { name: string; slug: string; thumbnail: string } | null
    images: string[] | null
    likes_count: number
    is_liked: boolean
    user_id: string
}[]> {
    const reviewsResult = await db
        .select({
            id: reviews.id,
            rating: reviews.rating,
            comment: reviews.comment,
            createdAt: reviews.createdAt,
            userId: reviews.userId,
            images: reviews.images,
            likesCount: reviews.likesCount,
            cafeName: cafes.name,
            cafeSlug: cafes.slug,
            cafeThumbnail: cafes.thumbnail,
        })
        .from(reviews)
        .leftJoin(cafes, eq(reviews.cafeId, cafes.id))
        .where(and(eq(reviews.userId, userId), eq(reviews.status, "published")))
        .orderBy(desc(reviews.createdAt))
        .limit(20)

    // Get interactions for the viewer if provided
    let viewerLikes: Set<string> = new Set()
    if (viewerId) {
        const interactions = await db
            .select({ reviewId: reviewInteractions.reviewId })
            .from(reviewInteractions)
            .where(
                and(
                    eq(reviewInteractions.userId, viewerId),
                    inArray(
                        reviewInteractions.reviewId,
                        reviewsResult.map((r) => r.id)
                    )
                )
            )
        viewerLikes = new Set(interactions.map((i) => i.reviewId))
    }

    return reviewsResult.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        created_at: r.createdAt?.toISOString() ?? null,
        cafe: r.cafeName
            ? { name: r.cafeName, slug: r.cafeSlug!, thumbnail: r.cafeThumbnail! }
            : null,
        images: r.images,
        likes_count: r.likesCount ?? 0,
        is_liked: viewerLikes.has(r.id),
        user_id: r.userId,
    }))
}

/**
 * Toggle a cafe in the user's wishlist
 */
export async function toggleWishlist(cafeId: string): Promise<{ added: boolean; error?: string }> {
    const user = await getCurrentUser()
    if (!user) return { added: false, error: "Unauthorized" }

    try {
        const profileResult = await db
            .select({ passport: profiles.passport })
            .from(profiles)
            .where(eq(profiles.id, user.id))
            .limit(1)

        if (!profileResult[0]) return { added: false, error: "Profile not found" }

        const passport = (profileResult[0].passport as ProfilePassport) || {
            visited_ids: [],
            wishlist_ids: [],
            favorite_ids: [],
        }
        const wishlistIds = new Set(passport.wishlist_ids || [])
        let added = false

        if (wishlistIds.has(cafeId)) {
            wishlistIds.delete(cafeId)
        } else {
            wishlistIds.add(cafeId)
            added = true
        }

        await db
            .update(profiles)
            .set({
                passport: {
                    ...passport,
                    wishlist_ids: Array.from(wishlistIds),
                },
            })
            .where(eq(profiles.id, user.id))

        return { added }
    } catch (error) {
        console.error("Error toggling wishlist:", error)
        return { added: false, error: "Failed to update wishlist" }
    }
}

/**
 * Toggle a cafe in the user's visited list
 */
export async function toggleVisited(cafeId: string): Promise<{ visited: boolean; error?: string }> {
    const user = await getCurrentUser()
    if (!user) return { visited: false, error: "Unauthorized" }

    try {
        const profileResult = await db
            .select({ passport: profiles.passport })
            .from(profiles)
            .where(eq(profiles.id, user.id))
            .limit(1)

        if (!profileResult[0]) return { visited: false, error: "Profile not found" }

        const passport = (profileResult[0].passport as ProfilePassport) || {
            visited_ids: [],
            wishlist_ids: [],
            favorite_ids: [],
        }
        const visitedIds = new Set(passport.visited_ids || [])
        let visited = false

        if (visitedIds.has(cafeId)) {
            visitedIds.delete(cafeId)
        } else {
            visitedIds.add(cafeId)
            visited = true
        }

        await db
            .update(profiles)
            .set({
                passport: {
                    ...passport,
                    visited_ids: Array.from(visitedIds),
                },
            })
            .where(eq(profiles.id, user.id))

        return { visited }
    } catch (error) {
        console.error("Error toggling visited:", error)
        return { visited: false, error: "Failed to update visited list" }
    }
}

/**
 * Toggle a cafe in the user's favorites
 */
export async function toggleFavorite(cafeId: string): Promise<{ favorited: boolean; error?: string }> {
    const user = await getCurrentUser()
    if (!user) return { favorited: false, error: "Unauthorized" }

    try {
        const profileResult = await db
            .select({ passport: profiles.passport })
            .from(profiles)
            .where(eq(profiles.id, user.id))
            .limit(1)

        if (!profileResult[0]) return { favorited: false, error: "Profile not found" }

        const passport = (profileResult[0].passport as ProfilePassport) || {
            visited_ids: [],
            wishlist_ids: [],
            favorite_ids: [],
        }
        const favoriteIds = new Set(passport.favorite_ids || [])
        let favorited = false

        if (favoriteIds.has(cafeId)) {
            favoriteIds.delete(cafeId)
        } else {
            favoriteIds.add(cafeId)
            favorited = true
        }

        await db
            .update(profiles)
            .set({
                passport: {
                    ...passport,
                    favorite_ids: Array.from(favoriteIds),
                },
            })
            .where(eq(profiles.id, user.id))

        return { favorited }
    } catch (error) {
        console.error("Error toggling favorite:", error)
        return { favorited: false, error: "Failed to update favorites" }
    }
}
