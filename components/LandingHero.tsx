"use client"

import { CafeWithRatings } from "@/utils/types/extra"
import { MapPinIcon, StarIcon, InfoIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { motion, AnimatePresence } from "motion/react"
import { useLandingLocation } from "@/hooks/useLandingLocation"
import RandomCafeButton from "@/components/RandomCafeButton"

interface LandingHeroProps {
    featured: CafeWithRatings | null
}

const MotionLink = motion.create(Link)

export default function LandingHero({
    featured: initialFeatured,
}: LandingHeroProps) {
    const { featured, isLocalFeatured, locationName, isEstimate } =
        useLandingLocation(initialFeatured)

    return (
        <section
            id='hero'
            className='flex flex-col w-full items-center md:px-6 py-6 gap-6'
        >
            {/* Information */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.05 }}
                className='w-full flex flex-col gap-4 px-6 md:px-0'
            >
                <div className='w-full flex flex-col md:flex-row gap-4 md:gap-6'>
                    <div className='flex-1 flex flex-col'>
                        <motion.h1
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                duration: 0.8,
                                delay: 0.1,
                                ease: "easeOut",
                            }}
                            className='text-5xl md:text-6xl lg:text-7xl font-bold flex flex-col'
                        >
                            <span>
                                GROUNDS
                                <span className='text-text/60'>.</span>
                            </span>
                            <span className='font-medium text-text/60 text-4xl md:text-5xl lg:text-6xl'>
                                PH
                            </span>
                        </motion.h1>
                        <motion.span
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                duration: 0.8,
                                delay: 0.2,
                                ease: "easeOut",
                            }}
                            className='text-lg md:text-2xl lg:text-3xl font-semibold'
                        >
                            Discover the finest cafes across the archipelago
                        </motion.span>
                    </div>
                    <div className='flex-1 flex flex-col'>
                        {featured && (
                            <>
                                <div className='flex flex-col gap-1'>
                                    <motion.h2
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{
                                            duration: 0.8,
                                            delay: 0.3,
                                            ease: "easeOut",
                                        }}
                                        className='text-2xl md:text-5xl lg:text-6xl font-bold font-serif'
                                    >
                                        Today&apos;s Featured
                                    </motion.h2>
                                    {isLocalFeatured && locationName && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 5 }}
                                            transition={{
                                                duration: 0.8,
                                                delay: 0.35,
                                                ease: "easeOut",
                                            }}
                                            className='flex flex-col gap-1'
                                        >
                                            <div className='flex flex-row items-center gap-1 text-sm text-text/60'>
                                                <MapPinIcon className='w-4 h-4' />
                                                <span>
                                                    Featured near {locationName}
                                                </span>
                                            </div>
                                            {isEstimate && (
                                                <div className='flex flex-row items-center gap-1 text-xs text-text/40 italic'>
                                                    <InfoIcon className='w-3 h-3' />
                                                    <span>
                                                        Location estimated from
                                                        IP address
                                                    </span>
                                                </div>
                                            )}
                                        </motion.div>
                                    )}
                                </div>
                                <AnimatePresence mode='wait'>
                                    <motion.p
                                        key={featured.id}
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 5 }}
                                        transition={{
                                            duration: 0.8,
                                            delay: 0.4,
                                            ease: "easeOut",
                                        }}
                                        className='text-sm md:text-base lg:text-lg my-4 md:my-6'
                                    >
                                        {featured.description}
                                    </motion.p>
                                </AnimatePresence>
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{
                                        duration: 0.8,
                                        delay: 0.5,
                                        ease: "easeOut",
                                    }}
                                    className='w-full flex flex-row gap-4 items-center flex-wrap'
                                >
                                    <MotionLink
                                        href='/map'
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        className='px-4 py-1 w-max text-sm md:text-base bg-text text-background font-serif italic font-semibold rounded-lg transition-colors hover:bg-text/60 relative group shadow-lg hover:shadow-xl text-nowrap flex flex-row gap-2 items-center'
                                    >
                                        Find Cafes Near Me
                                        <span className='relative flex h-2 w-2'>
                                            <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75'></span>
                                            <span className='relative inline-flex rounded-full h-2 w-2 bg-green-500'></span>
                                        </span>
                                    </MotionLink>
                                    <span className='text-text/60'>or</span>
                                    <RandomCafeButton variant='hero' />
                                </motion.div>
                            </>
                        )}
                    </div>
                </div>
            </motion.div>
            {/* Photo */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{
                    opacity: 1,
                    transition: { duration: 0.8, delay: 0.6, ease: "easeOut" },
                }}
                className='w-full relative h-auto aspect-square md:aspect-video'
            >
                <div className='absolute inset-0 bg-linear-to-b from-black/50 via-black/20 to-transparent z-10' />
                <AnimatePresence mode='popLayout'>
                    {featured && (
                        <motion.div
                            key={featured.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5, ease: "easeInOut" }}
                            className='absolute inset-0'
                        >
                            <div className='absolute top-0 z-20 px-4 py-4 max-w-full w-max gap-x-2 text-3xl font-semibold flex flex-row flex-wrap text-background'>
                                <span>{featured.name}</span>
                                <div className='bg-background/10 px-2 py-1 rounded-md flex flex-row gap-2 items-center backdrop-blur-sm text-base font-semibold text-white'>
                                    {featured.city_municipality}
                                </div>
                                <div className='bg-background/10 px-2 py-1 rounded-md flex flex-row gap-2 items-center backdrop-blur-sm'>
                                    <span className='flex flex-row gap-1 items-center text-base font-semibold'>
                                        <StarIcon className='w-5 h-5 fill-background' />
                                        {featured.average_rating?.toFixed(1) ||
                                            "N/A"}
                                    </span>
                                    <span className='flex flex-row items-center text-sm font-medium text-white/60'>
                                        ({featured.total_reviews || 0} Reviews)
                                    </span>
                                </div>
                            </div>
                            {featured.thumbnail && (
                                <Image
                                    src={featured.thumbnail}
                                    alt=''
                                    fill
                                    className='object-cover'
                                    draggable={false}
                                    priority
                                    sizes='(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 80vw'
                                    placeholder='blur'
                                    blurDataURL='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIhAAAAUDBAMAAAAAAAAAAAAAAAECAwQFESESBhMxQVH/xAAVAQEBAAAAAAAAAAAAAAAAAAADBP/EABoRAAICAwAAAAAAAAAAAAAAAAECABEDITH/2gAMAwEAAhEDEEA/ALS9cV6W3HuVPUYuT/qZSyH6k+AAFZdD/9k='
                                />
                            )}
                        </motion.div>
                    )}
                    {featured && (
                        <MotionLink
                            href={`/cafes/${featured.slug}`}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className='absolute bottom-4 right-4 z-10 px-2 py-1 w-max rounded-md bg-background/10 text-white text-lg font-semibold backdrop-blur-sm hover:bg-background/20 transition-colors shadow-lg hover:shadow-xl'
                        >
                            Learn More
                        </MotionLink>
                    )}
                </AnimatePresence>
            </motion.div>
        </section>
    )
}
