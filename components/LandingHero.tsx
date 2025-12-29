"use client"

import { getLocationFeatured } from "@/app/api/actions/cafe"
import { CafeWithRatings } from "@/utils/types/extra"
import { MapPinIcon, StarIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { motion, AnimatePresence } from "motion/react"
import { useContext, useEffect, useState } from "react"
import { AuthContext } from "./AuthProvider"

interface LandingHeroProps {
    featured: CafeWithRatings | null
}

export default function LandingHero({
    featured: initialFeatured,
}: LandingHeroProps) {
    useContext(AuthContext) // Keep context subscription for reactivity
    const [featured, setFeatured] = useState<CafeWithRatings | null>(
        initialFeatured
    )
    const [isLocalFeatured, setIsLocalFeatured] = useState(false)
    const [locationName, setLocationName] = useState<string | null>(null)

    useEffect(() => {
        // Skip if geolocation not supported
        if (!navigator.geolocation) return

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    // Reverse geocode using Nominatim (OpenStreetMap)
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?lat=${position.coords.latitude}&lon=${position.coords.longitude}&format=json&addressdetails=1`,
                        { headers: { "User-Agent": "Grounds Coffee App" } }
                    )
                    const data = await response.json()

                    // Extract city and region from response
                    const city =
                        data.address?.city ||
                        data.address?.town ||
                        data.address?.municipality ||
                        data.address?.village
                    const region = data.address?.state || data.address?.region

                    if (city || region) {
                        // Fetch location-based featured cafe
                        const localFeatured = await getLocationFeatured(
                            city,
                            region
                        )
                        if (localFeatured) {
                            setFeatured(localFeatured)
                            setIsLocalFeatured(true)
                            setLocationName(city || region || null)
                        }
                    }
                } catch (error) {
                    console.error(
                        "Failed to get location-based featured:",
                        error
                    )
                }
            },
            () => {
                // User denied location or error - silently use default featured
                console.log("Location access denied, using default featured")
            },
            { timeout: 10000, maximumAge: 300000 } // 10s timeout, cache for 5 min
        )
    }, [])

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
                                PH
                            </span>
                        </motion.h1>
                        <motion.span className='text-lg md:text-2xl lg:text-3xl font-semibold'>
                            Discover the finest cafes across the archipelago
                        </motion.span>
                    </div>
                    <div className='flex-1 flex flex-col'>
                        {featured && (
                            <>
                                <div className='flex flex-col gap-1'>
                                    <motion.h2 className='text-2xl md:text-5xl lg:text-6xl font-bold font-serif'>
                                        Today&apos;s Featured
                                    </motion.h2>
                                    {isLocalFeatured && locationName && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className='flex flex-row items-center gap-1 text-sm text-text/60'
                                        >
                                            <MapPinIcon className='w-4 h-4' />
                                            <span>
                                                Featured near {locationName}
                                            </span>
                                        </motion.div>
                                    )}
                                </div>
                                <AnimatePresence mode='wait'>
                                    <motion.p
                                        key={featured.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className='text-sm md:text-base lg:text-lg my-4 md:my-6'
                                    >
                                        {featured.description}
                                    </motion.p>
                                </AnimatePresence>
                                <div className='w-full flex flex-row gap-4 items-center flex-wrap'>
                                    {featured.slug && (
                                        <Link
                                            href={`/cafes/${featured.slug}`}
                                            className='px-4 py-1 w-max text-sm md:text-base bg-text text-background font-serif italic font-semibold rounded-lg transition-colors hover:bg-text/60 relative group shadow-lg hover:shadow-xl text-nowrap'
                                        >
                                            Learn More
                                        </Link>
                                    )}
                                    <span className='text-text/60'>or</span>
                                    <Link
                                        href='/map'
                                        className='px-4 py-1 w-max text-sm md:text-base bg-text text-background font-serif italic font-semibold rounded-lg transition-colors hover:bg-text/60 relative group shadow-lg hover:shadow-xl text-nowrap flex flex-row gap-2 items-center'
                                    >
                                        Find Cafes Near Me
                                        <span className='relative flex h-2 w-2'>
                                            <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75'></span>
                                            <span className='relative inline-flex rounded-full h-2 w-2 bg-green-500'></span>
                                        </span>
                                    </Link>
                                </div>
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
                <AnimatePresence mode='wait'>
                    {featured && (
                        <motion.div
                            key={featured.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.4 }}
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
                                />
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </section>
    )
}
