import { MetadataRoute } from 'next'
import { db } from '@/db'
import { cafes, blogPosts, cafeMenuItems, collections } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://grounds.ph'

    // Static pages
    const staticPages: MetadataRoute.Sitemap = [
        // Core pages
        { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
        { url: `${baseUrl}/cafes`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
        { url: `${baseUrl}/blog`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
        { url: `${baseUrl}/map`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
        // Community pages
        { url: `${baseUrl}/community`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
        { url: `${baseUrl}/submit`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
        { url: `${baseUrl}/donate`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
        { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
        { url: `${baseUrl}/roadmap`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
        // Legal pages
        { url: `${baseUrl}/legal`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
        { url: `${baseUrl}/legal/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
        { url: `${baseUrl}/legal/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
        { url: `${baseUrl}/legal/content-policy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    ]

    // Dynamic cafe pages from database
    const cafeResults = await db
        .select({ slug: cafes.slug, updatedAt: cafes.updatedAt, createdAt: cafes.createdAt })
        .from(cafes)
        .where(eq(cafes.isPublished, true))

    const cafePages: MetadataRoute.Sitemap = cafeResults.map((cafe) => ({
        url: `${baseUrl}/cafes/${cafe.slug}`,
        lastModified: cafe.updatedAt || cafe.createdAt || new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
    }))

    // Dynamic blog posts from database
    const blogResults = await db
        .select({ slug: blogPosts.slug, updatedAt: blogPosts.updatedAt, publishedAt: blogPosts.publishedAt })
        .from(blogPosts)
        .where(eq(blogPosts.status, 'published'))

    const blogPages: MetadataRoute.Sitemap = blogResults.map((post) => ({
        url: `${baseUrl}/blog/${post.slug}`,
        lastModified: post.updatedAt || post.publishedAt || new Date(),
        changeFrequency: 'weekly',
        priority: 0.7,
    }))

    // Menu pages for cafes that have menu items
    const menuCafeResults = await db
        .select({
            slug: cafes.slug,
            updatedAt: cafes.updatedAt,
        })
        .from(cafeMenuItems)
        .innerJoin(cafes, eq(cafeMenuItems.cafeId, cafes.id))
        .where(eq(cafeMenuItems.isAvailable, true))

    // Get unique cafe slugs that have menu items
    const menuCafeSlugs = new Set<string>()
    const menuPages: MetadataRoute.Sitemap = []

    for (const item of menuCafeResults) {
        if (item.slug && !menuCafeSlugs.has(item.slug)) {
            menuCafeSlugs.add(item.slug)
            menuPages.push({
                url: `${baseUrl}/cafes/${item.slug}/menu`,
                lastModified: item.updatedAt || new Date(),
                changeFrequency: 'weekly',
                priority: 0.7,
            })
        }
    }

    // Public collection pages
    const collectionResults = await db
        .select({ slug: collections.slug, updatedAt: collections.updatedAt })
        .from(collections)
        .where(eq(collections.isPublic, true))

    const collectionPages: MetadataRoute.Sitemap = collectionResults.map((collection) => ({
        url: `${baseUrl}/community/${collection.slug}`,
        lastModified: collection.updatedAt || new Date(),
        changeFrequency: 'weekly',
        priority: 0.6,
    }))

    return [...staticPages, ...cafePages, ...blogPages, ...menuPages, ...collectionPages]
}
