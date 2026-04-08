"use client"

import { useHaptics } from "@/hooks/useHaptics"
import { AnimatePresence, motion } from "motion/react"
import {
    Wifi,
    Plug,
    Car,
    Wind,
    PawPrint,
    TreePine,
    Armchair,
    SlidersHorizontal,
    MapPinIcon,
    Briefcase,
    Toilet,
    Droplet,
    MilkOff,
    Coffee,
    Cigarette,
    Store,
    Clock12,
} from "lucide-react"

import { getAllCafes } from "@/app/api/actions/cafe"
import { CafeWithRatings } from "@/utils/types/extra"
import {
    PHILIPPINES_LOCATIONS,
    COFFEE_STYLES,
    CAFE_VIBE_TAGS,
} from "@/utils/data/philippines"
import { useCallback, useEffect, useState, useRef } from "react"
import { useDebounce } from "@/utils/hooks/useDebounce"
import RandomCafeButton from "@/components/map/RandomCafeButton"
import MiniSubmitCafeBanner from "@/components/ui/MiniSubmitCafeBanner"
import CafeCard from "./CafeCard"

const PAGE_SIZE = 10

const INITIAL_FILTERS = {
    has_wifi: false,
    has_smoking: false,
    has_sockets: false,
    has_parking: false,
    has_aircon: false,
    is_pet_friendly: false,
    has_outdoor_seating: false,
    has_indoor_seating: false,
    has_restroom: false,
    has_bidet: false,
    has_non_dairy: false,
    has_decaf: false,
    is_work_friendly: false,
    is_24_7: false,
    open_now: false,
    price_level: "" as "" | "budget" | "mid" | "premium" | "luxury",
    coffee_style: "" as "" | "classic" | "artisan",
    region: "",
    near_me: false,
    tags: [] as string[],
    include_chains: false,
    is_halal_certified: false,
}

type SortOption = "recommended" | "rating" | "reviews"

export default function CafesPageClient() {
    const { trigger } = useHaptics()

    // States
    const [cafes, setCafes] = useState<CafeWithRatings[]>([])
    const [loading, setLoading] = useState(true)
    const [currentPage, setCurrentPage] = useState(1)
    const [hasMore, setHasMore] = useState(false)
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const [filtersOpen, setFiltersOpen] = useState(false)
    const [loadError, setLoadError] = useState(false)
    const [locationStatus, setLocationStatus] = useState<"loading" | "found" | "not_found">("loading")
    const fetchVersionRef = useRef(0)
    const sentinelRef = useRef<HTMLDivElement>(null)
    const observerRef = useRef<IntersectionObserver | null>(null)
    const isFetchingRef = useRef(false)
    const initializedRef = useRef(false)
    const hasAutoEnabledNearMe = useRef(false)

    // Track if user has manually toggled location filter
    const hasUserToggledLocation = useRef(false)

    // Location State
    const [userLocation, setUserLocation] = useState<{
        city?: string
        region?: string
    } | null>(null)

    const [search, setSearch] = useState("")
    const debouncedSearch = useDebounce(search, 300)
    const [sortBy, setSortBy] = useState<SortOption>("recommended")
    const [filters, setFilters] = useState(INITIAL_FILTERS)

    // Build filter params
    const getFilterParams = useCallback(() => ({
        search: debouncedSearch,
        has_wifi: filters.has_wifi,
        has_smoking: filters.has_smoking,
        has_sockets: filters.has_sockets,
        has_parking: filters.has_parking,
        has_aircon: filters.has_aircon,
        is_pet_friendly: filters.is_pet_friendly,
        has_outdoor_seating: filters.has_outdoor_seating,
        has_indoor_seating: filters.has_indoor_seating,
        has_restroom: filters.has_restroom,
        has_bidet: filters.has_bidet,
        has_non_dairy: filters.has_non_dairy,
        has_decaf: filters.has_decaf,
        is_work_friendly: filters.is_work_friendly,
        is_24_7: filters.is_24_7 || undefined,
        isHalalCertified: filters.is_halal_certified || undefined,
        price_level: filters.price_level || undefined,
        coffee_style: filters.coffee_style || undefined,
        region: filters.region || undefined,
        near_me: filters.near_me && userLocation ? { city: userLocation.city, region: userLocation.region } : undefined,
        tags: filters.tags.length > 0 ? filters.tags : undefined,
        sortBy,
        include_chains: filters.include_chains || undefined,
    }), [debouncedSearch, filters, sortBy, userLocation])

    // Fetch cafes function - defined early so it can be used in effects
    const fetchCafes = useCallback(async (page: number) => {
        if (isFetchingRef.current) return []
        isFetchingRef.current = true
        try {
            const result = await getAllCafes(page, PAGE_SIZE, getFilterParams())
            return result
        } finally {
            isFetchingRef.current = false
        }
    }, [getFilterParams])

    // Location Detection - sets location and auto-enables near_me in one go
    useEffect(() => {
        const cachedLocation = sessionStorage.getItem("grounds_location")
        if (cachedLocation) {
            try {
                const { city, region } = JSON.parse(cachedLocation)
                if (city || region) {
                    setUserLocation({ city, region })
                    setLocationStatus("found")
                    // Auto-enable near_me immediately when location is found
                    if (!hasUserToggledLocation.current && !hasAutoEnabledNearMe.current) {
                        hasAutoEnabledNearMe.current = true
                        setFilters((prev) => ({ ...prev, near_me: true }))
                    }
                    return
                }
            } catch {
                // Invalid cache
            }
        }

        if (!navigator.geolocation) {
            setLocationStatus("not_found")
            return
        }

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
                        setLocationStatus("found")
                        // Auto-enable near_me immediately when location is found
                        if (!hasUserToggledLocation.current && !hasAutoEnabledNearMe.current) {
                            hasAutoEnabledNearMe.current = true
                            setFilters((prev) => ({ ...prev, near_me: true }))
                        }
                    } else {
                        setLocationStatus("not_found")
                    }
                } catch (error) {
                    console.error("Failed to get location:", error)
                    setLocationStatus("not_found")
                }
            },
            () => {
                console.log("Location access denied")
                setLocationStatus("not_found")
            },
            { timeout: 10000, maximumAge: 300000 }
        )
    }, [])

    // Initial fetch - runs AFTER location is determined AND near_me is potentially set
    useEffect(() => {
        if (initializedRef.current) return
        if (locationStatus === "loading") return
        
        // Use setTimeout to allow React to process the filter state update
        initializedRef.current = true
        setLoading(true)

        setTimeout(() => {
            fetchCafes(1)
                .then((data) => {
                    setCafes(data)
                    setHasMore(data.length === PAGE_SIZE)
                })
                .catch((error) => {
                    console.error("Failed to fetch cafes:", error)
                    setLoadError(true)
                })
                .finally(() => {
                    setLoading(false)
                })
        }, 0)
    }, [locationStatus, fetchCafes])

    // Handle filter changes - refetch page 1
    const handleFilterChange = useCallback(() => {
        if (!initializedRef.current || locationStatus === "loading") return

        fetchVersionRef.current += 1
        const version = fetchVersionRef.current
        setCurrentPage(1)
        setLoadError(false)
        setIsLoadingMore(false)

        fetchCafes(1)
            .then((data) => {
                if (version !== fetchVersionRef.current) return
                setCafes(data)
                setHasMore(data.length === PAGE_SIZE)
            })
            .catch((error) => {
                if (version !== fetchVersionRef.current) return
                console.error("Failed to fetch cafes:", error)
                setLoadError(true)
                setHasMore(false)
            })
    }, [fetchCafes, locationStatus])

    // Watch for filter changes
    useEffect(() => {
        handleFilterChange()
    }, [handleFilterChange, debouncedSearch, sortBy, filters.has_wifi, filters.has_smoking, filters.has_sockets, filters.has_parking,
        filters.has_aircon, filters.is_pet_friendly, filters.has_outdoor_seating, filters.has_indoor_seating,
        filters.has_restroom, filters.has_bidet, filters.has_non_dairy, filters.has_decaf, filters.is_work_friendly,
        filters.is_24_7, filters.is_halal_certified, filters.price_level, filters.coffee_style, filters.region,
        filters.near_me, filters.tags, filters.include_chains])

    // Simple list - no virtualization needed for typical cafe lists
    // Reset scroll position when cafes change (filter applied)
    useEffect(() => {
        if (cafes.length > 0) {
            window.scrollTo({ top: 0, behavior: 'auto' })
        }
    }, [cafes.length, filters.has_wifi, filters.price_level, filters.region, filters.near_me])

    // Load more function
    const loadMore = useCallback(async () => {
        if (isLoadingMore || !hasMore) return

        setIsLoadingMore(true)
        const pageToFetch = currentPage + 1
        const version = fetchVersionRef.current

        try {
            const fetchedCafes = await getAllCafes(pageToFetch, PAGE_SIZE, getFilterParams())
            if (version !== fetchVersionRef.current) return

            setCafes((prev) => [...prev, ...fetchedCafes])
            setCurrentPage(pageToFetch)
            setHasMore(fetchedCafes.length === PAGE_SIZE)
        } catch (error) {
            if (version !== fetchVersionRef.current) return
            console.error("Failed to fetch more cafes:", error)
            setLoadError(true)
            setHasMore(false)
        } finally {
            setIsLoadingMore(false)
        }
    }, [currentPage, hasMore, isLoadingMore, getFilterParams])

    // Infinite scroll with IntersectionObserver
    useEffect(() => {
        if (observerRef.current) {
            observerRef.current.disconnect()
            observerRef.current = null
        }

        if (!hasMore || isLoadingMore) return

        const sentinel = sentinelRef.current
        if (!sentinel) return

        const observer = new IntersectionObserver(
            (entries) => {
                const [entry] = entries
                if (entry.isIntersecting && hasMore && !isLoadingMore) {
                    loadMore()
                }
            },
            { rootMargin: "400px", threshold: 0 }
        )

        observer.observe(sentinel)
        observerRef.current = observer

        return () => {
            observer.disconnect()
        }
    }, [hasMore, isLoadingMore, loadMore])

    const toggleFilter = (key: keyof typeof filters) => {
        trigger("selection")
        if (key === "near_me") {
            hasUserToggledLocation.current = true
        }
        setFilters((prev) => ({ ...prev, [key]: !prev[key] }))
    }

    // Count active filters
    const activeFilterCount = Object.entries(filters).filter(
        ([key, value]) =>
            value === true ||
            (key === "price_level" && value !== "") ||
            (key === "coffee_style" && value !== "") ||
            (key === "region" && value !== "") ||
            (key === "tags" && Array.isArray(value) && value.length > 0)
    ).length

    const filterOptions = [
        { key: "open_now", label: "Open Now", icon: null },
        { key: "has_wifi", label: "WiFi", icon: <Wifi className='w-4 h-4' /> },
        { key: "has_smoking", label: "Smoking Area", icon: <Cigarette className='w-4 h-4' /> },
        { key: "has_sockets", label: "Sockets", icon: <Plug className='w-4 h-4' /> },
        { key: "has_aircon", label: "Aircon", icon: <Wind className='w-4 h-4' /> },
        { key: "has_parking", label: "Parking", icon: <Car className='w-4 h-4' /> },
        { key: "is_pet_friendly", label: "Pet Friendly", icon: <PawPrint className='w-4 h-4' /> },
        { key: "has_outdoor_seating", label: "Outdoor", icon: <TreePine className='w-4 h-4' /> },
        { key: "has_indoor_seating", label: "Indoor", icon: <Armchair className='w-4 h-4' /> },
        { key: "has_restroom", label: "Restroom", icon: <Toilet className='w-4 h-4' /> },
        { key: "has_bidet", label: "Bidet", icon: <Droplet className='w-4 h-4' /> },
        { key: "has_non_dairy", label: "Non-Dairy", icon: <MilkOff className='w-4 h-4' /> },
        { key: "has_decaf", label: "Decaf", icon: <Coffee className='w-4 h-4' /> },
        { key: "is_work_friendly", label: "Work Friendly", icon: <Briefcase className='w-4 h-4' /> },
        { key: "is_24_7", label: "24 Hours", icon: <Clock12 className='w-4 h-4' /> },
    ]

    const handleCafeCardClick = useCallback(() => {
        trigger("light")
    }, [trigger])

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

            <MiniSubmitCafeBanner />

            {/* Controls */}
            <div className='flex flex-col gap-3'>
                <div className='flex flex-row gap-2 flex-wrap'>
                    <input
                        type='text'
                        placeholder='Search cafes...'
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onFocus={() => trigger("light")}
                        className='flex-1 min-w-40 px-4 py-2 rounded-lg border border-text/20 bg-transparent focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all text-sm'
                    />
                    <button
                        onClick={() => {
                            trigger(filtersOpen ? "soft" : "medium")
                            setFiltersOpen(!filtersOpen)
                        }}
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
                        onChange={(e) => {
                            trigger("selection")
                            setSortBy(e.target.value as SortOption)
                        }}
                        className='px-3 py-2 rounded-lg border border-text/20 bg-background focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all cursor-pointer text-sm'
                    >
                        <option value='recommended'>Recommended</option>
                        <option value='rating'>Highest Rated</option>
                        <option value='reviews'>Most Reviewed</option>
                    </select>
                    <RandomCafeButton cafes={cafes} />
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

                {/* Expandable Filters */}
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
                                    <span className='text-sm font-semibold'>Filters</span>
                                    {activeFilterCount > 0 && (
                                        <button
                                            onClick={() => {
                                                trigger("soft")
                                                hasUserToggledLocation.current = false
                                                hasAutoEnabledNearMe.current = false
                                                setFilters(INITIAL_FILTERS)
                                            }}
                                            className='text-xs text-text/60 hover:text-text cursor-pointer'
                                        >
                                            Clear all
                                        </button>
                                    )}
                                </div>

                                {/* Price */}
                                <div className='mb-3'>
                                    <span className='text-xs text-text/60 mb-1.5 block'>Price Range</span>
                                    <div className='flex flex-row gap-2'>
                                        {[
                                            { value: "", label: "All" },
                                            { value: "budget", label: "₱ Budget" },
                                            { value: "mid", label: "₱₱ Mid" },
                                            { value: "premium", label: "₱₱₱ Premium" },
                                            { value: "luxury", label: "₱₱₱₱ Luxury" },
                                        ].map(({ value, label }) => (
                                            <button
                                                key={value}
                                                onClick={() =>
                                                    setFilters((prev) => ({
                                                        ...prev,
                                                        price_level: value as "" | "budget" | "mid" | "premium" | "luxury",
                                                    }))
                                                }
                                                className={`px-3 py-1 rounded-full text-xs font-medium transition-all border cursor-pointer ${
                                                    filters.price_level === value
                                                        ? "bg-text text-background border-text"
                                                        : "bg-transparent text-text/70 border-text/20 hover:border-text/50"
                                                }`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Coffee Style */}
                                <div className='mb-3'>
                                    <span className='text-xs text-text/60 mb-1.5 block'>Coffee Style</span>
                                    <div className='flex flex-row gap-2'>
                                        {[
                                            { value: "", label: "All" },
                                            ...COFFEE_STYLES.map((s) => ({ value: s.value, label: s.label })),
                                        ].map(({ value, label }) => (
                                            <button
                                                key={value}
                                                onClick={() =>
                                                    setFilters((prev) => ({
                                                        ...prev,
                                                        coffee_style: value as "" | "classic" | "artisan",
                                                    }))
                                                }
                                                className={`px-3 py-1 rounded-full text-xs font-medium transition-all border cursor-pointer ${
                                                    filters.coffee_style === value
                                                        ? "bg-text text-background border-text"
                                                        : "bg-transparent text-text/70 border-text/20 hover:border-text/50"
                                                }`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Region */}
                                <div className='mb-3'>
                                    <span className='text-xs text-text/60 mb-1.5 block'>Region</span>
                                    <select
                                        value={filters.region}
                                        onChange={(e) =>
                                            setFilters((prev) => ({ ...prev, region: e.target.value }))
                                        }
                                        className='w-full px-3 py-2 rounded-lg border border-text/20 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50 cursor-pointer'
                                    >
                                        <option value=''>All Regions</option>
                                        {PHILIPPINES_LOCATIONS.regions.map((r) => (
                                            <option key={r.name} value={r.name}>
                                                {r.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Amenities */}
                                <div>
                                    <span className='text-xs text-text/60 mb-1.5 block'>Amenities</span>
                                    <div className='flex flex-row flex-wrap gap-2'>
                                        {filterOptions.map(({ key, label, icon }) => (
                                            <button
                                                key={key}
                                                onClick={() => toggleFilter(key as keyof typeof filters)}
                                                className={`flex flex-row items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border cursor-pointer ${
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

                                {/* Vibes */}
                                <div className='mt-3'>
                                    <span className='text-xs text-text/60 mb-1.5 block'>Vibes</span>
                                    <div className='flex flex-row flex-wrap gap-2'>
                                        {CAFE_VIBE_TAGS.map((tag) => {
                                            const isSelected = filters.tags.includes(tag)
                                            return (
                                                <button
                                                    key={tag}
                                                    onClick={() => {
                                                        setFilters((prev) => ({
                                                            ...prev,
                                                            tags: isSelected
                                                                ? prev.tags.filter((t) => t !== tag)
                                                                : [...prev.tags, tag],
                                                        }))
                                                    }}
                                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border cursor-pointer capitalize ${
                                                        isSelected
                                                            ? "bg-text text-background border-text"
                                                            : "bg-transparent text-text/70 border-text/20 hover:border-text/50"
                                                    }`}
                                                >
                                                    #{tag.replace(/_/g, " ")}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Halal */}
                                <div className='mt-3 pt-3 border-t border-text/10'>
                                    <button
                                        onClick={() =>
                                            setFilters((prev) => ({ ...prev, is_halal_certified: !prev.is_halal_certified }))
                                        }
                                        className={`flex flex-row items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all border cursor-pointer ${
                                            filters.is_halal_certified
                                                ? "bg-green-500 text-white border-green-500"
                                                : "bg-transparent text-text/70 border-text/20 hover:border-text/50"
                                        }`}
                                    >
                                        Halal Certified
                                    </button>
                                </div>

                                {/* Chains */}
                                <div className='mt-3 pt-3 border-t border-text/10'>
                                    <button
                                        onClick={() =>
                                            setFilters((prev) => ({ ...prev, include_chains: !prev.include_chains }))
                                        }
                                        className={`flex flex-row items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all border cursor-pointer ${
                                            filters.include_chains
                                                ? "bg-orange-500 text-white border-orange-500"
                                                : "bg-transparent text-text/70 border-text/20 hover:border-text/50"
                                        }`}
                                    >
                                        <Store className='w-4 h-4' />
                                        Show Chain Cafes
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Content */}
            <div id='cafes-list' className='flex flex-col'>
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
                    ) : cafes.length > 0 ? (
                        <>
                            {/* Simple list rendering */}
                            {cafes.map((cafe, index) => (
                                <div key={cafe.id} className='pb-6'>
                                    <CafeCard
                                        cafe={cafe}
                                        animationDelay={index}
                                        onClick={handleCafeCardClick}
                                    />
                                </div>
                            ))}

                            {/* Loading more indicator */}
                            {isLoadingMore && (
                                <div className='py-4 px-6 bg-background/70 border border-text/10 rounded-xl flex flex-col-reverse md:flex-row gap-4 md:gap-0'>
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
                            )}

                            {/* Sentinel for infinite scroll */}
                            <div ref={sentinelRef} className='h-4' />

                            {/* Load error */}
                            {loadError && !isLoadingMore && (
                                <div className='flex flex-col items-center justify-center py-8 gap-3'>
                                    <p className='text-sm text-text/60'>Failed to load more cafes</p>
                                    <button
                                        onClick={() => {
                                            setLoadError(false)
                                            setHasMore(true)
                                            loadMore()
                                        }}
                                        className='text-sm text-accent hover:underline'
                                    >
                                        Try again
                                    </button>
                                </div>
                            )}

                            {/* End of list */}
                            {!hasMore && cafes.length > 0 && !isLoadingMore && (
                                <p className='text-center text-text/40 py-4 text-sm'>
                                    You have reached the end
                                </p>
                            )}
                        </>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className='flex flex-col items-center justify-center py-20 text-center gap-2'
                        >
                            <p className='text-xl font-serif font-medium'>No cafes found</p>
                            <p className='text-text/50'>Try adjusting your filters or search terms.</p>
                            <button
                                onClick={() => {
                                    setSearch("")
                                    hasUserToggledLocation.current = false
                                    hasAutoEnabledNearMe.current = false
                                    setFilters(INITIAL_FILTERS)
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