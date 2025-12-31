"use client"

import { Coffee, Route } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useMemo } from "react"
import { motion } from "motion/react"

interface VisitHistoryCafe {
    name: string
    slug: string
    visited_at: string | null
}

interface VisitHistoryProps {
    visits: VisitHistoryCafe[]
    className?: string
}

// Generate seeded random number from string (consistent per cafe)
function seededRandom(seed: string): number {
    let hash = 0
    for (let i = 0; i < seed.length; i++) {
        const char = seed.charCodeAt(i)
        hash = (hash << 5) - hash + char
        hash = hash & hash
    }
    return Math.abs(hash % 100) / 100
}

// Generate random vertical offset for a badge (seeded by cafe slug)
function getVerticalOffset(slug: string): number {
    const random = seededRandom(slug)
    // Return offset between -30 and 30 pixels
    return (random - 0.5) * 60
}

// Generate random curve direction (up or down) for path
function getCurveDirection(fromSlug: string, toSlug: string): number {
    const random = seededRandom(fromSlug + toSlug)
    // Return curve control offset between -40 and 40
    return (random - 0.5) * 80
}

export default function VisitHistory({
    visits,
    className = "",
}: VisitHistoryProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null)

    // Sort visits oldest first (leftmost) to newest (rightmost)
    const sortedVisits = useMemo(() => {
        return [...visits]
    }, [visits])

    // Auto-scroll to the end (most recent) on mount
    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollLeft =
                scrollContainerRef.current.scrollWidth
        }
    }, [sortedVisits])

    if (sortedVisits.length === 0) {
        return (
            <div className={`w-full ${className}`}>
                <div className='flex items-center gap-2 mb-4'>
                    <Route className='w-5 h-5' />
                    <h2 className='text-xl font-semibold font-serif'>
                        Visit History
                    </h2>
                </div>
                <div className='bg-text/5 border border-text/10 rounded-xl p-8 flex flex-col items-center justify-center min-h-[200px]'>
                    <Coffee className='w-12 h-12 text-text/20 mb-3' />
                    <p className='text-text/60 font-medium'>No visits yet</p>
                    <p className='text-text/40 text-sm'>
                        Start exploring cafes to build your journey!
                    </p>
                </div>
            </div>
        )
    }

    const BADGE_SIZE = 64
    const BADGE_SPACING = 140
    const CONTAINER_HEIGHT = 180
    const CENTER_Y = CONTAINER_HEIGHT / 2 - 20

    return (
        <div className={`w-full ${className}`}>
            <div className='flex items-center gap-2 mb-4'>
                <Route className='w-5 h-5' />
                <h2 className='text-xl font-semibold font-serif'>
                    Visit History
                </h2>
                <span className='ml-auto bg-primary/15 text-primary text-sm font-bold px-2.5 py-1 rounded-full'>
                    {sortedVisits.length}{" "}
                    {sortedVisits.length === 1 ? "visit" : "visits"}
                </span>
            </div>

            {/* Scrollable container */}
            <div
                ref={scrollContainerRef}
                className='bg-text/5 border border-text/10 rounded-xl overflow-x-auto overflow-y-hidden relative'
                style={{ scrollBehavior: "smooth" }}
            >
                {/* Content wrapper with padding for scroll */}
                <div
                    className='relative'
                    style={{
                        width: `${sortedVisits.length * BADGE_SPACING + 80}px`,
                        height: `${CONTAINER_HEIGHT}px`,
                        minWidth: "100%",
                    }}
                >
                    {/* SVG Paths connecting badges */}
                    <svg
                        className='absolute inset-0 pointer-events-none'
                        style={{
                            width: `${sortedVisits.length * BADGE_SPACING + 80}px`,
                            height: `${CONTAINER_HEIGHT}px`,
                        }}
                    >
                        {sortedVisits.slice(0, -1).map((cafe, index) => {
                            const nextCafe = sortedVisits[index + 1]
                            const x1 =
                                60 + index * BADGE_SPACING + BADGE_SIZE / 2
                            const x2 =
                                60 +
                                (index + 1) * BADGE_SPACING +
                                BADGE_SIZE / 2
                            const y1 = CENTER_Y + getVerticalOffset(cafe.slug)
                            const y2 =
                                CENTER_Y + getVerticalOffset(nextCafe.slug)

                            // Random curve control point
                            const curveOffset = getCurveDirection(
                                cafe.slug,
                                nextCafe.slug
                            )
                            const midX = (x1 + x2) / 2
                            const midY = (y1 + y2) / 2 + curveOffset

                            return (
                                <path
                                    key={`path-${cafe.slug}-${nextCafe.slug}`}
                                    d={`M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`}
                                    fill='none'
                                    stroke='currentColor'
                                    strokeWidth='2'
                                    strokeDasharray='6 4'
                                    className='text-text/30'
                                />
                            )
                        })}
                    </svg>

                    {/* Badge nodes */}
                    {sortedVisits.map((cafe, index) => {
                        const x = 60 + index * BADGE_SPACING
                        const y =
                            CENTER_Y +
                            getVerticalOffset(cafe.slug) -
                            BADGE_SIZE / 2

                        return (
                            <motion.div
                                key={cafe.slug}
                                className='absolute'
                                style={{
                                    left: `${x}px`,
                                    top: `${y}px`,
                                }}
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{
                                    delay: index * 0.05,
                                    type: "spring",
                                    stiffness: 300,
                                    damping: 20,
                                }}
                            >
                                <Link
                                    href={`/cafes/${cafe.slug}`}
                                    className='group flex flex-col items-center'
                                >
                                    {/* Badge circle */}
                                    <div
                                        className='rounded-full bg-background border-2 border-primary/40 flex items-center justify-center shadow-md group-hover:border-primary group-hover:shadow-lg group-hover:scale-110 transition-all duration-200'
                                        style={{
                                            width: `${BADGE_SIZE}px`,
                                            height: `${BADGE_SIZE}px`,
                                        }}
                                    >
                                        <Coffee className='w-6 h-6 text-primary/70 group-hover:text-primary transition-colors' />
                                    </div>

                                    {/* Cafe name tooltip on hover */}
                                    <div className='absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10'>
                                        <div className='bg-text text-background text-xs font-medium px-2 py-1 rounded whitespace-nowrap max-w-[140px] truncate'>
                                            {cafe.name}
                                        </div>
                                    </div>

                                    {/* Date below badge */}
                                    <span className='mt-2 text-xs text-text/50 font-medium whitespace-nowrap'>
                                        {cafe.visited_at
                                            ? new Date(
                                                  cafe.visited_at
                                              ).toLocaleDateString("en-US", {
                                                  month: "short",
                                                  day: "numeric",
                                              })
                                            : "—"}
                                    </span>
                                </Link>
                            </motion.div>
                        )
                    })}
                </div>

                {/* Scroll hint gradient overlays */}
                <div className='absolute left-0 top-0 bottom-0 w-8 bg-linear-to-r from-text/5 to-transparent pointer-events-none' />
                <div className='absolute right-0 top-0 bottom-0 w-8 bg-linear-to-l from-text/5 to-transparent pointer-events-none' />
            </div>

            {/* Scroll hint text */}
            <p className='text-xs text-text/40 text-center mt-2'>
                ← Scroll cafe journey →
            </p>
        </div>
    )
}
