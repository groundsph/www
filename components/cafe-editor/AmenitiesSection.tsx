import { useState } from "react"
import { CafeWithRatings } from "@/utils/types/extra"
import {
    CAFE_VIBE_TAGS,
    CAFE_SPECIALTIES,
    BREW_METHODS,
    PAYMENT_METHODS,
} from "@/utils/data/philippines"
import AmenityToggles from "@/components/submit/AmenityToggles"

interface AmenitiesSectionProps {
    cafe: CafeWithRatings
    onChange: (
        key: keyof CafeWithRatings,
        value: string | boolean | string[]
    ) => void
    colorScheme?: "primary" | "accent"
}

export default function AmenitiesSection({
    cafe,
    onChange,
    colorScheme = "primary",
}: AmenitiesSectionProps) {
    const [customSpecialties, setCustomSpecialties] = useState("")
    const [customTags, setCustomTags] = useState("")
    const [customPaymentMethods, setCustomPaymentMethods] = useState("")

    // Helper to convert snake_case to Title Case
    const formatLabel = (s: string) =>
        s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

    const addCustomPaymentMethods = () => {
        if (!customPaymentMethods.trim()) return
        const newMethods = customPaymentMethods
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        const current =
            cafe.payment_methods
                ?.split(",")
                .map((s) => s.trim())
                .filter(Boolean) || []
        const unique = [...new Set([...current, ...newMethods])]
        onChange("payment_methods", unique.join(", "))
        setCustomPaymentMethods("")
    }

    const addCustomSpecialties = () => {
        if (!customSpecialties.trim()) return
        const newSpecialties = customSpecialties
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        const current = cafe.specialty || []
        const unique = [...new Set([...current, ...newSpecialties])]
        onChange("specialty", unique)
        setCustomSpecialties("")
    }

    const addCustomTags = () => {
        if (!customTags.trim()) return
        const newTags = customTags
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        const current = cafe.tags || []
        const unique = [...new Set([...current, ...newTags])]
        onChange("tags", unique)
        setCustomTags("")
    }

    const activeColorClass =
        colorScheme === "primary"
            ? "bg-primary/20 text-primary border-primary/30"
            : "bg-accent/20 text-accent border-accent/30"

    return (
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
                        is_pet_friendly: cafe.is_pet_friendly || false,
                        has_outdoor_seating: cafe.has_outdoor_seating || false,
                        has_indoor_seating: cafe.has_indoor_seating || false,
                        has_restroom: cafe.has_restroom || false,
                        has_bidet: cafe.has_bidet || false,
                        has_non_dairy: cafe.has_non_dairy || false,
                        serves_food: cafe.serves_food || false,
                        is_work_friendly: cafe.is_work_friendly || false,
                    }}
                    onChange={(key, value) =>
                        onChange(key as keyof CafeWithRatings, value)
                    }
                />
            </div>

            {/* Milk Options (conditional) */}
            {cafe.has_non_dairy && (
                <div>
                    <label className='block text-sm font-medium text-text/60 mb-2'>
                        Non-Dairy Milk Options
                    </label>
                    <input
                        type='text'
                        value={(cafe.milk_options || []).join(", ")}
                        onChange={(e) => {
                            const options = e.target.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean)
                            onChange("milk_options", options)
                        }}
                        placeholder='Oat, Almond, Soy, Coconut...'
                        className={`w-full px-4 py-3 bg-background border border-text/10 rounded-lg focus:outline-none focus:ring-2 ${
                            colorScheme === "primary"
                                ? "focus:ring-primary/50"
                                : "focus:ring-accent/50"
                        }`}
                    />
                    <p className='text-xs text-text/40 mt-1'>
                        Comma-separated list of available non-dairy milk options
                    </p>
                </div>
            )}

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
                                        ? current.filter((m) => m !== method)
                                        : [...current, method]
                                    onChange(
                                        "payment_methods",
                                        updated.join(", ")
                                    )
                                }}
                                className={`px-3 py-1.5 rounded-full text-sm transition ${
                                    isSelected
                                        ? `${activeColorClass} border`
                                        : "bg-text/5 border border-text/10 hover:bg-text/10"
                                }`}
                            >
                                {formatLabel(method)}
                            </button>
                        )
                    })}
                </div>
                <div className='flex gap-2'>
                    <input
                        type='text'
                        value={customPaymentMethods}
                        onChange={(e) =>
                            setCustomPaymentMethods(e.target.value)
                        }
                        onKeyDown={(e) =>
                            e.key === "Enter" &&
                            (e.preventDefault(), addCustomPaymentMethods())
                        }
                        placeholder='Add custom (comma-separated)'
                        className='flex-1 px-3 py-2 bg-background border border-text/10 rounded-lg text-sm'
                    />
                    <button
                        onClick={addCustomPaymentMethods}
                        className='px-3 py-2 bg-text/10 rounded-lg text-sm hover:bg-text/20'
                    >
                        Add
                    </button>
                </div>
                {cafe.payment_methods && cafe.payment_methods.length > 0 && (
                    <div className='flex flex-wrap gap-1 mt-2'>
                        {cafe.payment_methods
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean)
                            .map((s) => (
                                <span
                                    key={s}
                                    className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${
                                        colorScheme === "primary"
                                            ? "bg-primary/20 text-primary"
                                            : "bg-accent/20 text-accent"
                                    }`}
                                >
                                    {formatLabel(s)}
                                    <button
                                        onClick={() => {
                                            const current =
                                                cafe.payment_methods
                                                    ?.split(",")
                                                    .map((x) => x.trim())
                                                    .filter(Boolean) || []
                                            onChange(
                                                "payment_methods",
                                                current
                                                    .filter((x) => x !== s)
                                                    .join(", ")
                                            )
                                        }}
                                        className='hover:text-red-400'
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                    </div>
                )}
            </div>

            {/* Specialties */}
            <div>
                <label className='block text-sm font-medium text-text/60 mb-2'>
                    Specialties
                </label>
                <div className='flex flex-wrap gap-2 mb-2'>
                    {CAFE_SPECIALTIES.map((s) => {
                        const isSelected = cafe.specialty?.includes(s)
                        return (
                            <button
                                key={s}
                                onClick={() => {
                                    const current = cafe.specialty || []
                                    const updated = isSelected
                                        ? current.filter((x) => x !== s)
                                        : [...current, s]
                                    onChange("specialty", updated as string[])
                                }}
                                className={`px-3 py-1.5 rounded-full text-sm transition ${
                                    isSelected
                                        ? `${activeColorClass} border`
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
                        onChange={(e) => setCustomSpecialties(e.target.value)}
                        onKeyDown={(e) =>
                            e.key === "Enter" &&
                            (e.preventDefault(), addCustomSpecialties())
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
                                className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${
                                    colorScheme === "primary"
                                        ? "bg-primary/20 text-primary"
                                        : "bg-accent/20 text-accent"
                                }`}
                            >
                                {formatLabel(s)}
                                <button
                                    onClick={() =>
                                        onChange(
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
                                        ? current.filter((x) => x !== t)
                                        : [...current, t]
                                    onChange("tags", updated as string[])
                                }}
                                className={`px-3 py-1.5 rounded-full text-sm transition ${
                                    isSelected
                                        ? `${activeColorClass} border`
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
                        onChange={(e) => setCustomTags(e.target.value)}
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
                                        onChange(
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
                        const isSelected = cafe.brew_methods?.includes(method)
                        return (
                            <button
                                key={method}
                                onClick={() => {
                                    const current = cafe.brew_methods || []
                                    const updated = isSelected
                                        ? current.filter((x) => x !== method)
                                        : [...current, method]
                                    onChange(
                                        "brew_methods",
                                        updated as string[]
                                    )
                                }}
                                className={`px-3 py-1.5 rounded-full text-sm transition ${
                                    isSelected
                                        ? `${activeColorClass} border`
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
    )
}
