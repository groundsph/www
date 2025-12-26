import { NextRequest, NextResponse } from 'next/server'
import { parseWebhookEvent, getTierFromProductId, HelixWebhookEvent } from '@/utils/helix'
import {
    upsertSubscriptionFromWebhook,
    handleSubscriptionCancellation,
    handlePaymentFailed,
} from '@/app/api/actions/subscription'

/**
 * HelixPay Webhook Handler
 * 
 * Handles subscription lifecycle events from HelixPay:
 * - subscription.created: New subscription started
 * - subscription.updated: Subscription upgraded/downgraded
 * - subscription.cancelled: Subscription cancelled
 * - payment.failed: Payment failed
 */
export async function POST(request: NextRequest) {
    try {
        // Get raw body for signature verification
        const payload = await request.text()
        const signature = request.headers.get('x-helix-signature')

        if (!signature) {
            console.error('Missing HelixPay signature header')
            return NextResponse.json(
                { error: 'Missing signature' },
                { status: 401 }
            )
        }

        // Verify and parse the webhook event
        const event = parseWebhookEvent(payload, signature)

        if (!event) {
            return NextResponse.json(
                { error: 'Invalid signature or payload' },
                { status: 401 }
            )
        }

        console.log(`Processing HelixPay webhook: ${event.type}`)

        // Handle the event
        switch (event.type) {
            case 'subscription.created':
            case 'subscription.updated':
                await handleSubscriptionChange(event)
                break

            case 'subscription.cancelled':
                await handleSubscriptionCancellation(event.data.object.id)
                break

            case 'payment.failed':
                await handlePaymentFailed(event.data.object.id)
                break

            default:
                console.log(`Unhandled event type: ${event.type}`)
        }

        return NextResponse.json({ received: true })
    } catch (error) {
        console.error('Webhook handler error:', error)
        return NextResponse.json(
            { error: 'Webhook handler failed' },
            { status: 500 }
        )
    }
}

/**
 * Handle subscription created or updated events
 */
async function handleSubscriptionChange(event: HelixWebhookEvent) {
    const subscription = event.data.object
    const cafeId = subscription.metadata?.cafe_id

    if (!cafeId) {
        console.error('No cafe_id in subscription metadata:', subscription.id)
        return
    }

    const tier = getTierFromProductId(subscription.product_id)
    if (!tier) {
        console.error('Unknown product ID:', subscription.product_id)
        return
    }

    await upsertSubscriptionFromWebhook({
        cafe_id: cafeId,
        helix_subscription_id: subscription.id,
        tier,
        status: subscription.status,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
    })

    console.log(`Subscription ${event.type} processed for cafe:`, cafeId)
}
