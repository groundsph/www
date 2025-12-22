interface Route {
    title: string
    href: string
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
        title: 'events',
        href: '/events',
    },
    {
        title: 'blog',
        href: '/blog',
    },
    // {
    //     title: 'community',
    //     href: '/community',
    // },
]