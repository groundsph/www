"use client"

import {
    getAllBadges,
    getCafesByIds,
    getUserReviews,
} from "@/app/api/actions/profile"
import { ProfileWithBadges, Tables } from "@/utils/types/extra"
import { motion } from "motion/react"
import {
    Award,
    Camera,
    Check,
    Coffee,
    Heart,
    MapPin,
    Medal,
    MessageSquare,
    Shield,
    Sparkles,
    Star,
    User,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import MarkdownRender from "@/components/MarkdownRender"

type BadgeDefinition = Tables<"badge_definitions">

// Scout rank display config
const rankConfig = {
    novice: { label: "Novice Scout", icon: User, color: "text-secondary" },
    expert: { label: "Expert Scout", icon: Medal, color: "text-primary" },
    vanguard: {
        label: "Vanguard Scout",
        icon: Shield,
        color: "text-amber-600",
    },
}

interface PublicProfileClientProps {
    profile: ProfileWithBadges
}

export default function PublicProfileClient({
    profile,
}: PublicProfileClientProps) {
    // States
    const [allBadges, setAllBadges] = useState<BadgeDefinition[]>([])
    const [loading, setLoading] = useState(true)
    const [reviews, setReviews] = useState<any[]>([])

    // Passport cafe data
    const [visitedCafes, setVisitedCafes] = useState<
        { name: string; slug: string }[]
    >([])
    const [wishlistCafes, setWishlistCafes] = useState<
        { name: string; slug: string }[]
    >([])

    // Fetch extra data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [badges, userReviews, visited, wishlist] =
                    await Promise.all([
                        getAllBadges(),
                        getUserReviews(profile.id),
                        getCafesByIds(profile.passport?.visited_ids || []),
                        getCafesByIds(profile.passport?.wishlist_ids || []),
                    ])

                setAllBadges(badges)
                setReviews(userReviews)
                setVisitedCafes(
                    visited.map((c) => ({ name: c.name, slug: c.slug }))
                )
                setWishlistCafes(
                    wishlist.map((c) => ({
                        name: c.name,
                        slug: c.slug,
                    }))
                )
            } catch (error) {
                console.error("Error fetching public profile details:", error)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [profile])

    const stats = profile.stats
    const passport = profile.passport
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
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className='max-w-7xl mx-auto'
            >
                {/* Profile Header */}
                <section className='flex flex-col md:flex-row gap-6 items-center md:items-start'>
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
                        <h1 className='text-2xl md:text-3xl font-bold font-serif'>
                            {profile.display_name}
                        </h1>

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
                    </div>
                </section>

                {/* Badges Collection */}
                <section className='mt-10'>
                    <h2 className='text-xl font-semibold font-serif mb-4 flex items-center gap-2'>
                        <Medal className='w-5 h-5' />
                        Badge Collection
                        <span className='text-sm font-normal text-text/60'>
                            ({profile.badges.length}/{allBadges.length} earned)
                        </span>
                    </h2>
                    <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4'>
                        {allBadges.map((badge) => {
                            const isEarned = earnedBadgeIds.has(badge.id)
                            const rarityColors = {
                                common: "bg-text/5 border-text/20",
                                rare: "bg-primary/5 border-primary/30",
                                legendary:
                                    "bg-secondary/10 border-secondary/50",
                            }

                            return (
                                <div
                                    key={badge.id}
                                    className={`relative aspect-square rounded-xl p-3 flex flex-col items-center justify-center text-center border-2 transition-all ${
                                        isEarned
                                            ? `${
                                                  rarityColors[badge.rarity]
                                              } shadow-sm`
                                            : "bg-text/5 border-text/10 opacity-40 grayscale"
                                    }`}
                                    title={`${badge.name}${isEarned ? " ✓" : " (locked)"}\n${badge.description}`}
                                >
                                    {badge.image_url ? (
                                        <Image
                                            src={badge.image_url}
                                            alt={badge.name}
                                            width={48}
                                            height={48}
                                            className='mb-1'
                                        />
                                    ) : (
                                        <Award
                                            className={`w-10 h-10 mb-1 ${isEarned ? "text-primary" : "text-text/30"}`}
                                        />
                                    )}
                                    <span className='text-xs font-semibold leading-tight line-clamp-2'>
                                        {badge.name}
                                    </span>
                                    {isEarned && (
                                        <div className='absolute -top-1 -right-1 bg-primary text-white p-0.5 rounded-full'>
                                            <Check className='w-3 h-3' />
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </section>

                {/* Stats Grid */}
                <section className='mt-10'>
                    <h2 className='text-xl font-semibold font-serif mb-4 flex items-center gap-2'>
                        <Award className='w-5 h-5' />
                        Stats
                    </h2>
                    <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                        {/* Scout Rank */}
                        <div className='bg-text/5 border border-text/10 rounded-xl p-4 flex flex-col items-center justify-center text-center'>
                            <div
                                className={`p-2 rounded-lg mb-2 ${stats?.scout_rank ? "bg-primary/10" : "bg-text/10"}`}
                            >
                                <RankIcon
                                    className={`w-6 h-6 ${stats?.scout_rank ? rankConfig[stats.scout_rank].color : "text-text/40"}`}
                                />
                            </div>
                            <span className='text-lg font-bold capitalize'>
                                {stats?.scout_rank || "Novice"}
                            </span>
                            <span className='text-xs text-text/60'>
                                Scout Rank
                            </span>
                        </div>
                        {/* Reviews */}
                        <a
                            href='#reviews'
                            className='bg-text/5 border border-text/10 rounded-xl p-4 flex flex-col items-center justify-center text-center hover:border-text/20 transition-colors'
                        >
                            <div className='p-2 bg-primary/10 rounded-lg mb-2'>
                                <MessageSquare className='w-6 h-6 text-primary' />
                            </div>
                            <span className='text-2xl font-bold'>
                                {stats?.total_reviews ?? 0}
                            </span>
                            <span className='text-xs text-text/60'>
                                Reviews
                            </span>
                        </a>
                        {/* Photos */}
                        <div className='bg-text/5 border border-text/10 rounded-xl p-4 flex flex-col items-center justify-center text-center'>
                            <div className='p-2 bg-secondary/10 rounded-lg mb-2'>
                                <Camera className='w-6 h-6 text-secondary' />
                            </div>
                            <span className='text-2xl font-bold'>
                                {stats?.total_photos ?? 0}
                            </span>
                            <span className='text-xs text-text/60'>Photos</span>
                        </div>
                        {/* Scouted */}
                        <div className='bg-text/5 border border-text/10 rounded-xl p-4 flex flex-col items-center justify-center text-center'>
                            <div className='p-2 bg-text/10 rounded-lg mb-2'>
                                <Coffee className='w-6 h-6 text-text/70' />
                            </div>
                            <span className='text-2xl font-bold'>
                                {stats?.total_scouted ?? 0}
                            </span>
                            <span className='text-xs text-text/60'>
                                Scouted
                            </span>
                        </div>
                    </div>
                </section>

                {/* Passport Section */}
                <section className='mt-10'>
                    <h2 className='text-xl font-semibold font-serif mb-4 flex items-center gap-2'>
                        <MapPin className='w-5 h-5' />
                        Coffee Passport
                    </h2>
                    <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                        {/* Visited */}
                        <div className='bg-text/5 border border-text/10 rounded-xl p-5'>
                            <div className='flex items-center gap-2 mb-4'>
                                <div className='p-2 bg-primary/10 rounded-lg'>
                                    <Star className='w-5 h-5 text-primary' />
                                </div>
                                <span className='font-semibold text-text'>
                                    Visited
                                </span>
                                <span className='ml-auto bg-primary/15 text-primary text-sm font-bold px-2.5 py-1 rounded-full'>
                                    {passport?.visited_ids?.length ?? 0}
                                </span>
                            </div>
                            {visitedCafes.length > 0 ? (
                                <ul className='space-y-1.5 text-sm'>
                                    {visitedCafes.slice(0, 5).map((cafe) => (
                                        <li key={cafe.slug}>
                                            <Link
                                                href={`/cafes/${cafe.slug}`}
                                                className='text-text/70 hover:text-primary transition-colors'
                                            >
                                                {cafe.name}
                                            </Link>
                                        </li>
                                    ))}
                                    {visitedCafes.length > 5 && (
                                        <li className='text-text/50 font-medium'>
                                            +{visitedCafes.length - 5} more
                                        </li>
                                    )}
                                </ul>
                            ) : (
                                <p className='text-sm text-text/40'>
                                    No visits yet
                                </p>
                            )}
                        </div>

                        {/* Wishlist */}
                        <div className='bg-text/5 border border-text/10 rounded-xl p-5'>
                            <div className='flex items-center gap-2 mb-4'>
                                <div className='p-2 bg-secondary/20 rounded-lg'>
                                    <Heart className='w-5 h-5 text-secondary' />
                                </div>
                                <span className='font-semibold text-text'>
                                    Wishlist
                                </span>
                                <span className='ml-auto bg-secondary/20 text-secondary text-sm font-bold px-2.5 py-1 rounded-full'>
                                    {passport?.wishlist_ids?.length ?? 0}
                                </span>
                            </div>
                            {wishlistCafes.length > 0 ? (
                                <ul className='space-y-1.5 text-sm'>
                                    {wishlistCafes.slice(0, 5).map((cafe) => (
                                        <li key={cafe.slug}>
                                            <Link
                                                href={`/cafes/${cafe.slug}`}
                                                className='text-text/70 hover:text-secondary transition-colors'
                                            >
                                                {cafe.name}
                                            </Link>
                                        </li>
                                    ))}
                                    {wishlistCafes.length > 5 && (
                                        <li className='text-text/50 font-medium'>
                                            +{wishlistCafes.length - 5} more
                                        </li>
                                    )}
                                </ul>
                            ) : (
                                <p className='text-sm text-text/40'>
                                    No cafes in wishlist
                                </p>
                            )}
                        </div>

                        {/* Favorite Region */}
                        <div className='bg-text/5 border border-text/10 rounded-xl p-5'>
                            <div className='flex items-center gap-2 mb-4'>
                                <div className='p-2 bg-text/10 rounded-lg'>
                                    <MapPin className='w-5 h-5 text-text/70' />
                                </div>
                                <span className='font-semibold text-text'>
                                    Favorite Region
                                </span>
                            </div>
                            {passport?.favorite_region ? (
                                <p className='text-lg font-bold text-text'>
                                    {passport.favorite_region}
                                </p>
                            ) : (
                                <p className='text-sm text-text/40'>
                                    Not set yet
                                </p>
                            )}
                        </div>
                    </div>
                </section>

                {/* Reviews Section */}
                <section
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
                        <div className='grid gap-4'>
                            {reviews.map((review) => (
                                <div
                                    key={review.id}
                                    className='bg-text/5 border border-text/10 rounded-xl p-5 flex flex-col gap-3'
                                >
                                    {/* Cafe info line */}
                                    <div className='flex flex-row justify-between items-start'>
                                        <div>
                                            <Link
                                                href={`/cafes/${review.cafe.slug}`}
                                                className='font-bold text-lg hover:text-primary transition-colors'
                                            >
                                                {review.cafe.name}
                                            </Link>
                                            <div className='flex items-center gap-1 text-xs text-text/50 mt-1'>
                                                {new Date(
                                                    review.created_at
                                                ).toLocaleDateString("en-US", {
                                                    month: "long",
                                                    day: "numeric",
                                                    year: "numeric",
                                                })}
                                            </div>
                                        </div>
                                        <div className='px-2 py-1 bg-primary/10 rounded-lg flex items-center gap-1 text-sm font-bold text-primary'>
                                            <Star className='w-3.5 h-3.5 fill-current' />
                                            {review.rating}/10
                                        </div>
                                    </div>

                                    {/* Comment */}
                                    <div className='text-sm text-text/80'>
                                        <MarkdownRender
                                            content={review.comment}
                                        />
                                    </div>
                                </div>
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
                </section>
            </motion.div>
        </main>
    )
}
