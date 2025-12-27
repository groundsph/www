'use server'

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
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

// ============================================
// Permission Checks
// ============================================

/**
 * Check if the current user is an owner of the specified cafe
 */
export async function isOwnerOfCafe(cafeId: string): Promise<boolean> {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()

    if (!user) return false

    const { data: cafe } = await db
        .from('cafes')
        .select('owner_ids')
        .eq('id', cafeId)
        .single()

    if (!cafe || !cafe.owner_ids) return false

    return cafe.owner_ids.includes(user.id)
}

/**
 * Check if user is owner of cafe OR an admin/moderator
 */


/**
 * Get the current user ID if authenticated
 */
async function getCurrentUserId(): Promise<string | null> {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    return user?.id || null
}

// ============================================
// Owner Dashboard Data
// ============================================

/**
 * Get all cafes owned by the current user with subscription info
 */
export async function getOwnedCafes(): Promise<OwnedCafe[]> {
    const db = await createClient()
    const userId = await getCurrentUserId()

    if (!userId) return []

    // Get cafes where user is in owner_ids
    const { data: cafes, error } = await db
        .from('cafe_with_ratings')
        .select('*')
        .contains('owner_ids', [userId])

    if (error || !cafes) {
        console.error('Error fetching owned cafes:', error)
        return []
    }

    // Get subscriptions for these cafes
    const cafeIds = cafes.map(c => c.id).filter(Boolean) as string[]

    const { data: subscriptions } = await db
        .from('cafe_subscriptions')
        .select('*')
        .in('cafe_id', cafeIds)

    const subscriptionMap = new Map(
        (subscriptions || []).map(s => [s.cafe_id, s])
    )

    // Get pending review counts (reviews without owner responses)
    const { data: reviewCounts } = await db
        .from('reviews')
        .select('cafe_id')
        .in('cafe_id', cafeIds)
        .not('id', 'in',
            db.from('owner_review_responses').select('review_id')
        )

    const pendingReviewMap = new Map<string, number>()
    for (const review of reviewCounts || []) {
        const count = pendingReviewMap.get(review.cafe_id) || 0
        pendingReviewMap.set(review.cafe_id, count + 1)
    }

    return cafes.map(cafe => {
        const sub = subscriptionMap.get(cafe.id!)
        return {
            id: cafe.id!,
            name: cafe.name!,
            slug: cafe.slug!,
            thumbnail: cafe.thumbnail!,
            city_municipality: cafe.city_municipality!,
            region: cafe.region!,
            is_verified: cafe.is_verified,
            is_published: cafe.is_published,
            average_rating: cafe.average_rating,
            total_reviews: cafe.total_reviews,
            subscription: sub ? {
                id: sub.id,
                cafe_id: sub.cafe_id,
                tier: toDisplayTier(sub.tier),
                helix_subscription_id: sub.helix_subscription_id,
                status: sub.status,
                current_period_start: sub.current_period_start,
                current_period_end: sub.current_period_end,
                created_at: sub.created_at,
                updated_at: sub.updated_at,
            } : null,
            pending_reviews: pendingReviewMap.get(cafe.id!) || 0,
        }
    })
}

/**
 * Get a specific cafe for owner management (includes full details)
 */
export async function getCafeForOwnerManagement(cafeId: string): Promise<CafeWithRatings | null> {
    const isOwner = await isOwnerOfCafe(cafeId)
    if (!isOwner) return null

    const db = await createClient()

    const { data: cafe, error } = await db
        .from('cafe_with_ratings')
        .select('*')
        .eq('id', cafeId)
        .single()

    if (error || !cafe) {
        console.error('Error fetching cafe:', error)
        return null
    }

    // Cast to CafeWithRatings (the view includes rating data)
    return cafe as unknown as CafeWithRatings
}

/**
 * Get subscription details for a cafe
 */
export async function getCafeSubscription(cafeId: string): Promise<CafeSubscription | null> {
    const isOwner = await isOwnerOfCafe(cafeId)
    if (!isOwner) return null

    const db = await createClient()

    const { data: sub, error } = await db
        .from('cafe_subscriptions')
        .select('*')
        .eq('cafe_id', cafeId)
        .single()

    if (error || !sub) {
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
        cafe_id: sub.cafe_id,
        tier: toDisplayTier(sub.tier),
        helix_subscription_id: sub.helix_subscription_id,
        status: sub.status,
        current_period_start: sub.current_period_start,
        current_period_end: sub.current_period_end,
        created_at: sub.created_at,
        updated_at: sub.updated_at,
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
    }>
): Promise<OwnerActionResult> {
    const isOwner = await isOwnerOfCafe(cafeId)
    if (!isOwner) {
        return { success: false, error: 'Not authorized to edit this cafe' }
    }

    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()

    // Fetch current cafe data for change detection
    const { data: currentCafe } = await db
        .from('cafes')
        .select('name, description, address_display, area, lat, lng, has_wifi, has_sockets, has_parking, has_aircon, is_pet_friendly, has_outdoor_seating, serves_food, is_work_friendly, price_level, payment_methods, specialty, tags, brew_methods, roaster, operating_hours, website_url, phone, email, socials')
        .eq('id', cafeId)
        .single()

    const { error } = await db
        .from('cafes')
        .update({
            ...updates as Record<string, unknown>,
            updated_at: new Date().toISOString(),
        })
        .eq('id', cafeId)

    if (error) {
        console.error('Error updating cafe:', error)
        return { success: false, error: 'Failed to update cafe' }
    }

    // Log contribution
    if (user) {
        const adminDb = await createAdminClient()
        const changedFields = currentCafe ? getChangedFields(currentCafe as Record<string, unknown>, updates as Record<string, unknown>) : Object.keys(updates)
        const summary = generateChangeSummary(changedFields)

        await logContribution(adminDb, user.id, cafeId, 'UPDATE', {
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
    const { deleteSingleCafeImage } = await import('@/utils/supabase/storage')
    return deleteSingleCafeImage(imageUrl)
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

    const db = await createClient()

    // Check if story exists
    const { data: existingStory } = await db
        .from('cafe_stories')
        .select('id')
        .eq('cafe_id', cafeId)
        .single()

    if (existingStory) {
        // Update existing story
        const { error } = await db
            .from('cafe_stories')
            .update({
                content,
                updated_at: new Date().toISOString(),
            })
            .eq('cafe_id', cafeId)

        if (error) {
            console.error('[updateCafeStory] Update error:', error)
            return { success: false, error: 'Failed to update story' }
        }
    } else {
        // Create new story
        const { error } = await db
            .from('cafe_stories')
            .insert({
                cafe_id: cafeId,
                content,
            })

        if (error) {
            console.error('[updateCafeStory] Insert error:', error)
            return { success: false, error: 'Failed to create story' }
        }
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
    const db = await createClient()
    const userId = await getCurrentUserId()

    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    // Check if there's already a pending request
    const { data: existing } = await db
        .from('owner_verification_requests')
        .select('id')
        .eq('cafe_id', form.cafe_id)
        .eq('user_id', userId)
        .eq('status', 'pending')
        .single()

    if (existing) {
        return { success: false, error: 'You already have a pending verification request for this cafe' }
    }

    const { error } = await db
        .from('owner_verification_requests')
        .insert({
            cafe_id: form.cafe_id,
            user_id: userId,
            verification_type: form.verification_type,
            proof_urls: form.proof_urls,
            notes: form.notes || null,
        })

    if (error) {
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
    const db = await createClient()
    const userId = await getCurrentUserId()

    if (!userId) return null

    const { data, error } = await db
        .from('owner_verification_requests')
        .select(`
            *,
            cafe:cafes(id, name, slug, thumbnail)
        `)
        .eq('cafe_id', cafeId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (error || !data) return null

    return data as unknown as OwnerVerificationRequest
}

// ============================================
// Review Responses
// ============================================

/**
 * Get reviews for a cafe with owner response status
 */
export async function getCafeReviewsForOwner(cafeId: string): Promise<{
    id: string
    rating: number
    comment: string
    created_at: string | null
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

    const db = await createClient()

    const { data: reviews, error } = await db
        .from('reviews')
        .select(`
            id,
            rating,
            comment,
            created_at,
            user:profiles!reviews_user_id_fkey(id, username, display_name, avatar_url)
        `)
        .eq('cafe_id', cafeId)
        .eq('status', 'published')
        .order('created_at', { ascending: false })

    if (error || !reviews) {
        console.error('Error fetching reviews:', error)
        return []
    }

    // Get owner responses for these reviews
    const reviewIds = reviews.map(r => r.id)
    const { data: responses } = await db
        .from('owner_review_responses')
        .select('*')
        .in('review_id', reviewIds)

    const responseMap = new Map(
        (responses || []).map(r => [r.review_id, r])
    )

    return reviews.map(review => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        created_at: review.created_at,
        author: review.user as {
            id: string
            username: string
            display_name: string
            avatar_url: string | null
        },
        owner_response: responseMap.get(review.id) as OwnerReviewResponse | null,
    }))
}

/**
 * Respond to a review as cafe owner
 */
export async function respondToReview(
    form: ReviewResponseForm
): Promise<OwnerActionResult> {
    const db = await createClient()
    const userId = await getCurrentUserId()

    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    // Verify user owns the cafe this review belongs to
    const { data: review } = await db
        .from('reviews')
        .select('cafe_id')
        .eq('id', form.review_id)
        .single()

    if (!review) {
        return { success: false, error: 'Review not found' }
    }

    const isOwner = await isOwnerOfCafe(review.cafe_id)
    if (!isOwner) {
        return { success: false, error: 'Not authorized to respond to this review' }
    }

    // Check if response already exists
    const { data: existing } = await db
        .from('owner_review_responses')
        .select('id')
        .eq('review_id', form.review_id)
        .single()

    if (existing) {
        // Update existing response
        const { error } = await db
            .from('owner_review_responses')
            .update({
                response: form.response,
            })
            .eq('id', existing.id)

        if (error) {
            console.error('Error updating response:', error)
            return { success: false, error: 'Failed to update response' }
        }
    } else {
        // Create new response
        const { error } = await db
            .from('owner_review_responses')
            .insert({
                review_id: form.review_id,
                owner_id: userId,
                response: form.response,
            })

        if (error) {
            console.error('Error creating response:', error)
            return { success: false, error: 'Failed to submit response' }
        }
    }

    return { success: true }
}

/**
 * Delete an owner response
 */
export async function deleteReviewResponse(
    responseId: string
): Promise<OwnerActionResult> {
    const db = await createClient()
    const userId = await getCurrentUserId()

    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    const { error } = await db
        .from('owner_review_responses')
        .delete()
        .eq('id', responseId)
        .eq('owner_id', userId)

    if (error) {
        console.error('Error deleting response:', error)
        return { success: false, error: 'Failed to delete response' }
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
    const db = await createClient()

    const { data, error } = await db
        .from('cafe_menu_items')
        .select('*')
        .eq('cafe_id', cafeId)
        .order('category', { ascending: true })
        .order('sort_order', { ascending: true })

    if (error) {
        console.error('Error fetching menu items:', error)
        return []
    }

    return data as CafeMenuItem[]
}

/**
 * Add a menu item (respects tier limits for owners, bypasses for admins)
 */
export async function addMenuItem(
    cafeId: string,
    item: MenuItemForm
): Promise<MenuItemResult> {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()

    if (!user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Check if admin
    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    const isAdmin = profile?.role && ['admin', 'moderator'].includes(profile.role)

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

        if (tierConfig.menuLimit === 0) {
            return {
                success: false,
                error: 'Upgrade to Pro to add menu items',
                remaining_slots: 0,
            }
        }

        // Count current items
        const { count } = await db
            .from('cafe_menu_items')
            .select('*', { count: 'exact', head: true })
            .eq('cafe_id', cafeId)

        const currentCount = count || 0

        if (tierConfig.menuLimit !== Infinity && currentCount >= tierConfig.menuLimit) {
            return {
                success: false,
                error: `You've reached the ${tierConfig.menuLimit} item limit. Upgrade to Premium for unlimited items.`,
                remaining_slots: 0,
            }
        }
    }

    // Get current count for sort_order (needed for all cases)
    const { count: currentItemCount } = await db
        .from('cafe_menu_items')
        .select('*', { count: 'exact', head: true })
        .eq('cafe_id', cafeId)

    const sortOrder = currentItemCount || 0

    // Use admin client if admin, otherwise regular client (for RLS bypass)
    const insertDb = isAdmin ? await createAdminClient() : db

    const { data, error } = await insertDb
        .from('cafe_menu_items')
        .insert({
            cafe_id: cafeId,
            category: item.category,
            name: item.name,
            description: item.description || null,
            price: item.price,
            image_url: item.image_url || null,
            is_signature: item.is_signature || false,
            is_available: item.is_available ?? true,
            sort_order: sortOrder,
        })
        .select()
        .single()

    if (error) {
        console.error('Error adding menu item:', error)
        return { success: false, error: 'Failed to add menu item' }
    }

    return {
        success: true,
        item: data as CafeMenuItem,
        remaining_slots: Infinity,
    }
}

/**
 * Update a menu item
 */
export async function updateMenuItem(
    itemId: string,
    updates: Partial<MenuItemForm>
): Promise<OwnerActionResult> {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()

    if (!user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Check if admin
    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    const isAdmin = profile?.role && ['admin', 'moderator'].includes(profile.role)

    // Get the item to verify ownership
    const { data: item } = await db
        .from('cafe_menu_items')
        .select('cafe_id')
        .eq('id', itemId)
        .single()

    if (!item) {
        return { success: false, error: 'Menu item not found' }
    }

    // If not admin, check if owner
    if (!isAdmin) {
        const isOwner = await isOwnerOfCafe(item.cafe_id)
        if (!isOwner) {
            return { success: false, error: 'Not authorized to edit this menu item' }
        }
    }

    // Use admin client for admin, regular for owners
    const updateDb = isAdmin ? await createAdminClient() : db

    const { error } = await updateDb
        .from('cafe_menu_items')
        .update(updates)
        .eq('id', itemId)

    if (error) {
        console.error('Error updating menu item:', error)
        return { success: false, error: 'Failed to update menu item' }
    }

    return { success: true }
}

/**
 * Delete a menu item
 */
export async function deleteMenuItem(itemId: string): Promise<OwnerActionResult> {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()

    if (!user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Check if admin
    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    const isAdmin = profile?.role && ['admin', 'moderator'].includes(profile.role)

    // Get the item to verify ownership
    const { data: item } = await db
        .from('cafe_menu_items')
        .select('cafe_id')
        .eq('id', itemId)
        .single()

    if (!item) {
        return { success: false, error: 'Menu item not found' }
    }

    // If not admin, check if owner
    if (!isAdmin) {
        const isOwner = await isOwnerOfCafe(item.cafe_id)
        if (!isOwner) {
            return { success: false, error: 'Not authorized to delete this menu item' }
        }
    }

    // Use admin client for admin, regular for owners
    const deleteDb = isAdmin ? await createAdminClient() : db

    const { error } = await deleteDb
        .from('cafe_menu_items')
        .delete()
        .eq('id', itemId)

    if (error) {
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
    const db = await createClient()

    const { data, error } = await db
        .from('owner_review_responses')
        .select(`
            *,
            owner:profiles!owner_review_responses_owner_id_fkey(
                id, username, display_name, avatar_url
            )
        `)
        .eq('review_id', reviewId)
        .single()

    if (error || !data) return null

    return data as unknown as OwnerReviewResponse
}

/**
 * Get all owner responses for a cafe's reviews (for bulk display)
 */
export async function getOwnerResponsesForCafe(
    cafeId: string
): Promise<Map<string, OwnerReviewResponse>> {
    const db = await createClient()

    const { data: reviews } = await db
        .from('reviews')
        .select('id')
        .eq('cafe_id', cafeId)

    if (!reviews?.length) return new Map()

    const reviewIds = reviews.map(r => r.id)

    const { data: responses, error } = await db
        .from('owner_review_responses')
        .select(`
            *,
            owner:profiles!owner_review_responses_owner_id_fkey(
                id, username, display_name, avatar_url
            )
        `)
        .in('review_id', reviewIds)

    if (error || !responses) return new Map()

    return new Map(
        responses.map(r => [r.review_id, r as unknown as OwnerReviewResponse])
    )
}
