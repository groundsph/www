"use client"

import { useState } from "react"
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
    Trash2,
    Loader2,
} from "lucide-react"
import {
    approveCafe,
    rejectCafe,
    unpublishCafe,
    adminCleanupOrphanedImages,
    adminProcessAvatarQueue,
} from "@/app/api/actions/admin"
import { CafeWithRatings } from "@/utils/types/extra"

interface AdminDashboardProps {
    pendingCafes: CafeWithRatings[]
    publishedCafes: CafeWithRatings[]
}

type TabType = "pending" | "published"

export default function AdminDashboard({
    pendingCafes: initialPending,
    publishedCafes: initialPublished,
}: AdminDashboardProps) {
    const [activeTab, setActiveTab] = useState<TabType>("pending")
    const [pendingCafes, setPendingCafes] = useState(initialPending)
    const [publishedCafes, setPublishedCafes] = useState(initialPublished)
    const [expandedCafe, setExpandedCafe] = useState<string | null>(null)
    const [processing, setProcessing] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [cleanupLoading, setCleanupLoading] = useState(false)
    const [cleanupMessage, setCleanupMessage] = useState<string | null>(null)

    const handleApprove = async (cafeId: string) => {
        setProcessing(cafeId)
        const result = await approveCafe(cafeId)
        if (result.success) {
            // Move from pending to published
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
            // Move from published to pending
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

    const handleCleanupOrphans = async () => {
        if (
            !confirm(
                "This will scan all storage buckets and delete files not referenced in the database. Continue?"
            )
        ) {
            return
        }
        setCleanupLoading(true)
        setCleanupMessage(null)
        const result = await adminCleanupOrphanedImages()
        if (result.success && result.deleted) {
            const total =
                result.deleted.cafes +
                result.deleted.reviews +
                result.deleted.avatars
            setCleanupMessage(
                `Cleaned up ${total} orphaned files: ${result.deleted.cafes} cafe images, ${result.deleted.reviews} review images, ${result.deleted.avatars} avatars`
            )
        } else {
            setCleanupMessage(result.error || "Cleanup failed")
        }
        setCleanupLoading(false)
    }

    const handleProcessAvatarQueue = async () => {
        setCleanupLoading(true)
        setCleanupMessage(null)
        const result = await adminProcessAvatarQueue()
        if (result.success) {
            setCleanupMessage(
                `Processed ${result.processed || 0} queued avatar deletions`
            )
        } else {
            setCleanupMessage(result.error || "Processing failed")
        }
        setCleanupLoading(false)
    }

    const toggleExpand = (cafeId: string) => {
        setExpandedCafe((prev) => (prev === cafeId ? null : cafeId))
    }

    const AMENITY_ICONS = {
        has_wifi: { icon: Wifi, label: "WiFi" },
        has_sockets: { icon: Plug, label: "Power Outlets" },
        has_parking: { icon: Car, label: "Parking" },
        has_aircon: { icon: Snowflake, label: "Air Conditioning" },
        is_pet_friendly: { icon: PawPrint, label: "Pet Friendly" },
        has_outdoor_seating: { icon: Sun, label: "Outdoor Seating" },
        serves_food: { icon: Utensils, label: "Serves Food" },
        is_work_friendly: { icon: Briefcase, label: "Work Friendly" },
    }

    const baseCafes = activeTab === "pending" ? pendingCafes : publishedCafes

    // Filter cafes by search query
    const currentCafes = searchQuery.trim()
        ? baseCafes.filter((cafe) => {
              const query = searchQuery.toLowerCase()
              return (
                  cafe.name.toLowerCase().includes(query) ||
                  cafe.address_display?.toLowerCase().includes(query) ||
                  cafe.city_municipality?.toLowerCase().includes(query) ||
                  cafe.province?.toLowerCase().includes(query) ||
                  cafe.area?.toLowerCase().includes(query)
              )
          })
        : baseCafes

    return (
        <div className='w-full overflow-hidden space-y-8'>
            {/* Header */}
            <div className='border-b border-text/10 pb-6'>
                <h1 className='text-3xl font-bold font-serif'>
                    Admin Dashboard
                </h1>
                <p className='text-text/60 mt-2'>
                    Manage cafe submissions and listings
                </p>
            </div>

            {/* Stats */}
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div className='bg-text/5 border border-text/10 rounded-xl p-6'>
                    <div className='text-4xl font-bold'>
                        {pendingCafes.length}
                    </div>
                    <div className='text-text/60 text-sm'>Pending Reviews</div>
                </div>
                <div className='bg-text/5 border border-text/10 rounded-xl p-6'>
                    <div className='text-4xl font-bold'>
                        {publishedCafes.length}
                    </div>
                    <div className='text-text/60 text-sm'>Published Cafes</div>
                </div>
            </div>

            {/* Storage Cleanup */}
            <div className='bg-text/5 border border-text/10 rounded-xl p-6'>
                <h2 className='text-lg font-semibold mb-4 flex items-center gap-2'>
                    <Trash2 className='w-5 h-5' />
                    Storage Cleanup
                </h2>
                <p className='text-text/60 text-sm mb-4'>
                    Clean up orphaned images that are no longer referenced in
                    the database.
                </p>
                <div className='flex flex-wrap gap-3'>
                    <button
                        onClick={handleCleanupOrphans}
                        disabled={cleanupLoading}
                        className='flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30 transition disabled:opacity-50'
                    >
                        {cleanupLoading ? (
                            <Loader2 className='w-4 h-4 animate-spin' />
                        ) : (
                            <Trash2 className='w-4 h-4' />
                        )}
                        Clean Orphaned Images
                    </button>
                    <button
                        onClick={handleProcessAvatarQueue}
                        disabled={cleanupLoading}
                        className='flex items-center gap-2 px-4 py-2 bg-orange-500/20 text-orange-500 rounded-lg hover:bg-orange-500/30 transition disabled:opacity-50'
                    >
                        {cleanupLoading ? (
                            <Loader2 className='w-4 h-4 animate-spin' />
                        ) : (
                            <Trash2 className='w-4 h-4' />
                        )}
                        Process Avatar Queue
                    </button>
                </div>
                {cleanupMessage && (
                    <div className='mt-4 p-3 bg-text/5 border border-text/10 rounded-lg text-sm'>
                        {cleanupMessage}
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className='flex gap-2 border-b border-text/10 pb-4'>
                <button
                    onClick={() => setActiveTab("pending")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition border ${
                        activeTab === "pending"
                            ? "bg-accent/20 text-accent border-accent/30"
                            : "bg-text/5 border-text/10 hover:bg-text/10"
                    }`}
                >
                    <FileText className='w-4 h-4' />
                    Pending ({pendingCafes.length})
                </button>
                <button
                    onClick={() => setActiveTab("published")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition border ${
                        activeTab === "published"
                            ? "bg-accent/20 text-accent border-accent/30"
                            : "bg-text/5 border-text/10 hover:bg-text/10"
                    }`}
                >
                    <Globe className='w-4 h-4' />
                    Published ({publishedCafes.length})
                </button>
            </div>

            {/* Search */}
            <div className='relative'>
                <Search className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text/40' />
                <input
                    type='text'
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder='Search cafes by name, city, or address...'
                    className='w-full pl-12 pr-4 py-3 bg-text/5 border border-text/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/50'
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

            {/* Cafe List */}
            {currentCafes.length === 0 ? (
                <div className='text-center py-16 bg-text/5 rounded-xl border border-text/10'>
                    <AlertCircle className='w-12 h-12 mx-auto text-text/30 mb-4' />
                    <p className='text-text/60 text-lg'>
                        {searchQuery
                            ? `No cafes found for "${searchQuery}"`
                            : activeTab === "pending"
                              ? "No pending submissions"
                              : "No published cafes"}
                    </p>
                    <p className='text-text/40 text-sm mt-1'>
                        {searchQuery
                            ? "Try a different search term"
                            : activeTab === "pending"
                              ? "All caught up!"
                              : "Approve some cafes to see them here"}
                    </p>
                </div>
            ) : (
                <div className='space-y-4'>
                    {currentCafes.map((cafe) => {
                        const isExpanded = expandedCafe === cafe.id
                        const isProcessingThis = processing === cafe.id

                        return (
                            <div
                                key={cafe.id}
                                className='bg-text/5 border border-text/10 rounded-xl overflow-hidden'
                            >
                                {/* Main Row */}
                                <div className='p-4 flex items-center gap-4'>
                                    {/* Thumbnail */}
                                    <div className='relative w-20 h-20 shrink-0 rounded-lg overflow-hidden'>
                                        {cafe.thumbnail ? (
                                            <Image
                                                src={cafe.thumbnail}
                                                alt={cafe.name}
                                                fill
                                                className='object-cover'
                                            />
                                        ) : (
                                            <div className='w-full h-full bg-text/10 flex items-center justify-center'>
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
                                    <div className='flex items-center gap-2'>
                                        <Link
                                            href={`/admin/preview/${cafe.id}`}
                                            className='p-2 bg-accent/20 text-accent rounded-lg hover:bg-accent/30 transition'
                                            title='View & Edit'
                                        >
                                            <Eye className='w-5 h-5' />
                                        </Link>
                                        {activeTab === "pending" ? (
                                            <>
                                                <button
                                                    onClick={() =>
                                                        handleApprove(cafe.id)
                                                    }
                                                    disabled={isProcessingThis}
                                                    className='p-2 bg-green-500/20 text-green-500 rounded-lg hover:bg-green-500/30 transition disabled:opacity-50'
                                                    title='Approve'
                                                >
                                                    <Check className='w-5 h-5' />
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        handleReject(cafe.id)
                                                    }
                                                    disabled={isProcessingThis}
                                                    className='p-2 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30 transition disabled:opacity-50'
                                                    title='Reject'
                                                >
                                                    <X className='w-5 h-5' />
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() =>
                                                    handleUnpublish(cafe.id)
                                                }
                                                disabled={isProcessingThis}
                                                className='p-2 bg-orange-500/20 text-orange-500 rounded-lg hover:bg-orange-500/30 transition disabled:opacity-50'
                                                title='Unpublish'
                                            >
                                                <EyeOff className='w-5 h-5' />
                                            </button>
                                        )}
                                        <button
                                            onClick={() =>
                                                toggleExpand(cafe.id)
                                            }
                                            className='p-2 bg-text/5 rounded-lg hover:bg-text/10 transition'
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
                                    <div className='border-t border-text/10 p-4 space-y-4 bg-background/50'>
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
                                                    className='text-xs text-accent hover:underline inline-flex items-center gap-1 mt-1'
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
                                                        { icon: Icon, label },
                                                    ]) => {
                                                        const hasAmenity =
                                                            cafe[
                                                                key as keyof typeof cafe
                                                            ]
                                                        return (
                                                            <div
                                                                key={key}
                                                                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                                                                    hasAmenity
                                                                        ? "bg-green-500/20 text-green-500"
                                                                        : "bg-text/5 text-text/30"
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
                                                        {cafe.gallery.length}{" "}
                                                        images)
                                                    </h4>
                                                    <div className='flex gap-2 overflow-x-auto pb-2'>
                                                        {cafe.gallery
                                                            .slice(0, 6)
                                                            .map((url, idx) => (
                                                                <div
                                                                    key={idx}
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
                                                            ))}
                                                        {cafe.gallery.length >
                                                            6 && (
                                                            <div className='w-24 h-24 shrink-0 rounded-lg bg-text/10 flex items-center justify-center text-text/40 text-sm'>
                                                                +
                                                                {cafe.gallery
                                                                    .length -
                                                                    6}{" "}
                                                                more
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                        {/* Tags */}
                                        {cafe.tags && cafe.tags.length > 0 && (
                                            <div>
                                                <h4 className='text-xs font-medium text-text/40 uppercase mb-2'>
                                                    Vibe Tags
                                                </h4>
                                                <div className='flex flex-wrap gap-1'>
                                                    {cafe.tags.map((tag) => (
                                                        <span
                                                            key={tag}
                                                            className='px-2 py-0.5 bg-text/10 rounded-full text-xs'
                                                        >
                                                            {tag.replace(
                                                                /_/g,
                                                                " "
                                                            )}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Specialty */}
                                        {cafe.specialty &&
                                            cafe.specialty.length > 0 && (
                                                <div>
                                                    <h4 className='text-xs font-medium text-text/40 uppercase mb-2'>
                                                        Specialties
                                                    </h4>
                                                    <div className='flex flex-wrap gap-1'>
                                                        {cafe.specialty.map(
                                                            (s) => (
                                                                <span
                                                                    key={s}
                                                                    className='px-2 py-0.5 bg-accent/20 text-accent rounded-full text-xs'
                                                                >
                                                                    {s.replace(
                                                                        /_/g,
                                                                        " "
                                                                    )}
                                                                </span>
                                                            )
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
                                                        className='text-sm text-accent hover:underline inline-flex items-center gap-1'
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
        </div>
    )
}
