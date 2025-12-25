"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
    XIcon,
    Loader2,
    ChevronDown,
    ChevronUp,
    Wifi,
    Plug,
    Car,
    Snowflake,
    PawPrint,
    Sun,
    Utensils,
    Briefcase,
    ImagePlus,
} from "lucide-react"
import { submitEditSuggestion } from "@/app/api/actions/suggestions"
import { SuggestableFields } from "@/utils/types/suggestions"
import { CafeWithRatings } from "@/utils/types/extra"
import { useRouter } from "next/navigation"

interface SuggestEditModalProps {
    isOpen: boolean
    onClose: () => void
    cafe: CafeWithRatings
}

// Field categories for the UI
const AMENITY_FIELDS = [
    { key: "has_wifi", label: "WiFi", icon: Wifi },
    { key: "has_sockets", label: "Power Outlets", icon: Plug },
    { key: "has_parking", label: "Parking", icon: Car },
    { key: "has_aircon", label: "Air Conditioning", icon: Snowflake },
    { key: "is_pet_friendly", label: "Pet Friendly", icon: PawPrint },
    { key: "has_outdoor_seating", label: "Outdoor Seating", icon: Sun },
    { key: "serves_food", label: "Serves Food", icon: Utensils },
    { key: "is_work_friendly", label: "Work Friendly", icon: Briefcase },
] as const

type AmenityKey = (typeof AMENITY_FIELDS)[number]["key"]

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

    // Reset form when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setChanges({})
            setError(null)
            setSuccess(false)
        }
    }, [isOpen])

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

    const updateChange = <K extends keyof SuggestableFields>(
        key: K,
        value: SuggestableFields[K]
    ) => {
        setChanges((prev) => {
            const cafeValue = cafe[key as keyof CafeWithRatings]
            // If value matches current cafe value, remove from changes
            if (value === cafeValue || (value === "" && !cafeValue)) {
                const { [key]: removed, ...rest } = prev
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
                const { [key]: removed, ...rest } = prev
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

    const handleSubmit = async () => {
        // Validate there are changes
        if (Object.keys(changes).length === 0) {
            setError("Please make at least one change before submitting")
            return
        }

        setIsSubmitting(true)
        setError(null)

        try {
            const result = await submitEditSuggestion(cafe.id, changes)

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
        }
    }

    const changesCount = Object.keys(changes).length

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className='fixed inset-0 bg-black/40 z-50 backdrop-blur-sm'
                    />
                    <motion.div
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
                                            <span className='font-medium'>
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
                                                            changes.description !==
                                                            undefined
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
                                                            changes.address_display !==
                                                            undefined
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
                                            <span className='font-medium'>
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
                                                            const hasChange =
                                                                changes[key] !==
                                                                undefined
                                                            const displayValue =
                                                                hasChange
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
                                                                        hasChange
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
                                                                    {hasChange && (
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
                                            <span className='font-medium'>
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
                                                            changes.phone !==
                                                            undefined
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
                                                            changes.email !==
                                                            undefined
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
                                                            changes.website_url !==
                                                            undefined
                                                                ? "border-primary/50 ring-2 ring-primary/20"
                                                                : "border-text/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                                                        }`}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Images Info */}
                                    <div className='bg-text/5 border border-text/10 rounded-lg p-3 flex items-start gap-3'>
                                        <ImagePlus className='w-5 h-5 text-text/40 mt-0.5' />
                                        <div className='text-sm text-text/60'>
                                            <p>
                                                <strong>
                                                    Want to add photos?
                                                </strong>{" "}
                                                Image suggestions are coming
                                                soon! For now, you can suggest
                                                text updates.
                                            </p>
                                        </div>
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
                                    Submit Suggestion
                                </button>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
