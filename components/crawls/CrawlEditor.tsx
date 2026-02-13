"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
    ArrowLeft,
    Save,
    Trash2,
    Plus,
    Search,
    X,
    Coffee,
    Loader2,
    Eye,
    EyeOff,
    ImageIcon,
    Map as MapIcon,
} from "lucide-react"
import {
    createCafeCrawl,
    updateCafeCrawl,
    deleteCafeCrawl,
} from "@/app/api/actions/cafe-crawls"
import { searchCafesForCrawl } from "@/app/api/actions/cafe-crawls"
import { getCafeThumbnailUrl } from "@/utils/extras"
import { useNotification } from "@/components/layout/NotificationProvider"
import ImageCropper from "@/components/ui/ImageCropper"
import { uploadCrawlCover } from "@/utils/storage/client"
import { compressCollectionCover } from "@/utils/image-processing"
import CrawlRouteMap from "@/components/map/CrawlRouteMap"

interface CrawlItem {
    id?: string
    cafeId: string
    sortOrder: number
    note?: string | null
    name?: string
    slug?: string
    thumbnail?: string | null
    cityMunicipality?: string
    region?: string
    lat?: number | null
    lng?: number | null
}

interface Crawl {
    id?: string
    title: string
    description?: string | null
    coverImage?: string | null
    isPublic?: boolean
    status?: string
    items: CrawlItem[]
}

interface CafeSearchResult {
    id: string
    name: string
    slug: string
    thumbnail: string
    cityMunicipality: string
    region: string
    lat: number | null
    lng: number | null
}

interface CrawlEditorProps {
    crawl: Crawl
    mode?: "create" | "edit"
}

export default function CrawlEditor({ crawl, mode = "edit" }: CrawlEditorProps) {
    const router = useRouter()
    const { addNotification } = useNotification()
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Form state
    const [title, setTitle] = useState(crawl.title)
    const [description, setDescription] = useState(crawl.description || "")
    const [coverImage, setCoverImage] = useState(crawl.coverImage || "")
    const [isPublic, setIsPublic] = useState(crawl.isPublic ?? true)
    const [items, setItems] = useState<CrawlItem[]>(crawl.items || [])

    // UI state
    const [isSaving, setIsSaving] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [searchResults, setSearchResults] = useState<CafeSearchResult[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [showMobileMap, setShowMobileMap] = useState(false)

    // Image cropper state
    const [croppingImage, setCroppingImage] = useState<File | null>(null)
    const [showCropper, setShowCropper] = useState(false)
    const [isUploadingCover, setIsUploadingCover] = useState(false)

    // Get map points from items
    const mapPoints = useMemo(
        () =>
            items
                .filter((item) => item.lat && item.lng)
                .map((item) => ({ lat: item.lat!, lng: item.lng! })),
        [items]
    )

    // Debounced search for cafes
    useEffect(() => {
        if (searchQuery.length < 2) {
            setSearchResults([])
            return
        }

        const timeoutId = setTimeout(async () => {
            setIsSearching(true)
            try {
                const results = await searchCafesForCrawl(searchQuery)
                // Filter out already added cafes
                const existingIds = new Set(items.map((item) => item.cafeId))
                setSearchResults(results.filter((r) => !existingIds.has(r.id)))
            } catch (err) {
                console.error("Search failed:", err)
            } finally {
                setIsSearching(false)
            }
        }, 300)

        return () => clearTimeout(timeoutId)
    }, [searchQuery, items])

    // Add cafe to crawl
    const addCafe = (cafe: CafeSearchResult) => {
        const newItem: CrawlItem = {
            cafeId: cafe.id,
            sortOrder: items.length,
            name: cafe.name,
            slug: cafe.slug,
            thumbnail: cafe.thumbnail,
            cityMunicipality: cafe.cityMunicipality,
            region: cafe.region,
            lat: cafe.lat,
            lng: cafe.lng,
        }
        setItems((prev) => [...prev, newItem])
        setSearchQuery("")
        setSearchResults([])
    }

    // Remove cafe from crawl
    const removeCafe = (cafeId: string) => {
        setItems((prev) => {
            const filtered = prev.filter((item) => item.cafeId !== cafeId)
            // Reorder remaining items
            return filtered.map((item, index) => ({ ...item, sortOrder: index }))
        })
    }

    // Move cafe up/down
    const moveCafe = useCallback((index: number, direction: "up" | "down") => {
        setItems((prev) => {
            if (direction === "up" && index === 0) return prev
            if (direction === "down" && index === prev.length - 1) return prev

            const newItems = [...prev]
            const targetIndex = direction === "up" ? index - 1 : index + 1
            const [removed] = newItems.splice(index, 1)
            newItems.splice(targetIndex, 0, removed)
            // Update sortOrder
            return newItems.map((item, idx) => ({ ...item, sortOrder: idx }))
        })
    }, [])

    // Update cafe note
    const updateNote = (cafeId: string, note: string) => {
        setItems((prev) =>
            prev.map((item) =>
                item.cafeId === cafeId ? { ...item, note: note || null } : item
            )
        )
    }

    // Save crawl
    const handleSave = async () => {
        if (!title.trim()) {
            addNotification("Title is required", "error")
            return
        }

        setIsSaving(true)

        try {
            const crawlData = {
                title: title.trim(),
                description: description.trim() || undefined,
                coverImage: coverImage || undefined,
                isPublic,
                status: "published" as const,
                items: items.map((item) => ({
                    cafeId: item.cafeId,
                    sortOrder: item.sortOrder,
                    note: item.note,
                })),
            }

            if (mode === "create") {
                const result = await createCafeCrawl(crawlData)
                if (result.success) {
                    addNotification("Crawl created!", "success")
                    router.push(`/community/crawls/${result.data?.slug}`)
                } else {
                    addNotification(result.error || "Failed to create crawl", "error")
                }
            } else if (crawl.id) {
                const result = await updateCafeCrawl(crawl.id, crawlData)
                if (result.success) {
                    addNotification("Crawl saved!", "success")
                } else {
                    addNotification(result.error || "Failed to save crawl", "error")
                }
            }
        } catch (err) {
            console.error(err)
            addNotification("Failed to save crawl", "error")
        } finally {
            setIsSaving(false)
        }
    }

    // Delete crawl
    const handleDelete = async () => {
        if (!crawl.id) return
        
        setIsDeleting(true)
        try {
            const result = await deleteCafeCrawl(crawl.id)
            if (result.success) {
                addNotification("Crawl deleted", "success")
                router.push("/community/crawls")
            } else {
                addNotification(result.error || "Failed to delete crawl", "error")
                setIsDeleting(false)
            }
        } catch (err) {
            console.error(err)
            addNotification("Failed to delete crawl", "error")
            setIsDeleting(false)
        }
    }

    // Handle file selection for cover image
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith("image/")) {
            addNotification("Please select an image file", "error")
            return
        }
        if (file.size > 10 * 1024 * 1024) {
            addNotification("Image must be less than 10MB", "error")
            return
        }
        setCroppingImage(file)
        setShowCropper(true)
        e.target.value = ""
    }

    // Handle image crop completion
    const handleCropComplete = async (croppedBlob: Blob) => {
        setShowCropper(false)
        setCroppingImage(null)
        setIsUploadingCover(true)

        try {
            // Create initial file from cropped blob
            const rawFile = new File([croppedBlob], "cover.jpg", {
                type: "image/jpeg",
            })

            // Compress crawl cover (150KB JPEG for OG compatibility)
            const file = await compressCollectionCover(rawFile)

            const result = await uploadCrawlCover(file)
            if (result.success && result.url) {
                setCoverImage(result.url)
                addNotification("Cover image updated!", "success")
            } else {
                addNotification(
                    result.error || "Failed to upload image",
                    "error"
                )
            }
        } catch (err) {
            console.error(err)
            addNotification("Failed to upload image", "error")
        } finally {
            setIsUploadingCover(false)
        }
    }

    return (
        <div className="min-h-screen bg-background w-full">
            {/* Header */}
            <div className="border-b w-full border-secondary/20 bg-background/80 backdrop-blur-sm sticky top-0 z-20">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link
                            href={mode === "create" ? "/community/crawls" : `/community/crawls/${crawl.id || ""}`}
                            className="p-2 -ml-2 text-text/60 hover:text-text transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <h1 className="font-serif text-xl font-bold text-text">
                            {mode === "create" ? "Create Crawl" : "Edit Crawl"}
                        </h1>
                    </div>

                    <div className="flex items-center gap-3">
                        {mode === "edit" && (
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete crawl"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        )}

                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-full font-medium text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        >
                            {isSaving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            Save
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Details */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Cover Image */}
                        <div>
                            <label className="block text-sm font-medium text-text mb-2">
                                Cover Image
                            </label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileSelect}
                                className="hidden"
                            />
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="relative aspect-video rounded-xl border-2 border-dashed border-secondary/30 hover:border-primary/50 cursor-pointer overflow-hidden transition-colors group"
                            >
                                {isUploadingCover ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center">
                                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                                        <span className="text-sm text-text/60 mt-2">
                                            Uploading...
                                        </span>
                                    </div>
                                ) : coverImage ? (
                                    <>
                                        <Image
                                            src={coverImage}
                                            alt="Cover"
                                            fill
                                            className="object-cover"
                                        />
                                        <div className="absolute inset-0 bg-text/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <span className="text-white text-sm font-medium">
                                                Change
                                            </span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-text/40 group-hover:text-primary/60 transition-colors">
                                        <ImageIcon className="w-10 h-10 mb-2" />
                                        <span className="text-sm">
                                            Add cover image
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Title */}
                        <div>
                            <label className="block text-sm font-medium text-text mb-2">
                                Title <span className="text-primary">*</span>
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-4 py-3 bg-background border border-secondary/30 rounded-xl text-text focus:outline-none focus:border-primary/50 transition-colors"
                                maxLength={100}
                                placeholder="e.g., Metro Manila Coffee Trail"
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-text mb-2">
                                Description
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={4}
                                className="w-full px-4 py-3 bg-background border border-secondary/30 rounded-xl text-text focus:outline-none focus:border-primary/50 transition-colors resize-none"
                                maxLength={500}
                                placeholder="Describe your coffee crawl route..."
                            />
                        </div>

                        {/* Visibility */}
                        <div className="flex items-center justify-between p-4 bg-secondary/5 rounded-xl">
                            <div className="flex items-center gap-3">
                                {isPublic ? (
                                    <Eye className="w-5 h-5 text-primary" />
                                ) : (
                                    <EyeOff className="w-5 h-5 text-text/50" />
                                )}
                                <div>
                                    <p className="text-sm font-medium text-text">
                                        {isPublic ? "Public" : "Private"}
                                    </p>
                                    <p className="text-xs text-text/60">
                                        {isPublic
                                            ? "Anyone can view"
                                            : "Only you can view"}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsPublic(!isPublic)}
                                className={`w-12 h-6 rounded-full transition-colors ${
                                    isPublic ? "bg-primary" : "bg-secondary/30"
                                }`}
                            >
                                <div
                                    className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                                        isPublic
                                            ? "translate-x-6"
                                            : "translate-x-0.5"
                                    }`}
                                />
                            </button>
                        </div>
                    </div>

                    {/* Right: Cafes + Map */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Search */}
                        <div>
                            <label className="block text-sm font-medium text-text mb-2">
                                Add Cafes
                            </label>
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text/40" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) =>
                                        setSearchQuery(e.target.value)
                                    }
                                    placeholder="Search cafes to add..."
                                    className="w-full pl-12 pr-4 py-3 bg-background border border-secondary/30 rounded-xl text-text placeholder:text-text/40 focus:outline-none focus:border-primary/50 transition-colors"
                                />
                                {isSearching && (
                                    <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary animate-spin" />
                                )}
                            </div>

                            {/* Search Results */}
                            {searchResults.length > 0 && (
                                <div className="mt-2 border border-secondary/20 rounded-xl overflow-hidden divide-y divide-secondary/10">
                                    {searchResults.map((cafe) => (
                                        <button
                                            key={cafe.id}
                                            onClick={() => addCafe(cafe)}
                                            className="w-full flex items-center gap-3 p-3 hover:bg-secondary/5 transition-colors text-left"
                                        >
                                            <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-secondary/10 shrink-0">
                                                {cafe.thumbnail ? (
                                                    <Image
                                                        src={getCafeThumbnailUrl(
                                                            cafe.thumbnail
                                                        )}
                                                        alt={cafe.name}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <Coffee className="w-5 h-5 text-secondary/40" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-text truncate">
                                                    {cafe.name}
                                                </p>
                                                <p className="text-xs text-text/60 truncate">
                                                    {cafe.cityMunicipality},{" "}
                                                    {cafe.region}
                                                </p>
                                            </div>
                                            <Plus className="w-5 h-5 text-primary shrink-0" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Map - Desktop always visible, Mobile toggle */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <label className="text-sm font-medium text-text">
                                    Route Preview
                                </label>
                                <button
                                    className="lg:hidden text-sm text-primary"
                                    onClick={() => setShowMobileMap((v) => !v)}
                                >
                                    {showMobileMap ? "Hide Map" : "Preview Map"}
                                </button>
                            </div>
                            
                            {/* Desktop Map - always visible */}
                            <div className="hidden lg:block rounded-2xl overflow-hidden border border-secondary/20">
                                <CrawlRouteMap points={mapPoints} />
                            </div>
                            
                            {/* Mobile Map - toggleable */}
                            {showMobileMap && (
                                <div className="lg:hidden rounded-2xl overflow-hidden border border-secondary/20">
                                    <CrawlRouteMap points={mapPoints} />
                                </div>
                            )}
                        </div>

                        {/* Cafes List */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <label className="text-sm font-medium text-text">
                                    Cafes ({items.length})
                                </label>
                            </div>

                            {items.length === 0 ? (
                                <div className="text-center py-12 border border-dashed border-secondary/30 rounded-xl">
                                    <MapIcon className="w-10 h-10 text-secondary/40 mx-auto mb-3" />
                                    <p className="text-text/60">
                                        No cafes added yet
                                    </p>
                                    <p className="text-sm text-text/40">
                                        Search above to add cafes to your route
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {items.map((item, index) => (
                                        <div
                                            key={`${item.cafeId}-${index}`}
                                            className="flex items-start gap-3 p-4 bg-secondary/5 rounded-xl"
                                        >
                                            {/* Index */}
                                            <div className="flex flex-col items-center gap-1 pt-1">
                                                <span className="w-6 h-6 flex items-center justify-center bg-primary text-white text-xs font-bold rounded-full">
                                                    {index + 1}
                                                </span>
                                            </div>

                                            {/* Thumbnail */}
                                            <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-secondary/10 shrink-0">
                                                {item.thumbnail ? (
                                                    <Image
                                                        src={getCafeThumbnailUrl(
                                                            item.thumbnail
                                                        )}
                                                        alt={item.name || ""}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <Coffee className="w-6 h-6 text-secondary/40" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-text truncate">
                                                    {item.name || "Loading..."}
                                                </p>
                                                <p className="text-sm text-text/60 truncate">
                                                    {item.cityMunicipality && item.region
                                                        ? `${item.cityMunicipality}, ${item.region}`
                                                        : ""}
                                                </p>
                                                {/* Note input */}
                                                <input
                                                    type="text"
                                                    value={item.note || ""}
                                                    onChange={(e) =>
                                                        updateNote(
                                                            item.cafeId,
                                                            e.target.value
                                                        )
                                                    }
                                                    placeholder="Add a note about this stop..."
                                                    className="mt-2 w-full px-3 py-1.5 text-sm bg-background border border-secondary/20 rounded-lg text-text placeholder:text-text/30 focus:outline-none focus:border-primary/50"
                                                    maxLength={200}
                                                />
                                            </div>

                                            {/* Actions */}
                                            <div className="flex flex-col gap-1">
                                                <button
                                                    onClick={() =>
                                                        moveCafe(index, "up")
                                                    }
                                                    disabled={index === 0}
                                                    className="p-1 text-text/40 hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    ▲
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        moveCafe(index, "down")
                                                    }
                                                    disabled={
                                                        index ===
                                                        items.length - 1
                                                    }
                                                    className="p-1 text-text/40 hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    ▼
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        removeCafe(item.cafeId)
                                                    }
                                                    className="p-1 text-red-400 hover:text-red-500 transition-colors"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Delete Confirmation */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-text/50 backdrop-blur-sm"
                        onClick={() => setShowDeleteConfirm(false)}
                    />
                    <div className="relative w-full max-w-sm bg-background rounded-2xl p-6 shadow-xl">
                        <h3 className="font-serif text-xl font-semibold text-text mb-2">
                            Delete Crawl?
                        </h3>
                        <p className="text-text/60 mb-6">
                            This action cannot be undone. All data will be
                            permanently deleted.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 px-4 py-3 text-text/70 font-medium rounded-xl border border-secondary/30 hover:bg-secondary/10 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="flex-1 px-4 py-3 bg-red-500 text-white font-medium rounded-xl hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                            >
                                {isDeleting && (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                )}
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Cropper */}
            <ImageCropper
                open={showCropper}
                image={croppingImage}
                aspect={16 / 9}
                onComplete={handleCropComplete}
                onCancel={() => {
                    setShowCropper(false)
                    setCroppingImage(null)
                }}
            />
        </div>
    )
}
