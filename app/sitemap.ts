import { MetadataRoute } from 'next'
import { routes } from '@/utils/routes'
import { createClient } from '@/utils/supabase/server'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://grounds.coffee'

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

    const cafePages: MetadataRoute.Sitemap = (cafes || []).map((cafe) => ({
        url: `${baseUrl}/cafes/${cafe.slug}`,
        lastModified: cafe.updated_at || cafe.created_at,
        changeFrequency: 'weekly',
        priority: 0.8,
    }))

    return [...staticPages, ...cafePages]
}
