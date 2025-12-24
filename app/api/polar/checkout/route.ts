import { NextRequest, NextResponse } from "next/server"
import { polar } from "@/utils/polar"
import { createClient } from "@/utils/supabase/server"

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()

        // Get current user for pre-filling email
        const { data: { user } } = await supabase.auth.getUser()

        // Build checkout options
        const checkoutOptions: Parameters<typeof polar.checkouts.create>[0] = {
            products: [process.env.POLAR_PRODUCT_ID!],
            successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/donate?success=true`,
        }

        // Add customer email if available
        if (user?.email) {
            checkoutOptions.customerEmail = user.email
        }

        // Add userId to metadata if user is logged in
        if (user?.id) {
            checkoutOptions.metadata = {
                userId: user.id,
            }
        }

        // Create checkout session
        const checkout = await polar.checkouts.create(checkoutOptions)

        return NextResponse.json({
            url: checkout.url
        })
    } catch (error) {
        console.error("Failed to create checkout:", error)
        return NextResponse.json(
            { error: "Failed to create checkout session" },
            { status: 500 }
        )
    }
}
