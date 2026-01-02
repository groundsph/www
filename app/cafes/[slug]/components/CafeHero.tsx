"use client"

import confetti from "canvas-confetti"

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
    Gem,
    ListPlus,
    Cigarette,
} from "lucide-react"
import { useState } from "react"
import { getCafeThumbnailUrl, isOpenNow } from "@/utils/extras"

// Simple user type - only used for truthiness check
type SimpleUser = { id: string } | null

interface CafeHeroProps {
    cafe: CafeWithRatings
    user: SimpleUser
    isVisited: boolean
    isFavorite: boolean
    isInWishlist: boolean
    onToggleVisited: () => void
    onToggleFavorite: () => void
    onToggleWishlist: () => void
    onOpenClaim?: () => void
    onOpenAddToCollection?: () => void
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
    onOpenAddToCollection,
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

    const handleFavorite = () => {
        if (!isFavorite) {
            // Trigger heart confetti from bottom
            const defaults = {
                spread: 360,
                ticks: 100,
                gravity: 0.5,
                decay: 0.94,
                startVelocity: 50, // Higher velocity to shoot up
                colors: ["#FFE400", "#FFBD00", "#E89400", "#FFCA6C", "#FDFFB8"],
            }

            // Shoot from bottom center
            confetti({
                ...defaults,
                particleCount: 50,
                scalar: 2,
                shapes: ["heart"] as unknown as confetti.Shape[],
                colors: ["#F9A8D4", "#F472B6", "#EC4899"], // Pink hearts
                origin: { y: 1, x: 0.5 },
                drift: 0,
            })

            confetti({
                ...defaults,
                particleCount: 25,
                scalar: 3,
                shapes: ["heart"] as unknown as confetti.Shape[],
                colors: ["#EF4444", "#DC2626"], // Red hearts
                origin: { y: 1, x: 0.5 },
                drift: 0,
            })
        }
        onToggleFavorite()
    }

    const handleVisited = () => {
        if (!isVisited) {
            // Trigger fireworks from bottom
            const duration = 3 * 1000
            const animationEnd = Date.now() + duration
            const defaults = {
                startVelocity: 45,
                spread: 360,
                ticks: 60,
                zIndex: 0,
                origin: { y: 1 }, // Start from bottom
            }

            const interval: ReturnType<typeof setInterval> = setInterval(
                function () {
                    const timeLeft = animationEnd - Date.now()

                    if (timeLeft <= 0) {
                        return clearInterval(interval)
                    }

                    const particleCount = 50 * (timeLeft / duration)

                    // Cannon style from bottom corners
                    confetti({
                        ...defaults,
                        particleCount,
                        angle: 60,
                        origin: { x: 0, y: 1 },
                    })
                    confetti({
                        ...defaults,
                        particleCount,
                        angle: 120,
                        origin: { x: 1, y: 1 },
                    })
                },
                250
            )
        }
        onToggleVisited()
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
                    sizes='100vw'
                    placeholder='blur'
                    blurDataURL='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIhAAAAUDBAMAAAAAAAAAAAAAAAECAwQFESESBhMxQVH/xAAVAQEBAAAAAAAAAAAAAAAAAAADBP/EABoRAAICAwAAAAAAAAAAAAAAAAECABEDITH/2gAMAwAAhEDEQA/ALS9cV6W3HuVPUYuT/qZSyH6k+AAFZdD/9k='
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
                        {cafe.is_verified && (
                            <span
                                className='inline-flex items-center gap-1 px-2 py-1 bg-background/20 text-background text-xs md:text-sm font-semibold rounded-full backdrop-blur-sm select-none'
                                title='Verified'
                            >
                                <CheckCircle className='w-3.5 h-3.5 md:w-4 md:h-4' />
                                <span className='hidden md:inline'>
                                    Verified
                                </span>
                            </span>
                        )}
                        {cafe.is_hidden_gem && (
                            <span
                                className='inline-flex items-center gap-1 px-2 py-1 bg-amber-500/30 text-amber-200 text-xs md:text-sm font-semibold rounded-full backdrop-blur-sm select-none'
                                title='Hidden Gem - Approximate location only'
                            >
                                <Gem className='w-3.5 h-3.5 md:w-4 md:h-4' />
                                <span className='hidden md:inline'>
                                    Hidden Gem
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

                        {/* Coffee Style */}
                        {cafe.coffee_style && (
                            <div className='flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-amber-500/20 text-amber-300 backdrop-blur-sm'>
                                {cafe.coffee_style === "classic"
                                    ? "Classic"
                                    : "Artisan"}
                            </div>
                        )}

                        {/* WiFi Indicator */}
                        {cafe.has_wifi && (
                            <div className='flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-blue-500/20 text-blue-300 backdrop-blur-sm'>
                                <WifiIcon className='w-3.5 h-3.5' />
                                WiFi
                            </div>
                        )}

                        {/* Smoking Indicator */}
                        {cafe.has_smoking && (
                            <div className='flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-zinc-500/20 text-zinc-300 backdrop-blur-sm'>
                                <Cigarette className='w-3.5 h-3.5' />
                                Smoking Area
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
                        className='flex items-center gap-2 w-full max-w-md mt-4 flex-wrap'
                    >
                        {/* Share Button */}
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={handleShare}
                            className='p-2 rounded-lg bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all group cursor-pointer'
                            title='Share'
                        >
                            <motion.div
                                key={isCopied ? "copied" : "share"}
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.2 }}
                            >
                                {isCopied ? (
                                    <Check className='w-6 h-6 text-green-400' />
                                ) : (
                                    <Share2 className='w-6 h-6 text-white group-hover:text-blue-400 transition-colors' />
                                )}
                            </motion.div>
                        </motion.button>

                        {/* User Actions */}
                        {user && (
                            <>
                                {/* Visited Button */}
                                <motion.button
                                    whileTap={{ scale: 0.97 }}
                                    onClick={handleVisited}
                                    className='p-2 flex-1 rounded-lg bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all group cursor-pointer flex flex-row text-nowrap items-center gap-2 justify-center font-bold'
                                    title={
                                        isVisited
                                            ? "Remove from Visited"
                                            : "Mark as Visited"
                                    }
                                >
                                    <div className='relative w-5 h-5'>
                                        <motion.div
                                            initial={false}
                                            animate={{
                                                opacity: isVisited ? 1 : 0,
                                                scale: isVisited ? 1 : 0,
                                                rotate: isVisited ? 0 : -90,
                                            }}
                                            transition={{ duration: 0.2 }}
                                            className='absolute inset-0'
                                        >
                                            <CheckCircle className='w-5 h-5 text-white' />
                                        </motion.div>
                                        <motion.div
                                            initial={false}
                                            animate={{
                                                opacity: isVisited ? 0 : 1,
                                                scale: isVisited ? 0 : 1,
                                                rotate: isVisited ? 90 : 0,
                                            }}
                                            transition={{ duration: 0.2 }}
                                            className='absolute inset-0'
                                        >
                                            <MapPin className='w-5 h-5 text-white' />
                                        </motion.div>
                                    </div>
                                    <span className='min-w-[140px] text-center'>
                                        {isVisited
                                            ? "Remove from Visited"
                                            : "Mark as Visited"}
                                    </span>
                                </motion.button>

                                {/* Favorite Button */}
                                <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    onClick={handleFavorite}
                                    className='p-2 rounded-lg bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all group cursor-pointer'
                                    title={
                                        isFavorite
                                            ? "Remove from Favorites"
                                            : "Add to Favorites"
                                    }
                                >
                                    <motion.div
                                        initial={false}
                                        animate={{
                                            scale: isFavorite ? [1, 1.4, 1] : 1,
                                        }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <Heart
                                            className={`w-6 h-6 transition-colors ${
                                                isFavorite
                                                    ? "fill-red-500 text-red-500"
                                                    : "text-white group-hover:text-red-400"
                                            }`}
                                        />
                                    </motion.div>
                                </motion.button>

                                {/* Wishlist Button */}
                                <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    onClick={onToggleWishlist}
                                    className='p-2 rounded-lg bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all group cursor-pointer'
                                    title={
                                        isInWishlist
                                            ? "Remove from Wishlist"
                                            : "Add to Wishlist"
                                    }
                                >
                                    <motion.div
                                        initial={false}
                                        animate={{
                                            scale: isInWishlist
                                                ? [1, 1.2, 1]
                                                : 1,
                                        }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <Bookmark
                                            className={`w-6 h-6 transition-colors ${
                                                isInWishlist
                                                    ? "fill-secondary text-secondary"
                                                    : "text-white group-hover:text-secondary"
                                            }`}
                                        />
                                    </motion.div>
                                </motion.button>

                                {/* Add to Collection Button */}
                                {onOpenAddToCollection && (
                                    <motion.button
                                        whileTap={{ scale: 0.9 }}
                                        onClick={onOpenAddToCollection}
                                        className='p-2 rounded-lg bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all group cursor-pointer'
                                        title='Add to Collection'
                                    >
                                        <ListPlus className='w-6 h-6 text-white group-hover:text-primary transition-colors' />
                                    </motion.button>
                                )}
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
