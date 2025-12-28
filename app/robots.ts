import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    const baseUrl = 'https://grounds.ph'

    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/api/', '/manage/', '/owner/', '/auth/'],
        },
        sitemap: `${baseUrl}/sitemap.xml`,
    }
}
