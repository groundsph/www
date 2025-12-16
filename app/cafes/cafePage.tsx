"use client"

import { dummyCafes } from "@/utils/dummy/cafes"
import { getPriceLevel, isOpenNow } from "@/utils/extras"
import { Cafe } from "@/utils/types/cafe"
import Image from "next/image"
import { useCallback, useEffect, useState } from "react"
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
import Loading from "@/components/Loading"

export default function CafesPageClient() {
    // States
    const [loading, setLoading] = useState(true)
    const [cafes, setCafes] = useState<Cafe[]>([])

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

    // Handler
    const getCafes = useCallback(async () => {
        setLoading(true)
        setCafes(dummyCafes)
        setLoading(false)
    }, [])

    // Effect
    useEffect(() => {
        getCafes()
    }, [getCafes])

    // Filter Logic
    const filteredCafes = cafes
        .filter((cafe) => {
            // Text Search
            const searchLower = search.toLowerCase()
            const matchesSearch =
                search === "" ||
                cafe.name.toLowerCase().includes(searchLower) ||
                cafe.address_display.toLowerCase().includes(searchLower) ||
                cafe.roaster?.toLowerCase().includes(searchLower) ||
                cafe.tags?.some((tag) =>
                    tag.toLowerCase().includes(searchLower)
                ) ||
                cafe.specialty?.some((specialty) =>
                    specialty.toLowerCase().includes(searchLower)
                )

            // Amenity Filters
            const matchesWifi = !filters.has_wifi || cafe.has_wifi
            const matchesSockets = !filters.has_sockets || cafe.has_sockets
            const matchesParking = !filters.has_parking || cafe.has_parking
            const matchesAircon = !filters.has_aircon || cafe.has_aircon
            const matchesPet = !filters.is_pet_friendly || cafe.is_pet_friendly
            const matchesOutdoor =
                !filters.has_outdoor_seating || cafe.has_outdoor_seating
            const matchesOpen =
                !filters.open_now ||
                (cafe.operating_hours && isOpenNow(cafe.operating_hours).isOpen)
            const matchesPrice =
                !filters.price_level || cafe.price_level === filters.price_level

            return (
                matchesSearch &&
                matchesWifi &&
                matchesSockets &&
                matchesParking &&
                matchesAircon &&
                matchesPet &&
                matchesOutdoor &&
                matchesOpen &&
                matchesPrice
            )
        })
        .sort((a, b) => {
            switch (sortBy) {
                case "rating":
                    return b.rating - a.rating
                case "reviews":
                    return b.reviews - a.reviews
                case "price_low": {
                    const priceMap = { low: 1, medium: 2, high: 3 }
                    return priceMap[a.price_level] - priceMap[b.price_level]
                }
                case "price_high": {
                    const priceMap = { low: 1, medium: 2, high: 3 }
                    return priceMap[b.price_level] - priceMap[a.price_level]
                }
                default:
                    return 0 // Recommended / Default order
            }
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
            <div className='flex flex-1 flex-col gap-6'>
                {loading ? (
                    <Loading />
                ) : (
                    <AnimatePresence mode='popLayout'>
                        {filteredCafes.length > 0 ? (
                            filteredCafes.map((cafe, idx) => {
                                const openStatus = isOpenNow(
                                    cafe.operating_hours
                                )
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
                                                        {cafe.rating.toFixed(1)}
                                                    </span>
                                                </div>
                                                <span className='text-text/60'>
                                                    ({cafe.reviews} reviews)
                                                </span>
                                                {cafe.roaster && (
                                                    <>
                                                        <span className='text-text/30'>
                                                            •
                                                        </span>
                                                        <span className='text-text/60'>
                                                            Roaster:{" "}
                                                            {cafe.roaster}
                                                        </span>
                                                    </>
                                                )}
                                                <div className='flex-1' />
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
                                            {cafe.tags &&
                                                cafe.tags.length > 0 && (
                                                    <div className='flex flex-row overflow-x-auto gap-1.5 mt-3'>
                                                        {cafe.tags.map(
                                                            (tag) => (
                                                                <span
                                                                    key={tag}
                                                                    className='text-xs px-2 py-0.5 bg-primary/10 text-nowrap font-semibold rounded-full text-text/80 h-max'
                                                                >
                                                                    #{tag}
                                                                </span>
                                                            )
                                                        )}
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
                )}
            </div>
        </section>
    )
}
