/**
 * Discord webhook utility for admin notifications
 */

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL

export interface DiscordEmbed {
    title?: string
    description?: string
    color?: number // Decimal color code
    fields?: { name: string; value: string; inline?: boolean }[]
    footer?: { text: string }
    timestamp?: string
}

/**
 * Send a notification to Discord via webhook
 */
export async function sendDiscordNotification(
    content?: string,
    embeds?: DiscordEmbed[]
): Promise<{ success: boolean; error?: string }> {
    if (!DISCORD_WEBHOOK_URL) {
        console.warn("Discord webhook URL not configured")
        return { success: false, error: "Discord webhook not configured" }
    }

    try {
        const response = await fetch(DISCORD_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                content,
                embeds,
            }),
        })

        if (!response.ok) {
            console.error("Discord webhook failed:", response.status)
            return { success: false, error: `Webhook failed: ${response.status}` }
        }

        return { success: true }
    } catch (error) {
        console.error("Error sending Discord notification:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        }
    }
}

/**
 * Notify admin about a new subscription payment submission
 */
export async function notifySubscriptionSubmission(
    cafeName: string,
    cafeSlug: string,
    tier: "Pro" | "Premium",
    ownerName?: string
): Promise<void> {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://grounds.ph"

    await sendDiscordNotification(undefined, [
        {
            title: "💳 New Subscription Payment Submitted",
            description: `A cafe owner has submitted a payment for verification.`,
            color: 0x74512d, // Grounds primary color
            fields: [
                { name: "Cafe", value: `[${cafeName}](${siteUrl}/cafes/${cafeSlug})`, inline: true },
                { name: "Tier", value: tier, inline: true },
                { name: "Owner", value: ownerName || "Unknown", inline: true },
            ],
            footer: { text: "Check the admin dashboard to verify" },
            timestamp: new Date().toISOString(),
        },
    ])
}
