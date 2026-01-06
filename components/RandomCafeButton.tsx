"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
    Dices,
    X,
    MapPin,
    Star,
    Navigation,
    RefreshCw,
    Loader2,
} from "lucide-react"
import Image from "next/image"
import { CafeWithRatings } from "@/utils/types/extra"
import { getNearbyCafes, pickRandomCafe, formatDistance } from "@/utils/geo"
import { useUserLocation } from "@/hooks/useUserLocation"
import { getCafeThumbnailUrl, getPriceLevel, isOpenNow } from "@/utils/extras"
import { getAllCafes } from "@/app/api/actions/cafe"

interface RandomCafeButtonProps {
    cafes?: CafeWithRatings[]
    radiusKm?: number
    variant?: "default" | "hero"
}

type CafeWithDistance = CafeWithRatings & { distance: number }

export default function RandomCafeButton({
    cafes: propCafes,
    radiusKm = 10,
    variant = "default",
}: RandomCafeButtonProps) {
    const {
        location,
        loading: locationLoading,
        error: locationError,
    } = useUserLocation()
    const [isOpen, setIsOpen] = useState(false)
    const [selectedCafe, setSelectedCafe] = useState<CafeWithDistance | null>(
        null
    )
    const [isSpinning, setIsSpinning] = useState(false)
    const [fetchedCafes, setFetchedCafes] = useState<CafeWithRatings[]>([])
    const [isFetchingCafes, setIsFetchingCafes] = useState(false)

    // Use prop cafes if provided, otherwise use fetched cafes
    const cafes = propCafes ?? fetchedCafes

    // Fetch cafes on-demand when modal opens (if not provided via props)
    const fetchCafesIfNeeded = useCallback(async () => {
        if (propCafes || fetchedCafes.length > 0) return
        setIsFetchingCafes(true)
        try {
            const result = await getAllCafes(1, 100)
            setFetchedCafes(result)
        } catch (error) {
            console.error("Failed to fetch cafes:", error)
        } finally {
            setIsFetchingCafes(false)
        }
    }, [propCafes, fetchedCafes.length])

    // Get nearby cafes when we have location
    const nearbyCafes = useMemo(() => {
        if (!location.lat || !location.lng) return []
        return getNearbyCafes(cafes, location.lat, location.lng, radiusKm)
    }, [cafes, location.lat, location.lng, radiusKm])

    const pickRandom = useCallback(() => {
        if (nearbyCafes.length === 0) return

        setIsSpinning(true)

        // Quick animation delay
        setTimeout(() => {
            const picked = pickRandomCafe(nearbyCafes)
            setSelectedCafe(picked)
            setIsSpinning(false)
        }, 500)
    }, [nearbyCafes])

    // Auto-pick when modal opens and cafes are ready
    useEffect(() => {
        if (isOpen && nearbyCafes.length > 0 && !selectedCafe && !isSpinning) {
            pickRandom()
        }
    }, [isOpen, nearbyCafes.length, selectedCafe, isSpinning, pickRandom])

    const handleClick = () => {
        setIsOpen(true)
        fetchCafesIfNeeded()
    }

    const handleReroll = () => {
        pickRandom()
    }

    const handleClose = () => {
        setIsOpen(false)
        setSelectedCafe(null)
    }

    // Determine button state
    const hasLocation = location.lat != null && location.lng != null
    const hasNearbyCafes = nearbyCafes.length > 0
    const isLoading = locationLoading || isFetchingCafes

    return (
        <>
            {/* Trigger Button */}
            <button
                onClick={handleClick}
                disabled={isLoading}
                className={
                    variant === "hero"
                        ? "px-4 py-1 w-max text-sm md:text-base bg-text text-background font-serif italic font-semibold rounded-lg transition-colors hover:bg-text/60 relative group shadow-lg hover:shadow-xl text-nowrap flex flex-row gap-2 items-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        : "flex flex-row items-center gap-2 px-3 py-2 rounded-lg border border-text/20 hover:border-secondary hover:bg-secondary/10 transition-all cursor-pointer text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                }
                title='Pick a random cafe nearby'
            >
                {isLoading ? (
                    <Loader2 className='w-4 h-4 animate-spin' />
                ) : (
                    <Dices className='w-4 h-4' />
                )}
                <span className={variant === "hero" ? "" : "hidden sm:inline"}>
                    Surprise Me
                </span>
            </button>

            {/* Modal */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={handleClose}
                            className='fixed inset-0 bg-black/60 backdrop-blur-sm z-50'
                        />

                        {/* Modal Content */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className='fixed inset-x-4 top-1/2 -translate-y-1/2 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-md bg-background rounded-2xl shadow-2xl z-50 overflow-hidden'
                        >
                            {/* Header */}
                            <div className='flex items-center justify-between px-5 py-4 border-b border-text/10'>
                                <div className='flex items-center gap-2'>
                                    <Dices className='w-5 h-5 text-secondary' />
                                    <h3 className='font-semibold text-lg'>
                                        Random Cafe
                                    </h3>
                                </div>
                                <button
                                    onClick={handleClose}
                                    className='p-1 rounded-full hover:bg-text/10 transition-colors cursor-pointer'
                                >
                                    <X className='w-5 h-5' />
                                </button>
                            </div>

                            {/* Content */}
                            <div className='p-5'>
                                {/* Loading State */}
                                {isLoading && (
                                    <div className='flex flex-col items-center justify-center py-12 text-center'>
                                        <Loader2 className='w-8 h-8 animate-spin text-secondary mb-3' />
                                        <p className='text-text/60'>
                                            Getting your location...
                                        </p>
                                    </div>
                                )}

                                {/* No Location */}
                                {!locationLoading && !hasLocation && (
                                    <div className='flex flex-col items-center justify-center py-12 text-center'>
                                        <MapPin className='w-12 h-12 text-text/30 mb-3' />
                                        <p className='font-medium mb-1'>
                                            Location Required
                                        </p>
                                        <p className='text-sm text-text/60 max-w-xs'>
                                            {locationError
                                                ? "Unable to get your location. Please enable location access."
                                                : "Please allow location access to find cafes near you."}
                                        </p>
                                    </div>
                                )}

                                {/* No Nearby Cafes */}
                                {!locationLoading &&
                                    hasLocation &&
                                    !hasNearbyCafes && (
                                        <div className='flex flex-col items-center justify-center py-12 text-center'>
                                            <Navigation className='w-12 h-12 text-text/30 mb-3' />
                                            <p className='font-medium mb-1'>
                                                No Cafes Nearby
                                            </p>
                                            <p className='text-sm text-text/60 max-w-xs'>
                                                We couldn&apos;t find any cafes
                                                within {radiusKm}km of your
                                                location.
                                            </p>
                                        </div>
                                    )}

                                {/* Spinning Animation */}
                                {isSpinning && (
                                    <div className='flex flex-col items-center justify-center py-12'>
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{
                                                duration: 0.5,
                                                ease: "easeInOut",
                                            }}
                                        >
                                            <Dices className='w-12 h-12 text-secondary' />
                                        </motion.div>
                                        <p className='text-text/60 mt-3'>
                                            Picking a cafe...
                                        </p>
                                    </div>
                                )}

                                {/* Selected Cafe */}
                                {!isSpinning && selectedCafe && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className='space-y-4'
                                    >
                                        {/* Cafe Image */}
                                        <div className='relative aspect-video rounded-xl overflow-hidden'>
                                            <Image
                                                src={getCafeThumbnailUrl(
                                                    selectedCafe.thumbnail
                                                )}
                                                alt={selectedCafe.name}
                                                fill
                                                className='object-cover'
                                            />
                                            <div className='absolute top-3 right-3 bg-background/90 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1'>
                                                <Navigation className='w-3 h-3' />
                                                {formatDistance(
                                                    selectedCafe.distance
                                                )}
                                            </div>
                                        </div>

                                        {/* Cafe Info */}
                                        <div>
                                            <h4 className='font-bold text-xl'>
                                                {selectedCafe.name}
                                            </h4>
                                            <p className='text-sm text-text/60 mt-1'>
                                                {selectedCafe.address_display}
                                            </p>

                                            <div className='flex items-center gap-3 mt-3 text-sm'>
                                                {selectedCafe.average_rating && (
                                                    <div className='flex items-center gap-1'>
                                                        <Star className='w-4 h-4 fill-amber-400 text-amber-400' />
                                                        <span className='font-medium'>
                                                            {selectedCafe.average_rating.toFixed(
                                                                1
                                                            )}
                                                        </span>
                                                    </div>
                                                )}
                                                <span className='text-secondary font-medium'>
                                                    {getPriceLevel(
                                                        selectedCafe.price_level
                                                    )}
                                                </span>
                                                {selectedCafe.operating_hours && (
                                                    <span
                                                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                                            isOpenNow(
                                                                selectedCafe.operating_hours
                                                            ).isOpen
                                                                ? "bg-green-100 text-green-700"
                                                                : "bg-text/10 text-text/60"
                                                        }`}
                                                    >
                                                        {isOpenNow(
                                                            selectedCafe.operating_hours
                                                        ).isOpen
                                                            ? "Open"
                                                            : "Closed"}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className='flex gap-3 pt-2'>
                                            <button
                                                onClick={handleReroll}
                                                disabled={
                                                    nearbyCafes.length <= 1
                                                }
                                                className='flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-text/20 hover:bg-text/5 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
                                            >
                                                <RefreshCw className='w-4 h-4' />
                                                Re-roll
                                            </button>
                                            <a
                                                href={`/cafes/${selectedCafe.slug}`}
                                                className='flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-secondary text-background font-medium hover:bg-secondary/90 transition-all'
                                            >
                                                View Cafe
                                            </a>
                                        </div>

                                        <p className='text-xs text-text/40 text-center'>
                                            {nearbyCafes.length} cafe
                                            {nearbyCafes.length !== 1
                                                ? "s"
                                                : ""}{" "}
                                            within {radiusKm}km
                                        </p>
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    )
}
