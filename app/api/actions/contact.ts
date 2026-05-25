"use server"

import { Resend } from "resend"
import ContactEmail from "@/emails/ContactEmail"

const resend = new Resend(process.env.RESEND_API_KEY)

interface ContactFormData {
    name: string
    email: string
    subject: string
    message: string
}

export async function sendContactEmail(data: ContactFormData): Promise<{
    success: boolean
    error?: string
}> {
    const { name, email, subject, message } = data

    // Validation
    if (!name || name.trim().length < 2) {
        return { success: false, error: "Please enter a valid name" }
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { success: false, error: "Please enter a valid email address" }
    }

    if (!subject || subject.trim().length < 3) {
        return { success: false, error: "Please enter a subject" }
    }

    if (!message || message.trim().length < 10) {
        return {
            success: false,
            error: "Message must be at least 10 characters",
        }
    }

    try {
        const { error } = await resend.emails.send({
            from: "GroundsPH Contact <contact@grounds.ph>",
            to: "adrianbonpin@gmail.com",
            replyTo: email,
            subject: `[GroundsPH Contact] ${subject}`,
            react: ContactEmail({
                name: name.trim(),
                email: email.trim(),
                subject: subject.trim(),
                message: message.trim(),
            }),
        })

        if (error) {
            console.error("Resend error:", error)
            return {
                success: false,
                error: "Failed to send message. Please try again later.",
            }
        }

        return { success: true }
    } catch (err) {
        console.error("Contact form error:", err)
        return {
            success: false,
            error: "An unexpected error occurred. Please try again later.",
        }
    }
}
