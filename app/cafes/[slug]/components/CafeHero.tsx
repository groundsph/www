"use client"

import { CafeWithRatings } from "@/utils/types/extra"
import Image from "next/image"
import { motion } from "motion/react"
import {
    Heart,
    Bookmark,
    MapPin,
    CheckCircle,
    WifiIcon,
    StarIcon,
    Clock,
    Check,
    Share2,
    Store,
} from "lucide-react"
import { useState } from "react"
import { getCafeThumbnailUrl, isOpenNow } from "@/utils/extras"
import { User } from "@supabase/supabase-js"

interface CafeHeroProps {
    cafe: CafeWithRatings
    user: User | null
    isVisited: boolean
    isFavorite: boolean
    isInWishlist: boolean
    onToggleVisited: () => void
    onToggleFavorite: () => void
    onToggleWishlist: () => void
    onOpenClaim?: () => void
}

export default function CafeHero({
    cafe,
    user,
    isVisited,
    isFavorite,
    isInWishlist,
    onToggleVisited,
    onToggleFavorite,
    onToggleWishlist,
    onOpenClaim,
}: CafeHeroProps) {
    const openStatus = isOpenNow(cafe.operating_hours)
    const [isCopied, setIsCopied] = useState(false)

    const handleShare = async () => {
        const url = window.location.href
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Check out ${cafe.name} on Grounds`,
                    url: url,
                })
            } catch (err) {
                console.error("Error sharing:", err)
            }
        } else {
            try {
                await navigator.clipboard.writeText(url)
                setIsCopied(true)
                setTimeout(() => setIsCopied(false), 2000)
            } catch (err) {
                console.error("Failed to copy:", err)
            }
        }
    }

    return (
        <section
            id='top'
            className='w-full min-h-[calc(100vh-20rem)] flex flex-col relative'
        >
            {/* Background Image */}
            <div className='absolute w-full h-full bg-linear-to-r from-black/70 to-transparent select-none'>
                <Image
                    src={getCafeThumbnailUrl(cafe.thumbnail)}
                    alt=''
                    fill
                    className='object-cover object-center -z-1'
                    draggable={false}
                    priority
                />
            </div>

            {/* Content */}
            <div className='z-1 w-full h-full flex flex-col px-4 py-10 items-center text-background'>
                <div className='w-full max-w-7xl flex flex-col'>
                    {/* Cafe Name */}
                    <motion.h1
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0 }}
                        className='text-2xl md:text-5xl font-bold flex items-center gap-3'
                    >
                        {cafe.name}
                        {cafe.is_claimed && (
                            <span
                                className='inline-flex items-center gap-1 px-2 py-1 bg-primary/20 text-primary text-xs md:text-sm font-semibold rounded-full backdrop-blur-sm'
                                title='Verified Owner'
                            >
                                <CheckCircle className='w-3.5 h-3.5 md:w-4 md:h-4' />
                                <span className='hidden sm:inline'>
                                    Verified
                                </span>
                            </span>
                        )}
                    </motion.h1>

                    {/* Location */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className='flex flex-row items-center gap-2 mt-2 font-serif w-full'
                    >
                        <span className='px-2 py-0.5 rounded-md bg-background/20 text-sm font-semibold'>
                            {cafe.city_municipality}
                        </span>
                        <span className='text-background/60'>•</span>
                        <span className='font-semibold text-lg'>
                            {cafe.province}
                        </span>
                    </motion.div>

                    {/* Address */}
                    <motion.h2
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.15 }}
                        className='font-serif font-medium text-background/80 max-w-md mt-1 text-sm'
                    >
                        {cafe.address_display}
                    </motion.h2>

                    {/* Quick Facts Pills */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className='flex flex-row flex-wrap items-center gap-2 mt-4'
                    >
                        {/* Open/Closed Status */}
                        <div
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold backdrop-blur-sm ${
                                openStatus.isOpen
                                    ? "bg-green-500/20 text-green-300"
                                    : "bg-white/10 text-white/70"
                            }`}
                        >
                            <Clock className='w-3.5 h-3.5' />
                            {openStatus.isOpen ? "Open Now" : "Closed"}
                        </div>

                        {/* Price Level */}
                        <div className='flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-white/10 text-white backdrop-blur-sm'>
                            {cafe.price_level === "low" && "₱"}
                            {cafe.price_level === "medium" && "₱₱"}
                            {cafe.price_level === "high" && "₱₱₱"}
                        </div>

                        {/* WiFi Indicator */}
                        {cafe.has_wifi && (
                            <div className='flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-blue-500/20 text-blue-300 backdrop-blur-sm'>
                                <WifiIcon className='w-3.5 h-3.5' />
                                WiFi
                            </div>
                        )}

                        {/* Rating */}
                        {cafe.average_rating && (
                            <div className='flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-amber-500/20 text-amber-300 backdrop-blur-sm'>
                                <StarIcon className='w-3.5 h-3.5 fill-current' />
                                {cafe.average_rating.toFixed(1)}
                            </div>
                        )}
                    </motion.div>

                    {/* Action Buttons */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.25 }}
                        className='flex items-center gap-2 w-full max-w-md mt-4'
                    >
                        {/* Share Button */}
                        <button
                            onClick={handleShare}
                            className='p-2 rounded-lg bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all group cursor-pointer'
                            title='Share'
                        >
                            {isCopied ? (
                                <Check className='w-6 h-6 text-green-400' />
                            ) : (
                                <Share2 className='w-6 h-6 text-white group-hover:text-blue-400 transition-colors' />
                            )}
                        </button>

                        {/* User Actions */}
                        {user && (
                            <>
                                {/* Visited Button */}
                                <button
                                    onClick={onToggleVisited}
                                    className='p-2 flex-1 rounded-lg bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all group cursor-pointer flex flex-row text-nowrap items-center gap-2 justify-center font-bold'
                                    title={
                                        isVisited
                                            ? "Remove from Visited"
                                            : "Mark as Visited"
                                    }
                                >
                                    {isVisited ? (
                                        <CheckCircle className='w-5 h-5 text-white' />
                                    ) : (
                                        <MapPin className='w-5 h-5 text-white' />
                                    )}
                                    {isVisited
                                        ? "Remove from Visited"
                                        : "Mark as Visited"}
                                </button>

                                {/* Favorite Button */}
                                <button
                                    onClick={onToggleFavorite}
                                    className='p-2 rounded-lg bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all group cursor-pointer'
                                    title={
                                        isFavorite
                                            ? "Remove from Favorites"
                                            : "Add to Favorites"
                                    }
                                >
                                    <Heart
                                        className={`w-6 h-6 transition-colors ${
                                            isFavorite
                                                ? "fill-red-500 text-red-500"
                                                : "text-white group-hover:text-red-400"
                                        }`}
                                    />
                                </button>

                                {/* Wishlist Button */}
                                <button
                                    onClick={onToggleWishlist}
                                    className='p-2 rounded-lg bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all group cursor-pointer'
                                    title={
                                        isInWishlist
                                            ? "Remove from Wishlist"
                                            : "Add to Wishlist"
                                    }
                                >
                                    <Bookmark
                                        className={`w-6 h-6 transition-colors ${
                                            isInWishlist
                                                ? "fill-secondary text-secondary"
                                                : "text-white group-hover:text-secondary"
                                        }`}
                                    />
                                </button>
                            </>
                        )}
                    </motion.div>

                    {/* Description */}
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className='max-w-lg mt-6'
                    >
                        {cafe.description}
                    </motion.p>

                    {/* Claim Button - Only for unclaimed cafes */}
                    {!cafe.is_claimed && user && onOpenClaim && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.28 }}
                            className='mt-4'
                        >
                            <button
                                onClick={onOpenClaim}
                                className='flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg text-sm font-medium hover:bg-white/20 transition-all cursor-pointer'
                            >
                                <Store className='w-4 h-4' />
                                Own this cafe? Claim it
                            </button>
                        </motion.div>
                    )}
                </div>
            </div>
        </section>
    )
}
