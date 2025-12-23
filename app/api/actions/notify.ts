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