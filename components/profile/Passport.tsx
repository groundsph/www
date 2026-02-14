"use client"

import { AnimatePresence, motion } from "motion/react"
import { Bookmark, Coffee, Heart, MapPin, Stamp, Star } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

// Stamp Images
import stamp1 from "@/assets/stamps/1.svg"
import stamp2 from "@/assets/stamps/2.svg"
import stamp3 from "@/assets/stamps/3.svg"
import Image from "next/image"
import { selectStampImage } from "@/utils/passport/stamp"

interface PassportCafe {
    name: string
    slug: string
    badge_stamp_url?: string | null
}

interface PassportProps {
    visited: PassportCafe[]
    favorites: PassportCafe[]
    wishlist: PassportCafe[]
    isOwnProfile?: boolean
    className?: string
}

type TabType = "visited" | "favorites" | "wishlist"

export default function Passport({
    visited,
    favorites,
    wishlist,
    className = "",
}: PassportProps) {
    const [activeTab, setActiveTab] = useState<TabType>("visited")

    // Get Randomized Stamp from Cafe Title (ensure same stamp is used for same cafe)
    const getStamp = (title: string) => {
        const hash = title.split(" ").join("").toLowerCase()
        const index = hash.charCodeAt(0) % 3
        return [stamp1, stamp2, stamp3][index]
    }

    return (
        <div className={`w-full ${className} [&_button]:cursor-pointer`}>
            {/* Header / Tabs */}
            <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6'>
                <div className='flex items-center gap-2 flex-wrap'>
                    <MapPin className='w-4 h-4 sm:w-5 sm:h-5' />
                    <h2 className='text-lg sm:text-xl font-semibold font-serif'>
                        Coffee Passport
                    </h2>
                </div>
                <div className='flex items-center gap-2 ml-auto w-full sm:w-auto'>
                    <div className='ml-auto flex bg-text/5 p-1 rounded-lg w-full sm:w-auto'>
                        <button
                            onClick={() => setActiveTab("visited")}
                            className={`flex-1 sm:flex-none px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${
                                activeTab === "visited"
                                    ? "bg-background shadow-xs text-primary"
                                    : "text-text/60 hover:text-text/80"
                            }`}
                        >
                            Visited
                        </button>
                        <button
                            onClick={() => setActiveTab("favorites")}
                            className={`flex-1 sm:flex-none px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${
                                activeTab === "favorites"
                                    ? "bg-background shadow-xs text-red-500"
                                    : "text-text/60 hover:text-text/80"
                            }`}
                        >
                            Favorites
                        </button>
                        <button
                            onClick={() => setActiveTab("wishlist")}
                            className={`flex-1 sm:flex-none px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${
                                activeTab === "wishlist"
                                    ? "bg-background shadow-xs text-secondary"
                                    : "text-text/60 hover:text-text/80"
                            }`}
                        >
                            Wishlist
                        </button>
                    </div>

                    <span className='bg-primary/15 text-primary text-sm font-bold px-2.5 py-1 rounded-full'>
                        {activeTab === "visited"
                            ? visited.length
                            : activeTab === "favorites"
                              ? favorites.length
                              : wishlist.length}
                    </span>
                </div>
            </div>

            {/* Content Area */}
            <div className='bg-text/5 border border-text/10 rounded-xl min-h-[250px] sm:min-h-[300px] overflow-hidden relative'>
                {/* Background Texture/Pattern */}
                <div
                    className='absolute inset-0 opacity-[0.03] pointer-events-none'
                    style={{
                        backgroundImage: `radial-gradient(circle at 2px 2px, theme("colors.background") 1px, transparent 0)`,
                        backgroundSize: "24px 24px",
                    }}
                />

                <AnimatePresence mode='wait'>
                    {activeTab === "visited" && (
                        <motion.div
                            key='visited'
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.2 }}
                            className='p-4 sm:p-6'
                        >
                            <div className='flex items-center gap-2 mb-6'>
                                <div className='p-2 bg-primary/10 rounded-lg'>
                                    <Star className='w-5 h-5 text-primary' />
                                </div>
                                <span className='font-semibold text-text'>
                                    Stamps Collected
                                </span>
                            </div>

                            {visited.length > 0 ? (
                                <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-8'>
                                    {visited.map((cafe, index) => (
                                        <motion.div
                                            key={cafe.slug}
                                            initial={{
                                                opacity: 0,
                                                scale: 0.8,
                                                rotate: -12,
                                            }}
                                            animate={{
                                                opacity: 1,
                                                scale: 1,
                                                rotate: (() => {
                                                    const hash = cafe.name
                                                        .split("")
                                                        .reduce(
                                                            (acc, char) =>
                                                                acc +
                                                                char.charCodeAt(
                                                                    0,
                                                                ),
                                                            0,
                                                        )
                                                    return (hash % 24) - 12
                                                })(),
                                            }}
                                            transition={{
                                                delay: index * 0.05,
                                                duration: 0.3,
                                            }}
                                            className='relative aspect-square'
                                        >
                                            <Link
                                                href={`/cafes/${cafe.slug}`}
                                                className='group w-full h-full'
                                            >
                                                {/* Stamp Visual */}
                                                <div className='absolute inset-0 flex flex-col items-center justify-center p-4 text-center transition-all duration-300'>
                                                    <Coffee className='w-6 h-6 text-primary/50 mb-1' />
                                                    <span className='text-xs font-bold text-primary/80 line-clamp-2 uppercase tracking-tight max-w-4/5'>
                                                        {cafe.name}
                                                    </span>
                                                    <span className='text-[10px] text-primary/40 mt-1 font-mono'>
                                                        VISITED
                                                    </span>
                                                    {(() => {
                                                        const customUrl =
                                                            selectStampImage(
                                                                cafe.name,
                                                                cafe.badge_stamp_url,
                                                            )
                                                        if (customUrl) {
                                                            return (
                                                                <Image
                                                                    src={
                                                                        customUrl
                                                                    }
                                                                    alt={`${cafe.name} stamp`}
                                                                    fill
                                                                    className='object-contain'
                                                                />
                                                            )
                                                        }
                                                        return (
                                                            <Image
                                                                src={getStamp(
                                                                    cafe.name,
                                                                )}
                                                                alt=''
                                                                className='w-full h-full absolute inset-0 object-contain'
                                                            />
                                                        )
                                                    })()}
                                                </div>
                                            </Link>
                                        </motion.div>
                                    ))}
                                </div>
                            ) : (
                                <div className='flex flex-col items-center justify-center py-20 text-center opacity-60'>
                                    <Stamp className='w-16 h-16 text-text opacity-30 mb-4' />
                                    <p className='text-lg font-medium'>
                                        No stamps yet
                                    </p>
                                    <p className='text-sm text-text/60 max-w-xs'>
                                        Visit cafes and write reviews to collect
                                        stamps in your passport!
                                    </p>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {activeTab === "favorites" && (
                        <motion.div
                            key='favorites'
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                            className='p-4 sm:p-6'
                        >
                            <div className='flex items-center gap-2 mb-6'>
                                <div className='p-2 bg-red-500/10 rounded-lg'>
                                    <Heart className='w-5 h-5 text-red-500' />
                                </div>
                                <span className='font-semibold text-text'>
                                    Favorite Cafes
                                </span>
                                <span className='ml-auto bg-red-500/15 text-red-500 text-sm font-bold px-2.5 py-1 rounded-full'>
                                    {favorites.length}
                                </span>
                            </div>

                            {favorites.length > 0 ? (
                                <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                                    {favorites.map((cafe, index) => (
                                        <motion.div
                                            key={cafe.slug}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            whileHover={{ scale: 1.02, x: 3 }}
                                            transition={{ delay: index * 0.05 }}
                                            className='flex items-center gap-3 p-3 bg-background border border-text/5 rounded-xl hover:border-red-500/30 transition-all'
                                        >
                                            <div className='w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0'>
                                                <Heart className='w-5 h-5 text-red-500 fill-red-500' />
                                            </div>
                                            <Link
                                                href={`/cafes/${cafe.slug}`}
                                                className='flex-1 font-medium hover:text-red-500 truncate'
                                            >
                                                {cafe.name}
                                            </Link>
                                        </motion.div>
                                    ))}
                                </div>
                            ) : (
                                <div className='flex flex-col items-center justify-center py-20 text-center opacity-60'>
                                    <Heart className='w-16 h-16 text-text opacity-30 mb-4' />
                                    <p className='text-lg font-medium'>
                                        No favorites yet
                                    </p>
                                    <p className='text-sm text-text/60 max-w-xs'>
                                        Mark cafes as favorites to save your top
                                        picks!
                                    </p>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {activeTab === "wishlist" && (
                        <motion.div
                            key='wishlist'
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                            className='p-4 sm:p-6'
                        >
                            <div className='flex items-center gap-2 mb-6'>
                                <div className='p-2 bg-secondary/10 rounded-lg'>
                                    <Bookmark className='w-5 h-5 text-secondary' />
                                </div>
                                <span className='font-semibold text-text'>
                                    Saved Places
                                </span>
                                <span className='ml-auto bg-secondary/15 text-secondary text-sm font-bold px-2.5 py-1 rounded-full'>
                                    {wishlist.length}
                                </span>
                            </div>

                            {wishlist.length > 0 ? (
                                <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                                    {wishlist.map((cafe, index) => (
                                        <motion.div
                                            key={cafe.slug}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            whileHover={{ scale: 1.02, x: 3 }}
                                            transition={{ delay: index * 0.05 }}
                                            className='flex items-center gap-3 p-3 bg-background border border-text/5 rounded-xl hover:border-secondary/30 transition-all'
                                        >
                                            <div className='w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0'>
                                                <Bookmark className='w-5 h-5 text-secondary fill-secondary' />
                                            </div>
                                            <Link
                                                href={`/cafes/${cafe.slug}`}
                                                className='flex-1 font-medium hover:text-secondary truncate'
                                            >
                                                {cafe.name}
                                            </Link>
                                        </motion.div>
                                    ))}
                                </div>
                            ) : (
                                <div className='flex flex-col items-center justify-center py-20 text-center opacity-60'>
                                    <Bookmark className='w-16 h-16 text-text opacity-30 mb-4' />
                                    <p className='text-lg font-medium'>
                                        Wishlist is empty
                                    </p>
                                    <p className='text-sm text-text/60 max-w-xs'>
                                        Save cafes you want to visit later.
                                    </p>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
