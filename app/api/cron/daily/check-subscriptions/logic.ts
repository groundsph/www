import { db } from "@/db"
import { cafes, cafeSubscriptions, profiles, badgeDefinitions, userBadges } from "@/db/schema"
import { eq, lt, and, isNotNull } from "drizzle-orm"

export interface CheckSubscriptionsResult {
    success: boolean
    cafeSubscriptions: {
        processed: number
        total: number
    }
    supporters: {
        expired: number
        total: number
    }
    errors?: string[]
}

/**
 * Check for expired subscriptions (cafe and supporter)
 * Returns a result object with counts and any errors
 */
export async function checkSubscriptions(): Promise<CheckSubscriptionsResult> {
    const now = new Date()
    const errors: string[] = []

    // Find all active subscriptions that have expired
    const expiredSubscriptions = await db
        .select({
            id: cafeSubscriptions.id,
            cafeId: cafeSubscriptions.cafeId,
            tier: cafeSubscriptions.tier,
            currentPeriodEnd: cafeSubscriptions.currentPeriodEnd,
            cafeName: cafes.name,
            cafeSlug: cafes.slug,
        })
        .from(cafeSubscriptions)
        .leftJoin(cafes, eq(cafeSubscriptions.cafeId, cafes.id))
        .where(
            and(
                eq(cafeSubscriptions.status, "active"),
                lt(cafeSubscriptions.currentPeriodEnd, now)
            )
        )

    console.log(`Found ${expiredSubscriptions.length} expired subscription(s)`)

    let processedCount = 0

    // Process each expired subscription
    for (const subscription of expiredSubscriptions) {
        try {
            // Update subscription status to cancelled
            await db
                .update(cafeSubscriptions)
                .set({
                    status: "cancelled",
                    updatedAt: new Date(),
                })
                .where(eq(cafeSubscriptions.id, subscription.id))

            // Downgrade cafe to free tier and remove verified badge
            await db
                .update(cafes)
                .set({
                    membershipTier: "free",
                    isVerified: false,
                    updatedAt: new Date(),
                })
                .where(eq(cafes.id, subscription.cafeId))

            console.log(`Expired subscription processed for cafe: ${subscription.cafeName || subscription.cafeId}`)
            processedCount++
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Unknown error"
            errors.push(`Subscription ${subscription.id}: ${errorMessage}`)
            console.error(`Error processing subscription ${subscription.id}:`, err)
        }
    }

    // ============================================
    // Check for expired supporters
    // ============================================

    let expiredSupportersCount = 0

    // Find supporters whose expiry has passed (null = lifetime, never expires)
    const expiredSupporters = await db
        .select({
            id: profiles.id,
            displayName: profiles.displayName,
            supporterExpiresAt: profiles.supporterExpiresAt,
        })
        .from(profiles)
        .where(
            and(
                eq(profiles.isSupporter, true),
                isNotNull(profiles.supporterExpiresAt),
                lt(profiles.supporterExpiresAt, now)
            )
        )

    if (expiredSupporters && expiredSupporters.length > 0) {
        console.log(`Found ${expiredSupporters.length} expired supporter(s)`)

        // Get the supporter badge ID
        const badgeResult = await db
            .select({ id: badgeDefinitions.id })
            .from(badgeDefinitions)
            .where(eq(badgeDefinitions.name, "Grounds Supporter"))
            .limit(1)

        const supporterBadgeId = badgeResult[0]?.id

        for (const supporter of expiredSupporters) {
            try {
                // Remove supporter status
                await db
                    .update(profiles)
                    .set({ isSupporter: false })
                    .where(eq(profiles.id, supporter.id))

                // Remove the supporter badge if exists
                if (supporterBadgeId) {
                    await db
                        .delete(userBadges)
                        .where(
                            and(
                                eq(userBadges.userId, supporter.id),
                                eq(userBadges.badgeId, supporterBadgeId)
                            )
                        )
                }

                console.log(`Expired supporter status for: ${supporter.displayName || supporter.id}`)
                expiredSupportersCount++
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "Unknown error"
                errors.push(`Supporter ${supporter.id}: ${errorMessage}`)
                console.error(`Error expiring supporter ${supporter.id}:`, err)
            }
        }
    }

    return {
        success: true,
        cafeSubscriptions: {
            processed: processedCount,
            total: expiredSubscriptions.length,
        },
        supporters: {
            expired: expiredSupportersCount,
            total: expiredSupporters?.length ?? 0,
        },
        errors: errors.length > 0 ? errors : undefined,
    }
}
