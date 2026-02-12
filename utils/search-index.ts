import { SearchResult, QuickAction } from "@/utils/types/search"

export const staticPages: SearchResult[] = [
  {
    id: 'page-home',
    type: 'page',
    title: 'Home',
    subtitle: 'Featured cafes and recent activity',
    href: '/',
    priority: 90,
    keywords: ['home', 'main', 'start']
  },
  {
    id: 'page-cafes',
    type: 'page',
    title: 'Cafes',
    subtitle: 'Browse all coffee shops',
    href: '/cafes',
    priority: 85,
    keywords: ['coffee', 'shops', 'browse', 'list']
  },
  {
    id: 'page-map',
    type: 'page',
    title: 'Map',
    subtitle: 'Find cafes on the map',
    href: '/map',
    priority: 85,
    keywords: ['location', 'nearby', 'find']
  },
  {
    id: 'page-community',
    type: 'page',
    title: 'Community',
    subtitle: 'Discover and connect',
    href: '/community',
    priority: 80,
    keywords: ['social', 'users', 'discover']
  },
  {
    id: 'page-blog',
    type: 'page',
    title: 'Blog',
    subtitle: 'Articles and updates',
    href: '/blog',
    priority: 75,
    keywords: ['articles', 'news', 'posts']
  },
  {
    id: 'page-submit',
    type: 'page',
    title: 'Submit Cafe',
    subtitle: 'Add a new coffee shop',
    href: '/submit',
    priority: 70,
    keywords: ['add', 'contribute', 'new']
  },
  {
    id: 'page-donate',
    type: 'page',
    title: 'Donate',
    subtitle: 'Support the platform',
    href: '/donate',
    priority: 60,
    keywords: ['support', 'contribute', 'help']
  },
  {
    id: 'page-profile',
    type: 'page',
    title: 'My Profile',
    subtitle: 'View and edit your profile',
    href: '/profile',
    priority: 70,
    keywords: ['account', 'settings', 'me']
  },
]

export const quickActions: SearchResult[] = [
  {
    id: 'action-submit',
    type: 'action',
    title: 'Quick: Submit Cafe',
    subtitle: 'Type ">submit" anywhere',
    href: '/submit',
    priority: 95,
    keywords: ['>submit', 'quick submit']
  },
  {
    id: 'action-map',
    type: 'action',
    title: 'Quick: Open Map',
    subtitle: 'Type ">map" anywhere',
    href: '/map',
    priority: 95,
    keywords: ['>map', 'quick map']
  },
  {
    id: 'action-leaderboard',
    type: 'action',
    title: 'Quick: Leaderboard',
    subtitle: "Type '>leaderboard' anywhere",
    href: '/community',
    priority: 95,
    keywords: ['>leaderboard', 'leaderboard', 'rankings']
  },
]

export const quickActionHelp: QuickAction[] = [
  { prefix: '>', description: 'Quick actions', example: '>submit, >map' },
  { prefix: '@', description: 'Search users', example: '@username' },
]

export const emptyStateSuggestions: SearchResult[] = [
  {
    id: 'suggest-popular-1',
    type: 'page',
    title: 'Browse Popular Cafes',
    subtitle: 'See what others are visiting',
    href: '/cafes',
    priority: 100
  },
  {
    id: 'suggest-map',
    type: 'page',
    title: 'Explore the Map',
    subtitle: 'Find cafes near you',
    href: '/map',
    priority: 95
  },
  {
    id: 'suggest-submit',
    type: 'page',
    title: 'Submit a Cafe',
    subtitle: 'Add your favorite spot',
    href: '/submit',
    priority: 90
  },
]
