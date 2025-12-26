/**
 * HelixPay Client Configuration
 * 
 * HelixPay is a Philippine payment gateway supporting:
 * - Credit/Debit Cards
 * - GCash
 * - GrabPay
 * - PayMaya
 * - Bank Transfers
 * 
 * API Documentation: https://docs.helixpay.ph
 */

// Environment variables for HelixPay
const HELIX_API_KEY = process.env.HELIX_API_KEY!;
const HELIX_SECRET_KEY = process.env.HELIX_SECRET_KEY!;
const HELIX_WEBHOOK_SECRET = process.env.HELIX_WEBHOOK_SECRET!;

// API base URL (use sandbox for development)
const HELIX_BASE_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.helixpay.ph'
    : 'https://sandbox.helixpay.ph';

// Product IDs for subscription tiers (to be configured in HelixPay dashboard)
export const HELIX_PRODUCT_IDS = {
    pro: process.env.HELIX_PRO_PRODUCT_ID!,
    premium: process.env.HELIX_PREMIUM_PRODUCT_ID!,
} as const;

// Types for HelixPay API responses
export interface HelixSubscription {
    id: string;
    status: 'active' | 'cancelled' | 'past_due' | 'trialing';
    product_id: string;
    customer_email: string;
    current_period_start: string;
    current_period_end: string;
    cancel_at_period_end: boolean;
    metadata?: Record<string, string>;
}

export interface HelixCheckoutSession {
    id: string;
    url: string;
    status: 'pending' | 'completed' | 'expired';
    subscription_id?: string;
}

export interface HelixWebhookEvent {
    id: string;
    type: 'subscription.created' | 'subscription.updated' | 'subscription.cancelled' | 'payment.failed';
    data: {
        object: HelixSubscription;
    };
    created_at: string;
}

// Helper to make authenticated API requests
async function helixRequest<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const response = await fetch(`${HELIX_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${HELIX_API_KEY}`,
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `HelixPay API error: ${response.status}`);
    }

    return response.json();
}

// ============================================
// Checkout & Subscription Management
// ============================================

/**
 * Create a checkout session for a new subscription
 */
export async function createCheckoutSession(params: {
    cafe_id: string;
    product_id: string;
    customer_email: string;
    success_url: string;
    cancel_url: string;
}): Promise<HelixCheckoutSession> {
    return helixRequest<HelixCheckoutSession>('/v1/checkout/sessions', {
        method: 'POST',
        body: JSON.stringify({
            product_id: params.product_id,
            customer_email: params.customer_email,
            success_url: params.success_url,
            cancel_url: params.cancel_url,
            metadata: {
                cafe_id: params.cafe_id,
            },
        }),
    });
}

/**
 * Get subscription details
 */
export async function getSubscription(subscriptionId: string): Promise<HelixSubscription> {
    return helixRequest<HelixSubscription>(`/v1/subscriptions/${subscriptionId}`);
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(subscriptionId: string): Promise<HelixSubscription> {
    return helixRequest<HelixSubscription>(`/v1/subscriptions/${subscriptionId}/cancel`, {
        method: 'POST',
    });
}

/**
 * Update subscription (upgrade/downgrade)
 */
export async function updateSubscription(
    subscriptionId: string,
    newProductId: string
): Promise<HelixSubscription> {
    return helixRequest<HelixSubscription>(`/v1/subscriptions/${subscriptionId}`, {
        method: 'PATCH',
        body: JSON.stringify({
            product_id: newProductId,
        }),
    });
}

// ============================================
// Webhook Verification
// ============================================

import crypto from 'crypto';

/**
 * Verify webhook signature from HelixPay
 */
export function verifyWebhookSignature(
    payload: string,
    signature: string
): boolean {
    const expectedSignature = crypto
        .createHmac('sha256', HELIX_WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');

    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    );
}

/**
 * Parse and verify webhook event
 */
export function parseWebhookEvent(
    payload: string,
    signature: string
): HelixWebhookEvent | null {
    if (!verifyWebhookSignature(payload, signature)) {
        console.error('Invalid HelixPay webhook signature');
        return null;
    }

    try {
        return JSON.parse(payload) as HelixWebhookEvent;
    } catch {
        console.error('Failed to parse HelixPay webhook payload');
        return null;
    }
}

// ============================================
// Tier Helpers
// ============================================

/**
 * Get the tier from a HelixPay product ID
 */
export function getTierFromProductId(productId: string): 'pro' | 'premium' | null {
    if (productId === HELIX_PRODUCT_IDS.pro) return 'pro';
    if (productId === HELIX_PRODUCT_IDS.premium) return 'premium';
    return null;
}

/**
 * Get HelixPay product ID from tier
 */
export function getProductIdFromTier(tier: 'pro' | 'premium'): string {
    return HELIX_PRODUCT_IDS[tier];
}
