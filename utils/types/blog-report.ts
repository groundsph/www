// Blog report types for moderation

export interface BlogReport {
    id: string
    blog_post_id: string
    reporter_id: string
    reason: string
    details: string | null
    status: 'pending' | 'reviewed' | 'dismissed'
    reviewed_by: string | null
    reviewed_at: string | null
    admin_notes: string | null
    created_at: string | null

    // Joined data
    blog_post?: {
        id: string
        title: string
        slug: string
        author_id: string
        status: string
    } | null
    reporter?: {
        id: string
        display_name: string
        username: string
    } | null
    reviewer?: {
        display_name: string
    } | null
}

export const BLOG_REPORT_REASONS = [
    { value: 'spam', label: 'Spam or misleading content' },
    { value: 'harassment', label: 'Harassment or bullying' },
    { value: 'misinformation', label: 'False information' },
    { value: 'inappropriate', label: 'Inappropriate content' },
    { value: 'copyright', label: 'Copyright violation' },
    { value: 'other', label: 'Other' }
] as const

export type BlogReportReason = typeof BLOG_REPORT_REASONS[number]['value']

export interface BlogReportInput {
    blog_post_id: string
    reason: BlogReportReason
    details?: string
}
