// Cafe crawl report types for moderation

export interface CafeCrawlReport {
    id: string
    crawlId: string
    reporterId: string
    reason: string
    details: string | null
    status: 'pending' | 'reviewed' | 'dismissed'
    reviewedBy: string | null
    reviewedAt: string | null
    adminNotes: string | null
    createdAt: string | null
}

export const CAFE_CRAWL_REPORT_REASONS = [
    { value: 'spam', label: 'Spam or misleading content' },
    { value: 'harassment', label: 'Harassment or bullying' },
    { value: 'misinformation', label: 'False information' },
    { value: 'inappropriate', label: 'Inappropriate content' },
    { value: 'copyright', label: 'Copyright violation' },
    { value: 'other', label: 'Other' }
] as const

export type CafeCrawlReportReason = typeof CAFE_CRAWL_REPORT_REASONS[number]['value']

export interface CafeCrawlReportInput {
    crawlId: string
    reason: CafeCrawlReportReason
    details?: string
}
