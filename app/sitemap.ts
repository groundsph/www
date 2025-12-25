import { MetadataRoute } from 'next'
import { routes } from '@/utils/routes'
import { createClient } from '@/utils/supabase/server'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://grounds.ph'

    // Non-static pages (reserved for future use)
    const _nonStaticPages: MetadataRoute.Sitemap = [
        {
            url: `${baseUrl}/map`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/business`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/support`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.8,
        },
    ]

    // Static pages from routes.ts
    const staticPages: MetadataRoute.Sitemap = routes.map((route) => ({
        url: `${baseUrl}${route.href}`,
        lastModified: new Date(),
        changeFrequency: route.href === '/' ? 'daily' : 'weekly',
        priority: route.href === '/' ? 1 : 0.9,
    }))

    // Dynamic cafe pages from database
    const db = await createClient()
    const { data: cafes } = await db
        .from('cafes')
        .select('slug, updated_at, created_at')
        .eq('is_active', true)
        .eq('is_verified', true)
        .returns<{
            slug: string
            updated_at: string | null
            created_at: string | null
        }[]>()

    if (!cafes) return staticPages

    const cafePages: MetadataRoute.Sitemap = cafes.map((cafe) => ({
        url: `${baseUrl}/cafes/${cafe.slug}`,
        lastModified: cafe.updated_at || cafe.created_at || new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
    }))

    return [...staticPages, ...cafePages]
}
