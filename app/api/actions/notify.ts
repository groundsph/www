'use server'

export async function notifyDiscord(name: string, region: string) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL
    if (!webhookUrl) return

    const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            content: `🚀 **New Cafe Scouted!** \n**Name:** ${name} \n**Region:** ${region}`,
        }),
    })

    if (!response.ok) {
        return {
            success: false,
            message: 'Failed to notify',
        }
    }

    return {
        success: true,
        message: 'Cafe Submission Notified',
    }
}