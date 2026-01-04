import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    const baseUrl = 'https://grounds.ph'

    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: ['/api/', '/manage/', '/owner/', '/auth/'],
            },
            // Block AI training crawlers
            {
                userAgent: ['GPTBot', 'ChatGPT-User', 'CCBot', 'Google-Extended', 'anthropic-ai', 'Claude-Web'],
                disallow: ['/'],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
    }
}
