import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

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

        const adminDb = await createAdminClient()
        const now = new Date().toISOString()

        // Find all active subscriptions that have expired
        const { data: expiredSubscriptions, error: fetchError } = await adminDb
            .from('cafe_subscriptions')
            .select(`
                id,
                cafe_id,
                tier,
                current_period_end,
                cafes:cafe_id (
                    id,
                    name,
                    slug
                )
            `)
            .eq('status', 'active')
            .lt('current_period_end', now)

        if (fetchError) {
            console.error('Error fetching expired subscriptions:', fetchError)
            return NextResponse.json(
                { error: 'Failed to fetch subscriptions' },
                { status: 500 }
            )
        }

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
                const { error: subError } = await adminDb
                    .from('cafe_subscriptions')
                    .update({
                        status: 'cancelled',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', subscription.id)

                if (subError) {
                    throw new Error(`Failed to update subscription: ${subError.message}`)
                }

                // Downgrade cafe to free tier and remove verified badge
                const { error: cafeError } = await adminDb
                    .from('cafes')
                    .update({
                        membership_tier: 'free',
                        is_verified: false,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', subscription.cafe_id)

                if (cafeError) {
                    throw new Error(`Failed to update cafe: ${cafeError.message}`)
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const cafe = subscription.cafes as any
                console.log(`Expired subscription processed for cafe: ${cafe?.name || subscription.cafe_id}`)
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
        const { data: expiredSupporters, error: supporterFetchError } = await adminDb
            .from('profiles')
            .select('id, display_name, supporter_expires_at')
            .eq('is_supporter', true)
            .not('supporter_expires_at', 'is', null)
            .lt('supporter_expires_at', now)

        if (supporterFetchError) {
            console.error('Error fetching expired supporters:', supporterFetchError)
        } else if (expiredSupporters && expiredSupporters.length > 0) {
            console.log(`Found ${expiredSupporters.length} expired supporter(s)`)

            for (const supporter of expiredSupporters) {
                try {
                    // Remove supporter status
                    const { error: updateError } = await adminDb
                        .from('profiles')
                        .update({
                            is_supporter: false,
                            // Keep supporter_expires_at for history
                        })
                        .eq('id', supporter.id)

                    if (updateError) throw updateError

                    // Remove the supporter badge
                    // First get the badge ID
                    const { data: badge } = await adminDb
                        .from('badge_definitions')
                        .select('id')
                        .eq('name', 'Grounds Supporter')
                        .single()

                    if (badge) {
                        await adminDb
                            .from('user_badges')
                            .delete()
                            .eq('user_id', supporter.id)
                            .eq('badge_id', badge.id)
                    }

                    console.log(`Expired supporter status for: ${supporter.display_name || supporter.id}`)
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
