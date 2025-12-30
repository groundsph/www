"use server"

import { db } from "@/db"
import { profiles, supporterSubscriptions } from "@/db/schema"
import { eq, isNull, desc, and } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
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
    const user = await getCurrentUser()
    if (!user) {
        return { success: false, error: "You must be logged in to claim supporter status" }
    }

    // Check if user is already a supporter
    const profileResult = await db
        .select({ isSupporter: profiles.isSupporter })
        .from(profiles)
        .where(eq(profiles.id, user.id))
        .limit(1)

    if (profileResult[0]?.isSupporter) {
        return { success: true, alreadySupporter: true }
    }

    // Look for a Ko-fi payment with this email that hasn't been linked yet
    const paymentResult = await db
        .select({
            id: supporterSubscriptions.id,
            userId: supporterSubscriptions.userId,
            email: supporterSubscriptions.email,
            fromName: supporterSubscriptions.fromName,
            amount: supporterSubscriptions.amount,
            currency: supporterSubscriptions.currency,
            isSubscription: supporterSubscriptions.isSubscription,
        })
        .from(supporterSubscriptions)
        .where(and(
            eq(supporterSubscriptions.email, kofiEmail.toLowerCase().trim()),
            isNull(supporterSubscriptions.userId)
        ))
        .orderBy(desc(supporterSubscriptions.createdAt))
        .limit(1)

    const payment = paymentResult[0]
    if (!payment) {
        return {
            success: false,
            error: "No unclaimed Ko-fi payment found with this email. Make sure you've donated and the email matches exactly."
        }
    }

    // Calculate expiry based on payment
    const expiryDate = calculateExpiryFromPayment(
        payment.amount,
        payment.currency ?? 'USD',
        payment.isSubscription ?? false
    )
    const isLifetime = expiryDate === null

    // Link the payment to this user
    try {
        await db.update(supporterSubscriptions)
            .set({ userId: user.id })
            .where(eq(supporterSubscriptions.id, payment.id))
    } catch (error) {
        console.error("[Claim Supporter] Error linking payment:", error)
        return { success: false, error: "Failed to link payment. Please try again." }
    }

    // Update user's supporter status with expiry
    try {
        await db.update(profiles)
            .set({
                isSupporter: true,
                supportSince: new Date(),
                supporterExpiresAt: expiryDate,
            })
            .where(eq(profiles.id, user.id))
    } catch (error) {
        console.error("[Claim Supporter] Error updating profile:", error)
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
