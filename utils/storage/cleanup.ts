/**
 * Storage cleanup helpers
 */

interface CafeWithBadgeStamp {
    badgeStampUrl: string | null
}

export function collectCafeStampUrls(cafes: CafeWithBadgeStamp[]): Set<string> {
    const urls = new Set<string>()
    for (const cafe of cafes) {
        if (cafe.badgeStampUrl) {
            urls.add(cafe.badgeStampUrl)
        }
    }
    return urls
}
