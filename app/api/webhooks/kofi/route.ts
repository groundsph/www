import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { user, profiles, supporterSubscriptions } from '@/db/schema';
import { eq } from 'drizzle-orm';
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
    const result = {
        recorded: false,
        userFound: false,
        supporterUpdated: false,
        badgeAwarded: false,
    };

    // Look up user by email from Better Auth user table
    const authUsers = await db
        .select({ id: user.id, email: user.email })
        .from(user)
        .where(eq(user.email, payload.email.toLowerCase()));

    const authUser = authUsers[0];
    const userId = authUser?.id ?? null;
    if (userId) {
        result.userFound = true;
    }

    // Record the payment in supporter_subscriptions
    try {
        await db.insert(supporterSubscriptions).values({
            userId: userId,
            kofiTransactionId: payload.kofi_transaction_id,
            email: payload.email,
            fromName: payload.from_name,
            amount: parseKofiAmount(payload.amount),
            currency: payload.currency,
            tierName: payload.tier_name,
            isSubscription: payload.is_subscription_payment,
            isFirstSubscription: payload.is_first_subscription_payment,
            message: payload.message,
        });
        result.recorded = true;
    } catch (insertError: unknown) {
        // Check if it's a duplicate (unique constraint on kofi_transaction_id)
        const errorMessage = insertError instanceof Error ? insertError.message : '';
        if (errorMessage.includes('unique') || errorMessage.includes('duplicate')) {
            console.log('[Ko-fi Webhook] Duplicate transaction, already processed');
            return { ...result, recorded: true };
        }
        console.error('[Ko-fi Webhook] Error recording payment:', insertError);
    }

    // If this qualifies and we found the user, update their supporter status
    if (userId && qualifiesForSupporterStatus(payload)) {
        // Calculate expiry date
        const expiryDate = calculateSupporterExpiry(payload);

        // Get current profile
        const currentProfiles = await db
            .select({
                isSupporter: profiles.isSupporter,
                supportSince: profiles.supportSince,
                supporterExpiresAt: profiles.supporterExpiresAt
            })
            .from(profiles)
            .where(eq(profiles.id, userId))
            .limit(1);

        const currentProfile = currentProfiles[0];

        if (currentProfile) {
            // Determine if we should update expiry
            const currentExpiry = currentProfile.supporterExpiresAt;

            // If new expiry is null (lifetime), always use it
            // If current is null (lifetime), keep it
            // Otherwise, use the later date
            let newExpiry: Date | null = expiryDate;
            if (currentExpiry === null && currentProfile.isSupporter) {
                // Already lifetime, keep it
                newExpiry = null;
            } else if (expiryDate && currentExpiry && expiryDate > currentExpiry) {
                // New expiry is later, use it
                newExpiry = expiryDate;
            } else if (expiryDate && currentExpiry && currentExpiry > expiryDate) {
                // Current expiry is later, keep it
                newExpiry = currentExpiry;
            }

            const updateData: {
                isSupporter: boolean;
                supporterExpiresAt: Date | null;
                supportSince?: Date;
            } = {
                isSupporter: true,
                supporterExpiresAt: newExpiry,
            };

            // Only set support_since if they weren't already a supporter
            if (!currentProfile.isSupporter) {
                updateData.supportSince = new Date();
            }

            try {
                await db
                    .update(profiles)
                    .set(updateData)
                    .where(eq(profiles.id, userId));

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
            } catch (updateError) {
                console.error('[Ko-fi Webhook] Error updating supporter status:', updateError);
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
