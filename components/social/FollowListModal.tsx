"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { X, Loader2, User, Search } from "lucide-react"
import { UserAvatar } from "@/components/ui/UserAvatar"
import Link from "next/link"
import FollowButton from "./FollowButton"
import { useDebounce } from "@/utils/hooks/useDebounce"

interface UserItem {
    id: string
    username: string
    displayName: string
    avatarUrl: string | null
}

interface FollowListModalProps {
    isOpen: boolean
    onClose: () => void
    userId: string
    initialType: "followers" | "following"
    username: string
    currentUserId?: string
}

export default function FollowListModal({
    isOpen,
    onClose,
    userId,
    initialType,
    username,
    currentUserId,
}: FollowListModalProps) {
    const [activeTab, setActiveTab] = useState<
        "followers" | "following" | "find"
    >(initialType)
    const [users, setUsers] = useState<UserItem[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [offset, setOffset] = useState(0)
    const [hasMore, setHasMore] = useState(true)
    const [currentUserFollowing, setCurrentUserFollowing] = useState<
        Record<string, boolean>
    >({})
    
    // Search state
    const [searchQuery, setSearchQuery] = useState("")
    const [searchResults, setSearchResults] = useState<UserItem[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const debouncedSearch = useDebounce(searchQuery, 500)

    const parentRef = useRef<HTMLDivElement>(null)
    const LIMIT = 20

    const virtualizer = useVirtualizer({
        count: users.length + (hasMore ? 1 : 0),
        getScrollElement: () => parentRef.current,
        estimateSize: () => 64,
        overscan: 3,
    })

    // Reset state when modal opens or tab changes
    useEffect(() => {
        if (isOpen) {
            setActiveTab(initialType)
            setSearchQuery("")
            setSearchResults([])
        }
    }, [isOpen, initialType])

    // Load current user
    useEffect(() => {
        const checkUser = async () => {
            // We can't easily get current user client-side without a hook or prop.
            // We'll trust the follow status check to handle it or assume the parent might need to pass it if critical.
            // For now, let's just use the API to check follow status which implicitly checks auth.
            // But to know if "Follow" button should be shown (not self), we need ID.
            // Let's defer to the fact that `PublicProfile` uses `useAuth`.
            // Ideally we should pass currentUserId as a prop.
            // For now, I'll fetch it or just handle "isFollowing" checks individually which will fail if not logged in.
        }
        checkUser()
    }, [])

    // Handle search
    useEffect(() => {
        const performSearch = async () => {
            if (activeTab !== "find" || !debouncedSearch.trim()) {
                setSearchResults([])
                return
            }

            if (debouncedSearch.length < 2) return

            setIsSearching(true)
            try {
                const { searchUsers, isFollowing } = await import(
                    "@/app/api/actions/social"
                )
                const result = await searchUsers(debouncedSearch)
                setSearchResults(result.users)

                // Check follow status
                const statuses: Record<string, boolean> = {}
                await Promise.all(
                    result.users.map(async (u) => {
                        const followResult = await isFollowing(u.id)
                        statuses[u.id] = followResult.isFollowing
                    })
                )
                setCurrentUserFollowing((prev) => ({ ...prev, ...statuses }))
            } catch (error) {
                console.error("Error searching users:", error)
            } finally {
                setIsSearching(false)
            }
        }

        performSearch()
    }, [debouncedSearch, activeTab])

    const loadUsers = useCallback(
        async (currentOffset: number, type: "followers" | "following") => {
            setIsLoading(true)
            try {
                const { getFollowers, getFollowing, isFollowing } =
                    await import("@/app/api/actions/social")

                let result
                if (type === "followers") {
                    result = await getFollowers(userId, LIMIT, currentOffset)
                } else {
                    result = await getFollowing(userId, LIMIT, currentOffset)
                }

                const newUsers = result.users

                if (newUsers.length < LIMIT) {
                    setHasMore(false)
                }

                setUsers((prev) =>
                    currentOffset === 0 ? newUsers : [...prev, ...newUsers]
                )

                // Check follow status for each user
                // Optimization: We could batch this, but for now individual checks or the button doing it itself.
                // However, FollowButton takes `initialIsFollowing`. We should verify this.
                // Let's do a batch check or just let the button handle it?
                // The existing pages did a loop. I'll do a loop.

                const statuses: Record<string, boolean> = {}
                await Promise.all(
                    newUsers.map(async (u) => {
                        const followResult = await isFollowing(u.id)
                        statuses[u.id] = followResult.isFollowing
                    })
                )

                setCurrentUserFollowing((prev) => ({ ...prev, ...statuses }))
            } catch (error) {
                console.error("Error loading users:", error)
            } finally {
                setIsLoading(false)
            }
        },
        [userId]
    )

    // Virtualizer-driven loading
    const lastItem = virtualizer.getVirtualItems().at(-1)
    useEffect(() => {
        if (
            lastItem &&
            lastItem.index >= users.length - 3 &&
            hasMore &&
            !isLoading &&
            activeTab !== "find"
        ) {
            const newOffset = offset + LIMIT
            setOffset(newOffset)
            loadUsers(newOffset, activeTab)
        }
    }, [lastItem, lastItem?.index, users.length, hasMore, isLoading, offset, activeTab, loadUsers])

    // Reset list when tab changes
    useEffect(() => {
        if (!isOpen) return
        
        if (activeTab === "find") {
            setUsers([])
            return
        }
        
        setUsers([])
        setOffset(0)
        setHasMore(true)
        loadUsers(0, activeTab)
    }, [activeTab, isOpen, loadUsers])

    if (!isOpen) return null

    return (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
            {/* Backdrop */}
            <div
                className='absolute inset-0 bg-black/50 backdrop-blur-sm'
                onClick={onClose}
            />

            {/* Modal */}
            <div className='relative bg-background rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[85vh]'>
                {/* Header */}
                <div className='flex items-center justify-between px-4 py-3 border-b border-text/10 bg-background/50 backdrop-blur-md rounded-t-2xl z-10 sticky top-0'>
                    <div className='flex-1 text-center font-bold text-lg capitalize'>
                        {username}
                    </div>
                    <button
                        onClick={onClose}
                        className='absolute right-4 p-2 hover:bg-text/5 rounded-full transition-colors'
                    >
                        <X className='w-5 h-5' />
                    </button>
                    {/* Fake back button for centering title if needed, or just Absolute centering */}
                </div>

                {/* Tabs */}
                <div className='flex border-b border-text/10'>
                    <button
                        onClick={() => setActiveTab("followers")}
                        className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${
                            activeTab === "followers"
                                ? "text-primary"
                                : "text-text/60 hover:text-text"
                        }`}
                    >
                        Followers
                        {activeTab === "followers" && (
                            <div className='absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full' />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab("following")}
                        className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${
                            activeTab === "following"
                                ? "text-primary"
                                : "text-text/60 hover:text-text"
                        }`}
                    >
                        Following
                        {activeTab === "following" && (
                            <div className='absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full' />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab("find")}
                        className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${
                            activeTab === "find"
                                ? "text-primary"
                                : "text-text/60 hover:text-text"
                        }`}
                    >
                        Find People
                        {activeTab === "find" && (
                            <div className='absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full' />
                        )}
                    </button>
                </div>

                {/* Search Bar */}
                {activeTab === "find" && (
                    <div className="p-4 pb-0">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text opacity-40" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search users..."
                                className="w-full pl-9 pr-4 py-2 bg-text/5 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                autoFocus
                            />
                        </div>
                    </div>
                )}

                {/* List */}
                <div
                    ref={parentRef}
                    className='flex-1 overflow-y-auto min-h-[300px]'
                    style={{ height: "100%", overflow: "auto" }}
                >
                    {activeTab === "find" ? (
                        <>
                            {isSearching ? (
                                <div className='py-12 flex justify-center'>
                                    <Loader2 className='w-6 h-6 animate-spin text-primary opacity-50' />
                                </div>
                            ) : searchResults.length === 0 ? (
                                <div className='flex flex-col items-center justify-center py-12 text-center opacity-60'>
                                    <Search className='w-12 h-12 text-text opacity-20 mb-3' />
                                    <p className='text-sm'>
                                        {searchQuery.trim().length === 0
                                            ? "Search for people to follow"
                                            : "No users found"}
                                    </p>
                                </div>
                            ) : (
                                <div className='divide-y divide-text/5'>
                                    {searchResults.map((user) => (
                                        <div
                                            key={user.id}
                                            className='flex items-center gap-3 p-4 hover:bg-text/5 transition-colors'
                                        >
                                            <Link
                                                href={`/profile/${user.username}`}
                                                onClick={onClose}
                                                className='shrink-0'
                                            >
                                                <UserAvatar
                                                src={user.avatarUrl}
                                                alt={user.displayName}
                                                size={40}
                                            />
                                            </Link>
                                            <div className='flex-1 min-w-0'>
                                                <Link
                                                    href={`/profile/${user.username}`}
                                                    onClick={onClose}
                                                    className='font-semibold text-sm hover:underline truncate block'
                                                >
                                                    {user.displayName}
                                                </Link>
                                                <p className='text-xs text-text/50 truncate'>
                                                    @{user.username}
                                                </p>
                                            </div>
                                            <FollowButton
                                                targetUserId={user.id}
                                                initialIsFollowing={
                                                    currentUserFollowing[
                                                        user.id
                                                    ] ?? false
                                                }
                                                size='sm'
                                                onFollowChange={(
                                                    isFollowing
                                                ) => {
                                                    setCurrentUserFollowing(
                                                        (prev) => ({
                                                            ...prev,
                                                            [user.id]:
                                                                isFollowing,
                                                        })
                                                    )
                                                }}
                                                className={
                                                    currentUserId === user.id
                                                        ? "invisible"
                                                        : ""
                                                }
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            {users.length === 0 && !isLoading ? (
                                <div className='flex flex-col items-center justify-center py-12 text-center opacity-60'>
                                    <User className='w-12 h-12 text-text opacity-20 mb-3' />
                                    <p className='text-sm'>
                                        {activeTab === "followers"
                                            ? "No followers yet"
                                            : "Not following anyone"}
                                    </p>
                                </div>
                            ) : (
                                <div
                                    style={{
                                        height: `${virtualizer.getTotalSize()}px`,
                                        width: "100%",
                                        position: "relative",
                                    }}
                                >
                                    {virtualizer.getVirtualItems().map((virtualItem) => {
                                        const isLoaderRow = virtualItem.index >= users.length

                                        if (isLoaderRow) {
                                            return (
                                                <div
                                                    key="loader"
                                                    style={{
                                                        position: "absolute",
                                                        top: 0,
                                                        left: 0,
                                                        width: "100%",
                                                        height: `${virtualItem.size}px`,
                                                        transform: `translateY(${virtualItem.start}px)`,
                                                    }}
                                                    className="flex items-center justify-center py-4"
                                                >
                                                    {isLoading && <Loader2 className="w-5 h-5 animate-spin text-text/60" />}
                                                </div>
                                            )
                                        }

                                        const user = users[virtualItem.index]
                                        return (
                                            <div
                                                key={user.id}
                                                ref={virtualizer.measureElement}
                                                data-index={virtualItem.index}
                                                style={{
                                                    position: "absolute",
                                                    top: 0,
                                                    left: 0,
                                                    width: "100%",
                                                    height: `${virtualItem.size}px`,
                                                    transform: `translateY(${virtualItem.start}px)`,
                                                }}
                                            >
                                                <div className='flex items-center gap-3 p-4 hover:bg-text/5 transition-colors h-full border-b border-text/5'>
                                                    <Link
                                                        href={`/profile/${user.username}`}
                                                        onClick={onClose}
                                                        className='shrink-0'
                                                    >
                                                    <UserAvatar
                                                        src={user.avatarUrl}
                                                        alt={user.displayName}
                                                        size={40}
                                                    />
                                                    </Link>
                                                    <div className='flex-1 min-w-0'>
                                                        <Link
                                                            href={`/profile/${user.username}`}
                                                            onClick={onClose}
                                                            className='font-semibold text-sm hover:underline truncate block'
                                                        >
                                                            {user.displayName}
                                                        </Link>
                                                        <p className='text-xs text-text/50 truncate'>
                                                            @{user.username}
                                                        </p>
                                                    </div>
                                                    <FollowButton
                                                        targetUserId={user.id}
                                                        initialIsFollowing={
                                                            currentUserFollowing[
                                                                user.id
                                                            ] ?? false
                                                        }
                                                        size='sm'
                                                        onFollowChange={(
                                                            isFollowing
                                                        ) => {
                                                            setCurrentUserFollowing(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    [user.id]:
                                                                        isFollowing,
                                                                })
                                                            )
                                                        }}
                                                        className={
                                                            currentUserId === user.id
                                                                ? "invisible"
                                                                : ""
                                                        }
                                                    />
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
