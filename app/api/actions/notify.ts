'use server'

interface NotifyResult {
    success: boolean
    message: string
}

/**
 * Notify Discord about a new cafe submission with a rich embed
 */
export async function notifyDiscord(
    name: string,
    location: string,
    submitter?: string
): Promise<NotifyResult> {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL
    if (!webhookUrl) {
        console.warn('Discord webhook URL not configured')
        return { success: false, message: 'Webhook not configured' }
    }

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    title: "☕ New Cafe Submission",
                    description: "A new cafe has been submitted for review!",
                    color: 0x7c3aed, // Purple brand color
                    fields: [
                        {
                            name: "Cafe Name",
                            value: name,
                            inline: true
                        },
                        {
                            name: "Location",
                            value: location,
                            inline: true
                        },
                        {
                            name: "Submitted By",
                            value: submitter || "Anonymous Scout",
                            inline: true
                        },
                    ],
                    footer: {
                        text: "Grounds • Cafe Submission"
                    },
                    timestamp: new Date().toISOString()
                }]
            }),
        })

        if (!response.ok) {
            console.error('Discord webhook failed:', response.status)
            return {
                success: false,
                message: 'Failed to notify Discord',
            }
        }

        return {
            success: true,
            message: 'Cafe Submission Notified',
        }
    } catch (error) {
        console.error('Discord notification error:', error)
        return {
            success: false,
            message: 'Error sending notification',
        }
    }
}

/**
 * Notify Discord about a reported review
 */
export async function notifyDiscordReviewReport(
    reviewId: string,
    cafeInfo: { name: string; slug: string },
    reportCount: number,
    reporterName?: string
): Promise<NotifyResult> {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL
    if (!webhookUrl) {
        console.warn('Discord webhook URL not configured')
        return { success: false, message: 'Webhook not configured' }
    }

    try {
        const cafeUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://grounds.cafe'}/cafes/${cafeInfo.slug}`

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    title: "🚩 Review Reported",
                    description: "A review has been flagged for moderation.",
                    color: 0xef4444, // Red warning color
                    fields: [
                        {
                            name: "Cafe",
                            value: `[${cafeInfo.name}](${cafeUrl})`,
                            inline: true
                        },
                        {
                            name: "Total Reports",
                            value: reportCount.toString(),
                            inline: true
                        },
                        {
                            name: "Reported By",
                            value: reporterName || "Anonymous User",
                            inline: true
                        },
                    ],
                    footer: {
                        text: "Grounds • Review Report"
                    },
                    timestamp: new Date().toISOString()
                }]
            }),
        })

        if (!response.ok) {
            console.error('Discord webhook failed:', response.status)
            return {
                success: false,
                message: 'Failed to notify Discord',
            }
        }

        return {
            success: true,
            message: 'Review Report Notified',
        }
    } catch (error) {
        console.error('Discord notification error:', error)
        return {
            success: false,
            message: 'Error sending notification',
        }
    }
}

/**
 * Notify Discord about a new edit suggestion
 */
export async function notifyDiscordEditSuggestion(
    cafeInfo: { name: string; slug: string },
    suggestedFields: string[],
    submitterName?: string
): Promise<NotifyResult> {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL
    if (!webhookUrl) {
        console.warn('Discord webhook URL not configured')
        return { success: false, message: 'Webhook not configured' }
    }

    try {
        const cafeUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://grounds.cafe'}/cafes/${cafeInfo.slug}`

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    title: "✏️ New Edit Suggestion",
                    description: "A user has suggested edits for a cafe.",
                    color: 0xf59e0b, // Amber color
                    fields: [
                        {
                            name: "Cafe",
                            value: `[${cafeInfo.name}](${cafeUrl})`,
                            inline: true
                        },
                        {
                            name: "Suggested By",
                            value: submitterName || "Anonymous User",
                            inline: true
                        },
                        {
                            name: "Fields Changed",
                            value: suggestedFields.length > 0
                                ? suggestedFields.slice(0, 10).join(", ") + (suggestedFields.length > 10 ? "..." : "")
                                : "Image changes",
                            inline: false
                        },
                    ],
                    footer: {
                        text: "Grounds • Edit Suggestion"
                    },
                    timestamp: new Date().toISOString()
                }]
            }),
        })

        if (!response.ok) {
            console.error('Discord webhook failed:', response.status)
            return {
                success: false,
                message: 'Failed to notify Discord',
            }
        }

        return {
            success: true,
            message: 'Edit Suggestion Notified',
        }
    } catch (error) {
        console.error('Discord notification error:', error)
        return {
            success: false,
            message: 'Error sending notification',
        }
    }
}