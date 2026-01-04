"use client"

import { getLocationFeatured } from "@/app/api/actions/cafe"
import { CafeWithRatings } from "@/utils/types/extra"
import { MapPinIcon, StarIcon, InfoIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { motion, AnimatePresence } from "motion/react"
import { useEffect, useState } from "react"

interface LandingHeroProps {
    featured: CafeWithRatings | null
}

const MotionLink = motion(Link)

/**
 * Fallback: Get location from IP address using ip-api.com
 */
async function getLocationFromIP(): Promise<{
    city: string | null
    region: string | null
    lat: number
    lng: number
} | null> {
    try {
        const response = await fetch(
            "http://ip-api.com/json/?fields=city,regionName,lat,lon,status"
        )
        const data = await response.json()

        if (data.status === "success") {
            return {
                city: data.city || null,
                region: data.regionName || null,
                lat: data.lat,
                lng: data.lon,
            }
        }
        return null
    } catch (err) {
        console.error("Failed to get location from IP:", err)
        return null
    }
}

export default function LandingHero({
    featured: initialFeatured,
}: LandingHeroProps) {
    const [featured, setFeatured] = useState<CafeWithRatings | null>(
        initialFeatured
    )
    const [isLocalFeatured, setIsLocalFeatured] = useState(false)
    const [locationName, setLocationName] = useState<string | null>(null)
    const [isEstimate, setIsEstimate] = useState(false)

    useEffect(() => {
        // Check sessionStorage cache first
        const cachedLocation = sessionStorage.getItem("grounds_location")
        if (cachedLocation) {
            try {
                const {
                    city,
                    region,
                    featured: cachedFeatured,
                    isEstimate: cachedIsEstimate,
                } = JSON.parse(cachedLocation)
                if (cachedFeatured) {
                    // eslint-disable-next-line react-hooks/set-state-in-effect
                    setFeatured(cachedFeatured)
                    setIsLocalFeatured(true)
                    setLocationName(city || region || null)
                    setIsEstimate(cachedIsEstimate || false)
                    return
                }
            } catch {
                // Invalid cache, proceed with fresh fetch
            }
        }

        // Helper function to get location from IP
        const tryIPFallback = async () => {
            console.log("Trying IP-based location fallback...")
            const ipLocation = await getLocationFromIP()
            if (ipLocation && (ipLocation.city || ipLocation.region)) {
                const { city, region } = ipLocation
                console.log("IP fallback location:", city, region)

                const localFeatured = await getLocationFeatured(
                    city ?? undefined,
                    region ?? undefined
                )
                if (localFeatured) {
                    setFeatured(localFeatured)
                    setIsLocalFeatured(true)
                    setLocationName(city || region || null)
                    setIsEstimate(true)
                    sessionStorage.setItem(
                        "grounds_location",
                        JSON.stringify({
                            city,
                            region,
                            featured: localFeatured,
                            isEstimate: true,
                        })
                    )
                }
            }
        }

        // Skip if geolocation not supported
        if (typeof window === "undefined" || !navigator.geolocation) {
            console.log("Geolocation not supported, trying IP fallback")
            tryIPFallback()
            return
        }

        const handlePosition = async (position: GeolocationPosition) => {
            try {
                console.log(
                    "Got position:",
                    position.coords.latitude,
                    position.coords.longitude
                )

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

                console.log("Location:", city, region)

                if (city || region) {
                    const localFeatured = await getLocationFeatured(
                        city,
                        region
                    )
                    if (localFeatured) {
                        setFeatured(localFeatured)
                        setIsLocalFeatured(true)
                        setLocationName(city || region || null)
                        setIsEstimate(false)
                        sessionStorage.setItem(
                            "grounds_location",
                            JSON.stringify({
                                city,
                                region,
                                featured: localFeatured,
                                isEstimate: false,
                            })
                        )
                    }
                }
            } catch (error) {
                console.error("Failed to process location:", error)
                // Try IP fallback on reverse geocoding failure
                await tryIPFallback()
            }
        }

        // Use watchPosition which sometimes works when getCurrentPosition fails
        let watchId: number | null = null
        let hasPosition = false

        const startWatching = async () => {
            console.log("Starting geolocation watch...")

            // Check permission first
            if (navigator.permissions) {
                try {
                    const permission = await navigator.permissions.query({
                        name: "geolocation",
                    })
                    if (permission.state === "denied") {
                        console.log("Permission denied, trying IP fallback")
                        await tryIPFallback()
                        return
                    }
                } catch {
                    // Permissions API not available, continue
                }
            }

            watchId = navigator.geolocation.watchPosition(
                (position) => {
                    if (hasPosition) return // Already got a position
                    hasPosition = true
                    console.log(
                        "Watch got position:",
                        position.coords.latitude,
                        position.coords.longitude
                    )
                    handlePosition(position)
                    // Stop watching after getting position
                    if (watchId !== null) {
                        navigator.geolocation.clearWatch(watchId)
                    }
                },
                async (error) => {
                    console.log("Watch error:", error.code, error.message)
                    if (error.code === error.PERMISSION_DENIED) {
                        console.log(
                            "User denied location permission, trying IP fallback"
                        )
                        if (watchId !== null) {
                            navigator.geolocation.clearWatch(watchId)
                        }
                        await tryIPFallback()
                    } else if (
                        error.code === error.POSITION_UNAVAILABLE ||
                        error.code === error.TIMEOUT
                    ) {
                        // Position unavailable or timeout, try IP fallback
                        console.log(
                            "Position unavailable/timeout, trying IP fallback"
                        )
                        if (watchId !== null) {
                            navigator.geolocation.clearWatch(watchId)
                        }
                        await tryIPFallback()
                    }
                },
                {
                    timeout: 15000,
                    maximumAge: 60000,
                    enableHighAccuracy: false,
                }
            )
        }

        // Delay to prioritize initial paint
        const timeoutId = setTimeout(() => startWatching(), 1500)
        return () => {
            clearTimeout(timeoutId)
            if (watchId !== null) {
                navigator.geolocation.clearWatch(watchId)
            }
        }
    }, [])

    return (
        <section
            id='hero'
            className='flex flex-col w-full items-center md:px-6 py-6 gap-6'
        >
            {/* Information */}
            <motion.div
                initial='hidden'
                animate='visible'
                variants={{
                    hidden: { opacity: 0 },
                    visible: {
                        opacity: 1,
                        transition: {
                            staggerChildren: 0.15,
                            delayChildren: 0.2,
                        },
                    },
                }}
                className='w-full flex flex-col gap-4 px-6 md:px-0'
            >
                <div className='w-full flex flex-col md:flex-row gap-4 md:gap-6'>
                    <div className='flex-1 flex flex-col'>
                        <motion.h1
                            variants={{
                                hidden: { opacity: 0, y: 10 },
                                visible: {
                                    opacity: 1,
                                    y: 0,
                                    transition: {
                                        duration: 0.8,
                                        ease: "easeOut",
                                    },
                                },
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
                            variants={{
                                hidden: { opacity: 0, y: 10 },
                                visible: {
                                    opacity: 1,
                                    y: 0,
                                    transition: {
                                        duration: 0.8,
                                        ease: "easeOut",
                                    },
                                },
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
                                        variants={{
                                            hidden: { opacity: 0, y: 10 },
                                            visible: {
                                                opacity: 1,
                                                y: 0,
                                                transition: {
                                                    duration: 0.8,
                                                    ease: "easeOut",
                                                },
                                            },
                                        }}
                                        className='text-2xl md:text-5xl lg:text-6xl font-bold font-serif'
                                    >
                                        Today&apos;s Featured
                                    </motion.h2>
                                    {isLocalFeatured && locationName && (
                                        <motion.div
                                            initial='hidden'
                                            animate='visible'
                                            exit='hidden'
                                            variants={{
                                                hidden: { opacity: 0, y: 5 },
                                                visible: {
                                                    opacity: 1,
                                                    y: 0,
                                                    transition: {
                                                        duration: 0.8,
                                                        delay: 0.6,
                                                        ease: "easeOut",
                                                    },
                                                },
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
                                        initial='hidden'
                                        animate='visible'
                                        exit='hidden'
                                        variants={{
                                            hidden: { opacity: 0, y: 5 },
                                            visible: {
                                                opacity: 1,
                                                y: 0,
                                                transition: {
                                                    duration: 0.8,
                                                    delay: 0.7,
                                                    ease: "easeOut",
                                                },
                                            },
                                        }}
                                        className='text-sm md:text-base lg:text-lg my-4 md:my-6'
                                    >
                                        {featured.description}
                                    </motion.p>
                                </AnimatePresence>
                                <motion.div
                                    variants={{
                                        hidden: { opacity: 0 },
                                        visible: {
                                            opacity: 1,
                                            transition: {
                                                duration: 0.8,
                                                ease: "easeOut",
                                            },
                                        },
                                    }}
                                    className='w-full flex flex-row gap-4 items-center flex-wrap'
                                >
                                    {featured.slug && (
                                        <MotionLink
                                            href={`/cafes/${featured.slug}`}
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            className='px-4 py-1 w-max text-sm md:text-base bg-text text-background font-serif italic font-semibold rounded-lg transition-colors hover:bg-text/60 relative group shadow-lg hover:shadow-xl text-nowrap'
                                        >
                                            Learn More
                                        </MotionLink>
                                    )}
                                    <span className='text-text/60'>or</span>
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
                    transition: { duration: 1.2, delay: 0.2, ease: "easeOut" },
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
                            transition={{ duration: 1.2, ease: "easeInOut" }}
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
                </AnimatePresence>
            </motion.div>
        </section>
    )
}
