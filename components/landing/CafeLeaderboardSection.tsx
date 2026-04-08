"use client"

import { CrownIcon, Star, ArrowRight } from "lucide-react"
import { motion } from "motion/react"
import Image from "next/image"
import Link from "next/link"
import { getCafeThumbnailUrl } from "@/utils/extras"

interface LandingCafeEntry {
    cafeId: string
    name: string
    slug: string
    thumbnail: string
    region: string
    score: number
    visitCount: number
    avgRating: number | null
}

interface CafeLeaderboardSectionProps {
    topCafes: LandingCafeEntry[]
}

export default function CafeLeaderboardSection({
    topCafes,
}: CafeLeaderboardSectionProps) {
    // Empty state
    if (topCafes.length === 0) {
        return (
            <section
                id='cafe-leaderboard'
                className='w-full px-6 py-12 mb-8 space-y-2'
            >
                <h2 className='font-semibold font-serif text-2xl'>
                    Community Favorites
                </h2>
                <div className='bg-text/5 rounded-xl p-8 text-center'>
                    <CrownIcon className='w-12 h-12 text-text/20 mx-auto mb-3' />
                    <p className='text-text/60'>
                        No leaderboard data available yet.
                    </p>
                </div>
            </section>
        )
    }

    const firstPlace = topCafes[0]
    const secondPlace = topCafes[1]
    const thirdPlace = topCafes[2]

    return (
        <section
            id='cafe-leaderboard'
            className='w-full px-6 mb-8 space-y-2'
        >
            <div className='flex items-center justify-between'>
                <motion.h2
                    initial={{ opacity: 0 }}
                    whileInView={{
                        opacity: 1,
                        transition: { duration: 0.6, ease: "easeOut" },
                    }}
                    viewport={{ once: true, margin: "-50px" }}
                    className='font-semibold font-serif text-2xl'
                >
                    Community Favorites
                </motion.h2>
                <Link
                    href='/community?tab=leaderboard'
                    className='text-sm font-medium flex items-center gap-1 text-primary hover:underline'
                >
                    View Leaderboard
                    <ArrowRight className='w-4 h-4' />
                </Link>
            </div>
            <div className='flex flex-col md:flex-row gap-4 w-full'>
                {/* 1st Place - Hero Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{
                        opacity: 1,
                        y: 0,
                        transition: {
                            duration: 0.6,
                            ease: "easeOut",
                            delay: 0.1,
                        },
                    }}
                    viewport={{ once: true, margin: "-50px" }}
                    className='relative aspect-video h-auto w-full md:w-3/5 rounded-xl overflow-clip shadow-md'
                >
                    <Link
                        href={`/cafes/${firstPlace.slug}`}
                        className='block w-full h-full'
                    >
                        <div className='absolute left-2 top-4 z-10 bg-background px-3 py-1 pl-12 rounded-full text-xs md:text-sm font-semibold shadow-md'>
                            <div className='w-10 h-10 p-2 absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-linear-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-sm'>
                                <CrownIcon className='w-full' />
                            </div>
                            Top Cafe of the Month
                        </div>
                        <Image
                            src={getCafeThumbnailUrl(
                                firstPlace.thumbnail || "placeholder",
                            )}
                            alt={firstPlace.name}
                            fill
                            className='object-cover'
                            sizes='(max-width: 768px) 100vw, 60vw'
                            priority
                        />
                        <div className='absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/70 to-transparent p-4'>
                            <h3 className='text-white font-semibold text-lg'>
                                {firstPlace.name}
                            </h3>
                            <div className='flex items-center gap-3 text-white/80'>
                                <span className='text-lg font-bold'>
                                    {firstPlace.score.toLocaleString()} pts
                                </span>
                                {firstPlace.avgRating && (
                                    <span className='flex items-center gap-1 text-sm'>
                                        <Star className='w-4 h-4 text-yellow-400 fill-yellow-400' />
                                        {firstPlace.avgRating.toFixed(1)}
                                    </span>
                                )}
                                <span className='text-xs bg-background/10 px-2 py-1 rounded-md flex flex-row gap-2 items-center backdrop-blur-sm font-semibold text-white'>
                                    {firstPlace.region}
                                </span>
                            </div>
                        </div>
                    </Link>
                </motion.div>

                {/* 2nd & 3rd Place - Side Cards */}
                <div className='flex flex-col gap-4 flex-1 w-full md:w-auto'>
                    {secondPlace && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{
                                opacity: 1,
                                y: 0,
                                transition: {
                                    duration: 0.6,
                                    ease: "easeOut",
                                    delay: 0.2,
                                },
                            }}
                            viewport={{ once: true, margin: "-50px" }}
                            whileHover={{
                                y: -5,
                                transition: {
                                    type: "spring",
                                    stiffness: 300,
                                    damping: 20,
                                },
                            }}
                            className='relative md:aspect-auto bg-text/5 rounded-xl border-text/5 border p-4 cursor-pointer hover:bg-text/10 hover:border-text/10 transition-colors flex flex-row gap-3'
                        >
                            <Link
                                href={`/cafes/${secondPlace.slug}`}
                                className='flex flex-row gap-3 w-full'
                            >
                                <div className='relative h-24 w-24 min-w-24 aspect-square rounded-lg overflow-clip'>
                                    <Image
                                        src={getCafeThumbnailUrl(
                                            secondPlace.thumbnail ||
                                                "placeholder",
                                        )}
                                        alt={secondPlace.name}
                                        fill
                                        className='object-cover'
                                        sizes='96px'
                                        loading='lazy'
                                    />
                                </div>
                                <div className='flex flex-col justify-center'>
                                    <h4 className='font-semibold text-text line-clamp-1'>
                                        {secondPlace.name}
                                    </h4>
                                    <div className='flex items-center gap-2 mt-1'>
                                        <span className='text-base font-bold'>
                                            {secondPlace.score.toLocaleString()}{" "}
                                            pts
                                        </span>
                                        {secondPlace.avgRating && (
                                            <span className='flex items-center gap-1 text-sm text-text/60'>
                                                <Star className='w-3 h-3 text-yellow-400 fill-yellow-400' />
                                                {secondPlace.avgRating.toFixed(
                                                    1,
                                                )}
                                            </span>
                                        )}
                                    </div>
                                    <span className='text-xs bg-text/5 px-2 py-0.5 rounded-full w-fit mt-1'>
                                        {secondPlace.region}
                                    </span>
                                </div>
                            </Link>
                        </motion.div>
                    )}

                    {thirdPlace && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{
                                opacity: 1,
                                y: 0,
                                transition: {
                                    duration: 0.6,
                                    ease: "easeOut",
                                    delay: 0.4,
                                },
                            }}
                            viewport={{ once: true, margin: "-50px" }}
                            whileHover={{
                                y: -5,
                                transition: {
                                    type: "spring",
                                    stiffness: 300,
                                    damping: 20,
                                },
                            }}
                            className='relative md:aspect-auto bg-text/5 rounded-xl border-text/5 border p-4 cursor-pointer hover:bg-text/10 hover:border-text/10 transition-colors flex flex-row gap-3'
                        >
                            <Link
                                href={`/cafes/${thirdPlace.slug}`}
                                className='flex flex-row gap-3 w-full'
                            >
                                <div className='relative h-24 w-24 min-w-24 aspect-square rounded-lg overflow-clip'>
                                    <Image
                                        src={getCafeThumbnailUrl(
                                            thirdPlace.thumbnail ||
                                                "placeholder",
                                        )}
                                        alt={thirdPlace.name}
                                        fill
                                        className='object-cover'
                                        sizes='96px'
                                        loading='lazy'
                                    />
                                </div>
                                <div className='flex flex-col justify-center'>
                                    <h4 className='font-semibold text-text line-clamp-1'>
                                        {thirdPlace.name}
                                    </h4>
                                    <div className='flex items-center gap-2 mt-1'>
                                        <span className='text-base font-bold'>
                                            {thirdPlace.score.toLocaleString()}{" "}
                                            pts
                                        </span>
                                        {thirdPlace.avgRating && (
                                            <span className='flex items-center gap-1 text-sm text-text/60'>
                                                <Star className='w-3 h-3 text-yellow-400 fill-yellow-400' />
                                                {thirdPlace.avgRating.toFixed(
                                                    1,
                                                )}
                                            </span>
                                        )}
                                    </div>
                                    <span className='text-xs bg-text/5 px-2 py-0.5 rounded-full w-fit mt-1'>
                                        {thirdPlace.region}
                                    </span>
                                </div>
                            </Link>
                        </motion.div>
                    )}
                </div>
            </div>
        </section>
    )
}
