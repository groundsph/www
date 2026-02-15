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

interface CrawlWithCoverImage {
    coverImage: string | null
}

export function collectCrawlCoverUrls(crawls: CrawlWithCoverImage[]): Set<string> {
    const urls = new Set<string>()
    for (const crawl of crawls) {
        if (crawl.coverImage) {
            urls.add(crawl.coverImage)
        }
    }
    return urls
}

interface BlogWithImages {
    coverImage: string | null
    images?: string[] | null
}

export function collectBlogImageUrls(blogs: BlogWithImages[]): Set<string> {
    const urls = new Set<string>()
    for (const blog of blogs) {
        if (blog.coverImage) urls.add(blog.coverImage)
        blog.images?.forEach((url) => urls.add(url))
    }
    return urls
}
