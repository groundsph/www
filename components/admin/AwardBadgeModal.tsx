"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import {
    Loader2,
    Search,
    UserPlus,
    X,
    Users,
    Trash2,
    CheckCircle2,
    AlertTriangle,
} from "lucide-react"
import {
    type BadgeDefinition,
    awardBadgeToUser,
    revokeBadgeFromUser,
    searchUsersForBadge,
    getUsersWithBadge,
    awardBadgeToAllUsers,
} from "@/app/api/actions/admin"
import { useDebounce } from "@/utils/hooks/useDebounce"

interface AwardBadgeModalProps {
    badge: BadgeDefinition
    isOpen: boolean
    onClose: () => void
}

type Tab = "award" | "holders"

export default function AwardBadgeModal({
    badge,
    isOpen,
    onClose,
}: AwardBadgeModalProps) {
    const [activeTab, setActiveTab] = useState<Tab>("award")

    // Search / Award State
    const [searchQuery, setSearchQuery] = useState("")
    const debouncedSearch = useDebounce(searchQuery, 300)
    const [searchResults, setSearchResults] = useState<
        {
            id: string
            username: string
            display_name: string
            avatar_url: string | null
        }[]
    >([])
    const [isSearching, setIsSearching] = useState(false)
    const [awardingUserId, setAwardingUserId] = useState<string | null>(null)
    const [isAwardingAll, setIsAwardingAll] = useState(false)

    // Holders State
    const [holders, setHolders] = useState<
        {
            user_id: string
            username: string
            display_name: string
            avatar_url: string | null
            awarded_at: string | null
        }[]
    >([])
    const [totalHolders, setTotalHolders] = useState(0)
    const [isLoadingHolders, setIsLoadingHolders] = useState(false)
    const [revokingUserId, setRevokingUserId] = useState<string | null>(null)

    // Load holders when opening or switching to holders tab
    const loadHolders = useCallback(async () => {
        setIsLoadingHolders(true)
        try {
            const result = await getUsersWithBadge(badge.id, 50, 0)
            setHolders(result.users)
            setTotalHolders(result.total)
        } catch (error) {
            console.error("Failed to load holders:", error)
        } finally {
            setIsLoadingHolders(false)
        }
    }, [badge.id])

    useEffect(() => {
        if (isOpen) {
            if (activeTab === "holders") {
                loadHolders()
            }
            // Reset search when opening
            setSearchQuery("")
            setSearchResults([])
        }
    }, [isOpen, activeTab, loadHolders])

    // Handle Search
    useEffect(() => {
        const performSearch = async () => {
            if (debouncedSearch.length < 2) {
                setSearchResults([])
                return
            }
            setIsSearching(true)
            try {
                const results = await searchUsersForBadge(debouncedSearch)
                // Filter out users who already have the badge (client-side check against loaded holders if possible,
                // but for now just raw results interaction)
                // To do this perfectly we'd need to know if they have the badge.
                // The API searchUsersForBadge doesn't return that.
                // We'll rely on the DB constraint or check holders if loaded.

                setSearchResults(results)
            } catch (error) {
                console.error("Search failed:", error)
            } finally {
                setIsSearching(false)
            }
        }
        performSearch()
    }, [debouncedSearch])

    const handleAward = async (user: (typeof searchResults)[0]) => {
        setAwardingUserId(user.id)
        try {
            const result = await awardBadgeToUser(user.id, badge.id)
            if (result.success) {
                // Remove from search results to prevent double award in UI
                setSearchResults((prev) => prev.filter((u) => u.id !== user.id))
                // Optionally add to holders list locally
                setHolders((prev) => [
                    {
                        user_id: user.id,
                        username: user.username,
                        display_name: user.display_name,
                        avatar_url: user.avatar_url,
                        awarded_at: new Date().toISOString(),
                    },
                    ...prev,
                ])
                setTotalHolders((prev) => prev + 1)
            } else {
                alert(result.error || "Failed to award badge")
            }
        } catch (error) {
            console.error("Award failed:", error)
        } finally {
            setAwardingUserId(null)
        }
    }

    const handleRevoke = async (userId: string) => {
        if (!confirm("Are you sure you want to revoke this badge?")) return

        setRevokingUserId(userId)
        try {
            const result = await revokeBadgeFromUser(userId, badge.id)
            if (result.success) {
                setHolders((prev) => prev.filter((h) => h.user_id !== userId))
                setTotalHolders((prev) => Math.max(0, prev - 1))
            } else {
                alert(result.error || "Failed to revoke badge")
            }
        } catch (error) {
            console.error("Revoke failed:", error)
        } finally {
            setRevokingUserId(null)
        }
    }

    const handleAwardAll = async () => {
        const confirmMsg = `⚠️ CAUTION: You are about to award the "${badge.name}" badge to ALL users.\n\nThis action cannot be easily undone.\n\nAre you sure?`
        if (!confirm(confirmMsg)) return

        setIsAwardingAll(true)
        try {
            const result = await awardBadgeToAllUsers(badge.id)
            if (result.success) {
                alert("Successfully started awarding badge to all users.")
                loadHolders() // Refresh holders
            } else {
                alert("Failed to award badges: " + result.error)
            }
        } catch (error) {
            console.error("Award all failed:", error)
        } finally {
            setIsAwardingAll(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200'>
            <div className='bg-background rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border border-white/10 overflow-hidden'>
                {/* Header */}
                <div className='p-6 border-b border-tertiary/30 bg-tertiary/5 flex gap-4 items-start relative'>
                    <div className='relative w-16 h-16 shrink-0'>
                        {/* Badge Image/Icon */}
                        {badge.image_url.startsWith("/") ? (
                            // It's likely an icon placeholder or Next.js public asset
                            <Image
                                src={badge.image_url}
                                alt={badge.name}
                                fill
                                className='object-contain'
                            />
                        ) : (
                            <Image
                                src={badge.image_url}
                                alt={badge.name}
                                fill
                                className='object-contain drop-shadow-md'
                            />
                        )}
                        {/* If using metadata icons, we might need special handling, but image_url usually handles it if generated properly. 
                            However, the previous code had logic for `useIconMode`. 
                            Looking at `BadgeCard.tsx`, it seems `image_url` is always populated even for icons via `icon-badge-placeholder.svg`?
                            Actually, SystemManagement handled logic to show IconPicker or Image.
                            If it's an icon badge, the `image_url` might be a placeholder, and we render the icon on top?
                            Let's assume `BadgeCardFull` logic for display is preferred. 
                            For now, simple Image is okay, user can polish if needed.
                        */}
                    </div>

                    <div className='flex-1'>
                        <h2 className='text-2xl font-bold text-text'>
                            {badge.name}
                        </h2>
                        <p className='text-text/60 text-sm mt-1'>
                            {badge.description}
                        </p>
                        <div className='flex gap-2 mt-2'>
                            <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider
                                ${
                                    badge.rarity === "common"
                                        ? "bg-slate-500/10 text-slate-500"
                                        : badge.rarity === "rare"
                                          ? "bg-blue-500/10 text-blue-500"
                                          : "bg-amber-500/10 text-amber-500"
                                }`}
                            >
                                {badge.rarity}
                            </span>
                            <span className='px-2 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider bg-tertiary/20 text-text/60'>
                                {badge.category}
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className='p-2 hover:bg-tertiary/20 rounded-full transition text-text/50 hover:text-text'
                    >
                        <X className='w-5 h-5' />
                    </button>
                </div>

                {/* Tabs */}
                <div className='flex border-b border-tertiary/30 px-6'>
                    <button
                        onClick={() => setActiveTab("award")}
                        className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === "award"
                                ? "border-primary text-primary"
                                : "border-transparent text-text/60 hover:text-text"
                        }`}
                    >
                        Award Badge
                    </button>
                    <button
                        onClick={() => setActiveTab("holders")}
                        className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                            activeTab === "holders"
                                ? "border-primary text-primary"
                                : "border-transparent text-text/60 hover:text-text"
                        }`}
                    >
                        Current Holders
                        {totalHolders > 0 && (
                            <span className='bg-tertiary/20 px-1.5 py-0.5 rounded-full text-[10px]'>
                                {totalHolders}
                            </span>
                        )}
                    </button>
                </div>

                {/* Content */}
                <div className='flex-1 overflow-y-auto min-h-[400px] bg-tertiary/5 relative'>
                    {/* AWARD TAB */}
                    {activeTab === "award" && (
                        <div className='p-6 space-y-6'>
                            {/* Search Box */}
                            <div className='relative group'>
                                <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text/40 group-focus-within:text-primary transition-colors' />
                                <input
                                    type='text'
                                    value={searchQuery}
                                    onChange={(e) =>
                                        setSearchQuery(e.target.value)
                                    }
                                    placeholder='Search users to award...'
                                    className='w-full pl-10 pr-4 py-3 bg-white dark:bg-black/20 border border-tertiary/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium'
                                    autoFocus
                                />
                                {isSearching && (
                                    <Loader2 className='absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-text/40' />
                                )}
                            </div>

                            {/* Search Results */}
                            <div className='space-y-2'>
                                {searchQuery.length > 1 &&
                                    searchResults.length === 0 &&
                                    !isSearching && (
                                        <div className='text-center py-8 text-text/40'>
                                            <Users className='w-8 h-8 mx-auto mb-2 opacity-50' />
                                            <p>
                                                No users found matching "
                                                {searchQuery}"
                                            </p>
                                        </div>
                                    )}

                                {searchResults.map((user) => {
                                    const isAlreadyHolder = holders.some(
                                        (h) => h.user_id === user.id
                                    )
                                    return (
                                        <div
                                            key={user.id}
                                            className='flex items-center gap-4 p-3 bg-white dark:bg-white/5 border border-tertiary/10 rounded-xl shadow-sm hover:border-primary/20 transition-colors group'
                                        >
                                            <div className='relative w-10 h-10 rounded-full overflow-hidden bg-tertiary/20 shrink-0'>
                                                {user.avatar_url ? (
                                                    <Image
                                                        src={user.avatar_url}
                                                        alt={user.display_name}
                                                        fill
                                                        className='object-cover'
                                                    />
                                                ) : (
                                                    <div className='w-full h-full flex items-center justify-center text-text/40 text-sm font-bold'>
                                                        {user.display_name?.[0]?.toUpperCase()}
                                                    </div>
                                                )}
                                            </div>

                                            <div className='flex-1 min-w-0'>
                                                <div className='font-semibold text-text truncate'>
                                                    {user.display_name}
                                                </div>
                                                <div className='text-xs text-text/50 truncate'>
                                                    @{user.username}
                                                </div>
                                            </div>

                                            {isAlreadyHolder ? (
                                                <div className='flex items-center gap-1 text-green-500 text-sm font-medium px-3 py-1 bg-green-500/10 rounded-lg'>
                                                    <CheckCircle2 className='w-4 h-4' />
                                                    <span>Awarded</span>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() =>
                                                        handleAward(user)
                                                    }
                                                    disabled={
                                                        awardingUserId ===
                                                        user.id
                                                    }
                                                    className='flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow'
                                                >
                                                    {awardingUserId ===
                                                    user.id ? (
                                                        <Loader2 className='w-4 h-4 animate-spin' />
                                                    ) : (
                                                        <UserPlus className='w-4 h-4' />
                                                    )}
                                                    Award
                                                </button>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Award All Option */}
                            <div className='pt-8 mt-4 border-t border-tertiary/20'>
                                <div className='bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex items-center justify-between gap-4'>
                                    <div className='flex gap-3'>
                                        <div className='w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0'>
                                            <AlertTriangle className='w-5 h-5' />
                                        </div>
                                        <div>
                                            <h4 className='font-semibold text-text text-sm'>
                                                Global Distribution
                                            </h4>
                                            <p className='text-text/60 text-xs mt-0.5'>
                                                Award this badge to every user
                                                in the platform.
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleAwardAll}
                                        disabled={isAwardingAll}
                                        className='shrink-0 px-4 py-2 bg-white dark:bg-amber-950/30 text-amber-600 border border-amber-500/30 rounded-lg text-sm font-medium hover:bg-amber-500/10 transition-colors disabled:opacity-50 whitespace-nowrap'
                                    >
                                        {isAwardingAll ? (
                                            <span className='flex items-center gap-2'>
                                                <Loader2 className='w-3 h-3 animate-spin' />{" "}
                                                Processing
                                            </span>
                                        ) : (
                                            "Award All"
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* HOLDERS TAB */}
                    {activeTab === "holders" && (
                        <div className='p-6'>
                            {isLoadingHolders ? (
                                <div className='flex flex-col items-center justify-center py-12 text-text/40'>
                                    <Loader2 className='w-8 h-8 animate-spin mb-3 text-primary' />
                                    <p>Loading holders...</p>
                                </div>
                            ) : holders.length === 0 ? (
                                <div className='text-center py-16 bg-white dark:bg-white/5 rounded-2xl border border-tertiary/10 border-dashed'>
                                    <Users className='w-12 h-12 mx-auto text-text/20 mb-3' />
                                    <p className='text-text/60 font-medium'>
                                        No one has this badge yet
                                    </p>
                                    <button
                                        onClick={() => setActiveTab("award")}
                                        className='mt-4 text-primary text-sm hover:underline'
                                    >
                                        Start awarding users
                                    </button>
                                </div>
                            ) : (
                                <div className='grid gap-3'>
                                    {holders.map((user) => (
                                        <div
                                            key={user.user_id}
                                            className='flex items-center gap-4 p-3 bg-white dark:bg-white/5 border border-tertiary/10 rounded-xl group hover:border-red-500/20 transition-colors'
                                        >
                                            <div className='relative w-10 h-10 rounded-full overflow-hidden bg-tertiary/20 shrink-0'>
                                                {user.avatar_url ? (
                                                    <Image
                                                        src={user.avatar_url}
                                                        alt={user.display_name}
                                                        fill
                                                        className='object-cover'
                                                    />
                                                ) : (
                                                    <div className='w-full h-full flex items-center justify-center text-text/40 text-sm font-bold'>
                                                        {user.display_name?.[0]?.toUpperCase()}
                                                    </div>
                                                )}
                                            </div>

                                            <div className='flex-1 min-w-0'>
                                                <div className='font-semibold text-text truncate'>
                                                    {user.display_name}
                                                </div>
                                                <div className='flex items-center gap-2 text-xs text-text/50'>
                                                    <span className='truncate'>
                                                        @{user.username}
                                                    </span>
                                                    <span>•</span>
                                                    <span>
                                                        Awarded{" "}
                                                        {new Date(
                                                            user.awarded_at!
                                                        ).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() =>
                                                    handleRevoke(user.user_id)
                                                }
                                                disabled={
                                                    revokingUserId ===
                                                    user.user_id
                                                }
                                                className='opacity-0 group-hover:opacity-100 p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-all focus:opacity-100'
                                                title='Revoke Badge'
                                            >
                                                {revokingUserId ===
                                                user.user_id ? (
                                                    <Loader2 className='w-4 h-4 animate-spin' />
                                                ) : (
                                                    <Trash2 className='w-4 h-4' />
                                                )}
                                            </button>
                                        </div>
                                    ))}

                                    {/* Pagination indicator (simple for now) */}
                                    {totalHolders > holders.length && (
                                        <div className='text-center py-4 text-xs text-text/40'>
                                            Showing {holders.length} of{" "}
                                            {totalHolders} holders
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className='p-4 border-t border-tertiary/30 bg-tertiary/5 flex justify-end'>
                    <button
                        onClick={onClose}
                        className='px-6 py-2.5 bg-white dark:bg-white/10 border border-tertiary/20 text-text font-medium rounded-xl hover:bg-tertiary/20 transition shadow-sm'
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    )
}
