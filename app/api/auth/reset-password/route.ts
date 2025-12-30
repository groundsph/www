import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

export async function POST(request: NextRequest) {
    try {
        const { email } = await request.json()

        if (!email) {
            return NextResponse.json(
                { error: "Email is required" },
                { status: 400 }
            )
        }

        // Use Better Auth to send password reset via forgetPassword endpoint
        try {
            // @ts-expect-error - forgetPassword exists at runtime but is missing from inferred types
            const response = await auth.api.forgetPassword({
                body: {
                    email,
                    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
                },
                headers: await headers(),
            })

            if (!response) {
                // User might not exist, but we don't reveal that
                console.log('[Reset Password] No response from forgetPassword for:', email)
            }
        } catch (resetError) {
            // Log but don't expose the error - this is expected if email doesn't exist
            console.error('[Reset Password] Better Auth error:', resetError)
        }

        // Always return success to prevent email enumeration
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
