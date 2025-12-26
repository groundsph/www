"use client"

import {
    OwnedCafe,
    SUBSCRIPTION_TIERS,
    SubscriptionTier,
} from "@/utils/types/owner"
import { motion } from "motion/react"
import {
    Building2,
    ChevronRight,
    Crown,
    MessageSquare,
    Plus,
    Settings,
    Star,
    TrendingUp,
    Verified,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"

interface OwnerDashboardClientProps {
    cafes: OwnedCafe[]
}

// Tier badge colors
const tierColors: Record<
    SubscriptionTier,
    { bg: string; text: string; border: string }
> = {
    free: {
        bg: "bg-gray-100",
        text: "text-gray-600",
        border: "border-gray-200",
    },
    pro: {
        bg: "bg-blue-100",
        text: "text-blue-700",
        border: "border-blue-200",
    },
    premium: {
        bg: "bg-amber-100",
        text: "text-amber-700",
        border: "border-amber-200",
    },
}

function getTierBadge(tier: SubscriptionTier) {
    const colors = tierColors[tier]
    const config = SUBSCRIPTION_TIERS[tier]

    return (
        <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`}
        >
            {tier === "premium" && <Crown className='w-3 h-3' />}
            {tier === "pro" && <Verified className='w-3 h-3' />}
            {config.name}
        </span>
    )
}

export default function OwnerDashboardClient({
    cafes,
}: OwnerDashboardClientProps) {
    // Calculate stats
    const totalReviews = cafes.reduce(
        (sum, cafe) => sum + (cafe.total_reviews || 0),
        0
    )
    const avgRating =
        cafes.length > 0
            ? cafes.reduce((sum, cafe) => sum + (cafe.average_rating || 0), 0) /
              cafes.filter((c) => c.average_rating).length
            : 0
    const pendingReviews = cafes.reduce(
        (sum, cafe) => sum + cafe.pending_reviews,
        0
    )

    if (cafes.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className='text-center py-16'
            >
                <div className='w-20 h-20 mx-auto mb-6 rounded-full bg-text/5 flex items-center justify-center'>
                    <Building2 className='w-10 h-10 text-text/30' />
                </div>
                <h1 className='text-2xl font-serif font-bold mb-2'>
                    No Cafes Yet
                </h1>
                <p className='text-text/60 max-w-md mx-auto mb-6'>
                    You haven&apos;t claimed any cafes yet. Submit a new cafe or
                    claim an existing one to get started.
                </p>
                <div className='flex flex-col sm:flex-row gap-3 justify-center'>
                    <Link
                        href='/submit'
                        className='inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors'
                    >
                        <Plus className='w-5 h-5' />
                        Submit New Cafe
                    </Link>
                    <Link
                        href='/cafes'
                        className='inline-flex items-center gap-2 px-6 py-3 bg-text/10 rounded-lg font-medium hover:bg-text/20 transition-colors'
                    >
                        <Building2 className='w-5 h-5' />
                        Browse Cafes to Claim
                    </Link>
                </div>
            </motion.div>
        )
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
        >
            {/* Header */}
            <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8'>
                <div>
                    <h1 className='text-2xl md:text-3xl font-serif font-bold'>
                        Owner Dashboard
                    </h1>
                    <p className='text-text/60 mt-1'>
                        Manage your {cafes.length} cafe
                        {cafes.length !== 1 ? "s" : ""}
                    </p>
                </div>
                <Link
                    href='/submit'
                    className='inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors'
                >
                    <Plus className='w-4 h-4' />
                    Add Cafe
                </Link>
            </div>

            {/* Stats Overview */}
            <div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-8'>
                <div className='bg-text/5 rounded-xl p-4 border border-text/10'>
                    <div className='flex items-center gap-2 text-text/60 text-sm mb-1'>
                        <Building2 className='w-4 h-4' />
                        Total Cafes
                    </div>
                    <div className='text-2xl font-bold'>{cafes.length}</div>
                </div>
                <div className='bg-text/5 rounded-xl p-4 border border-text/10'>
                    <div className='flex items-center gap-2 text-text/60 text-sm mb-1'>
                        <Star className='w-4 h-4' />
                        Avg Rating
                    </div>
                    <div className='text-2xl font-bold'>
                        {avgRating > 0 ? avgRating.toFixed(1) : "-"}
                    </div>
                </div>
                <div className='bg-text/5 rounded-xl p-4 border border-text/10'>
                    <div className='flex items-center gap-2 text-text/60 text-sm mb-1'>
                        <MessageSquare className='w-4 h-4' />
                        Total Reviews
                    </div>
                    <div className='text-2xl font-bold'>{totalReviews}</div>
                </div>
                <div className='bg-text/5 rounded-xl p-4 border border-text/10'>
                    <div className='flex items-center gap-2 text-text/60 text-sm mb-1'>
                        <TrendingUp className='w-4 h-4' />
                        Pending Responses
                    </div>
                    <div className='text-2xl font-bold'>
                        {pendingReviews > 0 ? (
                            <span className='text-amber-600'>
                                {pendingReviews}
                            </span>
                        ) : (
                            <span className='text-green-600'>0</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Cafes List */}
            <div className='space-y-4'>
                <h2 className='text-lg font-semibold'>Your Cafes</h2>

                {cafes.map((cafe, index) => (
                    <motion.div
                        key={cafe.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className='bg-text/5 border border-text/10 rounded-xl overflow-hidden hover:border-primary/30 transition-colors group'
                    >
                        <div className='flex flex-col sm:flex-row'>
                            {/* Thumbnail */}
                            <div className='relative w-full sm:w-40 h-32 sm:h-auto bg-text/10 shrink-0'>
                                {cafe.thumbnail ? (
                                    <Image
                                        src={cafe.thumbnail}
                                        alt={cafe.name}
                                        fill
                                        className='object-cover'
                                    />
                                ) : (
                                    <div className='w-full h-full flex items-center justify-center'>
                                        <Building2 className='w-8 h-8 text-text/30' />
                                    </div>
                                )}
                            </div>

                            {/* Content */}
                            <div className='flex-1 p-4'>
                                <div className='flex flex-col sm:flex-row sm:items-start justify-between gap-3'>
                                    <div className='flex-1'>
                                        <div className='flex items-center gap-2 flex-wrap'>
                                            <h3 className='font-semibold text-lg'>
                                                {cafe.name}
                                            </h3>
                                            {getTierBadge(
                                                cafe.subscription?.tier ||
                                                    "free"
                                            )}
                                            {cafe.is_verified && (
                                                <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200'>
                                                    <Verified className='w-3 h-3' />
                                                    Verified
                                                </span>
                                            )}
                                            {!cafe.is_published && (
                                                <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-200'>
                                                    Draft
                                                </span>
                                            )}
                                        </div>
                                        <p className='text-sm text-text/60 mt-0.5'>
                                            {cafe.city_municipality},{" "}
                                            {cafe.region}
                                        </p>

                                        {/* Quick Stats */}
                                        <div className='flex items-center gap-4 mt-3 text-sm'>
                                            <span className='flex items-center gap-1'>
                                                <Star className='w-4 h-4 text-amber-500 fill-amber-500' />
                                                {cafe.average_rating?.toFixed(
                                                    1
                                                ) || "-"}
                                            </span>
                                            <span className='flex items-center gap-1 text-text/60'>
                                                <MessageSquare className='w-4 h-4' />
                                                {cafe.total_reviews || 0}{" "}
                                                reviews
                                            </span>
                                            {cafe.pending_reviews > 0 && (
                                                <span className='flex items-center gap-1 text-amber-600 font-medium'>
                                                    <MessageSquare className='w-4 h-4' />
                                                    {cafe.pending_reviews}{" "}
                                                    awaiting response
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className='flex items-center gap-2'>
                                        <Link
                                            href={`/owner/cafes/${cafe.id}`}
                                            className='inline-flex items-center gap-1 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors'
                                        >
                                            <Settings className='w-4 h-4' />
                                            Manage
                                        </Link>
                                        <Link
                                            href={`/cafes/${cafe.slug}`}
                                            className='inline-flex items-center gap-1 px-3 py-2 bg-text/10 rounded-lg text-sm font-medium hover:bg-text/20 transition-colors'
                                        >
                                            View
                                            <ChevronRight className='w-4 h-4' />
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Subscription Upgrade CTA */}
            {cafes.some(
                (c) => !c.subscription || c.subscription.tier === "free"
            ) && (
                <div className='mt-8 p-6 bg-linear-to-r from-primary/10 to-amber-500/10 rounded-xl border border-primary/20'>
                    <div className='flex flex-col md:flex-row items-start md:items-center justify-between gap-4'>
                        <div>
                            <h3 className='font-semibold text-lg flex items-center gap-2'>
                                <Crown className='w-5 h-5 text-amber-500' />
                                Upgrade Your Cafes
                            </h3>
                            <p className='text-text/60 mt-1'>
                                Get verified badges, analytics, and more with
                                Pro or Premium subscriptions.
                            </p>
                        </div>
                        <Link
                            href='/owner/subscriptions'
                            className='inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors whitespace-nowrap'
                        >
                            View Plans
                            <ChevronRight className='w-4 h-4' />
                        </Link>
                    </div>
                </div>
            )}
        </motion.div>
    )
}
