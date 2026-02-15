"use client"

import { Coffee, Route, Footprints } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useEffect, useRef, useMemo, useState, Suspense } from "react"
import { motion } from "motion/react"
import { getCafeThumbnailUrl } from "@/utils/extras"

interface VisitHistoryCafe {
    name: string
    slug: string
    thumbnail: string | null
    visited_at: string | null
    visitCount?: number // Optional visit count from new system
}

interface VisitHistoryProps {
    visits: VisitHistoryCafe[]
    className?: string
    isPublic?: boolean
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
function getVerticalOffset(slug: string, isMobile: boolean): number {
    const random = seededRandom(slug)
    // Return offset between -40 and 40 pixels on mobile, -70 and 70 on desktop
    const range = isMobile ? 80 : 140
    return (random - 0.5) * range
}

// Get points along a bezier curve for footstep placement
function getPointOnCurve(
    t: number,
    x1: number,
    y1: number,
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x2: number,
    y2: number,
) {
    const t2 = t * t
    const t3 = t2 * t
    const mt = 1 - t
    const mt2 = mt * mt
    const mt3 = mt2 * mt

    const x = mt3 * x1 + 3 * mt2 * t * cp1x + 3 * mt * t2 * cp2x + t3 * x2
    const y = mt3 * y1 + 3 * mt2 * t * cp1y + 3 * mt * t2 * cp2y + t3 * y2

    return { x, y }
}

// Get tangent angle at a point on the curve (for rotation)
function getTangentAngle(
    t: number,
    x1: number,
    y1: number,
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x2: number,
    y2: number,
) {
    const delta = 0.001
    const p1 = getPointOnCurve(
        Math.max(0, t - delta),
        x1,
        y1,
        cp1x,
        cp1y,
        cp2x,
        cp2y,
        x2,
        y2,
    )
    const p2 = getPointOnCurve(
        Math.min(1, t + delta),
        x1,
        y1,
        cp1x,
        cp1y,
        cp2x,
        cp2y,
        x2,
        y2,
    )
    return Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI)
}

// Generate S-curve control points for more interesting paths
function getSCurveControls(
    fromSlug: string,
    toSlug: string,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
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
    isPublic = false,
}: VisitHistoryProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const [isMobile, setIsMobile] = useState(false)

    // Detect mobile viewport
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 640)
        checkMobile()
        window.addEventListener("resize", checkMobile)
        return () => window.removeEventListener("resize", checkMobile)
    }, [])

    // Responsive dimensions
    const BADGE_SIZE = isMobile ? 48 : 64
    const BADGE_SPACING = isMobile ? 120 : 180
    const CONTAINER_HEIGHT = isMobile ? 240 : 320
    const CENTER_Y = CONTAINER_HEIGHT / 2 - (isMobile ? 10 : 20)
    const FOOTSTEP_COUNT = isMobile ? 3 : 4

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
                    <Coffee className='w-12 h-12 text-text opacity-20 mb-3' />
                    <p className='text-text/60 font-medium'>No visits yet</p>
                    <p className='text-text/40 text-sm'>
                        Start exploring cafes to build your journey!
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className={`w-full ${className}`}>
            <div className='flex items-center gap-2 mb-4'>
                <Route className='w-4 h-4 sm:w-5 sm:h-5' />
                <h2 className='text-lg sm:text-xl font-semibold font-serif'>
                    Visit History
                </h2>
                <span className='bg-primary/15 text-primary text-xs sm:text-sm font-bold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full'>
                    {sortedVisits.length}{" "}
                    {sortedVisits.length === 1 ? "cafe" : "cafes"}
                </span>
                {!isPublic && (
                    <Link
                        href='/profile/visits'
                        className='ml-auto text-xs sm:text-sm text-primary hover:text-primary/80 font-medium transition-colors'
                    >
                        View All →
                    </Link>
                )}
            </div>

            {/* Fixed wrapper for visual box (background & border) */}
            <div className='bg-text/5 border border-text/10 rounded-xl relative overflow-hidden'>
                {/* Scrollable container */}
                <div
                    ref={scrollContainerRef}
                    className='overflow-x-auto overflow-y-hidden relative
                        [&::-webkit-scrollbar]:h-2
                        [&::-webkit-scrollbar-track]:bg-transparent
                        [&::-webkit-scrollbar-track]:rounded-full
                        [&::-webkit-scrollbar-thumb]:bg-primary/30
                        [&::-webkit-scrollbar-thumb]:rounded-full
                        [&::-webkit-scrollbar-thumb]:hover:bg-primary/50
                        scrollbar-thin'
                    style={{
                        scrollBehavior: "smooth",
                        scrollbarWidth: "thin",
                        scrollbarColor: "rgb(116 81 45 / 0.3) transparent",
                    }}
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
                        {/* Footstep icons connecting badges */}
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
                                (index === 0
                                    ? 0
                                    : getVerticalOffset(cafe.slug, isMobile))
                            const y2 =
                                CENTER_Y +
                                getVerticalOffset(nextCafe.slug, isMobile)

                            // Get S-curve control points
                            const { cp1x, cp1y, cp2x, cp2y } =
                                getSCurveControls(
                                    cafe.slug,
                                    nextCafe.slug,
                                    x1,
                                    y1,
                                    x2,
                                    y2,
                                )

                            // Generate footstep positions along the curve (start at 25%, end at 75%)
                            const footsteps = []
                            const startT = isMobile ? 0.35 : 0.25
                            const endT = isMobile ? 0.95 : 1.0
                            for (let i = 0; i < FOOTSTEP_COUNT; i++) {
                                const t =
                                    startT +
                                    ((endT - startT) * (i + 0.5)) /
                                        FOOTSTEP_COUNT
                                const point = getPointOnCurve(
                                    t,
                                    x1,
                                    y1,
                                    cp1x,
                                    cp1y,
                                    cp2x,
                                    cp2y,
                                    x2,
                                    y2,
                                )
                                const angle = getTangentAngle(
                                    t,
                                    x1,
                                    y1,
                                    cp1x,
                                    cp1y,
                                    cp2x,
                                    cp2y,
                                    x2,
                                    y2,
                                )
                                footsteps.push({ ...point, angle, t })
                            }

                            return footsteps.map((footstep, fIndex) => (
                                <motion.div
                                    key={`footstep-${cafe.slug}-${nextCafe.slug}-${fIndex}`}
                                    className='absolute pointer-events-none'
                                    style={{
                                        left: `${footstep.x}px`,
                                        top: `${footstep.y}px`,
                                    }}
                                    initial={{
                                        scale: 0,
                                        opacity: 0,
                                        x: "-50%",
                                        y: "-50%",
                                        rotate: 0,
                                    }}
                                    animate={{
                                        scale: 1,
                                        opacity: 0.35,
                                        x: "-50%",
                                        y: "-50%",
                                        rotate: footstep.angle + 90,
                                    }}
                                    transition={{
                                        delay:
                                            index * 0.1 +
                                            fIndex * 0.05 +
                                            footstep.t * 0.1,
                                        type: "spring",
                                        stiffness: 400,
                                        damping: 25,
                                    }}
                                >
                                    <Footprints
                                        className={`${isMobile ? "w-4 h-4" : "w-5 h-5"} text-primary fill-primary/40`}
                                    />
                                </motion.div>
                            ))
                        })}

                        {/* Badge nodes */}
                        {sortedVisits.map((cafe, index) => {
                            const x = 60 + index * BADGE_SPACING
                            // First item is always centered (offset 0)
                            const offset =
                                index === 0
                                    ? 0
                                    : getVerticalOffset(cafe.slug, isMobile)
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
                                        <motion.div
                                            whileHover={{
                                                scale: 1.05,
                                                boxShadow:
                                                    "0 0 20px rgba(116, 81, 45, 0.4)",
                                            }}
                                            className='rounded-full bg-background border-2 border-primary/40 flex items-center justify-center overflow-hidden transition-all duration-200'
                                            style={{
                                                width: `${BADGE_SIZE}px`,
                                                height: `${BADGE_SIZE}px`,
                                                boxShadow:
                                                    "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                            }}
                                        >
                                            {index ===
                                                sortedVisits.length - 1 && (
                                                <>
                                                    <span className='-z-10 animate-ping absolute inline-flex h-auto w-full aspect-square rounded-full bg-primary/60 opacity-10'></span>
                                                </>
                                            )}
                                            <Suspense
                                                fallback={
                                                    <Coffee
                                                        className={`${isMobile ? "w-5 h-5" : "w-6 h-6"} text-primary/70 group-hover:text-primary transition-colors`}
                                                    />
                                                }
                                            >
                                                {cafe.thumbnail ? (
                                                    <Image
                                                        src={getCafeThumbnailUrl(
                                                            cafe.thumbnail,
                                                        )}
                                                        alt={cafe.name}
                                                        width={BADGE_SIZE}
                                                        height={BADGE_SIZE}
                                                        className='object-cover w-full h-full'
                                                    />
                                                ) : (
                                                    <Coffee
                                                        className={`${isMobile ? "w-5 h-5" : "w-6 h-6"} text-primary/70 group-hover:text-primary transition-colors`}
                                                    />
                                                )}
                                            </Suspense>
                                        </motion.div>

                                        {/* Cafe name - responsive display */}
                                        <motion.span
                                            whileHover={{
                                                color: "rgb(116, 81, 45)",
                                            }}
                                            className='mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-text/80 font-medium text-center leading-tight'
                                            style={{
                                                maxWidth: isMobile
                                                    ? "100px"
                                                    : "120px",
                                                wordBreak: "break-word",
                                            }}
                                        >
                                            {cafe.name}
                                        </motion.span>

                                        {/* Date below name */}
                                        <span className='text-[9px] sm:text-[10px] text-text/40 font-medium whitespace-nowrap'>
                                            {cafe.visitCount &&
                                            cafe.visitCount > 1 ? (
                                                <span className='text-primary font-semibold'>
                                                    {cafe.visitCount}× visited
                                                </span>
                                            ) : cafe.visited_at ? (
                                                new Date(
                                                    cafe.visited_at,
                                                ).toLocaleDateString("en-US", {
                                                    month: "short",
                                                    day: "numeric",
                                                })
                                            ) : (
                                                "—"
                                            )}
                                        </span>
                                    </Link>
                                </motion.div>
                            )
                        })}
                    </div>
                </div>

                {/* Scroll hint gradient overlays - Fixed positioning */}
                <div className='absolute left-0 top-0 bottom-0 w-6 sm:w-8 bg-linear-to-r from-text/5 to-transparent pointer-events-none' />
                <div className='absolute right-0 top-0 bottom-0 w-6 sm:w-8 bg-linear-to-l from-text/5 to-transparent pointer-events-none' />
            </div>

            {/* Scroll hint text */}
            <p className='text-[10px] sm:text-xs text-text/40 text-center mt-2'>
                ← Scroll cafe journey →
            </p>
        </div>
    )
}
