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
    Coffee,
    Heart,
    Eye,
    User,
    Loader2,
    Star,
} from "lucide-react"
import { getPublicCollections, searchUsers } from "@/app/api/actions/community"
import EventsPageClient from "@/components/events/EventsPageClient"
import { EventWithCafe } from "@/utils/types/extra"

type TabType = "collections" | "events" | "people"

interface PublicCollection {
    id: string
    title: string
    slug: string
    description: string | null
    coverImage: string | null
    itemCount: number
    viewsCount: number
    likesCount: number
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

interface CommunityPageClientProps {
    initialTab: string
    initialCollections: PublicCollection[]
    initialCollectionsTotal: number
    initialEvents: EventWithCafe[]
    initialFeaturedUsers: UserResult[]
}

export default function CommunityPageClient({
    initialTab,
    initialCollections,
    initialCollectionsTotal,
    initialEvents,
    initialFeaturedUsers,
}: CommunityPageClientProps) {
    const router = useRouter()
    const searchParamsHook = useSearchParams()

    const [activeTab, setActiveTab] = useState<TabType>(
        (initialTab as TabType) || "collections"
    )

    // Collections state
    const [collections, setCollections] = useState(initialCollections)
    const [collectionsTotal, setCollectionsTotal] = useState(
        initialCollectionsTotal
    )
    const [collectionsPage, setCollectionsPage] = useState(1)
    const [loadingCollections, setLoadingCollections] = useState(false)

    // People state
    const [userSearchQuery, setUserSearchQuery] = useState("")
    const [userResults, setUserResults] = useState<UserResult[]>([])
    const [featuredUsers] = useState(initialFeaturedUsers)
    const [searchingUsers, setSearchingUsers] = useState(false)

    // Sync tab with URL
    useEffect(() => {
        const tabParam = searchParamsHook.get("tab")
        if (
            tabParam &&
            ["collections", "events", "people"].includes(tabParam)
        ) {
            setActiveTab(tabParam as TabType)
        }
    }, [searchParamsHook])

    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab)
        router.push(`/community?tab=${tab}`, { scroll: false })
    }

    // Load more collections
    const loadMoreCollections = async () => {
        if (loadingCollections || collections.length >= collectionsTotal) return
        setLoadingCollections(true)
        try {
            const nextPage = collectionsPage + 1
            const data = await getPublicCollections(nextPage, 12, "recent")
            setCollections((prev) => [...prev, ...data.collections])
            setCollectionsPage(nextPage)
        } catch (err) {
            console.error("Failed to load more collections:", err)
        } finally {
            setLoadingCollections(false)
        }
    }

    // Debounced user search
    useEffect(() => {
        if (userSearchQuery.length < 2) {
            setUserResults([])
            return
        }

        const timeoutId = setTimeout(async () => {
            setSearchingUsers(true)
            try {
                const results = await searchUsers(userSearchQuery)
                setUserResults(results)
            } catch (err) {
                console.error("Search failed:", err)
            } finally {
                setSearchingUsers(false)
            }
        }, 300)

        return () => clearTimeout(timeoutId)
    }, [userSearchQuery])

    const tabs = [
        { id: "collections" as TabType, label: "Collections", icon: Layers },
        { id: "events" as TabType, label: "Events", icon: Calendar },
        { id: "people" as TabType, label: "People", icon: Users },
    ]

    return (
        <div className='min-h-screen w-full bg-background'>
            {/* Hero */}
            <section className='relative bg-linear-to-br from-primary/10 via-secondary/5 to-tertiary/10 py-16 overflow-hidden'>
                <div className='absolute inset-0 pointer-events-none select-none overflow-hidden'>
                    <Coffee className='absolute -top-6 -right-6 w-48 h-48 text-primary/5 rotate-12' />
                    <Users className='absolute -bottom-12 -left-12 w-64 h-64 text-secondary opacity-5 -rotate-12' />
                </div>

                <div className='max-w-7xl mx-auto px-6 relative z-10'>
                    <span className='inline-block px-3 py-1 mb-4 bg-background/50 backdrop-blur-sm border border-text/5 rounded-full text-xs font-medium text-text/60 uppercase tracking-wider'>
                        Connect & Discover
                    </span>
                    <h1 className='text-5xl md:text-6xl font-bold font-serif text-text mb-4 tracking-tight'>
                        Community
                    </h1>
                    <p className='text-xl text-text/70 max-w-2xl font-light'>
                        Explore curated collections, discover events, and
                        connect with fellow coffee enthusiasts across the
                        Philippines.
                    </p>
                </div>
            </section>

            {/* Tabs */}
            <section className='sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-text/10'>
                <div className='max-w-7xl mx-auto px-6'>
                    <div className='flex gap-1 overflow-x-auto py-2'>
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
                </div>
            </section>

            {/* Tab Content */}
            {activeTab === "collections" && (
                <section className='max-w-7xl mx-auto px-6 py-8'>
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
                        {collections.map((collection) => (
                            <CollectionCard
                                key={collection.id}
                                collection={collection}
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

                    {collections.length === 0 && (
                        <div className='text-center py-16'>
                            <Layers className='w-16 h-16 text-secondary/40 mx-auto mb-4' />
                            <h3 className='text-xl font-serif font-semibold text-text mb-2'>
                                No collections yet
                            </h3>
                            <p className='text-text/60'>
                                Be the first to create a public collection!
                            </p>
                        </div>
                    )}
                </section>
            )}

            {activeTab === "events" && (
                <EventsPageClient
                    initialEvents={initialEvents}
                    embedded
                />
            )}

            {activeTab === "people" && (
                <section className='max-w-7xl mx-auto px-6 py-8'>
                    {/* Search */}
                    <div className='max-w-xl mx-auto mb-8'>
                        <div className='relative'>
                            <Search className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text/40' />
                            <input
                                type='text'
                                value={userSearchQuery}
                                onChange={(e) =>
                                    setUserSearchQuery(e.target.value)
                                }
                                placeholder='Search for coffee enthusiasts...'
                                className='w-full pl-12 pr-4 py-4 bg-background border border-secondary/30 rounded-2xl text-text placeholder:text-text/40 focus:outline-none focus:border-primary/50 transition-colors'
                            />
                            {searchingUsers && (
                                <Loader2 className='absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary animate-spin' />
                            )}
                        </div>
                    </div>

                    {/* Search Results */}
                    {userSearchQuery.length >= 2 ? (
                        <div>
                            <h3 className='text-lg font-semibold mb-4'>
                                Search Results ({userResults.length})
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
                            ) : !searchingUsers ? (
                                <p className='text-text/60 text-center py-8'>
                                    No users found matching &quot;
                                    {userSearchQuery}&quot;
                                </p>
                            ) : null}
                        </div>
                    ) : (
                        <div>
                            <h3 className='text-lg font-semibold mb-4'>
                                Featured Community Members
                            </h3>
                            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
                                {featuredUsers.map((user) => (
                                    <UserCard
                                        key={user.id}
                                        user={user}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </section>
            )}
        </div>
    )
}

// Collection Card Component
function CollectionCard({ collection }: { collection: PublicCollection }) {
    return (
        <Link
            href={`/community/${collection.slug}`}
            className='group block bg-background border border-secondary/20 rounded-2xl overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all'
        >
            {/* Cover */}
            <div className='relative aspect-16/10 bg-secondary/10'>
                {collection.coverImage ? (
                    <Image
                        src={collection.coverImage}
                        alt={collection.title}
                        fill
                        className='object-cover group-hover:scale-105 transition-transform duration-300'
                        sizes='(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw'
                    />
                ) : (
                    <div className='w-full h-full flex items-center justify-center bg-linear-to-br from-primary/20 to-accent/20'>
                        <Layers className='w-12 h-12 text-primary/40' />
                    </div>
                )}
            </div>

            {/* Content */}
            <div className='p-4'>
                <h3 className='font-serif font-semibold text-lg text-text group-hover:text-primary transition-colors line-clamp-1'>
                    {collection.title}
                </h3>
                {collection.description && (
                    <p className='text-sm text-text/60 line-clamp-2 mt-1'>
                        {collection.description}
                    </p>
                )}

                {/* Author */}
                <div className='flex items-center gap-2 mt-3'>
                    {collection.author.avatarUrl ? (
                        <Image
                            src={collection.author.avatarUrl}
                            alt={collection.author.displayName}
                            width={24}
                            height={24}
                            className='rounded-full'
                        />
                    ) : (
                        <div className='w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center'>
                            <User className='w-3 h-3 text-primary' />
                        </div>
                    )}
                    <span className='text-sm text-text/60'>
                        {collection.author.displayName}
                    </span>
                </div>

                {/* Stats */}
                <div className='flex items-center gap-4 mt-3 text-sm text-text/50'>
                    <span className='flex items-center gap-1'>
                        <Coffee className='w-3.5 h-3.5' />
                        {collection.itemCount}
                    </span>
                    <span className='flex items-center gap-1'>
                        <Eye className='w-3.5 h-3.5' />
                        {collection.viewsCount}
                    </span>
                    <span className='flex items-center gap-1'>
                        <Heart className='w-3.5 h-3.5' />
                        {collection.likesCount}
                    </span>
                </div>
            </div>
        </Link>
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
