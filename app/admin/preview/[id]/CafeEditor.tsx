"use client"

import { Reorder } from "motion/react"

import { useState, useCallback, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
    ArrowLeft,
    Check,
    X,
    Save,
    MapPin,
    DollarSign,
    Loader2,
    Coffee,
    Clock,
    Phone,
    Settings,
    EyeOff,
    FileText,
    Trash2,
    ImagePlus,
    Upload,
    BadgeCheck,
    Users,
    Search,
    ChevronLeft,
    ChevronRight,
} from "lucide-react"
import {
    approveCafe,
    rejectCafe,
    updateCafe,
    unpublishCafe,
    upsertCafeStory,
    deleteCafeStory,
    adminDeleteCafeImage,
    searchUsersForOwner,
    getOwnerProfiles,
} from "@/app/api/actions/admin"
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
import { cropAndResizeImage, resizeImage } from "@/utils/image-processing"

type PriceLevel = Database["public"]["Enums"]["price_level"]

interface CafeEditorProps {
    cafe: CafeWithRatings
}

// Helper to convert snake_case to Title Case
const formatLabel = (s: string) =>
    s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

export default function CafeEditor({ cafe: initialCafe }: CafeEditorProps) {
    const router = useRouter()
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
        | "owners"
    >("basic")

    // Image management state
    const [uploadingCover, setUploadingCover] = useState(false)
    const [uploadingGallery, setUploadingGallery] = useState(false)

    // Story state
    const [storyContent, setStoryContent] = useState(
        initialCafe.story?.content || ""
    )
    const [storyHasChanges, setStoryHasChanges] = useState(false)
    const [savingStory, setSavingStory] = useState(false)

    // Custom inputs for comma-separated values
    const [customSpecialties, setCustomSpecialties] = useState("")
    const [customTags, setCustomTags] = useState("")

    // Owner management state
    const [owners, setOwners] = useState<
        {
            id: string
            username: string
            display_name: string
            avatar_url: string | null
        }[]
    >([])
    const [ownerSearchQuery, setOwnerSearchQuery] = useState("")
    const [ownerSearchResults, setOwnerSearchResults] = useState<
        {
            id: string
            username: string
            display_name: string
            avatar_url: string | null
        }[]
    >([])
    const [ownerSearchLoading, setOwnerSearchLoading] = useState(false)
    const [ownersLoading, setOwnersLoading] = useState(true)

    // Load owner profiles on mount
    useEffect(() => {
        async function loadOwners() {
            if (initialCafe.owner_ids && initialCafe.owner_ids.length > 0) {
                const profiles = await getOwnerProfiles(initialCafe.owner_ids)
                setOwners(profiles)
            }
            setOwnersLoading(false)
        }
        loadOwners()
    }, [initialCafe.owner_ids])

    const updateField = useCallback(
        <K extends keyof typeof cafe>(key: K, value: (typeof cafe)[K]) => {
            setCafe((prev) => ({ ...prev, [key]: value }))
            setHasChanges(true)
        },
        []
    )

    const handleSave = async () => {
        setSaving(true)
        const result = await updateCafe(cafe.id, {
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
            thumbnail: cafe.thumbnail,
            gallery: cafe.gallery,
            slug: cafe.slug,
            is_verified: cafe.is_verified || false,
            owner_ids: cafe.owner_ids || null,
        })
        setSaving(false)
        if (result.success) {
            setHasChanges(false)
        } else {
            alert(result.error || "Failed to save changes")
        }
    }

    const handleApprove = async () => {
        if (hasChanges) {
            await handleSave()
        }
        const result = await approveCafe(cafe.id)
        if (result.success) {
            router.push("/admin")
        } else {
            alert(result.error || "Failed to approve")
        }
    }

    const handleReject = async () => {
        if (!confirm("Are you sure you want to reject and delete this cafe?"))
            return
        const result = await rejectCafe(cafe.id)
        if (result.success) {
            router.push("/admin")
        } else {
            alert(result.error || "Failed to reject")
        }
    }

    const handleUnpublish = async () => {
        if (!confirm("Are you sure you want to unpublish this cafe?")) return
        if (hasChanges) {
            await handleSave()
        }
        const result = await unpublishCafe(cafe.id)
        if (result.success) {
            router.push("/admin")
        } else {
            alert(result.error || "Failed to unpublish")
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

    // Owner search handler with debounce
    const handleOwnerSearch = async (query: string) => {
        setOwnerSearchQuery(query)
        if (query.length < 2) {
            setOwnerSearchResults([])
            return
        }
        setOwnerSearchLoading(true)
        const results = await searchUsersForOwner(query)
        // Filter out users who are already owners
        const filtered = results.filter(
            (user) => !owners.some((o) => o.id === user.id)
        )
        setOwnerSearchResults(filtered)
        setOwnerSearchLoading(false)
    }

    // Add owner
    const addOwner = (user: (typeof owners)[0]) => {
        const newOwners = [...owners, user]
        setOwners(newOwners)
        setOwnerSearchResults((prev) => prev.filter((u) => u.id !== user.id))
        setOwnerSearchQuery("")
        // Update cafe owner_ids
        setCafe((prev) => ({ ...prev, owner_ids: newOwners.map((o) => o.id) }))
        setHasChanges(true)
    }

    // Remove owner
    const removeOwner = (userId: string) => {
        const newOwners = owners.filter((o) => o.id !== userId)
        setOwners(newOwners)
        // Update cafe owner_ids
        setCafe((prev) => ({
            ...prev,
            owner_ids: newOwners.length > 0 ? newOwners.map((o) => o.id) : null,
        }))
        setHasChanges(true)
    }

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

    const SECTIONS = [
        { id: "basic", title: "Basic Info", icon: Coffee },
        { id: "images", title: "Images", icon: ImagePlus },
        { id: "location", title: "Location", icon: MapPin },
        { id: "amenities", title: "Amenities", icon: Settings },
        { id: "hours", title: "Hours", icon: Clock },
        { id: "contact", title: "Contact", icon: Phone },
        { id: "story", title: "Story", icon: FileText },
        { id: "owners", title: "Owners", icon: Users },
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
                        href='/admin'
                        className='p-2 hover:bg-text/5 rounded-lg transition'
                    >
                        <ArrowLeft className='w-5 h-5' />
                    </Link>
                    <div>
                        <h1 className='text-2xl font-bold font-serif'>
                            Review Submission
                        </h1>
                        <p className='text-text/60 text-sm'>
                            {cafe.is_published ? "Published " : "Submitted "}
                            {new Date(cafe.created_at!).toLocaleDateString()}
                            {cafe.contributor && (
                                <span className='ml-2'>
                                    by{" "}
                                    <span className='font-medium text-text/80'>
                                        {cafe.contributor.display_name ||
                                            cafe.contributor.username}
                                    </span>
                                </span>
                            )}
                        </p>
                    </div>
                </div>
                <div className='flex items-center gap-2'>
                    {hasChanges && (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className='flex items-center gap-2 px-4 py-2 bg-text/10 rounded-lg hover:bg-text/20 transition disabled:opacity-50'
                        >
                            {saving ? (
                                <Loader2 className='w-4 h-4 animate-spin' />
                            ) : (
                                <Save className='w-4 h-4' />
                            )}
                            Save
                        </button>
                    )}
                    {cafe.is_published ? (
                        // Published cafe - show Unpublish button
                        <button
                            onClick={handleUnpublish}
                            className='flex items-center gap-2 px-4 py-2 bg-orange-500/20 text-orange-500 rounded-lg hover:bg-orange-500/30 transition'
                        >
                            <EyeOff className='w-4 h-4' />
                            Unpublish
                        </button>
                    ) : (
                        // Pending cafe - show Reject and Approve buttons
                        <>
                            <button
                                onClick={handleReject}
                                className='flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30 transition'
                            >
                                <X className='w-4 h-4' />
                                Reject
                            </button>
                            <button
                                onClick={handleApprove}
                                className='flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-500 rounded-lg hover:bg-green-500/30 transition'
                            >
                                <Check className='w-4 h-4' />
                                Approve
                            </button>
                        </>
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
                                ? "bg-accent/20 text-accent border-accent/30"
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
                    <Image
                        src={cafe.thumbnail}
                        alt={cafe.name}
                        fill
                        className='object-cover'
                    />
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
                        {/* Verified Status Toggle */}
                        <div className='flex items-center justify-between p-4 bg-background border border-text/10 rounded-lg'>
                            <div className='flex items-center gap-3'>
                                <BadgeCheck
                                    className={`w-5 h-5 ${cafe.is_verified ? "text-accent" : "text-text/40"}`}
                                />
                                <div>
                                    <p className='font-medium'>Verified Cafe</p>
                                    <p className='text-sm text-text/60'>
                                        Verified cafes display a badge on their
                                        listing
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() =>
                                    updateField(
                                        "is_verified",
                                        !cafe.is_verified
                                    )
                                }
                                className={`relative inline-flex h-6 min-w-11 items-center rounded-full transition-colors cursor-pointer ${
                                    cafe.is_verified
                                        ? "bg-text/40"
                                        : "bg-text/20"
                                }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                        cafe.is_verified
                                            ? "translate-x-6"
                                            : "translate-x-1"
                                    }`}
                                />
                            </button>
                        </div>
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
                                className='w-full px-4 py-3 bg-background border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50'
                            />
                        </div>

                        <div>
                            <label className='block text-sm font-medium text-text/60 mb-2'>
                                Slug (URL Path) *
                            </label>
                            <input
                                type='text'
                                value={cafe.slug}
                                onChange={(e) =>
                                    updateField("slug", e.target.value)
                                }
                                className='w-full px-4 py-3 bg-background border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 font-mono text-sm'
                            />
                            <p className='text-xs text-text/40 mt-1'>
                                Warning: Changing this will break existing links
                                to the cafe page.
                            </p>
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
                                className='w-full px-4 py-3 bg-background border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none'
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
                                                ? "bg-accent/20 border-accent text-accent"
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
                                        <Image
                                            src={cafe.thumbnail}
                                            alt={cafe.name}
                                            fill
                                            className='object-cover'
                                        />
                                    ) : (
                                        <div className='w-full h-full flex items-center justify-center text-text/30'>
                                            <ImagePlus className='w-12 h-12' />
                                        </div>
                                    )}

                                    {/* Overlay with actions */}
                                    <div className='absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-4'>
                                        <label className='cursor-pointer flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/80 transition'>
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
                                                onChange={async (e) => {
                                                    const file =
                                                        e.target.files?.[0]
                                                    if (!file) return

                                                    setUploadingCover(true)
                                                    // Crop to 16:9 aspect ratio
                                                    const processedFile =
                                                        await cropAndResizeImage(
                                                            file,
                                                            {
                                                                targetAspectRatio:
                                                                    16 / 9,
                                                                maxWidth: 2560,
                                                                maxHeight: 1440,
                                                                quality: 0.9,
                                                                format: "image/webp",
                                                            }
                                                        )
                                                    const result =
                                                        await uploadCafeImageClient(
                                                            processedFile
                                                        )

                                                    if (
                                                        result.success &&
                                                        result.url
                                                    ) {
                                                        // Delete old image if exists
                                                        if (cafe.thumbnail) {
                                                            await adminDeleteCafeImage(
                                                                cafe.thumbnail
                                                            )
                                                        }
                                                        updateField(
                                                            "thumbnail",
                                                            result.url
                                                        )
                                                    } else {
                                                        alert(
                                                            result.error ||
                                                                "Failed to upload image"
                                                        )
                                                    }

                                                    setUploadingCover(false)
                                                    e.target.value = ""
                                                }}
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
                                                    await adminDeleteCafeImage(
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
                                <label className='cursor-pointer flex items-center gap-2 px-4 py-2 bg-accent/20 text-accent rounded-lg hover:bg-accent/30 transition'>
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
                                                // Crop to 16:9 aspect ratio
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
                                    axis='y'
                                    values={cafe.gallery}
                                    onReorder={(newOrder) =>
                                        updateField("gallery", newOrder)
                                    }
                                    className='flex flex-wrap gap-4'
                                >
                                    {cafe.gallery.map((url, idx) => (
                                        <Reorder.Item
                                            key={url}
                                            value={url}
                                            className='relative h-48 w-auto shrink-0 rounded-lg overflow-hidden group cursor-move active:cursor-grabbing bg-gray-50 flex items-center justify-center border border-text/10'
                                        >
                                            <img
                                                src={url}
                                                alt={`Gallery ${idx + 1}`}
                                                className='h-full w-auto object-contain pointer-events-none max-w-none'
                                            />

                                            {/* Move Controls */}
                                            <div className='absolute bottom-2 left-2 right-2 flex justify-between opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-full px-2 py-1 backdrop-blur-sm z-10'>
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
                                                    await adminDeleteCafeImage(
                                                        url
                                                    )
                                                    updateField(
                                                        "gallery",
                                                        cafe.gallery?.filter(
                                                            (_, i) => i !== idx
                                                        ) || []
                                                    )
                                                }}
                                                className='absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition hover:bg-red-600 z-10'
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
                                className='w-full px-4 py-3 bg-background border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50'
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
                                                    ? "bg-accent/20 text-accent border border-accent/30"
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
                                                    ? "bg-accent/20 text-accent border border-accent/30"
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
                                            className='px-2 py-1 bg-accent/20 text-accent rounded-full text-xs flex items-center gap-1'
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
                                                    ? "bg-accent/20 text-accent border border-accent/30"
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
                                                    ? "bg-accent/20 text-accent border border-accent/30"
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
                                    className='w-full px-4 py-3 bg-background border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50'
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
                                    placeholder='+63...'
                                    className='w-full px-4 py-3 bg-background border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50'
                                />
                            </div>
                        </div>

                        <div>
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
                                className='w-full px-4 py-3 bg-background border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50'
                            />
                        </div>

                        <div>
                            <label className='block text-sm font-medium text-text/60 mb-4'>
                                Social Media Links
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

                {/* Story */}
                {activeSection === "story" && (
                    <div className='space-y-6'>
                        <div>
                            <div className='flex items-center justify-between mb-2'>
                                <label className='block text-sm font-medium text-text/60'>
                                    Cafe Story (Markdown)
                                </label>
                                <div className='flex items-center gap-2'>
                                    {storyContent && (
                                        <button
                                            onClick={async () => {
                                                if (
                                                    !confirm(
                                                        "Are you sure you want to delete this story?"
                                                    )
                                                )
                                                    return
                                                setSavingStory(true)
                                                const result =
                                                    await deleteCafeStory(
                                                        cafe.id
                                                    )
                                                setSavingStory(false)
                                                if (result.success) {
                                                    setStoryContent("")
                                                    setStoryHasChanges(false)
                                                } else {
                                                    alert(
                                                        result.error ||
                                                            "Failed to delete story"
                                                    )
                                                }
                                            }}
                                            disabled={savingStory}
                                            className='flex items-center gap-1 px-3 py-1.5 bg-red-500/20 text-red-500 rounded-lg text-sm hover:bg-red-500/30 transition disabled:opacity-50'
                                        >
                                            <Trash2 className='w-4 h-4' />
                                            Delete
                                        </button>
                                    )}
                                    {storyHasChanges && (
                                        <button
                                            onClick={async () => {
                                                setSavingStory(true)
                                                const result =
                                                    await upsertCafeStory(
                                                        cafe.id,
                                                        storyContent
                                                    )
                                                setSavingStory(false)
                                                if (result.success) {
                                                    setStoryHasChanges(false)
                                                } else {
                                                    alert(
                                                        result.error ||
                                                            "Failed to save story"
                                                    )
                                                }
                                            }}
                                            disabled={savingStory}
                                            className='flex items-center gap-1 px-3 py-1.5 bg-accent/20 text-accent rounded-lg text-sm hover:bg-accent/30 transition disabled:opacity-50'
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
                            </div>
                            <textarea
                                value={storyContent}
                                onChange={(e) => {
                                    setStoryContent(e.target.value)
                                    setStoryHasChanges(true)
                                }}
                                rows={20}
                                className='w-full px-4 py-3 bg-background border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 font-mono text-sm resize-y'
                                placeholder='Write the cafe story in markdown format...

# About the Cafe

Start with a compelling introduction...

## The Story

Share the history and journey...

## What Makes It Special

Highlight unique features...'
                            />
                            <p className='text-xs text-text/40 mt-2'>
                                Supports markdown syntax: # headings, **bold**,
                                *italic*, [links](url), etc.
                            </p>
                        </div>
                    </div>
                )}

                {/* Owners Section */}
                {activeSection === "owners" && (
                    <div className='space-y-6'>
                        {/* Contributor Info */}
                        {cafe.contributor && (
                            <div className='bg-accent/10 border border-accent/20 rounded-xl p-4'>
                                <div className='flex items-center gap-3'>
                                    {cafe.contributor.avatar_url ? (
                                        <Image
                                            src={cafe.contributor.avatar_url}
                                            alt={cafe.contributor.display_name}
                                            width={40}
                                            height={40}
                                            className='rounded-full object-cover'
                                        />
                                    ) : (
                                        <div className='w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center'>
                                            <Users className='w-5 h-5 text-accent' />
                                        </div>
                                    )}
                                    <div>
                                        <p className='text-sm text-text/60'>
                                            Submitted by
                                        </p>
                                        <p className='font-medium'>
                                            {cafe.contributor.display_name ||
                                                cafe.contributor.username}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Owner Search */}
                        <div>
                            <label className='block text-sm font-medium text-text/60 mb-2'>
                                Add Cafe Owner/Manager
                            </label>
                            <div className='relative'>
                                <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40' />
                                <input
                                    type='text'
                                    value={ownerSearchQuery}
                                    onChange={(e) =>
                                        handleOwnerSearch(e.target.value)
                                    }
                                    placeholder='Search by username or display name...'
                                    className='w-full pl-10 pr-4 py-3 bg-background border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50'
                                />
                                {ownerSearchLoading && (
                                    <Loader2 className='absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-text/40' />
                                )}
                            </div>

                            {/* Search Results */}
                            {ownerSearchResults.length > 0 && (
                                <div className='mt-2 bg-background border border-text/10 rounded-lg divide-y divide-text/10 max-h-64 overflow-y-auto'>
                                    {ownerSearchResults.map((user) => (
                                        <div
                                            key={user.id}
                                            className='flex items-center justify-between p-3 hover:bg-text/5 transition'
                                        >
                                            <div className='flex items-center gap-3'>
                                                {user.avatar_url ? (
                                                    <Image
                                                        src={user.avatar_url}
                                                        alt={user.display_name}
                                                        width={32}
                                                        height={32}
                                                        className='rounded-full object-cover'
                                                    />
                                                ) : (
                                                    <div className='w-8 h-8 rounded-full bg-text/10 flex items-center justify-center'>
                                                        <Users className='w-4 h-4 text-text/40' />
                                                    </div>
                                                )}
                                                <div>
                                                    <p className='font-medium text-sm'>
                                                        {user.display_name}
                                                    </p>
                                                    <p className='text-xs text-text/60'>
                                                        @{user.username}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => addOwner(user)}
                                                className='px-3 py-1 text-sm bg-accent/20 text-accent rounded hover:bg-accent/30 transition'
                                            >
                                                Add
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Current Owners */}
                        <div>
                            <label className='block text-sm font-medium text-text/60 mb-2'>
                                Current Owners/Managers ({owners.length})
                            </label>
                            {ownersLoading ? (
                                <div className='flex items-center justify-center py-8'>
                                    <Loader2 className='w-6 h-6 animate-spin text-text/40' />
                                </div>
                            ) : owners.length > 0 ? (
                                <div className='bg-background border border-text/10 rounded-lg divide-y divide-text/10'>
                                    {owners.map((owner) => (
                                        <div
                                            key={owner.id}
                                            className='flex items-center justify-between p-3'
                                        >
                                            <div className='flex items-center gap-3'>
                                                {owner.avatar_url ? (
                                                    <Image
                                                        src={owner.avatar_url}
                                                        alt={owner.display_name}
                                                        width={40}
                                                        height={40}
                                                        className='rounded-full object-cover'
                                                    />
                                                ) : (
                                                    <div className='w-10 h-10 rounded-full bg-text/10 flex items-center justify-center'>
                                                        <Users className='w-5 h-5 text-text/40' />
                                                    </div>
                                                )}
                                                <div>
                                                    <p className='font-medium'>
                                                        {owner.display_name}
                                                    </p>
                                                    <p className='text-sm text-text/60'>
                                                        @{owner.username}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() =>
                                                    removeOwner(owner.id)
                                                }
                                                className='p-2 text-red-500 hover:bg-red-500/10 rounded transition'
                                                title='Remove owner'
                                            >
                                                <X className='w-4 h-4' />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className='bg-text/5 border border-text/10 border-dashed rounded-xl p-8 text-center text-text/40'>
                                    <Users className='w-12 h-12 mx-auto mb-4 opacity-50' />
                                    <p>No owners assigned yet</p>
                                    <p className='text-sm mt-1'>
                                        Search for users above to add them as
                                        cafe owners
                                    </p>
                                </div>
                            )}
                        </div>

                        <p className='text-xs text-text/40'>
                            Owners can manage their cafe listing (features
                            coming soon). Changes are saved when you click the
                            Save button above.
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
