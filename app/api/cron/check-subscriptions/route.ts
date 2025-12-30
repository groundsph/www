import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { cafes, cafeSubscriptions, profiles, badgeDefinitions, userBadges } from '@/db/schema'
import { eq, lt, and, isNotNull } from 'drizzle-orm'

/**
 * Cron Job: Check Expired Subscriptions
 * 
 * This endpoint should be called daily by Dokploy or any cron service.
 * It checks for subscriptions that have passed their expiration date
 * and downgrades the associated cafes to the free tier.
 * 
 * Security: Requires CRON_SECRET to be passed in Authorization header
 */
export async function GET(request: NextRequest) {
    try {
        // Verify cron secret
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET

        if (!cronSecret) {
            console.error('CRON_SECRET not configured')
            return NextResponse.json(
                { error: 'Server configuration error' },
                { status: 500 }
            )
        }

        // Support both "Bearer <token>" and plain token
        const token = authHeader?.startsWith('Bearer ')
            ? authHeader.slice(7)
            : authHeader

        if (token !== cronSecret) {
            console.error('Invalid cron secret provided')
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        const now = new Date()

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
                    eq(cafeSubscriptions.status, 'active'),
                    lt(cafeSubscriptions.currentPeriodEnd, now)
                )
            )

        if (!expiredSubscriptions || expiredSubscriptions.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No expired subscriptions found',
                processed: 0
            })
        }

        console.log(`Found ${expiredSubscriptions.length} expired subscription(s)`)

        let processedCount = 0
        const errors: string[] = []

        // Process each expired subscription
        for (const subscription of expiredSubscriptions) {
            try {
                // Update subscription status to cancelled
                await db
                    .update(cafeSubscriptions)
                    .set({
                        status: 'cancelled',
                        updatedAt: new Date(),
                    })
                    .where(eq(cafeSubscriptions.id, subscription.id))

                // Downgrade cafe to free tier and remove verified badge
                await db
                    .update(cafes)
                    .set({
                        membershipTier: 'free',
                        isVerified: false,
                        updatedAt: new Date(),
                    })
                    .where(eq(cafes.id, subscription.cafeId))

                console.log(`Expired subscription processed for cafe: ${subscription.cafeName || subscription.cafeId}`)
                processedCount++

            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Unknown error'
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
                supporterExpiresAt: profiles.supporterExpiresAt
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
                .where(eq(badgeDefinitions.name, 'Grounds Supporter'))
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
                    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
                    errors.push(`Supporter ${supporter.id}: ${errorMessage}`)
                    console.error(`Error expiring supporter ${supporter.id}:`, err)
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: `Processed ${processedCount} expired subscription(s), ${expiredSupportersCount} expired supporter(s)`,
            cafeSubscriptions: {
                processed: processedCount,
                total: expiredSubscriptions.length,
            },
            supporters: {
                expired: expiredSupportersCount,
                total: expiredSupporters?.length ?? 0,
            },
            errors: errors.length > 0 ? errors : undefined
        })

    } catch (error) {
        console.error('Cron job error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
