import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://grounds.ph"

    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: ['/api/', '/manage/', '/owner/', '/auth/', '/community/crawls/create', '/community/crawls/*/edit'],
            },
            {
                userAgent: ['GPTBot', 'ChatGPT-User', 'CCBot', 'Google-Extended', 'anthropic-ai', 'Claude-Web'],
                disallow: ['/'],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
    }
}
