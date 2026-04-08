"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Image from "next/image"
import { UserAvatar } from "@/components/ui/UserAvatar"
import { motion, AnimatePresence } from "motion/react"
import {
    Loader2,
    Search,
    UserPlus,
    X,
    Users,
    Trash2,
    AlertTriangle,
    Award,
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
import { getLucideIcon } from "@/components/badges/iconUtils"

interface AwardBadgeModalProps {
    badge: BadgeDefinition
    isOpen: boolean
    onClose: () => void
}

type Tab = "award" | "holders"

// Badge metadata structure for icon-based badges
interface BadgeMetadata {
    icon_name?: string
    icon_color?: string
}

const rarityStyles = {
    common: "border-2 border-text/20",
    rare: "border-2 border-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.4)]",
    legendary:
        "border-2 border-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.5)] animate-pulse",
}

export default function AwardBadgeModal({
    badge,
    isOpen,
    onClose,
}: AwardBadgeModalProps) {
    const [activeTab, setActiveTab] = useState<Tab>("award")

    // Check if this badge uses a Lucide icon
    const metadata = badge.metadata as BadgeMetadata | null | undefined
    const iconName = metadata?.icon_name
    const iconColor = metadata?.icon_color || "#8B4513"
    const IconComponent = useMemo(
        () => (iconName ? getLucideIcon(iconName) : null),
        [iconName]
    )

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
    const [holderSearchQuery, setHolderSearchQuery] = useState("")

    // Filter holders based on search
    const filteredHolders = useMemo(() => {
        if (!holderSearchQuery.trim()) return holders
        const query = holderSearchQuery.toLowerCase()
        return holders.filter(
            (h) =>
                h.display_name.toLowerCase().includes(query) ||
                h.username.toLowerCase().includes(query)
        )
    }, [holders, holderSearchQuery])

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
            // Load holders on open
            loadHolders()
            // Reset search when opening
            setSearchQuery("")
            setSearchResults([])
            setHolderSearchQuery("")
            setActiveTab("award")
        }
    }, [isOpen, loadHolders])

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
                // Filter out users who already have the badge
                const holderIds = new Set(holders.map((h) => h.user_id))
                const filtered = results.filter((u) => !holderIds.has(u.id))
                setSearchResults(filtered)
            } catch (error) {
                console.error("Search failed:", error)
            } finally {
                setIsSearching(false)
            }
        }
        performSearch()
    }, [debouncedSearch, holders])

    const handleAward = async (user: (typeof searchResults)[0]) => {
        setAwardingUserId(user.id)
        try {
            const result = await awardBadgeToUser(user.id, badge.id)
            if (result.success) {
                // Remove from search results
                setSearchResults((prev) => prev.filter((u) => u.id !== user.id))
                // Add to holders list
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

    const handleClose = () => {
        if (!awardingUserId && !revokingUserId && !isAwardingAll) {
            onClose()
        }
    }

    const getRarityColor = (rarity: string) => {
        switch (rarity) {
            case "legendary":
                return "bg-amber-500/20 text-amber-600"
            case "rare":
                return "bg-blue-500/20 text-blue-600"
            default:
                return "bg-text/10 text-text/60"
        }
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                        className='fixed inset-0 bg-black/60 backdrop-blur-sm h-svh z-50'
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className='fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-xl md:w-full bg-background rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[85vh]'
                    >
                        {/* Header */}
                        <div className='flex items-center justify-between p-4 border-b border-text/10'>
                            <div className='flex items-center gap-3'>
                                {/* Badge Icon/Image with rarity styling */}
                                <div
                                    className={`w-14 h-14 shrink-0 ${rarityStyles[badge.rarity]} rounded-full overflow-hidden bg-background flex items-center justify-center`}
                                >
                                    {IconComponent ? (
                                        <IconComponent
                                            style={{ color: iconColor }}
                                            className='w-7 h-7'
                                        />
                                    ) : badge.image_url ? (
                                        <Image
                                            src={badge.image_url}
                                            alt={badge.name}
                                            width={56}
                                            height={56}
                                            className='object-contain'
                                            unoptimized
                                        />
                                    ) : (
                                        <Award className='w-7 h-7 text-primary' />
                                    )}
                                </div>
                                <div>
                                    <h2 className='font-semibold text-lg'>
                                        {badge.name}
                                    </h2>
                                    <div className='flex items-center gap-2'>
                                        <span
                                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${getRarityColor(badge.rarity)}`}
                                        >
                                            {badge.rarity}
                                        </span>
                                        <span className='text-xs text-text/50'>
                                            {badge.category}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={handleClose}
                                className='p-2 rounded-lg hover:bg-text/10 transition-colors cursor-pointer'
                            >
                                <X className='w-5 h-5' />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className='flex border-b border-text/10'>
                            <button
                                onClick={() => setActiveTab("award")}
                                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                                    activeTab === "award"
                                        ? "border-primary text-primary"
                                        : "border-transparent text-text/60 hover:text-text"
                                }`}
                            >
                                Award Badge
                            </button>
                            <button
                                onClick={() => setActiveTab("holders")}
                                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                                    activeTab === "holders"
                                        ? "border-primary text-primary"
                                        : "border-transparent text-text/60 hover:text-text"
                                }`}
                            >
                                Holders
                                {totalHolders > 0 && (
                                    <span className='bg-text/10 px-1.5 py-0.5 rounded-full text-[10px]'>
                                        {totalHolders}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Content */}
                        <div className='flex-1 overflow-y-auto p-4'>
                            {/* AWARD TAB */}
                            {activeTab === "award" && (
                                <div className='space-y-4'>
                                    {/* Search Box */}
                                    <div className='relative'>
                                            <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text opacity-40' />
                                        <input
                                            type='text'
                                            value={searchQuery}
                                            onChange={(e) =>
                                                setSearchQuery(e.target.value)
                                            }
                                            placeholder='Search users by name or username...'
                                            className='w-full pl-10 pr-4 py-3 bg-text/5 border border-text/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm'
                                            autoFocus
                                        />
                                        {isSearching && (
                                            <Loader2 className='absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-text opacity-40' />
                                        )}
                                    </div>

                                    {/* Search Results */}
                                    <div className='space-y-2'>
                                        {searchQuery.length >= 2 &&
                                            searchResults.length === 0 &&
                                            !isSearching && (
                                                <div className='text-center py-8 text-text/40'>
                                                    <Users className='w-8 h-8 mx-auto mb-2 opacity-50' />
                                                    <p className='text-sm'>
                                                        No users found matching
                                                        &ldquo;{searchQuery}
                                                        &rdquo;
                                                    </p>
                                                </div>
                                            )}

                                        {searchResults.map((user) => (
                                            <div
                                                key={user.id}
                                                className='flex items-center gap-3 p-3 bg-text/5 border border-text/10 rounded-lg group'
                                            >
                                                <UserAvatar
                                                    src={user.avatar_url}
                                                    alt={user.display_name}
                                                    size={40}
                                                    className='shrink-0'
                                                />

                                                <div className='flex-1 min-w-0'>
                                                    <div className='font-medium text-sm truncate'>
                                                        {user.display_name}
                                                    </div>
                                                    <div className='text-xs text-text/50 truncate'>
                                                        @{user.username}
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() =>
                                                        handleAward(user)
                                                    }
                                                    disabled={
                                                        awardingUserId ===
                                                        user.id
                                                    }
                                                    className='flex items-center gap-2 px-3 py-1.5 bg-green-500/20 text-green-600 text-sm font-medium rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-50 cursor-pointer'
                                                >
                                                    {awardingUserId ===
                                                    user.id ? (
                                                        <Loader2 className='w-4 h-4 animate-spin' />
                                                    ) : (
                                                        <UserPlus className='w-4 h-4' />
                                                    )}
                                                    Award
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Award All Option */}
                                    <div className='pt-4 mt-4 border-t border-text/10'>
                                        <div className='bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3'>
                                            <div className='w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-600 shrink-0'>
                                                <AlertTriangle className='w-5 h-5' />
                                            </div>
                                            <div className='flex-1'>
                                                <h4 className='font-semibold text-sm'>
                                                    Global Distribution
                                                </h4>
                                                <p className='text-text/60 text-xs mt-0.5 mb-3'>
                                                    Award this badge to every
                                                    user in the platform. This
                                                    cannot be easily undone.
                                                </p>
                                                <button
                                                    onClick={handleAwardAll}
                                                    disabled={isAwardingAll}
                                                    className='px-4 py-2 bg-amber-500/20 text-amber-600 border border-amber-500/30 rounded-lg text-sm font-medium hover:bg-amber-500/30 transition-colors disabled:opacity-50 cursor-pointer'
                                                >
                                                    {isAwardingAll ? (
                                                        <span className='flex items-center gap-2'>
                                                            <Loader2 className='w-3 h-3 animate-spin' />{" "}
                                                            Processing...
                                                        </span>
                                                    ) : (
                                                        "Award to All Users"
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* HOLDERS TAB */}
                            {activeTab === "holders" && (
                                <div className='space-y-4'>
                                    {/* Holder Search */}
                                    {holders.length > 0 && (
                                        <div className='relative'>
                                        <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text opacity-40' />
                                            <input
                                                type='text'
                                                value={holderSearchQuery}
                                                onChange={(e) =>
                                                    setHolderSearchQuery(
                                                        e.target.value
                                                    )
                                                }
                                                placeholder='Filter holders...'
                                                className='w-full pl-10 pr-4 py-2.5 bg-text/5 border border-text/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm'
                                            />
                                        </div>
                                    )}

                                    {isLoadingHolders ? (
                                        <div className='flex flex-col items-center justify-center py-12 text-text/40'>
                                            <Loader2 className='w-8 h-8 animate-spin mb-3 text-primary' />
                                            <p className='text-sm'>
                                                Loading holders...
                                            </p>
                                        </div>
                                    ) : holders.length === 0 ? (
                                        <div className='text-center py-12 bg-text/5 rounded-xl border border-dashed border-text/20'>
                                            <Users className='w-10 h-10 mx-auto text-text opacity-20 mb-3' />
                                            <p className='text-text/60 font-medium text-sm'>
                                                No one has this badge yet
                                            </p>
                                            <button
                                                onClick={() =>
                                                    setActiveTab("award")
                                                }
                                                className='mt-3 text-primary text-sm hover:underline cursor-pointer'
                                            >
                                                Start awarding users
                                            </button>
                                        </div>
                                    ) : filteredHolders.length === 0 ? (
                                        <div className='text-center py-8 text-text/40'>
                                            <Users className='w-8 h-8 mx-auto mb-2 opacity-50' />
                                            <p className='text-sm'>
                                                No holders match &ldquo;
                                                {holderSearchQuery}&rdquo;
                                            </p>
                                        </div>
                                    ) : (
                                        <div className='space-y-2'>
                                            {filteredHolders.map((user) => (
                                                <div
                                                    key={user.user_id}
                                                    className='flex items-center gap-3 p-3 bg-text/5 border border-text/10 rounded-lg group hover:border-red-500/20 transition-colors'
                                                >
                                                    <UserAvatar
                                                        src={user.avatar_url}
                                                        alt={user.display_name}
                                                        size={40}
                                                        className='shrink-0'
                                                    />

                                                    <div className='flex-1 min-w-0'>
                                                        <div className='font-medium text-sm truncate'>
                                                            {user.display_name}
                                                        </div>
                                                        <div className='flex items-center gap-2 text-xs text-text/50'>
                                                            <span className='truncate'>
                                                                @{user.username}
                                                            </span>
                                                            {user.awarded_at && (
                                                                <>
                                                                    <span>
                                                                        •
                                                                    </span>
                                                                    <span>
                                                                        {new Date(
                                                                            user.awarded_at
                                                                        ).toLocaleDateString()}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={() =>
                                                            handleRevoke(
                                                                user.user_id
                                                            )
                                                        }
                                                        disabled={
                                                            revokingUserId ===
                                                            user.user_id
                                                        }
                                                        className='opacity-0 group-hover:opacity-100 p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-all focus:opacity-100 cursor-pointer'
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

                                            {/* Pagination indicator */}
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
                        <div className='p-4 border-t border-text/10'>
                            <button
                                onClick={handleClose}
                                className='w-full py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors cursor-pointer'
                            >
                                Done
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
