"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import {
    Layers,
    Calendar,
    Users,
    Search,
    User,
    Loader2,
    Star,
    Trophy,
    MapPin,
    BookOpen,
} from "lucide-react"
import { getPublicCollections, searchUsers, getPublicCafeCrawls, searchCommunityContent } from "@/app/api/actions/community"
import CrawlCard from "@/components/crawls/CrawlCard"
import CollectionCard from "@/components/collections/CollectionCard"
import { Crawl } from "@/utils/types/cafe-crawls"
import EventsPageClient from "@/components/events/EventsPageClient"
import MonthlyLeaderboard from "@/components/community/MonthlyLeaderboard"
import { EventWithCafe } from "@/utils/types/extra"
import CommunityBlogsTab from "@/components/blog/CommunityBlogsTab"
import { BlogPost } from "@/utils/types/blog"
import { COMMUNITY_TAB_ORDER, CommunityTab } from "@/components/community/community-search-order"

type TabType = CommunityTab

interface PublicCollection {
    id: string
    title: string
    slug: string
    description: string | null
    coverImage: string | null
    itemCount: number
    viewsCount: number
    likesCount: number
    isPublic: boolean
    createdAt: string
    author: {
        id: string
        username: string
        displayName: string
        avatarUrl: string | null
    }
}

interface UserResult {
    id: string
    username: string
    displayName: string
    avatarUrl: string | null
    bio: string | null
    isSupporter: boolean
}

interface CommunityPageProps {
    initialTab: string
    initialCrawls: Crawl[]
    initialCrawlsTotal: number
    initialCollections: PublicCollection[]
    initialCollectionsTotal: number
    initialEvents: EventWithCafe[]
    initialFeaturedPosts: BlogPost[]
    initialPosts: BlogPost[]
    initialPostsTotal: number
    initialPostsHasMore: boolean
    initialPostsPage: number
}

export default function CommunityPage({
    initialTab,
    initialCrawls,
    initialCrawlsTotal,
    initialCollections,
    initialCollectionsTotal,
    initialEvents,
    initialFeaturedPosts,
    initialPosts,
    initialPostsTotal,
    initialPostsHasMore,
    initialPostsPage,
}: CommunityPageProps) {
    const router = useRouter()
    const searchParamsHook = useSearchParams()

    const [activeTab, setActiveTab] = useState<TabType>(
        (initialTab as TabType) || "crawls"
    )

    // Crawls state
    const [crawls, setCrawls] = useState(initialCrawls)
    const [crawlsTotal, setCrawlsTotal] = useState(initialCrawlsTotal)
    const [crawlsPage, setCrawlsPage] = useState(1)
    const [loadingCrawls, setLoadingCrawls] = useState(false)

    // Collections state
    const [collections, setCollections] = useState(initialCollections)
    const [collectionsTotal, setCollectionsTotal] = useState(
        initialCollectionsTotal
    )
    const [collectionsPage, setCollectionsPage] = useState(1)
    const [loadingCollections, setLoadingCollections] = useState(false)

    // Blogs state (read-only from props, managed by CommunityBlogsTab)
    const featuredPosts = initialFeaturedPosts
    const posts = initialPosts
    const postsTotal = initialPostsTotal
    const postsPage = initialPostsPage
    const postsHasMore = initialPostsHasMore

    // Search state
    const [searchQuery, setSearchQuery] = useState("")
    const [isUserSearch, setIsUserSearch] = useState(false)
    const [userResults, setUserResults] = useState<UserResult[]>([])

    const [searchingUsers, setSearchingUsers] = useState(false)

    // Unified search results
    const [searchResults, setSearchResults] = useState<{
        blogs: BlogPost[]
        crawls: Crawl[]
        collections: PublicCollection[]
        events: EventWithCafe[]
    } | null>(null)
    const [searchingContent, setSearchingContent] = useState(false)

    // Sync tab with URL
    useEffect(() => {
        const tabParam = searchParamsHook.get("tab")
        if (
            tabParam &&
            ["blogs", "crawls", "collections", "events", "leaderboard"].includes(tabParam)
        ) {
            setActiveTab(tabParam as TabType)
        }
    }, [searchParamsHook])

    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab)
        router.push(`/community?tab=${tab}`, { scroll: false })
    }

    // Load more crawls
    const loadMoreCrawls = async () => {
        if (loadingCrawls || crawls.length >= crawlsTotal) return
        setLoadingCrawls(true)
        try {
            const nextPage = crawlsPage + 1
            const data = await getPublicCafeCrawls(nextPage, 12, "recent")
            setCrawls((prev) => [...prev, ...data.crawls])
            setCrawlsTotal(data.total)
            setCrawlsPage(nextPage)
        } catch (err) {
            console.error("Failed to load more crawls:", err)
        } finally {
            setLoadingCrawls(false)
        }
    }

    // Load more collections
    const loadMoreCollections = async () => {
        if (loadingCollections || collections.length >= collectionsTotal) return
        setLoadingCollections(true)
        try {
            const nextPage = collectionsPage + 1
            const data = await getPublicCollections(
                nextPage,
                12,
                "recent",
                isUserSearch ? undefined : searchQuery
            )
            setCollections((prev) => [...prev, ...data.collections])
            setCollectionsTotal(data.total)
            setCollectionsPage(nextPage)
        } catch (err) {
            console.error("Failed to load more collections:", err)
        } finally {
            setLoadingCollections(false)
        }
    }

    // Search Effect
    useEffect(() => {
        const timeoutId = setTimeout(async () => {
            if (searchQuery.trim().length === 0) {
                // Reset to initial state or clear search
                if (isUserSearch) {
                    setIsUserSearch(false)
                    setUserResults([])
                }
                setSearchResults(null)
                setSearchingContent(false)
                return
            }

            if (searchQuery.startsWith("@")) {
                setIsUserSearch(true)
                setSearchResults(null)
                setSearchingUsers(true)
                try {
                    const query = searchQuery.slice(1)
                    if (query.length < 1) {
                        setUserResults([])
                        return
                    }
                    const results = await searchUsers(query)
                    setUserResults(results)
                } catch (err) {
                    console.error("Search failed:", err)
                } finally {
                    setSearchingUsers(false)
                }
            } else {
                setIsUserSearch(false)
                setSearchingContent(true)
                try {
                    const results = await searchCommunityContent(searchQuery)
                    setSearchResults(results)
                } catch (err) {
                    console.error("Community search failed:", err)
                } finally {
                    setSearchingContent(false)
                }
            }
        }, 300)

        return () => clearTimeout(timeoutId)
    }, [searchQuery, isUserSearch])

    const tabs = [
        { id: "blogs" as TabType, label: "Blogs", icon: BookOpen },
        { id: "crawls" as TabType, label: "Crawls", icon: MapPin },
        { id: "collections" as TabType, label: "Collections", icon: Layers },
        { id: "events" as TabType, label: "Events", icon: Calendar },
        { id: "leaderboard" as TabType, label: "Leaderboard", icon: Trophy },
    ]

    const heroContent = {
        blogs: {
            tag: "Grounds Editorial",
            title: "The Grounds Blog",
            description: "Discover stories, brewing guides, cafe updates, and news from the Philippine coffee community.",
            icon: BookOpen,
        },
        crawls: {
            tag: "Explore the City",
            title: "Cafe Crawls",
            description: "Plan and share curated cafe hopping routes. Discover new spots and create memorable coffee journeys across the Philippines.",
            icon: MapPin,
        },
        collections: {
            tag: "Curated Lists",
            title: "Collections",
            description: "Browse community-curated lists of cafes. Find the perfect spots for work, dates, or your next coffee adventure.",
            icon: Layers,
        },
        events: {
            tag: "Meet & Connect",
            title: "Community Events",
            description: "Join cuppings, workshops, meetups, and cafe happenings. Connect with fellow enthusiasts and discover local coffee culture.",
            icon: Calendar,
        },
        leaderboard: {
            tag: "Check-in Champions",
            title: "Monthly Check-ins",
            description: "See who's been exploring the most cafes this month. Check in at your favorite spots to climb the leaderboard and earn recognition.",
            icon: Trophy,
        },
    }

    const currentHero = heroContent[activeTab]

    return (
        <div className='min-h-screen w-full bg-background'>
            {/* Hero */}
            <section className='relative bg-linear-to-br from-primary/10 via-secondary/5 to-tertiary/10 py-16 overflow-hidden'>
                <div className='absolute inset-0 pointer-events-none select-none overflow-hidden'>
                    <currentHero.icon className='absolute -top-6 -right-6 w-48 h-48 text-primary/5 rotate-12' />
                    <Users className='absolute -bottom-12 -left-12 w-64 h-64 text-secondary opacity-5 -rotate-12' />
                </div>

                <div className='max-w-7xl mx-auto px-6 relative z-10'>
                    <span className='inline-block px-3 py-1 mb-4 bg-background/50 backdrop-blur-sm border border-text/5 rounded-full text-xs font-medium text-text/60 uppercase tracking-wider'>
                        {currentHero.tag}
                    </span>
                    <h1 className='text-5xl md:text-6xl font-bold font-serif text-text mb-4 tracking-tight'>
                        {currentHero.title}
                    </h1>
                    <p className='text-xl text-text/70 max-w-2xl font-light'>
                        {currentHero.description}
                    </p>
                </div>
            </section>

            {/* Tabs & Search */}
            <section className='sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-text/10'>
                <div className='max-w-7xl mx-auto px-6'>
                    <div className='flex flex-col md:flex-row md:items-center justify-between gap-4 py-2'>
                        <div className='flex gap-1 overflow-x-auto'>
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => handleTabChange(tab.id)}
                                    className={`flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                                        activeTab === tab.id
                                            ? "bg-primary text-white"
                                            : "text-text/60 hover:text-text hover:bg-text/5"
                                    }`}
                                >
                                    <tab.icon className='w-4 h-4' />
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Inline Search */}
                        <div className='relative w-full md:w-72'>
                            <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text opacity-40' />
                            <input
                                type='text'
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder='Search or start with @ for users...'
                                className='w-full pl-9 pr-4 py-2 bg-text/5 border border-transparent rounded-lg text-sm text-text placeholder:text-text/40 focus:bg-background focus:border-primary/30 focus:outline-none transition-all'
                            />
                            {(searchingUsers || searchingContent) && (
                                <Loader2 className='absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin' />
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Tab Content */}
            {isUserSearch ? (
                <section className='max-w-7xl mx-auto px-6 py-8'>
                    <h3 className='text-lg font-semibold mb-4'>
                        {searchQuery.length > 1
                            ? `User Results (${userResults.length})`
                            : "Search Users"}
                    </h3>
                    {userResults.length > 0 ? (
                        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
                            {userResults.map((user) => (
                                <UserCard
                                    key={user.id}
                                    user={user}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className='text-center py-16 text-text/60'>
                            {searchingUsers
                                ? "Searching..."
                                : "No users found. Try a different username."}
                        </div>
                    )}
                </section>
            ) : searchResults ? (
                <UnifiedSearchResults
                    searchQuery={searchQuery}
                    results={searchResults}
                    searching={searchingContent}
                />
            ) : activeTab === "blogs" ? (
                <section className='max-w-7xl mx-auto px-6 py-8'>
                    <CommunityBlogsTab
                        featuredPosts={featuredPosts}
                        posts={posts}
                        total={postsTotal}
                        hasMore={postsHasMore}
                        page={postsPage}
                    />
                </section>
            ) : activeTab === "crawls" ? (
                <section className='max-w-7xl mx-auto px-6 py-8'>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-text">Latest Crawls</h2>
                        <Link
                            href="/community/crawls/create"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
                        >
                            Create Crawl
                        </Link>
                    </div>
                    {crawls.length > 0 ? (
                        <>
                            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
                                {crawls.map((crawl) => (
                                    <CrawlCard key={crawl.id} crawl={crawl} />
                                ))}
                            </div>

                            {crawls.length < crawlsTotal && (
                                <div className='flex justify-center mt-8'>
                                    <button
                                        onClick={loadMoreCrawls}
                                        disabled={loadingCrawls}
                                        className='px-6 py-3 bg-text/5 hover:bg-text/10 rounded-full text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer'
                                    >
                                        {loadingCrawls ? (
                                            <span className='flex items-center gap-2'>
                                                <Loader2 className='w-4 h-4 animate-spin' />
                                                Loading...
                                            </span>
                                        ) : (
                                            "Load More"
                                        )}
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className='text-center py-16'>
                            <MapPin className='w-16 h-16 text-secondary opacity-40 mx-auto mb-4' />
                            <h3 className='text-xl font-serif font-semibold text-text mb-2'>
                                No crawls yet
                            </h3>
                            <p className='text-text/60'>
                                Be the first to create a public cafe crawl!
                            </p>
                        </div>
                    )}
                </section>
            ) : activeTab === "collections" ? (
                <section className='max-w-7xl mx-auto px-6 py-8'>
                    {collections.length > 0 ? (
                        <>
                            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
                                {collections.map((collection) => (
                                    <CollectionCard
                                        key={collection.id}
                                        collection={collection}
                                        showAuthor
                                        author={{
                                            displayName: collection.author.displayName,
                                            username: collection.author.username,
                                            avatarUrl: collection.author.avatarUrl,
                                        }}
                                    />
                                ))}
                            </div>

                            {collections.length < collectionsTotal && (
                                <div className='flex justify-center mt-8'>
                                    <button
                                        onClick={loadMoreCollections}
                                        disabled={loadingCollections}
                                        className='px-6 py-3 bg-text/5 hover:bg-text/10 rounded-full text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer'
                                    >
                                        {loadingCollections ? (
                                            <span className='flex items-center gap-2'>
                                                <Loader2 className='w-4 h-4 animate-spin' />
                                                Loading...
                                            </span>
                                        ) : (
                                            "Load More"
                                        )}
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className='text-center py-16'>
                            <Layers className='w-16 h-16 text-secondary opacity-40 mx-auto mb-4' />
                            <h3 className='text-xl font-serif font-semibold text-text mb-2'>
                                No collections yet
                            </h3>
                            <p className='text-text/60'>
                                Be the first to create a public collection!
                            </p>
                        </div>
                    )}
                </section>
            ) : activeTab === "leaderboard" ? (
                <section className='max-w-7xl mx-auto px-6 py-8'>
                    <MonthlyLeaderboard />
                </section>
            ) : activeTab === "events" ? (
                <EventsPageClient
                    initialEvents={initialEvents}
                    embedded
                />
            ) : null}
        </div>
    )
}

// Unified Search Results Component
function UnifiedSearchResults({
    searchQuery,
    results,
    searching,
}: {
    searchQuery: string
    results: {
        blogs: BlogPost[]
        crawls: Crawl[]
        collections: PublicCollection[]
        events: EventWithCafe[]
    }
    searching: boolean
}) {
    const totalResults =
        results.blogs.length +
        results.crawls.length +
        results.collections.length +
        results.events.length

    if (searching) {
        return (
            <section className="max-w-7xl mx-auto px-6 py-16">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
                    <p className="text-text/60">Searching across community...</p>
                </div>
            </section>
        )
    }

    if (totalResults === 0) {
        return (
            <section className="max-w-7xl mx-auto px-6 py-16">
                <div className="text-center">
                    <Search className="w-16 h-16 text-secondary opacity-40 mx-auto mb-4" />
                    <h3 className="text-xl font-serif font-semibold text-text mb-2">
                        No results found
                    </h3>
                    <p className="text-text/60">
                        We couldn&apos;t find anything matching &ldquo;{searchQuery}&rdquo;
                    </p>
                </div>
            </section>
        )
    }

    const sectionConfig: Record<
        Exclude<CommunityTab, "leaderboard">,
        {
            label: string
            icon: React.ElementType
            render: () => React.ReactNode
        }
    > = {
        blogs: {
            label: "Blog Posts",
            icon: BookOpen,
            render: () =>
                results.blogs.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {results.blogs.map((post) => (
                            <Link
                                key={post.id}
                                href={`/blog/${post.slug}`}
                                className="group block"
                            >
                                <div className="bg-background border border-secondary/20 rounded-xl overflow-hidden hover:border-primary/30 transition-all">
                                    {post.cover_image && (
                                        <div className="aspect-video overflow-hidden">
                                            <Image
                                                src={post.cover_image}
                                                alt={post.title}
                                                width={400}
                                                height={225}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                            />
                                        </div>
                                    )}
                                    <div className="p-4">
                                        <h4 className="font-semibold text-text group-hover:text-primary transition-colors line-clamp-2">
                                            {post.title}
                                        </h4>
                                        <p className="text-sm text-text/60 mt-1 line-clamp-2">
                                            {post.excerpt}
                                        </p>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : null,
        },
        crawls: {
            label: "Cafe Crawls",
            icon: MapPin,
            render: () =>
                results.crawls.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {results.crawls.map((crawl) => (
                            <CrawlCard key={crawl.id} crawl={crawl} />
                        ))}
                    </div>
                ) : null,
        },
        collections: {
            label: "Collections",
            icon: Layers,
            render: () =>
                results.collections.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {results.collections.map((collection) => (
                            <CollectionCard
                                key={collection.id}
                                collection={collection}
                                showAuthor
                                author={{
                                    displayName: collection.author.displayName,
                                    username: collection.author.username,
                                    avatarUrl: collection.author.avatarUrl,
                                }}
                            />
                        ))}
                    </div>
                ) : null,
        },
        events: {
            label: "Events",
            icon: Calendar,
            render: () =>
                results.events.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {results.events.map((event) => (
                            <Link
                                key={event.id}
                                href={`/community/events/${event.id}`}
                                className="group block"
                            >
                                <div className="bg-background border border-secondary/20 rounded-xl overflow-hidden hover:border-primary/30 transition-all">
                                    {event.image_url && (
                                        <div className="aspect-video overflow-hidden">
                                            <Image
                                                src={event.image_url}
                                                alt={event.title}
                                                width={400}
                                                height={225}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                            />
                                        </div>
                                    )}
                                    <div className="p-4">
                                        <h4 className="font-semibold text-text group-hover:text-primary transition-colors">
                                            {event.title}
                                        </h4>
                                        <p className="text-sm text-text/60 mt-1">
                                            {event.location_name}
                                            {event.city && `, ${event.city}`}
                                        </p>
                                        <p className="text-xs text-text/40 mt-2">
                                            {new Date(
                                                event.start_date
                                            ).toLocaleDateString("en-US", {
                                                month: "short",
                                                day: "numeric",
                                                year: "numeric",
                                            })}
                                        </p>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : null,
        },
    }

    return (
        <section className="max-w-7xl mx-auto px-6 py-8">
            <div className="mb-6">
                <h3 className="text-lg font-semibold text-text">
                    Search Results for &ldquo;{searchQuery}&rdquo;
                </h3>
                <p className="text-sm text-text/60">
                    {totalResults} result{totalResults !== 1 ? "s" : ""} found
                </p>
            </div>

            <div className="space-y-10">
                {COMMUNITY_TAB_ORDER.filter(
                    (tab): tab is Exclude<CommunityTab, "leaderboard"> =>
                        tab !== "leaderboard"
                ).map((tab) => {
                    const config = sectionConfig[tab]
                    const content = config.render()
                    if (!content) return null

                    return (
                        <div key={tab}>
                            <div className="flex items-center gap-2 mb-4">
                                <config.icon className="w-5 h-5 text-primary" />
                                <h4 className="text-base font-semibold text-text">
                                    {config.label}
                                </h4>
                            </div>
                            {content}
                        </div>
                    )
                })}
            </div>
        </section>
    )
}

// User Card Component
function UserCard({ user }: { user: UserResult }) {
    return (
        <Link
            href={`/profile/${user.username}`}
            className='group flex flex-col items-center p-6 bg-background border border-secondary/20 rounded-2xl hover:border-primary/30 hover:shadow-lg transition-all text-center'
        >
            {/* Avatar */}
            <div className='relative mb-3'>
                {user.avatarUrl ? (
                    <Image
                        src={user.avatarUrl}
                        alt={user.displayName}
                        width={64}
                        height={64}
                        className='rounded-full'
                    />
                ) : (
                    <div className='w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center'>
                        <User className='w-8 h-8 text-primary' />
                    </div>
                )}
                {user.isSupporter && (
                    <div className='absolute -bottom-1 -right-1 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center'>
                        <Star className='w-3.5 h-3.5 text-white fill-white' />
                    </div>
                )}
            </div>

            {/* Name */}
            <h4 className='font-semibold text-text group-hover:text-primary transition-colors'>
                {user.displayName}
            </h4>
            <p className='text-sm text-text/50'>@{user.username}</p>

            {/* Bio */}
            {user.bio && (
                <p className='text-xs text-text/60 mt-2 line-clamp-2'>
                    {user.bio}
                </p>
            )}
        </Link>
    )
}
