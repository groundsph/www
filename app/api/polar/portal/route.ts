import { NextResponse } from "next/server"
import { polar } from "@/utils/polar"
import { createClient } from "@/utils/supabase/server"

export async function POST() {
    try {
        const supabase = await createClient()

        // Get current user
        const { data: { user } } = await supabase.auth.getUser()

        if (!user?.email) {
            return NextResponse.json(
                { error: "You must be logged in to access the customer portal" },
                { status: 401 }
            )
        }

        // Find the customer in Polar by email
        const customers = await polar.customers.list({
            email: user.email,
        })

        if (customers.result.items.length === 0) {
            return NextResponse.json(
                { error: "No subscription found for your account" },
                { status: 404 }
            )
        }

        // Create customer portal session
        const session = await polar.customerSessions.create({
            customerId: customers.result.items[0].id,
        })

        return NextResponse.json({
            url: session.customerPortalUrl
        })
    } catch (error) {
        console.error("Failed to create customer portal session:", error)
        return NextResponse.json(
            { error: "Failed to create portal session" },
            { status: 500 }
        )
    }
}
