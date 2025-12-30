'use server'

import { db } from "@/db"
import { cafes, cafeSubscriptions, profiles } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
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
    // Verify ownership
    const isOwner = await isOwnerOfCafe(cafeId)
    if (!isOwner) {
        return { success: false, error: 'Not authorized to manage this cafe' }
    }

    // Get user email for checkout
    const user = await getCurrentUser()
    if (!user?.email) {
        return { success: false, error: 'User email not found' }
    }

    // Get cafe info for reference
    const cafeResult = await db
        .select({ name: cafes.name, slug: cafes.slug })
        .from(cafes)
        .where(eq(cafes.id, cafeId))
        .limit(1)

    const cafe = cafeResult[0]
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
    // Verify ownership
    const isOwner = await isOwnerOfCafe(cafeId)
    if (!isOwner) {
        return { success: false, error: 'Not authorized to manage this cafe' }
    }

    // Get current subscription
    const subResult = await db
        .select({ helixSubscriptionId: cafeSubscriptions.helixSubscriptionId })
        .from(cafeSubscriptions)
        .where(eq(cafeSubscriptions.cafeId, cafeId))
        .limit(1)

    const subscription = subResult[0]
    if (!subscription?.helixSubscriptionId) {
        return { success: false, error: 'No active subscription found' }
    }

    try {
        await helixCancelSubscription(subscription.helixSubscriptionId)

        // Update local record
        await db
            .update(cafeSubscriptions)
            .set({
                status: 'cancelled',
                updatedAt: new Date(),
            })
            .where(eq(cafeSubscriptions.cafeId, cafeId))

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
    // Verify ownership
    const isOwner = await isOwnerOfCafe(cafeId)
    if (!isOwner) {
        return { success: false, error: 'Not authorized to manage this cafe' }
    }

    // Get current subscription
    const subResult = await db
        .select({
            helixSubscriptionId: cafeSubscriptions.helixSubscriptionId,
            tier: cafeSubscriptions.tier
        })
        .from(cafeSubscriptions)
        .where(eq(cafeSubscriptions.cafeId, cafeId))
        .limit(1)

    const subscription = subResult[0]
    if (!subscription?.helixSubscriptionId) {
        return {
            success: false,
            error: 'No active subscription. Please subscribe first.'
        }
    }

    try {
        await helixUpdateSubscription(
            subscription.helixSubscriptionId,
            getProductIdFromTier(newTier)
        )

        // Update local record
        await db
            .update(cafeSubscriptions)
            .set({
                tier: toDbTier(newTier),
                updatedAt: new Date(),
            })
            .where(eq(cafeSubscriptions.cafeId, cafeId))

        return { success: true }
    } catch (error) {
        console.error('Error updating subscription:', error)
        return { success: false, error: 'Failed to update subscription' }
    }
}

/**
 * Sync subscription status from HelixPay
 */
export async function syncSubscriptionStatus(
    cafeId: string
): Promise<CafeSubscription | null> {
    // Get current subscription
    const subResult = await db
        .select()
        .from(cafeSubscriptions)
        .where(eq(cafeSubscriptions.cafeId, cafeId))
        .limit(1)

    const subscription = subResult[0]
    if (!subscription?.helixSubscriptionId) {
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
        const helixSub = await helixGetSubscription(subscription.helixSubscriptionId)
        const tier = getTierFromProductId(helixSub.product_id)

        // Update local record if changed
        if (
            helixSub.status !== subscription.status ||
            helixSub.current_period_end !== subscription.currentPeriodEnd?.toISOString()
        ) {
            await db
                .update(cafeSubscriptions)
                .set({
                    status: helixSub.status,
                    tier: tier ? toDbTier(tier) : subscription.tier,
                    currentPeriodStart: new Date(helixSub.current_period_start),
                    currentPeriodEnd: new Date(helixSub.current_period_end),
                    updatedAt: new Date(),
                })
                .where(eq(cafeSubscriptions.cafeId, cafeId))
        }

        return {
            id: subscription.id,
            cafe_id: subscription.cafeId,
            tier: tier ? tier : toDisplayTier(subscription.tier ?? 'free'),
            helix_subscription_id: subscription.helixSubscriptionId,
            status: helixSub.status,
            current_period_start: helixSub.current_period_start,
            current_period_end: helixSub.current_period_end,
            created_at: subscription.createdAt?.toISOString() ?? null,
            updated_at: new Date().toISOString(),
        }
    } catch (error) {
        console.error('Error syncing subscription:', error)
        // Return cached data on error
        return {
            id: subscription.id,
            cafe_id: subscription.cafeId,
            tier: toDisplayTier(subscription.tier ?? 'free'),
            helix_subscription_id: subscription.helixSubscriptionId,
            status: subscription.status ?? 'active',
            current_period_start: subscription.currentPeriodStart?.toISOString() ?? null,
            current_period_end: subscription.currentPeriodEnd?.toISOString() ?? null,
            created_at: subscription.createdAt?.toISOString() ?? null,
            updated_at: subscription.updatedAt?.toISOString() ?? null,
            proof_of_payment_url: subscription.proofOfPaymentUrl ?? undefined,
            is_manual_payment: subscription.isManualPayment ?? undefined,
            payment_verified: subscription.paymentVerified ?? undefined,
        }
    }
}

// ============================================
// Internal Functions (for webhook handler)
// ============================================

/**
 * Create or update subscription record from webhook
 */
export async function upsertSubscriptionFromWebhook(params: {
    cafe_id: string
    helix_subscription_id: string
    tier: 'pro' | 'premium'
    status: 'active' | 'cancelled' | 'past_due' | 'trialing'
    current_period_start: string
    current_period_end: string
}): Promise<OwnerActionResult> {
    try {
        // Check if subscription exists
        const existing = await db
            .select({ id: cafeSubscriptions.id })
            .from(cafeSubscriptions)
            .where(eq(cafeSubscriptions.cafeId, params.cafe_id))
            .limit(1)

        if (existing[0]) {
            // Update
            await db
                .update(cafeSubscriptions)
                .set({
                    helixSubscriptionId: params.helix_subscription_id,
                    tier: toDbTier(params.tier),
                    status: params.status,
                    currentPeriodStart: new Date(params.current_period_start),
                    currentPeriodEnd: new Date(params.current_period_end),
                    updatedAt: new Date(),
                })
                .where(eq(cafeSubscriptions.cafeId, params.cafe_id))
        } else {
            // Insert
            await db.insert(cafeSubscriptions).values({
                cafeId: params.cafe_id,
                helixSubscriptionId: params.helix_subscription_id,
                tier: toDbTier(params.tier),
                status: params.status,
                currentPeriodStart: new Date(params.current_period_start),
                currentPeriodEnd: new Date(params.current_period_end),
            })
        }

        // If subscription is active, update cafe's membership_tier
        if (params.status === 'active') {
            await db
                .update(cafes)
                .set({
                    membershipTier: toDbTier(params.tier),
                    updatedAt: new Date(),
                })
                .where(eq(cafes.id, params.cafe_id))
        }

        return { success: true }
    } catch (error) {
        console.error('Error upserting subscription:', error)
        return { success: false, error: 'Failed to update subscription record' }
    }
}

/**
 * Handle subscription cancellation from webhook
 */
export async function handleSubscriptionCancellation(
    helix_subscription_id: string
): Promise<OwnerActionResult> {
    // Find the subscription
    const subResult = await db
        .select({ cafeId: cafeSubscriptions.cafeId })
        .from(cafeSubscriptions)
        .where(eq(cafeSubscriptions.helixSubscriptionId, helix_subscription_id))
        .limit(1)

    const subscription = subResult[0]
    if (!subscription) {
        return { success: false, error: 'Subscription not found' }
    }

    try {
        // Update subscription status
        await db
            .update(cafeSubscriptions)
            .set({
                status: 'cancelled',
                updatedAt: new Date(),
            })
            .where(eq(cafeSubscriptions.helixSubscriptionId, helix_subscription_id))

        // Downgrade cafe to free tier
        await db
            .update(cafes)
            .set({
                membershipTier: 'free',
                updatedAt: new Date(),
            })
            .where(eq(cafes.id, subscription.cafeId))

        return { success: true }
    } catch (error) {
        console.error('Error handling subscription cancellation:', error)
        return { success: false, error: 'Failed to update subscription status' }
    }
}

/**
 * Submit manual payment proof for subscription
 */
export async function submitManualPayment(
    cafeId: string,
    tier: 'pro' | 'premium',
    proofUrl: string
): Promise<OwnerActionResult> {
    // Verify ownership
    const isOwner = await isOwnerOfCafe(cafeId)
    if (!isOwner) {
        return { success: false, error: 'Not authorized to manage this cafe' }
    }

    try {
        // Get cafe info for notification
        const cafeResult = await db
            .select({ name: cafes.name, slug: cafes.slug, ownerIds: cafes.ownerIds })
            .from(cafes)
            .where(eq(cafes.id, cafeId))
            .limit(1)

        const cafe = cafeResult[0]

        // Calculate period (6 months)
        const startDate = new Date()
        const endDate = new Date()
        endDate.setMonth(endDate.getMonth() + 6)

        // Check if subscription exists
        const existing = await db
            .select({ id: cafeSubscriptions.id })
            .from(cafeSubscriptions)
            .where(eq(cafeSubscriptions.cafeId, cafeId))
            .limit(1)

        if (existing[0]) {
            await db
                .update(cafeSubscriptions)
                .set({
                    tier: toDbTier(tier),
                    status: 'active',
                    isManualPayment: true,
                    paymentVerified: false,
                    proofOfPaymentUrl: proofUrl,
                    currentPeriodStart: startDate,
                    currentPeriodEnd: endDate,
                    updatedAt: new Date(),
                })
                .where(eq(cafeSubscriptions.cafeId, cafeId))
        } else {
            await db.insert(cafeSubscriptions).values({
                cafeId,
                tier: toDbTier(tier),
                status: 'active',
                isManualPayment: true,
                paymentVerified: false,
                proofOfPaymentUrl: proofUrl,
                currentPeriodStart: startDate,
                currentPeriodEnd: endDate,
            })
        }

        // Update cafe membership status immediately
        await db
            .update(cafes)
            .set({
                membershipTier: toDbTier(tier),
                updatedAt: new Date(),
            })
            .where(eq(cafes.id, cafeId))

        // Send Discord notification
        if (cafe) {
            const ownerIds = cafe.ownerIds
            let ownerName: string | undefined
            if (ownerIds && ownerIds.length > 0) {
                const profileResult = await db
                    .select({ displayName: profiles.displayName })
                    .from(profiles)
                    .where(eq(profiles.id, ownerIds[0]))
                    .limit(1)
                ownerName = profileResult[0]?.displayName || undefined
            }

            const { notifyDiscordSubscription } = await import('@/app/api/actions/notify')
            await notifyDiscordSubscription(
                { name: cafe.name, slug: cafe.slug },
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
    try {
        await db
            .update(cafeSubscriptions)
            .set({
                status: 'past_due',
                updatedAt: new Date(),
            })
            .where(eq(cafeSubscriptions.helixSubscriptionId, helix_subscription_id))

        return { success: true }
    } catch (error) {
        console.error('Error updating subscription status:', error)
        return { success: false, error: 'Failed to update subscription status' }
    }
}
