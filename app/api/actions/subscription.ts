'use server'

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import {
    OwnerActionResult,
    SubscriptionCheckoutResult,
    toDbTier,
    toDisplayTier,
    CafeSubscription,
} from "@/utils/types/owner"
import {
    createCheckoutSession as helixCreateCheckout,
    cancelSubscription as helixCancelSubscription,
    updateSubscription as helixUpdateSubscription,
    getSubscription as helixGetSubscription,
    getProductIdFromTier,
    getTierFromProductId,
} from "@/utils/helix"
import { isOwnerOfCafe } from "./owner"

// ============================================
// Checkout & Subscription Management
// ============================================

/**
 * Create a checkout session for upgrading a cafe subscription
 */
export async function createSubscriptionCheckout(
    cafeId: string,
    tier: 'pro' | 'premium'
): Promise<SubscriptionCheckoutResult> {
    const db = await createClient()

    // Verify ownership
    const isOwner = await isOwnerOfCafe(cafeId)
    if (!isOwner) {
        return { success: false, error: 'Not authorized to manage this cafe' }
    }

    // Get user email for checkout
    const { data: { user } } = await db.auth.getUser()
    if (!user?.email) {
        return { success: false, error: 'User email not found' }
    }

    // Get cafe info for reference
    const { data: cafe } = await db
        .from('cafes')
        .select('name, slug')
        .eq('id', cafeId)
        .single()

    if (!cafe) {
        return { success: false, error: 'Cafe not found' }
    }

    try {
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

        const session = await helixCreateCheckout({
            cafe_id: cafeId,
            product_id: getProductIdFromTier(tier),
            customer_email: user.email,
            success_url: `${baseUrl}/owner/cafes/${cafeId}?subscription=success`,
            cancel_url: `${baseUrl}/owner/cafes/${cafeId}?subscription=cancelled`,
        })

        return {
            success: true,
            checkout_url: session.url,
        }
    } catch (error) {
        console.error('Error creating checkout session:', error)
        return { success: false, error: 'Failed to create checkout session' }
    }
}

/**
 * Cancel a cafe subscription
 */
export async function cancelCafeSubscription(
    cafeId: string
): Promise<OwnerActionResult> {
    const db = await createClient()

    // Verify ownership
    const isOwner = await isOwnerOfCafe(cafeId)
    if (!isOwner) {
        return { success: false, error: 'Not authorized to manage this cafe' }
    }

    // Get current subscription
    const { data: subscription } = await db
        .from('cafe_subscriptions')
        .select('helix_subscription_id')
        .eq('cafe_id', cafeId)
        .single()

    if (!subscription?.helix_subscription_id) {
        return { success: false, error: 'No active subscription found' }
    }

    try {
        await helixCancelSubscription(subscription.helix_subscription_id)

        // Update local record
        await db
            .from('cafe_subscriptions')
            .update({
                status: 'cancelled',
                updated_at: new Date().toISOString(),
            })
            .eq('cafe_id', cafeId)

        return { success: true }
    } catch (error) {
        console.error('Error cancelling subscription:', error)
        return { success: false, error: 'Failed to cancel subscription' }
    }
}

/**
 * Update subscription tier (upgrade/downgrade)
 */
export async function updateCafeSubscription(
    cafeId: string,
    newTier: 'pro' | 'premium'
): Promise<OwnerActionResult> {
    const db = await createClient()

    // Verify ownership
    const isOwner = await isOwnerOfCafe(cafeId)
    if (!isOwner) {
        return { success: false, error: 'Not authorized to manage this cafe' }
    }

    // Get current subscription
    const { data: subscription } = await db
        .from('cafe_subscriptions')
        .select('helix_subscription_id, tier')
        .eq('cafe_id', cafeId)
        .single()

    if (!subscription?.helix_subscription_id) {
        // No existing subscription, redirect to checkout
        return {
            success: false,
            error: 'No active subscription. Please subscribe first.'
        }
    }

    try {
        await helixUpdateSubscription(
            subscription.helix_subscription_id,
            getProductIdFromTier(newTier)
        )

        // Update local record
        await db
            .from('cafe_subscriptions')
            .update({
                tier: toDbTier(newTier),
                updated_at: new Date().toISOString(),
            })
            .eq('cafe_id', cafeId)

        return { success: true }
    } catch (error) {
        console.error('Error updating subscription:', error)
        return { success: false, error: 'Failed to update subscription' }
    }
}

/**
 * Sync subscription status from HelixPay
 * Called periodically or when needed to ensure data is fresh
 */
export async function syncSubscriptionStatus(
    cafeId: string
): Promise<CafeSubscription | null> {
    const db = await createClient()

    // Get current subscription
    const { data: subscription } = await db
        .from('cafe_subscriptions')
        .select('*')
        .eq('cafe_id', cafeId)
        .single()

    if (!subscription?.helix_subscription_id) {
        // Return default free subscription
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

    try {
        const helixSub = await helixGetSubscription(subscription.helix_subscription_id)
        const tier = getTierFromProductId(helixSub.product_id)

        // Update local record if changed
        if (
            helixSub.status !== subscription.status ||
            helixSub.current_period_end !== subscription.current_period_end
        ) {
            await db
                .from('cafe_subscriptions')
                .update({
                    status: helixSub.status,
                    tier: tier ? toDbTier(tier) : subscription.tier,
                    current_period_start: helixSub.current_period_start,
                    current_period_end: helixSub.current_period_end,
                    updated_at: new Date().toISOString(),
                })
                .eq('cafe_id', cafeId)
        }

        return {
            id: subscription.id,
            cafe_id: subscription.cafe_id,
            tier: tier ? tier : toDisplayTier(subscription.tier),
            helix_subscription_id: subscription.helix_subscription_id,
            status: helixSub.status,
            current_period_start: helixSub.current_period_start,
            current_period_end: helixSub.current_period_end,
            created_at: subscription.created_at,
            updated_at: new Date().toISOString(),
        }
    } catch (error) {
        console.error('Error syncing subscription:', error)
        // Return cached data on error
        return {
            id: subscription.id,
            cafe_id: subscription.cafe_id,
            tier: toDisplayTier(subscription.tier),
            helix_subscription_id: subscription.helix_subscription_id,
            status: subscription.status,
            current_period_start: subscription.current_period_start,
            current_period_end: subscription.current_period_end,
            created_at: subscription.created_at,
            updated_at: subscription.updated_at,
            proof_of_payment_url: subscription.proof_of_payment_url,
            is_manual_payment: subscription.is_manual_payment ?? undefined,
            payment_verified: subscription.payment_verified ?? undefined,
        }
    }
}

// ============================================
// Internal Functions (for webhook handler)
// ============================================

/**
 * Create or update subscription record from webhook
 * This is called by the webhook handler, not directly by users
 */
export async function upsertSubscriptionFromWebhook(params: {
    cafe_id: string
    helix_subscription_id: string
    tier: 'pro' | 'premium'
    status: 'active' | 'cancelled' | 'past_due' | 'trialing'
    current_period_start: string
    current_period_end: string
}): Promise<OwnerActionResult> {
    const db = await createClient()

    const { error } = await db
        .from('cafe_subscriptions')
        .upsert({
            cafe_id: params.cafe_id,
            helix_subscription_id: params.helix_subscription_id,
            tier: toDbTier(params.tier),
            status: params.status,
            current_period_start: params.current_period_start,
            current_period_end: params.current_period_end,
            updated_at: new Date().toISOString(),
        }, {
            onConflict: 'cafe_id',
        })

    if (error) {
        console.error('Error upserting subscription:', error)
        return { success: false, error: 'Failed to update subscription record' }
    }

    // If subscription is active, update cafe's membership_tier
    if (params.status === 'active') {
        await db
            .from('cafes')
            .update({
                membership_tier: toDbTier(params.tier),
                updated_at: new Date().toISOString(),
            })
            .eq('id', params.cafe_id)
    }

    return { success: true }
}

/**
 * Handle subscription cancellation from webhook
 */
export async function handleSubscriptionCancellation(
    helix_subscription_id: string
): Promise<OwnerActionResult> {
    const db = await createClient()

    // Find the subscription
    const { data: subscription } = await db
        .from('cafe_subscriptions')
        .select('cafe_id')
        .eq('helix_subscription_id', helix_subscription_id)
        .single()

    if (!subscription) {
        return { success: false, error: 'Subscription not found' }
    }

    // Update subscription status
    const { error: subError } = await db
        .from('cafe_subscriptions')
        .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
        })
        .eq('helix_subscription_id', helix_subscription_id)

    if (subError) {
        console.error('Error updating subscription:', subError)
        return { success: false, error: 'Failed to update subscription status' }
    }

    // Downgrade cafe to free tier
    const { error: cafeError } = await db
        .from('cafes')
        .update({
            membership_tier: 'free',
            updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.cafe_id)

    if (cafeError) {
        console.error('Error updating cafe tier:', cafeError)
        // Non-critical, continue
    }

    return { success: true }
}

/**
 * Submit manual payment proof for subscription
 */
export async function submitManualPayment(
    cafeId: string,
    tier: 'pro' | 'premium',
    proofUrl: string
): Promise<OwnerActionResult> {
    const db = await createAdminClient()

    // Verify ownership
    const isOwner = await isOwnerOfCafe(cafeId)
    if (!isOwner) {
        return { success: false, error: 'Not authorized to manage this cafe' }
    }

    try {
        // Get cafe info for notification
        const { data: cafe } = await db
            .from('cafes')
            .select('name, slug, owner_ids')
            .eq('id', cafeId)
            .single()

        // Calculate period (6 months)
        const startDate = new Date()
        const endDate = new Date()
        endDate.setMonth(endDate.getMonth() + 6)

        // Upsert subscription record
        const { error } = await db
            .from('cafe_subscriptions')
            .upsert({
                cafe_id: cafeId,
                tier: toDbTier(tier),
                status: 'active', // Grants immediate access
                is_manual_payment: true,
                payment_verified: false,
                proof_of_payment_url: proofUrl,
                current_period_start: startDate.toISOString(),
                current_period_end: endDate.toISOString(),
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'cafe_id'
            })

        if (error) {
            console.error('Error submitting manual payment:', error)
            return { success: false, error: 'Failed to submit payment record' }
        }

        // Update cafe membership status immediately
        await db
            .from('cafes')
            .update({
                membership_tier: toDbTier(tier),
                updated_at: new Date().toISOString(),
            })
            .eq('id', cafeId)

        // Send Discord notification
        if (cafe) {
            const ownerIds = cafe.owner_ids as string[] | null
            let ownerName: string | undefined
            if (ownerIds && ownerIds.length > 0) {
                const { data: profile } = await db
                    .from('profiles')
                    .select('display_name')
                    .eq('id', ownerIds[0])
                    .single()
                ownerName = profile?.display_name || undefined
            }

            const { notifySubscriptionSubmission } = await import('@/utils/discord')
            await notifySubscriptionSubmission(
                cafe.name,
                cafe.slug,
                tier === 'pro' ? 'Pro' : 'Premium',
                ownerName
            )
        }

        return { success: true }
    } catch (error) {
        console.error('Error processing manual payment:', error)
        return { success: false, error: 'An unexpected error occurred' }
    }
}

/**
 * Handle failed payment from webhook
 */
export async function handlePaymentFailed(
    helix_subscription_id: string
): Promise<OwnerActionResult> {
    const db = await createClient()

    const { error } = await db
        .from('cafe_subscriptions')
        .update({
            status: 'past_due',
            updated_at: new Date().toISOString(),
        })
        .eq('helix_subscription_id', helix_subscription_id)

    if (error) {
        console.error('Error updating subscription status:', error)
        return { success: false, error: 'Failed to update subscription status' }
    }

    // TODO: Send email notification to cafe owner about failed payment

    return { success: true }
}
