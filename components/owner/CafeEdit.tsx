"use client"

import { useState, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "motion/react"
import Image from "next/image"
import {
    MapPin,
    DollarSign,
    Coffee,
    Clock,
    Phone,
    Settings,
    FileText,
    ImagePlus,
    Gem,
    UtensilsCrossed,
} from "lucide-react"
import {
    updateCafeAsOwner,
    deleteCafeImageAsOwner,
    updateCafeImagesAsOwner,
    updateCafeStory,
    setCafeBadgeStamp,
    removeCafeBadgeStamp,
} from "@/app/api/actions/owner"
import { CafeWithRatings } from "@/utils/types/extra"
import { deleteCafeBadgeStampAction } from "@/utils/storage/actions"
import { CafeMenuItem } from "@/utils/types/owner"
import { OperatingHour, CafeSocial } from "@/utils/types/cafe"
import { Database } from "@/utils/types/database.types"
import TextField from "@/components/ui/TextField"
import { useNotification } from "@/components/layout/NotificationProvider"
import { getCafeThumbnailUrl } from "@/utils/extras"
import MarkdownEditor from "@/components/ui/markdown-editor/MarkdownEditor"
import {
    ContactSection,
    StorySection,
    LocationSection,
    ImageSection,
    AmenitiesSection,
    HoursSection,
    MenuSection,
    MenuItemModal,
} from "@/components/cafe-editor"
import { useCafeImages } from "@/utils/hooks/useCafeImages"
import { EditorShell, EditorHeader } from "@/components/cafe-editor"
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges"
import { useMenuItems } from "@/utils/hooks/useMenuItems"

type PriceLevel = Database["public"]["Enums"]["price_level"]

interface CafeEditProps {
    cafe: CafeWithRatings
    menuItems: CafeMenuItem[]
}

export default function CafeEdit({
    cafe: initialCafe,
    menuItems: initialMenuItems,
}: CafeEditProps) {
    const { addNotification } = useNotification()
    const [cafe, setCafe] = useState(initialCafe)

    const [saving, setSaving] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)

    // Cover and gallery persist as they change; the main Save never carries them.
    const cafeImages = useCafeImages({
        cafeId: cafe.id,
        initial: { thumbnail: cafe.thumbnail, gallery: cafe.gallery || [] },
        save: (patch) => updateCafeImagesAsOwner(cafe.id, patch),
        removeFile: (url) => deleteCafeImageAsOwner(cafe.id, url),
    })

    const initialCafeRef = useRef(cafe)
    useUnsavedChanges(hasChanges)

    const handleDiscard = useCallback(() => {
        setCafe(initialCafeRef.current)
        setHasChanges(false)
        addNotification("Changes discarded", "success")
    }, [addNotification])
    const [activeSection, setActiveSection] = useState<
        | "basic"
        | "images"
        | "location"
        | "amenities"
        | "hours"
        | "contact"
        | "story"
        | "menu"
    >("basic")

    const menu = useMenuItems({
        initialItems: initialMenuItems,
        cafeId: cafe.id,
    })

    const storyContent = useState(initialCafe.story?.content || "")[0]
    const setStoryContent = useState(initialCafe.story?.content || "")[1]
    const [savingStory, setSavingStory] = useState(false)
    const [storyHasChanges, setStoryHasChanges] = useState(false)

    const updateField = useCallback(
        <K extends keyof typeof cafe>(key: K, value: (typeof cafe)[K]) => {
            setCafe((prev) => ({ ...prev, [key]: value }))
            setHasChanges(true)
        },
        []
    )

    const handleSave = async () => {
        setSaving(true)
        const result = await updateCafeAsOwner(cafe.id, {
            name: cafe.name,
            description: cafe.description || undefined,
            address_display: cafe.address_display,
            area: cafe.area || undefined,
            lat: cafe.lat || undefined,
            lng: cafe.lng || undefined,
            region: cafe.region,
            province: cafe.province,
            city_municipality: cafe.city_municipality,
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
            price_level: cafe.price_level || "mid",
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
            is_hidden_gem: cafe.is_hidden_gem || false,
            finding_hint: cafe.finding_hint || null,
        })
        setSaving(false)
        if (result.success) {
            setHasChanges(false)
            addNotification("Changes saved successfully", "success")
        } else {
            addNotification(result.error || "Failed to save changes", "error")
        }
    }

    const SECTIONS = [
        { id: "basic" as const, title: "Basic Info", icon: Coffee },
        { id: "images" as const, title: "Images", icon: ImagePlus },
        { id: "location" as const, title: "Location", icon: MapPin },
        { id: "amenities" as const, title: "Amenities", icon: Settings },
        { id: "hours" as const, title: "Hours", icon: Clock },
        { id: "contact" as const, title: "Contact", icon: Phone },
        { id: "story" as const, title: "Story", icon: FileText },
        { id: "menu" as const, title: "Menu", icon: UtensilsCrossed },
    ]

    const PRICE_LEVELS: { value: PriceLevel; level: number }[] = [
        { value: "budget", level: 1 },
        { value: "mid", level: 2 },
        { value: "premium", level: 3 },
        { value: "luxury", level: 4 },
    ]

    return (
        <div className='w-full overflow-hidden space-y-6 [&_button]:cursor-pointer'>
            <EditorShell
                ariaLabel='Cafe sections'
                colorScheme='primary'
                header={
                    <EditorHeader
                        title={`Edit ${cafe.name}`}
                        subtitle='Update your cafe information'
                        chips={[
                            {
                                label: cafe.is_published ? "Published" : "Pending review",
                                tone: cafe.is_published ? ("green" as const) : ("amber" as const),
                            },
                        ]}
                        backHref={`/owner/cafes/${cafe.slug}`}
                        backLabel='Back to cafe'
                    />
                }
                tabs={SECTIONS.map(({ id, title, icon }) => ({
                    id,
                    label: title,
                    icon,
                    dirty: id === "images" ? cafeImages.saveState.dirty : hasChanges && activeSection !== id,
                }))}
                activeSection={activeSection}
                onSectionChange={(id) => setActiveSection(id as typeof activeSection)}
                saveState={{
                    dirty: hasChanges || cafeImages.saveState.dirty,
                    saving: saving || cafeImages.saveState.saving,
                    lastSavedAt: cafeImages.saveState.lastSavedAt,
                    error: cafeImages.saveState.error,
                }}
                onSave={handleSave}
                onDiscard={handleDiscard}
            >
                <div className='space-y-6'>
                <div className='relative h-auto aspect-6/2 rounded-xl overflow-hidden bg-text/5'>
                    {cafe.thumbnail ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                        >
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
                        </motion.div>
                    ) : (
                        <div className='w-full h-full flex items-center justify-center text-text opacity-30'>
                            No cover image
                        </div>
                    )}
                </div>

            <motion.div
                className='w-full min-h-[400px] bg-text/5 border border-text/10 rounded-xl p-6'
                layout
            >
                <AnimatePresence mode='wait'>
                    <motion.div
                        key={activeSection}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.2 }}
                        className='w-full'
                    >
                        {activeSection === "basic" && (
                            <div className='space-y-6'>
                                <div className='flex flex-col gap-4 p-4 bg-background border border-text/10 rounded-lg'>
                                    <div className='flex items-center justify-between'>
                                        <div className='flex items-center gap-3'>
                                            <Gem
                                                className={`w-5 h-5 ${cafe.is_hidden_gem ? "text-amber-500" : "text-text opacity-40"}`}
                                            />
                                            <div>
                                                <p className='font-medium'>
                                                    Hidden Gem
                                                </p>
                                                <p className='text-sm text-text/60'>
                                                    Mark as a Hidden Gem (excluded from
                                                    maps)
                                                </p>
                                            </div>
                                        </div>
                                        <motion.button
                                            onClick={() =>
                                                updateField(
                                                    "is_hidden_gem",
                                                    !cafe.is_hidden_gem
                                                )
                                            }
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            className={`relative inline-flex h-6 min-w-11 items-center rounded-full transition-colors cursor-pointer ${
                                                cafe.is_hidden_gem
                                                    ? "bg-amber-500"
                                                    : "bg-text/20"
                                            }`}
                                        >
                                            <motion.span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                    cafe.is_hidden_gem
                                                        ? "translate-x-6"
                                                        : "translate-x-1"
                                                }`}
                                                animate={{
                                                    x: cafe.is_hidden_gem ? 24 : 4,
                                                }}
                                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                            />
                                        </motion.button>
                                    </div>
                                    {cafe.is_hidden_gem && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                        >
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
                                                className='w-full px-4 py-2 bg-background border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm'
                                            />
                                        </motion.div>
                                    )}
                                </div>
                                <TextField
                                    label='Cafe Name *'
                                    value={cafe.name}
                                    onChange={(value) => updateField("name", value)}
                                />

                                <div>
                                    <label className='block text-sm font-medium text-text/60 mb-2'>
                                        Description
                                    </label>
                                    <MarkdownEditor
                                        mode="description"
                                        value={cafe.description || ""}
                                        onChange={(value) => {
                                            if (value.length <= 300) {
                                                updateField(
                                                    "description",
                                                    value
                                                )
                                            }
                                        }}
                                        maxLength={300}
                                        showCharCount
                                        placeholder="Tell us about this cafe..."
                                        minHeight={80}
                                    />
                                </div>

                                <div>
                                    <label className='block text-sm font-medium text-text/60 mb-2'>
                                        Price Level
                                    </label>
                                    <div className='flex gap-2'>
                                        {PRICE_LEVELS.map(({ value, level }) => (
                                            <motion.button
                                                key={value}
                                                onClick={() =>
                                                    updateField("price_level", value)
                                                }
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
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
                                            </motion.button>
                                        ))}
                                    </div>
                                </div>

                                <TextField
                                    label='Roaster'
                                    value={cafe.roaster || ""}
                                    onChange={(value) => updateField("roaster", value)}
                                    placeholder='Coffee roaster name'
                                />

                                {cafe.gallery && cafe.gallery.length > 0 && (
                                    <div>
                                        <label className='block text-sm font-medium text-text/60 mb-2'>
                                            Gallery ({cafe.gallery.length} images)
                                        </label>
                                        <div className='grid grid-cols-4 sm:grid-cols-6 gap-2'>
                                            {cafe.gallery.map((url, idx) => (
                                                <motion.div
                                                    key={idx}
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{ delay: idx * 0.05 }}
                                                    className='relative aspect-square rounded-lg overflow-hidden'
                                                >
                                                    <Image
                                                        src={url}
                                                        alt={`Gallery ${idx + 1}`}
                                                        fill
                                                        className='object-cover'
                                                    />
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeSection === "images" && (
                            <ImageSection
                                thumbnail={cafeImages.thumbnail}
                                gallery={cafeImages.gallery}
                                cafeId={cafe.id}
                                cafeName={cafe.name}
                                onThumbnailChange={(url: string | null) => {
                                    cafeImages.setCoverImage(url)
                                }}
                                onGalleryChange={(urls: string[]) => {
                                    cafeImages.replaceGallery(urls)
                                }}
                                onImageUploaded={(url: string) => {
                                    cafeImages.appendGallery([url])
                                }}
                                onDeleteImage={async (_url: string, index: number) => {
                                    await cafeImages.removeGalleryAt(index)
                                }}
                                onRemoveCoverImage={async () => {
                                    await cafeImages.clearThumbnail()
                                }}
                                colorScheme='primary'
                                badgeStampUrl={cafe.badge_stamp_url}
                                onBadgeStampChange={async (url: string | null) => {
                                    if (url) {
                                        // Upload new badge stamp
                                        const result = await setCafeBadgeStamp(cafe.id, url)
                                        if (result.success) {
                                            updateField("badge_stamp_url", url)
                                            addNotification("Badge stamp updated", "success")
                                        } else {
                                            addNotification(result.error || "Failed to update badge stamp", "error")
                                        }
                                    } else {
                                        // Remove badge stamp
                                        const prevUrl = cafe.badge_stamp_url
                                        if (prevUrl) {
                                            await deleteCafeBadgeStampAction(prevUrl)
                                        }
                                        const result = await removeCafeBadgeStamp(cafe.id)
                                        if (result.success) {
                                            updateField("badge_stamp_url", null)
                                            addNotification("Badge stamp removed", "success")
                                        } else {
                                            addNotification(result.error || "Failed to remove badge stamp", "error")
                                        }
                                    }
                                }}
                            />
                        )}

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
                                readOnlyLocation={false}
                                colorScheme='primary'
                            />
                        )}

                        {activeSection === "amenities" && (
                            <AmenitiesSection
                                cafe={cafe}
                                onChange={(key, value) => updateField(key, value)}
                                colorScheme='primary'
                            />
                        )}

                        {activeSection === "hours" && (
                            <HoursSection
                                hours={(cafe.operating_hours as OperatingHour[]) || []}
                                onChange={(hours) =>
                                    updateField("operating_hours", hours)
                                }
                                colorScheme='primary'
                            />
                        )}

                        {activeSection === "contact" && (
                            <ContactSection
                                data={{
                                    website_url: cafe.website_url,
                                    phone: cafe.phone,
                                    email: cafe.email,
                                    socials: cafe.socials as CafeSocial[] | null,
                                }}
                                onChange={(key, value) => {
                                    updateField(
                                        key as keyof typeof cafe,
                                        value as unknown as (typeof cafe)[keyof typeof cafe]
                                    )
                                    setHasChanges(true)
                                }}
                                colorScheme='primary'
                            />
                        )}

                        {activeSection === "story" && (
                            <StorySection
                                content={storyContent}
                                onChange={(content) => {
                                    setStoryContent(content)
                                    setStoryHasChanges(true)
                                }}
                                onSave={async () => {
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
                                            result.error || "Failed to save story",
                                            "error"
                                        )
                                    }
                                }}
                                hasChanges={storyHasChanges}
                                saving={savingStory}
                                colorScheme='primary'
                            />
                        )}

                        {activeSection === "menu" && (
                            <MenuSection
                                menu={menu}
                                colorScheme='primary'
                                cafeId={cafe.id}
                                cafeName={cafe.name}
                                cafeSlug={cafe.slug}
                            />
                        )}
                    </motion.div>
                </AnimatePresence>
            </motion.div>
                </div>
            </EditorShell>

            <MenuItemModal
                open={menu.modalOpen}
                onClose={menu.closeModal}
                onSave={menu.saveItem}
                editingItem={menu.editingItem}
                saving={menu.loading}
                colorScheme='primary'
                cafeId={cafe.id}
            />

        </div>
    )
}
