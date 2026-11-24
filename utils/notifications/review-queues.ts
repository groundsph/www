/**
 * Where a reviewer acts on a notification.
 *
 * A message that says something is waiting, without saying where, sends the
 * reader hunting through a tab strip. Every queue-backed notifier therefore links
 * to the tab that holds the thing, and each of those pages reads `?tab=` on mount
 * so the link lands there rather than on the default tab.
 *
 * Kept out of `notify.ts` because that module is `"use server"`: it may only
 * export async functions, so constants live here.
 */
export function notificationSiteUrl(): string {
    return process.env.NEXT_PUBLIC_SITE_URL || "https://grounds.ph"
}

export function reviewQueueUrl(path: string): string {
    return `${notificationSiteUrl()}${path}`
}

/** The tab-scoped destination for each queue that receives contributions. */
export const REVIEW_QUEUES = {
    cafeSubmissions: "/manage/cafes?tab=pending",
    cafeEditSuggestions: "/manage/cafes?tab=suggestions",
    cafeClaims: "/manage/cafes?tab=claims",
    menuScanBatches: "/manage/cafes?tab=menu-suggestions",
    blogSubmissions: "/manage/content?tab=blog",
    blogReports: "/manage/content?tab=reports",
    eventSubmissions: "/manage/community?tab=events",
    reviewReports: "/manage/community?tab=reviews",
} as const
