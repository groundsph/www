import type { MetadataRoute } from "next"

interface StaticPageConfig {
    path: string
    changeFrequency: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never"
    priority: number
}

interface SitemapInput {
    baseUrl: string
    staticPages: StaticPageConfig[]
    cafes: { slug: string; updatedAt?: Date | null; createdAt?: Date | null }[]
    blogs: { slug: string; updatedAt?: Date | null; publishedAt?: Date | null }[]
    menus: { slug: string; updatedAt?: Date | null }[]
    collections: { slug: string; updatedAt?: Date | null }[]
    crawls: { slug: string; updatedAt?: Date | null; createdAt?: Date | null }[]
    profiles?: { username: string; updatedAt?: Date | null }[]
}

function withBase(baseUrl: string, path: string) {
    return new URL(path, baseUrl).toString()
}

export function buildSitemapEntries(input: SitemapInput): MetadataRoute.Sitemap {
    const staticEntries: MetadataRoute.Sitemap = input.staticPages.map((page) => ({
        url: withBase(input.baseUrl, page.path),
        lastModified: new Date(),
        changeFrequency: page.changeFrequency,
        priority: page.priority,
    }))

    const cafeEntries: MetadataRoute.Sitemap = input.cafes.map((cafe) => ({
        url: withBase(input.baseUrl, `/cafes/${cafe.slug}`),
        lastModified: cafe.updatedAt || cafe.createdAt || new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
    }))

    const blogEntries: MetadataRoute.Sitemap = input.blogs.map((post) => ({
        url: withBase(input.baseUrl, `/blog/${post.slug}`),
        lastModified: post.updatedAt || post.publishedAt || new Date(),
        changeFrequency: "weekly",
        priority: 0.7,
    }))

    const menuEntries: MetadataRoute.Sitemap = input.menus.map((cafe) => ({
        url: withBase(input.baseUrl, `/cafes/${cafe.slug}/menu`),
        lastModified: cafe.updatedAt || new Date(),
        changeFrequency: "weekly",
        priority: 0.7,
    }))

    const collectionEntries: MetadataRoute.Sitemap = input.collections.map((collection) => ({
        url: withBase(input.baseUrl, `/community/${collection.slug}`),
        lastModified: collection.updatedAt || new Date(),
        changeFrequency: "weekly",
        priority: 0.6,
    }))

    const crawlEntries: MetadataRoute.Sitemap = input.crawls.map((crawl) => ({
        url: withBase(input.baseUrl, `/community/crawls/${crawl.slug}`),
        lastModified: crawl.updatedAt || crawl.createdAt || new Date(),
        changeFrequency: "weekly",
        priority: 0.6,
    }))

    const profileEntries: MetadataRoute.Sitemap = (input.profiles ?? []).map((profile) => ({
        url: withBase(input.baseUrl, `/profile/${profile.username}`),
        lastModified: profile.updatedAt || new Date(),
        changeFrequency: "weekly",
        priority: 0.4,
    }))

    return [
        ...staticEntries,
        ...cafeEntries,
        ...blogEntries,
        ...menuEntries,
        ...collectionEntries,
        ...crawlEntries,
        ...profileEntries,
    ]
}
