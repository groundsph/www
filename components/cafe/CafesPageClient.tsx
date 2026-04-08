"use client"

import { useHaptics } from "@/hooks/useHaptics"
import { isOpenNow } from "@/utils/extras"
import { AnimatePresence, motion } from "motion/react"
import { useVirtualizer } from "@tanstack/react-virtual"
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
    X,
} from "lucide-react"

import { getAllCafes } from "@/app/api/actions/cafe"
import { CafeWithRatings } from "@/utils/types/extra"
import {
    PHILIPPINES_LOCATIONS,
    COFFEE_STYLES,
    CAFE_VIBE_TAGS,
} from "@/utils/data/philippines"
import { useCallback, useEffect, useState, useTransition, useRef } from "react"
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
    price_level: "" as "" | "low" | "medium" | "high",
    coffee_style: "" as "" | "classic" | "artisan",
    region: "",
    near_me: false,
    tags: [] as string[],
    include_chains: false,
    is_halal_certified: false,
}

type SortOption = "recommended" | "rating" | "reviews"

const buildFilterParams = (search: string, filters: typeof INITIAL_FILTERS, sortBy: SortOption) => ({
    search,
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
    tags: filters.tags.length > 0 ? filters.tags : undefined,
    sortBy,
    include_chains: filters.include_chains || undefined,
})

const SESSION_STORAGE_SCROLL_POSITION_KEY = "cafes_scroll_position"
const SESSION_STORAGE_TTL_MS = 10 * 60 * 1000
const RESTORE_NOTICE_TIMEOUT_MS = 2500
const SCROLL_RESTORATION_DELAY_MS = 400
const SCROLL_RESTORATION_RETRY_INTERVAL_MS = 100
const SCROLL_RESTORATION_MAX_RETRIES = 20
const IS_SCROLL_RESTORE_ENABLED = false

export default function CafesPageClient() {
    const { trigger } = useHaptics()

    // States
    const [cafes, setCafes] = useState<CafeWithRatings[]>([])
    const [loading, setLoading] = useState(true)
    const [currentPage, setCurrentPage] = useState(1)
    const [hasMore, setHasMore] = useState(true)
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [filtersOpen, setFiltersOpen] = useState(false)
    const [showRestoreNotice, setShowRestoreNotice] = useState(false)
    const [isRestoring, setIsRestoring] = useState(false)
    const [loadError, setLoadError] = useState(false)
    const restoreNoticeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const fetchVersionRef = useRef(0)

    const dismissRestoreNotice = useCallback(() => {
        if (restoreNoticeTimeoutRef.current) {
            clearTimeout(restoreNoticeTimeoutRef.current)
            restoreNoticeTimeoutRef.current = null
        }
        setShowRestoreNotice(false)
    }, [])

    useEffect(() => {
        if (showRestoreNotice) {
            restoreNoticeTimeoutRef.current = setTimeout(() => {
                setShowRestoreNotice(false)
            }, RESTORE_NOTICE_TIMEOUT_MS)
        }
        return () => {
            if (restoreNoticeTimeoutRef.current) {
                clearTimeout(restoreNoticeTimeoutRef.current)
            }
        }
    }, [showRestoreNotice])

    // Track if user has manually toggled location filter
    const hasUserToggledLocation = useRef(false)
    const autoDisabledNearMe = useRef(false)
    const restoreAppliedRef = useRef(false)
    const scrollSentinelRef = useRef<HTMLDivElement>(null)
    const parentRef = useRef<HTMLDivElement>(null)

    // Location State
    const [userLocation, setUserLocation] = useState<{
        city?: string
        region?: string
    } | null>(null)

    const [search, setSearch] = useState("")
    const debouncedSearch = useDebounce(search, 300)
    const [sortBy, setSortBy] = useState<SortOption>("recommended")
    const [filters, setFilters] = useState(INITIAL_FILTERS)

    const getFilterParams = useCallback(() => buildFilterParams(debouncedSearch, filters, sortBy), [debouncedSearch, filters, sortBy])

    // Location Detection - reuse cache from landing page
    useEffect(() => {
        // Check sessionStorage cache first (set by landing page)
        const cachedLocation = sessionStorage.getItem("grounds_location")
        if (cachedLocation) {
            try {
                const { city, region } = JSON.parse(cachedLocation)
                if (city || region) {
                    setUserLocation({ city, region })
                    // Auto-enable near_me filter if user hasn't manually toggled it
                    if (!hasUserToggledLocation.current) {
                        setFilters((prev) => ({ ...prev, near_me: true }))
                    }
                    return
                }
            } catch {
                // Invalid cache, proceed with fresh fetch
            }
        }

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
                        // Auto-enable near_me filter if user hasn't manually toggled it
                        if (!hasUserToggledLocation.current) {
                            setFilters((prev) => ({ ...prev, near_me: true }))
                        }
                    }
                } catch (error) {
                    console.error("Failed to get location:", error)
                }
            },
            () => console.log("Location access denied"),
            { timeout: 10000, maximumAge: 300000 }
        )
    }, [])

    const doInitialFetch = useCallback(async (page: number, filterParams?: ReturnType<typeof getFilterParams>) => {
        try {
            const params = filterParams || getFilterParams()
            const fetchedCafes = await getAllCafes(page, PAGE_SIZE, params)
            setCafes(fetchedCafes)
            setLoading(false)
            setHasMore(fetchedCafes.length === PAGE_SIZE)
        } catch (error) {
            console.error("Failed to fetch cafes:", error)
            setLoading(false)
        }
    }, [getFilterParams])

    const restoreFromSession = useCallback(async () => {
        if (!IS_SCROLL_RESTORE_ENABLED) {
            doInitialFetch(1)
            return
        }
        if (typeof window === "undefined") return

        try {
            const storedData = sessionStorage.getItem(SESSION_STORAGE_SCROLL_POSITION_KEY)
            if (!storedData) {
                doInitialFetch(1)
                return
            }

            const parsedData = JSON.parse(storedData)
            const {
                page,
                filters: storedFilters,
                search: storedSearch,
                sortBy: storedSortBy,
                timestamp,
                cafeSlug,
            } = parsedData

            const isRecent = Date.now() - timestamp < SESSION_STORAGE_TTL_MS

            if (!isRecent) {
                sessionStorage.removeItem(SESSION_STORAGE_SCROLL_POSITION_KEY)
                doInitialFetch(1)
                return
            }

            const restoredFilterParams = buildFilterParams(storedSearch, storedFilters, storedSortBy)

            // Set restoring state BEFORE state updates to prevent filter useEffect from running
            setIsRestoring(true)
            
            setFilters(storedFilters)
            setSearch(storedSearch)
            setSortBy(storedSortBy)
            setCurrentPage(page)
            restoreAppliedRef.current = true

            // Fetch all pages from 1 to the restored page so scroll position is accurate
            const allCafes = []
            for (let i = 1; i <= page; i++) {
                const pageCafes = await getAllCafes(i, PAGE_SIZE, restoredFilterParams)
                allCafes.push(...pageCafes)
                if (pageCafes.length < PAGE_SIZE) break // Last page has fewer items
            }
            setCafes(allCafes)
            setLoading(false)
            setHasMore(allCafes.length === page * PAGE_SIZE)

            setShowRestoreNotice(true)
            setTimeout(() => {
                if (typeof window !== "undefined" && cafeSlug) {
                    let attempts = 0
                    const scrollToCafe = () => {
                        const cafeElement = document.querySelector(
                            `[data-cafe-slug="${cafeSlug}"]`
                        )
                        if (cafeElement) {
                            cafeElement.scrollIntoView({
                                behavior: "auto",
                                block: "center",
                            })
                            return
                        }
                        attempts += 1
                        if (attempts < SCROLL_RESTORATION_MAX_RETRIES) {
                            setTimeout(
                                scrollToCafe,
                                SCROLL_RESTORATION_RETRY_INTERVAL_MS
                            )
                        }
                    }
                    scrollToCafe()
                }
                sessionStorage.removeItem(SESSION_STORAGE_SCROLL_POSITION_KEY)
                // Reset restoring state so filter changes work normally
                setIsRestoring(false)
            }, SCROLL_RESTORATION_DELAY_MS)
        } catch (error) {
            console.error("Failed to restore from session:", error)
            doInitialFetch(1)
        }
    }, [doInitialFetch])

    useEffect(() => {
        if (!restoreAppliedRef.current) {
            restoreFromSession()
        }
    }, [restoreFromSession])

    // Filter Logic - reset pagination and fetch page 1 on filter changes
    // Skip if restoration is in progress to avoid race conditions
    useEffect(() => {
        if (isRestoring) return

        fetchVersionRef.current += 1
        const version = fetchVersionRef.current

        startTransition(async () => {
            setCurrentPage(1)
            setHasMore(true)
            setLoadError(false)
            setCafes([])

            if (typeof window !== "undefined" && sessionStorage.getItem(SESSION_STORAGE_SCROLL_POSITION_KEY)) {
                sessionStorage.removeItem(SESSION_STORAGE_SCROLL_POSITION_KEY)
            }

            try {
                const fetchedCafes = await getAllCafes(1, PAGE_SIZE, getFilterParams())
                if (version !== fetchVersionRef.current) return // Stale fetch, discard
                setCafes(fetchedCafes)
                setLoading(false)
                setHasMore(fetchedCafes.length === PAGE_SIZE)
            } catch (error) {
                if (version !== fetchVersionRef.current) return
                console.error("Failed to fetch cafes:", error)
                setLoading(false)
            }
        })
    }, [debouncedSearch, sortBy, filters, getFilterParams, isRestoring])

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

    // Virtualizer setup for cafe list
    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual returns functions that cannot be memoized
    const virtualizer = useVirtualizer({
        count: filteredCafes.length + (hasMore ? 1 : 0), // +1 for loading sentinel
        getScrollElement: () => parentRef.current,
        estimateSize: () => 280, // estimated cafe card height in px
        overscan: 5,
    })

    // Auto-disable near_me filter if no results and user hasn't manually toggled it
    useEffect(() => {
        if (
            filters.near_me &&
            filteredCafes.length === 0 &&
            cafes.length > 0 &&
            !hasUserToggledLocation.current &&
            !autoDisabledNearMe.current
        ) {
            autoDisabledNearMe.current = true
            setFilters((prev) => ({ ...prev, near_me: false }))
        }
        // Reset the guard when near_me is turned off manually
        if (!filters.near_me) {
            autoDisabledNearMe.current = false
        }
    }, [filteredCafes.length, cafes.length, filters.near_me])

    // Load more cafes (used by infinite scroll and retry button)
    const loadMore = useCallback(() => {
        if (isLoadingMore || !hasMore) return
        trigger("light")
        const nextPage = currentPage + 1
        setCurrentPage(nextPage)
        setIsLoadingMore(true)

        const version = fetchVersionRef.current

        getAllCafes(nextPage, PAGE_SIZE, getFilterParams())
            .then((fetchedCafes) => {
                if (version !== fetchVersionRef.current) return
                setCafes((prev) => [...prev, ...fetchedCafes])
                setHasMore(fetchedCafes.length === PAGE_SIZE)
            })
            .catch((error) => {
                if (version !== fetchVersionRef.current) return
                console.error("Failed to fetch more cafes:", error)
                setLoadError(true)
                setHasMore(false)
            })
            .finally(() => {
                if (version === fetchVersionRef.current) {
                    setIsLoadingMore(false)
                }
            })
    }, [currentPage, getFilterParams, hasMore, isLoadingMore, trigger])

    // Virtualizer-driven infinite scroll - trigger when last item is visible
    const lastItem = virtualizer.getVirtualItems().at(-1)
    useEffect(() => {
        if (
            lastItem &&
            lastItem.index >= filteredCafes.length - 1 &&
            hasMore &&
            !isLoadingMore
        ) {
            loadMore()
        }
    }, [lastItem, lastItem?.index, filteredCafes.length, hasMore, isLoadingMore, loadMore])

    const toggleFilter = (key: keyof typeof filters) => {
        trigger("selection")
        if (key === "near_me") {
            hasUserToggledLocation.current = true
        }
        setFilters((prev) => ({ ...prev, [key]: !prev[key] }))
    }

    const handleCafeClick = useCallback(
        (cafeSlug: string) => {
            if (!IS_SCROLL_RESTORE_ENABLED) return
            if (typeof window !== "undefined") {
                try {
                    sessionStorage.setItem(
                        SESSION_STORAGE_SCROLL_POSITION_KEY,
                        JSON.stringify({
                            page: currentPage,
                            scrollY: window.scrollY,
                            filters: filters,
                            search: search,
                            sortBy: sortBy,
                            timestamp: Date.now(),
                            cafeSlug: cafeSlug,
                        })
                    )
                } catch {
                    // Silently fail - sessionStorage may be unavailable or quota exceeded
                    // Non-critical feature, safe to ignore errors
                }
            }
        },
        [currentPage, filters, search, sortBy]
    )

    // Memoized handler to prevent unnecessary re-renders of CafeCard
    const handleCafeCardClick = useCallback(
        (cafeSlug: string) => {
            trigger("light")
            handleCafeClick(cafeSlug)
        },
        [trigger, handleCafeClick]
    )

    // Count active filters (excluding empty values)
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
        {
            key: "has_smoking",
            label: "Smoking Area",
            icon: <Cigarette className='w-4 h-4' />,
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
            key: "has_decaf",
            label: "Decaf",
            icon: <Coffee className='w-4 h-4' />,
        },
        {
            key: "is_work_friendly",
            label: "Work Friendly",
            icon: <Briefcase className='w-4 h-4' />,
        },
        {
            key: "is_24_7",
            label: "24 Hours",
            icon: <Clock12 className='w-4 h-4' />,
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

            {/* Restore notice */}
            <AnimatePresence>
                {showRestoreNotice && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className='fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-secondary/10 backdrop-blur-sm border border-secondary/20 text-secondary px-4 py-2.5 rounded-lg shadow-lg text-sm'
                    >
                        <Clock12 size={16} />
                        <span className='font-medium'>Resuming from where you left off</span>
                        <button
                            onClick={dismissRestoreNotice}
                            className='p-1 hover:bg-secondary/20 rounded-md transition-colors'
                            aria-label='Dismiss notification'
                        >
                            <X size={14} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <MiniSubmitCafeBanner />

            {/* Controls - Compact Row */}
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
                    {/* Random Cafe Button */}
                    <RandomCafeButton cafes={cafes} />
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
                                                trigger("soft")
                                                hasUserToggledLocation.current = false
                                                setFilters(INITIAL_FILTERS)
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

                                {/* Vibe Tags Filter */}
                                <div className='mt-3'>
                                    <span className='text-xs text-text/60 mb-1.5 block'>
                                        Vibes
                                    </span>
                                    <div className='flex flex-row flex-wrap gap-2'>
                                        {CAFE_VIBE_TAGS.map((tag) => {
                                            const isSelected =
                                                filters.tags.includes(tag)
                                            return (
                                                <button
                                                    key={tag}
                                                    onClick={() => {
                                                        setFilters((prev) => ({
                                                            ...prev,
                                                            tags: isSelected
                                                                ? prev.tags.filter(
                                                                      (t) =>
                                                                          t !==
                                                                          tag
                                                                  )
                                                                : [
                                                                      ...prev.tags,
                                                                      tag,
                                                                  ],
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

                                {/* Halal Certified Filter */}
                                <div className='mt-3 pt-3 border-t border-text/10'>
                                    <button
                                        onClick={() =>
                                            setFilters((prev) => ({
                                                ...prev,
                                                is_halal_certified:
                                                    !prev.is_halal_certified,
                                            }))
                                        }
                                        className={`flex flex-row items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all border cursor-pointer ${
                                            filters.is_halal_certified
                                                ? "bg-green-500 text-white border-green-500"
                                                : "bg-transparent text-text/70 border-text/20 hover:border-text/50"
                                        }`}
                                    >
                                        Halal Certified
                                    </button>
                                    <p className='text-[10px] text-text/40 mt-1.5'>
                                        Show only Halal certified cafes
                                    </p>
                                </div>

                                {/* Show Chain Cafes Toggle */}
                                <div className='mt-3 pt-3 border-t border-text/10'>
                                    <button
                                        onClick={() =>
                                            setFilters((prev) => ({
                                                ...prev,
                                                include_chains:
                                                    !prev.include_chains,
                                            }))
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
                                    <p className='text-[10px] text-text/40 mt-1.5'>
                                        Chain cafes (e.g., Starbucks) are hidden
                                        by default
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Content */}
            <div
                ref={parentRef}
                className={`flex flex-1 flex-col gap-6 transition-opacity duration-300 overflow-auto ${
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
                        <div
                            style={{
                                height: `${virtualizer.getTotalSize()}px`,
                                width: "100%",
                                position: "relative",
                            }}
                        >
                            {virtualizer.getVirtualItems().map((virtualItem) => {
                                // Check if this is the loading sentinel item
                                if (virtualItem.index >= filteredCafes.length) {
                                    return (
                                        <div
                                            key={virtualItem.key}
                                            ref={virtualizer.measureElement}
                                            data-index={virtualItem.index}
                                            style={{
                                                position: "absolute",
                                                top: 0,
                                                left: 0,
                                                width: "100%",
                                                transform: `translateY(${virtualItem.start}px)`,
                                            }}
                                        >
                                            {loadError ? (
                                                <div className='flex flex-col items-center justify-center py-8 gap-3'>
                                                    <p className='text-sm text-text/60'>Failed to load more cafes</p>
                                                    <button
                                                        onClick={() => {
                                                            setLoadError(false)
                                                            setHasMore(true)
                                                            setIsLoadingMore(false)
                                                            loadMore()
                                                        }}
                                                        className='text-sm text-accent hover:underline'
                                                    >
                                                        Try again
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    {/* Loading more indicator */}
                                                    {(isLoadingMore || hasMore) && (
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
                                                    {/* Scroll sentinel for infinite scroll */}
                                                    {hasMore && (
                                                        <div ref={scrollSentinelRef} className='h-1' />
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )
                                }

                                const cafe = filteredCafes[virtualItem.index]
                                return (
                                    <div
                                        key={cafe.id}
                                        ref={virtualizer.measureElement}
                                        data-index={virtualItem.index}
                                        style={{
                                            position: "absolute",
                                            top: 0,
                                            left: 0,
                                            width: "100%",
                                            transform: `translateY(${virtualItem.start}px)`,
                                            paddingBottom: "24px", // gap-6 equivalent
                                        }}
                                    >
                                        <CafeCard
                                            cafe={cafe}
                                            animationDelay={virtualItem.index}
                                            onClick={() => handleCafeCardClick(cafe.slug)}
                                        />
                                    </div>
                                )
                            })}
                        </div>
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
