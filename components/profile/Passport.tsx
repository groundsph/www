"use client"

import { AnimatePresence, motion } from "motion/react"
import { Bookmark, Coffee, Heart, MapPin, Stamp, Star } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

interface PassportCafe {
    name: string
    slug: string
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
    isOwnProfile: _isOwnProfile = false,
    className = "",
}: PassportProps) {
    const [activeTab, setActiveTab] = useState<TabType>("visited")

    return (
        <div className={`w-full ${className}`}>
            {/* Header / Tabs */}
            <div className='flex items-center justify-between mb-6'>
                <div className='flex items-center gap-2'>
                    <MapPin className='w-5 h-5' />
                    <h2 className='text-xl font-semibold font-serif'>
                        Coffee Passport
                    </h2>
                </div>

                <div className='flex bg-text/5 p-1 rounded-lg'>
                    <button
                        onClick={() => setActiveTab("visited")}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                            activeTab === "visited"
                                ? "bg-background shadow-xs text-primary"
                                : "text-text/60 hover:text-text/80"
                        }`}
                    >
                        Visited
                    </button>
                    <button
                        onClick={() => setActiveTab("favorites")}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                            activeTab === "favorites"
                                ? "bg-background shadow-xs text-red-500"
                                : "text-text/60 hover:text-text/80"
                        }`}
                    >
                        Favorites
                    </button>
                    <button
                        onClick={() => setActiveTab("wishlist")}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                            activeTab === "wishlist"
                                ? "bg-background shadow-xs text-secondary"
                                : "text-text/60 hover:text-text/80"
                        }`}
                    >
                        Wishlist
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className='bg-text/5 border border-text/10 rounded-xl min-h-[300px] overflow-hidden relative'>
                {/* Background Texture/Pattern */}
                <div
                    className='absolute inset-0 opacity-[0.03] pointer-events-none'
                    style={{
                        backgroundImage: `radial-gradient(circle at 2px 2px, black 1px, transparent 0)`,
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
                            className='p-6'
                        >
                            <div className='flex items-center gap-2 mb-6'>
                                <div className='p-2 bg-primary/10 rounded-lg'>
                                    <Star className='w-5 h-5 text-primary' />
                                </div>
                                <span className='font-semibold text-text'>
                                    Stamps Collected
                                </span>
                                <span className='ml-auto bg-primary/15 text-primary text-sm font-bold px-2.5 py-1 rounded-full'>
                                    {visited.length}
                                </span>
                            </div>

                            {visited.length > 0 ? (
                                <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6'>
                                    {visited.map((cafe) => (
                                        <Link
                                            key={cafe.slug}
                                            href={`/cafes/${cafe.slug}`}
                                            className='group relative aspect-square'
                                        >
                                            {/* Stamp Visual */}
                                            <div className='absolute inset-0 border-4 border-dashed border-primary/30 rounded-full flex flex-col items-center justify-center p-4 text-center transform -rotate-12 group-hover:rotate-0 group-hover:scale-105 group-hover:border-primary/60 transition-all duration-300 bg-background/50 backdrop-blur-xs'>
                                                <Coffee className='w-6 h-6 text-primary/50 mb-1' />
                                                <span className='text-xs font-bold text-primary/80 line-clamp-2 uppercase tracking-tight'>
                                                    {cafe.name}
                                                </span>
                                                <span className='text-[10px] text-primary/40 mt-1 font-mono'>
                                                    VISITED
                                                </span>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div className='flex flex-col items-center justify-center py-20 text-center opacity-60'>
                                    <Stamp className='w-16 h-16 text-text/20 mb-4' />
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
                            className='p-6'
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
                                    {favorites.map((cafe) => (
                                        <div
                                            key={cafe.slug}
                                            className='flex items-center gap-3 p-3 bg-background border border-text/5 rounded-xl hover:border-red-500/30 transition-colors group'
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
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className='flex flex-col items-center justify-center py-20 text-center opacity-60'>
                                    <Heart className='w-16 h-16 text-text/20 mb-4' />
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
                            className='p-6'
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
                                    {wishlist.map((cafe) => (
                                        <div
                                            key={cafe.slug}
                                            className='flex items-center gap-3 p-3 bg-background border border-text/5 rounded-xl hover:border-secondary/30 transition-colors group'
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
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className='flex flex-col items-center justify-center py-20 text-center opacity-60'>
                                    <Bookmark className='w-16 h-16 text-text/20 mb-4' />
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
