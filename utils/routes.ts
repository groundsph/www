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
                title: 'blogs',
                href: '/community?tab=blogs',
            },
            {
                title: 'crawls',
                href: '/community?tab=crawls',
            },
            {
                title: 'collections',
                href: '/community?tab=collections',
            },
            {
                title: 'events',
                href: '/community?tab=events',
            },
            {
                title: 'leaderboard',
                href: '/community?tab=leaderboard',
            },
        ],
    },
]
