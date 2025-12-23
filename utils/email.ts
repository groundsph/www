import { Resend } from "resend"
import PasswordResetEmail from "@/emails/PasswordResetEmail"

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY)

// Email sender - uses ranlabs.space for dev, grounds.ph for prod
const FROM_EMAIL =
    process.env.NODE_ENV === "production"
        ? "Grounds <noreply@grounds.ph>"
        : "Grounds <noreply@ranlabs.space>"

/**
 * Send a password reset email to a user
 */
export async function sendPasswordResetEmail(to: string, resetUrl: string) {
    try {
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to,
            subject: "Reset Your Grounds Password",
            react: PasswordResetEmail({ resetUrl, email: to }),
        })

        if (error) {
            console.error("Failed to send password reset email:", error)
            return { success: false, error: error.message }
        }

        return { success: true, messageId: data?.id }
    } catch (err) {
        console.error("Error sending password reset email:", err)
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}
