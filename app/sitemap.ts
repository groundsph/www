import { MetadataRoute } from 'next'
import { db } from '@/db'
import { cafes, blogPosts, cafeMenuItems, collections, cafeCrawls } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { buildSitemapEntries } from '@/utils/seo/sitemap'

export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://grounds.ph"

    const cafeResults = await db
        .select({ slug: cafes.slug, updatedAt: cafes.updatedAt, createdAt: cafes.createdAt })
        .from(cafes)
        .where(eq(cafes.isPublished, true))

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
        staticPages: ["/", "/cafes", "/blog", "/map", "/community", "/submit", "/donate", "/contact", "/roadmap", "/legal", "/legal/privacy", "/legal/terms", "/legal/content-policy"],
        cafes: cafeResults,
        blogs: blogResults,
        menus: menuResults,
        collections: collectionResults,
        crawls: crawlResults,
        profiles: [],
    })
}
