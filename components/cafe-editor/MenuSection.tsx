"use client"

import { useState, useMemo } from "react"
import { Coffee, Pencil, Trash2, Users, AlertCircle } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { UseMenuItemsReturn } from "@/utils/hooks/useMenuItems"
import MenuOcrScanButton from "@/components/suggestions/MenuOcrScanButton"

type FilterType = "all" | "coffee" | "food" | "cold" | "hot" | "vegan"

interface MenuSectionProps {
    menu: UseMenuItemsReturn
    colorScheme?: "primary" | "accent"
    pendingSuggestionsCount?: number
    cafeId: string
    cafeName: string
    cafeSlug?: string
}

export default function MenuSection({
    menu,
    colorScheme = "primary",
    pendingSuggestionsCount = 0,
    cafeId,
    cafeName,
    cafeSlug,
}: MenuSectionProps) {
    const [activeFilter, setActiveFilter] = useState<FilterType>("all")

    const buttonBaseClasses =
        "inline-flex items-center gap-1 px-3 py-2 text-white rounded-lg text-sm font-medium transition-colors"
    const buttonColorClasses =
        colorScheme === "accent"
            ? "bg-accent hover:bg-accent/90"
            : "bg-primary hover:bg-primary/90"

    // Filter items based on active filter
    const filteredItems = useMemo(() => {
        switch (activeFilter) {
            case "coffee":
                return menu.items.filter((item) => !item.is_food)
            case "food":
                return menu.items.filter((item) => item.is_food)
            case "cold":
                return menu.items.filter((item) => item.is_cold)
            case "hot":
                return menu.items.filter((item) => item.is_hot)
            case "vegan":
                return menu.items.filter((item) => item.is_vegan)
            default:
                return menu.items
        }
    }, [menu.items, activeFilter])

    // Group items by category
    const categories = [...new Set(filteredItems.map((item) => item.category))]

    const filterPills: { key: FilterType; label: string }[] = [
        { key: "all", label: "All" },
        { key: "coffee", label: "Coffee" },
        { key: "food", label: "Food" },
        { key: "cold", label: "Cold" },
        { key: "hot", label: "Hot" },
        { key: "vegan", label: "Vegan" },
    ]

    return (
        <div className='space-y-6 [&_button]:cursor-pointer'>
            {/* Pending Suggestions Notice */}
            {pendingSuggestionsCount > 0 && (
                <Link
                    href={cafeSlug ? `/cafes/${cafeSlug}/suggestions` : "#"}
                    className='flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors'
                >
                    <AlertCircle className='w-5 h-5 text-amber-600 shrink-0' />
                    <div className='flex-1'>
                        <p className='font-medium text-amber-800'>
                            {pendingSuggestionsCount} community menu suggestion{pendingSuggestionsCount !== 1 ? "s" : ""} pending review
                        </p>
                        <p className='text-sm text-amber-700/70'>
                            Click to review and approve or reject suggestions
                        </p>
                    </div>
                </Link>
            )}

            {/* Filters */}
            <div className='flex flex-wrap gap-2'>
                {filterPills.map((filter) => (
                    <button
                        key={filter.key}
                        onClick={() => setActiveFilter(filter.key)}
                        className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                            activeFilter === filter.key
                                ? "bg-primary text-white"
                                : "bg-text/10 text-text/70 hover:bg-text/20"
                        }`}
                    >
                        {filter.label}
                    </button>
                ))}
            </div>

            <div className='flex items-center justify-between'>
                <p className='text-text/60'>{filteredItems.length} menu items</p>
                <div className='flex items-center gap-2'>
                    <MenuOcrScanButton
                        cafeId={cafeId}
                        cafeName={cafeName}
                        cafeSlug={cafeSlug ?? ""}
                        variant='default'
                    />
                    <button
                        onClick={menu.openCreateModal}
                        className={`${buttonBaseClasses} ${buttonColorClasses}`}
                    >
                        + Add Item
                    </button>
                </div>
            </div>

            {filteredItems.length === 0 ? (
                <div className='text-center py-8 text-text/50'>
                    <Coffee className='w-12 h-12 mx-auto mb-3 opacity-30' />
                    <p>No menu items yet</p>
                </div>
            ) : (
                <div className='space-y-6'>
                    {categories.map((category) => (
                        <div key={category}>
                            <h3 className='text-sm font-semibold text-text/70 uppercase tracking-wide mb-3'>
                                {category}
                            </h3>
                            <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3'>
                                {filteredItems
                                    .filter(
                                        (item) => item.category === category
                                    )
                                    .map((item) => (
                                        <div
                                            key={item.id}
                                            className={`relative p-3 rounded-xl border transition-all ${
                                                item.is_available
                                                    ? "bg-text/5 border-text/10"
                                                    : "bg-red-50 border-red-200 opacity-60"
                                            }`}
                                        >
                                            {/* Image */}
                                            {item.image_url && (
                                                <div className='relative w-full aspect-square rounded-lg overflow-hidden mb-2'>
                                                    <Image
                                                        src={item.image_url}
                                                        alt={item.name}
                                                        fill
                                                        className='object-cover'
                                                    />
                                                </div>
                                            )}

                                            {/* Item Info */}
                                            <div className='space-y-1'>
                                                <div className='flex items-start justify-between gap-1'>
                                                    <h4 className='font-medium text-sm leading-tight'>
                                                        {item.name}
                                                        {item.is_signature && (
                                                            <span className='ml-1 text-amber-500'>
                                                                ★
                                                            </span>
                                                        )}
                                                    </h4>
                                                </div>
                                                {/* Community Badge */}
                                                {item.community_submitted && (
                                                    <div className='flex items-center gap-1 text-xs text-emerald-600'>
                                                        <Users className='w-3 h-3' />
                                                        <span className='font-medium'>Community</span>
                                                    </div>
                                                )}
                                                <p className='text-sm font-semibold text-primary'>
                                                    ₱{item.price.toFixed(0)}
                                                </p>
                                            </div>

                                            {/* Actions Row */}
                                            <div className='flex items-center justify-between mt-3 pt-2 border-t border-text/10'>
                                                {/* Availability Toggle */}
                                                <button
                                                    onClick={() =>
                                                        menu.toggleAvailability(
                                                            item
                                                        )
                                                    }
                                                    className={`relative w-10 h-5 rounded-full transition-colors ${
                                                        item.is_available
                                                            ? "bg-green-500"
                                                            : "bg-gray-300"
                                                    }`}
                                                    title={
                                                        item.is_available
                                                            ? "Mark as unavailable"
                                                            : "Mark as available"
                                                    }
                                                >
                                                    <span
                                                        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                                            item.is_available
                                                                ? "translate-x-5"
                                                                : "translate-x-0"
                                                        }`}
                                                    />
                                                </button>

                                                {/* Edit/Delete Buttons */}
                                                <div className='flex items-center gap-1'>
                                                    <button
                                                        onClick={() =>
                                                            menu.openEditModal(
                                                                item
                                                            )
                                                        }
                                                        className='p-1.5 text-text/40 hover:text-text transition-colors rounded'
                                                        title='Edit item'
                                                    >
                                                        <Pencil className='w-3.5 h-3.5' />
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            menu.deleteItem(
                                                                item
                                                            )
                                                        }
                                                        className='p-1.5 text-text/40 hover:text-red-500 transition-colors rounded'
                                                        title='Delete item'
                                                    >
                                                        <Trash2 className='w-3.5 h-3.5' />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
