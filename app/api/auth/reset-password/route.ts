import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { sendPasswordResetEmail } from "@/utils/email"

export async function POST(request: NextRequest) {
    try {
        const { email } = await request.json()

        if (!email) {
            return NextResponse.json(
                { error: "Email is required" },
                { status: 400 }
            )
        }

        const supabase = await createAdminClient()

        // Use admin API to generate reset link WITHOUT sending Supabase's email
        const { data, error } = await supabase.auth.admin.generateLink({
            type: "recovery",
            email,
            options: {
                redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin}/auth/reset-password`,
            },
        })

        if (error) {
            console.error("Supabase generate link error:", error)
            // Don't reveal whether email exists - return generic success
            return NextResponse.json({
                success: true,
                message:
                    "If an account with that email exists, a password reset link has been sent.",
            })
        }

        // Send custom email via Resend
        if (data?.properties?.action_link) {
            const emailResult = await sendPasswordResetEmail(
                email,
                data.properties.action_link
            )

            if (!emailResult.success) {
                console.error("Failed to send email via Resend:", emailResult.error)
            }
        }

        return NextResponse.json({
            success: true,
            message:
                "If an account with that email exists, a password reset link has been sent.",
        })
    } catch (err) {
        console.error("Password reset error:", err)
        return NextResponse.json(
            { error: "Failed to process password reset request" },
            { status: 500 }
        )
    }
}
