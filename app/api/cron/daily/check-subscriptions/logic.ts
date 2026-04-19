import { db } from "@/db"
import { profiles, badgeDefinitions, userBadges } from "@/db/schema"
import { eq, lt, and, isNotNull } from "drizzle-orm"

export interface CheckSubscriptionsResult {
    success: boolean
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
        supporters: {
            expired: expiredSupportersCount,
            total: expiredSupporters?.length ?? 0,
        },
        errors: errors.length > 0 ? errors : undefined,
    }
}
