"use client"

import { getPriceLevel, isOpenNow } from "@/utils/extras"
import Image from "next/image"
import { AnimatePresence, motion } from "motion/react"
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
} from "lucide-react"

import { getAllCafes } from "@/app/api/actions/cafe"
import { CafeWithRatings } from "@/utils/types/extra"
import { useEffect, useState, useTransition } from "react"

export default function CafesPageClient() {
    // States
    const [cafes, setCafes] = useState<CafeWithRatings[]>([])
    const [loading, setLoading] = useState(true)
    const [isPending, startTransition] = useTransition()

    // Search & Filter State
    const [search, setSearch] = useState("")
    const [sortBy, setSortBy] = useState("recommended")
    const [filters, setFilters] = useState({
        has_wifi: false,
        has_sockets: false,
        has_parking: false,
        has_aircon: false,
        is_pet_friendly: false,
        has_outdoor_seating: false,
        open_now: false,
        price_level: "" as "" | "low" | "medium" | "high",
    })

    // Filter Logic
    useEffect(() => {
        const fetchCafes = async () => {
            // Only set loading true if it's the first load or if you want a loading spinner on every filter change
            // For better UX with useTransition, we might keep old data while new data loads
            startTransition(async () => {
                const fetchedCafes = await getAllCafes(1, 40, {
                    search,
                    has_wifi: filters.has_wifi,
                    has_sockets: filters.has_sockets,
                    has_parking: filters.has_parking,
                    has_aircon: filters.has_aircon,
                    is_pet_friendly: filters.is_pet_friendly,
                    has_outdoor_seating: filters.has_outdoor_seating,
                    price_level: filters.price_level as any,
                    sortBy: sortBy as any,
                })
                setCafes(fetchedCafes)
                setLoading(false)
            })
        }

        // Debounce search
        const timeoutId = setTimeout(() => {
            fetchCafes()
        }, 500)

        return () => clearTimeout(timeoutId)
    }, [search, sortBy, filters])

    // Client-side filtering for open_now (since difficult to do server-side effectively without complex logic)
    const filteredCafes = cafes.filter((cafe) => {
        if (filters.open_now) {
            return (
                cafe.operating_hours && isOpenNow(cafe.operating_hours).isOpen
            )
        }
        return true
    })

    const toggleFilter = (key: keyof typeof filters) => {
        setFilters((prev) => ({ ...prev, [key]: !prev[key] }))
    }

    // Render
    return (
        <section className='w-full flex-1 py-6 flex flex-col gap-6 px-6'>
            <div className='flex flex-col gap-2 items-center text-center'>
                <h2 className='font-semibold font-serif text-3xl md:text-4xl lg:text-5xl'>
                    Cafes
                </h2>
                <p className='text-text/60 max-w-md'>
                    Find the perfect spot for your next brew or work session.
                </p>
            </div>

            {/* Controls */}
            <div className='flex flex-col gap-4'>
                {/* Top Row: Search & Sort */}
                <input
                    type='text'
                    placeholder='Search by name, area, vibe, or specialty...'
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className='flex-1 px-4 py-2 rounded-lg border border-text/20 bg-transparent focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all'
                />

                {/* Bottom Row: Amenity Filters */}
                <div className='flex flex-row flex-wrap gap-2'>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className='px-3 py-2 rounded-full border border-text/20 bg-background focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all cursor-pointer hover:border-primary'
                    >
                        <option value='recommended'>Recommended</option>
                        <option value='rating'>Highest Rated</option>
                        <option value='reviews'>Most Reviewed</option>
                        <option value='price_low'>Price: Low to High</option>
                        <option value='price_high'>Price: High to Low</option>
                    </select>
                    <select
                        value={filters.price_level}
                        onChange={(e) =>
                            setFilters((prev) => ({
                                ...prev,
                                price_level: e.target.value as
                                    | ""
                                    | "low"
                                    | "medium"
                                    | "high",
                            }))
                        }
                        className={`px-3 py-2 rounded-full border bg-background focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all cursor-pointer hover:border-primary ${
                            filters.price_level
                                ? "border-text bg-text text-background"
                                : "border-text/20"
                        }`}
                    >
                        <option value=''>All Prices</option>
                        <option value='low'>Budget (₱)</option>
                        <option value='medium'>Mid-Range (₱₱)</option>
                        <option value='high'>Premium (₱₱₱)</option>
                    </select>
                    {[
                        { key: "open_now", label: "Open Now", icon: null },
                        {
                            key: "has_wifi",
                            label: "WiFi",
                            icon: <Wifi className='w-4 h-4' />,
                        },
                        {
                            key: "has_sockets",
                            label: "Sockets",
                            icon: <Plug className='w-4 h-4' />,
                        },
                        {
                            key: "has_aircon",
                            label: "Aircon",
                            icon: <Wind className='w-4 h-4' />,
                        },
                        {
                            key: "has_parking",
                            label: "Parking",
                            icon: <Car className='w-4 h-4' />,
                        },
                        {
                            key: "is_pet_friendly",
                            label: "Pet Friendly",
                            icon: <PawPrint className='w-4 h-4' />,
                        },
                        {
                            key: "has_outdoor_seating",
                            label: "Outdoor",
                            icon: <TreePine className='w-4 h-4' />,
                        },
                    ].map(({ key, label, icon }) => (
                        <button
                            key={key}
                            onClick={() =>
                                toggleFilter(key as keyof typeof filters)
                            }
                            className={`flex flex-row items-center gap-2 px-3 py-1.5 rounded-full text-xs md:text-sm font-medium transition-all border cursor-pointer ${
                                filters[key as keyof typeof filters]
                                    ? "bg-text text-background border-text"
                                    : "bg-transparent text-text/70 border-text/20 hover:border-text/50"
                            }`}
                        >
                            {icon}
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div
                className={`flex flex-1 flex-col gap-6 transition-opacity duration-300 ${
                    isPending ? "opacity-50 pointer-events-none" : "opacity-100"
                }`}
            >
                <AnimatePresence mode='popLayout'>
                    {loading ? (
                        // Skeleton Loading
                        Array.from({ length: 4 }).map((_, i) => (
                            <div
                                key={i}
                                className='py-4 px-6 bg-background shadow-lg shadow-black/10 rounded-xl flex flex-col-reverse md:flex-row gap-4 md:gap-0'
                            >
                                <div className='flex-1 flex flex-col md:pr-24 gap-4'>
                                    <div className='flex flex-col gap-2'>
                                        <div className='h-8 w-64 bg-text/10 rounded-lg animate-pulse' />
                                        <div className='h-4 w-40 bg-text/5 rounded-lg animate-pulse' />
                                    </div>
                                    <div className='flex gap-2'>
                                        <div className='h-6 w-12 bg-text/5 rounded-full animate-pulse' />
                                        <div className='h-6 w-20 bg-text/5 rounded-full animate-pulse' />
                                    </div>
                                    <div className='h-24 w-full bg-text/5 rounded-lg animate-pulse mt-2' />
                                </div>
                                <div className='flex-1 aspect-square md:aspect-auto bg-text/10 rounded-2xl animate-pulse' />
                            </div>
                        ))
                    ) : filteredCafes.length > 0 ? (
                        filteredCafes.map((cafe, idx) => {
                            const openStatus = isOpenNow(cafe.operating_hours)
                            return (
                                <motion.a
                                    initial={{ opacity: 0 }}
                                    animate={{
                                        opacity: 1,
                                        transition: {
                                            duration: 0.5,
                                            delay: 0.2 * idx,
                                        },
                                    }}
                                    exit={{ opacity: 0 }}
                                    href={`/cafes/${cafe.slug}`}
                                    key={cafe.id}
                                    layout
                                    className='py-4 px-6 bg-background shadow-lg shadow-black/10 rounded-xl flex flex-col-reverse md:flex-row gap-4 md:gap-0 group'
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
                                                </h3>
                                                <p className='text-xs md:text-sm font-semibold text-text/60'>
                                                    {cafe.address_display}
                                                </p>
                                            </div>
                                            <div className='text-xs md:text-sm font-semibold text-background px-3 py-1 bg-secondary h-max rounded-full'>
                                                {getPriceLevel(
                                                    cafe.price_level
                                                )}
                                            </div>
                                        </div>

                                        {/* Rating & Reviews */}
                                        <div className='flex flex-row flex-wrap items-center gap-2 mt-2 text-xs md:text-sm'>
                                            <div className='flex flex-row items-center gap-1'>
                                                <Star className='w-4 h-4 fill-text text-text' />
                                                <span className='font-bold'>
                                                    {cafe.average_rating?.toFixed(
                                                        1
                                                    ) || "N/A"}
                                                </span>
                                            </div>
                                            <span className='text-text/60'>
                                                ({cafe.total_reviews || 0}{" "}
                                                reviews)
                                            </span>
                                            {cafe.roaster && (
                                                <>
                                                    <span className='text-text/30'>
                                                        •
                                                    </span>
                                                    <span className='text-text/60'>
                                                        Roaster: {cafe.roaster}
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
                                                        ? `Open | Closes at ${openStatus.closesAt}`
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
                                        </div>

                                        {/* Description */}
                                        <p className='text-sm font-semibold text-text mt-2'>
                                            {cafe.description}
                                        </p>

                                        {/* Specialty Items */}
                                        {cafe.specialty &&
                                            cafe.specialty.length > 0 && (
                                                <div className='flex flex-row overflow-x-auto gap-1.5 mt-5'>
                                                    {cafe.specialty.map(
                                                        (item) => (
                                                            <span
                                                                key={item}
                                                                className='text-xs px-2 py-0.5 bg-primary/10 text-nowrap h-max font-semibold capitalize'
                                                            >
                                                                {item}
                                                            </span>
                                                        )
                                                    )}
                                                </div>
                                            )}

                                        {/* Vibe Tags */}
                                        {cafe.tags && cafe.tags.length > 0 && (
                                            <div className='flex flex-row overflow-x-auto gap-1.5 mt-3'>
                                                {cafe.tags.map((tag) => (
                                                    <span
                                                        key={tag}
                                                        className='text-xs px-2 py-0.5 bg-primary/10 text-nowrap font-semibold rounded-full text-text/80 h-max'
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
                                            src={cafe.thumbnail}
                                            alt=''
                                            fill
                                            className='object-cover rounded-2xl'
                                        />
                                    </div>
                                </motion.a>
                            )
                        })
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className='flex flex-col items-center justify-center py-20 text-center gap-2'
                        >
                            <p className='text-xl font-serif font-medium'>
                                No cafes found
                            </p>
                            <p className='text-text/50'>
                                Try adjusting your filters or search terms.
                            </p>
                            <button
                                onClick={() => {
                                    setSearch("")
                                    setFilters({
                                        has_wifi: false,
                                        has_sockets: false,
                                        has_parking: false,
                                        has_aircon: false,
                                        is_pet_friendly: false,
                                        has_outdoor_seating: false,
                                        open_now: false,
                                        price_level: "",
                                    })
                                }}
                                className='mt-4 text-sm font-bold text-secondary hover:underline cursor-pointer'
                            >
                                Clear all filters
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </section>
    )
}
