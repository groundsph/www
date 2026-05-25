import { MetadataRoute } from 'next'
import { db } from '@/db'
import { cafes, blogPosts, cafeMenuItems, collections, cafeCrawls } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { buildSitemapEntries } from '@/utils/seo/sitemap'
import { getProductionFilter } from '@/utils/filters'

export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://grounds.ph"

    const testFilter = getProductionFilter()
    const cafeResults = await db
        .select({ slug: cafes.slug, updatedAt: cafes.updatedAt, createdAt: cafes.createdAt })
        .from(cafes)
        .where(testFilter ? and(eq(cafes.isPublished, true), testFilter) : eq(cafes.isPublished, true))

    const blogResults = await db
        .select({ slug: blogPosts.slug, updatedAt: blogPosts.updatedAt, publishedAt: blogPosts.publishedAt })
        .from(blogPosts)
        .where(eq(blogPosts.status, 'published'))

    const menuCafeResults = await db
        .select({
            slug: cafes.slug,
            updatedAt: cafes.updatedAt,
        })
        .from(cafeMenuItems)
        .innerJoin(cafes, eq(cafeMenuItems.cafeId, cafes.id))
        .where(eq(cafeMenuItems.isAvailable, true))

    const menuCafeSlugs = new Set<string>()
    const menuResults: Array<{ slug: string; updatedAt: Date | null }> = []

    for (const item of menuCafeResults) {
        if (item.slug && !menuCafeSlugs.has(item.slug)) {
            menuCafeSlugs.add(item.slug)
            menuResults.push({ slug: item.slug, updatedAt: item.updatedAt })
        }
    }

    const collectionResults = await db
        .select({ slug: collections.slug, updatedAt: collections.updatedAt })
        .from(collections)
        .where(eq(collections.isPublic, true))

    const crawlResults = await db
        .select({ slug: cafeCrawls.slug, updatedAt: cafeCrawls.updatedAt, createdAt: cafeCrawls.createdAt })
        .from(cafeCrawls)
        .where(and(eq(cafeCrawls.isPublic, true), eq(cafeCrawls.status, 'published')))

    return buildSitemapEntries({
        baseUrl,
        staticPages: [
            // Core pages
            { path: "/", changeFrequency: "daily", priority: 1 },
            { path: "/cafes", changeFrequency: "daily", priority: 0.9 },
            { path: "/blog", changeFrequency: "daily", priority: 0.9 },
            { path: "/map", changeFrequency: "weekly", priority: 0.8 },
            // Community pages
            { path: "/community", changeFrequency: "daily", priority: 0.8 },
            { path: "/submit", changeFrequency: "monthly", priority: 0.6 },
            { path: "/donate", changeFrequency: "monthly", priority: 0.5 },
            { path: "/contact", changeFrequency: "monthly", priority: 0.5 },
            { path: "/roadmap", changeFrequency: "monthly", priority: 0.5 },
            // Legal pages
            { path: "/legal", changeFrequency: "yearly", priority: 0.3 },
            { path: "/legal/privacy", changeFrequency: "yearly", priority: 0.3 },
            { path: "/legal/terms", changeFrequency: "yearly", priority: 0.3 },
            { path: "/legal/content-policy", changeFrequency: "yearly", priority: 0.3 },
        ],
        cafes: cafeResults,
        blogs: blogResults,
        menus: menuResults,
        collections: collectionResults,
        crawls: crawlResults,
        profiles: [],
    })
}
