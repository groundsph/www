"use client"

import { CafeWithRatings } from "@/utils/types/extra"
import { StarIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { motion } from "motion/react"

interface LandingHeroProps {
    featured: CafeWithRatings | null
}

export default function LandingHero({ featured }: LandingHeroProps) {
    return (
        <section
            id='hero'
            className='flex flex-col w-full items-center md:px-6 py-6 gap-6'
        >
            {/* Information */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{
                    opacity: 1,
                    transition: { duration: 0.6, delay: 0.3 },
                }}
                className='w-full flex flex-col gap-4 px-6 md:px-0'
            >
                <div className='w-full flex flex-col md:flex-row gap-4 md:gap-6'>
                    <div className='flex-1 flex flex-col'>
                        <motion.h1 className='text-5xl md:text-6xl lg:text-7xl font-bold flex flex-col'>
                            <span>
                                GROUNDS
                                <span className='text-text/60'>.</span>
                            </span>
                            <span className='font-medium text-text/60 text-4xl md:text-5xl lg:text-6xl'>
                                COFFEE
                            </span>
                        </motion.h1>
                        <motion.span className='text-xl md:text-2xl lg:text-3xl font-semibold'>
                            Discover the finest cafes across the archipelago
                        </motion.span>
                    </div>
                    <div className='flex-1 flex flex-col'>
                        {featured && (
                            <>
                                <motion.h2 className='text-4xl md:text-5xl lg:text-6xl font-bold font-serif'>
                                    Today&apos;s Featured
                                </motion.h2>
                                <motion.p className='text-sm md:text-base lg:text-lg my-4 md:my-6'>
                                    {featured.description}
                                </motion.p>
                                {featured.slug && (
                                    <Link
                                        href={`/cafes/${featured.slug}`}
                                        className='px-4 py-1 w-max bg-text text-background font-serif italic font-semibold rounded-lg transition-colors hover:bg-text/60 relative group shadow-lg hover:shadow-xl'
                                    >
                                        Learn More
                                        <div className='absolute opacity-0 left-0 top-1/2 -translate-y-1/2 w-max text-text font-normal font-sans pl-4 transition-all group-hover:translate-x-[calc(100%+1rem)] group-hover:opacity-100 -z-1'>
                                            View Details
                                        </div>
                                    </Link>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </motion.div>
            {/* Photo */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.6, delay: 0.3 + 0.6 * 1 },
                }}
                className='w-full relative h-auto aspect-square md:aspect-video'
            >
                <div className='absolute inset-0 bg-linear-to-b from-black/50 via-black/20 to-transparent z-10' />
                {featured && (
                    <div className='absolute top-0 z-20 px-4 py-4 max-w-full w-max gap-x-2 text-3xl font-semibold flex flex-row flex-wrap text-background'>
                        <span>{featured.name}</span>
                        <div className='bg-background/10 px-2 py-1 rounded-md flex flex-row gap-2 items-center backdrop-blur-sm text-base font-semibold text-white'>
                            {featured.city_municipality}
                        </div>
                        <div className='bg-background/10 px-2 py-1 rounded-md flex flex-row gap-2 items-center backdrop-blur-sm'>
                            <span className='flex flex-row gap-1 items-center text-base font-semibold'>
                                <StarIcon className='w-5 h-5 fill-background' />
                                {featured.average_rating?.toFixed(1) || "N/A"}
                            </span>
                            <span className='flex flex-row items-center text-sm font-medium text-white/60'>
                                ({featured.total_reviews || 0} Reviews)
                            </span>
                        </div>
                    </div>
                )}
                {featured?.thumbnail && (
                    <Image
                        src={featured.thumbnail}
                        alt=''
                        fill
                        className='object-cover'
                        draggable={false}
                    />
                )}
            </motion.div>
        </section>
    )
}
