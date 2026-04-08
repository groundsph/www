"use server"

import { getPHTime, getPHTodayStart } from "@/utils/featured"
import { db } from "@/db"
import { profiles, userBadges, badgeDefinitions, cafes, cafeRatingStats, reviews, reviewInteractions, cafeVisits, collections, monthlyLeaderboardSnapshots, userFollows } from "@/db/schema"
import { eq, and, ne, desc, inArray, arrayContains, count, sql, asc } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
import { CafeWithRatings, ProfilePassport, ProfileStats, ProfileWithBadges, Tables } from "@/utils/types/extra"
import { applyTieRanking } from "@/utils/leaderboard"
import { parseYearMonth, isFutureMonth, getMonthDateRange } from "@/utils/date/leaderboard-months"

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
        visited: { name: string; slug: string; thumbnail: string | null; badge_stamp_url: string | null; visited_at: string | null }[]
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
            .where(and(eq(reviewInteractions.userId, userId), inArray(reviewInteractions.reviewId, reviewIds), eq(reviewInteractions.interactionType, "like")))
        viewerLikes = new Set(interactions.map((i) => i.reviewId))
    }

    // 4. Get passport cafes
    let visitedCafes: { name: string; slug: string; thumbnail: string | null; badge_stamp_url: string | null; visited_at: string | null; visitCount?: number }[] = []
    let favoriteCafes: { name: string; slug: string }[] = []
    let wishlistCafes: { name: string; slug: string }[] = []

    const passport = profile.passport as ProfilePassport | null

    // Fetch visited cafes from cafe_visits table (source of truth)
    const visitedCafesResult = await db
        .select({
            cafeId: cafeVisits.cafeId,
            cafeName: cafes.name,
            cafeSlug: cafes.slug,
            cafeThumbnail: cafes.thumbnail,
            cafeBadgeStampUrl: cafes.badgeStampUrl,
            visitCount: count(),
            firstVisit: sql<string>`MIN(${cafeVisits.visitedAt})`,
        })
        .from(cafeVisits)
        .innerJoin(cafes, eq(cafeVisits.cafeId, cafes.id))
        .where(eq(cafeVisits.userId, userId))
        .groupBy(cafeVisits.cafeId, cafes.id, cafes.name, cafes.slug, cafes.thumbnail, cafes.badgeStampUrl)

    visitedCafes = visitedCafesResult.map((r) => ({
        name: r.cafeName,
        slug: r.cafeSlug,
        thumbnail: r.cafeThumbnail,
        badge_stamp_url: r.cafeBadgeStampUrl,
        visited_at: r.firstVisit,
        visitCount: r.visitCount,
    }))

    // Sort: entries with dates first (oldest to newest), then entries without dates
    visitedCafes.sort((a, b) => {
        if (!a.visited_at && !b.visited_at) return 0
        if (!a.visited_at) return 1 // No date goes to end
        if (!b.visited_at) return -1
        return new Date(a.visited_at).getTime() - new Date(b.visited_at).getTime()
    })

    // Fetch favorite and wishlist cafes from passport (these don't exist in cafe_visits)
    if (passport) {
        const allCafeIds = [
            ...(passport.favorite_ids || []),
            ...(passport.wishlist_ids || []),
        ]

        if (allCafeIds.length > 0) {
            const uniqueIds = [...new Set(allCafeIds)]
            const passportCafesResult = await db
                .select({ id: cafes.id, name: cafes.name, slug: cafes.slug, thumbnail: cafes.thumbnail })
                .from(cafes)
                .where(inArray(cafes.id, uniqueIds))

            const cafeMap = new Map(passportCafesResult.map((c) => [c.id, c]))

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
            is_private: profile.isPrivate ?? false,
            moderator_regions: profile.moderatorRegions ?? null,
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

// Types for public profile data
export interface PublicProfileData {
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
    passportCafes: {
        visited: { name: string; slug: string; thumbnail: string | null; badge_stamp_url: string | null; visited_at: string | null }[]
        favorites: { name: string; slug: string }[]
        wishlist: { name: string; slug: string }[]
    }
    collections: {
        id: string
        title: string
        slug: string
        description: string | null
        coverImage: string | null
        itemCount: number | null
        viewsCount: number | null
        likesCount: number | null
        savesCount: number | null
        isPublic: boolean | null
        createdAt: string | null
    }[]
}

/**
 * Get public profile page data in a single call
 * Reduces 5 separate API calls to 1
 */
export async function getPublicProfileData(profile: ProfileWithBadges, viewerId?: string): Promise<PublicProfileData> {
    const passport = profile.passport as ProfilePassport | null

    // Fetch all data in parallel
    const [
        allBadgesResult,
        reviewsResult,
        visitedCafes,
        favoriteCafes,
        wishlistCafes,
        collectionsResult,
    ] = await Promise.all([
        // All badge definitions
        db.select().from(badgeDefinitions),

        // User reviews with cafe info and like status
        (async () => {
            const result = await db.select({
                id: reviews.id,
                rating: reviews.rating,
                comment: reviews.comment,
                createdAt: reviews.createdAt,
                images: reviews.images,
                likesCount: reviews.likesCount,
                userId: reviews.userId,
                cafeName: cafes.name,
                cafeSlug: cafes.slug,
                cafeThumbnail: cafes.thumbnail,
            })
                .from(reviews)
                .leftJoin(cafes, eq(reviews.cafeId, cafes.id))
                .where(and(eq(reviews.userId, profile.id), eq(reviews.status, "published")))
                .orderBy(desc(reviews.createdAt))

            // Check if viewer liked each review
            if (viewerId && result.length > 0) {
                const reviewIds = result.map(r => r.id)
                const likes = await db.select({ reviewId: reviewInteractions.reviewId })
                    .from(reviewInteractions)
                    .where(and(
                        inArray(reviewInteractions.reviewId, reviewIds),
                        eq(reviewInteractions.userId, viewerId),
                        eq(reviewInteractions.interactionType, "like")
                    ))
                const likedSet = new Set(likes.map(l => l.reviewId))
                return result.map(r => ({ ...r, isLiked: likedSet.has(r.id) }))
            }
            return result.map(r => ({ ...r, isLiked: false }))
        })(),

        // Passport - visited cafes (from cafe_visits table - source of truth)
        (async () => {
            // Fetch visited cafes from cafe_visits table directly
            const visitedCafesResult = await db
                .select({
                    cafeId: cafeVisits.cafeId,
                    cafeName: cafes.name,
                    cafeSlug: cafes.slug,
                    cafeThumbnail: cafes.thumbnail,
                    cafeBadgeStampUrl: cafes.badgeStampUrl,
                    firstVisit: sql<string>`MIN(${cafeVisits.visitedAt})`,
                })
                .from(cafeVisits)
                .innerJoin(cafes, eq(cafeVisits.cafeId, cafes.id))
                .where(eq(cafeVisits.userId, profile.id))
                .groupBy(cafeVisits.cafeId, cafes.id, cafes.name, cafes.slug, cafes.thumbnail, cafes.badgeStampUrl)

            const result = visitedCafesResult.map((r) => ({
                name: r.cafeName,
                slug: r.cafeSlug,
                thumbnail: r.cafeThumbnail,
                badge_stamp_url: r.cafeBadgeStampUrl,
                visited_at: r.firstVisit,
            }))

            // Sort: entries with dates first (oldest to newest), then entries without dates
            result.sort((a, b) => {
                if (!a.visited_at && !b.visited_at) return 0
                if (!a.visited_at) return 1 // No date goes to end
                if (!b.visited_at) return -1
                return new Date(a.visited_at).getTime() - new Date(b.visited_at).getTime()
            })
            return result
        })(),

        // Passport - favorite cafes
        passport?.favorite_ids?.length
            ? db.select({ name: cafes.name, slug: cafes.slug }).from(cafes).where(inArray(cafes.id, passport.favorite_ids))
            : Promise.resolve([]),

        // Passport - wishlist cafes
        passport?.wishlist_ids?.length
            ? db.select({ name: cafes.name, slug: cafes.slug }).from(cafes).where(inArray(cafes.id, passport.wishlist_ids))
            : Promise.resolve([]),

        // Collections - public collections by this user
        db.select({
            id: collections.id,
            title: collections.title,
            slug: collections.slug,
            description: collections.description,
            coverImage: collections.coverImage,
            itemCount: collections.itemCount,
            viewsCount: collections.viewsCount,
            likesCount: collections.likesCount,
            savesCount: collections.savesCount,
            isPublic: collections.isPublic,
            createdAt: collections.createdAt,
        })
            .from(collections)
            .where(and(
                eq(collections.userId, profile.id),
                eq(collections.isPublic, true)
            ))
            .orderBy(desc(collections.createdAt)),
    ])

    return {
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
            is_liked: r.isLiked,
            user_id: r.userId,
        })),
        passportCafes: {
            visited: visitedCafes,
            favorites: favoriteCafes,
            wishlist: wishlistCafes,
        },
        collections: collectionsResult.map((c) => ({
            id: c.id,
            title: c.title,
            slug: c.slug,
            description: c.description ?? null,
            coverImage: c.coverImage ?? null,
            itemCount: c.itemCount ?? 0,
            viewsCount: c.viewsCount ?? 0,
            likesCount: c.likesCount ?? 0,
            savesCount: c.savesCount ?? 0,
            isPublic: c.isPublic ?? true,
            createdAt: c.createdAt?.toISOString() ?? null,
        })),
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
        is_private: profile.isPrivate ?? false,
        moderator_regions: profile.moderatorRegions ?? null,
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
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Authentication required" }

    if (!userId) return { success: false, error: "User ID required" }

    if (currentUser.id !== userId && currentUser.role !== "admin") {
        return { success: false, error: "Not authorized to update this profile" }
    }

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
 * Update user's privacy settings
 */
export async function updatePrivacySettings(
    isPrivate: boolean
): Promise<{ success: boolean; error?: string }> {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "Unauthorized" }

    try {
        await db
            .update(profiles)
            .set({
                isPrivate: isPrivate,
                updatedAt: new Date(),
            })
            .where(eq(profiles.id, user.id))

        return { success: true }
    } catch (error) {
        console.error("Error updating privacy settings:", error)
        return { success: false, error: "Failed to update privacy settings" }
    }
}

/**
 * Get user's privacy settings
 */
export async function getPrivacySettings(): Promise<{ isPrivate: boolean }> {
    const user = await getCurrentUser()
    if (!user) return { isPrivate: false }

    try {
        const result = await db
            .select({ isPrivate: profiles.isPrivate })
            .from(profiles)
            .where(eq(profiles.id, user.id))
            .limit(1)

        return { isPrivate: result[0]?.isPrivate ?? false }
    } catch (error) {
        console.error("Error getting privacy settings:", error)
        return { isPrivate: false }
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
export async function getProfileByUsername(
    username: string,
    viewerId?: string
): Promise<ProfileWithBadges | null> {
    const profileResult = await db
        .select()
        .from(profiles)
        .where(eq(profiles.username, username))
        .limit(1)

    const profile = profileResult[0]
    if (!profile) return null

    const { canView } = await canViewProfile(profile.id, viewerId)

    if (!canView) {
        return {
            id: profile.id,
            username: profile.username,
            display_name: profile.displayName,
            avatar_url: profile.avatarUrl,
            bio: null,
            role: null,
            is_supporter: false,
            support_since: null,
            supporter_expires_at: null,
            total_contribution: 0,
            profile_completed: false,
            passport: null,
            stats: null,
            created_at: null,
            updated_at: null,
            is_private: true,
            moderator_regions: null,
            badges: [],
        } as ProfileWithBadges
    }

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
        is_private: profile.isPrivate ?? false,
        moderator_regions: profile.moderatorRegions ?? null,
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
            visits: [],
            wishlist_ids: [],
            favorite_ids: [],
        }
        const visitedIds = new Set(passport.visited_ids || [])
        const visits = passport.visits || []
        let visited = false

        if (visitedIds.has(cafeId)) {
            // Remove from both visited_ids and visits
            visitedIds.delete(cafeId)
            const updatedVisits = visits.filter(v => v.cafe_id !== cafeId)

            await db
                .update(profiles)
                .set({
                    passport: {
                        ...passport,
                        visited_ids: Array.from(visitedIds),
                        visits: updatedVisits,
                    },
                })
                .where(eq(profiles.id, user.id))
        } else {
            // Add to both visited_ids (for backward compat) and visits (with timestamp)
            visitedIds.add(cafeId)
            const updatedVisits = [...visits, { cafe_id: cafeId, visited_at: new Date().toISOString() }]
            visited = true

            await db
                .update(profiles)
                .set({
                    passport: {
                        ...passport,
                        visited_ids: Array.from(visitedIds),
                        visits: updatedVisits,
                    },
                })
                .where(eq(profiles.id, user.id))

            // Update activity points when adding a visit (not removing)
            const { updateUserActivityStats } = await import("./admin")
            await updateUserActivityStats(user.id)
        }

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

// ============================================================================
// VISIT TRACKING (Check-In System)
// ============================================================================


export interface CheckInResult {
    success: boolean
    visitCount: number
    isFirstVisit: boolean
    milestone?: number | null
    alreadyVisitedToday?: boolean
    companions?: string[] // IDs of companions added to the check-in
    /** Results of companion visit auto-marking */
    companionResults?: { id: string; added: boolean; alreadyVisited: boolean }[]
    awardedBadges?: string[]
    error?: string
}

/**
 * Record a visit (check-in) to a cafe.
 * Limits to one visit per cafe per day.
 * @param cafeId - The cafe to check in to
 * @param companionIds - Optional array of user IDs to tag as companions
 */
export async function recordVisit(cafeId: string, companionIds?: string[]): Promise<CheckInResult> {
    const user = await getCurrentUser()
    if (!user) return { success: false, visitCount: 0, isFirstVisit: false, milestone: null, error: "Unauthorized" }

    try {
        // Check if user already visited this cafe today (PH time)
        // Convert PH time bounds to UTC for DB comparison
        // getPHTodayStart() returns Shifted UTC (e.g. 00:00). Subtract 8h to get Real UTC (e.g. Prev Day 16:00)
        const todayPH = getPHTodayStart()
        const todayUTC = new Date(todayPH.getTime() - 8 * 60 * 60 * 1000)
        const tomorrowUTC = new Date(todayUTC.getTime() + 24 * 60 * 60 * 1000)

        const existingTodayVisit = await db
            .select({ id: cafeVisits.id })
            .from(cafeVisits)
            .where(
                and(
                    eq(cafeVisits.userId, user.id),
                    eq(cafeVisits.cafeId, cafeId),
                    sql`${cafeVisits.visitedAt} >= ${todayUTC.toISOString()}`,
                    sql`${cafeVisits.visitedAt} < ${tomorrowUTC.toISOString()}`
                )
            )
            .limit(1)

        if (existingTodayVisit.length > 0) {
            // Already visited today, just return current count
            const countResult = await db
                .select({ count: count() })
                .from(cafeVisits)
                .where(and(eq(cafeVisits.userId, user.id), eq(cafeVisits.cafeId, cafeId)))

            return {
                success: false,
                visitCount: countResult[0]?.count ?? 0,
                isFirstVisit: false,
                milestone: null,
                alreadyVisitedToday: true,
            }
        }

        // Validate companion IDs if provided (must exist and not be the current user)
        let validCompanions: string[] = []
        if (companionIds && companionIds.length > 0) {
            // Limit to max 5 companions
            const limitedIds = companionIds.slice(0, 5).filter(id => id !== user.id)

            if (limitedIds.length > 0) {
                const existingProfiles = await db
                    .select({ id: profiles.id })
                    .from(profiles)
                    .where(inArray(profiles.id, limitedIds))

                validCompanions = existingProfiles.map(p => p.id)
            }
        }

        // Check if this is the user's first ever visit to this cafe
        const existingVisits = await db
            .select({ count: count() })
            .from(cafeVisits)
            .where(and(eq(cafeVisits.userId, user.id), eq(cafeVisits.cafeId, cafeId)))

        const isFirstVisit = (existingVisits[0]?.count ?? 0) === 0

        // Record the new visit with companions
        await db.insert(cafeVisits).values({
            userId: user.id,
            cafeId: cafeId,
            visitedAt: new Date(),
            companions: validCompanions.length > 0 ? validCompanions : null,
        })

        // Also update passport for backward compatibility (add to visited_ids if not present)
        if (isFirstVisit) {
            const profileResult = await db
                .select({ passport: profiles.passport })
                .from(profiles)
                .where(eq(profiles.id, user.id))
                .limit(1)

            const passport = (profileResult[0]?.passport as ProfilePassport) || {
                visited_ids: [],
                visits: [],
                wishlist_ids: [],
                favorite_ids: [],
            }

            if (!passport.visited_ids.includes(cafeId)) {
                const updatedVisits = [...(passport.visits || []), { cafe_id: cafeId, visited_at: new Date().toISOString() }]
                await db
                    .update(profiles)
                    .set({
                        passport: {
                            ...passport,
                            visited_ids: [...passport.visited_ids, cafeId],
                            visits: updatedVisits,
                        },
                    })
                    .where(eq(profiles.id, user.id))

                // Update activity points for first visit
                const { updateUserActivityStats } = await import("./admin")
                await updateUserActivityStats(user.id)
            }
        }

        // COMPANION VISIT AUTO-MARKING
        // Record visits for companions (if they haven't visited today)
        // =====================================================================
        const companionResults: { id: string; added: boolean; alreadyVisited: boolean }[] = []

        if (validCompanions.length > 0) {
            for (const companionId of validCompanions) {
                try {
                    // Check if companion already visited today
                    const companionTodayVisit = await db
                        .select({ id: cafeVisits.id, companions: cafeVisits.companions })
                        .from(cafeVisits)
                        .where(
                            and(
                                eq(cafeVisits.userId, companionId),
                                eq(cafeVisits.cafeId, cafeId),
                                sql`${cafeVisits.visitedAt} >= ${todayUTC.toISOString()}`,
                                sql`${cafeVisits.visitedAt} < ${tomorrowUTC.toISOString()}`
                            )
                        )
                        .limit(1)

                    if (companionTodayVisit.length > 0) {
                        // Companion already visited today - update their visit to include main user as companion
                        const existingCompanions = (companionTodayVisit[0].companions as string[]) || []
                        if (!existingCompanions.includes(user.id)) {
                            await db
                                .update(cafeVisits)
                                .set({ companions: [...existingCompanions, user.id] })
                                .where(eq(cafeVisits.id, companionTodayVisit[0].id))
                        }
                        companionResults.push({ id: companionId, added: false, alreadyVisited: true })
                    } else {
                        // Check if this is companion's first visit to this cafe
                        const companionExistingVisits = await db
                            .select({ count: count() })
                            .from(cafeVisits)
                            .where(and(eq(cafeVisits.userId, companionId), eq(cafeVisits.cafeId, cafeId)))

                        const isCompanionFirstVisit = (companionExistingVisits[0]?.count ?? 0) === 0

                        // Record companion's visit
                        await db.insert(cafeVisits).values({
                            userId: companionId,
                            cafeId: cafeId,
                            visitedAt: new Date(),
                            companions: [user.id], // Tag the main user as their companion
                        })

                        // Update companion's passport if first visit
                        if (isCompanionFirstVisit) {
                            const companionProfile = await db
                                .select({ passport: profiles.passport })
                                .from(profiles)
                                .where(eq(profiles.id, companionId))
                                .limit(1)

                            const companionPassport = (companionProfile[0]?.passport as ProfilePassport) || {
                                visited_ids: [],
                                visits: [],
                                wishlist_ids: [],
                                favorite_ids: [],
                            }

                            if (!companionPassport.visited_ids.includes(cafeId)) {
                                await db
                                    .update(profiles)
                                    .set({
                                        passport: {
                                            ...companionPassport,
                                            visited_ids: [...companionPassport.visited_ids, cafeId],
                                            visits: [...(companionPassport.visits || []), { cafe_id: cafeId, visited_at: new Date().toISOString() }],
                                        },
                                    })
                                    .where(eq(profiles.id, companionId))
                            }
                        }

                        companionResults.push({ id: companionId, added: true, alreadyVisited: false })
                    }
                } catch (companionError) {
                    console.error(`Error recording companion visit for ${companionId}:`, companionError)
                    // Continue with other companions even if one fails
                }
            }
        }

        const newCount = (existingVisits[0]?.count ?? 0) + 1

        // Check for visit-based badges (Regular at 5, Loyal Customer at 10)
        const { checkAndAwardBadges } = await import("@/utils/badges/badge-logic")
        const awardedBadges = await checkAndAwardBadges(user.id, { visits: true, cafeId })

        // Check for milestone (celebrate at 5, 10, 25, 50, 100 visits)
        const milestones = [5, 10, 25, 50, 100]
        const milestone = milestones.includes(newCount) ? newCount : null

        return { success: true, visitCount: newCount, isFirstVisit, milestone, companions: validCompanions, companionResults, awardedBadges }
    } catch (error) {
        console.error("Error recording visit:", error)
        return { success: false, visitCount: 0, isFirstVisit: false, milestone: null, error: "Failed to record visit" }
    }
}

/**
 * Get details of today's check-in (including companions)
 */
export async function getTodayCheckIn(cafeId: string): Promise<{
    id: string
    visitedAt: string
    companions: {
        id: string
        username: string
        displayName: string
        avatarUrl: string | null
    }[]
} | null> {
    const user = await getCurrentUser()
    if (!user) return null

    try {
        const todayPH = getPHTodayStart()
        const todayUTC = new Date(todayPH.getTime() - 8 * 60 * 60 * 1000)
        const tomorrowUTC = new Date(todayUTC.getTime() + 24 * 60 * 60 * 1000)

        const result = await db
            .select({
                id: cafeVisits.id,
                visitedAt: cafeVisits.visitedAt,
                companions: cafeVisits.companions,
            })
            .from(cafeVisits)
            .where(
                and(
                    eq(cafeVisits.userId, user.id),
                    eq(cafeVisits.cafeId, cafeId),
                    sql`${cafeVisits.visitedAt} >= ${todayUTC.toISOString()}`,
                    sql`${cafeVisits.visitedAt} < ${tomorrowUTC.toISOString()}`
                )
            )
            .limit(1)

        if (result.length === 0) return null
        
        const visit = result[0]
        const companionIds = (visit.companions as string[]) || []
        
        let companionsData: { id: string; username: string; displayName: string; avatarUrl: string | null }[] = []
        
        if (companionIds.length > 0) {
            const profilesResult = await db
                .select({
                    id: profiles.id,
                    username: profiles.username,
                    displayName: profiles.displayName,
                    avatarUrl: profiles.avatarUrl,
                })
                .from(profiles)
                .where(inArray(profiles.id, companionIds))
                
            companionsData = profilesResult
        }

        return {
            id: visit.id,
            visitedAt: visit.visitedAt?.toISOString() ?? new Date().toISOString(),
            companions: companionsData
        }
    } catch (error) {
        console.error("Error getting today's check-in:", error)
        return null
    }
}

/**
 * Update an existing check-in for today (add/remove companions)
 */
export async function updateCheckIn(cafeId: string, companionIds: string[]): Promise<CheckInResult> {
    const user = await getCurrentUser()
    if (!user) return { success: false, visitCount: 0, isFirstVisit: false, milestone: null, error: "Unauthorized" }

    try {
        const todayPH = getPHTodayStart()
        const todayUTC = new Date(todayPH.getTime() - 8 * 60 * 60 * 1000)
        const tomorrowUTC = new Date(todayUTC.getTime() + 24 * 60 * 60 * 1000)

        // Get existing visit
        const existingVisitResult = await db
            .select({ id: cafeVisits.id, companions: cafeVisits.companions })
            .from(cafeVisits)
            .where(
                and(
                    eq(cafeVisits.userId, user.id),
                    eq(cafeVisits.cafeId, cafeId),
                    sql`${cafeVisits.visitedAt} >= ${todayUTC.toISOString()}`,
                    sql`${cafeVisits.visitedAt} < ${tomorrowUTC.toISOString()}`
                )
            )
            .limit(1)

        if (existingVisitResult.length === 0) {
            return { success: false, visitCount: 0, isFirstVisit: false, milestone: null, error: "No check-in found for today" }
        }

        const existingVisit = existingVisitResult[0]
        const oldCompanionIds = (existingVisit.companions as string[]) || []
        
        // Filter out self if somehow included
        const requestedCompanionIds = (companionIds || []).filter(id => id !== user.id)
        
        // Identify added and removed companions
        const addedIds = requestedCompanionIds.filter(id => !oldCompanionIds.includes(id))
        const removedIds = oldCompanionIds.filter(id => !requestedCompanionIds.includes(id))
        const keptIds = oldCompanionIds.filter(id => requestedCompanionIds.includes(id))

        // Validate added companions
        let validAddedCompanions: string[] = []
        if (addedIds.length > 0) {
            const existingProfiles = await db
                .select({ id: profiles.id })
                .from(profiles)
                .where(inArray(profiles.id, addedIds))

            validAddedCompanions = existingProfiles.map(p => p.id)
        }

        const companionResults: { id: string; added: boolean; alreadyVisited: boolean }[] = []

        // PROCESS ADDED COMPANIONS (Logic from recordVisit)
        if (validAddedCompanions.length > 0) {
            for (const companionId of validAddedCompanions) {
                try {
                    // Check if companion already visited today
                    const companionTodayVisit = await db
                        .select({ id: cafeVisits.id, companions: cafeVisits.companions })
                        .from(cafeVisits)
                        .where(
                            and(
                                eq(cafeVisits.userId, companionId),
                                eq(cafeVisits.cafeId, cafeId),
                                sql`${cafeVisits.visitedAt} >= ${todayUTC.toISOString()}`,
                                sql`${cafeVisits.visitedAt} < ${tomorrowUTC.toISOString()}`
                            )
                        )
                        .limit(1)

                    if (companionTodayVisit.length > 0) {
                        // Companion already visited today - update their visit to include main user as companion
                        const existingCompanions = (companionTodayVisit[0].companions as string[]) || []
                        if (!existingCompanions.includes(user.id)) {
                            await db
                                .update(cafeVisits)
                                .set({ companions: [...existingCompanions, user.id] })
                                .where(eq(cafeVisits.id, companionTodayVisit[0].id))
                        }
                        companionResults.push({ id: companionId, added: false, alreadyVisited: true })
                    } else {
                        // Check if this is companion's first visit to this cafe
                        const companionExistingVisits = await db
                            .select({ count: count() })
                            .from(cafeVisits)
                            .where(and(eq(cafeVisits.userId, companionId), eq(cafeVisits.cafeId, cafeId)))

                        const isCompanionFirstVisit = (companionExistingVisits[0]?.count ?? 0) === 0

                        // Record companion's visit
                        await db.insert(cafeVisits).values({
                            userId: companionId,
                            cafeId: cafeId,
                            visitedAt: new Date(),
                            companions: [user.id], // Tag the main user as their companion
                        })

                        // Update companion's passport if first visit
                        if (isCompanionFirstVisit) {
                            const companionProfile = await db
                                .select({ passport: profiles.passport })
                                .from(profiles)
                                .where(eq(profiles.id, companionId))
                                .limit(1)

                            const companionPassport = (companionProfile[0]?.passport as ProfilePassport) || {
                                visited_ids: [],
                                visits: [],
                                wishlist_ids: [],
                                favorite_ids: [],
                            }

                            if (!companionPassport.visited_ids.includes(cafeId)) {
                                await db
                                    .update(profiles)
                                    .set({
                                        passport: {
                                            ...companionPassport,
                                            visited_ids: [...companionPassport.visited_ids, cafeId],
                                            visits: [...(companionPassport.visits || []), { cafe_id: cafeId, visited_at: new Date().toISOString() }],
                                        },
                                    })
                                    .where(eq(profiles.id, companionId))
                            }
                        }

                        companionResults.push({ id: companionId, added: true, alreadyVisited: false })
                    }
                } catch (companionError) {
                    console.error(`Error recording companion visit for ${companionId}:`, companionError)
                }
            }
        }

        // PROCESS REMOVED COMPANIONS
        if (removedIds.length > 0) {
            for (const companionId of removedIds) {
                try {
                    // Check if companion already visited today
                    const companionTodayVisit = await db
                        .select({ id: cafeVisits.id, companions: cafeVisits.companions })
                        .from(cafeVisits)
                        .where(
                            and(
                                eq(cafeVisits.userId, companionId),
                                eq(cafeVisits.cafeId, cafeId),
                                sql`${cafeVisits.visitedAt} >= ${todayUTC.toISOString()}`,
                                sql`${cafeVisits.visitedAt} < ${tomorrowUTC.toISOString()}`
                            )
                        )
                        .limit(1)

                    if (companionTodayVisit.length > 0) {
                        const existingCompanions = (companionTodayVisit[0].companions as string[]) || []
                        if (existingCompanions.includes(user.id)) {
                            // Remove user from companion's list
                            const updatedCompanions = existingCompanions.filter(id => id !== user.id)
                            await db
                                .update(cafeVisits)
                                .set({ companions: updatedCompanions.length > 0 ? updatedCompanions : null })
                                .where(eq(cafeVisits.id, companionTodayVisit[0].id))
                        }
                    }
                } catch (error) {
                    console.error(`Error removing companion association for ${companionId}:`, error)
                }
            }
        }

        // Update main user's check-in
        const finalCompanions = [...keptIds, ...validAddedCompanions]
        
        await db
            .update(cafeVisits)
            .set({ companions: finalCompanions.length > 0 ? finalCompanions : null })
            .where(eq(cafeVisits.id, existingVisit.id))

        // Get current visit count
        const countResult = await db
            .select({ count: count() })
            .from(cafeVisits)
            .where(and(eq(cafeVisits.userId, user.id), eq(cafeVisits.cafeId, cafeId)))

        return { 
            success: true, 
            visitCount: countResult[0]?.count ?? 0, 
            isFirstVisit: false, 
            milestone: null, 
            companions: finalCompanions, 
            companionResults 
        }

    } catch (error) {
        console.error("Error updating check-in:", error)
        return { success: false, visitCount: 0, isFirstVisit: false, milestone: null, error: "Failed to update check-in" }
    }
}

/**
 * Get the user's visit count for a specific cafe
 */
export async function getVisitCount(cafeId: string): Promise<{ count: number; lastVisit: string | null }> {
    const user = await getCurrentUser()
    if (!user) return { count: 0, lastVisit: null }

    try {
        const result = await db
            .select({ count: count(), lastVisit: sql<string>`MAX(${cafeVisits.visitedAt})` })
            .from(cafeVisits)
            .where(and(eq(cafeVisits.userId, user.id), eq(cafeVisits.cafeId, cafeId)))

        return {
            count: result[0]?.count ?? 0,
            lastVisit: result[0]?.lastVisit ?? null,
        }
    } catch (error) {
        console.error("Error getting visit count:", error)
        return { count: 0, lastVisit: null }
    }
}

/**
 * Get visit statistics for a cafe (total visits, unique visitors)
 */
export async function getCafeVisitStats(cafeId: string): Promise<{
    totalVisits: number
    uniqueVisitors: number
}> {
    try {
        const [totalResult, uniqueResult] = await Promise.all([
            db.select({ count: count() }).from(cafeVisits).where(eq(cafeVisits.cafeId, cafeId)),
            db.select({ count: sql<number>`COUNT(DISTINCT ${cafeVisits.userId})` }).from(cafeVisits).where(eq(cafeVisits.cafeId, cafeId)),
        ])

        return {
            totalVisits: totalResult[0]?.count ?? 0,
            uniqueVisitors: uniqueResult[0]?.count ?? 0,
        }
    } catch (error) {
        console.error("Error getting cafe visit stats:", error)
        return { totalVisits: 0, uniqueVisitors: 0 }
    }
}

/**
 * Get users who visited a cafe today (for "Visitors Today" display)
 */
export async function getTodayVisitors(cafeId: string): Promise<{
    visitors: {
        userId: string
        username: string
        displayName: string
        avatarUrl: string | null
        visitedAt: string
    }[]
}> {
    try {
        const currentUser = await getCurrentUser()
        if (!currentUser) {
            return { visitors: [] }
        }

        const todayPH = getPHTodayStart()
        const todayUTC = new Date(todayPH.getTime() - 8 * 60 * 60 * 1000)
        const tomorrowUTC = new Date(todayUTC.getTime() + 24 * 60 * 60 * 1000)

        const result = await db
            .select({
                userId: cafeVisits.userId,
                username: profiles.username,
                displayName: profiles.displayName,
                avatarUrl: profiles.avatarUrl,
                visitedAt: cafeVisits.visitedAt,
                isPrivate: profiles.isPrivate,
            })
            .from(cafeVisits)
            .innerJoin(profiles, eq(cafeVisits.userId, profiles.id))
            .where(
                and(
                    eq(cafeVisits.cafeId, cafeId),
                    sql`${cafeVisits.visitedAt} >= ${todayUTC.toISOString()}`,
                    sql`${cafeVisits.visitedAt} < ${tomorrowUTC.toISOString()}`
                )
            )
            .orderBy(desc(cafeVisits.visitedAt))

        const filtered = []
        for (const r of result) {
            if (!r.isPrivate) {
                filtered.push(r)
                continue
            }
            const follows = await db
                .select({ id: userFollows.id })
                .from(userFollows)
                .where(
                    and(
                        eq(userFollows.followerId, currentUser.id),
                        eq(userFollows.followingId, r.userId)
                    )
                )
                .limit(1)
            if (follows.length > 0) {
                filtered.push(r)
            }
        }

        return {
            visitors: filtered.map((r) => ({
                userId: r.userId,
                username: r.username,
                displayName: r.displayName,
                avatarUrl: r.avatarUrl,
                visitedAt: r.visitedAt?.toISOString() ?? new Date().toISOString(),
            })),
        }
    } catch (error) {
        console.error("Error getting today's visitors:", error)
        return { visitors: [] }
    }
}

/**
 * Get all visits for a user (for visit history display)
 */
export async function getUserVisitHistory(): Promise<{
    visits: {
        cafeId: string
        cafeName: string
        cafeSlug: string
        cafeThumbnail: string | null
        visitCount: number
        lastVisit: string
    }[]
}> {
    const user = await getCurrentUser()
    if (!user) return { visits: [] }

    try {
        // Get aggregated visits grouped by cafe
        const result = await db
            .select({
                cafeId: cafeVisits.cafeId,
                cafeName: cafes.name,
                cafeSlug: cafes.slug,
                cafeThumbnail: cafes.thumbnail,
                visitCount: count(),
                lastVisit: sql<string>`MAX(${cafeVisits.visitedAt})`,
            })
            .from(cafeVisits)
            .innerJoin(cafes, eq(cafeVisits.cafeId, cafes.id))
            .where(eq(cafeVisits.userId, user.id))
            .groupBy(cafeVisits.cafeId, cafes.id, cafes.name, cafes.slug, cafes.thumbnail)
            .orderBy(sql`MAX(${cafeVisits.visitedAt}) DESC`)

        return {
            visits: result.map((r) => ({
                cafeId: r.cafeId,
                cafeName: r.cafeName,
                cafeSlug: r.cafeSlug,
                cafeThumbnail: r.cafeThumbnail,
                visitCount: r.visitCount,
                lastVisit: r.lastVisit,
            })),
        }
    } catch (error) {
        console.error("Error getting user visit history:", error)
        return { visits: [] }
    }
}

/**
 * Check if user has already visited a cafe today
 */
export async function hasVisitedToday(cafeId: string): Promise<boolean> {
    const user = await getCurrentUser()
    if (!user) return false

    try {
        const todayPH = getPHTodayStart()
        const todayUTC = new Date(todayPH.getTime() - 8 * 60 * 60 * 1000)
        const tomorrowUTC = new Date(todayUTC.getTime() + 24 * 60 * 60 * 1000)

        const result = await db
            .select({ id: cafeVisits.id })
            .from(cafeVisits)
            .where(
                and(
                    eq(cafeVisits.userId, user.id),
                    eq(cafeVisits.cafeId, cafeId),
                    sql`${cafeVisits.visitedAt} >= ${todayUTC.toISOString()}`,
                    sql`${cafeVisits.visitedAt} < ${tomorrowUTC.toISOString()}`
                )
            )
            .limit(1)

        return result.length > 0
    } catch (error) {
        console.error("Error checking today's visit:", error)
        return false
    }
}

/**
 * Get user's preferred region based on most-visited cafes
 */
export async function getUserPreferredRegion(): Promise<string | null> {
    const user = await getCurrentUser()
    if (!user) return null

    try {
        // Get the region with most visits
        const result = await db
            .select({
                region: cafes.region,
                visitCount: count(),
            })
            .from(cafeVisits)
            .innerJoin(cafes, eq(cafeVisits.cafeId, cafes.id))
            .where(eq(cafeVisits.userId, user.id))
            .groupBy(cafes.region)
            .orderBy(desc(count()))
            .limit(1)

        return result[0]?.region || null
    } catch (error) {
        console.error("Error getting user preferred region:", error)
        return null
    }
}

/**
 * Get monthly leaderboard of top visitors by composite score
 * @param region - Optional region filter (e.g., "NCR", "Region IV-A")
 * @param limit - Number of results to return (default 20)
 * @param yearMonth - Optional YYYY-MM string to select a specific month
 */
/**
 * Internal helper: Compute user leaderboard live for any given month.
 * Used by getMonthlyLeaderboard and for backfilling historical data.
 */
async function computeUserLeaderboardLive(
    selectedYearMonth: { year: number; month: number },
    region: string | null | undefined,
    limit: number
): Promise<Array<{
    rank: number
    userId: string
    username: string
    displayName: string
    avatarUrl: string | null
    visitCount: number
    score: number
}>> {
    // Get date range for the selected month
    const { startDate: monthStartPH, endDate: monthEndPH } = getMonthDateRange(selectedYearMonth)
    const monthStartUTC = new Date(monthStartPH.getTime() - 8 * 60 * 60 * 1000)
    const monthEndUTC = new Date(monthEndPH.getTime() - 8 * 60 * 60 * 1000)

    // Build composite score query
    // Compute per-user stats: uniqueVisits, reviewCount, likesReceived, photoCount, verifiedCount, regionDiversity
    const baseQuery = db
        .select({
            userId: cafeVisits.userId,
            username: profiles.username,
            displayName: profiles.displayName,
            avatarUrl: profiles.avatarUrl,
            uniqueVisits: sql<number>`count(distinct ${cafeVisits.cafeId})`.as("uniqueVisits"),
            reviewCount: sql<number>`count(distinct ${reviews.id}) filter (where ${reviews.status} = 'published')`.as("reviewCount"),
            likesReceived: sql<number>`coalesce(sum(${reviews.likesCount}) filter (where ${reviews.status} = 'published'), 0)`.as("likesReceived"),
            photoCount: sql<number>`coalesce(sum(array_length(${reviews.images}, 1)) filter (where ${reviews.status} = 'published'), 0)`.as("photoCount"),
            verifiedCount: sql<number>`count(*) filter (where ${reviews.isVerifiedVisit} = true and ${reviews.status} = 'published')`.as("verifiedCount"),
            regionDiversity: sql<number>`count(distinct ${cafes.region})`.as("regionDiversity"),
        })
        .from(cafeVisits)
        .innerJoin(profiles, eq(cafeVisits.userId, profiles.id))
        .leftJoin(reviews, and(
            eq(reviews.userId, cafeVisits.userId),
            eq(reviews.cafeId, cafeVisits.cafeId),
            sql`${reviews.createdAt} >= ${monthStartUTC.toISOString()}`,
            sql`${reviews.createdAt} < ${monthEndUTC.toISOString()}`
        ))
        .innerJoin(cafes, eq(cafeVisits.cafeId, cafes.id))
        .where(
            and(
                sql`${cafeVisits.visitedAt} >= ${monthStartUTC.toISOString()}`,
                sql`${cafeVisits.visitedAt} < ${monthEndUTC.toISOString()}`,
                region ? eq(cafes.region, region) : undefined
            )
        )
        .groupBy(cafeVisits.userId, profiles.id, profiles.username, profiles.displayName, profiles.avatarUrl)

    const results = await baseQuery

    // Calculate composite score and build leaderboard entries
    const scoredResults = results.map((r) => {
        const uniqueVisits = Number(r.uniqueVisits) || 0
        const reviewCount = Number(r.reviewCount) || 0
        const likesReceived = Number(r.likesReceived) || 0
        const photoCount = Number(r.photoCount) || 0
        const verifiedCount = Number(r.verifiedCount) || 0
        const regionDiversity = Number(r.regionDiversity) || 0

        const score =
            uniqueVisits * 3 +
            reviewCount * 5 +
            likesReceived * 1 +
            photoCount * 2 +
            verifiedCount * 2 +
            regionDiversity * 1

        return {
            userId: r.userId,
            username: r.username,
            displayName: r.displayName,
            avatarUrl: r.avatarUrl,
            visitCount: uniqueVisits,
            score,
        }
    })

    // Sort by score DESC, then username ASC for tie-breaking
    scoredResults.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return a.username.localeCompare(b.username)
    })

    // Apply tie ranking (dense ranking: 1, 1, 2)
    const rankedResults = applyTieRanking(scoredResults.slice(0, limit))

    return rankedResults.map((r) => ({
        rank: r.rank,
        userId: r.userId as string,
        username: r.username as string,
        displayName: r.displayName as string,
        avatarUrl: r.avatarUrl as string | null,
        visitCount: r.visitCount as number,
        score: r.score as number,
    }))
}

export async function getMonthlyLeaderboard(
    region?: string | null,
    limit: number = 20,
    yearMonth?: string | null,
    options?: { computeLive?: boolean }
): Promise<{
    leaderboard: {
        rank: number
        userId: string
        username: string
        displayName: string
        avatarUrl: string | null
        visitCount: number
        score: number
    }[]
    userRank: number | null
    region: string | null
    selectedMonth: string
}> {
    const user = await getCurrentUser()

    try {
        // Parse and validate yearMonth, default to current month
        let selectedYearMonth = parseYearMonth(yearMonth || "")
        if (!selectedYearMonth || isFutureMonth(selectedYearMonth)) {
            const nowPH = getPHTime()
            selectedYearMonth = {
                year: nowPH.getFullYear(),
                month: nowPH.getMonth() + 1,
            }
        }

        const selectedMonthStr = `${selectedYearMonth.year}-${selectedYearMonth.month.toString().padStart(2, "0")}`
        const nowPH = getPHTime()
        const currentYearMonth = `${nowPH.getFullYear()}-${(nowPH.getMonth() + 1).toString().padStart(2, "0")}`
        const isCurrentMonth = selectedMonthStr === currentYearMonth

        // For past months, read from snapshot unless computeLive is true (for backfill)
        if (!isCurrentMonth && !options?.computeLive) {
            const snapshotResults = await db
                .select({
                    rank: monthlyLeaderboardSnapshots.rank,
                    userId: monthlyLeaderboardSnapshots.userId,
                    username: profiles.username,
                    displayName: profiles.displayName,
                    avatarUrl: profiles.avatarUrl,
                    visitCount: monthlyLeaderboardSnapshots.visitCount,
                    score: monthlyLeaderboardSnapshots.score,
                })
                .from(monthlyLeaderboardSnapshots)
                .innerJoin(profiles, eq(monthlyLeaderboardSnapshots.userId, profiles.id))
                .where(
                    and(
                        eq(monthlyLeaderboardSnapshots.type, "user"),
                        eq(monthlyLeaderboardSnapshots.yearMonth, selectedMonthStr),
                        region ? eq(monthlyLeaderboardSnapshots.region, region) : sql`${monthlyLeaderboardSnapshots.region} IS NULL`
                    )
                )
                .orderBy(asc(monthlyLeaderboardSnapshots.rank))
                .limit(limit)

            // If no snapshot exists for that month, return empty leaderboard (unless computing live)
            if (snapshotResults.length === 0) {
                return {
                    leaderboard: [],
                    userRank: null,
                    region: region || null,
                    selectedMonth: selectedMonthStr,
                }
            }

            const leaderboard = snapshotResults.map((r) => ({
                rank: r.rank,
                userId: r.userId!,
                username: r.username,
                displayName: r.displayName,
                avatarUrl: r.avatarUrl,
                visitCount: r.visitCount || 0,
                score: r.score,
            }))

            // Find current user's rank if logged in
            let userRank: number | null = null
            if (user) {
                const userEntry = leaderboard.find((e) => e.userId === user.id)
                if (userEntry) {
                    userRank = userEntry.rank
                } else {
                    // Query user's rank from snapshot
                    const userSnapshot = await db
                        .select({ rank: monthlyLeaderboardSnapshots.rank })
                        .from(monthlyLeaderboardSnapshots)
                        .where(
                            and(
                                eq(monthlyLeaderboardSnapshots.type, "user"),
                                eq(monthlyLeaderboardSnapshots.yearMonth, selectedMonthStr),
                                eq(monthlyLeaderboardSnapshots.userId, user.id),
                                region ? eq(monthlyLeaderboardSnapshots.region, region) : sql`${monthlyLeaderboardSnapshots.region} IS NULL`
                            )
                        )
                        .limit(1)
                    userRank = userSnapshot[0]?.rank || null
                }
            }

            return {
                leaderboard,
                userRank,
                region: region || null,
                selectedMonth: selectedMonthStr,
            }
        }

        // Compute live for current month or when computeLive option is set
        const leaderboard = await computeUserLeaderboardLive(selectedYearMonth, region, limit)

        // Find current user's rank if logged in (only for current month)
        let userRank: number | null = null
        if (user && isCurrentMonth) {
            const userEntry = leaderboard.find((e) => e.userId === user.id)
            if (userEntry) {
                userRank = userEntry.rank
            }
        }

        return {
            leaderboard,
            userRank,
            region: region || null,
            selectedMonth: selectedMonthStr,
        }
    } catch (error) {
        console.error("Error getting monthly leaderboard:", error)
        const nowPH = getPHTime()
        const fallbackMonth = `${nowPH.getFullYear()}-${(nowPH.getMonth() + 1).toString().padStart(2, "0")}`
        return {
            leaderboard: [],
            userRank: null,
            region: region || null,
            selectedMonth: fallbackMonth,
        }
    }
}

/**
 * Check if a viewer can view a user's full profile content
 */
export async function canViewProfile(
    profileUserId: string,
    viewerId?: string
): Promise<{ canView: boolean; isPrivate: boolean }> {
    try {
        // Get profile privacy status
        const profile = await db
            .select({ isPrivate: profiles.isPrivate })
            .from(profiles)
            .where(eq(profiles.id, profileUserId))
            .limit(1)

        if (!profile.length) {
            return { canView: false, isPrivate: false }
        }

        const isPrivate = profile[0].isPrivate ?? false

        // Public profiles are viewable by everyone
        if (!isPrivate) {
            return { canView: true, isPrivate: false }
        }

        // Private profiles: check if viewer is the owner or a follower
        if (!viewerId) {
            return { canView: false, isPrivate: true }
        }

        // Owner can always view their own profile
        if (viewerId === profileUserId) {
            return { canView: true, isPrivate: true }
        }

        // Check if viewer follows the profile owner
        const followResult = await db
            .select({ id: userFollows.id })
            .from(userFollows)
            .where(
                and(
                    eq(userFollows.followerId, viewerId),
                    eq(userFollows.followingId, profileUserId)
                )
            )
            .limit(1)

        return {
            canView: followResult.length > 0,
            isPrivate: true,
        }
    } catch (error) {
        console.error("Error checking profile access:", error)
        return { canView: false, isPrivate: false }
    }
}
