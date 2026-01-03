"use client"

import {
    OwnedCafe,
    SUBSCRIPTION_TIERS,
    SubscriptionTier,
    BETA_FREE_FEATURES,
    getBetaNoticeText,
} from "@/utils/types/owner"
import { motion } from "motion/react"
import {
    ArrowRight,
    Building2,
    ChevronRight,
    Crown,
    MessageSquare,
    Plus,
    Settings,
    Star,
    TrendingUp,
    Verified,
    Gift,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { getCafeThumbnailUrl } from "@/utils/extras"

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

// Animation variants
const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
        },
    },
}

const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
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
                    <Building2 className='w-10 h-10 text-text opacity-30' />
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
            variants={container}
            initial='hidden'
            animate='show'
            className='w-full space-y-8'
        >
            {/* Header */}
            <motion.div
                variants={item}
                className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4'
            >
                <div>
                    <h1 className='text-2xl md:text-3xl font-bold text-text'>
                        Owner Dashboard
                    </h1>
                    <p className='text-text/60 mt-1'>
                        Welcome back! You&apos;re managing {cafes.length} cafe
                        {cafes.length !== 1 ? "s" : ""}.
                    </p>
                </div>
                <Link
                    href='/submit'
                    className='inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm hover:shadow-md'
                >
                    <Plus className='w-4 h-4' />
                    Add Cafe
                </Link>
            </motion.div>

            {/* Stats Overview */}
            <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                <motion.div
                    variants={item}
                    className='p-4 bg-background border border-text/10 rounded-xl hover:border-primary/30 transition-all shadow-sm hover:shadow-md'
                >
                    <div className='flex items-center gap-3 mb-2'>
                        <div className='p-2 bg-amber-100 text-amber-700 rounded-lg'>
                            <Building2 className='w-5 h-5' />
                        </div>
                        <span className='text-sm font-medium text-text/60'>
                            Total Cafes
                        </span>
                    </div>
                    <div className='text-2xl font-bold'>{cafes.length}</div>
                </motion.div>

                <motion.div
                    variants={item}
                    className='p-4 bg-background border border-text/10 rounded-xl hover:border-primary/30 transition-all shadow-sm hover:shadow-md'
                >
                    <div className='flex items-center gap-3 mb-2'>
                        <div className='p-2 bg-yellow-100 text-yellow-700 rounded-lg'>
                            <Star className='w-5 h-5' />
                        </div>
                        <span className='text-sm font-medium text-text/60'>
                            Avg Rating
                        </span>
                    </div>
                    <div className='text-2xl font-bold'>
                        {avgRating > 0 ? avgRating.toFixed(1) : "-"}
                    </div>
                </motion.div>

                <motion.div
                    variants={item}
                    className='p-4 bg-background border border-text/10 rounded-xl hover:border-primary/30 transition-all shadow-sm hover:shadow-md'
                >
                    <div className='flex items-center gap-3 mb-2'>
                        <div className='p-2 bg-blue-100 text-blue-700 rounded-lg'>
                            <MessageSquare className='w-5 h-5' />
                        </div>
                        <span className='text-sm font-medium text-text/60'>
                            Total Reviews
                        </span>
                    </div>
                    <div className='text-2xl font-bold'>{totalReviews}</div>
                </motion.div>

                <motion.div
                    variants={item}
                    className='p-4 bg-background border border-text/10 rounded-xl hover:border-primary/30 transition-all shadow-sm hover:shadow-md'
                >
                    <div className='flex items-center gap-3 mb-2'>
                        <div className='p-2 bg-purple-100 text-purple-700 rounded-lg'>
                            <TrendingUp className='w-5 h-5' />
                        </div>
                        <span className='text-sm font-medium text-text/60'>
                            Pending Responses
                        </span>
                    </div>
                    <div className='text-2xl font-bold'>
                        {pendingReviews > 0 ? (
                            <span className='text-amber-600 flex items-center gap-2'>
                                {pendingReviews}
                                <span className='w-2 h-2 rounded-full bg-amber-500 animate-pulse'></span>
                            </span>
                        ) : (
                            <span className='text-green-600'>0</span>
                        )}
                    </div>
                </motion.div>
            </div>

            {/* Beta Access Notice */}
            {BETA_FREE_FEATURES.length > 0 && (
                <motion.div
                    variants={item}
                    className='p-4 bg-amber-50 border border-amber-200 rounded-xl'
                >
                    <div className='flex items-start gap-3'>
                        <Gift className='w-5 h-5 text-amber-600 shrink-0 mt-0.5' />
                        <div>
                            <p className='font-medium text-amber-800'>
                                🎉 Beta Access
                            </p>
                            <p className='text-sm text-amber-700 mt-1'>
                                {getBetaNoticeText()}
                            </p>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Cafes List */}
            <div className='space-y-4'>
                <motion.h2
                    variants={item}
                    className='text-lg font-semibold'
                >
                    Your Cafes
                </motion.h2>

                <div className='grid grid-cols-1 gap-4'>
                    {cafes.map((cafe) => (
                        <motion.div
                            key={cafe.id}
                            variants={item}
                            className='group bg-background rounded-xl border border-text/10 overflow-hidden hover:border-primary/30 hover:shadow-md transition-all shadow-sm'
                        >
                            <div className='flex flex-col sm:flex-row'>
                                {/* Thumbnail */}
                                <div className='relative w-full sm:w-44 h-32 sm:h-auto bg-text/5 shrink-0'>
                                    {cafe.thumbnail ? (
                                        <Image
                                            src={getCafeThumbnailUrl(
                                                cafe.thumbnail
                                            )}
                                            alt={cafe.name}
                                            fill
                                            className='object-cover'
                                        />
                                    ) : (
                                        <div className='w-full h-full flex items-center justify-center'>
                                            <Building2 className='w-8 h-8 text-text opacity-30' />
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
                                                href={`/owner/cafes/${cafe.slug}`}
                                                className='inline-flex items-center gap-1 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors'
                                            >
                                                <Settings className='w-4 h-4' />
                                                Manage
                                            </Link>
                                            <Link
                                                href={`/cafes/${cafe.slug}`}
                                                className='inline-flex items-center gap-1 px-3 py-2 bg-text/10 rounded-lg text-sm font-medium hover:bg-text/20 transition-colors group/link'
                                            >
                                                View
                                                <ArrowRight className='w-4 h-4 group-hover/link:translate-x-0.5 transition-transform' />
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Subscription Upgrade CTA */}
            {cafes.some(
                (c) => !c.subscription || c.subscription.tier === "free"
            ) && (
                <motion.div
                    variants={item}
                    className='p-6 bg-linear-to-r from-primary/10 via-amber-500/10 to-primary/5 rounded-xl border border-primary/20 shadow-sm'
                >
                    <div className='flex flex-col md:flex-row items-start md:items-center justify-between gap-4'>
                        <div>
                            <h3 className='font-semibold text-lg flex items-center gap-2'>
                                <div className='p-2 bg-amber-100 rounded-lg'>
                                    <Crown className='w-5 h-5 text-amber-600' />
                                </div>
                                Upgrade Your Cafes
                            </h3>
                            <p className='text-text/60 mt-2'>
                                Get verified badges, analytics, menu management,
                                and more with Pro or Premium subscriptions.
                            </p>
                        </div>
                        <Link
                            href='/owner/subscriptions'
                            className='inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-all whitespace-nowrap shadow-sm hover:shadow-md group'
                        >
                            View Plans
                            <ChevronRight className='w-4 h-4 group-hover:translate-x-0.5 transition-transform' />
                        </Link>
                    </div>
                </motion.div>
            )}
        </motion.div>
    )
}
