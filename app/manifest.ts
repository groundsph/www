import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'GroundsPH - Discover the Philippines\' Best Cafes',
        short_name: 'GroundsPH',
        description: 'Discover and explore the best cafes in the Philippines',
        start_url: '/',
        display: 'standalone',
        background_color: '#AF8F6F',
        theme_color: '#8B4513',
        icons: [
            {
                src: '/favicon.ico',
                sizes: 'any',
                type: 'image/x-icon',
            },
            {
                src: '/android-icon-36x36.png',
                sizes: '36x36',
                type: 'image/png',
                purpose: 'any',
            },
            {
                src: '/android-icon-48x48.png',
                sizes: '48x48',
                type: 'image/png',
                purpose: 'any',
            },
            {
                src: '/android-icon-72x72.png',
                sizes: '72x72',
                type: 'image/png',
                purpose: 'any',
            },
            {
                src: '/android-icon-96x96.png',
                sizes: '96x96',
                type: 'image/png',
                purpose: 'any',
            },
            {
                src: '/android-icon-144x144.png',
                sizes: '144x144',
                type: 'image/png',
                purpose: 'any',
            },
            {
                src: '/android-icon-192x192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any',
            },
            {
                src: '/android-icon-192x192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'maskable',
            },
        ],
    }
}
