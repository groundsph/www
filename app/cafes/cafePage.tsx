"use client"

import { getCafeThumbnailUrl, getPriceLevel, isOpenNow } from "@/utils/extras"
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
    Armchair,
    SlidersHorizontal,
    MapPinIcon,
    Briefcase,
    Toilet,
    Droplet,
    MilkOff,
} from "lucide-react"

import { getAllCafes } from "@/app/api/actions/cafe"
import { CafeWithRatings } from "@/utils/types/extra"
import { PHILIPPINES_LOCATIONS, COFFEE_STYLES } from "@/utils/data/philippines"
import { useEffect, useState, useTransition } from "react"

export default function CafesPageClient() {
    // States
    const [cafes, setCafes] = useState<CafeWithRatings[]>([])
    const [loading, setLoading] = useState(true)
    const [isPending, startTransition] = useTransition()
    const [filtersOpen, setFiltersOpen] = useState(false)

    // Location State
    const [userLocation, setUserLocation] = useState<{
        city?: string
        region?: string
    } | null>(null)

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
        has_indoor_seating: false,
        has_restroom: false,
        has_bidet: false,
        has_non_dairy: false,
        is_work_friendly: false,
        open_now: false,
        price_level: "" as "" | "low" | "medium" | "high",
        coffee_style: "" as "" | "classic" | "artisan",
        region: "",
        near_me: false,
    })

    // Location Detection
    useEffect(() => {
        if (!navigator.geolocation) return

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?lat=${position.coords.latitude}&lon=${position.coords.longitude}&format=json&addressdetails=1`,
                        { headers: { "User-Agent": "Grounds Coffee App" } }
                    )
                    const data = await response.json()
                    const city =
                        data.address?.city ||
                        data.address?.town ||
                        data.address?.municipality ||
                        data.address?.village
                    const region = data.address?.state || data.address?.region
                    if (city || region) {
                        setUserLocation({ city, region })
                    }
                } catch (error) {
                    console.error("Failed to get location:", error)
                }
            },
            () => console.log("Location access denied"),
            { timeout: 10000, maximumAge: 300000 }
        )
    }, [])

    // Filter Logic
    useEffect(() => {
        const fetchCafes = async () => {
            startTransition(async () => {
                const fetchedCafes = await getAllCafes(1, 40, {
                    search,
                    has_wifi: filters.has_wifi,
                    has_sockets: filters.has_sockets,
                    has_parking: filters.has_parking,
                    has_aircon: filters.has_aircon,
                    is_pet_friendly: filters.is_pet_friendly,
                    has_outdoor_seating: filters.has_outdoor_seating,
                    has_indoor_seating: filters.has_indoor_seating,
                    has_restroom: filters.has_restroom,
                    has_bidet: filters.has_bidet,
                    has_non_dairy: filters.has_non_dairy,
                    is_work_friendly: filters.is_work_friendly,
                    price_level: filters.price_level || undefined,
                    coffee_style: filters.coffee_style || undefined,
                    region: filters.region || undefined,
                    sortBy: sortBy as "recommended" | "rating" | "reviews",
                })
                setCafes(fetchedCafes)
                setLoading(false)
            })
        }

        const timeoutId = setTimeout(() => {
            fetchCafes()
        }, 500)

        return () => clearTimeout(timeoutId)
    }, [search, sortBy, filters])

    // Client-side filtering for open_now and near_me
    const filteredCafes = cafes.filter((cafe) => {
        if (filters.open_now) {
            if (
                !cafe.operating_hours ||
                !isOpenNow(cafe.operating_hours).isOpen
            ) {
                return false
            }
        }
        if (filters.near_me && userLocation) {
            const cityMatch =
                userLocation.city &&
                cafe.city_municipality
                    ?.toLowerCase()
                    .includes(userLocation.city.toLowerCase())
            const regionMatch =
                userLocation.region &&
                cafe.region
                    ?.toLowerCase()
                    .includes(userLocation.region.toLowerCase())
            if (!cityMatch && !regionMatch) {
                return false
            }
        }
        return true
    })

    const toggleFilter = (key: keyof typeof filters) => {
        setFilters((prev) => ({ ...prev, [key]: !prev[key] }))
    }

    // Count active filters (excluding empty values)
    const activeFilterCount = Object.entries(filters).filter(
        ([key, value]) =>
            value === true ||
            (key === "price_level" && value !== "") ||
            (key === "coffee_style" && value !== "") ||
            (key === "region" && value !== "")
    ).length

    const filterOptions = [
        { key: "open_now", label: "Open Now", icon: null },
        { key: "has_wifi", label: "WiFi", icon: <Wifi className='w-4 h-4' /> },
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
        {
            key: "has_indoor_seating",
            label: "Indoor",
            icon: <Armchair className='w-4 h-4' />,
        },
        {
            key: "has_restroom",
            label: "Restroom",
            icon: <Toilet className='w-4 h-4' />,
        },
        {
            key: "has_bidet",
            label: "Bidet",
            icon: <Droplet className='w-4 h-4' />,
        },
        {
            key: "has_non_dairy",
            label: "Non-Dairy",
            icon: <MilkOff className='w-4 h-4' />,
        },
        {
            key: "is_work_friendly",
            label: "Work Friendly",
            icon: <Briefcase className='w-4 h-4' />,
        },
    ]

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

            {/* Controls - Compact Row */}
            <div className='flex flex-col gap-3'>
                <div className='flex flex-row gap-2 flex-wrap'>
                    <input
                        type='text'
                        placeholder='Search cafes...'
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className='flex-1 min-w-40 px-4 py-2 rounded-lg border border-text/20 bg-transparent focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all text-sm'
                    />
                    <button
                        onClick={() => setFiltersOpen(!filtersOpen)}
                        className={`flex flex-row items-center gap-2 px-3 py-2 rounded-lg border transition-all cursor-pointer text-sm font-medium ${
                            filtersOpen || activeFilterCount > 0
                                ? "bg-text text-background border-text"
                                : "border-text/20 hover:border-text/50"
                        }`}
                    >
                        <SlidersHorizontal className='w-4 h-4' />
                        <span className='hidden sm:inline'>Filters</span>
                        {activeFilterCount > 0 && (
                            <span className='bg-background text-text text-xs font-bold px-2 md:px-1.5 py-0.5 rounded-full'>
                                {activeFilterCount}
                            </span>
                        )}
                    </button>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className='px-3 py-2 rounded-lg border border-text/20 bg-background focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all cursor-pointer text-sm'
                    >
                        <option value='recommended'>Recommended</option>
                        <option value='rating'>Highest Rated</option>
                        <option value='reviews'>Most Reviewed</option>
                    </select>
                    {/* Location Badge */}
                    {userLocation && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className='flex flex-row items-center gap-2'
                        >
                            <button
                                onClick={() => toggleFilter("near_me")}
                                className={`flex flex-row items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border cursor-pointer ${
                                    filters.near_me
                                        ? "bg-text text-background border-text"
                                        : "bg-transparent text-text border-text/20 hover:border-text/50"
                                }`}
                            >
                                <MapPinIcon className='w-4 h-4' />
                                Near {userLocation.city || userLocation.region}
                            </button>
                        </motion.div>
                    )}
                </div>

                {/* Expandable Filters Panel */}
                <AnimatePresence>
                    {filtersOpen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className='overflow-hidden'
                        >
                            <div className='p-4 bg-text/5 rounded-xl border border-text/10'>
                                <div className='flex flex-row justify-between items-center mb-3'>
                                    <span className='text-sm font-semibold'>
                                        Filters
                                    </span>
                                    {activeFilterCount > 0 && (
                                        <button
                                            onClick={() => {
                                                setFilters({
                                                    has_wifi: false,
                                                    has_sockets: false,
                                                    has_parking: false,
                                                    has_aircon: false,
                                                    is_pet_friendly: false,
                                                    has_outdoor_seating: false,
                                                    has_indoor_seating: false,
                                                    has_restroom: false,
                                                    has_bidet: false,
                                                    has_non_dairy: false,
                                                    is_work_friendly: false,
                                                    open_now: false,
                                                    price_level: "",
                                                    coffee_style: "",
                                                    region: "",
                                                    near_me: false,
                                                })
                                            }}
                                            className='text-xs text-text/60 hover:text-text cursor-pointer'
                                        >
                                            Clear all
                                        </button>
                                    )}
                                </div>

                                {/* Price Filter */}
                                <div className='mb-3'>
                                    <span className='text-xs text-text/60 mb-1.5 block'>
                                        Price Range
                                    </span>
                                    <div className='flex flex-row gap-2'>
                                        {[
                                            { value: "", label: "All" },
                                            { value: "low", label: "₱" },
                                            { value: "medium", label: "₱₱" },
                                            { value: "high", label: "₱₱₱" },
                                        ].map(({ value, label }) => (
                                            <button
                                                key={value}
                                                onClick={() =>
                                                    setFilters((prev) => ({
                                                        ...prev,
                                                        price_level: value as
                                                            | ""
                                                            | "low"
                                                            | "medium"
                                                            | "high",
                                                    }))
                                                }
                                                className={`px-3 py-1 rounded-full text-xs font-medium transition-all border cursor-pointer ${
                                                    filters.price_level ===
                                                    value
                                                        ? "bg-text text-background border-text"
                                                        : "bg-transparent text-text/70 border-text/20 hover:border-text/50"
                                                }`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Coffee Style Filter */}
                                <div className='mb-3'>
                                    <span className='text-xs text-text/60 mb-1.5 block'>
                                        Coffee Style
                                    </span>
                                    <div className='flex flex-row gap-2'>
                                        {[
                                            { value: "", label: "All" },
                                            ...COFFEE_STYLES.map((s) => ({
                                                value: s.value,
                                                label: s.label,
                                            })),
                                        ].map(({ value, label }) => (
                                            <button
                                                key={value}
                                                onClick={() =>
                                                    setFilters((prev) => ({
                                                        ...prev,
                                                        coffee_style: value as
                                                            | ""
                                                            | "classic"
                                                            | "artisan",
                                                    }))
                                                }
                                                className={`px-3 py-1 rounded-full text-xs font-medium transition-all border cursor-pointer ${
                                                    filters.coffee_style ===
                                                    value
                                                        ? "bg-text text-background border-text"
                                                        : "bg-transparent text-text/70 border-text/20 hover:border-text/50"
                                                }`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Region Filter */}
                                <div className='mb-3'>
                                    <span className='text-xs text-text/60 mb-1.5 block'>
                                        Region
                                    </span>
                                    <select
                                        value={filters.region}
                                        onChange={(e) =>
                                            setFilters((prev) => ({
                                                ...prev,
                                                region: e.target.value,
                                            }))
                                        }
                                        className='w-full px-3 py-2 rounded-lg border border-text/20 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50 cursor-pointer'
                                    >
                                        <option value=''>All Regions</option>
                                        {PHILIPPINES_LOCATIONS.regions.map(
                                            (r) => (
                                                <option
                                                    key={r.name}
                                                    value={r.name}
                                                >
                                                    {r.name}
                                                </option>
                                            )
                                        )}
                                    </select>
                                </div>

                                {/* Amenity Filters */}
                                <div>
                                    <span className='text-xs text-text/60 mb-1.5 block'>
                                        Amenities
                                    </span>
                                    <div className='flex flex-row flex-wrap gap-2'>
                                        {filterOptions.map(
                                            ({ key, label, icon }) => (
                                                <button
                                                    key={key}
                                                    onClick={() =>
                                                        toggleFilter(
                                                            key as keyof typeof filters
                                                        )
                                                    }
                                                    className={`flex flex-row items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border cursor-pointer ${
                                                        filters[
                                                            key as keyof typeof filters
                                                        ]
                                                            ? "bg-text text-background border-text"
                                                            : "bg-transparent text-text/70 border-text/20 hover:border-text/50"
                                                    }`}
                                                >
                                                    {icon}
                                                    {label}
                                                </button>
                                            )
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Content */}
            <div
                className={`flex flex-1 flex-col gap-6 transition-opacity duration-300 ${
                    isPending ? "opacity-50 pointer-events-none" : "opacity-100"
                }`}
            >
                <AnimatePresence mode='popLayout'>
                    {loading ? (
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
                                    className={`py-4 px-6 bg-background rounded-xl flex flex-col-reverse md:flex-row gap-4 md:gap-0 group ${
                                        cafe.membership_tier === "premium"
                                            ? "shadow-lg shadow-amber-500/30 border border-amber-400/30 hover:shadow-amber-500/40"
                                            : "shadow-lg shadow-black/10"
                                    }`}
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
                                                        ? openStatus.closesAt
                                                            ? `Open | Closes at ${openStatus.closesAt}`
                                                            : "Open 24/7"
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
                                                                {item
                                                                    .split("_")
                                                                    .join(" ")}
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
                                            src={getCafeThumbnailUrl(
                                                cafe.thumbnail
                                            )}
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
                                        has_indoor_seating: false,
                                        has_restroom: false,
                                        has_bidet: false,
                                        has_non_dairy: false,
                                        is_work_friendly: false,
                                        open_now: false,
                                        price_level: "",
                                        coffee_style: "",
                                        region: "",
                                        near_me: false,
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
