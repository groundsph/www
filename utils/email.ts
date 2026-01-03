import { Resend } from "resend"
import PasswordResetEmail from "@/emails/PasswordResetEmail"
import CafeApprovedEmail from "@/emails/CafeApprovedEmail"
import CafeRejectedEmail from "@/emails/CafeRejectedEmail"
import SuggestionApprovedEmail from "@/emails/SuggestionApprovedEmail"
import SuggestionRejectedEmail from "@/emails/SuggestionRejectedEmail"
import SubscriptionApprovedEmail from "@/emails/SubscriptionApprovedEmail"
import SubscriptionRejectedEmail from "@/emails/SubscriptionRejectedEmail"
import EventApprovedEmail from "@/emails/EventApprovedEmail"
import EventRejectedEmail from "@/emails/EventRejectedEmail"

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY)

// Email sender
const FROM_EMAIL = "Grounds <noreply@grounds.ph>"

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

/**
 * Send a cafe approval notification email
 */
export async function sendCafeApprovedEmail(
    to: string,
    cafeName: string,
    cafeSlug: string,
    submitterName?: string
) {
    try {
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to,
            subject: `🎉 Your cafe "${cafeName}" has been approved!`,
            react: CafeApprovedEmail({ cafeName, cafeSlug, submitterName }),
        })

        if (error) {
            console.error("Failed to send cafe approved email:", error)
            return { success: false, error: error.message }
        }

        return { success: true, messageId: data?.id }
    } catch (err) {
        console.error("Error sending cafe approved email:", err)
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}

/**
 * Send a cafe rejection notification email
 */
export async function sendCafeRejectedEmail(
    to: string,
    cafeName: string,
    submitterName?: string,
    reason?: string
) {
    try {
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to,
            subject: `Update on your cafe submission "${cafeName}"`,
            react: CafeRejectedEmail({ cafeName, submitterName, reason }),
        })

        if (error) {
            console.error("Failed to send cafe rejected email:", error)
            return { success: false, error: error.message }
        }

        return { success: true, messageId: data?.id }
    } catch (err) {
        console.error("Error sending cafe rejected email:", err)
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}

/**
 * Send a suggestion approval notification email
 */
export async function sendSuggestionApprovedEmail(
    to: string,
    cafeName: string,
    cafeSlug: string,
    submitterName?: string
) {
    try {
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to,
            subject: `✨ Your edit for "${cafeName}" has been approved!`,
            react: SuggestionApprovedEmail({ cafeName, cafeSlug, submitterName }),
        })

        if (error) {
            console.error("Failed to send suggestion approved email:", error)
            return { success: false, error: error.message }
        }

        return { success: true, messageId: data?.id }
    } catch (err) {
        console.error("Error sending suggestion approved email:", err)
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}

/**
 * Send a suggestion rejection notification email
 */
export async function sendSuggestionRejectedEmail(
    to: string,
    cafeName: string,
    submitterName?: string,
    reason?: string
) {
    try {
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to,
            subject: `Update on your suggested edit for "${cafeName}"`,
            react: SuggestionRejectedEmail({ cafeName, submitterName, reason }),
        })

        if (error) {
            console.error("Failed to send suggestion rejected email:", error)
            return { success: false, error: error.message }
        }

        return { success: true, messageId: data?.id }
    } catch (err) {
        console.error("Error sending suggestion rejected email:", err)
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}

/**
 * Send a subscription approval notification email
 */
export async function sendSubscriptionApprovedEmail(
    to: string,
    cafeName: string,
    cafeSlug: string,
    tier: "Pro" | "Premium",
    ownerName?: string
) {
    try {
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to,
            subject: `🎉 Your ${tier} subscription for "${cafeName}" is active!`,
            react: SubscriptionApprovedEmail({ cafeName, cafeSlug, tier, ownerName }),
        })

        if (error) {
            console.error("Failed to send subscription approved email:", error)
            return { success: false, error: error.message }
        }

        return { success: true, messageId: data?.id }
    } catch (err) {
        console.error("Error sending subscription approved email:", err)
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}

/**
 * Send a subscription rejection notification email
 */
export async function sendSubscriptionRejectedEmail(
    to: string,
    cafeName: string,
    tier: "Pro" | "Premium",
    ownerName?: string,
    reason?: string
) {
    try {
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to,
            subject: `Update on your ${tier} subscription for "${cafeName}"`,
            react: SubscriptionRejectedEmail({ cafeName, tier, ownerName, reason }),
        })

        if (error) {
            console.error("Failed to send subscription rejected email:", error)
            return { success: false, error: error.message }
        }

        return { success: true, messageId: data?.id }
    } catch (err) {
        console.error("Error sending subscription rejected email:", err)
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}

/**
 * Send an event approval notification email
 */
export async function sendEventApprovedEmail(
    to: string,
    eventTitle: string,
    submitterName?: string
) {
    try {
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to,
            subject: `🎉 Your event "${eventTitle}" has been approved!`,
            react: EventApprovedEmail({ eventTitle, submitterName }),
        })

        if (error) {
            console.error("Failed to send event approved email:", error)
            return { success: false, error: error.message }
        }

        return { success: true, messageId: data?.id }
    } catch (err) {
        console.error("Error sending event approved email:", err)
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}

/**
 * Send an event rejection notification email
 */
export async function sendEventRejectedEmail(
    to: string,
    eventTitle: string,
    submitterName?: string,
    reason?: string
) {
    try {
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to,
            subject: `Update on your event submission "${eventTitle}"`,
            react: EventRejectedEmail({ eventTitle, submitterName, reason }),
        })

        if (error) {
            console.error("Failed to send event rejected email:", error)
            return { success: false, error: error.message }
        }

        return { success: true, messageId: data?.id }
    } catch (err) {
        console.error("Error sending event rejected email:", err)
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}
