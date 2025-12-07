import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = 'https://cebu.coffee'

    return [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1,
        },
        // Add more URLs as you create pages:
        // {
        //     url: `${baseUrl}/cafes`,
        //     lastModified: new Date(),
        //     changeFrequency: 'daily',
        //     priority: 0.9,
        // },
        // {
        //     url: `${baseUrl}/blog`,
        //     lastModified: new Date(),
        //     changeFrequency: 'weekly',
        //     priority: 0.7,
        // },
        // {
        //     url: `${baseUrl}/events`,
        //     lastModified: new Date(),
        //     changeFrequency: 'weekly',
        //     priority: 0.7,
        // },
    ]
}
