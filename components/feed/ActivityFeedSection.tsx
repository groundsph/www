"use client"

import Link from "next/link"
import Image from "next/image"
import { ArrowRightIcon, Coffee } from "lucide-react"
import { getCafeThumbnailUrl } from "@/utils/extras"
import { useInView } from "motion/react"
import { useRef } from "react"
import { motion } from "motion/react"

export interface FeedCheckIn {
    id: string
    userId: string
    username: string
    displayName: string
    avatarUrl: string | null
    cafeId: string
    cafeName: string
    cafeSlug: string
    cafeThumbnail: string | null
    visitedAt: string
    companions: {
        id: string
        username: string
        displayName: string
        avatarUrl: string | null
    }[]
}

export interface GroupedCafeFeed {
    cafeId: string
    cafeName: string
    cafeSlug: string
    cafeThumbnail: string | null
    latestVisitedAt: string
    visitors: { id: string; username: string; displayName: string; avatarUrl: string | null }[]
    visitorCount: number
}

interface ActivityFeedSectionProps {
    variant: "landing" | "full"
    checkIns?: FeedCheckIn[]
    groupedCheckIns?: GroupedCafeFeed[]
}

export default function ActivityFeedSection({
    variant,
    checkIns,
    groupedCheckIns,
}: ActivityFeedSectionProps) {
    const ref = useRef(null)
    const isInView = useInView(ref, { once: true, margin: "-100px" })

    if (variant === "landing") {
        if (!groupedCheckIns || groupedCheckIns.length === 0) return null
        return (
            <LandingFeedView
                groupedCheckIns={groupedCheckIns}
                ref={ref}
                isInView={isInView}
            />
        )
    }

    if (!checkIns || checkIns.length === 0) return null
    return (
        <FullFeedView
            checkIns={checkIns}
            ref={ref}
            isInView={isInView}
        />
    )
}

interface LandingFeedViewProps {
    groupedCheckIns: GroupedCafeFeed[]
    ref: React.RefObject<null>
    isInView: boolean
}

function LandingFeedView({ groupedCheckIns, ref, isInView }: LandingFeedViewProps) {
    return (
        <section
            className='w-full min-h-max flex flex-col mt-4'
            ref={ref}
        >
            <div className='flex items-center justify-between px-6 mb-2 flex-wrap'>
                <h2 className='font-semibold font-serif text-2xl'>
                    Activity Feed
                </h2>
                <div className='flex items-center gap-3'>
                    <p className='text-sm text-text/60'>
                        From people you follow
                    </p>
                    <Link
                        href='/profile/activity'
                        className='text-sm text-primary hover:text-primary/80 transition-colors font-medium'
                    >
                        View all
                    </Link>
                </div>
            </div>

            {/* Horizontal scrollable container */}
            <div className='flex flex-row gap-4 min-w-full overflow-x-auto overscroll-x-contain px-4 pt-4 pb-10 snap-x snap-mandatory scroll-px-4'>
                {groupedCheckIns.map((group, idx) => (
                    <motion.div
                        key={group.cafeId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={
                            isInView
                                ? { opacity: 1, y: 0 }
                                : { opacity: 0, y: 10 }
                        }
                        transition={{
                            delay: idx * 0.1,
                            duration: 0.6,
                            ease: "easeOut",
                        }}
                        className='group shrink-0 w-[320px] max-w-[85svw] bg-text/5 rounded-xl p-4 hover:bg-text/10 transition-colors border border-text/5 hover:border-text/10 snap-start flex flex-col gap-3'
                    >
                        {/* Visitors row */}
                        <div className='flex items-center gap-2'>
                            <div className='flex items-center gap-1'>
                                {group.visitors.slice(0, 3).map((visitor, i) => (
                                    <Link
                                        key={visitor.id}
                                        href={`/profile/${visitor.username}`}
                                        className='shrink-0 -ml-2 first:ml-0'
                                        onClick={(e) => e.stopPropagation()}
                                        title={visitor.displayName}
                                        style={{ zIndex: 3 - i }}
                                    >
                                        {visitor.avatarUrl ? (
                                            <Image
                                                src={visitor.avatarUrl}
                                                alt={visitor.displayName}
                                                width={32}
                                                height={32}
                                                className='w-7 h-7 rounded-full object-cover border-2 border-background'
                                            />
                                        ) : (
                                            <div className='w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center border-2 border-background'>
                                                <span className='text-primary font-bold text-sm'>
                                                    {visitor.displayName.charAt(0)}
                                                </span>
                                            </div>
                                        )}
                                    </Link>
                                ))}
                                {group.visitorCount > 3 && (
                                    <span className='text-sm text-text/60 ml-1'>
                                        +{group.visitorCount - 3}
                                    </span>
                                )}
                            </div>
                            <span className='text-text/40 text-sm ml-auto'>
                                {new Date(group.latestVisitedAt).toLocaleDateString(
                                    "en-US",
                                    {
                                        month: "short",
                                        day: "numeric",
                                    }
                                )}
                            </span>
                        </div>

                        {/* Cafe info */}
                        <Link
                            href={`/cafes/${group.cafeSlug}`}
                            className='flex items-center gap-3 bg-background rounded-lg p-2 shadow-none hover:shadow-sm transition-colors'
                        >
                            <div className='w-14 h-14 rounded-lg overflow-hidden bg-text/5 shrink-0'>
                                {group.cafeThumbnail ? (
                                    <Image
                                        src={getCafeThumbnailUrl(group.cafeThumbnail)}
                                        alt={group.cafeName}
                                        width={56}
                                        height={56}
                                        className='w-full h-full object-cover'
                                    />
                                ) : (
                                    <div className='w-full h-full flex items-center justify-center'>
                                        <Coffee className='w-6 h-6 text-text opacity-30' />
                                    </div>
                                )}
                            </div>
                            <div className='flex-1 min-w-0'>
                                <h3 className='font-semibold text-text group-hover:text-primary transition-colors truncate'>
                                    {group.cafeName}
                                </h3>
                                <p className='flex flex-row items-center text-xs'>
                                    Visit Cafe{" "}
                                    <ArrowRightIcon className='w-2 h-2 ml-1' />
                                </p>
                            </div>
                        </Link>

                        {/* Visitor count text */}
                        <div className='text-sm text-text/60'>
                            Visited by {group.visitorCount} friend{group.visitorCount !== 1 ? "s" : ""}
                        </div>
                    </motion.div>
                ))}
            </div>
        </section>
    )
}

interface FullFeedViewProps {
    checkIns: FeedCheckIn[]
    ref: React.RefObject<null>
    isInView: boolean
}

function FullFeedView({ checkIns, ref, isInView }: FullFeedViewProps) {
    return (
        <section
            className='w-full min-h-max flex flex-col mt-4'
            ref={ref}
        >
            <div className='flex items-center justify-between px-6 mb-2 flex-wrap'>
                <h2 className='font-semibold font-serif text-2xl'>
                    Activity Feed
                </h2>
                <div className='flex items-center gap-3'>
                    <p className='text-sm text-text/60'>
                        From people you follow
                    </p>
                    <Link
                        href='/profile/activity'
                        className='text-sm text-primary hover:text-primary/80 transition-colors font-medium'
                    >
                        View all
                    </Link>
                </div>
            </div>

            {/* Horizontal scrollable container */}
            <div className='flex flex-row gap-4 min-w-full overflow-x-auto overscroll-x-contain px-4 pt-4 pb-10 snap-x snap-mandatory scroll-px-4'>
                {checkIns.map((checkIn, idx) => (
                    <motion.div
                        key={checkIn.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={
                            isInView
                                ? { opacity: 1, y: 0 }
                                : { opacity: 0, y: 10 }
                        }
                        transition={{
                            delay: idx * 0.1,
                            duration: 0.6,
                            ease: "easeOut",
                        }}
                        className='group shrink-0 w-[320px] max-w-[85svw] bg-text/5 rounded-xl p-4 hover:bg-text/10 transition-colors border border-text/5 hover:border-text/10 snap-start flex flex-col gap-3'
                    >
                        {/* User info row */}
                        <div className='flex items-center gap-2'>
                            <Link
                                href={`/profile/${checkIn.username}`}
                                className='shrink-0'
                                onClick={(e) => e.stopPropagation()}
                                title={checkIn.displayName}
                            >
                                {checkIn.avatarUrl ? (
                                    <Image
                                        src={checkIn.avatarUrl}
                                        alt={checkIn.displayName}
                                        width={40}
                                        height={40}
                                        className='w-6 h-6 rounded-full object-cover'
                                    />
                                ) : (
                                    <div className='w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center'>
                                        <span className='text-primary font-bold'>
                                            {checkIn.displayName.charAt(0)}
                                        </span>
                                    </div>
                                )}
                            </Link>
                            <Link
                                href={`/profile/${checkIn.username}`}
                                className='font-medium text-text/60 hover:text-text transition-colors truncate'
                                onClick={(e) => e.stopPropagation()}
                            >
                                @{checkIn.username}
                            </Link>
                            <span className='text-text/40 text-sm'>
                                {new Date(checkIn.visitedAt).toLocaleDateString(
                                    "en-US",
                                    {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                    }
                                )}
                            </span>
                        </div>

                        {/* Cafe info */}
                        <Link
                            href={`/cafes/${checkIn.cafeSlug}`}
                            className='flex items-center gap-3 bg-background rounded-lg p-2 shadow-none hover:shadow-sm transition-colors'
                        >
                            <div className='w-14 h-14 rounded-lg overflow-hidden bg-text/5 shrink-0'>
                                {checkIn.cafeThumbnail ? (
                                    <Image
                                        src={getCafeThumbnailUrl(
                                            checkIn.cafeThumbnail
                                        )}
                                        alt={checkIn.cafeName}
                                        width={56}
                                        height={56}
                                        className='w-full h-full object-cover'
                                    />
                                ) : (
                                    <div className='w-full h-full flex items-center justify-center'>
                                        <Coffee className='w-6 h-6 text-text opacity-30' />
                                    </div>
                                )}
                            </div>
                            <div className='flex-1 min-w-0'>
                                <h3 className='font-semibold text-text group-hover:text-primary transition-colors truncate'>
                                    {checkIn.cafeName}
                                </h3>
                                <p className='flex flex-row items-center text-xs'>
                                    Visit Cafe{" "}
                                    <ArrowRightIcon className='w-2 h-2 ml-1' />
                                </p>
                            </div>
                        </Link>

                        {/* Companions - show only first one + count */}
                        {checkIn.companions.length > 0 && (
                            <div className='flex items-center gap-1.5 overflow-x-auto overflow-y-hidden scrollbar-hide'>
                                <span className='text-text/40 text-sm shrink-0'>
                                    with:
                                </span>
                                <Link
                                    href={`/profile/${checkIn.companions[0].username}`}
                                    className='shrink-0'
                                    onClick={(e) => e.stopPropagation()}
                                    title={checkIn.companions[0].displayName}
                                >
                                    {checkIn.companions[0].avatarUrl ? (
                                        <Image
                                            src={checkIn.companions[0].avatarUrl}
                                            alt={checkIn.companions[0].displayName}
                                            width={24}
                                            height={24}
                                            className='w-6 h-6 rounded-full object-cover'
                                        />
                                    ) : (
                                        <div className='w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary'>
                                            {checkIn.companions[0].displayName.charAt(0)}
                                        </div>
                                    )}
                                </Link>
                                {checkIn.companions.length > 1 && (
                                    <span className='text-sm text-text/60'>
                                        +{checkIn.companions.length - 1}
                                    </span>
                                )}
                            </div>
                        )}
                    </motion.div>
                ))}
            </div>
        </section>
    )
}
