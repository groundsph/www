"use client"

import { useState, useCallback, useMemo } from "react"
import Image from "next/image"
import { X, ChevronDown, Scale, Plus, Check, Flame, Snowflake, UtensilsCrossed, Leaf, Globe } from "lucide-react"
import dynamic from "next/dynamic"
import MenuOcrScanButton from "@/components/suggestions/MenuOcrScanButton"

const MenuComparisonModal = dynamic(
    () => import("@/components/menu/MenuComparisonModal"),
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
                    <MenuOcrScanButton
                        cafeId={cafeId}
                        cafeName={cafeName}
                        cafeSlug={cafeSlug}
                        variant="default"
                    />
                    <button
                        onClick={handleOpenCompareModal}
                        disabled={compareItemIds.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
                            // Signatures first
                            if (a.isSignature && !b.isSignature) return -1
                            if (!a.isSignature && b.isSignature) return 1
                            return 0
                        })
                    const totalItems = categoryItems.length

                    // First row: 2 items on mobile, 3 on lg
                    const firstRowItems = categoryItems.slice(0, 3)
                    const remainingItems = categoryItems.slice(3)

                    // Placeholders needed
                    const needsMobilePlaceholder = totalItems === 1
                    const needsLgOnePlaceholder = totalItems === 1
                    const needsLgTwoPlaceholder = totalItems === 2

                    // Helper to render a menu item
                    const renderMenuItem = (item: MenuItem) => {
                        const isInComparison = isItemInComparison(item.id)
                        const canAddMore = compareItemIds.length < 4 || isInComparison

                        return (
                            <div
                                key={item.id}
                                className="relative p-3 flex flex-col min-h-[180px]"
                            >
                                {/* Compare button - top right */}
                                <button
                                    onClick={() => toggleCompareItem(item)}
                                    disabled={!canAddMore}
                                    className={`absolute top-2 right-2 z-10 p-1.5 rounded-full transition-all cursor-pointer ${
                                        isInComparison
                                            ? "bg-primary text-white"
                                            : "bg-background/80 text-text/60 hover:text-primary hover:bg-background"
                                    } ${!canAddMore ? "opacity-50 cursor-not-allowed" : ""}`}
                                    title={isInComparison ? "Remove from comparison" : compareItemIds.length >= 4 ? "Max 4 items" : "Add to comparison"}
                                >
                                    {isInComparison ? (
                                        <Check className="w-3.5 h-3.5" />
                                    ) : (
                                        <Plus className="w-3.5 h-3.5" />
                                    )}
                                </button>

                                {/* Community indicator - top left */}
                                {item.communitySubmitted && (
                                    <div className="absolute top-2 left-2 z-10">
                                        <Globe className="w-3.5 h-3.5 text-text/40" />
                                    </div>
                                )}

                                <div className="flex flex-col-reverse md:flex-row gap-3 flex-1">
                                    <div className="flex-1 flex flex-col">
                                        <h3 className="font-bold text-base uppercase leading-tight">
                                            {item.name}
                                            {item.isSignature && (
                                                <span className="ml-1 text-amber-600">
                                                    ★
                                                </span>
                                            )}
                                        </h3>
                                        <p className="text-sm font-medium text-text/70 md:mt-1">
                                            ₱{item.price.toFixed(2)}
                                        </p>
                                        
                                        {/* Size options */}
                                        {renderSizeOptions(item.sizeOptions)}
                                        
                                        {/* Badges */}
                                        {renderBadges(item)}
                                        
                                        <div className="flex-1 hidden md:block" />
                                        {item.description && (
                                            <p className="text-xs text-text/60 uppercase tracking-wide line-clamp-2 mt-2 md:mt-0">
                                                {item.description}
                                            </p>
                                        )}
                                    </div>
                                    {item.imageUrl && (
                                        <button
                                            onClick={() =>
                                                setLightboxImage({
                                                    url: item.imageUrl!,
                                                    alt: item.name,
                                                })
                                            }
                                            className="relative w-full h-auto md:h-full md:w-auto aspect-square rounded-sm shadow-sm overflow-clip shrink-0 self-center cursor-pointer hover:opacity-90 transition-opacity"
                                        >
                                            <Image
                                                src={item.imageUrl}
                                                alt={item.name}
                                                fill
                                                className="object-contain"
                                            />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    }

                    return (
                        <section key={category}>
                            <button
                                onClick={() => toggleCategory(category)}
                                className="w-full flex items-center justify-between text-xl font-bold text-text uppercase tracking-wider border-b border-text/20 px-4 py-3 pb-1 hover:bg-text/5 transition-colors"
                            >
                                <span>{category}</span>
                                <ChevronDown
                                    className={`w-5 h-5 transition-transform ${
                                        collapsedCategories.has(category)
                                            ? "-rotate-90"
                                            : "rotate-0"
                                    }`}
                                />
                            </button>

                            {!collapsedCategories.has(category) && (
                                <>
                                    {/* Add-ons category: render as simple list */}
                                    {category === "Add-ons" ? (
                                        <div className="bg-tertiary/40 px-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                {categoryItems.map((item) => (
                                                    <div
                                                        key={item.id}
                                                        className="flex flex-col items-center justify-between py-2"
                                                    >
                                                        <div className="w-full flex justify-between items-center gap-4">
                                                            <span className="font-semibold text-sm flex items-center gap-1">
                                                                {item.communitySubmitted && (
                                                                    <Globe className="w-3 h-3 text-text/40" />
                                                                )}
                                                                {item.name}
                                                            </span>
                                                            <div className="flex-1 border-b border-text/20 border-dashed" />
                                                            <span className="text-sm font-semibold text-primary">
                                                                ₱
                                                                {item.price.toFixed(
                                                                    2
                                                                )}
                                                            </span>
                                                        </div>
                                                        {item.description && (
                                                            <span className="text-xs text-text/60 font-bold w-full text-left">
                                                                {item.description}
                                                            </span>
                                                        )}
                                                        {renderBadges(item)}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {/* First Row: 2 cols mobile, 3 cols lg */}
                                            <div className="grid grid-cols-2 lg:grid-cols-3 bg-tertiary/40">
                                                {/* Left placeholder for centering (lg: 1 or 2 items) */}
                                                {needsLgOnePlaceholder && (
                                                    <div className="hidden lg:block min-h-[180px] border-2 border-dashed border-text/10" />
                                                )}
                                                {needsLgTwoPlaceholder && (
                                                    <div className="hidden lg:block min-h-[180px]" />
                                                )}

                                                {/* Show first 2 items on mobile, first 3 on lg */}
                                                {firstRowItems
                                                    .slice(0, 2)
                                                    .map(renderMenuItem)}
                                                {/* Third item: hidden on mobile, shown on lg */}
                                                {firstRowItems[2] && (
                                                    <div className="hidden lg:flex">
                                                        {renderMenuItem(
                                                            firstRowItems[2]
                                                        )}
                                                    </div>
                                                )}

                                                {/* Right placeholder for single item */}
                                                {needsMobilePlaceholder && (
                                                    <>
                                                        {/* Mobile: single right placeholder */}
                                                        <div className="min-h-[180px] border-2 border-dashed border-text/10 lg:hidden" />
                                                        {/* LG: right placeholder to balance */}
                                                        <div className="hidden lg:block min-h-[180px] border-2 border-dashed border-text/10" />
                                                    </>
                                                )}
                                            </div>

                                            {/* Remaining Rows: always 2 cols */}
                                            {(remainingItems.length > 0 ||
                                                (totalItems > 2 &&
                                                    firstRowItems[2])) && (
                                                <div className="grid grid-cols-2 bg-tertiary/40">
                                                    {/* On mobile, third item goes here */}
                                                    {firstRowItems[2] && (
                                                        <div className="lg:hidden">
                                                            {renderMenuItem(
                                                                firstRowItems[2]
                                                            )}
                                                        </div>
                                                    )}
                                                    {remainingItems.map(
                                                        renderMenuItem
                                                    )}
                                                    {/* Placeholder if odd number of remaining items */}
                                                    {(remainingItems.length +
                                                        (firstRowItems[2]
                                                            ? 1
                                                            : 0)) %
                                                        2 !==
                                                        0 && (
                                                        <div className="min-h-[180px] border-2 border-dashed border-text/10 lg:hidden" />
                                                    )}
                                                    {remainingItems.length % 2 !==
                                                        0 && (
                                                        <div className="hidden lg:block min-h-[180px] border-2 border-dashed border-text/10" />
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </>
                            )}
                        </section>
                    )
                })
            )}

            {/* Menu Comparison Modal */}
            <MenuComparisonModal
                isOpen={isCompareModalOpen}
                onClose={handleCloseCompareModal}
            />

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
