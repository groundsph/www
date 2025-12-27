import { MetadataRoute } from 'next'
import { createAdminClient } from '@/utils/supabase/admin'

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
        { url: `${baseUrl}/events`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
        { url: `${baseUrl}/submit`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
        { url: `${baseUrl}/donate`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
        { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
        // Legal pages
        { url: `${baseUrl}/legal`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
        { url: `${baseUrl}/legal/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
        { url: `${baseUrl}/legal/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
        { url: `${baseUrl}/legal/content-policy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    ]

    const db = await createAdminClient()

    // Dynamic cafe pages from database
    const { data: cafes } = await db
        .from('cafes')
        .select('slug, updated_at, created_at')
        .eq('is_published', true)

    const cafePages: MetadataRoute.Sitemap = (cafes || []).map((cafe) => ({
        url: `${baseUrl}/cafes/${cafe.slug}`,
        lastModified: cafe.updated_at || cafe.created_at || new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
    }))

    // Dynamic blog posts from database
    const { data: blogPosts } = await db
        .from('blog_posts')
        .select('slug, updated_at, published_at')
        .eq('status', 'published')

    const blogPages: MetadataRoute.Sitemap = (blogPosts || []).map((post) => ({
        url: `${baseUrl}/blog/${post.slug}`,
        lastModified: post.updated_at || post.published_at || new Date(),
        changeFrequency: 'weekly',
        priority: 0.7,
    }))

    return [...staticPages, ...cafePages, ...blogPages]
}

