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

/**
 * Notify Discord about a new cafe ownership claim
 */
export async function notifyDiscordCafeClaim(
    cafeInfo: { name: string; slug: string },
    claimantName: string,
    proofSummary: string
): Promise<NotifyResult> {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL
    if (!webhookUrl) {
        console.warn('Discord webhook URL not configured')
        return { success: false, message: 'Webhook not configured' }
    }

    try {
        const cafeUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://grounds.ph'}/cafes/${cafeInfo.slug}`
        const adminUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://grounds.ph'}/admin`

        // Truncate proof to reasonable length
        const truncatedProof = proofSummary.length > 200
            ? proofSummary.substring(0, 200) + '...'
            : proofSummary

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    title: "🏪 New Cafe Claim Request",
                    description: "A user is claiming ownership of a cafe.",
                    color: 0x8b5cf6, // Purple color
                    fields: [
                        {
                            name: "Cafe",
                            value: `[${cafeInfo.name}](${cafeUrl})`,
                            inline: true
                        },
                        {
                            name: "Claimed By",
                            value: claimantName,
                            inline: true
                        },
                        {
                            name: "Proof Summary",
                            value: truncatedProof || "No proof provided",
                            inline: false
                        },
                        {
                            name: "Action Required",
                            value: `[Review in Admin Dashboard](${adminUrl})`,
                            inline: false
                        },
                    ],
                    footer: {
                        text: "Grounds • Cafe Claim"
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
            message: 'Cafe Claim Notified',
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
 * Notify Discord about a reported blog post
 */
export async function notifyDiscordBlogReport(
    blogInfo: { title: string; slug: string },
    reason: string,
    reporterName?: string
): Promise<NotifyResult> {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL
    if (!webhookUrl) {
        console.warn('Discord webhook URL not configured')
        return { success: false, message: 'Webhook not configured' }
    }

    try {
        const blogUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://grounds.ph'}/blog/${blogInfo.slug}`
        const adminUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://grounds.ph'}/manage/content`

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    title: "🚩 Blog Post Reported",
                    description: "A blog post has been flagged for moderation.",
                    color: 0xef4444, // Red warning color
                    fields: [
                        {
                            name: "Blog Post",
                            value: `[${blogInfo.title}](${blogUrl})`,
                            inline: false
                        },
                        {
                            name: "Reason",
                            value: reason,
                            inline: true
                        },
                        {
                            name: "Reported By",
                            value: reporterName || "Anonymous User",
                            inline: true
                        },
                        {
                            name: "Action Required",
                            value: `[Process in Admin Dashboard](${adminUrl})`,
                            inline: false
                        },
                    ],
                    footer: {
                        text: "Grounds • Blog Report"
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
            message: 'Blog Report Notified',
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
 * Notify Discord about a new community event submission
 */
export async function notifyDiscordEventSubmission(
    eventInfo: { title: string; location: string; startDate: string },
    submitterName?: string
): Promise<NotifyResult> {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL
    if (!webhookUrl) {
        console.warn('Discord webhook URL not configured')
        return { success: false, message: 'Webhook not configured' }
    }

    try {
        const adminUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://grounds.ph'}/manage/community`

        const formattedDate = new Date(eventInfo.startDate).toLocaleDateString('en-PH', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        })

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    title: "📅 New Event Submission",
                    description: "A community event has been submitted for review.",
                    color: 0xf59e0b, // Orange/amber color for events
                    fields: [
                        {
                            name: "Event",
                            value: eventInfo.title,
                            inline: true
                        },
                        {
                            name: "Location",
                            value: eventInfo.location,
                            inline: true
                        },
                        {
                            name: "Date",
                            value: formattedDate,
                            inline: false
                        },
                        {
                            name: "Submitted By",
                            value: submitterName || "Anonymous User",
                            inline: true
                        },
                        {
                            name: "Action Required",
                            value: `[Review in Community Management](${adminUrl})`,
                            inline: false
                        },
                    ],
                    footer: {
                        text: "Grounds • Event Submission"
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
            message: 'Event Submission Notified',
        }
    } catch (error) {
        console.error('Discord notification error:', error)
        return {
            success: false,
            message: 'Error sending notification',
        }
    }
}

// Module-level rate limiter
let lastCriticalNotification = 0
const CRITICAL_COOLDOWN_MS = 5000 // 5 seconds

/**
 * Notify Discord about a critical error that needs immediate attention.
 * Uses the same DISCORD_WEBHOOK_URL but with red embed + ⚠️ prefix.
 * FIRE-AND-FORGET: failures here must NOT cascade to the caller.
 * Rate-limited: at most one notification per 5 seconds.
 */
export async function notifyDiscordCritical(
    title: string,
    description: string,
    errorContext: {
        cafeName?: string
        submitterId?: string
        errorMessage: string
        errorStack?: string
        failedStep: string
    }
): Promise<void> {
    const now = Date.now()
    if (now - lastCriticalNotification < CRITICAL_COOLDOWN_MS) {
        console.warn("[Critical] Rate limited — skipping duplicate notification")
        return
    }
    lastCriticalNotification = now

    const webhookUrl = process.env.DISCORD_WEBHOOK_URL
    if (!webhookUrl) {
        console.warn("[Critical] Discord webhook URL not configured")
        return
    }

    const stackSnippet = errorContext.errorStack
        ? errorContext.errorStack.slice(0, 1000)
        : "No stack trace"

    try {
        await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                embeds: [{
                    title: `⚠️ CRITICAL: ${title}`,
                    description: description,
                    color: 0xef4444,
                    fields: [
                        {
                            name: "Error Message",
                            value: errorContext.errorMessage.slice(0, 1024),
                            inline: false,
                        },
                        {
                            name: "Failed Step",
                            value: errorContext.failedStep,
                            inline: true,
                        },
                        {
                            name: "Cafe Name",
                            value: errorContext.cafeName || "N/A",
                            inline: true,
                        },
                        {
                            name: "Submitter ID",
                            value: errorContext.submitterId || "N/A",
                            inline: true,
                        },
                        {
                            name: "Stack Trace",
                            value: `\`\`\`${stackSnippet}\`\`\``.slice(0, 1024),
                            inline: false,
                        },
                    ],
                    footer: {
                        text: "Grounds • Critical Alert",
                    },
                    timestamp: new Date().toISOString(),
                }],
            }),
        })
    } catch (error) {
        console.error("[Critical] Failed to send Discord notification:", error)
    }
}