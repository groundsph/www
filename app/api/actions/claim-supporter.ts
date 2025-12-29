"use server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { checkAndAwardBadges } from "@/utils/badges/badge-logic"
import {
    convertToUSD,
    LIFETIME_THRESHOLD_USD,
    ONE_TIME_DURATION_DAYS,
    GRACE_PERIOD_DAYS
} from "@/utils/kofi"

export interface ClaimResult {
    success: boolean
    error?: string
    alreadySupporter?: boolean
    badgeAwarded?: boolean
    isLifetime?: boolean
}

/**
 * Calculate expiry based on stored payment data
 */
function calculateExpiryFromPayment(
    amount: number,
    currency: string,
    isSubscription: boolean
): Date | null {
    const amountUSD = convertToUSD(amount, currency)

    // Subscriptions: 1 month + grace period
    if (isSubscription) {
        const expiry = new Date()
        expiry.setDate(expiry.getDate() + 30 + GRACE_PERIOD_DAYS)
        return expiry
    }

    // One-time >= threshold: lifetime
    if (amountUSD >= LIFETIME_THRESHOLD_USD) {
        return null
    }

    // One-time below threshold: 1 month
    const expiry = new Date()
    expiry.setDate(expiry.getDate() + ONE_TIME_DURATION_DAYS)
    return expiry
}

/**
 * Claim supporter status by verifying Ko-fi email
 * Looks up the email in supporter_subscriptions and links to the user's account
 */
export async function claimSupporterStatus(kofiEmail: string): Promise<ClaimResult> {
    const supabase = await createClient()
    const adminDb = await createAdminClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { success: false, error: "You must be logged in to claim supporter status" }
    }

    // Check if user is already a supporter
    const { data: profile } = await supabase
        .from("profiles")
        .select("is_supporter")
        .eq("id", user.id)
        .single()

    if (profile?.is_supporter) {
        return { success: true, alreadySupporter: true }
    }

    // Look for a Ko-fi payment with this email that hasn't been linked yet
    const { data: payment, error: paymentError } = await adminDb
        .from("supporter_subscriptions")
        .select("id, user_id, email, from_name, amount, currency, is_subscription")
        .eq("email", kofiEmail.toLowerCase().trim())
        .is("user_id", null) // Only unlinked payments
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

    if (paymentError || !payment) {
        return {
            success: false,
            error: "No unclaimed Ko-fi payment found with this email. Make sure you've donated and the email matches exactly."
        }
    }

    // Calculate expiry based on payment
    const expiryDate = calculateExpiryFromPayment(
        payment.amount,
        payment.currency ?? 'USD',
        payment.is_subscription ?? false
    )
    const isLifetime = expiryDate === null

    // Link the payment to this user
    const { error: linkError } = await adminDb
        .from("supporter_subscriptions")
        .update({ user_id: user.id })
        .eq("id", payment.id)

    if (linkError) {
        console.error("[Claim Supporter] Error linking payment:", linkError)
        return { success: false, error: "Failed to link payment. Please try again." }
    }

    // Update user's supporter status with expiry
    const { error: updateError } = await adminDb
        .from("profiles")
        .update({
            is_supporter: true,
            support_since: new Date().toISOString(),
            supporter_expires_at: expiryDate?.toISOString() ?? null,
        })
        .eq("id", user.id)

    if (updateError) {
        console.error("[Claim Supporter] Error updating profile:", updateError)
        return { success: false, error: "Failed to update supporter status." }
    }

    // Award badge
    let badgeAwarded = false
    try {
        const badges = await checkAndAwardBadges(user.id, { supporter: true })
        badgeAwarded = badges.length > 0
    } catch (err) {
        console.error("[Claim Supporter] Error awarding badge:", err)
    }

    return { success: true, badgeAwarded, isLifetime }
}

