import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import type { User } from '@supabase/supabase-js';
import {
    parseKofiPayload,
    verifyKofiWebhook,
    parseKofiAmount,
    qualifiesForSupporterStatus,
    formatKofiPaymentForDiscord,
    calculateSupporterExpiry,
    KofiWebhookPayload
} from '@/utils/kofi';
import { checkAndAwardBadges } from '@/utils/badges/badge-logic';

/**
 * Ko-fi Webhook Handler
 * 
 * Receives webhook events from Ko-fi when supporters make payments.
 * For subscription payments, it:
 * 1. Records the payment in supporter_subscriptions
 * 2. Updates the user's profile with is_supporter = true
 * 3. Awards the "Grounds Supporter" badge
 * 4. Sends a Discord notification
 */
export async function POST(request: NextRequest) {
    try {
        // Ko-fi sends data as form-urlencoded with a 'data' field containing JSON
        const formData = await request.formData();
        const dataString = formData.get('data');

        if (!dataString || typeof dataString !== 'string') {
            console.error('[Ko-fi Webhook] Missing or invalid data field');
            return NextResponse.json(
                { error: 'Missing data field' },
                { status: 400 }
            );
        }

        // Parse the JSON payload
        const payload = parseKofiPayload(dataString);
        if (!payload) {
            console.error('[Ko-fi Webhook] Failed to parse payload');
            return NextResponse.json(
                { error: 'Invalid payload' },
                { status: 400 }
            );
        }

        // Verify the webhook token
        if (!verifyKofiWebhook(payload)) {
            console.error('[Ko-fi Webhook] Invalid verification token');
            return NextResponse.json(
                { error: 'Invalid verification token' },
                { status: 401 }
            );
        }

        console.log('[Ko-fi Webhook] Received valid payload:', {
            type: payload.type,
            from_name: payload.from_name,
            amount: payload.amount,
            is_subscription: payload.is_subscription_payment,
            is_first: payload.is_first_subscription_payment,
            tier: payload.tier_name,
        });

        // Process the payment
        const result = await processKofiPayment(payload);

        // Send Discord notification
        await sendKofiDiscordNotification(payload);

        return NextResponse.json({
            success: true,
            ...result
        });

    } catch (error) {
        console.error('[Ko-fi Webhook] Error processing webhook:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * Process a Ko-fi payment
 */
async function processKofiPayment(payload: KofiWebhookPayload): Promise<{
    recorded: boolean;
    userFound: boolean;
    supporterUpdated: boolean;
    badgeAwarded: boolean;
}> {
    const supabase = await createAdminClient();
    const result = {
        recorded: false,
        userFound: false,
        supporterUpdated: false,
        badgeAwarded: false,
    };

    // Look up user by email from auth
    const { data: authData } = await supabase.auth.admin.listUsers();
    const authUser = authData.users.find(
        (u: User) => u.email?.toLowerCase() === payload.email.toLowerCase()
    );

    const userId = authUser?.id ?? null;
    if (userId) {
        result.userFound = true;
    }

    // Record the payment in supporter_subscriptions
    const { error: insertError } = await supabase
        .from('supporter_subscriptions')
        .insert({
            user_id: userId,
            kofi_transaction_id: payload.kofi_transaction_id,
            email: payload.email,
            from_name: payload.from_name,
            amount: parseKofiAmount(payload.amount),
            currency: payload.currency,
            tier_name: payload.tier_name,
            is_subscription: payload.is_subscription_payment,
            is_first_subscription: payload.is_first_subscription_payment,
            message: payload.message,
        });

    if (insertError) {
        // Check if it's a duplicate (unique constraint on kofi_transaction_id)
        if (insertError.code === '23505') {
            console.log('[Ko-fi Webhook] Duplicate transaction, already processed');
            return { ...result, recorded: true };
        }
        console.error('[Ko-fi Webhook] Error recording payment:', insertError);
    } else {
        result.recorded = true;
    }

    // If this qualifies and we found the user, update their supporter status
    if (userId && qualifiesForSupporterStatus(payload)) {
        // Calculate expiry date
        const expiryDate = calculateSupporterExpiry(payload);
        const expiryValue = expiryDate ? expiryDate.toISOString() : null;

        // Get current profile
        const { data: currentProfile } = await supabase
            .from('profiles')
            .select('is_supporter, support_since, supporter_expires_at')
            .eq('id', userId)
            .single();

        if (currentProfile) {
            // Determine if we should update expiry
            // - New supporter: set expiry
            // - Existing supporter with new payment: extend expiry if new one is later
            const currentExpiry = currentProfile.supporter_expires_at
                ? new Date(currentProfile.supporter_expires_at)
                : null;

            // If new expiry is null (lifetime), always use it
            // If current is null (lifetime), keep it
            // Otherwise, use the later date
            let newExpiry: string | null = expiryValue;
            if (currentExpiry === null && currentProfile.is_supporter) {
                // Already lifetime, keep it
                newExpiry = null;
            } else if (expiryDate && currentExpiry && expiryDate > currentExpiry) {
                // New expiry is later, use it
                newExpiry = expiryValue;
            } else if (expiryDate && currentExpiry && currentExpiry > expiryDate) {
                // Current expiry is later, keep it
                newExpiry = currentExpiry.toISOString();
            }

            const updateData: Record<string, unknown> = {
                is_supporter: true,
                supporter_expires_at: newExpiry,
            };

            // Only set support_since if they weren't already a supporter
            if (!currentProfile.is_supporter) {
                updateData.support_since = new Date().toISOString();
            }

            const { error: updateError } = await supabase
                .from('profiles')
                .update(updateData)
                .eq('id', userId);

            if (updateError) {
                console.error('[Ko-fi Webhook] Error updating supporter status:', updateError);
            } else {
                result.supporterUpdated = true;
                console.log('[Ko-fi Webhook] Updated supporter status for user:', userId,
                    'expires:', newExpiry ?? 'lifetime');

                // Award the supporter badge if not already awarded
                try {
                    const badges = await checkAndAwardBadges(userId, { supporter: true });
                    if (badges.length > 0) {
                        result.badgeAwarded = true;
                        console.log('[Ko-fi Webhook] Awarded badges:', badges);
                    }
                } catch (badgeError) {
                    console.error('[Ko-fi Webhook] Error awarding badge:', badgeError);
                }
            }
        }
    }

    return result;
}

/**
 * Send a Discord notification for a Ko-fi payment
 */
async function sendKofiDiscordNotification(payload: KofiWebhookPayload): Promise<void> {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
        console.warn('[Ko-fi Webhook] DISCORD_WEBHOOK_URL not configured');
        return;
    }

    const embed = formatKofiPaymentForDiscord(payload);

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    title: embed.title,
                    description: embed.description,
                    color: embed.color,
                    timestamp: new Date().toISOString(),
                    footer: {
                        text: 'Ko-fi • Grounds Support',
                    },
                }],
            }),
        });

        if (!response.ok) {
            console.error('[Ko-fi Webhook] Discord notification failed:', response.status);
        }
    } catch (error) {
        console.error('[Ko-fi Webhook] Error sending Discord notification:', error);
    }
}

// Handle GET requests (Ko-fi may ping the endpoint)
export async function GET() {
    return NextResponse.json({ status: 'Ko-fi webhook endpoint active' });
}
