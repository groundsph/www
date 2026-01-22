interface Route {
    title: string
    href: string
    children?: Route[]
}

export const routes: Route[] = [
    {
        title: 'home',
        href: '/',
    },
    {
        title: 'cafes',
        href: '/cafes',
    },
    {
        title: 'community',
        href: '/community',
        children: [
            {
                title: 'discover',
                href: '/community',
            },
            {
                title: 'blog',
                href: '/blog',
            },
        ],
    },
]
