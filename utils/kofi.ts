/**
 * Ko-fi Integration Utilities
 * 
 * Ko-fi is a donation/membership platform that sends webhooks
 * when supporters make payments or subscribe.
 * 
 * Webhook Documentation: https://ko-fi.com/manage/webhooks
 */

// ============================================
// Environment Variables
// ============================================

const KOFI_VERIFICATION_TOKEN = process.env.KOFI_WEBHOOK_VERIFICATION_TOKEN!;

// ============================================
// Ko-fi Webhook Types
// ============================================

/**
 * Ko-fi webhook payload structure
 * Sent as form data with a 'data' field containing JSON
 */
export interface KofiWebhookPayload {
    /** Unique identifier for this transaction */
    verification_token: string;
    /** Unique message/transaction ID */
    message_id: string;
    /** ISO timestamp of the transaction */
    timestamp: string;
    /** Type of payment */
    type: 'Donation' | 'Subscription' | 'Commission' | 'Shop Order';
    /** Whether the supporter made this public */
    is_public: boolean;
    /** Display name of the supporter */
    from_name: string;
    /** Optional message from supporter */
    message: string | null;
    /** Payment amount as string (e.g., "5.00") */
    amount: string;
    /** URL to the Ko-fi page */
    url: string;
    /** Supporter's email address */
    email: string;
    /** Currency code (e.g., "USD", "PHP") */
    currency: string;
    /** Whether this is a subscription payment */
    is_subscription_payment: boolean;
    /** Whether this is the first subscription payment */
    is_first_subscription_payment: boolean;
    /** Ko-fi's internal transaction ID */
    kofi_transaction_id: string;
    /** Shop items if applicable */
    shop_items: KofiShopItem[] | null;
    /** Membership tier name if subscription */
    tier_name: string | null;
    /** Shipping details if applicable */
    shipping: KofiShipping | null;
}

export interface KofiShopItem {
    direct_link_code: string;
    variation_name: string | null;
    quantity: number;
}

export interface KofiShipping {
    full_name: string;
    street_address: string;
    city: string;
    state_or_province: string;
    postal_code: string;
    country: string;
    country_code: string;
    telephone: string;
}

// ============================================
// Webhook Verification
// ============================================

/**
 * Verify that a Ko-fi webhook payload is authentic
 * Ko-fi includes a verification_token in each payload that must match your configured token
 */
export function verifyKofiWebhook(payload: KofiWebhookPayload): boolean {
    if (!KOFI_VERIFICATION_TOKEN) {
        console.error('KOFI_WEBHOOK_VERIFICATION_TOKEN not configured');
        return false;
    }
    return payload.verification_token === KOFI_VERIFICATION_TOKEN;
}

/**
 * Parse the raw form data 'data' field into a KofiWebhookPayload
 */
export function parseKofiPayload(dataString: string): KofiWebhookPayload | null {
    try {
        return JSON.parse(dataString) as KofiWebhookPayload;
    } catch (error) {
        console.error('Failed to parse Ko-fi webhook payload:', error);
        return null;
    }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Convert Ko-fi amount string to number
 */
export function parseKofiAmount(amount: string): number {
    return parseFloat(amount) || 0;
}

/**
 * Check if this payment qualifies for supporter status
 * Any Ko-fi payment (one-time or subscription) grants supporter status
 */
export function qualifiesForSupporterStatus(payload: KofiWebhookPayload): boolean {
    // All Ko-fi payments qualify (donations, subscriptions, commissions)
    return payload.type === 'Donation' || payload.type === 'Subscription';
}

/**
 * Format a Ko-fi payment for Discord notification
 */
export function formatKofiPaymentForDiscord(payload: KofiWebhookPayload): {
    title: string;
    description: string;
    color: number;
} {
    const emoji = payload.is_subscription_payment ? '🔄' : '☕';
    const typeLabel = payload.is_subscription_payment
        ? `Subscription${payload.tier_name ? ` (${payload.tier_name})` : ''}`
        : 'Donation';

    return {
        title: `${emoji} New Ko-fi ${typeLabel}!`,
        description: [
            `**From:** ${payload.from_name}`,
            `**Amount:** ${payload.amount} ${payload.currency}`,
            payload.message ? `**Message:** "${payload.message}"` : null,
            payload.is_first_subscription_payment ? '🎉 *First-time subscriber!*' : null,
        ].filter(Boolean).join('\n'),
        color: payload.is_subscription_payment ? 0x29ABE0 : 0xFF5E5B, // Ko-fi blue for subs, red for donations
    };
}

// ============================================
// Supporter Expiry Logic
// ============================================

/** 
 * Threshold for lifetime supporter status (in USD)
 * One-time donations >= this amount get lifetime badge
 */
export const LIFETIME_THRESHOLD_USD = 45;

/**
 * Grace period in days after subscription period ends
 */
export const GRACE_PERIOD_DAYS = 7;

/**
 * Duration of supporter badge for one-time donations below threshold (in days)
 */
export const ONE_TIME_DURATION_DAYS = 30;

/**
 * Approximate exchange rates to USD for common currencies
 * Used to normalize donation amounts for threshold comparison
 */
const CURRENCY_TO_USD: Record<string, number> = {
    USD: 1,
    PHP: 0.018, // ~56 PHP per USD
    EUR: 1.10,
    GBP: 1.27,
    CAD: 0.74,
    AUD: 0.64,
    JPY: 0.0067,
    KRW: 0.00074,
    SGD: 0.74,
    MYR: 0.21,
};

/**
 * Convert amount to USD for threshold comparison
 */
export function convertToUSD(amount: number, currency: string): number {
    const rate = CURRENCY_TO_USD[currency.toUpperCase()] ?? 1;
    return amount * rate;
}

/**
 * Calculate supporter expiry date based on payment type and amount
 * 
 * Rules:
 * - Subscription: 1 month + grace period (renewed on each payment)
 * - One-time >= $45 USD: Lifetime (null = no expiry)
 * - One-time < $45 USD: 1 month
 */
export function calculateSupporterExpiry(payload: KofiWebhookPayload): Date | null {
    const amount = parseKofiAmount(payload.amount);
    const amountUSD = convertToUSD(amount, payload.currency);

    // Subscriptions: set expiry to ~1 month + grace period from now
    // Ko-fi will send another webhook for the next payment
    if (payload.is_subscription_payment) {
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 30 + GRACE_PERIOD_DAYS);
        return expiry;
    }

    // One-time donation: check if it qualifies for lifetime
    if (amountUSD >= LIFETIME_THRESHOLD_USD) {
        return null; // null = lifetime, no expiry
    }

    // One-time below threshold: 1 month
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + ONE_TIME_DURATION_DAYS);
    return expiry;
}

/**
 * Check if a payment qualifies for lifetime supporter status
 */
export function isLifetimeSupporter(payload: KofiWebhookPayload): boolean {
    if (payload.is_subscription_payment) return false;
    const amount = parseKofiAmount(payload.amount);
    const amountUSD = convertToUSD(amount, payload.currency);
    return amountUSD >= LIFETIME_THRESHOLD_USD;
}

