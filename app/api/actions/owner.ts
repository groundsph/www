'use server'

import { db } from "@/db"
import {
    cafes,
    cafeSubscriptions,
    cafeStories,
    cafeMenuItems,
    cafeRatingStats,
    reviews,
    profiles,
    ownerReviewResponses,
    ownerVerificationRequests,
    featuredSlotRequests,
} from "@/db/schema"
import { eq, and, desc, inArray, sql } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
import {
    OwnedCafe,
    OwnerVerificationRequest,
    OwnerReviewResponse,
    CafeMenuItem,
    OwnerActionResult,
    VerificationRequestForm,
    ReviewResponseForm,
    MenuItemForm,
    MenuItemResult,
    CafeSubscription,
    toDisplayTier,
    SUBSCRIPTION_TIERS,
} from "@/utils/types/owner"
import { CafeWithRatings } from "@/utils/types/extra"
import { logContribution, getChangedFields, generateChangeSummary } from "@/utils/contribution-logging"
import { revalidatePath } from "next/cache"

// ============================================
// Permission Checks
// ============================================

/**
 * Check if the current user is an owner of the specified cafe
 */
export async function isOwnerOfCafe(cafeId: string): Promise<boolean> {
    const user = await getCurrentUser()
    if (!user) return false

    const result = await db
        .select({ ownerIds: cafes.ownerIds })
        .from(cafes)
        .where(eq(cafes.id, cafeId))
        .limit(1)

    const cafe = result[0]
    if (!cafe || !cafe.ownerIds) return false

    return cafe.ownerIds.includes(user.id)
}

/**
 * Get cafe ID by slug (for slug-based routes)
 */
export async function getCafeIdBySlug(slug: string): Promise<string | null> {
    const result = await db
        .select({ id: cafes.id })
        .from(cafes)
        .where(eq(cafes.slug, slug))
        .limit(1)

    return result[0]?.id || null
}

/**
 * Get the current user ID if authenticated
 */
async function getCurrentUserId(): Promise<string | null> {
    const user = await getCurrentUser()
    return user?.id || null
}

// ============================================
// Owner Dashboard Data
// ============================================

/**
 * Get all cafes owned by the current user with subscription info
 */
export async function getOwnedCafes(): Promise<OwnedCafe[]> {
    const userId = await getCurrentUserId()
    if (!userId) return []

    // Get cafes where user is in owner_ids using raw SQL for array containment
    const cafesResult = await db
        .select({
            id: cafes.id,
            name: cafes.name,
            slug: cafes.slug,
            thumbnail: cafes.thumbnail,
            cityMunicipality: cafes.cityMunicipality,
            region: cafes.region,
            isVerified: cafes.isVerified,
            isPublished: cafes.isPublished,
        })
        .from(cafes)
        .where(sql`${cafes.ownerIds} @> ARRAY[${userId}]::uuid[]`)

    if (!cafesResult.length) return []

    const cafeIds = cafesResult.map(c => c.id)

    // Get rating stats for these cafes
    const ratingsResult = await db
        .select({
            cafeId: cafeRatingStats.cafeId,
            averageRating: cafeRatingStats.averageRating,
            totalReviews: cafeRatingStats.totalReviews,
        })
        .from(cafeRatingStats)
        .where(inArray(cafeRatingStats.cafeId, cafeIds))

    const ratingsMap = new Map(ratingsResult.map(r => [r.cafeId, r]))

    // Get subscriptions for these cafes
    const subscriptionsResult = await db
        .select()
        .from(cafeSubscriptions)
        .where(inArray(cafeSubscriptions.cafeId, cafeIds))

    const subscriptionMap = new Map(subscriptionsResult.map(s => [s.cafeId, s]))

    // Get reviews without owner responses (pending reviews)
    const reviewsWithResponsesResult = await db
        .select({ reviewId: ownerReviewResponses.reviewId })
        .from(ownerReviewResponses)

    const respondedReviewIds = new Set(reviewsWithResponsesResult.map(r => r.reviewId))

    const allReviewsResult = await db
        .select({ id: reviews.id, cafeId: reviews.cafeId })
        .from(reviews)
        .where(inArray(reviews.cafeId, cafeIds))

    const pendingReviewMap = new Map<string, number>()
    for (const review of allReviewsResult) {
        if (!respondedReviewIds.has(review.id)) {
            const count = pendingReviewMap.get(review.cafeId) || 0
            pendingReviewMap.set(review.cafeId, count + 1)
        }
    }

    return cafesResult.map(cafe => {
        const sub = subscriptionMap.get(cafe.id)
        const ratings = ratingsMap.get(cafe.id)
        return {
            id: cafe.id,
            name: cafe.name,
            slug: cafe.slug,
            thumbnail: cafe.thumbnail,
            city_municipality: cafe.cityMunicipality,
            region: cafe.region,
            is_verified: cafe.isVerified ?? false,
            is_published: cafe.isPublished ?? false,
            average_rating: ratings?.averageRating ?? null,
            total_reviews: ratings?.totalReviews ?? 0,
            subscription: sub ? {
                id: sub.id,
                cafe_id: sub.cafeId,
                tier: toDisplayTier(sub.tier ?? 'free'),
                helix_subscription_id: sub.helixSubscriptionId,
                status: sub.status ?? 'active',
                current_period_start: sub.currentPeriodStart?.toISOString() ?? null,
                current_period_end: sub.currentPeriodEnd?.toISOString() ?? null,
                created_at: sub.createdAt?.toISOString() ?? null,
                updated_at: sub.updatedAt?.toISOString() ?? null,
            } : null,
            pending_reviews: pendingReviewMap.get(cafe.id) || 0,
        }
    })
}

/**
 * Get a specific cafe for owner management (includes full details)
 */
export async function getCafeForOwnerManagement(cafeId: string): Promise<CafeWithRatings | null> {
    const isOwner = await isOwnerOfCafe(cafeId)
    if (!isOwner) return null

    const cafeResult = await db
        .select()
        .from(cafes)
        .where(eq(cafes.id, cafeId))
        .limit(1)

    const cafe = cafeResult[0]
    if (!cafe) return null

    // Get rating stats
    const ratingsResult = await db
        .select()
        .from(cafeRatingStats)
        .where(eq(cafeRatingStats.cafeId, cafeId))
        .limit(1)

    const ratings = ratingsResult[0]

    // Map to CafeWithRatings (snake_case)
    return {
        id: cafe.id,
        name: cafe.name,
        slug: cafe.slug,
        description: cafe.description,
        thumbnail: cafe.thumbnail,
        gallery: cafe.gallery,
        address_display: cafe.addressDisplay,
        area: cafe.area,
        city_municipality: cafe.cityMunicipality,
        province: cafe.province,
        region: cafe.region,
        lat: cafe.lat,
        lng: cafe.lng,
        price_level: cafe.priceLevel,
        coffee_style: cafe.coffeeStyle,
        membership_tier: cafe.membershipTier,
        roaster: cafe.roaster,
        brew_methods: cafe.brewMethods,
        specialty: cafe.specialty,
        milk_options: cafe.milkOptions,
        tags: cafe.tags,
        operating_hours: cafe.operatingHours as CafeWithRatings['operating_hours'],
        socials: cafe.socials as CafeWithRatings['socials'],
        phone: cafe.phone,
        email: cafe.email,
        website_url: cafe.websiteUrl,
        payment_methods: cafe.paymentMethods,
        has_wifi: cafe.hasWifi,
        has_smoking: cafe.hasSmoking,
        has_sockets: cafe.hasSockets,

        has_aircon: cafe.hasAircon,
        has_parking: cafe.hasParking,
        has_outdoor_seating: cafe.hasOutdoorSeating,
        has_indoor_seating: cafe.hasIndoorSeating,
        has_restroom: cafe.hasRestroom,
        has_bidet: cafe.hasBidet,
        has_non_dairy: cafe.hasNonDairy,
        has_decaf: cafe.hasDecaf,
        is_pet_friendly: cafe.isPetFriendly,
        is_work_friendly: cafe.isWorkFriendly,
        serves_food: cafe.servesFood,
        is_active: cafe.isActive,
        is_published: cafe.isPublished,
        is_verified: cafe.isVerified,
        is_claimed: cafe.isClaimed,
        owner_ids: cafe.ownerIds,
        contributor_id: cafe.contributorId,
        featured_until: cafe.featuredUntil?.toISOString() ?? null,
        created_at: cafe.createdAt?.toISOString() ?? null,
        updated_at: cafe.updatedAt?.toISOString() ?? null,
        average_rating: ratings?.averageRating ?? null,
        total_reviews: ratings?.totalReviews ?? 0,
        rating_distribution: ratings?.ratingDistribution as CafeWithRatings['rating_distribution'] ?? null,
        is_hidden_gem: cafe.isHiddenGem ?? false,
        finding_hint: cafe.findingHint ?? null,
        is_chain: cafe.isChain ?? false,
        badge_stamp_url: cafe.badgeStampUrl ?? null,
    }
}

/**
 * Get subscription details for a cafe
 */
export async function getCafeSubscription(cafeId: string): Promise<CafeSubscription | null> {
    const isOwner = await isOwnerOfCafe(cafeId)
    if (!isOwner) return null

    const result = await db
        .select()
        .from(cafeSubscriptions)
        .where(eq(cafeSubscriptions.cafeId, cafeId))
        .limit(1)

    const sub = result[0]
    if (!sub) {
        // Return default free subscription if none exists
        return {
            id: '',
            cafe_id: cafeId,
            tier: 'free',
            helix_subscription_id: null,
            status: 'active',
            current_period_start: null,
            current_period_end: null,
            created_at: null,
            updated_at: null,
        }
    }

    return {
        id: sub.id,
        cafe_id: sub.cafeId,
        tier: toDisplayTier(sub.tier ?? 'free'),
        helix_subscription_id: sub.helixSubscriptionId,
        status: sub.status ?? 'active',
        current_period_start: sub.currentPeriodStart?.toISOString() ?? null,
        current_period_end: sub.currentPeriodEnd?.toISOString() ?? null,
        created_at: sub.createdAt?.toISOString() ?? null,
        updated_at: sub.updatedAt?.toISOString() ?? null,
    }
}

// ============================================
// Cafe Updates (Owner-level)
// ============================================

/**
 * Update cafe details as owner
 * All tiers can edit basic info
 */
export async function updateCafeAsOwner(
    cafeId: string,
    updates: Partial<{
        name: string
        description: string
        address_display: string
        area: string
        lat: number
        lng: number
        has_wifi: boolean
        has_smoking: boolean
        has_sockets: boolean

        has_parking: boolean
        has_aircon: boolean
        is_pet_friendly: boolean
        has_outdoor_seating: boolean
        has_indoor_seating: boolean
        has_restroom: boolean
        has_bidet: boolean
        has_non_dairy: boolean
        milk_options: string[]
        serves_food: boolean
        is_work_friendly: boolean
        price_level: 'low' | 'medium' | 'high'
        payment_methods: string
        specialty: string[]
        tags: string[]
        brew_methods: string[]
        roaster: string
        operating_hours: unknown
        website_url: string
        phone: string
        email: string
        socials: unknown
        is_hidden_gem: boolean
        finding_hint: string | null
        badge_stamp_url: string | null
    }>
): Promise<OwnerActionResult> {
    const isOwner = await isOwnerOfCafe(cafeId)
    if (!isOwner) {
        return { success: false, error: 'Not authorized to edit this cafe' }
    }

    const user = await getCurrentUser()

    // Fetch current cafe data for change detection
    const currentCafeResult = await db
        .select({
            name: cafes.name,
            description: cafes.description,
            addressDisplay: cafes.addressDisplay,
            area: cafes.area,
        })
        .from(cafes)
        .where(eq(cafes.id, cafeId))
        .limit(1)

    const currentCafe = currentCafeResult[0]

    // Map snake_case updates to camelCase for Drizzle
    const drizzleUpdates: Record<string, unknown> = {
        updatedAt: new Date(),
    }

    // Field mapping from snake_case to camelCase
    const fieldMap: Record<string, string> = {
        address_display: 'addressDisplay',
        has_wifi: 'hasWifi',
        has_smoking: 'hasSmoking',
        has_sockets: 'hasSockets',

        has_parking: 'hasParking',
        has_aircon: 'hasAircon',
        is_pet_friendly: 'isPetFriendly',
        has_outdoor_seating: 'hasOutdoorSeating',
        has_indoor_seating: 'hasIndoorSeating',
        has_restroom: 'hasRestroom',
        has_bidet: 'hasBidet',
        has_non_dairy: 'hasNonDairy',
        milk_options: 'milkOptions',
        serves_food: 'servesFood',
        is_work_friendly: 'isWorkFriendly',
        price_level: 'priceLevel',
        payment_methods: 'paymentMethods',
        brew_methods: 'brewMethods',
        operating_hours: 'operatingHours',
        website_url: 'websiteUrl',
        is_hidden_gem: 'isHiddenGem',
        finding_hint: 'findingHint',
        badge_stamp_url: 'badgeStampUrl',
    }

    for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
            const drizzleKey = fieldMap[key] || key
            drizzleUpdates[drizzleKey] = value
        }
    }

    try {
        await db.update(cafes)
            .set(drizzleUpdates)
            .where(eq(cafes.id, cafeId))
    } catch (error) {
        console.error('Error updating cafe:', error)
        return { success: false, error: 'Failed to update cafe' }
    }

    // Log contribution
    if (user) {
        const changedFields = currentCafe
            ? getChangedFields(currentCafe as Record<string, unknown>, updates as Record<string, unknown>)
            : Object.keys(updates)
        const summary = generateChangeSummary(changedFields)

        await logContribution(user.id, cafeId, 'UPDATE', {
            summary,
            source: 'owner_edit',
            cafe_name: (updates.name as string | undefined) || currentCafe?.name,
            changed_fields: changedFields
        })
    }

    return { success: true }
}

/**
 * Delete a cafe image as owner
 * Used when owners remove individual images from cafe thumbnail or gallery
 */
export async function deleteCafeImageAsOwner(
    cafeId: string,
    imageUrl: string
): Promise<OwnerActionResult> {
    const isOwner = await isOwnerOfCafe(cafeId)
    if (!isOwner) {
        return { success: false, error: 'Not authorized to manage this cafe' }
    }

    // Import and call the storage delete function
    const { deleteSingleCafeImageAction } = await import('@/utils/storage/actions')
    return deleteSingleCafeImageAction(imageUrl)
}

/**
 * Update or create cafe story as owner
 */
export async function updateCafeStory(
    cafeId: string,
    content: string
): Promise<OwnerActionResult> {
    const isOwner = await isOwnerOfCafe(cafeId)
    if (!isOwner) {
        return { success: false, error: 'Not authorized to manage this cafe' }
    }

    // Check if story exists
    const existingResult = await db
        .select({ id: cafeStories.id })
        .from(cafeStories)
        .where(eq(cafeStories.cafeId, cafeId))
        .limit(1)

    const existingStory = existingResult[0]

    try {
        if (existingStory) {
            // Update existing story
            await db.update(cafeStories)
                .set({
                    content,
                    updatedAt: new Date(),
                })
                .where(eq(cafeStories.cafeId, cafeId))
        } else {
            // Create new story
            await db.insert(cafeStories).values({
                cafeId,
                content,
            })
        }
    } catch (error) {
        console.error('[updateCafeStory] Error:', error)
        return { success: false, error: 'Failed to update story' }
    }

    return { success: true }
}

// ============================================
// Owner Verification
// ============================================

/**
 * Submit a verification request to claim a cafe
 */
export async function submitVerificationRequest(
    form: VerificationRequestForm
): Promise<OwnerActionResult> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    // Check if there's already a pending request
    const existingResult = await db
        .select({ id: ownerVerificationRequests.id })
        .from(ownerVerificationRequests)
        .where(and(
            eq(ownerVerificationRequests.cafeId, form.cafe_id),
            eq(ownerVerificationRequests.userId, userId),
            eq(ownerVerificationRequests.status, 'pending')
        ))
        .limit(1)

    if (existingResult[0]) {
        return { success: false, error: 'You already have a pending verification request for this cafe' }
    }

    try {
        await db.insert(ownerVerificationRequests).values({
            cafeId: form.cafe_id,
            userId,
            verificationType: form.verification_type,
            proofUrls: form.proof_urls,
            notes: form.notes || null,
        })
    } catch (error) {
        console.error('Error submitting verification:', error)
        return { success: false, error: 'Failed to submit verification request' }
    }

    return { success: true }
}

/**
 * Get verification request status for a cafe
 */
export async function getVerificationStatus(
    cafeId: string
): Promise<OwnerVerificationRequest | null> {
    const userId = await getCurrentUserId()
    if (!userId) return null

    const result = await db
        .select({
            id: ownerVerificationRequests.id,
            cafeId: ownerVerificationRequests.cafeId,
            userId: ownerVerificationRequests.userId,
            verificationType: ownerVerificationRequests.verificationType,
            proofUrls: ownerVerificationRequests.proofUrls,
            notes: ownerVerificationRequests.notes,
            status: ownerVerificationRequests.status,
            adminNotes: ownerVerificationRequests.adminNotes,
            reviewedBy: ownerVerificationRequests.reviewedBy,
            reviewedAt: ownerVerificationRequests.reviewedAt,
            createdAt: ownerVerificationRequests.createdAt,
            cafeName: cafes.name,
            cafeSlug: cafes.slug,
            cafeThumbnail: cafes.thumbnail,
        })
        .from(ownerVerificationRequests)
        .leftJoin(cafes, eq(ownerVerificationRequests.cafeId, cafes.id))
        .where(and(
            eq(ownerVerificationRequests.cafeId, cafeId),
            eq(ownerVerificationRequests.userId, userId)
        ))
        .orderBy(desc(ownerVerificationRequests.createdAt))
        .limit(1)

    const row = result[0]
    if (!row) return null

    return {
        id: row.id,
        cafe_id: row.cafeId,
        user_id: row.userId,
        verification_type: row.verificationType,
        proof_urls: row.proofUrls,
        notes: row.notes,
        status: row.status as 'pending' | 'approved' | 'rejected',
        admin_notes: row.adminNotes,
        reviewed_by: row.reviewedBy,
        reviewed_at: row.reviewedAt?.toISOString() ?? null,
        created_at: row.createdAt?.toISOString() ?? null,
        cafe: row.cafeName ? {
            id: row.cafeId,
            name: row.cafeName,
            slug: row.cafeSlug!,
            thumbnail: row.cafeThumbnail,
        } : undefined,
    } as OwnerVerificationRequest
}

// ============================================
// Review Responses
// ============================================

/**
 * Get reviews for a cafe with owner response status and pin status
 */
export async function getCafeReviewsForOwner(cafeId: string): Promise<{
    id: string
    rating: number
    comment: string
    created_at: string | null
    is_pinned_by_owner: boolean
    pinned_at: string | null
    author: {
        id: string
        username: string
        display_name: string
        avatar_url: string | null
    }
    owner_response: OwnerReviewResponse | null
}[]> {
    const isOwner = await isOwnerOfCafe(cafeId)
    if (!isOwner) return []

    const reviewsResult = await db
        .select({
            id: reviews.id,
            rating: reviews.rating,
            comment: reviews.comment,
            createdAt: reviews.createdAt,
            isPinnedByOwner: reviews.isPinnedByOwner,
            pinnedAt: reviews.pinnedAt,
            authorId: profiles.id,
            authorUsername: profiles.username,
            authorDisplayName: profiles.displayName,
            authorAvatarUrl: profiles.avatarUrl,
        })
        .from(reviews)
        .leftJoin(profiles, eq(reviews.userId, profiles.id))
        .where(and(
            eq(reviews.cafeId, cafeId),
            eq(reviews.status, 'published')
        ))
        .orderBy(desc(reviews.isPinnedByOwner), desc(reviews.createdAt))

    if (!reviewsResult.length) return []

    // Get owner responses for these reviews
    const reviewIds = reviewsResult.map(r => r.id)
    const responsesResult = await db
        .select()
        .from(ownerReviewResponses)
        .where(inArray(ownerReviewResponses.reviewId, reviewIds))

    const responseMap = new Map(responsesResult.map(r => [r.reviewId, r]))

    return reviewsResult.map(review => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        created_at: review.createdAt?.toISOString() ?? null,
        is_pinned_by_owner: review.isPinnedByOwner ?? false,
        pinned_at: review.pinnedAt?.toISOString() ?? null,
        author: {
            id: review.authorId!,
            username: review.authorUsername!,
            display_name: review.authorDisplayName!,
            avatar_url: review.authorAvatarUrl,
        },
        owner_response: responseMap.get(review.id) ? {
            id: responseMap.get(review.id)!.id,
            review_id: responseMap.get(review.id)!.reviewId,
            owner_id: responseMap.get(review.id)!.ownerId,
            response: responseMap.get(review.id)!.response,
            created_at: responseMap.get(review.id)!.createdAt?.toISOString() ?? null,
            updated_at: responseMap.get(review.id)!.updatedAt?.toISOString() ?? null,
        } as OwnerReviewResponse : null,
    }))
}

/**
 * Respond to a review as cafe owner
 */
export async function respondToReview(
    form: ReviewResponseForm
): Promise<OwnerActionResult> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    // Verify user owns the cafe this review belongs to
    const reviewResult = await db
        .select({ cafeId: reviews.cafeId })
        .from(reviews)
        .where(eq(reviews.id, form.review_id))
        .limit(1)

    const review = reviewResult[0]
    if (!review) {
        return { success: false, error: 'Review not found' }
    }

    const isOwner = await isOwnerOfCafe(review.cafeId)
    if (!isOwner) {
        return { success: false, error: 'Not authorized to respond to this review' }
    }

    // Check if response already exists
    const existingResult = await db
        .select({ id: ownerReviewResponses.id })
        .from(ownerReviewResponses)
        .where(eq(ownerReviewResponses.reviewId, form.review_id))
        .limit(1)

    try {
        if (existingResult[0]) {
            // Update existing response
            await db.update(ownerReviewResponses)
                .set({
                    response: form.response,
                    updatedAt: new Date(),
                })
                .where(eq(ownerReviewResponses.id, existingResult[0].id))
        } else {
            // Create new response
            await db.insert(ownerReviewResponses).values({
                reviewId: form.review_id,
                ownerId: userId,
                response: form.response,
            })
        }
    } catch (error) {
        console.error('Error with response:', error)
        return { success: false, error: 'Failed to submit response' }
    }

    return { success: true }
}

/**
 * Delete an owner response
 */
export async function deleteReviewResponse(
    responseId: string
): Promise<OwnerActionResult> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    try {
        await db.delete(ownerReviewResponses)
            .where(and(
                eq(ownerReviewResponses.id, responseId),
                eq(ownerReviewResponses.ownerId, userId)
            ))
    } catch (error) {
        console.error('Error deleting response:', error)
        return { success: false, error: 'Failed to delete response' }
    }

    return { success: true }
}

// ============================================
// Review Pinning (Premium Feature)
// ============================================

/**
 * Pin a review (Premium only, max 3 pinned)
 */
export async function pinReview(
    reviewId: string,
    cafeId: string
): Promise<OwnerActionResult> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    // Check ownership
    const isOwner = await isOwnerOfCafe(cafeId)
    if (!isOwner) {
        return { success: false, error: 'Not authorized' }
    }

    // Check tier - review pinning is Premium only
    const subResult = await db
        .select({ tier: cafeSubscriptions.tier })
        .from(cafeSubscriptions)
        .where(eq(cafeSubscriptions.cafeId, cafeId))
        .limit(1)

    const tier = subResult[0]?.tier || 'free'
    if (tier !== 'premium') {
        return { success: false, error: 'Review pinning is a Premium feature' }
    }

    // Check count of currently pinned reviews (max 3)
    const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(reviews)
        .where(and(
            eq(reviews.cafeId, cafeId),
            eq(reviews.isPinnedByOwner, true)
        ))

    const pinnedCount = countResult[0]?.count || 0
    if (pinnedCount >= 3) {
        return { success: false, error: 'Maximum 3 reviews can be pinned' }
    }

    // Pin the review
    try {
        await db.update(reviews)
            .set({
                isPinnedByOwner: true,
                pinnedAt: new Date(),
            })
            .where(and(
                eq(reviews.id, reviewId),
                eq(reviews.cafeId, cafeId)
            ))
    } catch (error) {
        console.error('Error pinning review:', error)
        return { success: false, error: 'Failed to pin review' }
    }

    return { success: true }
}

/**
 * Unpin a review
 */
export async function unpinReview(
    reviewId: string,
    cafeId: string
): Promise<OwnerActionResult> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    // Check ownership
    const isOwner = await isOwnerOfCafe(cafeId)
    if (!isOwner) {
        return { success: false, error: 'Not authorized' }
    }

    // Unpin the review
    try {
        await db.update(reviews)
            .set({
                isPinnedByOwner: false,
                pinnedAt: null,
            })
            .where(and(
                eq(reviews.id, reviewId),
                eq(reviews.cafeId, cafeId)
            ))
    } catch (error) {
        console.error('Error unpinning review:', error)
        return { success: false, error: 'Failed to unpin review' }
    }

    return { success: true }
}

// ============================================
// Menu Management (Pro/Premium Feature)
// ============================================

/**
 * Get menu items for a cafe
 */
export async function getCafeMenuItems(cafeId: string): Promise<CafeMenuItem[]> {
    const result = await db
        .select()
        .from(cafeMenuItems)
        .where(eq(cafeMenuItems.cafeId, cafeId))
        .orderBy(cafeMenuItems.category, cafeMenuItems.sortOrder)

    return result.map(item => ({
        id: item.id,
        cafe_id: item.cafeId,
        name: item.name,
        description: item.description,
        category: item.category,
        price: item.price,
        image_url: item.imageUrl,
        is_available: item.isAvailable ?? true,
        is_signature: item.isSignature ?? false,
        sort_order: item.sortOrder ?? 0,
        created_at: item.createdAt?.toISOString() ?? null,
        updated_at: item.updatedAt?.toISOString() ?? null,
    }))
}

/**
 * Add a menu item (respects tier limits for owners, bypasses for admins)
 */
export async function addMenuItem(
    cafeId: string,
    item: MenuItemForm
): Promise<MenuItemResult> {
    const user = await getCurrentUser()
    if (!user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Check if admin
    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, user.id))
        .limit(1)

    const isAdmin = profileResult[0]?.role && ['admin', 'moderator'].includes(profileResult[0].role)

    // If not admin, check if owner
    if (!isAdmin) {
        const isOwner = await isOwnerOfCafe(cafeId)
        if (!isOwner) {
            return { success: false, error: 'Not authorized to manage this cafe\'s menu' }
        }
    }

    // Only check tier limits for non-admins
    if (!isAdmin) {
        const subscription = await getCafeSubscription(cafeId)
        const tier = subscription?.tier || 'free'
        const tierConfig = SUBSCRIPTION_TIERS[tier]

        // Count current items
        const countResult = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(cafeMenuItems)
            .where(eq(cafeMenuItems.cafeId, cafeId))

        const currentCount = countResult[0]?.count || 0

        if (tierConfig.menuLimit !== Infinity && currentCount >= tierConfig.menuLimit) {
            return {
                success: false,
                error: `You've reached the ${tierConfig.menuLimit} item limit. Upgrade to add more items.`,
                remaining_slots: 0,
            }
        }
    }

    // Get current count for sort_order
    const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(cafeMenuItems)
        .where(eq(cafeMenuItems.cafeId, cafeId))

    const sortOrder = countResult[0]?.count || 0

    try {
        const [newItem] = await db.insert(cafeMenuItems).values({
            cafeId,
            category: item.category,
            name: item.name,
            description: item.description || null,
            price: item.price,
            imageUrl: item.image_url || null,
            isSignature: item.is_signature || false,
            isAvailable: item.is_available ?? true,
            sortOrder,
        }).returning()

        return {
            success: true,
            item: {
                id: newItem.id,
                cafe_id: newItem.cafeId,
                name: newItem.name,
                description: newItem.description,
                category: newItem.category,
                price: newItem.price,
                image_url: newItem.imageUrl,
                is_available: newItem.isAvailable ?? true,
                is_signature: newItem.isSignature ?? false,
                sort_order: newItem.sortOrder ?? 0,
                created_at: newItem.createdAt?.toISOString() ?? null,
                updated_at: newItem.updatedAt?.toISOString() ?? null,
            },
            remaining_slots: Infinity,
        }
    } catch (error) {
        console.error('Error adding menu item:', error)
        return { success: false, error: 'Failed to add menu item' }
    }
}

/**
 * Update a menu item
 */
export async function updateMenuItem(
    itemId: string,
    updates: Partial<MenuItemForm>
): Promise<OwnerActionResult> {
    const user = await getCurrentUser()
    if (!user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Check if admin
    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, user.id))
        .limit(1)

    const isAdmin = profileResult[0]?.role && ['admin', 'moderator'].includes(profileResult[0].role)

    // Get the item to verify ownership
    const itemResult = await db
        .select({ cafeId: cafeMenuItems.cafeId })
        .from(cafeMenuItems)
        .where(eq(cafeMenuItems.id, itemId))
        .limit(1)

    const item = itemResult[0]
    if (!item) {
        return { success: false, error: 'Menu item not found' }
    }

    // If not admin, check if owner
    if (!isAdmin) {
        const isOwner = await isOwnerOfCafe(item.cafeId)
        if (!isOwner) {
            return { success: false, error: 'Not authorized to edit this menu item' }
        }
    }

    // Map snake_case to camelCase
    const drizzleUpdates: Record<string, unknown> = { updatedAt: new Date() }
    if (updates.name !== undefined) drizzleUpdates.name = updates.name
    if (updates.description !== undefined) drizzleUpdates.description = updates.description
    if (updates.category !== undefined) drizzleUpdates.category = updates.category
    if (updates.price !== undefined) drizzleUpdates.price = updates.price
    if (updates.image_url !== undefined) drizzleUpdates.imageUrl = updates.image_url
    if (updates.is_signature !== undefined) drizzleUpdates.isSignature = updates.is_signature
    if (updates.is_available !== undefined) drizzleUpdates.isAvailable = updates.is_available

    try {
        await db.update(cafeMenuItems)
            .set(drizzleUpdates)
            .where(eq(cafeMenuItems.id, itemId))
    } catch (error) {
        console.error('Error updating menu item:', error)
        return { success: false, error: 'Failed to update menu item' }
    }

    return { success: true }
}

/**
 * Delete a menu item
 */
export async function deleteMenuItem(itemId: string): Promise<OwnerActionResult> {
    const user = await getCurrentUser()
    if (!user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Check if admin
    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, user.id))
        .limit(1)

    const isAdmin = profileResult[0]?.role && ['admin', 'moderator'].includes(profileResult[0].role)

    // Get the item to verify ownership
    const itemResult = await db
        .select({ cafeId: cafeMenuItems.cafeId })
        .from(cafeMenuItems)
        .where(eq(cafeMenuItems.id, itemId))
        .limit(1)

    const item = itemResult[0]
    if (!item) {
        return { success: false, error: 'Menu item not found' }
    }

    // If not admin, check if owner
    if (!isAdmin) {
        const isOwner = await isOwnerOfCafe(item.cafeId)
        if (!isOwner) {
            return { success: false, error: 'Not authorized to delete this menu item' }
        }
    }

    try {
        await db.delete(cafeMenuItems)
            .where(eq(cafeMenuItems.id, itemId))
    } catch (error) {
        console.error('Error deleting menu item:', error)
        return { success: false, error: 'Failed to delete menu item' }
    }

    return { success: true }
}

// ============================================
// Public Functions (for display)
// ============================================

/**
 * Get owner response for a review (public, for display on cafe page)
 */
export async function getOwnerResponseForReview(
    reviewId: string
): Promise<OwnerReviewResponse | null> {
    const result = await db
        .select({
            id: ownerReviewResponses.id,
            reviewId: ownerReviewResponses.reviewId,
            ownerId: ownerReviewResponses.ownerId,
            response: ownerReviewResponses.response,
            createdAt: ownerReviewResponses.createdAt,
            updatedAt: ownerReviewResponses.updatedAt,
            ownerUsername: profiles.username,
            ownerDisplayName: profiles.displayName,
            ownerAvatarUrl: profiles.avatarUrl,
        })
        .from(ownerReviewResponses)
        .leftJoin(profiles, eq(ownerReviewResponses.ownerId, profiles.id))
        .where(eq(ownerReviewResponses.reviewId, reviewId))
        .limit(1)

    const row = result[0]
    if (!row) return null

    return {
        id: row.id,
        review_id: row.reviewId,
        owner_id: row.ownerId,
        response: row.response,
        created_at: row.createdAt?.toISOString() ?? null,
        updated_at: row.updatedAt?.toISOString() ?? null,
        owner: row.ownerDisplayName ? {
            id: row.ownerId,
            username: row.ownerUsername!,
            display_name: row.ownerDisplayName,
            avatar_url: row.ownerAvatarUrl,
        } : undefined,
    } as OwnerReviewResponse
}

/**
 * Get all owner responses for a cafe's reviews (for bulk display)
 */
export async function getOwnerResponsesForCafe(
    cafeId: string
): Promise<Map<string, OwnerReviewResponse>> {
    const reviewsResult = await db
        .select({ id: reviews.id })
        .from(reviews)
        .where(eq(reviews.cafeId, cafeId))

    if (!reviewsResult.length) return new Map()

    const reviewIds = reviewsResult.map(r => r.id)

    const responsesResult = await db
        .select({
            id: ownerReviewResponses.id,
            reviewId: ownerReviewResponses.reviewId,
            ownerId: ownerReviewResponses.ownerId,
            response: ownerReviewResponses.response,
            createdAt: ownerReviewResponses.createdAt,
            updatedAt: ownerReviewResponses.updatedAt,
            ownerUsername: profiles.username,
            ownerDisplayName: profiles.displayName,
            ownerAvatarUrl: profiles.avatarUrl,
        })
        .from(ownerReviewResponses)
        .leftJoin(profiles, eq(ownerReviewResponses.ownerId, profiles.id))
        .where(inArray(ownerReviewResponses.reviewId, reviewIds))

    return new Map(
        responsesResult.map(r => [r.reviewId, {
            id: r.id,
            review_id: r.reviewId,
            owner_id: r.ownerId,
            response: r.response,
            created_at: r.createdAt?.toISOString() ?? null,
            updated_at: r.updatedAt?.toISOString() ?? null,
            owner: r.ownerDisplayName ? {
                id: r.ownerId,
                username: r.ownerUsername!,
                display_name: r.ownerDisplayName,
                avatar_url: r.ownerAvatarUrl,
            } : undefined,
        } as OwnerReviewResponse])
    )
}

// ============================================
// Featured Slot Requests (Premium Feature)
// ============================================

export interface FeaturedSlotRequest {
    id: string
    cafe_id: string
    owner_id: string
    requested_month: string
    status: 'pending' | 'approved' | 'rejected'
    admin_notes: string | null
    created_at: string
    processed_at: string | null
}

/**
 * Request a featured slot for a specific month (Premium only, 1 per month)
 */
export async function requestFeaturedSlot(
    cafeId: string,
    requestedMonth: string // Format: YYYY-MM-01
): Promise<OwnerActionResult> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    // Check ownership
    const isOwner = await isOwnerOfCafe(cafeId)
    if (!isOwner) {
        return { success: false, error: 'Not authorized' }
    }

    // Check tier - featured slot requests are Premium only
    const subResult = await db
        .select({ tier: cafeSubscriptions.tier })
        .from(cafeSubscriptions)
        .where(eq(cafeSubscriptions.cafeId, cafeId))
        .limit(1)

    const tier = subResult[0]?.tier || 'free'
    if (tier !== 'premium') {
        return { success: false, error: 'Featured slot requests are a Premium feature' }
    }

    // Check if cafe is a chain - chains cannot be featured
    const cafeResult = await db
        .select({ isChain: cafes.isChain })
        .from(cafes)
        .where(eq(cafes.id, cafeId))
        .limit(1)

    if (cafeResult[0]?.isChain === true) {
        return { success: false, error: 'Chain cafes cannot be featured. Please contact support if you believe this is an error.' }
    }

    // Check if already requested for this month
    const existingResult = await db
        .select({ id: featuredSlotRequests.id, status: featuredSlotRequests.status })
        .from(featuredSlotRequests)
        .where(and(
            eq(featuredSlotRequests.cafeId, cafeId),
            eq(featuredSlotRequests.requestedMonth, requestedMonth)
        ))
        .limit(1)

    if (existingResult[0]) {
        return {
            success: false,
            error: `You already have a ${existingResult[0].status} request for this month`
        }
    }

    // Submit the request
    try {
        await db.insert(featuredSlotRequests).values({
            cafeId,
            ownerId: userId,
            requestedMonth,
            status: 'pending',
        })
    } catch (error) {
        console.error('Error submitting featured slot request:', error)
        return { success: false, error: 'Failed to submit request' }
    }

    return { success: true }
}

/**
 * Get featured slot requests for a cafe
 */
export async function getFeaturedSlotRequests(
    cafeId: string
): Promise<FeaturedSlotRequest[]> {
    const isOwner = await isOwnerOfCafe(cafeId)
    if (!isOwner) return []

    const result = await db
        .select()
        .from(featuredSlotRequests)
        .where(eq(featuredSlotRequests.cafeId, cafeId))
        .orderBy(desc(featuredSlotRequests.requestedMonth))

    return result.map(r => ({
        id: r.id,
        cafe_id: r.cafeId!,
        owner_id: r.ownerId!,
        requested_month: r.requestedMonth,
        status: r.status as 'pending' | 'approved' | 'rejected',
        admin_notes: r.adminNotes,
        created_at: r.createdAt?.toISOString() ?? '',
        processed_at: r.processedAt?.toISOString() ?? null,
    }))
}

// ============================================
// Badge Stamp Management
// ============================================

/**
 * Set the badge stamp URL for a cafe (owner only)
 */
export async function setCafeBadgeStamp(
    cafeId: string,
    imageUrl: string
): Promise<OwnerActionResult> {
    const isOwner = await isOwnerOfCafe(cafeId)
    if (!isOwner) {
        return { success: false, error: 'Not authorized to manage this cafe' }
    }

    try {
        await db.update(cafes)
            .set({
                badgeStampUrl: imageUrl,
                updatedAt: new Date(),
            })
            .where(eq(cafes.id, cafeId))

        // Revalidate the cafe profile and public pages
        revalidatePath(`/cafe/[slug]`, 'page')
        revalidatePath(`/owner/cafe/${cafeId}`, 'page')
        revalidatePath('/owner', 'page')
    } catch (error) {
        console.error('Error setting badge stamp:', error)
        return { success: false, error: 'Failed to set badge stamp' }
    }

    return { success: true }
}

/**
 * Remove the badge stamp URL from a cafe (owner only)
 */
export async function removeCafeBadgeStamp(
    cafeId: string
): Promise<OwnerActionResult> {
    const isOwner = await isOwnerOfCafe(cafeId)
    if (!isOwner) {
        return { success: false, error: 'Not authorized to manage this cafe' }
    }

    try {
        await db.update(cafes)
            .set({
                badgeStampUrl: null,
                updatedAt: new Date(),
            })
            .where(eq(cafes.id, cafeId))

        // Revalidate the cafe profile and public pages
        revalidatePath(`/cafe/[slug]`, 'page')
        revalidatePath(`/owner/cafe/${cafeId}`, 'page')
        revalidatePath('/owner', 'page')
    } catch (error) {
        console.error('Error removing badge stamp:', error)
        return { success: false, error: 'Failed to remove badge stamp' }
    }

    return { success: true }
}
