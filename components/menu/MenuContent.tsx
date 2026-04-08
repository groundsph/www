"use client"

import { useState, useCallback, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion, AnimatePresence } from "motion/react"
import { X, ChevronDown, Scale, Plus, Check, Flame, Snowflake, UtensilsCrossed, Leaf, Globe, Pencil, Coffee } from "lucide-react"
import dynamic from "next/dynamic"
import MenuOcrScanButton from "@/components/suggestions/MenuOcrScanButton"
import { useAuth } from "@/components/layout/AuthProvider"
import SuggestMenuItemButton from "@/components/suggestions/SuggestMenuItemButton"
import type { ComparableMenuItem } from "@/utils/types/menu-comparison"

const MenuComparisonModal = dynamic(
    () => import("@/components/menu/MenuComparisonModal"),
    { ssr: false }
)

const SuggestMenuItemModal = dynamic(
    () => import("@/components/suggestions/SuggestMenuItemModal"),
    { ssr: false }
)

interface SizeOption {
    label: string
    price: number
}

interface MenuItem {
    id: string
    name: string
    description: string | null
    price: number
    category: string
    imageUrl: string | null
    isSignature: boolean | null
    isAvailable: boolean | null
    isFood: boolean | null
    isHot: boolean | null
    isCold: boolean | null
    calories: number | null
    isVegan: boolean | null
    isVegetarian: boolean | null
    sizeOptions: SizeOption[] | null
    communitySubmitted: boolean | null
}

interface MenuContentProps {
    menuItems: MenuItem[]
    categories: string[]
    cafeId: string
    cafeName: string
    cafeSlug: string
}

type FilterType = "all" | "coffee" | "food" | "cold" | "hot" | "vegan"

export default function MenuContent({
    menuItems,
    categories,
    cafeId,
    cafeName,
    cafeSlug,
}: MenuContentProps) {
    const [lightboxImage, setLightboxImage] = useState<{
        url: string
        alt: string
    } | null>(null)
    const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
        new Set()
    )
    const [isCompareModalOpen, setIsCompareModalOpen] = useState(false)
    const [compareItemIds, setCompareItemIds] = useState<string[]>([])
    const [activeFilter, setActiveFilter] = useState<FilterType>("all")
    const [editTarget, setEditTarget] = useState<MenuItem | null>(null)

    const { user: authUser } = useAuth()

    const toggleCategory = (category: string) => {
        setCollapsedCategories((prev) => {
            const newSet = new Set(prev)
            if (newSet.has(category)) {
                newSet.delete(category)
            } else {
                newSet.add(category)
            }
            return newSet
        })
    }

    const toggleCompareItem = useCallback((item: MenuItem) => {
        setCompareItemIds((prev) => {
            if (prev.includes(item.id)) {
                return prev.filter((id) => id !== item.id)
            }
            if (prev.length >= 4) {
                return prev
            }
            return [...prev, item.id]
        })
    }, [])

    const isItemInComparison = useCallback(
        (itemId: string) => compareItemIds.includes(itemId),
        [compareItemIds]
    )

    const handleOpenCompareModal = useCallback(() => {
        setIsCompareModalOpen(true)
    }, [])

    const handleCloseCompareModal = useCallback(() => {
        setIsCompareModalOpen(false)
    }, [])

    // Filter items based on active filter
    const filteredMenuItems = useMemo(() => {
        switch (activeFilter) {
            case "coffee":
                return menuItems.filter((item) => !item.isFood)
            case "food":
                return menuItems.filter((item) => item.isFood)
            case "cold":
                return menuItems.filter((item) => item.isCold)
            case "hot":
                return menuItems.filter((item) => item.isHot)
            case "vegan":
                return menuItems.filter((item) => item.isVegan)
            default:
                return menuItems
        }
    }, [menuItems, activeFilter])

    // Get categories that have items after filtering
    const filteredCategories = useMemo(() => {
        const categoriesWithItems = new Set(filteredMenuItems.map((item) => item.category))
        return categories.filter((cat) => categoriesWithItems.has(cat))
    }, [categories, filteredMenuItems])

    const filterPills: { key: FilterType; label: string }[] = [
        { key: "all", label: "All" },
        { key: "coffee", label: "Coffee" },
        { key: "food", label: "Food" },
        { key: "cold", label: "Cold" },
        { key: "hot", label: "Hot" },
        { key: "vegan", label: "Vegan" },
    ]

    // Convert MenuItem to ComparableMenuItem
    const toComparableItem = useCallback((item: MenuItem): ComparableMenuItem => ({
        id: item.id,
        cafeId: cafeId,
        cafeName: cafeName,
        cafeSlug: cafeSlug,
        name: item.name,
        category: item.category,
        price: item.price,
        description: item.description,
        isAvailable: item.isAvailable ?? true,
        isFood: item.isFood ?? false,
        isHot: item.isHot ?? false,
        isCold: item.isCold ?? false,
        calories: item.calories,
        isVegan: item.isVegan ?? false,
        isVegetarian: item.isVegetarian ?? false,
        sizeOptions: item.sizeOptions,
        imageUrl: item.imageUrl,
    }), [cafeId, cafeName, cafeSlug])

    // Get selected items for comparison
    const selectedCompareItems = useMemo(() => {
        return menuItems
            .filter((item) => compareItemIds.includes(item.id))
            .map(toComparableItem)
    }, [menuItems, compareItemIds, toComparableItem])

    // Helper to render size options
    const renderSizeOptions = (sizeOptions: SizeOption[] | null) => {
        if (!sizeOptions || sizeOptions.length === 0) return null
        return (
            <div className="text-xs text-text/50 mt-1">
                {sizeOptions.map((size, idx) => (
                    <span key={size.label}>
                        {size.label}: ₱{size.price.toFixed(0)}
                        {idx < sizeOptions.length - 1 && " | "}
                    </span>
                ))}
            </div>
        )
    }

    // Helper to render badges
    const renderBadges = (item: MenuItem) => {
        return (
            <div className="flex flex-wrap gap-1 mt-1.5">
                {item.isFood && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-medium rounded">
                        <UtensilsCrossed className="w-3 h-3" />
                        Food
                    </span>
                )}
                {item.isHot && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-medium rounded">
                        <Flame className="w-3 h-3" />
                        Hot
                    </span>
                )}
                {item.isCold && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-medium rounded">
                        <Snowflake className="w-3 h-3" />
                        Cold
                    </span>
                )}
                {item.isVegan && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-medium rounded">
                        <Leaf className="w-3 h-3" />
                        Vegan
                    </span>
                )}
                {!item.isVegan && item.isVegetarian && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-lime-100 text-lime-700 text-[10px] font-medium rounded">
                        <Leaf className="w-3 h-3" />
                        Vegetarian
                    </span>
                )}
                {item.calories && (
                    <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-medium rounded">
                        {item.calories} cal
                    </span>
                )}
            </div>
        )
    }

    return (
        <>
            {/* Compare Button Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-tertiary/40 border-b border-text/10">
                <div className="flex items-center gap-2">
                    {compareItemIds.length > 0 && (
                        <span className="text-sm text-text/60">
                            {compareItemIds.length} item{compareItemIds.length === 1 ? "" : "s"} selected
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <SuggestMenuItemButton cafeId={cafeId} cafeName={cafeName} variant="default" />
                    <MenuOcrScanButton
                        cafeId={cafeId}
                        cafeName={cafeName}
                        cafeSlug={cafeSlug}
                        variant="default"
                    />
                    <button
                        onClick={handleOpenCompareModal}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors cursor-pointer"
                    >
                        <Scale className="w-4 h-4" />
                        Compare Items
                    </button>
                </div>
            </div>

            {/* Filter Pills */}
            <div className="px-4 py-3 bg-tertiary/20 border-b border-text/10">
                <div className="flex flex-wrap gap-2">
                    {filterPills.map((pill) => (
                        <button
                            key={pill.key}
                            onClick={() => setActiveFilter(pill.key)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer ${
                                activeFilter === pill.key
                                    ? "bg-primary text-white"
                                    : "bg-background text-text/70 hover:bg-background/80 border border-text/10"
                            }`}
                        >
                            {pill.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Community Note */}
            {filteredMenuItems.some((item) => item.communitySubmitted) && (
                <div className="px-4 py-2 bg-tertiary/10 border-b border-text/5">
                    <p className="text-xs text-text/50 flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        Some items are community-contributed and may vary
                    </p>
                </div>
            )}

            {filteredCategories.length === 0 ? (
                <div className="text-center py-16 text-text/60 px-4">
                    <p className="text-lg font-medium">No items match this filter</p>
                    <p className="text-sm mt-1">Try selecting a different filter</p>
                </div>
            ) : (
                filteredCategories.map((category) => {
                    const categoryItems = filteredMenuItems
                        .filter((item) => item.category === category)
                        .sort((a, b) => {
                            if (a.isSignature && !b.isSignature) return -1
                            if (!a.isSignature && b.isSignature) return 1
                            return 0
                        })

                    // Helper to render a menu item
                    const renderMenuItem = (item: MenuItem) => {
                        const isInComparison = isItemInComparison(item.id)
                        const canAddMore = compareItemIds.length < 4 || isInComparison

                        return (
                            <div
                                key={item.id}
                                className="group bg-background rounded-xl border border-text/10 overflow-hidden hover:shadow-md hover:border-text/20 transition-all duration-200"
                            >
                                {/* Image Section */}
                                <div className="relative aspect-[4/3] bg-secondary/20 overflow-hidden">
                                    {item.imageUrl ? (
                                        <button
                                            onClick={() =>
                                                setLightboxImage({
                                                    url: item.imageUrl!,
                                                    alt: item.name,
                                                })
                                            }
                                            className="relative w-full h-full cursor-pointer"
                                        >
                                            <Image
                                                src={item.imageUrl}
                                                alt={item.name}
                                                fill
                                                className="object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                        </button>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            {item.isFood ? (
                                                <UtensilsCrossed className="w-16 h-16 text-text/15" />
                                            ) : (
                                                <Coffee className="w-16 h-16 text-text/15" />
                                            )}
                                        </div>
                                    )}

                                    {/* Signature badge */}
                                    {item.isSignature && (
                                        <div className="absolute top-2 left-2 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm">
                                            <span>★</span>
                                            <span>Signature</span>
                                        </div>
                                    )}

                                    {/* Community indicator */}
                                    {item.communitySubmitted && (
                                        <div className="absolute top-2 right-10 bg-background/90 backdrop-blur-sm p-1.5 rounded-full shadow-sm">
                                            <Globe className="w-3.5 h-3.5 text-text/50" />
                                        </div>
                                    )}

                                    {/* Compare button */}
                                    <button
                                        onClick={() => toggleCompareItem(item)}
                                        disabled={!canAddMore}
                                        className={`absolute top-2 right-2 z-10 p-1.5 rounded-full shadow-sm transition-all cursor-pointer ${
                                            isInComparison
                                                ? "bg-primary text-white"
                                                : "bg-background/90 backdrop-blur-sm text-text/60 hover:text-primary hover:bg-background"
                                        } ${!canAddMore ? "opacity-50 cursor-not-allowed" : ""}`}
                                        title={isInComparison ? "Remove from comparison" : compareItemIds.length >= 4 ? "Max 4 items" : "Add to comparison"}
                                    >
                                        {isInComparison ? (
                                            <Check className="w-3.5 h-3.5" />
                                        ) : (
                                            <Plus className="w-3.5 h-3.5" />
                                        )}
                                    </button>
                                </div>

                                {/* Content Section */}
                                <div className="p-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <h3 className="font-semibold text-sm leading-tight text-text flex-1">
                                            {item.name}
                                        </h3>
                                        <span className="font-bold text-sm text-primary shrink-0">
                                            ₱{item.price.toFixed(0)}
                                        </span>
                                    </div>

                                    {/* Size options */}
                                    {renderSizeOptions(item.sizeOptions)}

                                    {/* Badges */}
                                    <div className="mt-2">
                                        {renderBadges(item)}
                                    </div>

                                    {/* Description */}
                                    {item.description && (
                                        <p className="text-xs text-text/50 mt-2 line-clamp-2">
                                            {item.description}
                                        </p>
                                    )}

                                    {/* Action row */}
                                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-text/5">
                                        <span className="text-[10px] text-text/30 uppercase tracking-wider font-medium">
                                            {item.category}
                                        </span>
                                        {authUser ? (
                                            <button
                                                onClick={() => setEditTarget(item)}
                                                className="text-text/30 hover:text-primary transition-colors cursor-pointer"
                                                title="Suggest an edit"
                                                aria-label="Suggest an edit to this menu item"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                        ) : (
                                            <Link
                                                href={`/auth?redirect=/cafes/${cafeSlug}/menu`}
                                                className="text-text/30 hover:text-primary transition-colors cursor-pointer"
                                                title="Suggest an edit"
                                                aria-label="Suggest an edit to this menu item"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    return (
                        <section key={category} className="mb-6">
                            <button
                                onClick={() => toggleCategory(category)}
                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-text/5 transition-colors rounded-lg"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-lg font-bold text-text">{category}</span>
                                    <span className="text-sm text-text/40 font-medium">
                                        {categoryItems.length} items
                                    </span>
                                </div>
                                <motion.div
                                    animate={{ rotate: collapsedCategories.has(category) ? -90 : 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <ChevronDown className="w-5 h-5 text-text/40" />
                                </motion.div>
                            </button>

                            <AnimatePresence initial={false}>
                                {!collapsedCategories.has(category) && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                                        className="overflow-hidden"
                                    >
                                        {/* Add-ons: horizontal list layout */}
                                        {category === "Add-ons" ? (
                                            <div className="px-4 mt-2 space-y-2">
                                                {categoryItems.map((item, index) => (
                                                    <motion.div
                                                        key={item.id}
                                                        initial={{ opacity: 0, x: -10 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: index * 0.03 }}
                                                        className="flex items-center justify-between py-2 px-3 bg-tertiary/30 rounded-lg"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            {item.communitySubmitted && (
                                                                <Globe className="w-3 h-3 text-text/40" />
                                                            )}
                                                            <span className="font-medium text-sm">{item.name}</span>
                                                        </div>
                                                        <span className="font-semibold text-sm text-primary">
                                                            ₱{item.price.toFixed(0)}
                                                        </span>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        ) : (
                                            /* Regular items: card grid */
                                            <div className="px-4 mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                                {categoryItems.map((item, index) => (
                                                    <motion.div
                                                        key={item.id}
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: index * 0.05 }}
                                                    >
                                                        {renderMenuItem(item)}
                                                    </motion.div>
                                                ))}
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </section>
                    )
                })
            )}

            {/* Menu Comparison Modal */}
            <MenuComparisonModal
                isOpen={isCompareModalOpen}
                onClose={handleCloseCompareModal}
                initialItems={selectedCompareItems}
            />

            {/* Suggest Edit Modal */}
            {editTarget && (
                <SuggestMenuItemModal
                    isOpen={!!editTarget}
                    onClose={() => setEditTarget(null)}
                    cafeId={cafeId}
                    cafeName={cafeName}
                    mode="edit"
                    existingItem={{
                        id: editTarget.id,
                        name: editTarget.name,
                        category: editTarget.category,
                        price: editTarget.price,
                        description: editTarget.description,
                        is_food: editTarget.isFood ?? undefined,
                        is_hot: editTarget.isHot ?? undefined,
                        is_cold: editTarget.isCold ?? undefined,
                        is_vegan: editTarget.isVegan ?? undefined,
                        is_vegetarian: editTarget.isVegetarian ?? undefined,
                        calories: editTarget.calories ?? undefined,
                        size_options: editTarget.sizeOptions ?? undefined,
                    }}
                />
            )}

            {/* Lightbox Modal */}
            {lightboxImage && (
                <div
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                    onClick={() => setLightboxImage(null)}
                >
                    <button
                        onClick={() => setLightboxImage(null)}
                        className="absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors"
                    >
                        <X className="w-8 h-8" />
                    </button>
                    <div className="relative max-w-3xl max-h-[80vh] w-full h-full">
                        <Image
                            src={lightboxImage.url}
                            alt={lightboxImage.alt}
                            fill
                            className="object-contain"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                    <p className="absolute bottom-6 left-0 right-0 text-center text-white/80 text-lg font-medium">
                        {lightboxImage.alt}
                    </p>
                </div>
            )}
        </>
    )
}
