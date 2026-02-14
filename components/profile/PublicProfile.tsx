"use client"

import { getPublicProfileData, type PublicProfileData } from "@/app/api/actions/profile"
import { getCafeThumbnailUrl } from "@/utils/extras"
import { ProfileWithBadges, Tables } from "@/utils/types/extra"
import { motion, AnimatePresence } from "motion/react"
import {
    Award,
    Camera,
    ChevronDown,
    Coffee,
    Compass,
    Layers,
    MapPin,
    Medal,
    MessageSquare,
    Share2,
    Shield,
    Sparkles,
    Trophy,
    User,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useAuth } from "@/components/layout/AuthProvider"
import ReviewItem from "@/components/reviews/ReviewItem"
import Passport from "@/components/profile/Passport"
import VisitHistory from "@/components/profile/VisitHistory"
import { getLucideIcon } from "@/components/badges/iconUtils"
import ContributionTimeline from "@/components/profile/ContributionTimeline"
import FollowButton from "@/components/social/FollowButton"
import FollowCounts from "@/components/social/FollowCounts"
import FollowListModal from "@/components/social/FollowListModal"
import CollectionCard from "@/components/collections/CollectionCard"

type BadgeDefinition = Tables<"badge_definitions">

// Scout rank display config with thresholds
const rankConfig = {
    novice: {
        label: "Novice",
        icon: User,
        color: "text-text/60",
        minPoints: 0,
        nextRank: "scout" as const,
    },
    scout: {
        label: "Scout",
        icon: Compass,
        color: "text-secondary",
        minPoints: 10,
        nextRank: "explorer" as const,
    },
    explorer: {
        label: "Explorer",
        icon: MapPin,
        color: "text-blue-500",
        minPoints: 30,
        nextRank: "expert" as const,
    },
    expert: {
        label: "Expert",
        icon: Medal,
        color: "text-primary",
        minPoints: 75,
        nextRank: "vanguard" as const,
    },
    vanguard: {
        label: "Vanguard",
        icon: Shield,
        color: "text-amber-600",
        minPoints: 150,
        nextRank: "legend" as const,
    },
    legend: {
        label: "Legend",
        icon: Trophy,
        color: "text-purple-500",
        minPoints: 300,
        nextRank: null,
    },
}

// Calculate progress to next rank
function getProgressToNextRank(
    currentPoints: number,
    currentRank: keyof typeof rankConfig
) {
    const config = rankConfig[currentRank]
    if (!config.nextRank)
        return { progress: 100, pointsNeeded: 0, nextRankLabel: null }

    const nextConfig = rankConfig[config.nextRank]
    const pointsInCurrentTier = currentPoints - config.minPoints
    const tierRange = nextConfig.minPoints - config.minPoints
    const progress = Math.min(
        100,
        Math.round((pointsInCurrentTier / tierRange) * 100)
    )
    const pointsNeeded = nextConfig.minPoints - currentPoints

    return { progress, pointsNeeded, nextRankLabel: nextConfig.label }
}

const staggerContainer = {
    animate: {
        transition: {
            staggerChildren: 0.1,
        },
    },
}

const item = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5 },
}

interface PublicProfileProps {
    profile: ProfileWithBadges
}

export default function PublicProfile({
    profile,
}: PublicProfileProps) {
    const { user } = useAuth()
    // States
    const [allBadges, setAllBadges] = useState<BadgeDefinition[]>([])
    const [loading, setLoading] = useState(true)
    const [reviews, setReviews] = useState<PublicProfileData["reviews"]>([])

    // Passport cafe data
    const [visitedCafes, setVisitedCafes] = useState<
        {
            name: string
            slug: string
            thumbnail: string | null
            visited_at: string | null
            badge_stamp_url?: string | null
        }[]
    >([])
    const [favoriteCafes, setFavoriteCafes] = useState<
        { name: string; slug: string }[]
    >([])
    const [wishlistCafes, setWishlistCafes] = useState<
        { name: string; slug: string }[]
    >([])

    // Collections data
    const [collections, setCollections] = useState<PublicProfileData["collections"]>([])

    // Badge display
    const [showAllBadges, setShowAllBadges] = useState(false)

    // Follow status
    const [isFollowingUser, setIsFollowingUser] = useState(false)
    const [followersCount, setFollowersCount] = useState(0)
    const [followingCount, setFollowingCount] = useState(0)

    // Modal state
    const [isFollowModalOpen, setIsFollowModalOpen] = useState(false)
    const [followModalType, setFollowModalType] = useState<
        "followers" | "following"
    >("followers")

    // Fetch all data in one call

    useEffect(() => {
        const fetchData = async () => {
            try {
                const data = await getPublicProfileData(profile, user?.id)
                setAllBadges(data.allBadges)
                setReviews(data.reviews)
                setVisitedCafes(data.passportCafes.visited)
                setFavoriteCafes(data.passportCafes.favorites)
                setWishlistCafes(data.passportCafes.wishlist)
                setCollections(data.collections || [])
            } catch (error) {
                console.error("Error fetching public profile details:", error)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [profile, user])

    // Check if current user follows this profile
    useEffect(() => {
        const checkFollowStatus = async () => {
            if (!user || user.id === profile.id) return
            try {
                const { isFollowing } = await import("@/app/api/actions/social")
                const following = await isFollowing(profile.id)
                setIsFollowingUser(following)
            } catch (error) {
                console.error("Error checking follow status:", error)
            }
        }
        checkFollowStatus()
    }, [user, profile.id])

    const stats = profile.stats
    const earnedBadgeIds = new Set(profile.badges.map((b) => b.badge_id))
    const RankIcon = stats?.scout_rank
        ? rankConfig[stats.scout_rank].icon
        : User

    if (loading) {
        return (
            <main className='w-full min-h-screen px-4 py-8'>
                <div className='max-w-7xl mx-auto'>
                    {/* Header skeleton */}
                    <div className='flex flex-col md:flex-row gap-6 items-center md:items-start'>
                        <div className='w-28 h-28 bg-text/10 rounded-full animate-pulse' />
                        <div className='flex-1 flex flex-col items-center md:items-start gap-3'>
                            <div className='h-8 w-48 bg-text/10 rounded-lg animate-pulse' />
                            <div className='h-5 w-32 bg-text/5 rounded-lg animate-pulse' />
                            <div className='h-4 w-64 bg-text/5 rounded-lg animate-pulse' />
                        </div>
                    </div>
                </div>
            </main>
        )
    }

    return (
        <main className='w-full min-h-screen px-4 py-8'>
            <motion.div
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                className='max-w-7xl mx-auto'
            >
                {/* Profile Header */}
                <motion.section variants={item} className='flex flex-col md:flex-row gap-6 items-center md:items-start'>
                    {/* Avatar */}
                    <div className='relative'>
                        <div className='w-28 h-28 rounded-full bg-linear-to-br from-primary/20 to-secondary/20 flex items-center justify-center overflow-hidden border-4 border-background relative'>
                            {profile.avatar_url ? (
                                <Image
                                    src={profile.avatar_url}
                                    alt={profile.display_name}
                                    fill
                                    className='object-cover'
                                />
                            ) : (
                                <User className='w-12 h-12 text-text/40' />
                            )}
                        </div>
                        {profile.is_supporter && (
                            <div
                                className='absolute -bottom-1 -right-1 bg-amber-500 text-white p-1.5 rounded-full shadow-lg'
                                title='Supporter'
                            >
                                <Sparkles className='w-4 h-4' />
                            </div>
                        )}
                    </div>

                    {/* Info */}
                    <div className='flex-1 flex flex-col items-center md:items-start gap-1'>
                        <div className='flex flex-row items-center gap-3'>
                            <h1 className='text-2xl md:text-3xl font-bold font-serif'>
                                {profile.display_name}
                            </h1>
                            <button
                                onClick={async () => {
                                    const profileUrl = `${window.location.origin}/profile/${profile.username}`
                                    if (navigator.share) {
                                        try {
                                            await navigator.share({
                                                title: `${profile.display_name}'s Coffee Profile`,
                                                text: `Check out ${profile.display_name}'s coffee journey!`,
                                                url: profileUrl,
                                            })
                                        } catch {
                                            // User cancelled or error
                                        }
                                    } else {
                                        await navigator.clipboard.writeText(
                                            profileUrl
                                        )
                                        alert(
                                            "Profile link copied to clipboard!"
                                        )
                                    }
                                }}
                                className='p-1.5 rounded-full hover:bg-text/10 transition-colors cursor-pointer'
                                title='Share Profile'
                            >
                                <Share2 className='w-4 h-4' />
                            </button>
                        </div>

                        <p className='text-text/60 font-medium'>
                            @{profile.username}
                        </p>

                        {/* Bio */}
                        <p className='text-text/80 mt-2 text-center md:text-left max-w-md'>
                            {profile.bio || "No bio yet"}
                        </p>

                        {/* Member Info */}
                        <div className='flex flex-row flex-wrap gap-3 mt-3 text-sm text-text/60'>
                            {profile.is_supporter && profile.support_since && (
                                <span className='flex items-center gap-1 text-amber-600 font-medium'>
                                    <Sparkles className='w-3.5 h-3.5' />
                                    Supporter since{" "}
                                    {new Date(
                                        profile.support_since
                                    ).toLocaleDateString("en-US", {
                                        month: "short",
                                        year: "numeric",
                                    })}
                                </span>
                            )}
                            {profile.created_at && (
                                <span>
                                    Member since{" "}
                                    {new Date(
                                        profile.created_at
                                    ).toLocaleDateString("en-US", {
                                        month: "short",
                                        year: "numeric",
                                    })}
                                </span>
                            )}
                        </div>

                        {/* Follow Counts */}
                        <div className='mt-3'>
                            <FollowCounts
                                userId={profile.id}
                                username={profile.username}
                                followersCount={followersCount}
                                followingCount={followingCount}
                                onCountsChange={(followers, following) => {
                                    setFollowersCount(followers)
                                    setFollowingCount(following)
                                }}
                                onFollowersClick={() => {
                                    setFollowModalType("followers")
                                    setIsFollowModalOpen(true)
                                }}
                                onFollowingClick={() => {
                                    setFollowModalType("following")
                                    setIsFollowModalOpen(true)
                                }}
                            />
                        </div>

                        {/* Follow Button (only show if viewing another user's profile) */}
                        {user && user.id !== profile.id && (
                            <div className='mt-3'>
                                <FollowButton
                                    targetUserId={profile.id}
                                    initialIsFollowing={isFollowingUser}
                                    size='md'
                                    onFollowChange={(following) => {
                                        setIsFollowingUser(following)
                                        setFollowersCount((prev) =>
                                            following ? prev + 1 : prev - 1
                                        )
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </motion.section>

                {/* Badges Collection - Passport Style */}
                <motion.section variants={item} className='mt-10'>
                    <div className='flex items-center gap-2 mb-4'>
                        <Medal className='w-5 h-5' />
                        <h2 className='text-xl font-semibold font-serif'>
                            Badge Collection
                        </h2>
                        <span className='ml-auto bg-primary/15 text-primary text-sm font-bold px-2.5 py-1 rounded-full'>
                            {profile.badges.length}/{allBadges.length}
                        </span>
                    </div>

                    {/* Showcase Container */}
                    <div className='bg-text/5 border border-text/10 rounded-xl min-h-max relative p-6'>
                        {/* Background Texture */}
                        <div
                            className='absolute inset-0 opacity-[0.03] pointer-events-none rounded-xl'
                            style={{
                                backgroundImage: `radial-gradient(circle at 2px 2px, theme("colors.background") 1px, transparent 0)`,
                                backgroundSize: "24px 24px",
                            }}
                        />

                        {(() => {
                            // Sort badges: earned first, then by rarity (legendary > rare > common)
                            const rarityOrder = {
                                legendary: 0,
                                rare: 1,
                                common: 2,
                            }
                            const sortedBadges = [...allBadges].sort((a, b) => {
                                const aEarned = earnedBadgeIds.has(a.id)
                                const bEarned = earnedBadgeIds.has(b.id)
                                if (aEarned !== bEarned) return aEarned ? -1 : 1
                                return (
                                    rarityOrder[a.rarity] -
                                    rarityOrder[b.rarity]
                                )
                            })

                            const earnedBadges = sortedBadges.filter((b) =>
                                earnedBadgeIds.has(b.id)
                            )
                            const unearnedBadges = sortedBadges.filter(
                                (b) => !earnedBadgeIds.has(b.id)
                            )
                            const displayBadges = showAllBadges
                                ? sortedBadges
                                : earnedBadges

                            const rarityStyles = {
                                common: "border-2 border-text/30",
                                rare: "border-2 border-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.4)]",
                                legendary:
                                    "border-2 border-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.5)]",
                            }

                            if (earnedBadges.length === 0 && !showAllBadges) {
                                return (
                                    <div className='flex flex-col items-center justify-center py-12 text-center opacity-60'>
                                        <Award className='w-16 h-16 text-text/20 mb-4' />
                                        <p className='text-lg font-medium'>
                                            No badges yet
                                        </p>
                                        <p className='text-sm text-text/60 max-w-xs'>
                                            Badges are earned by exploring cafes
                                            and engaging with the community!
                                        </p>
                                        {unearnedBadges.length > 0 && (
                                            <button
                                                onClick={() =>
                                                    setShowAllBadges(true)
                                                }
                                                className='mt-4 text-sm text-primary hover:underline cursor-pointer'
                                            >
                                                View all {allBadges.length}{" "}
                                                badges
                                            </button>
                                        )}
                                    </div>
                                )
                            }

                            return (
                                <>
                                    <motion.div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-6'>
                                        <AnimatePresence mode='popLayout'>
                                            {displayBadges.map((badge) => {
                                                const isEarned =
                                                    earnedBadgeIds.has(badge.id)

                                                return (
                                                    <motion.div
                                                        key={badge.id}
                                                        initial={{
                                                            opacity: 0,
                                                            scale: 0.8,
                                                        }}
                                                        animate={{
                                                            opacity: 1,
                                                            scale: 1,
                                                        }}
                                                        exit={{
                                                            opacity: 0,
                                                            scale: 0.8,
                                                        }}
                                                        whileHover={{
                                                            scale: isEarned
                                                                ? 1.1
                                                                : 1.02,
                                                        }}
                                                        className='group relative flex flex-col items-center cursor-default'
                                                    >
                                                        {/* Badge Circle */}
                                                        <div
                                                            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden flex items-center justify-center bg-background transition-all ${
                                                                isEarned
                                                                    ? rarityStyles[
                                                                          badge
                                                                              .rarity
                                                                      ]
                                                                    : "border-2 border-dashed border-text/20 opacity-40 grayscale"
                                                            }`}
                                                        >
                                                            {(() => {
                                                                // Check for icon in metadata
                                                                const metadata =
                                                                    badge.metadata as {
                                                                        icon_name?: string
                                                                        icon_color?: string
                                                                    } | null
                                                                const iconName =
                                                                    metadata?.icon_name
                                                                const iconColor =
                                                                    metadata?.icon_color ||
                                                                    "#8B4513"
                                                                const IconComponent =
                                                                    iconName
                                                                        ? getLucideIcon(
                                                                              iconName
                                                                          )
                                                                        : null

                                                                if (
                                                                    IconComponent
                                                                ) {
                                                                    return (
                                                                        <IconComponent
                                                                            style={{
                                                                                color: iconColor,
                                                                            }}
                                                                            className='w-7 h-7'
                                                                        />
                                                                    )
                                                                } else if (
                                                                    badge.image_url
                                                                ) {
                                                                    return (
                                                                        <Image
                                                                            src={
                                                                                badge.image_url
                                                                            }
                                                                            alt={
                                                                                badge.name
                                                                            }
                                                                            width={
                                                                                48
                                                                            }
                                                                            height={
                                                                                48
                                                                            }
                                                                            className='object-contain'
                                                                            unoptimized
                                                                        />
                                                                    )
                                                                } else {
                                                                    return (
                                                                        <Award
                                                                            className={`w-7 h-7 ${isEarned ? "text-primary" : "text-text/20"}`}
                                                                        />
                                                                    )
                                                                }
                                                            })()}
                                                        </div>

                                                        {/* Badge Name */}
                                                        <span
                                                            className={`text-[11px] font-semibold mt-2 text-center line-clamp-2 leading-tight max-w-[70px] ${
                                                                isEarned
                                                                    ? "text-text"
                                                                    : "text-text/40"
                                                            }`}
                                                        >
                                                            {badge.name}
                                                        </span>

                                                        {/* Hover Tooltip */}
                                                        <div className='absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10'>
                                                            <div className='bg-text text-background text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap max-w-[200px]'>
                                                                {/* Rarity */}
                                                                <div
                                                                    className={`text-[10px] font-bold uppercase tracking-wide ${
                                                                        badge.rarity ===
                                                                        "legendary"
                                                                            ? "text-amber-300"
                                                                            : badge.rarity ===
                                                                                "rare"
                                                                              ? "text-blue-300"
                                                                              : "text-background/70"
                                                                    }`}
                                                                >
                                                                    {
                                                                        badge.rarity
                                                                    }
                                                                </div>
                                                                {/* Description */}
                                                                <div className='text-background/80 text-[10px] mt-1 whitespace-normal'>
                                                                    {
                                                                        badge.description
                                                                    }
                                                                </div>
                                                                {/* Earned at (for earned badges) */}
                                                                {isEarned &&
                                                                    (() => {
                                                                        const earnedBadge =
                                                                            profile.badges.find(
                                                                                (
                                                                                    b
                                                                                ) =>
                                                                                    b.badge_id ===
                                                                                    badge.id
                                                                            )
                                                                        if (
                                                                            earnedBadge?.awarded_at
                                                                        ) {
                                                                            return (
                                                                                <div className='text-background/50 text-[10px] mt-1'>
                                                                                    Earned:{" "}
                                                                                    {new Date(
                                                                                        earnedBadge.awarded_at
                                                                                    ).toLocaleDateString(
                                                                                        "en-US",
                                                                                        {
                                                                                            month: "short",
                                                                                            day: "numeric",
                                                                                            year: "numeric",
                                                                                        }
                                                                                    )}
                                                                                </div>
                                                                            )
                                                                        }
                                                                        return null
                                                                    })()}
                                                                {!isEarned && (
                                                                    <div className='text-background/40 text-[10px] mt-1 italic'>
                                                                        Not
                                                                        earned
                                                                        yet
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className='w-2 h-2 bg-text rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1' />
                                                        </div>
                                                    </motion.div>
                                                )
                                            })}
                                        </AnimatePresence>
                                    </motion.div>

                                    {/* Toggle button */}
                                    {unearnedBadges.length > 0 && (
                                        <button
                                            onClick={() =>
                                                setShowAllBadges(!showAllBadges)
                                            }
                                            className='mt-6 flex items-center gap-1 mx-auto text-sm text-text/60 hover:text-text transition-colors cursor-pointer'
                                        >
                                            {showAllBadges ? (
                                                <>Hide unearned</>
                                            ) : (
                                                <>
                                                    Show all {allBadges.length}{" "}
                                                    badges
                                                </>
                                            )}
                                            <ChevronDown
                                                className={`w-4 h-4 transition-transform ${showAllBadges ? "rotate-180" : ""}`}
                                            />
                                        </button>
                                    )}
                                </>
                            )
                        })()}
                    </div>
                </motion.section>

                {/* Stats Grid */}
                <motion.section variants={item} className='mt-10'>
                    <h2 className='text-xl font-semibold font-serif mb-4 flex items-center gap-2'>
                        <Award className='w-5 h-5' />
                        Stats
                    </h2>
                    <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                        {/* Scout Rank with Points & Progress */}
                        {(() => {
                            const currentRank = stats?.scout_rank || "novice"
                            const currentPoints = stats?.activity_points ?? 0
                            const { progress, pointsNeeded, nextRankLabel } =
                                getProgressToNextRank(
                                    currentPoints,
                                    currentRank
                                )

                            return (
                                <motion.div whileHover={{ scale: 1.05, y: -2 }} className='bg-text/5 border border-text/10 rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all hover:border-text/20'>
                                    <div
                                        className={`p-2 rounded-lg mb-2 bg-secondary/10`}
                                    >
                                        <RankIcon
                                            className={`w-6 h-6 ${stats?.scout_rank ? rankConfig[stats.scout_rank].color : "text-text/40"}`}
                                        />
                                    </div>
                                    <span className='text-lg font-bold capitalize'>
                                        {currentRank}
                                    </span>
                                    {nextRankLabel && (
                                        <div
                                            className='w-full mt-2'
                                            title={`Current points: ${currentPoints}`}
                                        >
                                            <div className='w-full h-1.5 bg-text/10 rounded-full overflow-hidden'>
                                                <div
                                                    className='h-full bg-primary rounded-full transition-all duration-500'
                                                    style={{
                                                        width: `${progress}%`,
                                                    }}
                                                />
                                            </div>
                                            <p className='text-[10px] text-text/50 mt-1'>
                                                {pointsNeeded} points to{" "}
                                                {nextRankLabel}
                                            </p>
                                        </div>
                                    )}
                                    {!nextRankLabel && (
                                        <span className='text-[10px] text-text/50 mt-1'>
                                            Max Rank!
                                        </span>
                                    )}
                                </motion.div>
                            )
                        })()}
                        {/* Reviews */}
                        <motion.a
                            whileHover={{ scale: 1.05, y: -2 }}
                            href='#reviews'
                            className='bg-text/5 border border-text/10 rounded-xl p-4 flex flex-col items-center justify-center text-center hover:border-text/20 transition-all'
                        >
                            <div className='p-2 bg-primary/10 rounded-lg mb-2'>
                                <MessageSquare className='w-6 h-6' />
                            </div>
                            <span className='text-2xl font-bold'>
                                {stats?.total_reviews ?? 0}
                            </span>
                            <span className='text-xs text-text/60'>
                                Reviews
                            </span>
                        </motion.a>
                        {/* Photos */}
                        <motion.div whileHover={{ scale: 1.05, y: -2 }} className='bg-text/5 border border-text/10 rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all hover:border-text/20'>
                            <div className='p-2 bg-secondary/10 rounded-lg mb-2'>
                                <Camera className='w-6 h-6' />
                            </div>
                            <span className='text-2xl font-bold'>
                                {stats?.total_photos ?? 0}
                            </span>
                            <span className='text-xs text-text/60'>Photos</span>
                        </motion.div>
                        {/* Scouted */}
                        <motion.div whileHover={{ scale: 1.05, y: -2 }} className='bg-text/5 border border-text/10 rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all hover:border-text/20'>
                            <div className='p-2 bg-secondary/10 rounded-lg mb-2'>
                                <Coffee className='w-6 h-6' />
                            </div>
                            <span className='text-2xl font-bold'>
                                {stats?.total_scouted ?? 0}
                            </span>
                            <span className='text-xs text-text/60'>
                                Scouted
                            </span>
                        </motion.div>
                    </div>
                </motion.section>

                {/* Visit History Section */}
                <motion.section variants={item} className='mt-10'>
                    <VisitHistory
                        visits={visitedCafes}
                        isPublic={true}
                    />
                </motion.section>

                {/* Passport Section */}
                <motion.section variants={item} className='mt-10'>
                    <Passport
                        visited={visitedCafes.map((c) => ({
                            name: c.name,
                            slug: c.slug,
                            badge_stamp_url: c.badge_stamp_url,
                        }))}
                        favorites={favoriteCafes}
                        wishlist={wishlistCafes}
                    />
                </motion.section>

                {/* Collections Section */}
                <motion.section variants={item} className='mt-10'>
                    <div className='flex items-center gap-2 mb-4'>
                        <Layers className='w-5 h-5' />
                        <h2 className='text-xl font-semibold font-serif'>
                            Collections
                        </h2>
                        <span className='ml-auto bg-primary/15 text-primary text-sm font-bold px-2.5 py-1 rounded-full'>
                            {collections.length}
                        </span>
                    </div>

                    {collections.length > 0 ? (
                        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
                            {collections.map((collection) => (
                                <CollectionCard
                                    key={collection.id}
                                    collection={collection}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className='text-center py-10 bg-text/5 rounded-xl border border-text/10'>
                            <Layers className='w-12 h-12 mx-auto text-text/20 mb-3' />
                            <p className='text-text/60 font-medium'>
                                No public collections yet
                            </p>
                        </div>
                    )}
                </motion.section>

                {/* Contribution History */}
                <motion.section variants={item} className='mt-10 bg-text/5 border border-text/10 rounded-xl'>
                    <ContributionTimeline userId={profile.id} />
                </motion.section>

                {/* Reviews Section */}
                <motion.section
                    variants={item}
                    id='reviews'
                    className='mt-10'
                >
                    <h2 className='text-xl font-semibold font-serif mb-4 flex items-center gap-2'>
                        {reviews.length > 0 ? (
                            <>
                                <MessageSquare className='w-5 h-5' />
                                Reviews
                                <span className='text-sm font-normal text-text/60'>
                                    ({reviews.length})
                                </span>
                            </>
                        ) : (
                            "Reviews"
                        )}
                    </h2>

                    {reviews.length > 0 ? (
                        <div className='flex flex-col gap-6'>
                            {reviews.map((review) => (
                                <motion.div
                                    key={review.id}
                                    whileHover={{ scale: 1.01, y: -1 }}
                                    className='bg-text/5 border border-text/10 rounded-xl p-5 flex flex-col gap-4 transition-all hover:border-text/20'
                                >
                                    {/* Cafe info line - Added Link and visual context */}
                                    <div className='flex items-center gap-2 pb-4 border-b border-text/10'>
                                        <div className='relative w-10 h-10 rounded-lg overflow-hidden shrink-0'>
                                            {review.cafe?.thumbnail ? (
                                                <Image
                                                    src={getCafeThumbnailUrl(
                                                        review.cafe.thumbnail
                                                    )}
                                                    alt={review.cafe.name}
                                                    fill
                                                    className='object-cover'
                                                />
                                            ) : (
                                                <div className='w-full h-full bg-secondary/20 flex items-center justify-center'>
                                                    <Coffee className='w-5 h-5 text-secondary' />
                                                </div>
                                            )}
                                        </div>
                                        <div className='flex flex-col'>
                                            <span className='text-xs text-text/60'>
                                                Review for
                                            </span>
                                            <Link
                                                href={`/cafes/${review.cafe.slug}`}
                                                className='font-bold text-lg hover:text-primary transition-colors leading-tight'
                                            >
                                                {review.cafe.name}
                                            </Link>
                                        </div>
                                    </div>

                                    <ReviewItem
                                        review={{
                                            ...review,
                                            author: {
                                                display_name:
                                                    profile.display_name,
                                                username: profile.username,
                                                avatar_url: profile.avatar_url,
                                            },
                                            // Handle is_liked from our fetch
                                            review_interactions:
                                                review.is_liked && user
                                                    ? [{ user_id: user.id }]
                                                    : [],
                                        }}
                                        currentUser={user}
                                    />
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <div className='text-center py-10 bg-text/5 rounded-xl border border-text/10'>
                            <p className='text-text/60 font-medium'>
                                {profile.display_name} hasn&apos;t written any
                                reviews yet.
                            </p>
                        </div>
                    )}
                </motion.section>
            </motion.div>

            <FollowListModal
                isOpen={isFollowModalOpen}
                onClose={() => setIsFollowModalOpen(false)}
                userId={profile.id}
                username={profile.username}
                initialType={followModalType}
                currentUserId={user?.id}
            />
        </main>
    )
}
