"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import {
    Check,
    X,
    MapPin,
    Wifi,
    Plug,
    Car,
    Snowflake,
    PawPrint,
    Sun,
    Utensils,
    Briefcase,
    ExternalLink,
    ChevronDown,
    ChevronUp,
    AlertCircle,
    Eye,
    FileText,
    Globe,
    EyeOff,
    Search,
    Filter,
    ArrowUpDown,
    Loader2,
    Pencil,
    Store,
    Armchair,
    Toilet,
    Droplet,
    MilkOff,
} from "lucide-react"
import {
    approveCafe,
    rejectCafe,
    unpublishCafe,
    getPaginatedCafes,
    type CafeFilterOptions,
} from "@/app/api/actions/admin"
import {
    approveSuggestion,
    rejectSuggestion,
} from "@/app/api/actions/suggestions"
import { approveClaim, rejectClaim, CafeClaim } from "@/app/api/actions/claim"
import { EditSuggestion } from "@/utils/types/suggestions"
import { getCafeThumbnailUrl } from "@/utils/extras"
import { CafeWithRatings } from "@/utils/types/extra"
import ImageLightbox from "@/components/ImageLightbox"

interface CafesManagementProps {
    userRole: "admin" | "moderator"
    initialPendingCafes: CafeWithRatings[]
    initialPublishedCafes: CafeWithRatings[]
    pendingTotal: number
    publishedTotal: number
    pendingHasMore: boolean
    publishedHasMore: boolean
    filterOptions: CafeFilterOptions
    suggestions: EditSuggestion[]
    pendingClaims?: CafeClaim[]
}

type TabType = "pending" | "published" | "suggestions" | "claims"

export default function CafesManagement({
    initialPendingCafes,
    initialPublishedCafes,
    pendingTotal: initialPendingTotal,
    publishedTotal: initialPublishedTotal,
    pendingHasMore: initialPendingHasMore,
    publishedHasMore: initialPublishedHasMore,
    filterOptions,
    suggestions: initialSuggestions,
    pendingClaims: initialClaims = [],
}: CafesManagementProps) {
    const [activeTab, setActiveTab] = useState<TabType>("pending")

    // Cafe pagination state
    const [pendingCafes, setPendingCafes] = useState(initialPendingCafes)
    const [publishedCafes, setPublishedCafes] = useState(initialPublishedCafes)
    const [pendingTotal, setPendingTotal] = useState(initialPendingTotal)
    const [publishedTotal, setPublishedTotal] = useState(initialPublishedTotal)
    const [pendingHasMore, setPendingHasMore] = useState(initialPendingHasMore)
    const [publishedHasMore, setPublishedHasMore] = useState(
        initialPublishedHasMore
    )
    const [pendingPage, setPendingPage] = useState(1)
    const [publishedPage, setPublishedPage] = useState(1)
    const [loadingMore, setLoadingMore] = useState(false)
    const [isFiltering, setIsFiltering] = useState(false)

    const [suggestions, setSuggestions] = useState(initialSuggestions)
    const [claims, setClaims] = useState<CafeClaim[]>(initialClaims)
    const [expandedCafe, setExpandedCafe] = useState<string | null>(null)
    const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(
        null
    )
    const [expandedClaim, setExpandedClaim] = useState<string | null>(null)
    const [processing, setProcessing] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [provinceFilter, setProvinceFilter] = useState<string>("")
    const [cityFilter, setCityFilter] = useState<string>("")
    const [sortBy, setSortBy] = useState<"name" | "date" | "city" | "province">(
        "name"
    )

    // Image lightbox state
    const [suggestionLightboxImages, setSuggestionLightboxImages] = useState<
        string[]
    >([])
    const [suggestionLightboxIndex, setSuggestionLightboxIndex] = useState(0)
    const [showSuggestionLightbox, setShowSuggestionLightbox] = useState(false)

    const openSuggestionLightbox = (images: string[], index: number = 0) => {
        setSuggestionLightboxImages(images)
        setSuggestionLightboxIndex(index)
        setShowSuggestionLightbox(true)
    }

    const AMENITY_ICONS = {
        has_wifi: { icon: Wifi, label: "WiFi" },
        has_sockets: { icon: Plug, label: "Power Outlets" },
        has_parking: { icon: Car, label: "Parking" },
        has_aircon: { icon: Snowflake, label: "Air Conditioning" },
        is_pet_friendly: { icon: PawPrint, label: "Pet Friendly" },
        has_outdoor_seating: { icon: Sun, label: "Outdoor Seating" },
        has_indoor_seating: { icon: Armchair, label: "Indoor Seating" },
        has_restroom: { icon: Toilet, label: "Restroom" },
        has_bidet: { icon: Droplet, label: "Bidet" },
        has_non_dairy: { icon: MilkOff, label: "Non-Dairy Milk" },
        serves_food: { icon: Utensils, label: "Serves Food" },
        is_work_friendly: { icon: Briefcase, label: "Work Friendly" },
    }

    // Get provinces from filter options
    const provinces = filterOptions.provinces

    // Get cities for the selected province from filter options
    const cities = useMemo(() => {
        if (!provinceFilter) return []
        const provinceData = filterOptions.cities.find(
            (c) => c.province === provinceFilter
        )
        return provinceData?.cities || []
    }, [filterOptions.cities, provinceFilter])

    // Fetch cafes with current filters (server-side)
    const fetchCafes = async (
        isPublished: boolean,
        page: number,
        append: boolean = false
    ) => {
        const result = await getPaginatedCafes({
            isPublished,
            page,
            pageSize: 25,
            province: provinceFilter || undefined,
            city: cityFilter || undefined,
            search: searchQuery || undefined,
            sortBy,
        })

        if (isPublished) {
            setPublishedCafes(
                append ? [...publishedCafes, ...result.cafes] : result.cafes
            )
            setPublishedTotal(result.total)
            setPublishedHasMore(result.hasMore)
            setPublishedPage(page)
        } else {
            setPendingCafes(
                append ? [...pendingCafes, ...result.cafes] : result.cafes
            )
            setPendingTotal(result.total)
            setPendingHasMore(result.hasMore)
            setPendingPage(page)
        }
    }

    // Handle filter/sort changes - refetch from server
    const applyFilters = async () => {
        setIsFiltering(true)
        const isPublished = activeTab === "published"
        await fetchCafes(isPublished, 1, false)
        setIsFiltering(false)
    }

    // Reset city filter when province changes
    const handleProvinceChange = async (province: string) => {
        setProvinceFilter(province)
        setCityFilter("")
    }

    // Load more cafes
    const loadMore = async () => {
        if (loadingMore) return
        setLoadingMore(true)

        const isPublished = activeTab === "published"
        const currentPage = isPublished ? publishedPage : pendingPage
        await fetchCafes(isPublished, currentPage + 1, true)

        setLoadingMore(false)
    }

    // Debounced search effect
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        // Clear previous timeout
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current)
        }

        // Debounce search by 500ms
        searchTimeoutRef.current = setTimeout(() => {
            if (activeTab === "pending" || activeTab === "published") {
                applyFilters()
            }
        }, 500)

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery])

    // Apply filters when province, city, or sortBy changes
    useEffect(() => {
        if (activeTab === "pending" || activeTab === "published") {
            applyFilters()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [provinceFilter, cityFilter, sortBy, activeTab])

    // Current cafes for display
    const currentCafes = activeTab === "pending" ? pendingCafes : publishedCafes
    const currentTotal = activeTab === "pending" ? pendingTotal : publishedTotal
    const currentHasMore =
        activeTab === "pending" ? pendingHasMore : publishedHasMore

    const handleApprove = async (cafeId: string) => {
        setProcessing(cafeId)
        const result = await approveCafe(cafeId)
        if (result.success) {
            const cafe = pendingCafes.find((c) => c.id === cafeId)
            if (cafe) {
                setPendingCafes((prev) => prev.filter((c) => c.id !== cafeId))
                setPublishedCafes((prev) => [
                    ...prev,
                    { ...cafe, is_published: true },
                ])
            }
        } else {
            alert(result.error || "Failed to approve cafe")
        }
        setProcessing(null)
    }

    const handleReject = async (cafeId: string) => {
        if (
            !confirm(
                "Are you sure you want to reject and delete this cafe submission?"
            )
        ) {
            return
        }
        setProcessing(cafeId)
        const result = await rejectCafe(cafeId)
        if (result.success) {
            setPendingCafes((prev) => prev.filter((c) => c.id !== cafeId))
        } else {
            alert(result.error || "Failed to reject cafe")
        }
        setProcessing(null)
    }

    const handleUnpublish = async (cafeId: string) => {
        if (
            !confirm(
                "Are you sure you want to unpublish this cafe? It will be moved back to pending."
            )
        ) {
            return
        }
        setProcessing(cafeId)
        const result = await unpublishCafe(cafeId)
        if (result.success) {
            const cafe = publishedCafes.find((c) => c.id === cafeId)
            if (cafe) {
                setPublishedCafes((prev) => prev.filter((c) => c.id !== cafeId))
                setPendingCafes((prev) => [
                    ...prev,
                    { ...cafe, is_published: false },
                ])
            }
        } else {
            alert(result.error || "Failed to unpublish cafe")
        }
        setProcessing(null)
    }

    const handleApproveSuggestion = async (suggestionId: string) => {
        setProcessing(suggestionId)
        const result = await approveSuggestion(suggestionId)
        if (result.success) {
            setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId))
        } else {
            alert(result.error || "Failed to approve suggestion")
        }
        setProcessing(null)
    }

    const handleRejectSuggestion = async (suggestionId: string) => {
        if (!confirm("Are you sure you want to reject this suggestion?")) {
            return
        }
        setProcessing(suggestionId)
        const result = await rejectSuggestion(suggestionId)
        if (result.success) {
            setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId))
        } else {
            alert(result.error || "Failed to reject suggestion")
        }
        setProcessing(null)
    }

    const handleApproveClaim = async (claimId: string) => {
        setProcessing(claimId)
        const result = await approveClaim(claimId)
        if (result.success) {
            setClaims((prev) => prev.filter((c) => c.id !== claimId))
        } else {
            alert(result.error || "Failed to approve claim")
        }
        setProcessing(null)
    }

    const handleRejectClaim = async (claimId: string) => {
        if (!confirm("Are you sure you want to reject this ownership claim?")) {
            return
        }
        setProcessing(claimId)
        const result = await rejectClaim(claimId)
        if (result.success) {
            setClaims((prev) => prev.filter((c) => c.id !== claimId))
        } else {
            alert(result.error || "Failed to reject claim")
        }
        setProcessing(null)
    }

    const toggleExpand = (cafeId: string) => {
        setExpandedCafe((prev) => (prev === cafeId ? null : cafeId))
    }

    return (
        <div className='space-y-6'>
            {/* Header */}
            <div>
                <h1 className='text-2xl md:text-3xl font-bold text-text'>
                    Cafes Management
                </h1>
                <p className='text-text/60 mt-1'>
                    Review submissions, suggestions, and ownership claims.
                </p>
            </div>

            {/* Stats */}
            <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                <div className='bg-background rounded-xl p-4 shadow-sm border border-tertiary/50'>
                    <div className='text-2xl font-bold'>{pendingTotal}</div>
                    <div className='text-text/60 text-sm'>Pending</div>
                </div>
                <div className='bg-background rounded-xl p-4 shadow-sm border border-tertiary/50'>
                    <div className='text-2xl font-bold'>{publishedTotal}</div>
                    <div className='text-text/60 text-sm'>Published</div>
                </div>
                <div className='bg-background rounded-xl p-4 shadow-sm border border-tertiary/50'>
                    <div className='text-2xl font-bold'>
                        {suggestions.length}
                    </div>
                    <div className='text-text/60 text-sm'>Suggestions</div>
                </div>
                <div className='bg-background rounded-xl p-4 shadow-sm border border-tertiary/50'>
                    <div className='text-2xl font-bold'>{claims.length}</div>
                    <div className='text-text/60 text-sm'>Claims</div>
                </div>
            </div>

            {/* Tabs */}
            <div className='flex gap-2 overflow-x-auto py-1'>
                <button
                    onClick={() => setActiveTab("pending")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition text-sm font-medium ${
                        activeTab === "pending"
                            ? "bg-primary text-white"
                            : "bg-tertiary/30 text-text/70 hover:bg-tertiary"
                    }`}
                >
                    <FileText className='w-4 h-4' />
                    Pending ({pendingCafes.length})
                </button>
                <button
                    onClick={() => setActiveTab("published")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition text-sm font-medium ${
                        activeTab === "published"
                            ? "bg-primary text-white"
                            : "bg-tertiary/30 text-text/70 hover:bg-tertiary"
                    }`}
                >
                    <Globe className='w-4 h-4' />
                    Published ({publishedCafes.length})
                </button>
                <button
                    onClick={() => setActiveTab("suggestions")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition text-sm font-medium ${
                        activeTab === "suggestions"
                            ? "bg-primary text-white"
                            : suggestions.length > 0
                              ? "bg-amber-500/20 text-amber-700 hover:bg-amber-500/30"
                              : "bg-tertiary/30 text-text/70 hover:bg-tertiary"
                    }`}
                >
                    <Pencil className='w-4 h-4' />
                    Suggestions ({suggestions.length})
                </button>
                <button
                    onClick={() => setActiveTab("claims")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition text-sm font-medium ${
                        activeTab === "claims"
                            ? "bg-primary text-white"
                            : claims.length > 0
                              ? "bg-purple-500/20 text-purple-700 hover:bg-purple-500/30"
                              : "bg-tertiary/30 text-text/70 hover:bg-tertiary"
                    }`}
                >
                    <Store className='w-4 h-4' />
                    Claims ({claims.length})
                </button>
            </div>

            {/* Search and Filter - only for cafe tabs */}
            {(activeTab === "pending" || activeTab === "published") && (
                <div className='space-y-3'>
                    {/* Search bar */}
                    <div className='relative'>
                        <Search className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text/40' />
                        <input
                            type='text'
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder='Search cafes by name, city, or address...'
                            className='w-full pl-12 pr-4 py-3 bg-background shadow-sm border border-tertiary/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:shadow-md transition-all'
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className='absolute right-4 top-1/2 -translate-y-1/2 text-text/40 hover:text-text/60'
                            >
                                <X className='w-4 h-4' />
                            </button>
                        )}
                    </div>

                    {/* Filters row */}
                    <div className='flex gap-3 flex-wrap'>
                        {/* Province filter */}
                        <div className='relative'>
                            <Filter className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40' />
                            <select
                                value={provinceFilter}
                                onChange={(e) =>
                                    handleProvinceChange(e.target.value)
                                }
                                className='appearance-none pl-9 pr-8 py-2 bg-background shadow-sm border border-tertiary/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer text-sm transition-all'
                            >
                                <option value=''>All Provinces</option>
                                {provinces.map((province) => (
                                    <option
                                        key={province}
                                        value={province}
                                    >
                                        {province}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className='absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40 pointer-events-none' />
                        </div>

                        {/* City filter */}
                        {provinceFilter && cities.length > 0 && (
                            <div className='relative'>
                                <MapPin className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40' />
                                <select
                                    value={cityFilter}
                                    onChange={(e) =>
                                        setCityFilter(e.target.value)
                                    }
                                    className='appearance-none pl-9 pr-8 py-2 bg-background shadow-sm border border-tertiary/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer text-sm'
                                >
                                    <option value=''>All Cities</option>
                                    {cities.map((city) => (
                                        <option
                                            key={city}
                                            value={city}
                                        >
                                            {city}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className='absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40 pointer-events-none' />
                            </div>
                        )}

                        <div className='flex-1' />

                        {/* Sort dropdown */}
                        <div className='relative'>
                            <ArrowUpDown className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40' />
                            <select
                                value={sortBy}
                                onChange={(e) =>
                                    setSortBy(e.target.value as typeof sortBy)
                                }
                                className='appearance-none pl-9 pr-8 py-2 bg-background shadow-sm border border-tertiary/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer text-sm'
                            >
                                <option value='name'>Sort by Name</option>
                                <option value='date'>Sort by Date</option>
                                <option value='city'>Sort by City</option>
                                <option value='province'>
                                    Sort by Province
                                </option>
                            </select>
                            <ChevronDown className='absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40 pointer-events-none' />
                        </div>

                        {/* Clear filters */}
                        {(provinceFilter || cityFilter) && (
                            <button
                                onClick={() => {
                                    setProvinceFilter("")
                                    setCityFilter("")
                                }}
                                className='px-3 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition flex items-center gap-1'
                            >
                                <X className='w-4 h-4' />
                                Clear
                            </button>
                        )}
                    </div>

                    {/* Results count */}
                    <div className='text-sm text-text/50'>
                        {isFiltering ? (
                            <span className='flex items-center gap-2'>
                                <Loader2 className='w-4 h-4 animate-spin' />
                                Loading...
                            </span>
                        ) : (
                            <>
                                Showing {currentCafes.length} of {currentTotal}{" "}
                                cafes
                                {provinceFilter && ` in ${provinceFilter}`}
                                {cityFilter && `, ${cityFilter}`}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Cafe List */}
            {(activeTab === "pending" || activeTab === "published") && (
                <>
                    {currentCafes.length === 0 ? (
                        <div className='text-center py-16 bg-background rounded-xl shadow-sm border border-tertiary/50'>
                            <AlertCircle className='w-12 h-12 mx-auto text-text/30 mb-4' />
                            <p className='text-text/60 text-lg'>
                                {searchQuery
                                    ? `No cafes found for "${searchQuery}"`
                                    : activeTab === "pending"
                                      ? "No pending submissions"
                                      : "No published cafes"}
                            </p>
                        </div>
                    ) : (
                        <div className='space-y-3'>
                            {currentCafes.map((cafe) => {
                                const isExpanded = expandedCafe === cafe.id
                                const isProcessingThis = processing === cafe.id

                                return (
                                    <div
                                        key={cafe.id}
                                        className='bg-background shadow-sm border border-tertiary/50 rounded-xl overflow-hidden hover:shadow-md transition-shadow'
                                    >
                                        {/* Main Row */}
                                        <div className='p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4'>
                                            {/* Thumbnail */}
                                            <div className='relative w-full sm:w-20 h-32 sm:h-20 shrink-0 rounded-lg overflow-hidden'>
                                                {cafe.thumbnail ? (
                                                    <Image
                                                        src={getCafeThumbnailUrl(
                                                            cafe.thumbnail
                                                        )}
                                                        alt={cafe.name}
                                                        fill
                                                        className='object-cover'
                                                    />
                                                ) : (
                                                    <div className='w-full h-full bg-tertiary/30 flex items-center justify-center'>
                                                        <MapPin className='w-6 h-6 text-text/30' />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Info */}
                                            <div className='flex-1 min-w-0'>
                                                <h3 className='font-semibold text-lg truncate'>
                                                    {cafe.name}
                                                </h3>
                                                <p className='text-text/60 text-sm truncate'>
                                                    <MapPin className='inline w-3 h-3 mr-1' />
                                                    {cafe.city_municipality},{" "}
                                                    {cafe.province}
                                                </p>
                                                <p className='text-text/40 text-xs mt-1'>
                                                    {activeTab === "pending"
                                                        ? "Submitted "
                                                        : "Published "}
                                                    {new Date(
                                                        cafe.created_at!
                                                    ).toLocaleDateString()}
                                                </p>
                                            </div>

                                            {/* Actions */}
                                            <div className='flex items-center gap-2 self-end sm:self-center'>
                                                <Link
                                                    href={`/manage/preview/${cafe.id}`}
                                                    className='p-2 bg-tertiary/30 text-text rounded-lg hover:bg-tertiary transition'
                                                    title='View & Edit'
                                                >
                                                    <Eye className='w-5 h-5' />
                                                </Link>
                                                {activeTab === "pending" ? (
                                                    <>
                                                        <button
                                                            onClick={() =>
                                                                handleApprove(
                                                                    cafe.id
                                                                )
                                                            }
                                                            disabled={
                                                                isProcessingThis
                                                            }
                                                            className='p-2 bg-green-500/20 text-green-600 rounded-lg hover:bg-green-500/30 transition disabled:opacity-50'
                                                            title='Approve'
                                                        >
                                                            <Check className='w-5 h-5' />
                                                        </button>
                                                        <button
                                                            onClick={() =>
                                                                handleReject(
                                                                    cafe.id
                                                                )
                                                            }
                                                            disabled={
                                                                isProcessingThis
                                                            }
                                                            className='p-2 bg-red-500/20 text-red-600 rounded-lg hover:bg-red-500/30 transition disabled:opacity-50'
                                                            title='Reject'
                                                        >
                                                            <X className='w-5 h-5' />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() =>
                                                            handleUnpublish(
                                                                cafe.id
                                                            )
                                                        }
                                                        disabled={
                                                            isProcessingThis
                                                        }
                                                        className='p-2 bg-orange-500/20 text-orange-600 rounded-lg hover:bg-orange-500/30 transition disabled:opacity-50'
                                                        title='Unpublish'
                                                    >
                                                        <EyeOff className='w-5 h-5' />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() =>
                                                        toggleExpand(cafe.id)
                                                    }
                                                    className='p-2 bg-tertiary/30 rounded-lg hover:bg-tertiary transition'
                                                    title='View Details'
                                                >
                                                    {isExpanded ? (
                                                        <ChevronUp className='w-5 h-5' />
                                                    ) : (
                                                        <ChevronDown className='w-5 h-5' />
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Expanded Details */}
                                        {isExpanded && (
                                            <div className='border-t border-tertiary/50 p-4 space-y-4 bg-tertiary/10'>
                                                {/* Description */}
                                                {cafe.description && (
                                                    <div>
                                                        <h4 className='text-xs font-medium text-text/40 uppercase mb-1'>
                                                            Description
                                                        </h4>
                                                        <p className='text-sm text-text/80'>
                                                            {cafe.description}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Address */}
                                                <div>
                                                    <h4 className='text-xs font-medium text-text/40 uppercase mb-1'>
                                                        Address
                                                    </h4>
                                                    <p className='text-sm text-text/80'>
                                                        {cafe.address_display}
                                                    </p>
                                                    {cafe.lat && cafe.lng && (
                                                        <a
                                                            href={`https://www.google.com/maps?q=${cafe.lat},${cafe.lng}`}
                                                            target='_blank'
                                                            rel='noopener noreferrer'
                                                            className='text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1'
                                                        >
                                                            View on Google Maps{" "}
                                                            <ExternalLink className='w-3 h-3' />
                                                        </a>
                                                    )}
                                                </div>

                                                {/* Amenities */}
                                                <div>
                                                    <h4 className='text-xs font-medium text-text/40 uppercase mb-2'>
                                                        Amenities
                                                    </h4>
                                                    <div className='flex flex-wrap gap-2'>
                                                        {Object.entries(
                                                            AMENITY_ICONS
                                                        ).map(
                                                            ([
                                                                key,
                                                                {
                                                                    icon: Icon,
                                                                    label,
                                                                },
                                                            ]) => {
                                                                const hasAmenity =
                                                                    cafe[
                                                                        key as keyof typeof cafe
                                                                    ]
                                                                return (
                                                                    <div
                                                                        key={
                                                                            key
                                                                        }
                                                                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                                                                            hasAmenity
                                                                                ? "bg-green-500/20 text-green-600"
                                                                                : "bg-tertiary/30 text-text/30"
                                                                        }`}
                                                                    >
                                                                        <Icon className='w-3 h-3' />
                                                                        {label}
                                                                    </div>
                                                                )
                                                            }
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Gallery */}
                                                {cafe.gallery &&
                                                    cafe.gallery.length > 0 && (
                                                        <div>
                                                            <h4 className='text-xs font-medium text-text/40 uppercase mb-2'>
                                                                Gallery (
                                                                {
                                                                    cafe.gallery
                                                                        .length
                                                                }{" "}
                                                                images)
                                                            </h4>
                                                            <div className='flex gap-2 overflow-x-auto pb-2'>
                                                                {cafe.gallery
                                                                    .slice(0, 6)
                                                                    .map(
                                                                        (
                                                                            url,
                                                                            idx
                                                                        ) => (
                                                                            <div
                                                                                key={
                                                                                    idx
                                                                                }
                                                                                className='relative w-24 h-24 shrink-0 rounded-lg overflow-hidden'
                                                                            >
                                                                                <Image
                                                                                    src={
                                                                                        url
                                                                                    }
                                                                                    alt={`Gallery ${idx + 1}`}
                                                                                    fill
                                                                                    className='object-cover'
                                                                                />
                                                                            </div>
                                                                        )
                                                                    )}
                                                                {cafe.gallery
                                                                    .length >
                                                                    6 && (
                                                                    <div className='w-24 h-24 shrink-0 rounded-lg bg-tertiary/30 flex items-center justify-center text-text/40 text-sm'>
                                                                        +
                                                                        {cafe
                                                                            .gallery
                                                                            .length -
                                                                            6}{" "}
                                                                        more
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                {/* View on site link for published cafes */}
                                                {activeTab === "published" &&
                                                    cafe.slug && (
                                                        <div className='pt-2'>
                                                            <a
                                                                href={`/cafes/${cafe.slug}`}
                                                                target='_blank'
                                                                rel='noopener noreferrer'
                                                                className='text-sm text-primary hover:underline inline-flex items-center gap-1'
                                                            >
                                                                View public page{" "}
                                                                <ExternalLink className='w-3 h-3' />
                                                            </a>
                                                        </div>
                                                    )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Load More Button */}
                    {currentHasMore && (
                        <div className='flex justify-center pt-4'>
                            <button
                                onClick={loadMore}
                                disabled={loadingMore}
                                className='flex items-center gap-2 px-6 py-3 bg-primary/20 text-primary rounded-xl hover:bg-primary/30 transition disabled:opacity-50 border border-primary/30'
                            >
                                {loadingMore ? (
                                    <>
                                        <Loader2 className='w-4 h-4 animate-spin' />
                                        Loading...
                                    </>
                                ) : (
                                    <>Load More Cafes</>
                                )}
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* Suggestions Tab */}
            {activeTab === "suggestions" && (
                <>
                    {suggestions.length === 0 ? (
                        <div className='text-center py-16 bg-background rounded-xl shadow-sm border border-tertiary/50'>
                            <Pencil className='w-12 h-12 mx-auto text-text/30 mb-4' />
                            <h3 className='text-lg font-semibold'>
                                No pending suggestions
                            </h3>
                            <p className='text-text/60 text-sm mt-1'>
                                User edit suggestions will appear here for
                                review.
                            </p>
                        </div>
                    ) : (
                        <div className='space-y-3'>
                            {suggestions.map((suggestion) => {
                                const isExpanded =
                                    expandedSuggestion === suggestion.id
                                const textChangesCount = Object.keys(
                                    suggestion.suggested_changes || {}
                                ).length
                                const imageChanges = suggestion.suggested_images
                                const imageChangesCount = imageChanges
                                    ? (imageChanges.add_to_gallery?.length ||
                                          0) +
                                      (imageChanges.remove_from_gallery
                                          ?.length || 0) +
                                      (imageChanges.new_thumbnail ? 1 : 0)
                                    : 0
                                const changesCount =
                                    textChangesCount + imageChangesCount

                                return (
                                    <div
                                        key={suggestion.id}
                                        className='bg-background shadow-sm border border-tertiary/50 rounded-xl overflow-hidden hover:shadow-md transition-shadow'
                                    >
                                        {/* Header */}
                                        <div
                                            className='p-3 sm:p-4 cursor-pointer hover:bg-tertiary/10 transition flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4'
                                            onClick={() =>
                                                setExpandedSuggestion(
                                                    isExpanded
                                                        ? null
                                                        : suggestion.id
                                                )
                                            }
                                        >
                                            {/* Cafe Thumbnail */}
                                            {suggestion.cafe?.thumbnail && (
                                                <Image
                                                    src={
                                                        suggestion.cafe
                                                            .thumbnail
                                                    }
                                                    alt={
                                                        suggestion.cafe.name ||
                                                        "Cafe"
                                                    }
                                                    width={56}
                                                    height={56}
                                                    className='rounded-lg object-cover'
                                                />
                                            )}

                                            <div className='flex-1 min-w-0'>
                                                <h3 className='font-semibold truncate'>
                                                    {suggestion.cafe?.name ||
                                                        "Unknown Cafe"}
                                                </h3>
                                                <p className='text-sm text-text/60'>
                                                    {changesCount} field
                                                    {changesCount !== 1
                                                        ? "s"
                                                        : ""}{" "}
                                                    to update
                                                </p>
                                                <p className='text-xs text-text/40'>
                                                    Suggested by{" "}
                                                    {suggestion.author
                                                        ?.display_name ||
                                                        suggestion.author
                                                            ?.username ||
                                                        "Unknown"}
                                                    {suggestion.created_at &&
                                                        ` • ${new Date(suggestion.created_at).toLocaleDateString()}`}
                                                </p>
                                            </div>

                                            <div className='flex items-center gap-2'>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleApproveSuggestion(
                                                            suggestion.id
                                                        )
                                                    }}
                                                    disabled={
                                                        processing ===
                                                        suggestion.id
                                                    }
                                                    className='p-2 bg-green-500/20 text-green-600 rounded-lg hover:bg-green-500/30 transition disabled:opacity-50'
                                                    title='Approve'
                                                >
                                                    <Check className='w-5 h-5' />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleRejectSuggestion(
                                                            suggestion.id
                                                        )
                                                    }}
                                                    disabled={
                                                        processing ===
                                                        suggestion.id
                                                    }
                                                    className='p-2 bg-red-500/20 text-red-600 rounded-lg hover:bg-red-500/30 transition disabled:opacity-50'
                                                    title='Reject'
                                                >
                                                    <X className='w-5 h-5' />
                                                </button>
                                                {isExpanded ? (
                                                    <ChevronUp className='w-5 h-5 text-text/40' />
                                                ) : (
                                                    <ChevronDown className='w-5 h-5 text-text/40' />
                                                )}
                                            </div>
                                        </div>

                                        {/* Expanded Details */}
                                        {isExpanded && (
                                            <div className='border-t border-tertiary/50 p-4 space-y-4 bg-tertiary/10'>
                                                {/* Text Changes */}
                                                {Object.entries(
                                                    suggestion.suggested_changes ||
                                                        {}
                                                ).map(([field, value]) => (
                                                    <div key={field}>
                                                        <h4 className='text-xs font-medium text-text/40 uppercase mb-1'>
                                                            {field.replace(
                                                                /_/g,
                                                                " "
                                                            )}
                                                        </h4>
                                                        <p className='text-sm text-text/80 bg-background p-2 rounded-lg'>
                                                            {typeof value ===
                                                            "object"
                                                                ? JSON.stringify(
                                                                      value
                                                                  )
                                                                : String(value)}
                                                        </p>
                                                    </div>
                                                ))}

                                                {/* Image Changes */}
                                                {imageChanges?.new_thumbnail && (
                                                    <div>
                                                        <h4 className='text-xs font-medium text-text/40 uppercase mb-2'>
                                                            New Cover Photo
                                                        </h4>
                                                        <div
                                                            className='relative w-32 h-20 rounded-lg overflow-hidden cursor-pointer'
                                                            onClick={() =>
                                                                openSuggestionLightbox(
                                                                    [
                                                                        imageChanges.new_thumbnail!,
                                                                    ]
                                                                )
                                                            }
                                                        >
                                                            <Image
                                                                src={
                                                                    imageChanges.new_thumbnail
                                                                }
                                                                alt='New cover'
                                                                fill
                                                                className='object-cover'
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {imageChanges?.add_to_gallery &&
                                                    imageChanges.add_to_gallery
                                                        .length > 0 && (
                                                        <div>
                                                            <h4 className='text-xs font-medium text-text/40 uppercase mb-2'>
                                                                New Gallery
                                                                Images (
                                                                {
                                                                    imageChanges
                                                                        .add_to_gallery
                                                                        .length
                                                                }
                                                                )
                                                            </h4>
                                                            <div className='flex gap-2 overflow-x-auto pb-2'>
                                                                {imageChanges.add_to_gallery.map(
                                                                    (
                                                                        url,
                                                                        idx
                                                                    ) => (
                                                                        <div
                                                                            key={
                                                                                idx
                                                                            }
                                                                            className='relative w-20 h-20 shrink-0 rounded-lg overflow-hidden cursor-pointer'
                                                                            onClick={() =>
                                                                                openSuggestionLightbox(
                                                                                    imageChanges.add_to_gallery!,
                                                                                    idx
                                                                                )
                                                                            }
                                                                        >
                                                                            <Image
                                                                                src={
                                                                                    url
                                                                                }
                                                                                alt={`New image ${idx + 1}`}
                                                                                fill
                                                                                className='object-cover'
                                                                            />
                                                                        </div>
                                                                    )
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                {/* Link to cafe */}
                                                {suggestion.cafe?.slug && (
                                                    <Link
                                                        href={`/cafes/${suggestion.cafe.slug}`}
                                                        className='text-sm text-primary hover:underline inline-flex items-center gap-1'
                                                    >
                                                        View current cafe page{" "}
                                                        <ExternalLink className='w-3 h-3' />
                                                    </Link>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </>
            )}

            {/* Claims Tab */}
            {activeTab === "claims" && (
                <>
                    {claims.length === 0 ? (
                        <div className='text-center py-16 bg-background rounded-xl shadow-sm border border-tertiary/50'>
                            <Store className='w-12 h-12 mx-auto text-text/30 mb-4' />
                            <h3 className='text-lg font-semibold'>
                                No pending claims
                            </h3>
                            <p className='text-text/60 text-sm mt-1'>
                                Ownership claims will appear here for review.
                            </p>
                        </div>
                    ) : (
                        <div className='space-y-3'>
                            {claims.map((claim) => {
                                const isExpanded = expandedClaim === claim.id

                                return (
                                    <div
                                        key={claim.id}
                                        className='bg-background shadow-sm border border-tertiary/50 rounded-xl overflow-hidden hover:shadow-md transition-shadow'
                                    >
                                        {/* Header */}
                                        <div
                                            className='p-3 sm:p-4 cursor-pointer hover:bg-tertiary/10 transition flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4'
                                            onClick={() =>
                                                setExpandedClaim(
                                                    isExpanded ? null : claim.id
                                                )
                                            }
                                        >
                                            <div className='flex-1 min-w-0'>
                                                <h3 className='font-semibold truncate'>
                                                    {claim.cafe?.name ||
                                                        "Unknown Cafe"}
                                                </h3>
                                                <p className='text-sm text-text/60'>
                                                    Claimed by{" "}
                                                    {claim.user?.display_name ||
                                                        claim.user?.username ||
                                                        "Unknown"}
                                                </p>
                                                <p className='text-xs text-text/40'>
                                                    {claim.created_at &&
                                                        new Date(
                                                            claim.created_at
                                                        ).toLocaleDateString()}
                                                </p>
                                            </div>

                                            <div className='flex items-center gap-2'>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleApproveClaim(
                                                            claim.id
                                                        )
                                                    }}
                                                    disabled={
                                                        processing === claim.id
                                                    }
                                                    className='p-2 bg-green-500/20 text-green-600 rounded-lg hover:bg-green-500/30 transition disabled:opacity-50'
                                                    title='Approve'
                                                >
                                                    <Check className='w-5 h-5' />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleRejectClaim(
                                                            claim.id
                                                        )
                                                    }}
                                                    disabled={
                                                        processing === claim.id
                                                    }
                                                    className='p-2 bg-red-500/20 text-red-600 rounded-lg hover:bg-red-500/30 transition disabled:opacity-50'
                                                    title='Reject'
                                                >
                                                    <X className='w-5 h-5' />
                                                </button>
                                                {isExpanded ? (
                                                    <ChevronUp className='w-5 h-5 text-text/40' />
                                                ) : (
                                                    <ChevronDown className='w-5 h-5 text-text/40' />
                                                )}
                                            </div>
                                        </div>

                                        {/* Expanded Details */}
                                        {isExpanded && (
                                            <div className='border-t border-tertiary/50 p-4 space-y-4 bg-tertiary/10'>
                                                {/* Proof Documents */}
                                                {claim.proof_document_url && (
                                                    <div>
                                                        <h4 className='text-xs font-medium text-text/40 uppercase mb-2'>
                                                            Proof Document
                                                        </h4>
                                                        <div className='flex gap-2 flex-wrap'>
                                                            <a
                                                                href={
                                                                    claim.proof_document_url
                                                                }
                                                                target='_blank'
                                                                rel='noopener noreferrer'
                                                                className='px-3 py-1.5 bg-background text-sm text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition inline-flex items-center gap-1'
                                                            >
                                                                View Document
                                                                <ExternalLink className='w-3 h-3' />
                                                            </a>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Proof Text */}
                                                {claim.proof_text && (
                                                    <div>
                                                        <h4 className='text-xs font-medium text-text/40 uppercase mb-1'>
                                                            Claim Details
                                                        </h4>
                                                        <p className='text-sm text-text/80 bg-background p-2 rounded-lg'>
                                                            {claim.proof_text}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Link to cafe */}
                                                {claim.cafe?.slug && (
                                                    <Link
                                                        href={`/cafes/${claim.cafe.slug}`}
                                                        className='text-sm text-primary hover:underline inline-flex items-center gap-1'
                                                    >
                                                        View cafe page{" "}
                                                        <ExternalLink className='w-3 h-3' />
                                                    </Link>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </>
            )}

            {/* Image Lightbox */}
            <ImageLightbox
                images={suggestionLightboxImages}
                initialIndex={suggestionLightboxIndex}
                isOpen={
                    showSuggestionLightbox &&
                    suggestionLightboxImages.length > 0
                }
                onClose={() => setShowSuggestionLightbox(false)}
            />
        </div>
    )
}
