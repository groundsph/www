"use client"

import { useState } from "react"
import { CafeWithRatings } from "@/utils/types/extra"
import { CafeSocial, OperatingHour } from "@/utils/types/cafe"
import Image from "next/image"
import {
    StarIcon,
    WifiIcon,
    PlugIcon,
    CarIcon,
    SnowflakeIcon,
    PawPrintIcon,
    SunIcon,
    MapPin,
    Clock,
    ExternalLink,
    BriefcaseIcon,
    CoffeeIcon,
    CalendarIcon,
    UserIcon,
    History,
    Toilet,
    Droplet,
    MilkOff,
    Armchair,
} from "lucide-react"
import { formatTimeTo12Hour, isOpenNow } from "@/utils/extras"
import dynamic from "next/dynamic"
import RatingDistribution from "./RatingDistribution"
import MarkdownRender from "@/components/MarkdownRender"
import SuggestEditButton from "@/components/suggestions/SuggestEditButton"
import ImageLightbox from "@/components/ImageLightbox"
import Link from "next/link"
import { motion } from "motion/react"

// Animation variants
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05,
        },
    },
}

const itemVariants = {
    hidden: { opacity: 0, y: 10, scale: 0.95 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { duration: 0.2 },
    },
}

// Day mapping
const DAY_NAMES: Record<OperatingHour["day"], string> = {
    mon: "Monday",
    tue: "Tuesday",
    wed: "Wednesday",
    thu: "Thursday",
    fri: "Friday",
    sat: "Saturday",
    sun: "Sunday",
}

const DAY_ORDER: OperatingHour["day"][] = [
    "mon",
    "tue",
    "wed",
    "thu",
    "fri",
    "sat",
    "sun",
]

// Dynamic import for mini map
const DynamicCafeMiniMap = dynamic(() => import("@/components/CafeMiniMap"), {
    ssr: false,
    loading: () => (
        <div className='w-full h-full min-h-[180px] flex items-center justify-center bg-secondary/20 rounded-xl'>
            <p className='text-text/50 font-serif text-sm'>Loading map...</p>
        </div>
    ),
})

interface CafeMobileContentProps {
    cafe: CafeWithRatings
    reviews?: { rating: number }[]
    onOpenHistory?: () => void
}

/**
 * About Tab Content - Map, address, contact info, hours
 */
export function AboutTabContent({ cafe }: CafeMobileContentProps) {
    const openStatus = isOpenNow(cafe.operating_hours)
    const socials = (cafe.socials as unknown as CafeSocial[]) ?? []
    const story = cafe.story
    const gallery = cafe.gallery ?? []

    // Lightbox state
    const [isLightboxOpen, setIsLightboxOpen] = useState(false)
    const [lightboxIndex, setLightboxIndex] = useState(0)

    return (
        <div className='flex flex-col gap-4'>
            {/* Gallery - Horizontal Scroll */}
            {gallery.length > 0 && (
                <div className='w-screen -mx-4'>
                    <div
                        className='flex flex-row gap-3 overflow-x-auto pb-2 scrollbar-hide px-4 scroll-px-4'
                        style={{
                            scrollSnapType: "x mandatory",
                            scrollBehavior: "smooth",
                            msOverflowStyle: "none",
                            scrollbarWidth: "none",
                        }}
                    >
                        {gallery.map((image, idx) => (
                            <div
                                key={`${cafe.id}-gallery-mobile-${idx}`}
                                className='shrink-0 h-40 overflow-hidden rounded-sm shadow-md shadow-black/10 cursor-pointer hover:opacity-90 transition-opacity'
                                style={{ scrollSnapAlign: "start" }}
                                onClick={() => {
                                    setLightboxIndex(idx)
                                    setIsLightboxOpen(true)
                                }}
                            >
                                <Image
                                    src={image}
                                    alt={`${cafe.name} photo ${idx + 1}`}
                                    width={400}
                                    height={300}
                                    className='h-full w-auto object-cover'
                                />
                            </div>
                        ))}
                    </div>
                    {gallery.length > 1 && (
                        <p className='text-xs text-text/40 mt-2 text-center'>
                            ← Scroll to see {gallery.length} photos →
                        </p>
                    )}

                    {/* Mobile Gallery Lightbox */}
                    <ImageLightbox
                        images={gallery}
                        initialIndex={lightboxIndex}
                        isOpen={isLightboxOpen}
                        onClose={() => setIsLightboxOpen(false)}
                        altPrefix={`${cafe.name} photo`}
                    />
                </div>
            )}

            {/* Story */}
            {story ? (
                <div className='w-full'>
                    <MarkdownRender content={story.content} />
                </div>
            ) : (
                <div className='w-full bg-text/5 rounded-xl border border-dashed border-text/20 p-6 text-center'>
                    <p className='text-text/50 font-serif italic'>
                        This cafe&apos;s story is yet to be told...
                    </p>
                    <p className='text-text/40 text-sm mt-1'>
                        Check back later for more about {cafe.name}
                    </p>
                </div>
            )}

            {/* Map - Only show if cafe has coordinates (not a Hidden Gem) */}
            {cafe.lat !== null && cafe.lng !== null ? (
                <>
                    <div className='w-full h-auto aspect-video relative overflow-clip rounded-xl border-2 border-text/10'>
                        <DynamicCafeMiniMap
                            key={cafe.id}
                            cafe={
                                cafe as {
                                    id: string
                                    name: string
                                    lat: number
                                    lng: number
                                }
                            }
                        />
                    </div>

                    {/* Address & Directions */}
                    <a
                        href={`https://www.google.com/maps/search/?api=1&query=${cafe.lat},${cafe.lng}`}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='flex items-center gap-2 p-3 bg-text/5 rounded-xl hover:bg-text/10 transition-colors'
                    >
                        <MapPin className='w-5 h-5 text-primary shrink-0' />
                        <span className='text-sm font-medium flex-1'>
                            {cafe.address_display}
                        </span>
                        <ExternalLink className='w-4 h-4 text-text/40' />
                    </a>
                </>
            ) : (
                /* Hidden Gem - Show finding hint instead of map */
                <div className='w-full bg-amber-50 border border-amber-200 rounded-xl p-4'>
                    <div className='flex items-center gap-2 mb-2'>
                        <MapPin className='w-5 h-5 text-amber-600' />
                        <span className='font-semibold text-amber-800'>
                            Hidden Gem
                        </span>
                    </div>
                    <p className='text-sm text-amber-700'>
                        {cafe.address_display}
                    </p>
                    {cafe.finding_hint && (
                        <p className='text-sm text-amber-600 mt-2 italic'>
                            💡 Hint: {cafe.finding_hint}
                        </p>
                    )}
                </div>
            )}

            {/* Operating Hours */}
            <div className='bg-text/5 rounded-xl p-4'>
                <div className='flex items-center gap-2 mb-3'>
                    <Clock className='w-5 h-5 text-primary' />
                    <h3 className='font-semibold font-serif'>Hours</h3>
                    <div
                        className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
                            openStatus.isOpen
                                ? "bg-green-500/20 text-green-600"
                                : "bg-text/10 text-text/60"
                        }`}
                    >
                        {openStatus.isOpen ? "Open" : "Closed"}
                    </div>
                </div>

                {cafe.operating_hours && cafe.operating_hours.length > 0 ? (
                    <div className='space-y-1'>
                        {DAY_ORDER.map((day) => {
                            const hours = cafe.operating_hours?.find(
                                (h) => h.day === day
                            )
                            const today = new Date()
                                .toLocaleDateString("en-US", {
                                    weekday: "short",
                                })
                                .toLowerCase()
                                .slice(0, 3)
                            const isToday = day === today

                            return (
                                <div
                                    key={day}
                                    className={`flex justify-between text-sm py-1 px-2 rounded ${
                                        isToday
                                            ? "bg-primary/10 font-semibold"
                                            : ""
                                    }`}
                                >
                                    <span className='text-text/70'>
                                        {DAY_NAMES[day]}
                                    </span>
                                    <span>
                                        {hours ? (
                                            hours.is_closed ? (
                                                <span className='text-text/50'>
                                                    Closed
                                                </span>
                                            ) : hours.is_24_hours ? (
                                                <span className='text-primary font-medium'>
                                                    24 Hours
                                                </span>
                                            ) : (
                                                `${formatTimeTo12Hour(
                                                    hours.open
                                                )} - ${formatTimeTo12Hour(
                                                    hours.close
                                                )}`
                                            )
                                        ) : (
                                            <span className='text-text/50'>
                                                —
                                            </span>
                                        )}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <p className='text-sm text-text/50'>Hours not available</p>
                )}
            </div>

            {/* Contact & Socials */}
            {(cafe.phone ||
                cafe.email ||
                cafe.website_url ||
                socials.length > 0) && (
                <div className='bg-text/5 rounded-xl p-4'>
                    <h3 className='font-semibold font-serif mb-3'>Contact</h3>
                    <div className='space-y-2'>
                        {cafe.website_url && (
                            <a
                                href={cafe.website_url}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='block text-sm text-primary hover:underline truncate'
                            >
                                {cafe.website_url}
                            </a>
                        )}
                        {cafe.phone && (
                            <a
                                href={`tel:${cafe.phone}`}
                                className='block text-sm hover:underline'
                            >
                                {cafe.phone}
                            </a>
                        )}
                        {cafe.email && (
                            <a
                                href={`mailto:${cafe.email}`}
                                className='block text-sm hover:underline'
                            >
                                {cafe.email}
                            </a>
                        )}
                        {socials.length > 0 && (
                            <div className='flex gap-2 pt-2 flex-wrap'>
                                {socials.map((social) => (
                                    <a
                                        key={social.title}
                                        href={
                                            social.url.startsWith("http://") ||
                                            social.url.startsWith("https://")
                                                ? social.url
                                                : `https://${social.url}`
                                        }
                                        target='_blank'
                                        rel='noopener noreferrer'
                                        className='text-xs bg-secondary/40 px-2 py-1 rounded-full hover:bg-secondary/60 transition-colors'
                                    >
                                        {social.title}
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

/**
 * Details Tab Content - Amenities, payment, extras
 */
export function DetailsTabContent({
    cafe,
    reviews = [],
    onOpenHistory,
}: CafeMobileContentProps) {
    return (
        <div className='flex flex-col gap-4'>
            {/* Price & Rating */}
            <div className='flex gap-3'>
                <div className='flex-1 bg-text/5 rounded-xl p-4 text-center'>
                    <p className='text-xs text-text/60 mb-1'>Price Range</p>
                    <p className='text-2xl font-bold'>
                        {cafe.price_level === "low" && "₱"}
                        {cafe.price_level === "medium" && "₱₱"}
                        {cafe.price_level === "high" && "₱₱₱"}
                    </p>
                </div>
                <div className='flex-1 bg-text/5 rounded-xl p-4 text-center'>
                    <p className='text-xs text-text/60 mb-1'>Rating</p>
                    <div className='flex items-center justify-center gap-1 text-2xl font-bold'>
                        <StarIcon className='w-5 h-5 fill-amber-400 text-amber-400' />
                        {cafe.average_rating
                            ? cafe.average_rating.toFixed(1)
                            : "-"}
                    </div>
                </div>
                {cafe.coffee_style && (
                    <div className='flex-1 bg-amber-500/10 rounded-xl p-4 text-center'>
                        <p className='text-xs text-text/60 mb-1'>
                            Coffee Style
                        </p>
                        <p className='text-lg font-bold text-amber-700'>
                            {cafe.coffee_style === "classic"
                                ? "Classic"
                                : "Artisan"}
                        </p>
                    </div>
                )}
            </div>

            {/* Rating Distribution */}
            <RatingDistribution reviews={reviews} />

            {/* Amenities */}
            <div className='bg-text/5 rounded-xl p-4'>
                <h3 className='font-semibold font-serif mb-3'>Amenities</h3>
                <motion.div
                    className='flex flex-wrap gap-2'
                    variants={containerVariants}
                    initial='hidden'
                    animate='visible'
                >
                    {cafe.has_wifi && (
                        <motion.span
                            variants={itemVariants}
                            whileTap={{ scale: 0.95 }}
                            className='flex items-center gap-1 text-sm bg-secondary/40 px-3 py-1.5 rounded-full cursor-default'
                        >
                            <WifiIcon className='w-4 h-4' />
                            WiFi
                        </motion.span>
                    )}
                    {cafe.has_sockets && (
                        <motion.span
                            variants={itemVariants}
                            whileTap={{ scale: 0.95 }}
                            className='flex items-center gap-1 text-sm bg-secondary/40 px-3 py-1.5 rounded-full cursor-default'
                        >
                            <PlugIcon className='w-4 h-4' />
                            Power Outlets
                        </motion.span>
                    )}
                    {cafe.has_parking && (
                        <motion.span
                            variants={itemVariants}
                            whileTap={{ scale: 0.95 }}
                            className='flex items-center gap-1 text-sm bg-secondary/40 px-3 py-1.5 rounded-full cursor-default'
                        >
                            <CarIcon className='w-4 h-4' />
                            Parking
                        </motion.span>
                    )}
                    {cafe.has_aircon && (
                        <motion.span
                            variants={itemVariants}
                            whileTap={{ scale: 0.95 }}
                            className='flex items-center gap-1 text-sm bg-secondary/40 px-3 py-1.5 rounded-full cursor-default'
                        >
                            <SnowflakeIcon className='w-4 h-4' />
                            AC
                        </motion.span>
                    )}
                    {cafe.is_pet_friendly && (
                        <motion.span
                            variants={itemVariants}
                            whileTap={{ scale: 0.95 }}
                            className='flex items-center gap-1 text-sm bg-secondary/40 px-3 py-1.5 rounded-full cursor-default'
                        >
                            <PawPrintIcon className='w-4 h-4' />
                            Pet Friendly
                        </motion.span>
                    )}
                    {cafe.has_outdoor_seating && (
                        <motion.span
                            variants={itemVariants}
                            whileTap={{ scale: 0.95 }}
                            className='flex items-center gap-1 text-sm bg-secondary/40 px-3 py-1.5 rounded-full cursor-default'
                        >
                            <SunIcon className='w-4 h-4' />
                            Outdoor
                        </motion.span>
                    )}
                    {cafe.has_indoor_seating && (
                        <motion.span
                            variants={itemVariants}
                            whileTap={{ scale: 0.95 }}
                            className='flex items-center gap-1 text-sm bg-secondary/40 px-3 py-1.5 rounded-full cursor-default'
                        >
                            <Armchair className='w-4 h-4' />
                            Indoor Seating
                        </motion.span>
                    )}
                    {cafe.has_restroom && (
                        <motion.span
                            variants={itemVariants}
                            whileTap={{ scale: 0.95 }}
                            className='flex items-center gap-1 text-sm bg-secondary/40 px-3 py-1.5 rounded-full cursor-default'
                        >
                            <Toilet className='w-4 h-4' />
                            Restroom
                        </motion.span>
                    )}
                    {cafe.has_bidet && (
                        <motion.span
                            variants={itemVariants}
                            whileTap={{ scale: 0.95 }}
                            className='flex items-center gap-1 text-sm bg-secondary/40 px-3 py-1.5 rounded-full cursor-default'
                        >
                            <Droplet className='w-4 h-4' />
                            Bidet
                        </motion.span>
                    )}
                    {cafe.has_non_dairy && (
                        <motion.span
                            variants={itemVariants}
                            whileTap={{ scale: 0.95 }}
                            className='flex items-center gap-1 text-sm bg-secondary/40 px-3 py-1.5 rounded-full cursor-default'
                        >
                            <MilkOff className='w-4 h-4' />
                            Non-Dairy Milk
                            {cafe.milk_options &&
                                cafe.milk_options.length > 0 && (
                                    <span className='text-xs text-text/60'>
                                        ({cafe.milk_options.join(", ")})
                                    </span>
                                )}
                        </motion.span>
                    )}
                    {cafe.is_work_friendly && (
                        <motion.span
                            variants={itemVariants}
                            whileTap={{ scale: 0.95 }}
                            className='flex items-center gap-1 text-sm bg-secondary/40 px-3 py-1.5 rounded-full cursor-default'
                        >
                            <BriefcaseIcon className='w-4 h-4' />
                            Work Friendly
                        </motion.span>
                    )}
                    {!cafe.has_wifi &&
                        !cafe.has_sockets &&
                        !cafe.has_parking &&
                        !cafe.has_aircon &&
                        !cafe.is_pet_friendly &&
                        !cafe.has_outdoor_seating &&
                        !cafe.has_indoor_seating &&
                        !cafe.has_restroom &&
                        !cafe.has_bidet &&
                        !cafe.has_non_dairy &&
                        !cafe.is_work_friendly && (
                            <span className='text-sm text-text/50'>
                                No amenities listed
                            </span>
                        )}
                </motion.div>
            </div>

            {/* Payment Methods */}
            {cafe.payment_methods && (
                <div className='bg-text/5 rounded-xl p-4'>
                    <h3 className='font-semibold font-serif mb-3'>
                        Payment Methods
                    </h3>
                    <div className='flex flex-wrap gap-2'>
                        {cafe.payment_methods
                            .split(",")
                            .map((method) => method.trim())
                            .filter(Boolean)
                            .map((method) => (
                                <span
                                    key={method}
                                    className='text-sm bg-text/10 px-3 py-1.5 rounded-full capitalize text-nowrap'
                                >
                                    {method.split("_").join(" ")}
                                </span>
                            ))}
                    </div>
                </div>
            )}

            {/* Roaster */}
            {cafe.roaster && (
                <div className='bg-text/5 rounded-xl p-4'>
                    <h3 className='font-semibold font-serif mb-2'>Roaster</h3>
                    <p>{cafe.roaster}</p>
                </div>
            )}

            {/* Extras */}
            {((cafe.specialty && cafe.specialty.length > 0) ||
                (cafe.tags && cafe.tags.length > 0) ||
                (cafe.brew_methods && cafe.brew_methods.length > 0) ||
                cafe.serves_food) && (
                <div className='bg-text/5 rounded-xl p-4'>
                    <h3 className='font-semibold font-serif mb-3'>
                        Extras
                        {cafe.serves_food && (
                            <span className='ml-2 text-xs bg-green-500/20 text-green-600 px-2 py-0.5 rounded-full'>
                                Serves Food
                            </span>
                        )}
                    </h3>
                    <div className='space-y-3'>
                        {cafe.brew_methods && cafe.brew_methods.length > 0 && (
                            <div>
                                <p className='text-xs text-text/60 mb-1 flex items-center gap-1'>
                                    <CoffeeIcon className='w-3 h-3' />
                                    Brew Methods
                                </p>
                                <motion.div
                                    className='flex flex-wrap gap-1.5'
                                    variants={containerVariants}
                                    initial='hidden'
                                    animate='visible'
                                >
                                    {cafe.brew_methods.map((method) => (
                                        <motion.span
                                            key={method}
                                            variants={itemVariants}
                                            whileTap={{ scale: 0.95 }}
                                            className='text-xs bg-amber-500/20 text-amber-700 px-2 py-1 rounded-full capitalize cursor-default'
                                        >
                                            {method.split("_").join(" ")}
                                        </motion.span>
                                    ))}
                                </motion.div>
                            </div>
                        )}
                        {cafe.specialty && cafe.specialty.length > 0 && (
                            <div>
                                <p className='text-xs text-text/60 mb-1'>
                                    Specialties
                                </p>
                                <motion.div
                                    className='flex flex-wrap gap-1.5'
                                    variants={containerVariants}
                                    initial='hidden'
                                    animate='visible'
                                >
                                    {cafe.specialty.map((item) => (
                                        <motion.span
                                            key={item}
                                            variants={itemVariants}
                                            whileTap={{ scale: 0.95 }}
                                            className='text-xs bg-primary/20 px-2 py-1 rounded-full capitalize text-nowrap cursor-default'
                                        >
                                            {item.split("_").join(" ")}
                                        </motion.span>
                                    ))}
                                </motion.div>
                            </div>
                        )}
                        {cafe.tags && cafe.tags.length > 0 && (
                            <div>
                                <p className='text-xs text-text/60 mb-1'>
                                    Vibe
                                </p>
                                <motion.div
                                    className='flex flex-wrap gap-1.5'
                                    variants={containerVariants}
                                    initial='hidden'
                                    animate='visible'
                                >
                                    {cafe.tags.map((tag) => (
                                        <motion.span
                                            key={tag}
                                            variants={itemVariants}
                                            whileTap={{ scale: 0.95 }}
                                            className='text-xs bg-text/10 px-2 py-1 rounded-full capitalize cursor-default'
                                        >
                                            {tag.split("_").join(" ")}
                                        </motion.span>
                                    ))}
                                </motion.div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Last Updated & Scouted By */}
            <div className='bg-text/5 rounded-xl p-4 space-y-2'>
                {cafe.updated_at && (
                    <div className='flex items-center gap-2 text-sm text-text/60'>
                        <CalendarIcon className='w-4 h-4' />
                        <span>
                            Last updated{" "}
                            {new Date(cafe.updated_at).toLocaleDateString(
                                "en-US",
                                {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                }
                            )}
                        </span>
                        {onOpenHistory && (
                            <motion.button
                                onClick={onOpenHistory}
                                className='ml-auto flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors cursor-pointer'
                                whileHover={{ scale: 1.05, x: 3 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <motion.div
                                    whileHover={{ rotate: -20 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <History className='w-3.5 h-3.5' />
                                </motion.div>
                                View history
                            </motion.button>
                        )}
                    </div>
                )}
                {cafe.contributor && (
                    <div className='flex items-center gap-2 text-sm text-text/60'>
                        <UserIcon className='w-4 h-4' />
                        <span>Scouted by</span>
                        <Link
                            href={`/profile/${cafe.contributor.username}`}
                            className='font-semibold text-text hover:text-accent transition-colors hover:underline'
                        >
                            {cafe.contributor.display_name ||
                                cafe.contributor.username}
                        </Link>
                    </div>
                )}
            </div>

            {/* Suggest Edit */}
            <div className='flex justify-center pt-2'>
                <SuggestEditButton
                    cafe={cafe}
                    variant='compact'
                />
            </div>
        </div>
    )
}
