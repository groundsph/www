"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import Image from "next/image"
import {
    XIcon,
    Loader2,
    ChevronDown,
    ChevronUp,
    Wifi,
    Cigarette,
    Plug,
    Car,
    Snowflake,
    PawPrint,
    Sun,
    Utensils,
    Briefcase,
    ImagePlus,
    DollarSign,
    Coffee,
    Clock,
    Link as LinkIcon,
    Check,
    Trash2,
    Upload,
    Store,
    Sparkles,
    Phone,
    MapPin,
} from "lucide-react"

import { submitEditSuggestion } from "@/app/api/actions/suggestions"
import {
    SuggestableFields,
    SuggestedImageChanges,
} from "@/utils/types/suggestions"
import { CafeWithRatings } from "@/utils/types/extra"
import { OperatingHour, CafeSocial } from "@/utils/types/cafe"
import { useRouter } from "next/navigation"
import OperatingHoursEditor from "@/components/submit/OperatingHoursEditor"
import SocialLinksEditor from "@/components/submit/SocialLinksEditor"
import { uploadCafeImage } from "@/utils/storage/client"
import {
    compressCoverImage,
    compressGalleryImage,
} from "@/utils/image-processing"
import { getCafeThumbnailUrl } from "@/utils/extras"
import ImageCropper from "@/components/ui/ImageCropper"
import ImageUpload from "@/components/reviews/ImageUpload"
import {
    CAFE_SPECIALTIES,
    CAFE_VIBE_TAGS,
    BREW_METHODS,
    COFFEE_STYLES,
} from "@/utils/data/philippines"
import React from "react"
import dynamic from "next/dynamic"

// Dynamic import for LocationPickerInner (uses Leaflet which requires window)
const LocationPickerInner = dynamic(
    () => import("@/components/submit/LocationPickerInner"),
    {
        ssr: false,
        loading: () => (
            <div className='aspect-video bg-text/5 rounded-xl animate-pulse' />
        ),
    }
)

interface SuggestEditModalProps {
    isOpen: boolean
    onClose: () => void
    cafe: CafeWithRatings
}

// Field categories for the UI
const AMENITY_FIELDS = [
    { key: "has_wifi", label: "WiFi", icon: Wifi },
    { key: "has_smoking", label: "Smoking Area", icon: Cigarette },
    { key: "has_sockets", label: "Power Outlets", icon: Plug },

    { key: "has_parking", label: "Parking", icon: Car },
    { key: "has_aircon", label: "Air Conditioning", icon: Snowflake },
    { key: "is_pet_friendly", label: "Pet Friendly", icon: PawPrint },
    { key: "has_outdoor_seating", label: "Outdoor Seating", icon: Sun },
    { key: "has_indoor_seating", label: "Indoor Seating", icon: Briefcase },
    { key: "has_restroom", label: "Restroom", icon: Utensils },
    { key: "has_bidet", label: "Bidet", icon: Utensils },
    { key: "has_non_dairy", label: "Non-Dairy Milk", icon: Coffee },
    { key: "has_decaf", label: "Decaf Options", icon: Coffee },
    { key: "serves_food", label: "Serves Food", icon: Utensils },
    { key: "is_work_friendly", label: "Work Friendly", icon: Briefcase },
] as const

type AmenityKey = (typeof AMENITY_FIELDS)[number]["key"]

const PRICE_LEVELS = [
    { value: "low", label: "₱", description: "Budget-friendly" },
    { value: "medium", label: "₱₱", description: "Mid-range" },
    { value: "high", label: "₱₱₱", description: "Premium" },
] as const

export default function SuggestEditModal({
    isOpen,
    onClose,
    cafe,
}: SuggestEditModalProps) {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    // Expandable sections
    const [expandedSections, setExpandedSections] = useState<Set<string>>(
        new Set(["basic"])
    )

    // Form state - only store values that differ from current
    const [changes, setChanges] = useState<SuggestableFields>({})

    // Image state
    const [newThumbnail, setNewThumbnail] = useState<File | null>(null)
    const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(
        null
    )
    const [newGalleryFiles, setNewGalleryFiles] = useState<File[]>([])
    const [removeFromGallery, setRemoveFromGallery] = useState<string[]>([])
    const [uploadingImages, setUploadingImages] = useState(false)

    // Cover photo cropper state
    const [croppingImage, setCroppingImage] = useState<File | null>(null)
    const [cropperOpen, setCropperOpen] = useState(false)

    useEffect(() => {
        if (isOpen) {
            setChanges({})
            setError(null)
            setSuccess(false)
            setNewThumbnail(null)
            setThumbnailPreview(null)
            setNewGalleryFiles([])
            setRemoveFromGallery([])
            setCroppingImage(null)
            setCropperOpen(false)
        }
    }, [isOpen])

    // Check if image is 16:9 aspect ratio
    const checkAspectRatio = (file: File): Promise<boolean> => {
        return new Promise((resolve) => {
            const img = new window.Image()
            img.onload = () => {
                const aspect = img.width / img.height
                const is16by9 = Math.abs(aspect - 16 / 9) < 0.05
                resolve(is16by9)
            }
            img.src = URL.createObjectURL(file)
        })
    }

    // Handle cover photo selection
    const handleCoverPhotoSelect = async (file: File) => {
        const is16by9 = await checkAspectRatio(file)
        if (is16by9) {
            // Already 16:9, process directly
            setNewThumbnail(file)
            setThumbnailPreview(URL.createObjectURL(file))
        } else {
            // Open cropper for non-16:9 images
            setCroppingImage(file)
            setCropperOpen(true)
        }
    }

    // Handle crop completion
    const handleCropComplete = async (croppedBlob: Blob) => {
        const file = new File(
            [croppedBlob],
            croppingImage?.name || "cover.webp",
            {
                type: "image/webp",
                lastModified: Date.now(),
            }
        )

        // Compress cover image (250KB WebP)
        const finalFile = await compressCoverImage(file)

        setNewThumbnail(finalFile)
        setThumbnailPreview(URL.createObjectURL(finalFile))
        setCropperOpen(false)
        setCroppingImage(null)
    }

    const toggleSection = (section: string) => {
        setExpandedSections((prev) => {
            const next = new Set(prev)
            if (next.has(section)) {
                next.delete(section)
            } else {
                next.add(section)
            }
            return next
        })
    }

    // Helper to compare arrays
    const arraysEqual = (
        a: unknown[] | undefined,
        b: unknown[] | undefined
    ): boolean => {
        if (!a && !b) return true
        if (!a || !b) return false
        if (a.length !== b.length) return false
        return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())
    }

    // Helper to compare objects
    const objectsEqual = (a: unknown, b: unknown): boolean => {
        return JSON.stringify(a) === JSON.stringify(b)
    }

    const updateChange = <K extends keyof SuggestableFields>(
        key: K,
        value: SuggestableFields[K]
    ) => {
        setChanges((prev) => {
            const cafeValue = cafe[key as keyof CafeWithRatings]

            // Handle array comparison
            if (Array.isArray(value) || Array.isArray(cafeValue)) {
                if (arraysEqual(value as unknown[], cafeValue as unknown[])) {
                    const rest = { ...prev }
                    delete rest[key]
                    return rest
                }
                return { ...prev, [key]: value }
            }

            // Handle object comparison (like socials)
            if (typeof value === "object" && value !== null) {
                if (objectsEqual(value, cafeValue)) {
                    const rest = { ...prev }
                    delete rest[key]
                    return rest
                }
                return { ...prev, [key]: value }
            }

            // If value matches current cafe value, remove from changes
            if (value === cafeValue || (value === "" && !cafeValue)) {
                const rest = { ...prev }
                delete rest[key]
                return rest
            }
            return { ...prev, [key]: value }
        })
    }

    const toggleAmenity = (key: AmenityKey) => {
        const currentCafeValue = cafe[key] ?? false
        const currentChangeValue = changes[key]

        // If we have a pending change, remove it (revert to original)
        if (currentChangeValue !== undefined) {
            setChanges((prev) => {
                const rest = { ...prev }
                delete rest[key]
                return rest
            })
        } else {
            // Toggle from current cafe value
            setChanges((prev) => ({
                ...prev,
                [key]: !currentCafeValue,
            }))
        }
    }

    const toggleArrayItem = (
        key: "brew_methods" | "specialty" | "tags",
        item: string
    ) => {
        const currentCafeValue = (cafe[key] as string[]) ?? []
        const currentChangeValue = changes[key] as string[] | undefined

        // Get the effective current list
        const effectiveList = currentChangeValue ?? currentCafeValue

        // Toggle the item
        let newList: string[]
        if (effectiveList.includes(item)) {
            newList = effectiveList.filter((i) => i !== item)
        } else {
            newList = [...effectiveList, item]
        }

        // Check if it matches the original
        if (arraysEqual(newList, currentCafeValue)) {
            setChanges((prev) => {
                const rest = { ...prev }
                delete rest[key]
                return rest
            })
        } else {
            setChanges((prev) => ({
                ...prev,
                [key]: newList,
            }))
        }
    }

    const handleSubmit = async () => {
        // Check for any changes (text or images)
        const hasTextChanges = Object.keys(changes).length > 0
        const hasImageChanges =
            newThumbnail ||
            newGalleryFiles.length > 0 ||
            removeFromGallery.length > 0

        if (!hasTextChanges && !hasImageChanges) {
            setError("Please make at least one change before submitting")
            return
        }

        setIsSubmitting(true)
        setError(null)

        try {
            // Upload images first if there are any
            let imageChanges: SuggestedImageChanges | undefined

            if (hasImageChanges) {
                setUploadingImages(true)
                imageChanges = {}

                // Upload new thumbnail
                if (newThumbnail) {
                    // Compress cover image (250KB JPEG for Satori OG compatibility)
                    const compressed = await compressCoverImage(newThumbnail)
                    const result = await uploadCafeImage(compressed)
                    if (result.success && result.url) {
                        imageChanges.new_thumbnail = result.url
                    } else {
                        throw new Error("Failed to upload cover photo")
                    }
                }

                // Upload new gallery images
                if (newGalleryFiles.length > 0) {
                    const uploadedUrls: string[] = []
                    for (const file of newGalleryFiles) {
                        // Compress gallery image (120KB WebP)
                        const compressed = await compressGalleryImage(file)
                        const result = await uploadCafeImage(compressed)
                        if (result.success && result.url) {
                            uploadedUrls.push(result.url)
                        }
                    }
                    if (uploadedUrls.length > 0) {
                        imageChanges.add_to_gallery = uploadedUrls
                    }
                }

                // Mark images for removal
                if (removeFromGallery.length > 0) {
                    imageChanges.remove_from_gallery = removeFromGallery
                }

                setUploadingImages(false)
            }

            const result = await submitEditSuggestion(
                cafe.id,
                changes,
                imageChanges
            )

            if (result.success) {
                setSuccess(true)
                setTimeout(() => {
                    onClose()
                    router.refresh()
                }, 2000)
            } else {
                setError(result.error || "Failed to submit suggestion")
            }
        } catch (e) {
            setError(
                e instanceof Error ? e.message : "An unexpected error occurred"
            )
        } finally {
            setIsSubmitting(false)
            setUploadingImages(false)
        }
    }

    // Count includes text changes + image changes
    const imageChangeCount =
        (newThumbnail ? 1 : 0) +
        newGalleryFiles.length +
        removeFromGallery.length
    const changesCount = Object.keys(changes).length + imageChangeCount

    // Helper to check if a field has changes
    const hasChange = (key: keyof SuggestableFields): boolean => {
        return changes[key] !== undefined
    }

    // Helper to get effective array value (with changes applied)
    const getEffectiveArray = (
        key: "brew_methods" | "specialty" | "tags"
    ): string[] => {
        return (
            (changes[key] as string[] | undefined) ??
            (cafe[key] as string[]) ??
            []
        )
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <React.Fragment key='suggest-edit-modal'>
                    <motion.div
                        key='suggest-edit-backdrop'
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className='fixed inset-0 bg-black/40 z-50 backdrop-blur-sm'
                    />
                    <motion.div
                        key='suggest-edit-modal'
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className='fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl mx-4 bg-background text-text rounded-xl shadow-2xl z-50 flex flex-col max-h-[90vh] overflow-hidden border border-text/10'
                    >
                        {/* Header */}
                        <div className='flex items-center justify-between p-4 border-b border-text/10'>
                            <div>
                                <span className='text-xs font-medium tracking-wide uppercase text-text/50'>
                                    Suggest an Edit
                                </span>
                                <h2 className='text-xl font-serif font-semibold text-text'>
                                    {cafe.name}
                                </h2>
                            </div>
                            <button
                                onClick={onClose}
                                className='p-2 hover:bg-text/10 rounded-lg transition-colors text-text/40 hover:text-text cursor-pointer'
                            >
                                <XIcon className='w-5 h-5' />
                            </button>
                        </div>

                        {/* Content */}
                        <div className='flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar'>
                            {success ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className='flex flex-col items-center justify-center py-12 gap-4'
                                >
                                    <div className='w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center'>
                                        <svg
                                            className='w-8 h-8 text-green-500'
                                            fill='none'
                                            viewBox='0 0 24 24'
                                            stroke='currentColor'
                                        >
                                            <path
                                                strokeLinecap='round'
                                                strokeLinejoin='round'
                                                strokeWidth={2}
                                                d='M5 13l4 4L19 7'
                                            />
                                        </svg>
                                    </div>
                                    <div className='text-center'>
                                        <h3 className='text-lg font-semibold'>
                                            Suggestion Submitted!
                                        </h3>
                                        <p className='text-text/60 text-sm mt-1'>
                                            Thank you for helping improve our
                                            cafe listings.
                                        </p>
                                    </div>
                                </motion.div>
                            ) : (
                                <>
                                    {/* Help Text */}
                                    <div className='bg-primary/10 border border-primary/20 rounded-lg p-3 text-sm text-text/80'>
                                        <p>
                                            <strong>Tip:</strong> Only change
                                            the fields that need updating. Your
                                            suggestions will be reviewed by our
                                            team before being applied.
                                        </p>
                                    </div>

                                    {/* Basic Info Section */}
                                    <div className='border border-text/10 rounded-lg overflow-hidden'>
                                        <button
                                            onClick={() =>
                                                toggleSection("basic")
                                            }
                                            className='w-full flex items-center justify-between p-3 bg-text/5 hover:bg-text/10 transition-colors cursor-pointer'
                                        >
                                            <span className='font-medium flex items-center gap-2'>
                                                <Store className='w-4 h-4' />
                                                Basic Information
                                            </span>
                                            {expandedSections.has("basic") ? (
                                                <ChevronUp className='w-4 h-4' />
                                            ) : (
                                                <ChevronDown className='w-4 h-4' />
                                            )}
                                        </button>

                                        {expandedSections.has("basic") && (
                                            <div className='p-4 space-y-4'>
                                                {/* Name */}
                                                <div className='space-y-2'>
                                                    <label className='text-sm font-medium text-text/60'>
                                                        Cafe Name
                                                    </label>
                                                    <input
                                                        type='text'
                                                        value={
                                                            changes.name ??
                                                            cafe.name ??
                                                            ""
                                                        }
                                                        onChange={(e) =>
                                                            updateChange(
                                                                "name",
                                                                e.target
                                                                    .value ||
                                                                    undefined
                                                            )
                                                        }
                                                        placeholder='Cafe name'
                                                        className={`w-full bg-text/5 text-sm placeholder:text-text/30 focus:outline-none p-3 rounded-lg border transition-all text-text ${
                                                            hasChange("name")
                                                                ? "border-primary/50 ring-2 ring-primary/20"
                                                                : "border-text/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                                                        }`}
                                                    />
                                                </div>

                                                {/* Description */}
                                                <div className='space-y-2'>
                                                    <label className='text-sm font-medium text-text/60'>
                                                        Description
                                                    </label>
                                                    <textarea
                                                        value={
                                                            changes.description ??
                                                            cafe.description ??
                                                            ""
                                                        }
                                                        onChange={(e) =>
                                                            updateChange(
                                                                "description",
                                                                e.target
                                                                    .value ||
                                                                    undefined
                                                            )
                                                        }
                                                        placeholder='Describe the cafe...'
                                                        rows={3}
                                                        className={`w-full bg-text/5 text-sm leading-relaxed placeholder:text-text/30 focus:outline-none p-3 resize-none rounded-lg border transition-all text-text ${
                                                            hasChange(
                                                                "description"
                                                            )
                                                                ? "border-primary/50 ring-2 ring-primary/20"
                                                                : "border-text/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                                                        }`}
                                                    />
                                                </div>

                                                {/* Address */}
                                                <div className='space-y-2'>
                                                    <label className='text-sm font-medium text-text/60'>
                                                        Address
                                                    </label>
                                                    <input
                                                        type='text'
                                                        value={
                                                            changes.address_display ??
                                                            cafe.address_display ??
                                                            ""
                                                        }
                                                        onChange={(e) =>
                                                            updateChange(
                                                                "address_display",
                                                                e.target
                                                                    .value ||
                                                                    undefined
                                                            )
                                                        }
                                                        placeholder='Full address'
                                                        className={`w-full bg-text/5 text-sm placeholder:text-text/30 focus:outline-none p-3 rounded-lg border transition-all text-text ${
                                                            hasChange(
                                                                "address_display"
                                                            )
                                                                ? "border-primary/50 ring-2 ring-primary/20"
                                                                : "border-text/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                                                        }`}
                                                    />
                                                </div>

                                                {/* Area */}
                                                <div className='space-y-2'>
                                                    <label className='text-sm font-medium text-text/60'>
                                                        Area / Neighborhood
                                                    </label>
                                                    <input
                                                        type='text'
                                                        value={
                                                            changes.area ??
                                                            cafe.area ??
                                                            ""
                                                        }
                                                        onChange={(e) =>
                                                            updateChange(
                                                                "area",
                                                                e.target
                                                                    .value ||
                                                                    undefined
                                                            )
                                                        }
                                                        placeholder='e.g., Makati, BGC, Poblacion'
                                                        className={`w-full bg-text/5 text-sm placeholder:text-text/30 focus:outline-none p-3 rounded-lg border transition-all text-text ${
                                                            hasChange("area")
                                                                ? "border-primary/50 ring-2 ring-primary/20"
                                                                : "border-text/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                                                        }`}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Location Section */}
                                    <div className='border border-text/10 rounded-lg overflow-hidden'>
                                        <button
                                            onClick={() =>
                                                toggleSection("location")
                                            }
                                            className='w-full flex items-center justify-between p-3 bg-text/5 hover:bg-text/10 transition-colors cursor-pointer'
                                        >
                                            <span className='font-medium flex items-center gap-2'>
                                                <MapPin className='w-4 h-4' />
                                                Location Coordinates
                                                {(hasChange("lat") ||
                                                    hasChange("lng")) && (
                                                    <span className='text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full'>
                                                        Changed
                                                    </span>
                                                )}
                                            </span>
                                            {expandedSections.has(
                                                "location"
                                            ) ? (
                                                <ChevronUp className='w-4 h-4' />
                                            ) : (
                                                <ChevronDown className='w-4 h-4' />
                                            )}
                                        </button>

                                        {expandedSections.has("location") && (
                                            <div className='p-4 space-y-3'>
                                                {cafe.is_hidden_gem ? (
                                                    // Hidden gem: don't reveal exact coordinates
                                                    <>
                                                        <div className='flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700'>
                                                            <Sparkles className='w-4 h-4 shrink-0' />
                                                            <span>
                                                                This is a hidden
                                                                gem. Location
                                                                coordinates are
                                                                kept private.
                                                            </span>
                                                        </div>
                                                        {cafe.lat &&
                                                        cafe.lng ? (
                                                            <p className='text-xs text-text/60 flex items-center gap-1.5'>
                                                                <Check className='w-3.5 h-3.5 text-green-500' />
                                                                Location already
                                                                submitted
                                                            </p>
                                                        ) : (
                                                            <p className='text-xs text-text/60'>
                                                                No location set
                                                                yet. You can
                                                                submit one
                                                                below.
                                                            </p>
                                                        )}
                                                        <LocationPickerInner
                                                            lat={
                                                                changes.lat ??
                                                                null
                                                            }
                                                            lng={
                                                                changes.lng ??
                                                                null
                                                            }
                                                            onChange={(
                                                                newLat,
                                                                newLng
                                                            ) => {
                                                                updateChange(
                                                                    "lat",
                                                                    newLat
                                                                )
                                                                updateChange(
                                                                    "lng",
                                                                    newLng
                                                                )
                                                            }}
                                                        />
                                                    </>
                                                ) : (
                                                    // Regular cafe: show current location and allow editing
                                                    <>
                                                        <p className='text-xs text-text/60'>
                                                            Click on the map or
                                                            use the tools below
                                                            to update the
                                                            cafe&apos;s exact
                                                            location.
                                                        </p>
                                                        <LocationPickerInner
                                                            lat={
                                                                changes.lat ??
                                                                cafe.lat ??
                                                                null
                                                            }
                                                            lng={
                                                                changes.lng ??
                                                                cafe.lng ??
                                                                null
                                                            }
                                                            onChange={(
                                                                newLat,
                                                                newLng
                                                            ) => {
                                                                const currentLat =
                                                                    cafe.lat
                                                                const currentLng =
                                                                    cafe.lng

                                                                if (
                                                                    newLat !==
                                                                    currentLat
                                                                ) {
                                                                    updateChange(
                                                                        "lat",
                                                                        newLat
                                                                    )
                                                                } else {
                                                                    setChanges(
                                                                        (
                                                                            prev
                                                                        ) => {
                                                                            const rest =
                                                                                {
                                                                                    ...prev,
                                                                                }
                                                                            delete rest.lat
                                                                            return rest
                                                                        }
                                                                    )
                                                                }

                                                                if (
                                                                    newLng !==
                                                                    currentLng
                                                                ) {
                                                                    updateChange(
                                                                        "lng",
                                                                        newLng
                                                                    )
                                                                } else {
                                                                    setChanges(
                                                                        (
                                                                            prev
                                                                        ) => {
                                                                            const rest =
                                                                                {
                                                                                    ...prev,
                                                                                }
                                                                            delete rest.lng
                                                                            return rest
                                                                        }
                                                                    )
                                                                }
                                                            }}
                                                        />
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Chain Cafe Toggle */}
                                    <div className='border border-text/10 rounded-lg overflow-hidden'>
                                        <button
                                            onClick={() =>
                                                toggleSection("chain")
                                            }
                                            className='w-full flex items-center justify-between p-3 bg-text/5 hover:bg-text/10 transition-colors cursor-pointer'
                                        >
                                            <span className='font-medium flex items-center gap-2'>
                                                <Store className='w-4 h-4' />
                                                Chain Status
                                            </span>
                                            {expandedSections.has("chain") ? (
                                                <ChevronUp className='w-4 h-4' />
                                            ) : (
                                                <ChevronDown className='w-4 h-4' />
                                            )}
                                        </button>

                                        {expandedSections.has("chain") && (
                                            <div className='p-4 space-y-4'>
                                                <div className='flex items-center justify-between'>
                                                    <div className='flex items-center gap-3'>
                                                        <Store
                                                            className={`w-5 h-5 ${
                                                                (changes.is_chain ??
                                                                cafe.is_chain)
                                                                    ? "text-orange-500"
                                                                    : "text-text/40"
                                                            }`}
                                                        />
                                                        <div>
                                                            <p className='font-medium'>
                                                                Chain Cafe
                                                            </p>
                                                            <p className='text-sm text-text/60'>
                                                                Is this a
                                                                national/international
                                                                chain like
                                                                Starbucks or
                                                                Bo&apos;s
                                                                Coffee?
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() =>
                                                            updateChange(
                                                                "is_chain",
                                                                !(
                                                                    changes.is_chain ??
                                                                    cafe.is_chain
                                                                )
                                                            )
                                                        }
                                                        className={`relative inline-flex h-6 min-w-11 items-center rounded-full transition-colors cursor-pointer ${
                                                            (changes.is_chain ??
                                                            cafe.is_chain)
                                                                ? hasChange(
                                                                      "is_chain"
                                                                  )
                                                                    ? "bg-orange-500 ring-2 ring-primary/50"
                                                                    : "bg-orange-500"
                                                                : "bg-text/20"
                                                        }`}
                                                    >
                                                        <span
                                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                                (changes.is_chain ??
                                                                cafe.is_chain)
                                                                    ? "translate-x-6"
                                                                    : "translate-x-1"
                                                            }`}
                                                        />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Details Section */}
                                    <div className='border border-text/10 rounded-lg overflow-hidden'>
                                        <button
                                            onClick={() =>
                                                toggleSection("details")
                                            }
                                            className='w-full flex items-center justify-between p-3 bg-text/5 hover:bg-text/10 transition-colors cursor-pointer'
                                        >
                                            <span className='font-medium flex items-center gap-2'>
                                                <DollarSign className='w-4 h-4' />
                                                Details
                                            </span>
                                            {expandedSections.has("details") ? (
                                                <ChevronUp className='w-4 h-4' />
                                            ) : (
                                                <ChevronDown className='w-4 h-4' />
                                            )}
                                        </button>

                                        {expandedSections.has("details") && (
                                            <div className='p-4 space-y-4'>
                                                {/* Price Level */}
                                                <div className='space-y-2'>
                                                    <label className='text-sm font-medium text-text/60'>
                                                        Price Level
                                                    </label>
                                                    <div className='flex gap-2'>
                                                        {PRICE_LEVELS.map(
                                                            (level) => {
                                                                const currentValue =
                                                                    changes.price_level ??
                                                                    cafe.price_level
                                                                const isSelected =
                                                                    currentValue ===
                                                                    level.value

                                                                return (
                                                                    <button
                                                                        key={
                                                                            level.value
                                                                        }
                                                                        onClick={() =>
                                                                            updateChange(
                                                                                "price_level",
                                                                                level.value as
                                                                                    | "low"
                                                                                    | "medium"
                                                                                    | "high"
                                                                            )
                                                                        }
                                                                        className={`flex-1 p-3 rounded-lg border-2 transition-all cursor-pointer ${
                                                                            isSelected
                                                                                ? hasChange(
                                                                                      "price_level"
                                                                                  )
                                                                                    ? "border-primary bg-primary/20 text-primary"
                                                                                    : "border-text/30 bg-text/10 text-text"
                                                                                : "border-text/10 bg-text/5 text-text/50 hover:border-text/20"
                                                                        }`}
                                                                    >
                                                                        <div className='text-lg font-bold'>
                                                                            {
                                                                                level.label
                                                                            }
                                                                        </div>
                                                                        <div className='text-xs opacity-70'>
                                                                            {
                                                                                level.description
                                                                            }
                                                                        </div>
                                                                    </button>
                                                                )
                                                            }
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Coffee Style */}
                                                <div className='space-y-2'>
                                                    <label className='text-sm font-medium text-text/60'>
                                                        Coffee Style
                                                    </label>
                                                    <p className='text-xs text-text/40'>
                                                        Classic = traditional
                                                        espresso bar • Artisan =
                                                        craft/specialty focus
                                                    </p>
                                                    <div className='flex gap-2'>
                                                        {COFFEE_STYLES.map(
                                                            (style) => {
                                                                const currentValue =
                                                                    changes.coffee_style ??
                                                                    cafe.coffee_style
                                                                const isSelected =
                                                                    currentValue ===
                                                                    style.value

                                                                return (
                                                                    <button
                                                                        key={
                                                                            style.value
                                                                        }
                                                                        onClick={() =>
                                                                            updateChange(
                                                                                "coffee_style",
                                                                                style.value as
                                                                                    | "classic"
                                                                                    | "artisan"
                                                                            )
                                                                        }
                                                                        className={`flex-1 p-3 rounded-lg border-2 transition-all cursor-pointer text-left ${
                                                                            isSelected
                                                                                ? hasChange(
                                                                                      "coffee_style"
                                                                                  )
                                                                                    ? "border-primary bg-primary/20 text-primary"
                                                                                    : "border-text/30 bg-text/10 text-text"
                                                                                : "border-text/10 bg-text/5 text-text/50 hover:border-text/20"
                                                                        }`}
                                                                    >
                                                                        <div className='font-medium'>
                                                                            {
                                                                                style.label
                                                                            }
                                                                        </div>
                                                                        <div className='text-xs opacity-70'>
                                                                            {
                                                                                style.description
                                                                            }
                                                                        </div>
                                                                    </button>
                                                                )
                                                            }
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Payment Methods */}
                                                <div className='space-y-2'>
                                                    <label className='text-sm font-medium text-text/60'>
                                                        Payment Methods
                                                    </label>
                                                    <input
                                                        type='text'
                                                        value={
                                                            changes.payment_methods ??
                                                            cafe.payment_methods ??
                                                            ""
                                                        }
                                                        onChange={(e) =>
                                                            updateChange(
                                                                "payment_methods",
                                                                e.target
                                                                    .value ||
                                                                    undefined
                                                            )
                                                        }
                                                        placeholder='e.g., cash, card, gcash, maya'
                                                        className={`w-full bg-text/5 text-sm placeholder:text-text/30 focus:outline-none p-3 rounded-lg border transition-all text-text ${
                                                            hasChange(
                                                                "payment_methods"
                                                            )
                                                                ? "border-primary/50 ring-2 ring-primary/20"
                                                                : "border-text/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                                                        }`}
                                                    />
                                                    <p className='text-xs text-text/40'>
                                                        Separate multiple
                                                        methods with commas
                                                    </p>
                                                </div>

                                                {/* Roaster */}
                                                <div className='space-y-2'>
                                                    <label className='text-sm font-medium text-text/60'>
                                                        Coffee Roaster
                                                    </label>
                                                    <input
                                                        type='text'
                                                        value={
                                                            changes.roaster ??
                                                            cafe.roaster ??
                                                            ""
                                                        }
                                                        onChange={(e) =>
                                                            updateChange(
                                                                "roaster",
                                                                e.target
                                                                    .value ||
                                                                    undefined
                                                            )
                                                        }
                                                        placeholder='e.g., Yardstick, Henry & Sons'
                                                        className={`w-full bg-text/5 text-sm placeholder:text-text/30 focus:outline-none p-3 rounded-lg border transition-all text-text ${
                                                            hasChange("roaster")
                                                                ? "border-primary/50 ring-2 ring-primary/20"
                                                                : "border-text/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                                                        }`}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Amenities Section */}
                                    <div className='border border-text/10 rounded-lg overflow-hidden'>
                                        <button
                                            onClick={() =>
                                                toggleSection("amenities")
                                            }
                                            className='w-full flex items-center justify-between p-3 bg-text/5 hover:bg-text/10 transition-colors cursor-pointer'
                                        >
                                            <span className='font-medium flex items-center gap-2'>
                                                <Sparkles className='w-4 h-4' />
                                                Amenities
                                            </span>
                                            {expandedSections.has(
                                                "amenities"
                                            ) ? (
                                                <ChevronUp className='w-4 h-4' />
                                            ) : (
                                                <ChevronDown className='w-4 h-4' />
                                            )}
                                        </button>

                                        {expandedSections.has("amenities") && (
                                            <div className='p-4'>
                                                <div className='grid grid-cols-2 gap-2'>
                                                    {AMENITY_FIELDS.map(
                                                        ({
                                                            key,
                                                            label,
                                                            icon: Icon,
                                                        }) => {
                                                            const currentValue =
                                                                cafe[key] ??
                                                                false
                                                            const hasChanged =
                                                                changes[key] !==
                                                                undefined
                                                            const displayValue =
                                                                hasChanged
                                                                    ? changes[
                                                                          key
                                                                      ]
                                                                    : currentValue

                                                            return (
                                                                <button
                                                                    key={key}
                                                                    onClick={() =>
                                                                        toggleAmenity(
                                                                            key
                                                                        )
                                                                    }
                                                                    className={`flex items-center gap-2 p-3 rounded-lg border transition-all cursor-pointer text-left ${
                                                                        hasChanged
                                                                            ? displayValue
                                                                                ? "bg-primary/20 border-primary/40 text-primary"
                                                                                : "bg-red-500/10 border-red-500/30 text-red-500"
                                                                            : displayValue
                                                                              ? "bg-text/5 border-text/20 text-text"
                                                                              : "bg-text/5 border-text/10 text-text/40"
                                                                    }`}
                                                                >
                                                                    <Icon className='w-4 h-4' />
                                                                    <span className='text-sm font-medium'>
                                                                        {label}
                                                                    </span>
                                                                    {hasChanged && (
                                                                        <span className='ml-auto text-xs'>
                                                                            {displayValue
                                                                                ? "Adding"
                                                                                : "Removing"}
                                                                        </span>
                                                                    )}
                                                                </button>
                                                            )
                                                        }
                                                    )}
                                                </div>

                                                {/* Milk Options - conditional on has_non_dairy */}
                                                {(changes.has_non_dairy !==
                                                undefined
                                                    ? changes.has_non_dairy
                                                    : cafe.has_non_dairy) ===
                                                    true && (
                                                    <div className='mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg'>
                                                        <label className='text-sm font-medium text-text/60 block mb-2'>
                                                            Non-Dairy Milk
                                                            Options
                                                        </label>
                                                        <input
                                                            type='text'
                                                            value={
                                                                changes.milk_options !==
                                                                undefined
                                                                    ? (
                                                                          changes.milk_options as string[]
                                                                      ).join(
                                                                          ", "
                                                                      )
                                                                    : (
                                                                          cafe.milk_options ??
                                                                          []
                                                                      ).join(
                                                                          ", "
                                                                      )
                                                            }
                                                            onChange={(e) => {
                                                                const options =
                                                                    e.target.value
                                                                        .split(
                                                                            ","
                                                                        )
                                                                        .map(
                                                                            (
                                                                                s
                                                                            ) =>
                                                                                s.trim()
                                                                        )
                                                                        .filter(
                                                                            Boolean
                                                                        )
                                                                updateChange(
                                                                    "milk_options",
                                                                    options
                                                                )
                                                            }}
                                                            placeholder='Oat, Almond, Soy, Coconut...'
                                                            className={`w-full px-3 py-2 bg-background border rounded-lg text-sm outline-none transition-all ${
                                                                hasChange(
                                                                    "milk_options"
                                                                )
                                                                    ? "border-primary/50 ring-2 ring-primary/20"
                                                                    : "border-text/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                                                            }`}
                                                        />
                                                        <p className='text-xs text-text/40 mt-1'>
                                                            Comma-separated list
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Extras Section */}
                                    <div className='border border-text/10 rounded-lg overflow-hidden'>
                                        <button
                                            onClick={() =>
                                                toggleSection("extras")
                                            }
                                            className='w-full flex items-center justify-between p-3 bg-text/5 hover:bg-text/10 transition-colors cursor-pointer'
                                        >
                                            <span className='font-medium flex items-center gap-2'>
                                                <Coffee className='w-4 h-4' />
                                                Extras
                                            </span>
                                            {expandedSections.has("extras") ? (
                                                <ChevronUp className='w-4 h-4' />
                                            ) : (
                                                <ChevronDown className='w-4 h-4' />
                                            )}
                                        </button>

                                        {expandedSections.has("extras") && (
                                            <div className='p-4 space-y-4'>
                                                {/* Brew Methods */}
                                                <div className='space-y-2'>
                                                    <label className='text-sm font-medium text-text/60'>
                                                        Brew Methods
                                                    </label>
                                                    <div className='flex flex-wrap gap-2'>
                                                        {BREW_METHODS.map(
                                                            (method) => {
                                                                const isSelected =
                                                                    getEffectiveArray(
                                                                        "brew_methods"
                                                                    ).includes(
                                                                        method
                                                                    )
                                                                const originalHas =
                                                                    (
                                                                        cafe.brew_methods ??
                                                                        []
                                                                    ).includes(
                                                                        method
                                                                    )
                                                                const isChanged =
                                                                    isSelected !==
                                                                    originalHas

                                                                return (
                                                                    <button
                                                                        key={
                                                                            method
                                                                        }
                                                                        onClick={() =>
                                                                            toggleArrayItem(
                                                                                "brew_methods",
                                                                                method
                                                                            )
                                                                        }
                                                                        className={`px-3 py-1.5 text-sm rounded-full border transition-all cursor-pointer capitalize ${
                                                                            isSelected
                                                                                ? isChanged
                                                                                    ? "bg-primary/20 border-primary/40 text-primary"
                                                                                    : "bg-amber-500/20 border-amber-500/40 text-amber-700"
                                                                                : isChanged
                                                                                  ? "bg-red-500/10 border-red-500/30 text-red-500 line-through"
                                                                                  : "bg-text/5 border-text/10 text-text/50 hover:border-text/20"
                                                                        }`}
                                                                    >
                                                                        {method
                                                                            .split(
                                                                                "_"
                                                                            )
                                                                            .join(
                                                                                " "
                                                                            )}
                                                                        {isSelected &&
                                                                            isChanged && (
                                                                                <Check className='w-3 h-3 inline ml-1' />
                                                                            )}
                                                                    </button>
                                                                )
                                                            }
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Specialties */}
                                                <div className='space-y-2'>
                                                    <label className='text-sm font-medium text-text/60'>
                                                        Specialties
                                                    </label>
                                                    <div className='flex flex-wrap gap-2'>
                                                        {CAFE_SPECIALTIES.map(
                                                            (item) => {
                                                                const isSelected =
                                                                    getEffectiveArray(
                                                                        "specialty"
                                                                    ).includes(
                                                                        item
                                                                    )
                                                                const originalHas =
                                                                    (
                                                                        cafe.specialty ??
                                                                        []
                                                                    ).includes(
                                                                        item
                                                                    )
                                                                const isChanged =
                                                                    isSelected !==
                                                                    originalHas

                                                                return (
                                                                    <button
                                                                        key={
                                                                            item
                                                                        }
                                                                        onClick={() =>
                                                                            toggleArrayItem(
                                                                                "specialty",
                                                                                item
                                                                            )
                                                                        }
                                                                        className={`px-3 py-1.5 text-sm rounded-full border transition-all cursor-pointer capitalize ${
                                                                            isSelected
                                                                                ? isChanged
                                                                                    ? "bg-primary/20 border-primary/40 text-primary"
                                                                                    : "bg-primary/20 border-primary/40 text-text"
                                                                                : isChanged
                                                                                  ? "bg-red-500/10 border-red-500/30 text-red-500 line-through"
                                                                                  : "bg-text/5 border-text/10 text-text/50 hover:border-text/20"
                                                                        }`}
                                                                    >
                                                                        {item
                                                                            .split(
                                                                                "_"
                                                                            )
                                                                            .join(
                                                                                " "
                                                                            )}
                                                                        {isSelected &&
                                                                            isChanged && (
                                                                                <Check className='w-3 h-3 inline ml-1' />
                                                                            )}
                                                                    </button>
                                                                )
                                                            }
                                                        )}
                                                    </div>

                                                    {/* Custom Specialties Input */}
                                                    <div className='flex gap-2 mt-2'>
                                                        <input
                                                            type='text'
                                                            placeholder='Add custom (comma-separated)'
                                                            className='flex-1 px-3 py-2 bg-background border border-text/10 rounded-lg text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20'
                                                            onKeyDown={(e) => {
                                                                if (
                                                                    e.key ===
                                                                    "Enter"
                                                                ) {
                                                                    e.preventDefault()
                                                                    const input =
                                                                        e.currentTarget
                                                                    const items =
                                                                        input.value
                                                                            .split(
                                                                                ","
                                                                            )
                                                                            .map(
                                                                                (
                                                                                    s
                                                                                ) =>
                                                                                    s
                                                                                        .trim()
                                                                                        .toLowerCase()
                                                                                        .replace(
                                                                                            /\s+/g,
                                                                                            "_"
                                                                                        )
                                                                            )
                                                                            .filter(
                                                                                Boolean
                                                                            )
                                                                    if (
                                                                        items.length >
                                                                        0
                                                                    ) {
                                                                        const current =
                                                                            getEffectiveArray(
                                                                                "specialty"
                                                                            )
                                                                        const updated =
                                                                            [
                                                                                ...new Set(
                                                                                    [
                                                                                        ...current,
                                                                                        ...items,
                                                                                    ]
                                                                                ),
                                                                            ]
                                                                        updateChange(
                                                                            "specialty",
                                                                            updated
                                                                        )
                                                                        input.value =
                                                                            ""
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                        <button
                                                            type='button'
                                                            onClick={(e) => {
                                                                const input = e
                                                                    .currentTarget
                                                                    .previousElementSibling as HTMLInputElement
                                                                const items =
                                                                    input.value
                                                                        .split(
                                                                            ","
                                                                        )
                                                                        .map(
                                                                            (
                                                                                s
                                                                            ) =>
                                                                                s
                                                                                    .trim()
                                                                                    .toLowerCase()
                                                                                    .replace(
                                                                                        /\s+/g,
                                                                                        "_"
                                                                                    )
                                                                        )
                                                                        .filter(
                                                                            Boolean
                                                                        )
                                                                if (
                                                                    items.length >
                                                                    0
                                                                ) {
                                                                    const current =
                                                                        getEffectiveArray(
                                                                            "specialty"
                                                                        )
                                                                    const updated =
                                                                        [
                                                                            ...new Set(
                                                                                [
                                                                                    ...current,
                                                                                    ...items,
                                                                                ]
                                                                            ),
                                                                        ]
                                                                    updateChange(
                                                                        "specialty",
                                                                        updated
                                                                    )
                                                                    input.value =
                                                                        ""
                                                                }
                                                            }}
                                                            className='px-4 py-2 bg-primary text-background rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer'
                                                        >
                                                            Add
                                                        </button>
                                                    </div>

                                                    {/* Display custom specialties */}
                                                    {getEffectiveArray(
                                                        "specialty"
                                                    ).filter(
                                                        (s) =>
                                                            !CAFE_SPECIALTIES.includes(
                                                                s
                                                            )
                                                    ).length > 0 && (
                                                        <div className='flex flex-wrap gap-1 mt-2'>
                                                            {getEffectiveArray(
                                                                "specialty"
                                                            )
                                                                .filter(
                                                                    (s) =>
                                                                        !CAFE_SPECIALTIES.includes(
                                                                            s
                                                                        )
                                                                )
                                                                .map((item) => (
                                                                    <span
                                                                        key={
                                                                            item
                                                                        }
                                                                        className='inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full cursor-pointer hover:bg-primary/20'
                                                                        onClick={() =>
                                                                            toggleArrayItem(
                                                                                "specialty",
                                                                                item
                                                                            )
                                                                        }
                                                                    >
                                                                        {item.replace(
                                                                            /_/g,
                                                                            " "
                                                                        )}
                                                                        <XIcon className='w-3 h-3' />
                                                                    </span>
                                                                ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Tags / Vibe */}
                                                <div className='space-y-2'>
                                                    <label className='text-sm font-medium text-text/60'>
                                                        Vibe / Tags
                                                    </label>
                                                    <div className='flex flex-wrap gap-2'>
                                                        {CAFE_VIBE_TAGS.map(
                                                            (tag) => {
                                                                const isSelected =
                                                                    getEffectiveArray(
                                                                        "tags"
                                                                    ).includes(
                                                                        tag
                                                                    )
                                                                const originalHas =
                                                                    (
                                                                        cafe.tags ??
                                                                        []
                                                                    ).includes(
                                                                        tag
                                                                    )
                                                                const isChanged =
                                                                    isSelected !==
                                                                    originalHas

                                                                return (
                                                                    <button
                                                                        key={
                                                                            tag
                                                                        }
                                                                        onClick={() =>
                                                                            toggleArrayItem(
                                                                                "tags",
                                                                                tag
                                                                            )
                                                                        }
                                                                        className={`px-3 py-1.5 text-sm rounded-full border transition-all cursor-pointer capitalize ${
                                                                            isSelected
                                                                                ? isChanged
                                                                                    ? "bg-primary/20 border-primary/40 text-primary"
                                                                                    : "bg-text/10 border-text/20 text-text/80"
                                                                                : isChanged
                                                                                  ? "bg-red-500/10 border-red-500/30 text-red-500 line-through"
                                                                                  : "bg-text/5 border-text/10 text-text/50 hover:border-text/20"
                                                                        }`}
                                                                    >
                                                                        {tag
                                                                            .split(
                                                                                "_"
                                                                            )
                                                                            .join(
                                                                                " "
                                                                            )}
                                                                        {isSelected &&
                                                                            isChanged && (
                                                                                <Check className='w-3 h-3 inline ml-1' />
                                                                            )}
                                                                    </button>
                                                                )
                                                            }
                                                        )}
                                                    </div>

                                                    {/* Custom Tags Input */}
                                                    <div className='flex gap-2 mt-2'>
                                                        <input
                                                            type='text'
                                                            placeholder='Add custom (comma-separated)'
                                                            className='flex-1 px-3 py-2 bg-background border border-text/10 rounded-lg text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20'
                                                            onKeyDown={(e) => {
                                                                if (
                                                                    e.key ===
                                                                    "Enter"
                                                                ) {
                                                                    e.preventDefault()
                                                                    const input =
                                                                        e.currentTarget
                                                                    const items =
                                                                        input.value
                                                                            .split(
                                                                                ","
                                                                            )
                                                                            .map(
                                                                                (
                                                                                    s
                                                                                ) =>
                                                                                    s
                                                                                        .trim()
                                                                                        .toLowerCase()
                                                                                        .replace(
                                                                                            /\s+/g,
                                                                                            "_"
                                                                                        )
                                                                            )
                                                                            .filter(
                                                                                Boolean
                                                                            )
                                                                    if (
                                                                        items.length >
                                                                        0
                                                                    ) {
                                                                        const current =
                                                                            getEffectiveArray(
                                                                                "tags"
                                                                            )
                                                                        const updated =
                                                                            [
                                                                                ...new Set(
                                                                                    [
                                                                                        ...current,
                                                                                        ...items,
                                                                                    ]
                                                                                ),
                                                                            ]
                                                                        updateChange(
                                                                            "tags",
                                                                            updated
                                                                        )
                                                                        input.value =
                                                                            ""
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                        <button
                                                            type='button'
                                                            onClick={(e) => {
                                                                const input = e
                                                                    .currentTarget
                                                                    .previousElementSibling as HTMLInputElement
                                                                const items =
                                                                    input.value
                                                                        .split(
                                                                            ","
                                                                        )
                                                                        .map(
                                                                            (
                                                                                s
                                                                            ) =>
                                                                                s
                                                                                    .trim()
                                                                                    .toLowerCase()
                                                                                    .replace(
                                                                                        /\s+/g,
                                                                                        "_"
                                                                                    )
                                                                        )
                                                                        .filter(
                                                                            Boolean
                                                                        )
                                                                if (
                                                                    items.length >
                                                                    0
                                                                ) {
                                                                    const current =
                                                                        getEffectiveArray(
                                                                            "tags"
                                                                        )
                                                                    const updated =
                                                                        [
                                                                            ...new Set(
                                                                                [
                                                                                    ...current,
                                                                                    ...items,
                                                                                ]
                                                                            ),
                                                                        ]
                                                                    updateChange(
                                                                        "tags",
                                                                        updated
                                                                    )
                                                                    input.value =
                                                                        ""
                                                                }
                                                            }}
                                                            className='px-4 py-2 bg-primary text-background rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer'
                                                        >
                                                            Add
                                                        </button>
                                                    </div>

                                                    {/* Display custom tags */}
                                                    {getEffectiveArray(
                                                        "tags"
                                                    ).filter(
                                                        (t) =>
                                                            !CAFE_VIBE_TAGS.includes(
                                                                t
                                                            )
                                                    ).length > 0 && (
                                                        <div className='flex flex-wrap gap-1 mt-2'>
                                                            {getEffectiveArray(
                                                                "tags"
                                                            )
                                                                .filter(
                                                                    (t) =>
                                                                        !CAFE_VIBE_TAGS.includes(
                                                                            t
                                                                        )
                                                                )
                                                                .map((item) => (
                                                                    <span
                                                                        key={
                                                                            item
                                                                        }
                                                                        className='inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full cursor-pointer hover:bg-primary/20'
                                                                        onClick={() =>
                                                                            toggleArrayItem(
                                                                                "tags",
                                                                                item
                                                                            )
                                                                        }
                                                                    >
                                                                        {item.replace(
                                                                            /_/g,
                                                                            " "
                                                                        )}
                                                                        <XIcon className='w-3 h-3' />
                                                                    </span>
                                                                ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Contact Section */}
                                    <div className='border border-text/10 rounded-lg overflow-hidden'>
                                        <button
                                            onClick={() =>
                                                toggleSection("contact")
                                            }
                                            className='w-full flex items-center justify-between p-3 bg-text/5 hover:bg-text/10 transition-colors cursor-pointer'
                                        >
                                            <span className='font-medium flex items-center gap-2'>
                                                <Phone className='w-4 h-4' />
                                                Contact Information
                                            </span>
                                            {expandedSections.has("contact") ? (
                                                <ChevronUp className='w-4 h-4' />
                                            ) : (
                                                <ChevronDown className='w-4 h-4' />
                                            )}
                                        </button>

                                        {expandedSections.has("contact") && (
                                            <div className='p-4 space-y-4'>
                                                {/* Phone */}
                                                <div className='space-y-2'>
                                                    <label className='text-sm font-medium text-text/60'>
                                                        Phone
                                                    </label>
                                                    <input
                                                        type='tel'
                                                        value={
                                                            changes.phone ??
                                                            cafe.phone ??
                                                            ""
                                                        }
                                                        onChange={(e) =>
                                                            updateChange(
                                                                "phone",
                                                                e.target
                                                                    .value ||
                                                                    undefined
                                                            )
                                                        }
                                                        placeholder='Phone number'
                                                        className={`w-full bg-text/5 text-sm placeholder:text-text/30 focus:outline-none p-3 rounded-lg border transition-all text-text ${
                                                            hasChange("phone")
                                                                ? "border-primary/50 ring-2 ring-primary/20"
                                                                : "border-text/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                                                        }`}
                                                    />
                                                </div>

                                                {/* Email */}
                                                <div className='space-y-2'>
                                                    <label className='text-sm font-medium text-text/60'>
                                                        Email
                                                    </label>
                                                    <input
                                                        type='email'
                                                        value={
                                                            changes.email ??
                                                            cafe.email ??
                                                            ""
                                                        }
                                                        onChange={(e) =>
                                                            updateChange(
                                                                "email",
                                                                e.target
                                                                    .value ||
                                                                    undefined
                                                            )
                                                        }
                                                        placeholder='Email address'
                                                        className={`w-full bg-text/5 text-sm placeholder:text-text/30 focus:outline-none p-3 rounded-lg border transition-all text-text ${
                                                            hasChange("email")
                                                                ? "border-primary/50 ring-2 ring-primary/20"
                                                                : "border-text/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                                                        }`}
                                                    />
                                                </div>

                                                {/* Website */}
                                                <div className='space-y-2'>
                                                    <label className='text-sm font-medium text-text/60'>
                                                        Website
                                                    </label>
                                                    <input
                                                        type='url'
                                                        value={
                                                            changes.website_url ??
                                                            cafe.website_url ??
                                                            ""
                                                        }
                                                        onChange={(e) =>
                                                            updateChange(
                                                                "website_url",
                                                                e.target
                                                                    .value ||
                                                                    undefined
                                                            )
                                                        }
                                                        placeholder='https://example.com'
                                                        className={`w-full bg-text/5 text-sm placeholder:text-text/30 focus:outline-none p-3 rounded-lg border transition-all text-text ${
                                                            hasChange(
                                                                "website_url"
                                                            )
                                                                ? "border-primary/50 ring-2 ring-primary/20"
                                                                : "border-text/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                                                        }`}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Operating Hours Section */}
                                    <div className='border border-text/10 rounded-lg overflow-hidden'>
                                        <button
                                            onClick={() =>
                                                toggleSection("hours")
                                            }
                                            className='w-full flex items-center justify-between p-3 bg-text/5 hover:bg-text/10 transition-colors cursor-pointer'
                                        >
                                            <span className='font-medium flex items-center gap-2'>
                                                <Clock className='w-4 h-4' />
                                                Operating Hours
                                                {hasChange(
                                                    "operating_hours"
                                                ) && (
                                                    <span className='text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full'>
                                                        Modified
                                                    </span>
                                                )}
                                            </span>
                                            {expandedSections.has("hours") ? (
                                                <ChevronUp className='w-4 h-4' />
                                            ) : (
                                                <ChevronDown className='w-4 h-4' />
                                            )}
                                        </button>

                                        {expandedSections.has("hours") && (
                                            <div className='p-4'>
                                                <OperatingHoursEditor
                                                    value={
                                                        (changes.operating_hours as OperatingHour[]) ??
                                                        cafe.operating_hours ??
                                                        []
                                                    }
                                                    onChange={(hours) =>
                                                        updateChange(
                                                            "operating_hours",
                                                            hours
                                                        )
                                                    }
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Social Links Section */}
                                    <div className='border border-text/10 rounded-lg overflow-hidden'>
                                        <button
                                            onClick={() =>
                                                toggleSection("socials")
                                            }
                                            className='w-full flex items-center justify-between p-3 bg-text/5 hover:bg-text/10 transition-colors cursor-pointer'
                                        >
                                            <span className='font-medium flex items-center gap-2'>
                                                <LinkIcon className='w-4 h-4' />
                                                Social Links
                                                {hasChange("socials") && (
                                                    <span className='text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full'>
                                                        Modified
                                                    </span>
                                                )}
                                            </span>
                                            {expandedSections.has("socials") ? (
                                                <ChevronUp className='w-4 h-4' />
                                            ) : (
                                                <ChevronDown className='w-4 h-4' />
                                            )}
                                        </button>

                                        {expandedSections.has("socials") && (
                                            <div className='p-4'>
                                                <SocialLinksEditor
                                                    value={
                                                        (changes.socials as CafeSocial[]) ??
                                                        (cafe.socials as CafeSocial[]) ??
                                                        []
                                                    }
                                                    onChange={(socials) =>
                                                        updateChange(
                                                            "socials",
                                                            socials
                                                        )
                                                    }
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Images Section */}
                                    <div className='border border-text/10 rounded-lg overflow-hidden'>
                                        <button
                                            onClick={() =>
                                                toggleSection("images")
                                            }
                                            className='w-full flex items-center justify-between p-3 bg-text/5 hover:bg-text/10 transition-colors cursor-pointer'
                                        >
                                            <span className='font-medium flex items-center gap-2'>
                                                <ImagePlus className='w-4 h-4' />
                                                Images
                                                {imageChangeCount > 0 && (
                                                    <span className='text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full'>
                                                        {imageChangeCount}{" "}
                                                        change
                                                        {imageChangeCount !== 1
                                                            ? "s"
                                                            : ""}
                                                    </span>
                                                )}
                                            </span>
                                            {expandedSections.has("images") ? (
                                                <ChevronUp className='w-4 h-4' />
                                            ) : (
                                                <ChevronDown className='w-4 h-4' />
                                            )}
                                        </button>

                                        {expandedSections.has("images") && (
                                            <div className='p-4 space-y-6'>
                                                {/* Cover Photo */}
                                                <div className='space-y-3'>
                                                    <label className='text-sm font-medium text-text/60'>
                                                        Cover Photo
                                                    </label>
                                                    <div className='flex items-start gap-4'>
                                                        {/* Current or Preview */}
                                                        <div className='relative w-32 h-20 rounded-lg overflow-hidden bg-text/5 border border-text/10 shrink-0'>
                                                            {thumbnailPreview ? (
                                                                <Image
                                                                    src={
                                                                        thumbnailPreview
                                                                    }
                                                                    alt='New cover preview'
                                                                    fill
                                                                    className='object-cover'
                                                                />
                                                            ) : cafe.thumbnail ? (
                                                                <Image
                                                                    src={getCafeThumbnailUrl(
                                                                        cafe.thumbnail
                                                                    )}
                                                                    alt={
                                                                        cafe.name
                                                                    }
                                                                    fill
                                                                    className='object-cover'
                                                                />
                                                            ) : (
                                                                <div className='w-full h-full flex items-center justify-center text-text opacity-30'>
                                                                    <ImagePlus className='w-6 h-6' />
                                                                </div>
                                                            )}
                                                            {thumbnailPreview && (
                                                                <div className='absolute top-1 right-1 px-1.5 py-0.5 bg-primary text-white text-[10px] font-medium rounded'>
                                                                    NEW
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className='flex-1 space-y-2'>
                                                            <label className='flex items-center gap-2 px-3 py-2 bg-text/5 hover:bg-text/10 rounded-lg border border-text/10 cursor-pointer transition-colors text-sm'>
                                                                <Upload className='w-4 h-4' />
                                                                <span>
                                                                    {newThumbnail
                                                                        ? "Change photo"
                                                                        : "Upload new cover"}
                                                                </span>
                                                                <input
                                                                    type='file'
                                                                    accept='image/*'
                                                                    className='hidden'
                                                                    onChange={(
                                                                        e
                                                                    ) => {
                                                                        const file =
                                                                            e
                                                                                .target
                                                                                .files?.[0]
                                                                        if (
                                                                            file
                                                                        ) {
                                                                            handleCoverPhotoSelect(
                                                                                file
                                                                            )
                                                                        }
                                                                    }}
                                                                />
                                                            </label>
                                                            {newThumbnail && (
                                                                <button
                                                                    onClick={() => {
                                                                        setNewThumbnail(
                                                                            null
                                                                        )
                                                                        if (
                                                                            thumbnailPreview
                                                                        ) {
                                                                            URL.revokeObjectURL(
                                                                                thumbnailPreview
                                                                            )
                                                                        }
                                                                        setThumbnailPreview(
                                                                            null
                                                                        )
                                                                    }}
                                                                    className='text-xs text-red-500 hover:underline cursor-pointer'
                                                                >
                                                                    Remove new
                                                                    photo
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Gallery */}
                                                <div className='space-y-3'>
                                                    <label className='text-sm font-medium text-text/60'>
                                                        Gallery Photos
                                                    </label>

                                                    {/* Existing Gallery - Mark for Removal */}
                                                    {cafe.gallery &&
                                                        cafe.gallery.length >
                                                            0 && (
                                                            <div className='space-y-2'>
                                                                <p className='text-xs text-text/40'>
                                                                    Click to
                                                                    mark for
                                                                    removal
                                                                </p>
                                                                <div className='flex flex-wrap gap-2'>
                                                                    {cafe.gallery.map(
                                                                        (
                                                                            url,
                                                                            idx
                                                                        ) => {
                                                                            const isMarkedForRemoval =
                                                                                removeFromGallery.includes(
                                                                                    url
                                                                                )
                                                                            return (
                                                                                <button
                                                                                    key={
                                                                                        idx
                                                                                    }
                                                                                    onClick={() => {
                                                                                        if (
                                                                                            isMarkedForRemoval
                                                                                        ) {
                                                                                            setRemoveFromGallery(
                                                                                                (
                                                                                                    prev
                                                                                                ) =>
                                                                                                    prev.filter(
                                                                                                        (
                                                                                                            u
                                                                                                        ) =>
                                                                                                            u !==
                                                                                                            url
                                                                                                    )
                                                                                            )
                                                                                        } else {
                                                                                            setRemoveFromGallery(
                                                                                                (
                                                                                                    prev
                                                                                                ) => [
                                                                                                    ...prev,
                                                                                                    url,
                                                                                                ]
                                                                                            )
                                                                                        }
                                                                                    }}
                                                                                    className={`relative w-16 h-16 rounded overflow-hidden border-2 transition-all cursor-pointer ${
                                                                                        isMarkedForRemoval
                                                                                            ? "border-red-500 opacity-50"
                                                                                            : "border-transparent hover:border-text/30"
                                                                                    }`}
                                                                                >
                                                                                    <Image
                                                                                        src={
                                                                                            url
                                                                                        }
                                                                                        alt={`Gallery ${idx + 1}`}
                                                                                        fill
                                                                                        className='object-cover'
                                                                                    />
                                                                                    {isMarkedForRemoval && (
                                                                                        <div className='absolute inset-0 flex items-center justify-center bg-red-500/50'>
                                                                                            <Trash2 className='w-4 h-4 text-white' />
                                                                                        </div>
                                                                                    )}
                                                                                </button>
                                                                            )
                                                                        }
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}

                                                    {/* Add New Gallery Photos - using ImageUpload component */}
                                                    <div className='space-y-2'>
                                                        <p className='text-xs text-text/40'>
                                                            Add new photos (drag
                                                            to reorder)
                                                        </p>
                                                        <ImageUpload
                                                            value={
                                                                newGalleryFiles
                                                            }
                                                            onChange={(files) =>
                                                                setNewGalleryFiles(
                                                                    files.filter(
                                                                        (
                                                                            f
                                                                        ): f is File =>
                                                                            f instanceof
                                                                            File
                                                                    )
                                                                )
                                                            }
                                                            maxImages={0}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Error Display */}
                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className='text-center text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200'
                                        >
                                            {error}
                                        </motion.div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        {!success && (
                            <div className='p-4 border-t border-text/10 flex items-center justify-between gap-4'>
                                <div className='text-sm text-text/60'>
                                    {changesCount > 0 ? (
                                        <span className='text-primary font-medium'>
                                            {changesCount} change
                                            {changesCount !== 1 ? "s" : ""}{" "}
                                            pending
                                        </span>
                                    ) : (
                                        <span>No changes yet</span>
                                    )}
                                </div>
                                <button
                                    onClick={handleSubmit}
                                    disabled={
                                        isSubmitting || changesCount === 0
                                    }
                                    className='px-6 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer'
                                >
                                    {isSubmitting && (
                                        <Loader2 className='w-4 h-4 animate-spin' />
                                    )}
                                    {uploadingImages
                                        ? "Uploading images..."
                                        : isSubmitting
                                          ? "Submitting..."
                                          : "Submit Suggestion"}
                                </button>
                            </div>
                        )}
                    </motion.div>
                </React.Fragment>
            )}

            {/* Image Cropper Modal */}
            <ImageCropper
                open={cropperOpen}
                image={croppingImage}
                aspect={16 / 9}
                onComplete={handleCropComplete}
                onCancel={() => {
                    setCropperOpen(false)
                    setCroppingImage(null)
                }}
            />
        </AnimatePresence>
    )
}
