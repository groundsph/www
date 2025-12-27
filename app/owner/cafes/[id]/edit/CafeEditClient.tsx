"use client"

import { useState, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import {
    ArrowLeft,
    Save,
    MapPin,
    DollarSign,
    Loader2,
    Coffee,
    Clock,
    Phone,
    Settings,
    FileText,
    Trash2,
    ImagePlus,
    Upload,
    ChevronLeft,
    ChevronRight,
    X,
    Eye,
    Edit3,
} from "lucide-react"
import { Reorder } from "motion/react"
import {
    updateCafeAsOwner,
    deleteCafeImageAsOwner,
    updateCafeStory,
} from "@/app/api/actions/owner"
import { uploadCafeImageClient } from "@/utils/supabase/storage-client"
import { CafeWithRatings } from "@/utils/types/extra"
import { OperatingHour, CafeSocial } from "@/utils/types/cafe"
import {
    CAFE_VIBE_TAGS,
    CAFE_SPECIALTIES,
    BREW_METHODS,
    PAYMENT_METHODS,
} from "@/utils/data/philippines"
import AmenityToggles from "@/components/submit/AmenityToggles"
import OperatingHoursEditor from "@/components/submit/OperatingHoursEditor"
import SocialLinksEditor from "@/components/submit/SocialLinksEditor"
import LocationPicker from "@/components/submit/LocationPicker"
import { Database } from "@/utils/types/database.types"
import { resizeImage } from "@/utils/image-processing"
import { useNotification } from "@/components/NotificationProvider"
import ImageCropper from "@/components/ui/ImageCropper"
import { getCafeThumbnailUrl } from "@/utils/extras"

type PriceLevel = Database["public"]["Enums"]["price_level"]

interface CafeEditClientProps {
    cafe: CafeWithRatings
}

// Helper to convert snake_case to Title Case
const formatLabel = (s: string) =>
    s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

export default function CafeEditClient({
    cafe: initialCafe,
}: CafeEditClientProps) {
    const { addNotification } = useNotification()
    const [cafe, setCafe] = useState(initialCafe)
    const [saving, setSaving] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)
    const [activeSection, setActiveSection] = useState<
        | "basic"
        | "images"
        | "location"
        | "amenities"
        | "hours"
        | "contact"
        | "story"
    >("basic")

    // Image management state
    const [uploadingCover, setUploadingCover] = useState(false)
    const [uploadingGallery, setUploadingGallery] = useState(false)

    // Custom inputs for comma-separated values
    const [customSpecialties, setCustomSpecialties] = useState("")
    const [customTags, setCustomTags] = useState("")

    // Cropper State
    const [croppingImage, setCroppingImage] = useState<File | null>(null)
    const [cropperOpen, setCropperOpen] = useState(false)

    // Helper for aspect ratio
    const checkAspectRatio = (file: File): Promise<boolean> => {
        return new Promise((resolve) => {
            const img = new window.Image()
            img.onload = () => {
                const aspect = img.width / img.height
                // Allow some tolerance for 16:9
                const is16by9 = Math.abs(aspect - 16 / 9) < 0.05
                resolve(is16by9)
            }
            img.src = URL.createObjectURL(file)
        })
    }

    // Story state
    const [storyContent, setStoryContent] = useState(
        initialCafe.story?.content || ""
    )
    const [storyPreview, setStoryPreview] = useState(false)
    const [savingStory, setSavingStory] = useState(false)
    const [storyHasChanges, setStoryHasChanges] = useState(false)

    const updateField = useCallback(
        <K extends keyof typeof cafe>(key: K, value: (typeof cafe)[K]) => {
            setCafe((prev) => ({ ...prev, [key]: value }))
            setHasChanges(true)
        },
        []
    )

    // Manual Cropper Handlers
    const handleThumbnailChange = async (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = e.target.files?.[0]
        if (!file) return

        const is16by9 = await checkAspectRatio(file)

        if (is16by9) {
            setUploadingCover(true)
            const result = await uploadCafeImageClient(file)
            setUploadingCover(false)

            if (result.success && result.url) {
                if (cafe.thumbnail) {
                    await deleteCafeImageAsOwner(cafe.id, cafe.thumbnail)
                }
                updateField("thumbnail", result.url)
            }
        } else {
            setCroppingImage(file)
            setCropperOpen(true)
        }
        e.target.value = ""
    }

    const handleCropComplete = useCallback(
        async (croppedBlob: Blob) => {
            const file = new File(
                [croppedBlob],
                croppingImage?.name || "cover.webp",
                {
                    type: "image/webp",
                    lastModified: Date.now(),
                }
            )

            // Resize if needed
            const finalFile = await resizeImage(file, {
                maxWidth: 2560,
                maxHeight: 1440,
                quality: 0.9,
                format: "image/webp",
            })

            setUploadingCover(true)
            const result = await uploadCafeImageClient(finalFile)
            setUploadingCover(false)

            if (result.success && result.url) {
                if (cafe.thumbnail) {
                    await deleteCafeImageAsOwner(cafe.id, cafe.thumbnail)
                }
                updateField("thumbnail", result.url)
            } else {
                addNotification(
                    result.error || "Failed to upload image",
                    "error"
                )
            }

            setCropperOpen(false)
            setCroppingImage(null)
        },
        [croppingImage, cafe.thumbnail, updateField, cafe.id, addNotification]
    )

    const moveGalleryImage = (index: number, direction: "left" | "right") => {
        const currentGallery = cafe.gallery || []
        if (
            (direction === "left" && index === 0) ||
            (direction === "right" && index === currentGallery.length - 1)
        ) {
            return
        }

        const newIndex = direction === "left" ? index - 1 : index + 1
        const newGallery = [...currentGallery]
        const [movedItem] = newGallery.splice(index, 1)
        newGallery.splice(newIndex, 0, movedItem)
        updateField("gallery", newGallery)
    }

    const handleSave = async () => {
        setSaving(true)
        const result = await updateCafeAsOwner(cafe.id, {
            name: cafe.name,
            description: cafe.description || undefined,
            address_display: cafe.address_display,
            area: cafe.area || undefined,
            lat: cafe.lat || undefined,
            lng: cafe.lng || undefined,
            has_wifi: cafe.has_wifi || false,
            has_sockets: cafe.has_sockets || false,
            has_parking: cafe.has_parking || false,
            has_aircon: cafe.has_aircon || false,
            is_pet_friendly: cafe.is_pet_friendly || false,
            has_outdoor_seating: cafe.has_outdoor_seating || false,
            serves_food: cafe.serves_food || false,
            is_work_friendly: cafe.is_work_friendly || false,
            price_level: cafe.price_level || "medium",
            specialty: cafe.specialty || [],
            tags: cafe.tags || [],
            brew_methods: cafe.brew_methods || [],
            payment_methods: cafe.payment_methods || "",
            roaster: cafe.roaster || undefined,
            operating_hours: cafe.operating_hours || [],
            website_url: cafe.website_url || undefined,
            phone: cafe.phone || undefined,
            email: cafe.email || undefined,
            socials: cafe.socials || [],
        })
        setSaving(false)
        if (result.success) {
            setHasChanges(false)
            addNotification("Changes saved successfully", "success")
        } else {
            addNotification(result.error || "Failed to save changes", "error")
        }
    }

    // Add custom specialties
    const addCustomSpecialties = () => {
        if (!customSpecialties.trim()) return
        const newItems = customSpecialties
            .split(",")
            .map((s) => s.trim().toLowerCase().replace(/\s+/g, "_"))
            .filter((s) => s && !cafe.specialty?.includes(s))
        if (newItems.length > 0) {
            updateField("specialty", [
                ...(cafe.specialty || []),
                ...newItems,
            ] as string[])
        }
        setCustomSpecialties("")
    }

    // Add custom tags
    const addCustomTags = () => {
        if (!customTags.trim()) return
        const newItems = customTags
            .split(",")
            .map((s) => s.trim().toLowerCase().replace(/\s+/g, "_"))
            .filter((s) => s && !cafe.tags?.includes(s))
        if (newItems.length > 0) {
            updateField("tags", [...(cafe.tags || []), ...newItems] as string[])
        }
        setCustomTags("")
    }

    const SECTIONS = [
        { id: "basic", title: "Basic Info", icon: Coffee },
        { id: "images", title: "Images", icon: ImagePlus },
        { id: "location", title: "Location", icon: MapPin },
        { id: "amenities", title: "Amenities", icon: Settings },
        { id: "hours", title: "Hours", icon: Clock },
        { id: "contact", title: "Contact", icon: Phone },
        { id: "story", title: "Story", icon: FileText },
    ] as const

    // Price level mapping for UI
    const PRICE_LEVELS: { value: PriceLevel; level: number }[] = [
        { value: "low", level: 1 },
        { value: "medium", level: 2 },
        { value: "high", level: 3 },
    ]

    return (
        <div className='w-full overflow-hidden space-y-6 [&_button]:cursor-pointer'>
            {/* Header with actions */}
            <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-text/10'>
                <div className='flex items-center gap-4'>
                    <Link
                        href={`/owner/cafes/${cafe.id}`}
                        className='p-2 hover:bg-text/5 rounded-lg transition'
                    >
                        <ArrowLeft className='w-5 h-5' />
                    </Link>
                    <div>
                        <h1 className='text-2xl font-bold font-serif'>
                            Edit {cafe.name}
                        </h1>
                        <p className='text-text/60 text-sm'>
                            Update your cafe information
                        </p>
                    </div>
                </div>
                <div className='flex items-center gap-2'>
                    {hasChanges && (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className='flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition disabled:opacity-50'
                        >
                            {saving ? (
                                <Loader2 className='w-4 h-4 animate-spin' />
                            ) : (
                                <Save className='w-4 h-4' />
                            )}
                            Save Changes
                        </button>
                    )}
                </div>
            </div>

            {/* Section Tabs */}
            <div className='flex gap-2 overflow-x-auto pb-2'>
                {SECTIONS.map(({ id, title, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActiveSection(id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition border ${
                            activeSection === id
                                ? "bg-primary/20 text-primary border-primary/30"
                                : "bg-text/5 border-text/10 hover:bg-text/10"
                        }`}
                    >
                        <Icon className='w-4 h-4' />
                        {title}
                    </button>
                ))}
            </div>

            {/* Cover Image */}
            <div className='relative h-auto aspect-6/2 rounded-xl overflow-hidden bg-text/5'>
                {cafe.thumbnail ? (
                    <>
                        <Image
                            src={getCafeThumbnailUrl(cafe.thumbnail)}
                            alt={cafe.name}
                            fill
                            className='object-cover'
                        />
                        {cafe.thumbnail === "placeholder" && (
                            <div className='absolute top-3 left-3 px-2 py-1 bg-amber-500/90 text-white text-xs font-medium rounded'>
                                Placeholder Image
                            </div>
                        )}
                    </>
                ) : (
                    <div className='w-full h-full flex items-center justify-center text-text/30'>
                        No cover image
                    </div>
                )}
            </div>

            {/* Section Content */}
            <div className='w-full min-h-[400px] bg-text/5 border border-text/10 rounded-xl p-6'>
                {/* Basic Info */}
                {activeSection === "basic" && (
                    <div className='space-y-6'>
                        <div>
                            <label className='block text-sm font-medium text-text/60 mb-2'>
                                Cafe Name *
                            </label>
                            <input
                                type='text'
                                value={cafe.name}
                                onChange={(e) =>
                                    updateField("name", e.target.value)
                                }
                                className='w-full px-4 py-3 bg-background border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50'
                            />
                        </div>

                        <div>
                            <label className='block text-sm font-medium text-text/60 mb-2'>
                                Description
                            </label>
                            <textarea
                                value={cafe.description || ""}
                                onChange={(e) => {
                                    if (e.target.value.length <= 300) {
                                        updateField(
                                            "description",
                                            e.target.value
                                        )
                                    }
                                }}
                                maxLength={300}
                                rows={4}
                                className='w-full px-4 py-3 bg-background border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none'
                                placeholder='Tell us about this cafe...'
                            />
                            <p
                                className={`text-xs mt-1 ${(cafe.description?.length || 0) >= 270 ? "text-orange-500" : "text-text/40"}`}
                            >
                                {300 - (cafe.description?.length || 0)}{" "}
                                characters remaining
                            </p>
                        </div>

                        <div>
                            <label className='block text-sm font-medium text-text/60 mb-2'>
                                Price Level
                            </label>
                            <div className='flex gap-2'>
                                {PRICE_LEVELS.map(({ value, level }) => (
                                    <button
                                        key={value}
                                        onClick={() =>
                                            updateField("price_level", value)
                                        }
                                        className={`flex items-center gap-1 px-4 py-2 rounded-lg border transition ${
                                            cafe.price_level === value
                                                ? "bg-primary/20 border-primary text-primary"
                                                : "bg-background border-text/10 hover:bg-text/5"
                                        }`}
                                    >
                                        {Array(level)
                                            .fill(0)
                                            .map((_, i) => (
                                                <DollarSign
                                                    key={i}
                                                    className='w-4 h-4'
                                                />
                                            ))}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className='block text-sm font-medium text-text/60 mb-2'>
                                Roaster
                            </label>
                            <input
                                type='text'
                                value={cafe.roaster || ""}
                                onChange={(e) =>
                                    updateField("roaster", e.target.value)
                                }
                                placeholder='Coffee roaster name'
                                className='w-full px-4 py-3 bg-background border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50'
                            />
                        </div>

                        {/* Gallery Preview */}
                        {cafe.gallery && cafe.gallery.length > 0 && (
                            <div>
                                <label className='block text-sm font-medium text-text/60 mb-2'>
                                    Gallery ({cafe.gallery.length} images)
                                </label>
                                <div className='grid grid-cols-4 sm:grid-cols-6 gap-2'>
                                    {cafe.gallery.map((url, idx) => (
                                        <div
                                            key={idx}
                                            className='relative aspect-square rounded-lg overflow-hidden'
                                        >
                                            <Image
                                                src={url}
                                                alt={`Gallery ${idx + 1}`}
                                                fill
                                                className='object-cover'
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Images Section */}
                {activeSection === "images" && (
                    <div className='space-y-8'>
                        {/* Cover Image */}
                        <div>
                            <label className='block text-sm font-medium text-text/60 mb-4'>
                                Cover Image
                            </label>
                            <div className='relative group'>
                                <div className='relative h-auto aspect-video rounded-xl overflow-hidden bg-text/10'>
                                    {cafe.thumbnail ? (
                                        <>
                                            <Image
                                                src={getCafeThumbnailUrl(
                                                    cafe.thumbnail
                                                )}
                                                alt={cafe.name}
                                                fill
                                                className='object-cover'
                                            />
                                            {cafe.thumbnail ===
                                                "placeholder" && (
                                                <div className='absolute top-3 left-3 px-2 py-1 bg-amber-500/90 text-white text-xs font-medium rounded z-10'>
                                                    Placeholder Image
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className='w-full h-full flex items-center justify-center text-text/30'>
                                            <ImagePlus className='w-12 h-12' />
                                        </div>
                                    )}

                                    {/* Overlay with actions */}
                                    <div className='absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-4'>
                                        <label className='cursor-pointer flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition'>
                                            {uploadingCover ? (
                                                <Loader2 className='w-4 h-4 animate-spin' />
                                            ) : (
                                                <Upload className='w-4 h-4' />
                                            )}
                                            {cafe.thumbnail
                                                ? "Change"
                                                : "Upload"}
                                            <input
                                                type='file'
                                                accept='image/jpeg,image/png,image/webp,image/gif'
                                                className='hidden'
                                                disabled={uploadingCover}
                                                onChange={handleThumbnailChange}
                                            />
                                        </label>

                                        {cafe.thumbnail && (
                                            <button
                                                onClick={async () => {
                                                    if (
                                                        !confirm(
                                                            "Remove cover image?"
                                                        )
                                                    )
                                                        return
                                                    await deleteCafeImageAsOwner(
                                                        cafe.id,
                                                        cafe.thumbnail!
                                                    )
                                                    setCafe(
                                                        (prev) =>
                                                            ({
                                                                ...prev,
                                                                thumbnail: null,
                                                            }) as unknown as typeof prev
                                                    )
                                                    setHasChanges(true)
                                                }}
                                                className='flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition'
                                            >
                                                <Trash2 className='w-4 h-4' />
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Gallery */}
                        <div>
                            <div className='flex items-center justify-between mb-4'>
                                <label className='text-sm font-medium text-text/60'>
                                    Gallery ({cafe.gallery?.length || 0} images)
                                </label>
                                <label className='cursor-pointer flex items-center gap-2 px-4 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition'>
                                    {uploadingGallery ? (
                                        <Loader2 className='w-4 h-4 animate-spin' />
                                    ) : (
                                        <ImagePlus className='w-4 h-4' />
                                    )}
                                    Add Photos
                                    <input
                                        type='file'
                                        accept='image/jpeg,image/png,image/webp,image/gif'
                                        multiple
                                        className='hidden'
                                        disabled={uploadingGallery}
                                        onChange={async (e) => {
                                            const files = Array.from(
                                                e.target.files || []
                                            )
                                            if (files.length === 0) return

                                            setUploadingGallery(true)
                                            const newUrls: string[] = []

                                            for (const file of files) {
                                                // Resize only, allow any aspect ratio
                                                const processedFile =
                                                    await resizeImage(file, {
                                                        maxWidth: 1920,
                                                        maxHeight: 1920,
                                                        quality: 0.85,
                                                        format: "image/webp",
                                                    })
                                                const result =
                                                    await uploadCafeImageClient(
                                                        processedFile
                                                    )
                                                if (
                                                    result.success &&
                                                    result.url
                                                ) {
                                                    newUrls.push(result.url)
                                                }
                                            }

                                            if (newUrls.length > 0) {
                                                updateField("gallery", [
                                                    ...(cafe.gallery || []),
                                                    ...newUrls,
                                                ])
                                            }

                                            setUploadingGallery(false)
                                            e.target.value = ""
                                        }}
                                    />
                                </label>
                            </div>

                            {cafe.gallery && cafe.gallery.length > 0 ? (
                                <Reorder.Group
                                    axis='x'
                                    values={cafe.gallery}
                                    onReorder={(newOrder) =>
                                        updateField("gallery", newOrder)
                                    }
                                    className='flex flex-row gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-text/10'
                                >
                                    {cafe.gallery.map((url, idx) => (
                                        <Reorder.Item
                                            key={url}
                                            value={url}
                                            className='relative h-48 w-auto shrink-0 rounded-lg overflow-hidden group cursor-move active:cursor-grabbing bg-gray-50 flex items-center justify-center border border-text/10'
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={url}
                                                alt={`Gallery ${idx + 1}`}
                                                className='h-full w-auto object-contain pointer-events-none max-w-none'
                                            />

                                            {/* Move Controls */}
                                            <div className='absolute bottom-2 left-2 right-2 flex justify-between md:opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-full px-2 py-1 backdrop-blur-sm z-10'>
                                                <button
                                                    type='button'
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        moveGalleryImage(
                                                            idx,
                                                            "left"
                                                        )
                                                    }}
                                                    className={`p-1 text-white hover:text-white/80 transition ${idx === 0 ? "opacity-20 cursor-not-allowed" : ""}`}
                                                    disabled={idx === 0}
                                                    title='Move left'
                                                >
                                                    <ChevronLeft className='w-4 h-4' />
                                                </button>
                                                <button
                                                    type='button'
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        moveGalleryImage(
                                                            idx,
                                                            "right"
                                                        )
                                                    }}
                                                    className={`p-1 text-white hover:text-white/80 transition ${idx === cafe.gallery!.length - 1 ? "opacity-20 cursor-not-allowed" : ""}`}
                                                    disabled={
                                                        idx ===
                                                        cafe.gallery!.length - 1
                                                    }
                                                    title='Move right'
                                                >
                                                    <ChevronRight className='w-4 h-4' />
                                                </button>
                                            </div>

                                            <button
                                                type='button'
                                                onClick={async () => {
                                                    if (
                                                        !confirm(
                                                            "Remove this image?"
                                                        )
                                                    )
                                                        return
                                                    await deleteCafeImageAsOwner(
                                                        cafe.id,
                                                        url
                                                    )
                                                    updateField(
                                                        "gallery",
                                                        cafe.gallery?.filter(
                                                            (_, i) => i !== idx
                                                        ) || []
                                                    )
                                                }}
                                                className='absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full md:opacity-0 group-hover:opacity-100 transition hover:bg-red-600 z-10'
                                                title='Remove image'
                                            >
                                                <X className='w-4 h-4' />
                                            </button>
                                        </Reorder.Item>
                                    ))}
                                </Reorder.Group>
                            ) : (
                                <div className='bg-text/5 border border-text/10 border-dashed rounded-xl p-12 text-center text-text/40'>
                                    <ImagePlus className='w-12 h-12 mx-auto mb-4 opacity-50' />
                                    <p>No gallery images yet</p>
                                    <p className='text-sm mt-1'>
                                        Click &quot;Add Photos&quot; to upload
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Location */}
                {activeSection === "location" && (
                    <div className='space-y-6'>
                        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                            <div>
                                <label className='block text-sm font-medium text-text/60 mb-2'>
                                    Region
                                </label>
                                <input
                                    type='text'
                                    value={cafe.region || ""}
                                    readOnly
                                    className='w-full px-4 py-3 bg-text/5 border border-text/10 rounded-lg text-text/60'
                                />
                            </div>
                            <div>
                                <label className='block text-sm font-medium text-text/60 mb-2'>
                                    Province
                                </label>
                                <input
                                    type='text'
                                    value={cafe.province || ""}
                                    readOnly
                                    className='w-full px-4 py-3 bg-text/5 border border-text/10 rounded-lg text-text/60'
                                />
                            </div>
                            <div>
                                <label className='block text-sm font-medium text-text/60 mb-2'>
                                    City/Municipality
                                </label>
                                <input
                                    type='text'
                                    value={cafe.city_municipality || ""}
                                    readOnly
                                    className='w-full px-4 py-3 bg-text/5 border border-text/10 rounded-lg text-text/60'
                                />
                            </div>
                        </div>

                        <div>
                            <label className='block text-sm font-medium text-text/60 mb-2'>
                                Display Address
                            </label>
                            <input
                                type='text'
                                value={cafe.address_display}
                                onChange={(e) =>
                                    updateField(
                                        "address_display",
                                        e.target.value
                                    )
                                }
                                className='w-full px-4 py-3 bg-background border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50'
                            />
                        </div>

                        <div>
                            <label className='block text-sm font-medium text-text/60 mb-2'>
                                Map Location
                            </label>
                            <LocationPicker
                                lat={cafe.lat}
                                lng={cafe.lng}
                                onChange={(lat: number, lng: number) => {
                                    updateField("lat", lat)
                                    updateField("lng", lng)
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* Amenities */}
                {activeSection === "amenities" && (
                    <div className='space-y-6'>
                        <div>
                            <label className='block text-sm font-medium text-text/60 mb-4'>
                                Amenities & Features
                            </label>
                            <AmenityToggles
                                values={{
                                    has_wifi: cafe.has_wifi || false,
                                    has_sockets: cafe.has_sockets || false,
                                    has_parking: cafe.has_parking || false,
                                    has_aircon: cafe.has_aircon || false,
                                    is_pet_friendly:
                                        cafe.is_pet_friendly || false,
                                    has_outdoor_seating:
                                        cafe.has_outdoor_seating || false,
                                    serves_food: cafe.serves_food || false,
                                    is_work_friendly:
                                        cafe.is_work_friendly || false,
                                }}
                                onChange={(key, value) =>
                                    updateField(key as keyof typeof cafe, value)
                                }
                            />
                        </div>

                        {/* Payment Methods */}
                        <div>
                            <label className='block text-sm font-medium text-text/60 mb-2'>
                                Payment Methods
                            </label>
                            <div className='flex flex-wrap gap-2 mb-2'>
                                {PAYMENT_METHODS.map((method) => {
                                    const isSelected =
                                        cafe.payment_methods?.includes(method)
                                    return (
                                        <button
                                            key={method}
                                            onClick={() => {
                                                const current =
                                                    cafe.payment_methods
                                                        ?.split(",")
                                                        .map((s) => s.trim())
                                                        .filter(Boolean) || []
                                                const updated = isSelected
                                                    ? current.filter(
                                                          (m) => m !== method
                                                      )
                                                    : [...current, method]
                                                updateField(
                                                    "payment_methods",
                                                    updated.join(", ")
                                                )
                                            }}
                                            className={`px-3 py-1.5 rounded-full text-sm transition ${
                                                isSelected
                                                    ? "bg-primary/20 text-primary border border-primary/30"
                                                    : "bg-text/5 border border-text/10 hover:bg-text/10"
                                            }`}
                                        >
                                            {formatLabel(method)}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Specialties */}
                        <div>
                            <label className='block text-sm font-medium text-text/60 mb-2'>
                                Specialties
                            </label>
                            <div className='flex flex-wrap gap-2 mb-2'>
                                {CAFE_SPECIALTIES.map((s) => {
                                    const isSelected =
                                        cafe.specialty?.includes(s)
                                    return (
                                        <button
                                            key={s}
                                            onClick={() => {
                                                const current =
                                                    cafe.specialty || []
                                                const updated = isSelected
                                                    ? current.filter(
                                                          (x) => x !== s
                                                      )
                                                    : [...current, s]
                                                updateField(
                                                    "specialty",
                                                    updated as string[]
                                                )
                                            }}
                                            className={`px-3 py-1.5 rounded-full text-sm transition ${
                                                isSelected
                                                    ? "bg-primary/20 text-primary border border-primary/30"
                                                    : "bg-text/5 border border-text/10 hover:bg-text/10"
                                            }`}
                                        >
                                            {formatLabel(s)}
                                        </button>
                                    )
                                })}
                            </div>
                            <div className='flex gap-2'>
                                <input
                                    type='text'
                                    value={customSpecialties}
                                    onChange={(e) =>
                                        setCustomSpecialties(e.target.value)
                                    }
                                    onKeyDown={(e) =>
                                        e.key === "Enter" &&
                                        (e.preventDefault(),
                                        addCustomSpecialties())
                                    }
                                    placeholder='Add custom (comma-separated)'
                                    className='flex-1 px-3 py-2 bg-background border border-text/10 rounded-lg text-sm'
                                />
                                <button
                                    onClick={addCustomSpecialties}
                                    className='px-3 py-2 bg-text/10 rounded-lg text-sm hover:bg-text/20'
                                >
                                    Add
                                </button>
                            </div>
                            {cafe.specialty && cafe.specialty.length > 0 && (
                                <div className='flex flex-wrap gap-1 mt-2'>
                                    {cafe.specialty.map((s) => (
                                        <span
                                            key={s}
                                            className='px-2 py-1 bg-primary/20 text-primary rounded-full text-xs flex items-center gap-1'
                                        >
                                            {formatLabel(s)}
                                            <button
                                                onClick={() =>
                                                    updateField(
                                                        "specialty",
                                                        cafe.specialty?.filter(
                                                            (x) => x !== s
                                                        ) as string[]
                                                    )
                                                }
                                                className='hover:text-red-400'
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Vibe Tags */}
                        <div>
                            <label className='block text-sm font-medium text-text/60 mb-2'>
                                Vibe Tags
                            </label>
                            <div className='flex flex-wrap gap-2 mb-2'>
                                {CAFE_VIBE_TAGS.map((t) => {
                                    const isSelected = cafe.tags?.includes(t)
                                    return (
                                        <button
                                            key={t}
                                            onClick={() => {
                                                const current = cafe.tags || []
                                                const updated = isSelected
                                                    ? current.filter(
                                                          (x) => x !== t
                                                      )
                                                    : [...current, t]
                                                updateField(
                                                    "tags",
                                                    updated as string[]
                                                )
                                            }}
                                            className={`px-3 py-1.5 rounded-full text-sm transition ${
                                                isSelected
                                                    ? "bg-primary/20 text-primary border border-primary/30"
                                                    : "bg-text/5 border border-text/10 hover:bg-text/10"
                                            }`}
                                        >
                                            {formatLabel(t)}
                                        </button>
                                    )
                                })}
                            </div>
                            <div className='flex gap-2'>
                                <input
                                    type='text'
                                    value={customTags}
                                    onChange={(e) =>
                                        setCustomTags(e.target.value)
                                    }
                                    onKeyDown={(e) =>
                                        e.key === "Enter" &&
                                        (e.preventDefault(), addCustomTags())
                                    }
                                    placeholder='Add custom (comma-separated)'
                                    className='flex-1 px-3 py-2 bg-background border border-text/10 rounded-lg text-sm'
                                />
                                <button
                                    onClick={addCustomTags}
                                    className='px-3 py-2 bg-text/10 rounded-lg text-sm hover:bg-text/20'
                                >
                                    Add
                                </button>
                            </div>
                            {cafe.tags && cafe.tags.length > 0 && (
                                <div className='flex flex-wrap gap-1 mt-2'>
                                    {cafe.tags.map((t) => (
                                        <span
                                            key={t}
                                            className='px-2 py-1 bg-text/10 rounded-full text-xs flex items-center gap-1'
                                        >
                                            {formatLabel(t)}
                                            <button
                                                onClick={() =>
                                                    updateField(
                                                        "tags",
                                                        cafe.tags?.filter(
                                                            (x) => x !== t
                                                        ) as string[]
                                                    )
                                                }
                                                className='hover:text-red-400'
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Brew Methods */}
                        <div>
                            <label className='block text-sm font-medium text-text/60 mb-2'>
                                Brew Methods
                            </label>
                            <div className='flex flex-wrap gap-2'>
                                {BREW_METHODS.map((method) => {
                                    const isSelected =
                                        cafe.brew_methods?.includes(method)
                                    return (
                                        <button
                                            key={method}
                                            onClick={() => {
                                                const current =
                                                    cafe.brew_methods || []
                                                const updated = isSelected
                                                    ? current.filter(
                                                          (x) => x !== method
                                                      )
                                                    : [...current, method]
                                                updateField(
                                                    "brew_methods",
                                                    updated as string[]
                                                )
                                            }}
                                            className={`px-3 py-1.5 rounded-full text-sm transition ${
                                                isSelected
                                                    ? "bg-primary/20 text-primary border border-primary/30"
                                                    : "bg-text/5 border border-text/10 hover:bg-text/10"
                                            }`}
                                        >
                                            {method}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Operating Hours */}
                {activeSection === "hours" && (
                    <div>
                        <label className='block text-sm font-medium text-text/60 mb-4'>
                            Operating Hours
                        </label>
                        <OperatingHoursEditor
                            value={
                                (cafe.operating_hours as OperatingHour[]) || []
                            }
                            onChange={(hours) =>
                                updateField("operating_hours", hours)
                            }
                        />
                    </div>
                )}

                {/* Contact */}
                {activeSection === "contact" && (
                    <div className='space-y-6'>
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                            <div>
                                <label className='block text-sm font-medium text-text/60 mb-2'>
                                    Website
                                </label>
                                <input
                                    type='url'
                                    value={cafe.website_url || ""}
                                    onChange={(e) =>
                                        updateField(
                                            "website_url",
                                            e.target.value
                                        )
                                    }
                                    placeholder='https://...'
                                    className='w-full px-4 py-3 bg-background border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50'
                                />
                            </div>
                            <div>
                                <label className='block text-sm font-medium text-text/60 mb-2'>
                                    Phone
                                </label>
                                <input
                                    type='tel'
                                    value={cafe.phone || ""}
                                    onChange={(e) =>
                                        updateField("phone", e.target.value)
                                    }
                                    placeholder='+63 XXX XXX XXXX'
                                    className='w-full px-4 py-3 bg-background border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50'
                                />
                            </div>
                            <div className='md:col-span-2'>
                                <label className='block text-sm font-medium text-text/60 mb-2'>
                                    Email
                                </label>
                                <input
                                    type='email'
                                    value={cafe.email || ""}
                                    onChange={(e) =>
                                        updateField("email", e.target.value)
                                    }
                                    placeholder='cafe@example.com'
                                    className='w-full px-4 py-3 bg-background border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50'
                                />
                            </div>
                        </div>

                        <div>
                            <label className='block text-sm font-medium text-text/60 mb-4'>
                                Social Links
                            </label>
                            <SocialLinksEditor
                                value={(cafe.socials as CafeSocial[]) || []}
                                onChange={(socials) =>
                                    updateField("socials", socials)
                                }
                            />
                        </div>
                    </div>
                )}

                {/* Story Editor */}
                {activeSection === "story" && (
                    <div className='space-y-4'>
                        <div className='flex items-center justify-between'>
                            <div>
                                <h3 className='font-medium'>Cafe Story</h3>
                                <p className='text-sm text-text/60'>
                                    Tell visitors about your cafe&apos;s
                                    history, values, and what makes it special.
                                    Markdown is supported.
                                </p>
                            </div>
                            <div className='flex items-center gap-2'>
                                <button
                                    onClick={() =>
                                        setStoryPreview(!storyPreview)
                                    }
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                        storyPreview
                                            ? "bg-primary/20 text-primary"
                                            : "bg-text/10 text-text/60 hover:bg-text/20"
                                    }`}
                                >
                                    {storyPreview ? (
                                        <>
                                            <Edit3 className='w-4 h-4' />
                                            Edit
                                        </>
                                    ) : (
                                        <>
                                            <Eye className='w-4 h-4' />
                                            Preview
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {storyPreview ? (
                            <div className='bg-text/5 border border-text/10 rounded-lg p-6 min-h-[300px] prose prose-sm max-w-none'>
                                {storyContent ? (
                                    <div className='whitespace-pre-wrap'>
                                        {storyContent}
                                    </div>
                                ) : (
                                    <p className='text-text/40 italic'>
                                        No story written yet...
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className='space-y-2'>
                                <textarea
                                    value={storyContent}
                                    onChange={(e) => {
                                        setStoryContent(e.target.value)
                                        setStoryHasChanges(true)
                                    }}
                                    placeholder='Tell your story...&#10;&#10;You can share:&#10;• How your cafe started&#10;• What makes your coffee special&#10;• Your philosophy and values&#10;• The people behind your cafe'
                                    className='w-full h-72 p-4 bg-text/5 border border-text/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none text-sm leading-relaxed'
                                />
                                <div className='flex items-center justify-between text-xs text-text/50'>
                                    <span>
                                        {storyContent.length} characters
                                    </span>
                                    <span>Markdown supported</span>
                                </div>
                            </div>
                        )}

                        {storyHasChanges && (
                            <button
                                onClick={async () => {
                                    setSavingStory(true)
                                    const result = await updateCafeStory(
                                        cafe.id,
                                        storyContent
                                    )
                                    setSavingStory(false)
                                    if (result.success) {
                                        setStoryHasChanges(false)
                                        addNotification(
                                            "Story saved successfully!",
                                            "success"
                                        )
                                    } else {
                                        addNotification(
                                            result.error ||
                                                "Failed to save story",
                                            "error"
                                        )
                                    }
                                }}
                                disabled={savingStory}
                                className='flex items-center justify-center gap-2 w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50'
                            >
                                {savingStory ? (
                                    <Loader2 className='w-4 h-4 animate-spin' />
                                ) : (
                                    <Save className='w-4 h-4' />
                                )}
                                Save Story
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Sticky Save Button (Mobile) */}
            {hasChanges && (
                <div className='fixed bottom-6 left-4 right-4 md:hidden z-50'>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className='w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-lg font-medium shadow-lg hover:bg-primary/90 disabled:opacity-50'
                    >
                        {saving ? (
                            <Loader2 className='w-4 h-4 animate-spin' />
                        ) : (
                            <Save className='w-4 h-4' />
                        )}
                        Save Changes
                    </button>
                </div>
            )}
            {/* Image Cropper */}
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
        </div>
    )
}
