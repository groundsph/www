'use server'

import { REVIEW_QUEUES, reviewQueueUrl, notificationSiteUrl } from "@/utils/notifications/review-queues"

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
        const queueUrl = reviewQueueUrl(REVIEW_QUEUES.cafeSubmissions)

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    title: "☕ New Cafe Submission",
                    url: queueUrl,
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
        const cafeUrl = `${notificationSiteUrl()}/cafes/${cafeInfo.slug}`

        const queueUrl = reviewQueueUrl(REVIEW_QUEUES.reviewReports)

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    title: "🚩 Review Reported",
                    url: queueUrl,
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
        const cafeUrl = `${notificationSiteUrl()}/cafes/${cafeInfo.slug}`

        const queueUrl = reviewQueueUrl(REVIEW_QUEUES.cafeEditSuggestions)

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    title: "✏️ New Edit Suggestion",
                    url: queueUrl,
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

        const queueUrl = reviewQueueUrl(REVIEW_QUEUES.cafeClaims)

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    title: "🏪 New Cafe Claim Request",
                    url: queueUrl,
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
 * Format the AI moderation verdict for a Discord embed field value.
 */
function formatAiReviewSummary(
    aiReview?: { approved: boolean; issues: string[] }
): string {
    if (!aiReview) return "Not reviewed (admin/mod submission)"
    if (aiReview.approved && aiReview.issues.length === 0) {
        return "✅ Approved by AI"
    }
    const issues = aiReview.issues.length > 0
        ? aiReview.issues.slice(0, 4).map((i) => `• ${i}`).join("\n") +
          (aiReview.issues.length > 4 ? `\n• +${aiReview.issues.length - 4} more` : "")
        : "• No specific issues listed"
    return `⚠️ Needs manual review\n${issues}`.slice(0, 1024)
}

/**
 * Notify Discord when a blog post is submitted for approval (pending moderation).
 * Includes the AI review verdict so moderators can triage at a glance.
 */
export async function notifyDiscordBlogSubmission(
    blogInfo: { title: string; slug: string; category: string },
    authorName?: string,
    aiReview?: { approved: boolean; issues: string[] }
): Promise<NotifyResult> {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL
    if (!webhookUrl) {
        console.warn('Discord webhook URL not configured')
        return { success: false, message: 'Webhook not configured' }
    }

    try {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://grounds.ph'
        const blogUrl = `${siteUrl}/blog/${blogInfo.slug}`
        const adminUrl = reviewQueueUrl(REVIEW_QUEUES.blogSubmissions)
        const displayTitle = blogInfo.title.length > 100
            ? blogInfo.title.slice(0, 100) + '...'
            : blogInfo.title

        const queueUrl = reviewQueueUrl(REVIEW_QUEUES.blogSubmissions)

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    title: "📝 New Blog Submission",
                    url: queueUrl,
                    description: "A blog post has been submitted for approval.",
                    color: 0xf59e0b, // Amber color — awaiting moderation
                    fields: [
                        {
                            name: "Blog Post",
                            value: `[${displayTitle}](${blogUrl})`,
                            inline: false
                        },
                        {
                            name: "Category",
                            value: blogInfo.category,
                            inline: true
                        },
                        {
                            name: "Submitted By",
                            value: authorName || "Anonymous User",
                            inline: true
                        },
                        {
                            name: "AI Review",
                            value: formatAiReviewSummary(aiReview),
                            inline: false
                        },
                        {
                            name: "Action Required",
                            value: `[Review in Content Management](${adminUrl})`,
                            inline: false
                        },
                    ],
                    footer: {
                        text: "Grounds • Blog Submission"
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
            message: 'Blog Submission Notified',
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
 * Notify Discord when a blog post has been approved and published.
 */
export async function notifyDiscordBlogApproved(
    blogInfo: { title: string; slug: string },
    moderatorName?: string
): Promise<NotifyResult> {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL
    if (!webhookUrl) {
        console.warn('Discord webhook URL not configured')
        return { success: false, message: 'Webhook not configured' }
    }

    try {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://grounds.ph'
        const blogUrl = `${siteUrl}/blog/${blogInfo.slug}`
        const displayTitle = blogInfo.title.length > 100
            ? blogInfo.title.slice(0, 100) + '...'
            : blogInfo.title

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    title: "✅ Blog Post Approved",
                    description: "A blog post has been approved and published.",
                    color: 0x22c55e, // Green — success
                    fields: [
                        {
                            name: "Blog Post",
                            value: `[${displayTitle}](${blogUrl})`,
                            inline: false
                        },
                        {
                            name: "Approved By",
                            value: moderatorName || "A moderator",
                            inline: true
                        },
                    ],
                    footer: {
                        text: "Grounds • Blog Approval"
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
            message: 'Blog Approval Notified',
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
        const adminUrl = reviewQueueUrl(REVIEW_QUEUES.blogReports)

        const queueUrl = reviewQueueUrl(REVIEW_QUEUES.blogReports)

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    title: "🚩 Blog Post Reported",
                    url: queueUrl,
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
        const adminUrl = reviewQueueUrl(REVIEW_QUEUES.eventSubmissions)

        const formattedDate = new Date(eventInfo.startDate).toLocaleDateString('en-PH', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        })

        const queueUrl = reviewQueueUrl(REVIEW_QUEUES.eventSubmissions)

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    title: "📅 New Event Submission",
                    url: queueUrl,
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
/**
 * Notify Discord that a Menu scan has been queued for review.
 *
 * Sent once per scan, not once per item: a forty-item scan is one decision in
 * the queue, so it is one message. The link goes straight to the Menu tab of
 * Cafes Management, because the queue is otherwise three clicks deep behind a
 * tab strip and a reviewer who is told "something needs review" should not have
 * to go looking for it.
 */
export async function notifyDiscordMenuScanBatch(
    cafeInfo: { name: string; slug: string },
    itemCount: number,
    submitterName?: string
): Promise<NotifyResult> {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL
    if (!webhookUrl) {
        console.warn('Discord webhook URL not configured')
        return { success: false, message: 'Webhook not configured' }
    }

    try {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://grounds.ph'
        const cafeUrl = `${siteUrl}/cafes/${cafeInfo.slug}`
        const queueUrl = `${siteUrl}/manage/cafes?tab=menu-suggestions`

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    title: "📷 Menu scan waiting for review",
                    description: `${itemCount} item${itemCount === 1 ? "" : "s"} read from a photo. One approval covers all of them.`,
                    url: queueUrl,
                    color: 0x3b82f6, // Blue
                    fields: [
                        {
                            name: "Cafe",
                            value: `[${cafeInfo.name}](${cafeUrl})`,
                            inline: true
                        },
                        {
                            name: "Items",
                            value: String(itemCount),
                            inline: true
                        },
                        {
                            name: "Submitted By",
                            value: submitterName || "A visitor",
                            inline: true
                        },
                        {
                            name: "Review queue",
                            value: `[Open the Menu tab](${queueUrl})`,
                            inline: false
                        },
                    ],
                    footer: {
                        text: "Grounds • Menu Scan Review"
                    },
                    timestamp: new Date().toISOString()
                }]
            }),
        })

        if (!response.ok) {
            console.error('Discord webhook failed:', response.status)
            return { success: false, message: 'Failed to notify Discord' }
        }

        return { success: true, message: 'Menu scan batch notified' }
    } catch (error) {
        console.error('Discord notification error:', error)
        return { success: false, message: 'Error sending notification' }
    }
}

/**
 * Notify Discord about a single Menu item suggestion.
 *
 * The one-at-a-time path, as opposed to a scan batch: a contribution made by
 * hand is still a contribution waiting for a reviewer, and it lands in the same
 * queue. The title carries the queue link so the message is actionable without
 * scrolling to a field.
 */
export async function notifyDiscordMenuSuggestion(
    cafeInfo: { name: string; slug: string },
    suggestion: { type: "add" | "edit" | "remove"; itemName?: string | null; price?: number | null },
    submitterName?: string
): Promise<NotifyResult> {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL
    if (!webhookUrl) {
        console.warn('Discord webhook URL not configured')
        return { success: false, message: 'Webhook not configured' }
    }

    try {
        const cafeUrl = `${notificationSiteUrl()}/cafes/${cafeInfo.slug}`
        const queueUrl = reviewQueueUrl(REVIEW_QUEUES.menuScanBatches)
        const itemName = suggestion.itemName?.trim() || "an item"

        const titles = {
            add: `🍽 Menu item suggested: ${itemName}`,
            edit: `✏️ Menu item edit suggested: ${itemName}`,
            remove: `🗑 Menu item removal suggested: ${itemName}`,
        } as const

        const colors = { add: 0x22c55e, edit: 0xf59e0b, remove: 0xef4444 } as const

        const fields: Array<{ name: string; value: string; inline: boolean }> = [
            { name: "Cafe", value: `[${cafeInfo.name}](${cafeUrl})`, inline: true },
            { name: "Suggested By", value: submitterName || "A visitor", inline: true },
        ]
        if (typeof suggestion.price === "number" && Number.isFinite(suggestion.price)) {
            fields.push({ name: "Price", value: `₱${suggestion.price.toFixed(2)}`, inline: true })
        }

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    title: titles[suggestion.type],
                    url: queueUrl,
                    color: colors[suggestion.type],
                    fields,
                    footer: {
                        text: "Grounds • Menu Suggestions"
                    },
                    timestamp: new Date().toISOString()
                }]
            }),
        })

        if (!response.ok) {
            console.error('Discord webhook failed:', response.status)
            return { success: false, message: 'Failed to notify Discord' }
        }

        return { success: true, message: 'Menu suggestion notified' }
    } catch (error) {
        console.error('Discord notification error:', error)
        return { success: false, message: 'Error sending notification' }
    }
}
