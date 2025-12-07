import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Grounds - Discover Cebu\'s Best Cafes',
        short_name: 'Grounds',
        description: 'Discover and explore the best cafes in Cebu',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#8B4513',
        icons: [
            {
                src: '/favicon.ico',
                sizes: 'any',
                type: 'image/x-icon',
            },
            // TODO: Add more icon sizes as needed
            // {
            //     src: '/icon-192.png',
            //     sizes: '192x192',
            //     type: 'image/png',
            // },
            // {
            //     src: '/icon-512.png',
            //     sizes: '512x512',
            //     type: 'image/png',
            // },
        ],
    }
}
