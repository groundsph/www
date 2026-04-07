"use client"

import React from "react"
import { motion } from "motion/react"
import Image from "next/image"
import {
    ArrowRight,
    Star,
    Wifi,
    Plug,
    Car,
    Wind,
    PawPrint,
    TreePine,
    BadgeCheck,
    Armchair,
    Briefcase,
    Toilet,
    Droplet,
    MilkOff,
    Coffee,
    Gem,
    Cigarette,
    Store,
} from "lucide-react"
import { CafeWithRatings } from "@/utils/types/extra"
import { getCafeDescription, getCafeThumbnailUrl, getPriceLevel, isOpenNow } from "@/utils/extras"

const ANIMATION_DELAY_MULTIPLIER = 0.2

interface CafeCardProps {
    cafe: CafeWithRatings
    onClick?: () => void
    className?: string
    animationDelay?: number
}

const CafeCard = React.memo(function CafeCard({
    cafe,
    onClick,
    className,
    animationDelay = 0,
}: CafeCardProps) {
    const openStatus = isOpenNow(cafe.operating_hours)

    return (
        <motion.a
            initial={{ opacity: 0 }}
            animate={{
                opacity: 1,
                transition: {
                    duration: 0.3,
                    delay: Math.min(animationDelay * ANIMATION_DELAY_MULTIPLIER, 0.6),
                },
            }}
            exit={{ opacity: 0 }}
            href={`/cafes/${cafe.slug}`}
            layout
            data-cafe-slug={cafe.slug}
            onClick={onClick}
            className={`py-4 px-6 bg-background rounded-xl border-2 border-text/5 flex flex-col-reverse md:flex-row gap-4 md:gap-0 group ${
                cafe.membership_tier === "premium"
                    ? "shadow-lg shadow-amber-500/30 border-amber-400/30 hover:shadow-amber-500/40"
                    : "shadow-lg shadow-black/10"
            } ${className || ""}`}
        >
            <div className='flex-1 flex flex-col md:pr-24'>
                {/* Header: Name, Address, Price, Verified */}
                <div className='flex flex-row'>
                    <div className='flex flex-col flex-1'>
                        <h3 className='text-xl md:text-2xl lg:text-3xl font-bold flex flex-row gap-x-2 flex-wrap items-center'>
                            {cafe.name}
                            {cafe.is_verified && (
                                <BadgeCheck className='w-5 h-5' />
                            )}
                            {cafe.is_hidden_gem && (
                                <span
                                    className='inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 rounded-full'
                                    title='Hidden Gem - Approximate location only'
                                >
                                    <Gem className='w-3 h-3' />
                                    Hidden Gem
                                </span>
                            )}
                            {cafe.is_chain && (
                                <span
                                    className='inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-orange-100 text-orange-700 rounded-full'
                                    title='Chain Cafe'
                                >
                                    <Store className='w-3 h-3' />
                                    Chain
                                </span>
                            )}
                        </h3>
                        <p className='text-xs md:text-sm font-semibold text-text/60'>
                            {cafe.address_display}
                        </p>
                    </div>
                    <div className='text-xs md:text-sm font-semibold text-background px-3 py-1 bg-secondary h-max rounded-full'>
                        {getPriceLevel(cafe.price_level)}
                    </div>
                </div>

                {/* Rating & Reviews */}
                <div className='flex flex-row flex-wrap items-center gap-2 mt-2 text-xs md:text-sm'>
                    <div className='flex flex-row items-center gap-1'>
                        <Star className='w-4 h-4 fill-text text-text' />
                        <span className='font-bold'>
                            {cafe.average_rating?.toFixed(1) || "N/A"}
                        </span>
                    </div>
                    <span className='text-text/60'>
                        ({cafe.total_reviews || 0} reviews)
                    </span>
                    {cafe.roaster && (
                        <>
                            <span className='text-text/30'>•</span>
                            <span className='text-text/60'>
                                Roaster: {cafe.roaster}
                            </span>
                        </>
                    )}
                    {cafe.coffee_style && (
                        <>
                            <span className='text-text/30'>•</span>
                            <span className='text-text/60 capitalize'>
                                {cafe.coffee_style}
                            </span>
                        </>
                    )}
                    <div className='flex-1' />
                    {cafe.operating_hours && (
                        <div
                            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                openStatus.isOpen
                                    ? "bg-green-200/40 text-green-700"
                                    : "bg-text/10 text-text"
                            }`}
                        >
                            {openStatus.isOpen
                                ? openStatus.closesAt
                                    ? `Open | Closes at ${openStatus.closesAt}`
                                    : "Open 24 Hours"
                                : openStatus.opensAt
                                  ? `Closed | Opens at ${openStatus.opensAt}`
                                  : "Closed"}
                        </div>
                    )}
                </div>

                <div className='h-0.5 w-full bg-text/20 mt-1' />

                {/* Amenity Icons */}
                <div className='flex flex-row items-center gap-3 mt-3'>
                    {cafe.has_wifi && (
                        <div
                            className='text-text/70 hover:text-text transition-colors'
                            title='WiFi'
                        >
                            <Wifi className='w-4 h-4' />
                        </div>
                    )}
                    {cafe.has_smoking && (
                        <div
                            className='text-text/70 hover:text-text transition-colors'
                            title='Smoking Area'
                        >
                            <Cigarette className='w-4 h-4' />
                        </div>
                    )}
                    {cafe.has_sockets && (
                        <div
                            className='text-text/70 hover:text-text transition-colors'
                            title='Power Outlets'
                        >
                            <Plug className='w-4 h-4' />
                        </div>
                    )}
                    {cafe.has_parking && (
                        <div
                            className='text-text/70 hover:text-text transition-colors'
                            title='Parking'
                        >
                            <Car className='w-4 h-4' />
                        </div>
                    )}
                    {cafe.has_aircon && (
                        <div
                            className='text-text/70 hover:text-text transition-colors'
                            title='Air Conditioning'
                        >
                            <Wind className='w-4 h-4' />
                        </div>
                    )}
                    {cafe.is_pet_friendly && (
                        <div
                            className='text-text/70 hover:text-text transition-colors'
                            title='Pet Friendly'
                        >
                            <PawPrint className='w-4 h-4' />
                        </div>
                    )}
                    {cafe.has_outdoor_seating && (
                        <div
                            className='text-text/70 hover:text-text transition-colors'
                            title='Outdoor Seating'
                        >
                            <TreePine className='w-4 h-4' />
                        </div>
                    )}
                    {cafe.has_indoor_seating && (
                        <div
                            className='text-text/70 hover:text-text transition-colors'
                            title='Indoor Seating'
                        >
                            <Armchair className='w-4 h-4' />
                        </div>
                    )}
                    {cafe.has_restroom && (
                        <div
                            className='text-text/70 hover:text-text transition-colors'
                            title='Restroom'
                        >
                            <Toilet className='w-4 h-4' />
                        </div>
                    )}
                    {cafe.has_bidet && (
                        <div
                            className='text-text/70 hover:text-text transition-colors'
                            title='Bidet'
                        >
                            <Droplet className='w-4 h-4' />
                        </div>
                    )}
                    {cafe.has_non_dairy && (
                        <div
                            className='text-text/70 hover:text-text transition-colors'
                            title='Non-Dairy Milk'
                        >
                            <MilkOff className='w-4 h-4' />
                        </div>
                    )}
                    {cafe.has_decaf && (
                        <div
                            className='text-text/70 hover:text-text transition-colors'
                            title='Decaf Options'
                        >
                            <Coffee className='w-4 h-4' />
                        </div>
                    )}
                    {cafe.is_work_friendly && (
                        <div
                            className='text-text/70 hover:text-text transition-colors'
                            title='Work Friendly'
                        >
                            <Briefcase className='w-4 h-4' />
                        </div>
                    )}
                </div>

                {/* Description */}
                <p className='text-sm font-semibold text-text mt-2'>
                    {getCafeDescription(cafe)}
                </p>

                {/* Specialty Items */}
                {cafe.specialty && cafe.specialty.length > 0 && (
                    <div className='flex flex-row overflow-x-auto gap-1.5 mt-5'>
                        {cafe.specialty.map((item) => (
                            <span
                                key={item}
                                className='text-xs px-2 py-0.5 bg-primary/10 text-nowrap h-max font-semibold capitalize'
                            >
                                {item.split("_").join(" ")}
                            </span>
                        ))}
                    </div>
                )}

                {/* Vibe Tags */}
                {cafe.tags && cafe.tags.length > 0 && (
                    <div className='flex flex-row overflow-x-auto gap-1.5 mt-3'>
                        {cafe.tags.map((tag) => (
                            <span
                                key={tag}
                                className='text-xs px-2 py-0.5 bg-tertiary/20 shadow-inner text-nowrap font-semibold rounded-full text-text/80 h-max'
                            >
                                #{tag}
                            </span>
                        ))}
                    </div>
                )}

                <div className='flex-1' />
                <div className='py-1 w-max flex flex-row items-center gap-2 font-semibold italic text-text/60 mt-4 transition-colors group-hover:text-text relative overflow-clip px-1'>
                    View Details
                    <ArrowRight className='w-4 h-4' />
                    <div className='absolute top-0 right-full w-full h-full bg-text transition-transform group-hover:translate-x-full' />
                    <div className='absolute top-1/2 -translate-y-1/2 left-0 flex flex-row gap-2 text-background opacity-0 transition-opacity group-hover:opacity-100 items-center px-1'>
                        View Details
                        <ArrowRight className='w-4 h-4' />
                    </div>
                </div>
            </div>
            <div className='flex-1 relative object-clip aspect-square md:aspect-auto'>
                <Image
                    src={getCafeThumbnailUrl(cafe.thumbnail)}
                    alt=''
                    fill
                    className='object-cover rounded-2xl'
                    sizes='(max-width: 768px) 100vw, 50vw'
                    placeholder='blur'
                    blurDataURL='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIhAAAAUDBAMAAAAAAAAAAAAAAAECAwQFESESBhMxQVH/xAAVAQEBAAAAAAAAAAAAAAAAAAADBP/EABoRAAICAwAAAAAAAAAAAAAAAAECABEDITH/2gAMAwEAAhEDEEA/ALS9cV6W3HuVPUYuT/qZSyH6k+AAFZdD/9k='
                />
            </div>
        </motion.a>
    )
})

export default CafeCard
