"use client"

import { Coffee, Route } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useEffect, useRef, useMemo } from "react"
import { motion } from "motion/react"
import { getCafeThumbnailUrl } from "@/utils/extras"

interface VisitHistoryCafe {
    name: string
    slug: string
    thumbnail: string | null
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
    // Return offset between -70 and 70 pixels (even more dramatic)
    return (random - 0.5) * 140
}

// Generate S-curve control points for more interesting paths
function getSCurveControls(
    fromSlug: string,
    toSlug: string,
    x1: number,
    y1: number,
    x2: number,
    y2: number
) {
    const random1 = seededRandom(fromSlug + toSlug)
    const random2 = seededRandom(toSlug + fromSlug + "curve")

    // S-curve: first control point goes one direction, second goes opposite
    const curveIntensity = 40 + random1 * 50 // 40-90px curve intensity
    const direction = random1 > 0.5 ? 1 : -1

    // First control point - 1/3 of the way, curves up/down
    const cp1x = x1 + (x2 - x1) * 0.33
    const cp1y = y1 + direction * curveIntensity * (0.5 + random2 * 0.5)

    // Second control point - 2/3 of the way, curves opposite direction
    const cp2x = x1 + (x2 - x1) * 0.67
    const cp2y = y2 - direction * curveIntensity * (0.5 + random1 * 0.5)

    return { cp1x, cp1y, cp2x, cp2y }
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
    const BADGE_SPACING = 180 // Increased for full names
    const CONTAINER_HEIGHT = 320 // Taller for more vertical variation and padding
    const CENTER_Y = CONTAINER_HEIGHT / 2 - 20 // Adjusted center

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
                            const y1 =
                                CENTER_Y +
                                (index === 0 ? 0 : getVerticalOffset(cafe.slug))
                            const y2 =
                                CENTER_Y + getVerticalOffset(nextCafe.slug)

                            // Get S-curve control points for more interesting paths
                            const { cp1x, cp1y, cp2x, cp2y } =
                                getSCurveControls(
                                    cafe.slug,
                                    nextCafe.slug,
                                    x1,
                                    y1,
                                    x2,
                                    y2
                                )

                            return (
                                <path
                                    key={`path-${cafe.slug}-${nextCafe.slug}`}
                                    d={`M ${x1} ${y1} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${x2} ${y2}`}
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
                        // First item is always centered (offset 0)
                        const offset =
                            index === 0 ? 0 : getVerticalOffset(cafe.slug)
                        const y = CENTER_Y + offset - BADGE_SIZE / 2

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
                                    {/* Badge circle with thumbnail */}
                                    <div
                                        className='rounded-full bg-background border-2 border-primary/40 flex items-center justify-center shadow-md group-hover:border-primary group-hover:shadow-lg group-hover:scale-110 transition-all duration-200 overflow-hidden'
                                        style={{
                                            width: `${BADGE_SIZE}px`,
                                            height: `${BADGE_SIZE}px`,
                                        }}
                                    >
                                        {cafe.thumbnail ? (
                                            <Image
                                                src={getCafeThumbnailUrl(
                                                    cafe.thumbnail
                                                )}
                                                alt={cafe.name}
                                                width={BADGE_SIZE}
                                                height={BADGE_SIZE}
                                                className='object-cover w-full h-full'
                                            />
                                        ) : (
                                            <Coffee className='w-6 h-6 text-primary/70 group-hover:text-primary transition-colors' />
                                        )}
                                    </div>

                                    {/* Cafe name - full display */}
                                    <span
                                        className='mt-2 text-xs text-text/80 font-medium text-center leading-tight'
                                        style={{
                                            maxWidth: "120px",
                                            wordBreak: "break-word",
                                        }}
                                    >
                                        {cafe.name}
                                    </span>

                                    {/* Date below name */}
                                    <span className='text-[10px] text-text/40 font-medium whitespace-nowrap'>
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
