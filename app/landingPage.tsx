"use client"

import CafeMapWrapper from "@/components/CafeMapWrapper"
import RecentCard from "@/components/RecentCard"
import { dummyCafes } from "@/utils/dummy/cafes"
import { getDailyFeatured } from "@/utils/featured"
import { FeaturedCafe } from "@/utils/types/cafe"
import { StarIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useCallback, useContext, useEffect, useState } from "react"
import { motion } from "motion/react"
import { NotificationContext } from "@/components/NotificationProvider"

export default function LandingPage() {
    // Context
    const { addNotification } = useContext(NotificationContext)
    // Constants
    // States
    const [featured, setFeatured] = useState<FeaturedCafe>()
    // Functions
    const getFeaturedCafe = useCallback(async () => {
        const cafe = getDailyFeatured(dummyCafes)
        if (!cafe) return
        setFeatured({
            title: cafe.name,
            description: cafe.description,
            image: cafe.thumbnail,
            url: `/cafes/${cafe.slug}`,
            rating: cafe.rating,
            reviews: cafe.reviews,
        })
    }, [setFeatured])
    // Effects
    useEffect(() => {
        getFeaturedCafe()
    }, [getFeaturedCafe])
    // Render
    return (
        <>
            <section
                id='hero'
                className='flex flex-col w-full items-center px-6 py-6 gap-6'
            >
                {/* Information */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{
                        opacity: 1,
                        transition: { duration: 0.6, delay: 0.3 },
                    }}
                    className='w-full flex flex-col gap-4'
                >
                    <div className='w-full flex flex-col md:flex-row gap-4 md:gap-6'>
                        <div className='flex-1 flex flex-col'>
                            <motion.h1 className='text-5xl md:text-6xl lg:text-7xl font-bold'>
                                GROUNDS<span className='text-text/60'>.</span>
                                <br />
                                COFFEE
                            </motion.h1>
                            <motion.span className='text-xl md:text-2xl lg:text-3xl font-semibold'>
                                Discover Cebu's Best Cafes
                            </motion.span>
                        </div>
                        <div className='flex-1 flex flex-col'>
                            {featured && (
                                <>
                                    <motion.h2 className='text-4xl md:text-5xl lg:text-6xl font-bold font-serif'>
                                        Today's Featured
                                    </motion.h2>
                                    <motion.p className='text-sm md:text-base lg:text-lg my-4 md:my-6'>
                                        {featured.description}
                                    </motion.p>
                                    <Link
                                        href={featured.url}
                                        className='px-4 py-1 w-max bg-text text-background font-serif italic font-semibold rounded-lg transition-colors hover:bg-text/60 relative group'
                                    >
                                        Learn More
                                        <div className='absolute opacity-0 left-0 top-1/2 -translate-y-1/2 w-max text-text font-normal font-sans pl-4 transition-all group-hover:translate-x-full group-hover:opacity-100 -z-1'>
                                            View Details
                                        </div>
                                    </Link>
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
                            <span>{featured.title}</span>
                            <span className='text-background/60 hidden md:block'>
                                |
                            </span>
                            <span className='flex flex-row gap-2 items-center text-xl'>
                                {featured.rating}/10
                                <StarIcon className='w-4 h-4 fill-background' />
                            </span>
                            <span className='text-background/60 hidden md:block'>
                                |
                            </span>
                            <span className='flex flex-row gap-2 items-center text-xl'>
                                {featured.reviews} Reviews
                            </span>
                        </div>
                    )}
                    {featured?.image && (
                        <Image
                            src={featured?.image}
                            alt=''
                            fill
                            className='object-cover'
                            draggable={false}
                        />
                    )}
                </motion.div>
            </section>
            <button
                onClick={() => {
                    addNotification("Info Notification", "info", "Info")
                    addNotification(
                        "Success Notification",
                        "success",
                        "Success"
                    )
                    addNotification("Error Notification", "error", "Error")
                    addNotification(
                        "Warning Notification",
                        "warning",
                        "Warning"
                    )
                }}
            >
                Test Notifications
            </button>
            {/* Recently Added */}
            <section className='w-full min-h-max flex flex-col'>
                <h2 className='font-semibold font-serif text-2xl px-6'>
                    Recently Added Cafes
                </h2>
                <div className='flex flex-row gap-8 min-w-full overflow-x-auto overscroll-x-contain px-4 pt-4 pb-10 snap-x snap-mandatory'>
                    {dummyCafes.map((cafe, idx) => (
                        <RecentCard
                            key={cafe.id}
                            cafe={cafe}
                            idx={idx}
                        />
                    ))}
                </div>
            </section>
            {/* Interactive Map */}
            <section className='w-full min-h-screen p-4 flex justify-center'>
                <div className='bg-secondary/20 border-2 border-white/10 w-full flex-1 rounded-md overflow-clip'>
                    <CafeMapWrapper cafes={dummyCafes} />
                </div>
            </section>
        </>
    )
}
