import { NextRequest, NextResponse } from "next/server"
import {
    validateEvent,
    WebhookVerificationError
} from "@polar-sh/sdk/webhooks"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/utils/types/database.types"
import type { User } from "@supabase/supabase-js"

// Lazy initialize to avoid build-time errors
function getSupabaseAdmin() {
    return createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

export async function POST(request: NextRequest) {
    const body = await request.text()
    const headers = Object.fromEntries(request.headers.entries())
    const supabaseAdmin = getSupabaseAdmin()

    let event
    try {
        event = validateEvent(
            body,
            headers,
            process.env.POLAR_WEBHOOK_SECRET!
        )
    } catch (error) {
        if (error instanceof WebhookVerificationError) {
            console.error("Webhook verification failed:", error.message)
            return NextResponse.json(
                { error: "Invalid webhook signature" },
                { status: 403 }
            )
        }
        throw error
    }

    console.log(`Received Polar webhook: ${event.type}`)

    try {
        switch (event.type) {
            case "subscription.created":
            case "subscription.active": {
                const subscription = event.data
                const customerEmail = subscription.customer?.email
                const userId = subscription.metadata?.userId as string | undefined

                if (!customerEmail && !userId) {
                    console.error("No customer email or userId in subscription")
                    break
                }

                // Find user by userId (from metadata) or email
                let profileId: string | undefined

                if (userId) {
                    profileId = userId
                } else if (customerEmail) {
                    // Look up user by email in auth.users using listUsers with filter
                    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
                    const authUser = users.find((u: User) => u.email === customerEmail)
                    if (!authUser) {
                        console.error(`No user found with email: ${customerEmail}`)
                        break
                    }
                    profileId = authUser.id
                }

                if (!profileId) {
                    console.error("No profile found for subscription customer")
                    break
                }

                // Update supporter status
                const { error: updateError } = await supabaseAdmin
                    .from("profiles")
                    .update({
                        is_supporter: true,
                        support_since: new Date().toISOString(),
                    })
                    .eq("id", profileId)

                if (updateError) {
                    console.error("Failed to update supporter status:", updateError)
                } else {
                    console.log(`User ${profileId} is now a supporter!`)

                    // Award supporter badge if one exists
                    await awardSupporterBadge(supabaseAdmin, profileId)
                }
                break
            }

            case "subscription.canceled":
            case "subscription.revoked": {
                const subscription = event.data
                const customerEmail = subscription.customer?.email
                const userId = subscription.metadata?.userId as string | undefined

                if (!customerEmail && !userId) {
                    console.error("No customer email or userId in subscription")
                    break
                }

                // Find user
                let profileId: string | undefined

                if (userId) {
                    profileId = userId
                } else if (customerEmail) {
                    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
                    const authUser = users.find((u: User) => u.email === customerEmail)
                    profileId = authUser?.id
                }

                if (!profileId) {
                    console.error("Could not find user for canceled subscription")
                    break
                }

                // Remove supporter status (but keep support_since for records)
                const { error: updateError } = await supabaseAdmin
                    .from("profiles")
                    .update({ is_supporter: false })
                    .eq("id", profileId)

                if (updateError) {
                    console.error("Failed to update supporter status:", updateError)
                } else {
                    console.log(`User ${profileId} supporter status removed`)
                }
                break
            }

            case "subscription.updated": {
                const subscription = event.data
                const isActive = subscription.status === "active"
                const userId = subscription.metadata?.userId as string | undefined
                const customerEmail = subscription.customer?.email

                let profileId: string | undefined

                if (userId) {
                    profileId = userId
                } else if (customerEmail) {
                    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
                    const authUser = users.find((u: User) => u.email === customerEmail)
                    profileId = authUser?.id
                }

                if (profileId) {
                    await supabaseAdmin
                        .from("profiles")
                        .update({ is_supporter: isActive })
                        .eq("id", profileId)

                    console.log(`User ${profileId} supporter status updated to: ${isActive}`)
                }
                break
            }

            default:
                console.log(`Unhandled event type: ${event.type}`)
        }

        return NextResponse.json({ received: true })
    } catch (error) {
        console.error("Error processing webhook:", error)
        return NextResponse.json(
            { error: "Webhook processing failed" },
            { status: 500 }
        )
    }
}

async function awardSupporterBadge(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>, userId: string) {
    // Find "Supporter" badge
    const { data: badge } = await supabaseAdmin
        .from("badge_definitions")
        .select("id")
        .eq("category", "monetary")
        .single()

    if (!badge) {
        console.log("No monetary badge found to award")
        return
    }

    // Check if user already has badge
    const { data: existingBadge } = await supabaseAdmin
        .from("user_badges")
        .select("id")
        .eq("user_id", userId)
        .eq("badge_id", badge.id)
        .single()

    if (existingBadge) {
        console.log("User already has supporter badge")
        return
    }

    // Award badge
    const { error } = await supabaseAdmin
        .from("user_badges")
        .insert({
            user_id: userId,
            badge_id: badge.id,
        })

    if (error) {
        console.error("Failed to award supporter badge:", error)
    } else {
        console.log(`Awarded supporter badge to user ${userId}`)
    }
}
