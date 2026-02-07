"use client"

import { CafeWithRatings } from "@/utils/types/extra"
import { CafeSocial, OperatingHour } from "@/utils/types/cafe"
import {
    StarIcon,
    WifiIcon,
    PlugIcon,
    CarIcon,
    SnowflakeIcon,
    PawPrintIcon,
    SunIcon,
    BriefcaseIcon,
    CoffeeIcon,
    UserIcon,
    CalendarIcon,
    History,
    Toilet,
    Droplet,
    MilkOff,
    Armchair,
    MapPin,
    Cigarette,
    Coffee,
} from "lucide-react"
import { formatTimeTo12Hour, isOpenNow } from "@/utils/extras"
import dynamic from "next/dynamic"
import Link from "next/link"
import Image from "next/image"
import RatingDistribution from "./RatingDistribution"
import SuggestEditButton from "@/components/suggestions/SuggestEditButton"
import ReportCafeModal from "@/components/modal/ReportCafeModal"
import { motion } from "motion/react"
import { useState, useEffect } from "react"
import { getCafeVisitStats, getTodayVisitors } from "@/app/api/actions/profile"

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

// Day mapping and order
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
const DynamicCafeMiniMap = dynamic(() => import("@/components/map/CafeMiniMap"), {
    ssr: false,
    loading: () => (
        <div className='w-full h-full min-h-[180px] flex items-center justify-center bg-secondary/20 rounded-xl'>
            <p className='text-text/50 font-serif text-sm'>Loading map...</p>
        </div>
    ),
})

interface CafeSidebarProps {
    cafe: CafeWithRatings
    reviews?: { rating: number }[]
    onOpenHistory?: () => void
}

export default function CafeSidebar({
    cafe,
    reviews = [],
    onOpenHistory,
}: CafeSidebarProps) {
    const openStatus = isOpenNow(cafe.operating_hours)
    const socials = (cafe.socials as unknown as CafeSocial[]) ?? []
    const [isReportModalOpen, setIsReportModalOpen] = useState(false)

    // Visitor stats state
    const [visitStats, setVisitStats] = useState<{
        totalVisits: number
        uniqueVisitors: number
    } | null>(null)
    const [todayVisitors, setTodayVisitors] = useState<
        {
            userId: string
            username: string
            displayName: string
            avatarUrl: string | null
            visitedAt: string
        }[]
    >([])
    const [visitorsLoading, setVisitorsLoading] = useState(true)

    // Fetch visitor data on mount
    useEffect(() => {
        const fetchVisitorData = async () => {
            setVisitorsLoading(true)
            try {
                const [stats, visitors] = await Promise.all([
                    getCafeVisitStats(cafe.id),
                    getTodayVisitors(cafe.id),
                ])
                setVisitStats(stats)
                setTodayVisitors(visitors.visitors)
            } catch (error) {
                console.error("Error fetching visitor data:", error)
            } finally {
                setVisitorsLoading(false)
            }
        }
        fetchVisitorData()
    }, [cafe.id])

    return (
        <div className='w-full max-w-96 h-fit flex flex-col gap-3 sticky top-4'>
            {/* Map - Only show if cafe has coordinates (not a Hidden Gem) */}
            {cafe.lat !== null && cafe.lng !== null ? (
                <>
                    <div className='w-full h-auto aspect-video relative flex flex-col items-center justify-center overflow-clip rounded-xl border-2 border-text/10'>
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

                    {/* Address Link */}
                    <a
                        href={`https://www.google.com/maps/search/?api=1&query=${cafe.lat},${cafe.lng}`}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-sm font-semibold text-text/60 hover:text-text/60 transition-colors hover:underline'
                    >
                        {cafe.address_display}
                    </a>
                </>
            ) : cafe.is_hidden_gem ? (
                /* Hidden Gem - Show finding hint instead of map */
                <div className='w-full bg-amber-50 border border-amber-200 rounded-xl p-4'>
                    <div className='flex items-center gap-2 mb-2'>
                        <span className='font-semibold text-amber-800'>
                            🌟 Hidden Gem
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
            ) : (
                /* Graduated from hidden gem but no coordinates yet */
                <div className='w-full bg-blue-50 border border-blue-200 rounded-xl p-4'>
                    <div className='flex items-center gap-2 mb-2'>
                        <MapPin className='w-4 h-4 text-blue-600' />
                        <span className='font-semibold text-blue-800'>
                            Location Pending
                        </span>
                    </div>
                    <p className='text-sm text-blue-700'>
                        {cafe.address_display || "Address not yet provided"}
                    </p>
                    <p className='text-xs text-blue-600 mt-2'>
                        📍 This cafe needs its exact coordinates added. If you
                        know the location, suggest an edit!
                    </p>
                </div>
            )}

            {/* Website */}
            {cafe.website_url && (
                <a
                    href={cafe.website_url}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-text hover:text-text/60 transition-colors hover:underline text-sm font-semibold'
                >
                    {cafe.website_url}
                </a>
            )}

            {/* Socials */}
            {socials && socials.length > 0 && (
                <>
                    <p className='text-sm font-semibold text-text/60'>
                        Socials
                    </p>
                    <ul className='flex flex-row items-center gap-4 overflow-x-auto text-sm font-semibold text-text/60'>
                        {socials.map((social) => (
                            <li key={social.title}>
                                <a
                                    href={
                                        social.url.startsWith("http://") ||
                                        social.url.startsWith("https://")
                                            ? social.url
                                            : `https://${social.url}`
                                    }
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='text-text hover:text-text/60 transition-colors hover:underline'
                                >
                                    {social.title}
                                </a>
                            </li>
                        ))}
                    </ul>
                </>
            )}

            {/* Contact */}
            {(cafe.phone || cafe.email) && (
                <>
                    <p className='text-sm font-semibold text-text/60'>
                        Contact
                    </p>
                    <ul className='flex flex-row items-center gap-4 overflow-x-auto text-sm font-semibold text-text/60'>
                        {cafe.phone && (
                            <li>
                                <a
                                    href={`tel:${cafe.phone}`}
                                    className='text-text hover:text-text/60 transition-colors hover:underline text-sm font-semibold'
                                >
                                    {cafe.phone}
                                </a>
                            </li>
                        )}
                        {cafe.email && (
                            <li>
                                <a
                                    href={`mailto:${cafe.email}`}
                                    className='text-text hover:text-text/60 transition-colors hover:underline text-sm font-semibold'
                                >
                                    {cafe.email}
                                </a>
                            </li>
                        )}
                    </ul>
                </>
            )}

            <div className='border-b border-text/10 my-3' />

            {/* Details Section */}
            <div className='font-semibold text-lg font-serif text-text flex flex-row gap-2'>
                Details{" "}
                <div className='flex flex-row gap-2 items-center'>
                    <div
                        className={`text-sm font-bold px-2 py-0.5 rounded-lg ${
                            openStatus.isOpen
                                ? "bg-green-200/40 text-green-700"
                                : "bg-text/10 text-text"
                        }`}
                    >
                        {openStatus.isOpen ? "Open" : "Closed"}
                    </div>
                    <span className='text-xs font-semibold text-text/60'>
                        {openStatus.isOpen
                            ? openStatus.closesAt
                                ? `Closes at ${openStatus.closesAt}`
                                : "Open 24/7"
                            : openStatus.opensAt
                              ? `Opens at ${openStatus.opensAt}`
                              : ""}
                    </span>
                </div>
            </div>

            {/* Price Range */}
            <div className='flex flex-row items-center gap-2'>
                <p className='text-sm font-semibold text-text/60'>
                    Price Range
                </p>
                <span className='text-sm font-bold text-text'>
                    {cafe.price_level === "low" && "₱"}
                    {cafe.price_level === "medium" && "₱₱"}
                    {cafe.price_level === "high" && "₱₱₱"}
                </span>
            </div>

            {/* Coffee Style */}
            {cafe.coffee_style && (
                <div className='flex flex-row items-center gap-2'>
                    <p className='text-sm font-semibold text-text/60'>
                        Coffee Style
                    </p>
                    <span className='text-sm font-bold capitalize bg-amber-500/20 text-amber-700 px-2 py-0.5 rounded-full'>
                        {cafe.coffee_style === "classic"
                            ? "Classic"
                            : "Artisan"}
                    </span>
                </div>
            )}

            {/* Payment Methods */}
            {cafe.payment_methods && (
                <>
                    <p className='text-sm font-semibold text-text/60'>
                        Payment Methods
                    </p>
                    <ul className='flex flex-row items-center gap-4 flex-wrap text-sm font-semibold text-text/60'>
                        {cafe.payment_methods
                            .split(",")
                            .map((method) => method.trim())
                            .filter(Boolean)
                            .map((method) => (
                                <li
                                    key={method}
                                    className='text-text capitalize bg-secondary/40 px-2 py-1 rounded-full h-max w-max text-nowrap'
                                >
                                    {method.split("_").join(" ")}
                                </li>
                            ))}
                    </ul>
                </>
            )}

            {/* Roaster */}
            {cafe.roaster && (
                <>
                    <p className='text-sm font-semibold text-text/60'>
                        Roaster
                    </p>
                    <ul className='flex flex-row items-center gap-4 overflow-x-auto text-sm font-semibold text-text/60'>
                        <li>
                            <span className='text-text'>{cafe.roaster}</span>
                        </li>
                    </ul>
                </>
            )}

            <div className='border-b border-text/10 my-3' />

            {/* Ratings */}
            <div className='font-semibold text-lg font-serif text-text flex flex-row items-center gap-2'>
                Ratings
                <div className='flex flex-row items-center gap-2'>
                    <div className='text-sm font-bold px-2 py-0.5 rounded-lg bg-green-200/40 text-green-700 flex flex-row items-center gap-1'>
                        <StarIcon className='w-4 h-4 fill-current' />{" "}
                        {cafe.average_rating
                            ? cafe.average_rating.toFixed(1)
                            : "-"}{" "}
                        / 5
                    </div>
                </div>
            </div>

            {/* Rating Distribution */}
            <RatingDistribution reviews={reviews} />

            <div className='border-b border-text/10 my-3' />

            {/* Visitors Section */}
            <div className='font-semibold text-lg font-serif text-text flex flex-row items-center gap-2'>
                Visitors
            </div>

            {/* Visit Stats */}
            <div className='flex flex-row gap-4 text-sm'>
                <div className='flex flex-col'>
                    <span className='font-bold text-text'>
                        {visitorsLoading
                            ? "..."
                            : (visitStats?.totalVisits ?? 0)}
                    </span>
                    <span className='text-text/60 text-xs'>
                        Total Check-ins
                    </span>
                </div>
                <div className='flex flex-col'>
                    <span className='font-bold text-text'>
                        {visitorsLoading
                            ? "..."
                            : (visitStats?.uniqueVisitors ?? 0)}
                    </span>
                    <span className='text-text/60 text-xs'>
                        Unique Visitors
                    </span>
                </div>
            </div>

            {/* Visitors Today */}
            <div className='mt-2'>
                <p className='text-sm font-semibold text-text/60 flex items-center gap-1 mb-2'>
                    <MapPin className='w-3.5 h-3.5' />
                    Visitors Today
                </p>
                {visitorsLoading ? (
                    <div className='flex gap-2'>
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className='w-8 h-8 rounded-full bg-secondary/40 animate-pulse'
                            />
                        ))}
                    </div>
                ) : todayVisitors.length > 0 ? (
                    <div className='flex flex-wrap gap-2'>
                        {todayVisitors.slice(0, 5).map((visitor) => (
                            <Link
                                key={visitor.userId}
                                href={`/profile/${visitor.username}`}
                                className='group flex items-center gap-1.5 bg-secondary/30 hover:bg-secondary/50 rounded-full pr-2 transition-colors'
                                title={`${visitor.displayName} checked in today`}
                            >
                                {visitor.avatarUrl ? (
                                    <Image
                                        src={visitor.avatarUrl}
                                        alt={visitor.displayName}
                                        width={28}
                                        height={28}
                                        className='w-7 h-7 rounded-full object-cover'
                                    />
                                ) : (
                                    <div className='w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center'>
                                        <UserIcon className='w-4 h-4 text-primary' />
                                    </div>
                                )}
                                <span className='text-xs font-medium text-text group-hover:text-primary transition-colors truncate max-w-20'>
                                    {visitor.displayName}
                                </span>
                            </Link>
                        ))}
                        {todayVisitors.length > 5 && (
                            <span className='text-xs text-text/50 self-center'>
                                +{todayVisitors.length - 5} more
                            </span>
                        )}
                    </div>
                ) : (
                    <p className='text-xs text-text/50 italic'>
                        No visitors yet today
                    </p>
                )}
            </div>

            <div className='border-b border-text/10 my-3' />

            {/* Amenities */}
            <div className='font-semibold text-lg font-serif text-text'>
                Amenities
            </div>
            <motion.ul
                className='flex flex-row flex-wrap items-center gap-2 text-sm font-semibold'
                variants={containerVariants}
                initial='hidden'
                animate='visible'
            >
                {cafe.has_wifi && (
                    <motion.li
                        variants={itemVariants}
                        whileHover={{ scale: 1.05 }}
                        className='text-text bg-secondary/40 px-2 py-1 rounded-full flex flex-row items-center gap-1 cursor-default'
                    >
                        <WifiIcon className='w-4 h-4' />
                        WiFi
                    </motion.li>
                )}
                {cafe.has_smoking && (
                    <motion.li
                        variants={itemVariants}
                        whileHover={{ scale: 1.05 }}
                        className='text-text bg-secondary/40 px-2 py-1 rounded-full flex flex-row items-center gap-1 cursor-default'
                    >
                        <Cigarette className='w-4 h-4' />
                        Smoking Area
                    </motion.li>
                )}
                {cafe.has_sockets && (
                    <motion.li
                        variants={itemVariants}
                        whileHover={{ scale: 1.05 }}
                        className='text-text bg-secondary/40 px-2 py-1 rounded-full flex flex-row items-center gap-1 cursor-default'
                    >
                        <PlugIcon className='w-4 h-4' />
                        Power Outlets
                    </motion.li>
                )}
                {cafe.has_parking && (
                    <motion.li
                        variants={itemVariants}
                        whileHover={{ scale: 1.05 }}
                        className='text-text bg-secondary/40 px-2 py-1 rounded-full flex flex-row items-center gap-1 cursor-default'
                    >
                        <CarIcon className='w-4 h-4' />
                        Parking
                    </motion.li>
                )}
                {cafe.has_aircon && (
                    <motion.li
                        variants={itemVariants}
                        whileHover={{ scale: 1.05 }}
                        className='text-text bg-secondary/40 px-2 py-1 rounded-full flex flex-row items-center gap-1 cursor-default'
                    >
                        <SnowflakeIcon className='w-4 h-4' />
                        Air Conditioning
                    </motion.li>
                )}
                {cafe.is_pet_friendly && (
                    <motion.li
                        variants={itemVariants}
                        whileHover={{ scale: 1.05 }}
                        className='text-text bg-secondary/40 px-2 py-1 rounded-full flex flex-row items-center gap-1 cursor-default'
                    >
                        <PawPrintIcon className='w-4 h-4' />
                        Pet Friendly
                    </motion.li>
                )}
                {cafe.has_outdoor_seating && (
                    <motion.li
                        variants={itemVariants}
                        whileHover={{ scale: 1.05 }}
                        className='text-text bg-secondary/40 px-2 py-1 rounded-full flex flex-row items-center gap-1 cursor-default'
                    >
                        <SunIcon className='w-4 h-4' />
                        Outdoor Seating
                    </motion.li>
                )}
                {cafe.has_indoor_seating && (
                    <motion.li
                        variants={itemVariants}
                        whileHover={{ scale: 1.05 }}
                        className='text-text bg-secondary/40 px-2 py-1 rounded-full flex flex-row items-center gap-1 cursor-default'
                    >
                        <Armchair className='w-4 h-4' />
                        Indoor Seating
                    </motion.li>
                )}
                {cafe.has_restroom && (
                    <motion.li
                        variants={itemVariants}
                        whileHover={{ scale: 1.05 }}
                        className='text-text bg-secondary/40 px-2 py-1 rounded-full flex flex-row items-center gap-1 cursor-default'
                    >
                        <Toilet className='w-4 h-4' />
                        Restroom
                    </motion.li>
                )}
                {cafe.has_bidet && (
                    <motion.li
                        variants={itemVariants}
                        whileHover={{ scale: 1.05 }}
                        className='text-text bg-secondary/40 px-2 py-1 rounded-full flex flex-row items-center gap-1 cursor-default'
                    >
                        <Droplet className='w-4 h-4' />
                        Bidet
                    </motion.li>
                )}
                {cafe.has_non_dairy && (
                    <motion.li
                        variants={itemVariants}
                        whileHover={{ scale: 1.05 }}
                        className='text-text bg-secondary/40 px-2 py-1 rounded-full flex flex-row items-center gap-1 cursor-default'
                    >
                        <MilkOff className='w-4 h-4' />
                        Non-Dairy Milk
                        {cafe.milk_options && cafe.milk_options.length > 0 && (
                            <span className='text-xs text-text/60'>
                                ({cafe.milk_options.join(", ")})
                            </span>
                        )}
                    </motion.li>
                )}
                {cafe.has_decaf && (
                    <motion.li
                        variants={itemVariants}
                        whileHover={{ scale: 1.05 }}
                        className='text-text bg-secondary/40 px-2 py-1 rounded-full flex flex-row items-center gap-1 cursor-default'
                    >
                        <Coffee className='w-4 h-4' />
                        Decaf Options
                    </motion.li>
                )}
                {cafe.is_work_friendly && (
                    <motion.li
                        variants={itemVariants}
                        whileHover={{ scale: 1.05 }}
                        className='text-text bg-secondary/40 px-2 py-1 rounded-full flex flex-row items-center gap-1 cursor-default'
                    >
                        <BriefcaseIcon className='w-4 h-4' />
                        Work Friendly
                    </motion.li>
                )}
                {!cafe.has_wifi &&
                    !cafe.has_smoking &&
                    !cafe.has_sockets &&
                    !cafe.has_parking &&
                    !cafe.has_aircon &&
                    !cafe.is_pet_friendly &&
                    !cafe.has_outdoor_seating &&
                    !cafe.has_indoor_seating &&
                    !cafe.has_restroom &&
                    !cafe.has_bidet &&
                    !cafe.has_non_dairy &&
                    !cafe.has_decaf &&
                    !cafe.is_work_friendly && (
                        <li className='text-text/50'>No amenities listed</li>
                    )}
            </motion.ul>

            <div className='border-b border-text/10 my-3' />

            {/* Extras */}
            <div className='font-semibold text-lg font-serif text-text flex flex-row items-center gap-2'>
                Extras
                {cafe.serves_food && (
                    <span className='text-xs text-text/80 bg-secondary/40 px-2 py-1 rounded-lg'>
                        Serves Food
                    </span>
                )}
            </div>
            <div className='flex flex-col gap-2'>
                {cafe.brew_methods && cafe.brew_methods.length > 0 && (
                    <>
                        <p className='text-sm font-semibold text-text/60 flex items-center gap-1'>
                            <CoffeeIcon className='w-3.5 h-3.5' />
                            Brew Methods
                        </p>
                        <motion.ul
                            className='flex flex-row flex-wrap items-center gap-2 text-xs font-semibold'
                            variants={containerVariants}
                            initial='hidden'
                            animate='visible'
                        >
                            {cafe.brew_methods.map((method) => (
                                <motion.li
                                    key={method}
                                    variants={itemVariants}
                                    whileHover={{ scale: 1.05 }}
                                    className='text-amber-700 bg-amber-500/20 px-2 py-1 rounded-full capitalize cursor-default'
                                >
                                    {method.split("_").join(" ")}
                                </motion.li>
                            ))}
                        </motion.ul>
                    </>
                )}
                {cafe.specialty && cafe.specialty.length > 0 && (
                    <>
                        <p className='text-sm font-semibold text-text/60'>
                            Specialties
                        </p>
                        <motion.ul
                            className='flex flex-row flex-wrap items-center gap-2 text-xs font-semibold'
                            variants={containerVariants}
                            initial='hidden'
                            animate='visible'
                        >
                            {cafe.specialty.map((item) => (
                                <motion.li
                                    key={item}
                                    variants={itemVariants}
                                    whileHover={{ scale: 1.05 }}
                                    className='text-text bg-primary/20 px-2 py-1 rounded-full capitalize text-nowrap cursor-default'
                                >
                                    {item.split("_").join(" ")}
                                </motion.li>
                            ))}
                        </motion.ul>
                    </>
                )}
                {cafe.tags && cafe.tags.length > 0 && (
                    <>
                        <p className='text-sm font-semibold text-text/60'>
                            Vibe
                        </p>
                        <motion.ul
                            className='flex flex-row flex-wrap items-center gap-2 text-xs font-semibold'
                            variants={containerVariants}
                            initial='hidden'
                            animate='visible'
                        >
                            {cafe.tags.map((tag) => (
                                <motion.li
                                    key={tag}
                                    variants={itemVariants}
                                    whileHover={{ scale: 1.05 }}
                                    className='text-text/80 bg-text/10 px-2 py-1 rounded-full capitalize cursor-default'
                                >
                                    {tag.split("_").join(" ")}
                                </motion.li>
                            ))}
                        </motion.ul>
                    </>
                )}
                {!cafe.serves_food &&
                    (!cafe.specialty || cafe.specialty.length === 0) &&
                    (!cafe.tags || cafe.tags.length === 0) &&
                    (!cafe.brew_methods || cafe.brew_methods.length === 0) && (
                        <p className='text-sm text-text/50'>No extras listed</p>
                    )}
            </div>

            <div className='border-b border-text/10 my-3' />

            {/* Operating Hours */}
            <div className='font-semibold text-lg font-serif text-text'>
                Operating Hours
            </div>
            {cafe.operating_hours && cafe.operating_hours.length > 0 ? (
                <table className='w-full text-sm'>
                    <tbody>
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
                                <tr
                                    key={day}
                                    className={`border-b border-text/5 last:border-b-0 ${
                                        isToday
                                            ? "bg-primary/10 font-semibold"
                                            : ""
                                    }`}
                                >
                                    <td className='py-1.5 pl-2 pr-3 text-text/70'>
                                        {DAY_NAMES[day]}
                                    </td>
                                    <td className='py-1.5 text-right text-text pr-2'>
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
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            ) : (
                <p className='text-sm text-text/50'>Hours not available</p>
            )}

            <div className='border-b border-text/10 my-3' />

            {/* Last Updated & Scouted By */}
            <div className='space-y-2'>
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

            <div className='border-b border-text/10 my-3' />

            {/* Suggest Edit */}
            {/* Suggest Edit & Report */}
            <div className='flex flex-col items-center gap-2'>
                <SuggestEditButton
                    cafe={cafe}
                    variant='compact'
                />
                <button
                    onClick={() => setIsReportModalOpen(true)}
                    className='text-xs text-text/40 hover:text-red-500 transition-colors font-medium'
                >
                    Report Issue
                </button>
            </div>

            <ReportCafeModal
                cafeId={cafe.id}
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
            />
        </div>
    )
}
