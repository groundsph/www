"use client"

/**
 * BasicInfoSection - Shared component for cafe basic information editing.
 * Used by CafeEditor (admin) and CafeEditClient (owner).
 */

import { DollarSign, BadgeCheck } from "lucide-react"
import Image from "next/image"
import {
    type ColorScheme,
    getColorClasses,
    PRICE_LEVELS,
    formatLabel,
    createCustomItemHandlers,
} from "@/utils/hooks/cafe-form"
import {
    CAFE_SPECIALTIES,
    CAFE_VIBE_TAGS,
    BREW_METHODS,
    PAYMENT_METHODS,
    COFFEE_STYLES,
} from "@/utils/data/philippines"
import { Database } from "@/utils/types/database.types"

type PriceLevel = Database["public"]["Enums"]["price_level"]
type CoffeeStyle = Database["public"]["Enums"]["coffee_style"]

export interface BasicInfoData {
    name: string
    slug?: string
    description: string | null
    price_level: PriceLevel | null
    coffee_style?: CoffeeStyle | null
    roaster: string | null
    specialty: string[] | null
    tags: string[] | null
    brew_methods: string[] | null
    payment_methods: string | null
    is_verified?: boolean
    gallery?: string[] | null
}

interface BasicInfoSectionProps {
    /** Current cafe data */
    data: BasicInfoData
    /** Update a single field */
    onChange: <K extends keyof BasicInfoData>(
        key: K,
        value: BasicInfoData[K]
    ) => void
    /** Show slug field (admin only) */
    showSlug?: boolean
    /** Show verified toggle (admin only) */
    showVerifiedToggle?: boolean
    /** Show gallery preview */
    showGalleryPreview?: boolean
    /** Color scheme for theming */
    colorScheme?: ColorScheme
}

/**
 * Basic information section for cafe editing.
 * Includes name, description, price level, specialties, tags, brew methods, and payment methods.
 */
export default function BasicInfoSection({
    data,
    onChange,
    showSlug = false,
    showVerifiedToggle = false,
    showGalleryPreview = true,
    colorScheme = "primary",
}: BasicInfoSectionProps) {
    const colors = getColorClasses(colorScheme)

    // Custom specialty input handler
    const specialtyHandler = createCustomItemHandlers(data.specialty, (items) =>
        onChange("specialty", items)
    )

    // Custom tags input handler
    const tagsHandler = createCustomItemHandlers(data.tags, (items) =>
        onChange("tags", items)
    )

    return (
        <div className='space-y-6'>
            {/* Verified Status Toggle (Admin only) */}
            {showVerifiedToggle && (
                <div className='flex items-center justify-between p-4 bg-background border border-text/10 rounded-lg'>
                    <div className='flex items-center gap-3'>
                        <BadgeCheck
                            className={`w-5 h-5 ${data.is_verified ? colors.text : "text-text opacity-40"}`}
                        />
                        <div>
                            <p className='font-medium'>Verified Cafe</p>
                            <p className='text-sm text-text/60'>
                                Verified cafes display a badge on their listing
                            </p>
                        </div>
                    </div>
                    <button
                        type='button'
                        onClick={() =>
                            onChange("is_verified", !data.is_verified)
                        }
                        className={`relative inline-flex h-6 min-w-11 items-center rounded-full transition-colors cursor-pointer ${
                            data.is_verified ? "bg-text/40" : "bg-text/20"
                        }`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                data.is_verified
                                    ? "translate-x-6"
                                    : "translate-x-1"
                            }`}
                        />
                    </button>
                </div>
            )}

            {/* Cafe Name */}
            <div>
                <label className='block text-sm font-medium text-text/60 mb-2'>
                    Cafe Name *
                </label>
                <input
                    type='text'
                    value={data.name}
                    onChange={(e) => onChange("name", e.target.value)}
                    className={`w-full px-4 py-3 bg-background border border-text/10 rounded-lg focus:outline-none focus:ring-2 ${colors.focusRing}`}
                />
            </div>

            {/* Slug (Admin only) */}
            {showSlug && (
                <div>
                    <label className='block text-sm font-medium text-text/60 mb-2'>
                        Slug (URL Path) *
                    </label>
                    <input
                        type='text'
                        value={data.slug || ""}
                        onChange={(e) => onChange("slug", e.target.value)}
                        className={`w-full px-4 py-3 bg-background border border-text/10 rounded-lg focus:outline-none focus:ring-2 ${colors.focusRing} font-mono text-sm`}
                    />
                    <p className='text-xs text-text/40 mt-1'>
                        Warning: Changing this will break existing links to the
                        cafe page.
                    </p>
                </div>
            )}

            {/* Description */}
            <div>
                <label className='block text-sm font-medium text-text/60 mb-2'>
                    Description
                </label>
                <textarea
                    value={data.description || ""}
                    onChange={(e) => {
                        if (e.target.value.length <= 300) {
                            onChange("description", e.target.value)
                        }
                    }}
                    maxLength={300}
                    rows={4}
                    className={`w-full px-4 py-3 bg-background border border-text/10 rounded-lg focus:outline-none focus:ring-2 ${colors.focusRing} resize-none`}
                    placeholder='Tell us about this cafe...'
                />
                <p
                    className={`text-xs mt-1 ${
                        (data.description?.length || 0) >= 270
                            ? "text-orange-500"
                            : "text-text/40"
                    }`}
                >
                    {300 - (data.description?.length || 0)} characters remaining
                </p>
            </div>

            {/* Price Level */}
            <div>
                <label className='block text-sm font-medium text-text/60 mb-2'>
                    Price Level
                </label>
                <div className='flex gap-2'>
                    {PRICE_LEVELS.map(({ value, level }) => (
                        <button
                            key={value}
                            type='button'
                            onClick={() => onChange("price_level", value)}
                            className={`flex items-center gap-1 px-4 py-2 rounded-lg border transition ${
                                data.price_level === value
                                    ? `${colors.bgLight} ${colors.border} ${colors.text}`
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

            {/* Coffee Style */}
            <div>
                <label className='block text-sm font-medium text-text/60 mb-2'>
                    Coffee Style
                </label>
                <p className='text-xs text-text/40 mb-3'>
                    Classic = traditional espresso bar • Artisan =
                    craft/specialty focus
                </p>
                <div className='flex gap-2'>
                    {COFFEE_STYLES.map(({ value, label, description }) => (
                        <button
                            key={value}
                            type='button'
                            onClick={() =>
                                onChange("coffee_style", value as CoffeeStyle)
                            }
                            className={`flex-1 p-3 rounded-lg border-2 transition text-left ${
                                data.coffee_style === value
                                    ? `${colors.bgLight} ${colors.border} ${colors.text}`
                                    : "bg-background border-text/10 hover:bg-text/5"
                            }`}
                        >
                            <div className='font-medium'>{label}</div>
                            <div className='text-xs opacity-70 mt-0.5'>
                                {description}
                            </div>
                        </button>
                    ))}
                    <button
                        type='button'
                        onClick={() => onChange("coffee_style", null)}
                        className={`px-4 py-3 rounded-lg border-2 transition ${
                            data.coffee_style === null ||
                            data.coffee_style === undefined
                                ? `${colors.bgLight} ${colors.border} ${colors.text}`
                                : "bg-background border-text/10 hover:bg-text/5"
                        }`}
                    >
                        <div className='font-medium'>None</div>
                        <div className='text-xs opacity-70 mt-0.5'>
                            Unclassified
                        </div>
                    </button>
                </div>
            </div>

            {/* Roaster */}
            <div>
                <label className='block text-sm font-medium text-text/60 mb-2'>
                    Roaster
                </label>
                <input
                    type='text'
                    value={data.roaster || ""}
                    onChange={(e) => onChange("roaster", e.target.value)}
                    placeholder='Coffee roaster name'
                    className={`w-full px-4 py-3 bg-background border border-text/10 rounded-lg focus:outline-none focus:ring-2 ${colors.focusRing}`}
                />
            </div>

            {/* Specialties */}
            <div>
                <label className='block text-sm font-medium text-text/60 mb-2'>
                    Specialties
                </label>
                <div className='flex flex-wrap gap-2 mb-3'>
                    {CAFE_SPECIALTIES.map((specialty) => (
                        <button
                            key={specialty}
                            type='button'
                            onClick={() => {
                                const current = data.specialty || []
                                if (current.includes(specialty)) {
                                    onChange(
                                        "specialty",
                                        current.filter((s) => s !== specialty)
                                    )
                                } else {
                                    onChange("specialty", [
                                        ...current,
                                        specialty,
                                    ])
                                }
                            }}
                            className={`px-3 py-1.5 rounded-full text-sm border transition ${
                                data.specialty?.includes(specialty)
                                    ? `${colors.bgLight} ${colors.border} ${colors.text}`
                                    : "bg-background border-text/10 hover:bg-text/5"
                            }`}
                        >
                            {formatLabel(specialty)}
                        </button>
                    ))}
                </div>
                {/* Custom Specialty Input */}
                <div className='flex gap-2'>
                    <input
                        type='text'
                        placeholder='Add custom (comma-separated)'
                        className={`flex-1 px-3 py-2 bg-background border border-text/10 rounded-lg text-sm focus:outline-none focus:ring-2 ${colors.focusRing}`}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault()
                                specialtyHandler.add(
                                    (e.target as HTMLInputElement).value
                                )
                                ;(e.target as HTMLInputElement).value = ""
                            }
                        }}
                    />
                    <button
                        type='button'
                        onClick={(e) => {
                            const input = (e.target as HTMLElement)
                                .previousElementSibling as HTMLInputElement
                            specialtyHandler.add(input.value)
                            input.value = ""
                        }}
                        className={`px-3 py-2 ${colors.bgLight} ${colors.text} rounded-lg text-sm hover:opacity-80 transition`}
                    >
                        Add
                    </button>
                </div>
            </div>

            {/* Tags */}
            <div>
                <label className='block text-sm font-medium text-text/60 mb-2'>
                    Vibe Tags
                </label>
                <div className='flex flex-wrap gap-2 mb-3'>
                    {CAFE_VIBE_TAGS.map((tag) => (
                        <button
                            key={tag}
                            type='button'
                            onClick={() => {
                                const current = data.tags || []
                                if (current.includes(tag)) {
                                    onChange(
                                        "tags",
                                        current.filter((t) => t !== tag)
                                    )
                                } else {
                                    onChange("tags", [...current, tag])
                                }
                            }}
                            className={`px-3 py-1.5 rounded-full text-sm border transition ${
                                data.tags?.includes(tag)
                                    ? `${colors.bgLight} ${colors.border} ${colors.text}`
                                    : "bg-background border-text/10 hover:bg-text/5"
                            }`}
                        >
                            {formatLabel(tag)}
                        </button>
                    ))}
                </div>
                {/* Custom Tags Input */}
                <div className='flex gap-2'>
                    <input
                        type='text'
                        placeholder='Add custom (comma-separated)'
                        className={`flex-1 px-3 py-2 bg-background border border-text/10 rounded-lg text-sm focus:outline-none focus:ring-2 ${colors.focusRing}`}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault()
                                tagsHandler.add(
                                    (e.target as HTMLInputElement).value
                                )
                                ;(e.target as HTMLInputElement).value = ""
                            }
                        }}
                    />
                    <button
                        type='button'
                        onClick={(e) => {
                            const input = (e.target as HTMLElement)
                                .previousElementSibling as HTMLInputElement
                            tagsHandler.add(input.value)
                            input.value = ""
                        }}
                        className={`px-3 py-2 ${colors.bgLight} ${colors.text} rounded-lg text-sm hover:opacity-80 transition`}
                    >
                        Add
                    </button>
                </div>
            </div>

            {/* Brew Methods */}
            <div>
                <label className='block text-sm font-medium text-text/60 mb-2'>
                    Brew Methods
                </label>
                <div className='flex flex-wrap gap-2'>
                    {BREW_METHODS.map((method) => (
                        <button
                            key={method}
                            type='button'
                            onClick={() => {
                                const current = data.brew_methods || []
                                if (current.includes(method)) {
                                    onChange(
                                        "brew_methods",
                                        current.filter((m) => m !== method)
                                    )
                                } else {
                                    onChange("brew_methods", [
                                        ...current,
                                        method,
                                    ])
                                }
                            }}
                            className={`px-3 py-1.5 rounded-full text-sm border transition ${
                                data.brew_methods?.includes(method)
                                    ? `${colors.bgLight} ${colors.border} ${colors.text}`
                                    : "bg-background border-text/10 hover:bg-text/5"
                            }`}
                        >
                            {formatLabel(method)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Payment Methods */}
            <div>
                <label className='block text-sm font-medium text-text/60 mb-2'>
                    Payment Methods
                </label>
                <div className='flex flex-wrap gap-2'>
                    {PAYMENT_METHODS.map((method) => (
                        <button
                            key={method}
                            type='button'
                            onClick={() => {
                                const current = data.payment_methods || ""
                                const methods = current
                                    ? current.split(",").map((m) => m.trim())
                                    : []
                                if (methods.includes(method)) {
                                    onChange(
                                        "payment_methods",
                                        methods
                                            .filter((m) => m !== method)
                                            .join(", ")
                                    )
                                } else {
                                    onChange(
                                        "payment_methods",
                                        [...methods, method].join(", ")
                                    )
                                }
                            }}
                            className={`px-3 py-1.5 rounded-full text-sm border transition ${
                                data.payment_methods
                                    ?.split(",")
                                    .map((m) => m.trim())
                                    .includes(method)
                                    ? `${colors.bgLight} ${colors.border} ${colors.text}`
                                    : "bg-background border-text/10 hover:bg-text/5"
                            }`}
                        >
                            {method}
                        </button>
                    ))}
                </div>
            </div>

            {/* Gallery Preview */}
            {showGalleryPreview && data.gallery && data.gallery.length > 0 && (
                <div>
                    <label className='block text-sm font-medium text-text/60 mb-2'>
                        Gallery ({data.gallery.length} images)
                    </label>
                    <div className='grid grid-cols-4 sm:grid-cols-6 gap-2'>
                        {data.gallery.map((url, idx) => (
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
    )
}
