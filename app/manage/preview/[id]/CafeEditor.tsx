"use client"

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
    BadgeCheck,
    Users,
    Search,
    ImagePlus,
    Gem,
    Store,
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
import { CafeMenuItem } from "@/utils/types/owner"
import { CafeWithRatings } from "@/utils/types/extra"
import { OperatingHour, CafeSocial } from "@/utils/types/cafe"
import { Database } from "@/utils/types/database.types"
import { getCafeThumbnailUrl } from "@/utils/extras"
import {
    ContactSection,
    LocationSection,
    ImageSection,
    MenuSection,
    MenuItemModal,
    StorySection,
    AmenitiesSection,
    HoursSection,
} from "@/components/cafe-editor"
import { useMenuItems } from "@/utils/hooks/useMenuItems"
import RejectCafeModal from "@/components/admin/RejectCafeModal"

type PriceLevel = Database["public"]["Enums"]["price_level"]

interface CafeEditorProps {
    cafe: CafeWithRatings
    menuItems?: CafeMenuItem[]
}

export default function CafeEditor({
    cafe: initialCafe,
    menuItems: initialMenuItems = [],
}: CafeEditorProps) {
    const router = useRouter()
    const [cafe, setCafe] = useState(initialCafe)
    const [saving, setSaving] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)

    // Menu Management (using shared hook)
    const menu = useMenuItems({
        initialItems: initialMenuItems,
        cafeId: cafe.id,
    })

    const [activeSection, setActiveSection] = useState<
        | "basic"
        | "images"
        | "location"
        | "amenities"
        | "hours"
        | "contact"
        | "story"
        | "menu"
        | "owners"
    >("basic")

    // Story state
    const [storyContent, setStoryContent] = useState(
        initialCafe.story?.content || ""
    )
    const [storyHasChanges, setStoryHasChanges] = useState(false)
    const [savingStory, setSavingStory] = useState(false)

    // Reject modal state
    const [rejectModalOpen, setRejectModalOpen] = useState(false)

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
            has_smoking: cafe.has_smoking || false,
            has_sockets: cafe.has_sockets || false,

            has_parking: cafe.has_parking || false,
            has_aircon: cafe.has_aircon || false,
            is_pet_friendly: cafe.is_pet_friendly || false,
            has_outdoor_seating: cafe.has_outdoor_seating || false,
            has_indoor_seating: cafe.has_indoor_seating || false,
            has_restroom: cafe.has_restroom || false,
            has_bidet: cafe.has_bidet || false,
            has_non_dairy: cafe.has_non_dairy || false,
            milk_options: cafe.milk_options || [],
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
            is_hidden_gem: cafe.is_hidden_gem || false,
            finding_hint: cafe.finding_hint || null,
            is_chain: cafe.is_chain || false,
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

    const handleReject = async (reason?: string) => {
        const result = await rejectCafe(cafe.id, reason)
        if (result.success) {
            setRejectModalOpen(false)
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

    const SECTIONS = [
        { id: "basic", title: "Basic Info", icon: Coffee },
        { id: "images", title: "Images", icon: ImagePlus },
        { id: "location", title: "Location", icon: MapPin },
        { id: "amenities", title: "Amenities", icon: Settings },
        { id: "hours", title: "Hours", icon: Clock },
        { id: "contact", title: "Contact", icon: Phone },
        { id: "story", title: "Story", icon: FileText },
        { id: "menu", title: "Menu", icon: Coffee },
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
                        href='/manage/cafes'
                        className='p-2 hover:bg-text/5 rounded-lg transition'
                    >
                        <ArrowLeft className='w-5 h-5' />
                    </Link>
                    <div>
                        <h1 className='text-2xl font-bold font-serif'>
                            {cafe.is_published
                                ? "Edit Cafe Listing"
                                : "Review Cafe Submission"}
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
                                onClick={() => setRejectModalOpen(true)}
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
                    <div className='w-full h-full flex items-center justify-center text-text opacity-30'>
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

                        {/* Hidden Gem Status Toggle */}
                        <div className='flex flex-col gap-4 p-4 bg-background border border-text/10 rounded-lg'>
                            <div className='flex items-center justify-between'>
                                <div className='flex items-center gap-3'>
                                    <Gem
                                        className={`w-5 h-5 ${cafe.is_hidden_gem ? "text-amber-500" : "text-text/40"}`}
                                    />
                                    <div>
                                        <p className='font-medium'>
                                            Hidden Gem
                                        </p>
                                        <p className='text-sm text-text/60'>
                                            Hidden Gems are excluded from maps
                                            and featured sections
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() =>
                                        updateField(
                                            "is_hidden_gem",
                                            !cafe.is_hidden_gem
                                        )
                                    }
                                    className={`relative inline-flex h-6 min-w-11 items-center rounded-full transition-colors cursor-pointer ${
                                        cafe.is_hidden_gem
                                            ? "bg-amber-500"
                                            : "bg-text/20"
                                    }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                            cafe.is_hidden_gem
                                                ? "translate-x-6"
                                                : "translate-x-1"
                                        }`}
                                    />
                                </button>
                            </div>
                            {cafe.is_hidden_gem && (
                                <div>
                                    <label className='block text-sm font-medium text-text/60 mb-2'>
                                        Finding Hint (optional)
                                    </label>
                                    <input
                                        type='text'
                                        value={cafe.finding_hint || ""}
                                        onChange={(e) =>
                                            updateField(
                                                "finding_hint",
                                                e.target.value || null
                                            )
                                        }
                                        maxLength={200}
                                        placeholder='e.g. Look for the blue door near the old market...'
                                        className='w-full px-4 py-2 bg-background border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm'
                                    />
                                </div>
                            )}
                        </div>

                        {/* Chain Cafe Status Toggle */}
                        <div className='flex items-center justify-between p-4 bg-background border border-text/10 rounded-lg'>
                            <div className='flex items-center gap-3'>
                                <Store
                                    className={`w-5 h-5 ${cafe.is_chain ? "text-orange-500" : "text-text/40"}`}
                                />
                                <div>
                                    <p className='font-medium'>Chain Cafe</p>
                                    <p className='text-sm text-text/60'>
                                        Chain cafes are hidden from search and
                                        maps by default
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() =>
                                    updateField("is_chain", !cafe.is_chain)
                                }
                                className={`relative inline-flex h-6 min-w-11 items-center rounded-full transition-colors cursor-pointer ${
                                    cafe.is_chain
                                        ? "bg-orange-500"
                                        : "bg-text/20"
                                }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                        cafe.is_chain
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
                    <ImageSection
                        thumbnail={cafe.thumbnail}
                        gallery={cafe.gallery || []}
                        cafeId={cafe.id}
                        cafeName={cafe.name}
                        onThumbnailChange={(url: string | null) => {
                            setCafe(
                                (prev) =>
                                    ({
                                        ...prev,
                                        thumbnail: url ?? prev.thumbnail,
                                    }) as typeof prev
                            )
                            setHasChanges(true)
                        }}
                        onGalleryChange={(urls: string[]) => {
                            updateField("gallery", urls)
                            setHasChanges(true)
                        }}
                        onDeleteImage={async (url: string) => {
                            await adminDeleteCafeImage(url)
                        }}
                        colorScheme='accent'
                    />
                )}

                {/* Location */}
                {activeSection === "location" && (
                    <LocationSection
                        data={{
                            region: cafe.region,
                            province: cafe.province,
                            city_municipality: cafe.city_municipality,
                            address_display: cafe.address_display,
                            area: cafe.area,
                            lat: cafe.lat,
                            lng: cafe.lng,
                        }}
                        onChange={(key, value) => {
                            updateField(
                                key as keyof typeof cafe,
                                value as (typeof cafe)[keyof typeof cafe]
                            )
                            setHasChanges(true)
                        }}
                        readOnlyLocation={true}
                        colorScheme='accent'
                    />
                )}

                {/* Amenities */}
                {activeSection === "amenities" && (
                    <AmenitiesSection
                        cafe={cafe}
                        onChange={(key, value) => updateField(key, value)}
                        colorScheme='accent'
                    />
                )}

                {/* Operating Hours */}
                {activeSection === "hours" && (
                    <HoursSection
                        hours={(cafe.operating_hours as OperatingHour[]) || []}
                        onChange={(hours) =>
                            updateField("operating_hours", hours)
                        }
                        colorScheme='accent'
                    />
                )}

                {/* Contact */}
                {activeSection === "contact" && (
                    <ContactSection
                        data={{
                            website_url: cafe.website_url,
                            phone: cafe.phone,
                            email: cafe.email,
                            socials: (cafe.socials as CafeSocial[]) || [],
                        }}
                        onChange={(key, value) => {
                            updateField(
                                key as keyof typeof cafe,
                                value as (typeof cafe)[keyof typeof cafe]
                            )
                            setHasChanges(true)
                        }}
                        colorScheme='accent'
                    />
                )}

                {/* Story */}
                {/* Story Section */}
                {activeSection === "story" && (
                    <StorySection
                        content={storyContent}
                        onChange={(content) => {
                            setStoryContent(content)
                            setStoryHasChanges(true)
                        }}
                        onSave={async () => {
                            setSavingStory(true)
                            const result = await upsertCafeStory(
                                cafe.id,
                                storyContent
                            )
                            setSavingStory(false)
                            if (result.success) {
                                setStoryHasChanges(false)
                            } else {
                                alert(result.error || "Failed to save story")
                            }
                        }}
                        onDelete={async () => {
                            setSavingStory(true)
                            const result = await deleteCafeStory(cafe.id)
                            setSavingStory(false)
                            if (result.success) {
                                setStoryContent("")
                                setStoryHasChanges(false)
                            } else {
                                alert(result.error || "Failed to delete story")
                            }
                        }}
                        hasChanges={storyHasChanges}
                        saving={savingStory}
                        colorScheme='accent'
                    />
                )}

                {/* Menu Section */}
                {activeSection === "menu" && (
                    <MenuSection
                        menu={menu}
                        colorScheme='accent'
                    />
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
                            Owners can manage their cafe listing. Changes are
                            saved when you click the Save button above.
                        </p>
                    </div>
                )}
            </div>

            {/* Menu Item Modal */}
            <MenuItemModal
                open={menu.modalOpen}
                onClose={menu.closeModal}
                onSave={menu.saveItem}
                editingItem={menu.editingItem}
                saving={menu.loading}
                colorScheme='accent'
                cafeId={cafe.id}
            />

            {/* Reject Cafe Modal */}
            <RejectCafeModal
                isOpen={rejectModalOpen}
                onClose={() => setRejectModalOpen(false)}
                cafeName={cafe.name}
                onConfirm={handleReject}
            />
        </div>
    )
}
