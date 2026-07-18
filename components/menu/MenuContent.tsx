"use client"

import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion, AnimatePresence } from "motion/react"
import { X, ChevronDown, Scale, Plus, Check, Flame, Snowflake, UtensilsCrossed, Leaf, Globe, Pencil, Coffee, ArrowLeft, Search } from "lucide-react"
import dynamic from "next/dynamic"
import MenuOcrScanButton from "@/components/suggestions/MenuOcrScanButton"
import { useAuth } from "@/components/layout/AuthProvider"
import SuggestMenuItemButton from "@/components/suggestions/SuggestMenuItemButton"
import type { ComparableMenuItem } from "@/utils/types/menu-comparison"
import { getCafeThumbnailUrl } from "@/utils/extras"

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
    cafeThumbnail?: string | null
    cafeAddressDisplay?: string | null
    highlightItemId?: string
}

type FilterType = "all" | "coffee" | "food" | "cold" | "hot" | "vegan"

export default function MenuContent({
    menuItems,
    categories,
    cafeId,
    cafeName,
    cafeSlug,
    cafeThumbnail,
    cafeAddressDisplay,
    highlightItemId,
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
    const [highlightedItemId, setHighlightedItemId] = useState<string | null>(highlightItemId || null)
    const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())

    const [searchQuery, setSearchQuery] = useState("")

    // Handle scroll to highlighted item
    useEffect(() => {
        if (highlightedItemId) {
            const timer = setTimeout(() => {
                const element = itemRefs.current.get(highlightedItemId)
                if (element) {
                    // Expand the category containing this item
                    const category = menuItems.find(item => item.id === highlightedItemId)?.category
                    if (category && collapsedCategories.has(category)) {
                        setCollapsedCategories(prev => {
                            const newSet = new Set(prev)
                            newSet.delete(category)
                            return newSet
                        })
                    }
                    
                    // Scroll to the element
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    
                    // Remove highlight after 3 seconds
                    setTimeout(() => {
                        setHighlightedItemId(null)
                    }, 3000)
                }
            }, 100)
            return () => clearTimeout(timer)
        }
    }, [highlightedItemId, menuItems, collapsedCategories])

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

    // Filter items based on active filter and search query
    const filteredMenuItems = useMemo(() => {
        let items = menuItems

        switch (activeFilter) {
            case "coffee":
                items = items.filter((item) => !item.isFood)
                break
            case "food":
                items = items.filter((item) => item.isFood)
                break
            case "cold":
                items = items.filter((item) => item.isCold)
                break
            case "hot":
                items = items.filter((item) => item.isHot)
                break
            case "vegan":
                items = items.filter((item) => item.isVegan)
                break
            default:
                break
        }

        const query = searchQuery.trim().toLowerCase()
        if (query) {
            items = items.filter(
                (item) =>
                    item.name.toLowerCase().includes(query) ||
                    (item.description?.toLowerCase().includes(query) ?? false) ||
                    item.category.toLowerCase().includes(query)
            )
        }

        return items
    }, [menuItems, activeFilter, searchQuery])

    // Smart sort categories: signatures first, drinks before food, add-ons last
    const sortedCategories = useMemo(() => {
        const drinkKeywords = ["coffee", "espresso", "tea", "matcha", "chocolate", "beverage", "drink", "milkshake", "smoothie", "juice", "latte", "cappuccino", "americano"]
        const specialtyDrinkKeywords = ["specialty", "signature"]
        const foodKeywords = ["food", "pastry", "sandwich", "breakfast", "lunch", "brunch", "dessert", "cake", "snack", "salad", "pasta", "rice", "burger", "pizza", "toast", "bowl"]
        const addonKeywords = ["add-on", "addon", "add on", "add-ons", "extras", "extra", "option", "options", "modification", "modifier", "upgrade", "topping", "syrup", "shot"]

        const getCategoryPriority = (category: string) => {
            const lower = category.toLowerCase()
            if (addonKeywords.some((kw) => lower.includes(kw))) return 100
            if (lower === "add-ons") return 100
            if (lower === "food") return 40
            if (lower === "drinks") return 20
            const itemCount = filteredMenuItems.filter((item) => item.category === category).length
            const signatureCount = filteredMenuItems.filter(
                (item) => item.category === category && item.isSignature
            ).length
            if (itemCount > 0 && signatureCount / itemCount >= 0.5) return 10
            if (specialtyDrinkKeywords.some((kw) => lower.includes(kw))) return 15
            if (drinkKeywords.some((kw) => lower.includes(kw))) return 30
            if (foodKeywords.some((kw) => lower.includes(kw))) return 50
            return 60
        }

        return [...categories].sort((a, b) => {
            const priorityA = getCategoryPriority(a)
            const priorityB = getCategoryPriority(b)
            if (priorityA !== priorityB) return priorityA - priorityB
            return a.localeCompare(b)
        })
    }, [categories, filteredMenuItems])

    // Get categories that have items after filtering
    const filteredCategories = useMemo(() => {
        const categoriesWithItems = new Set(filteredMenuItems.map((item) => item.category))
        return sortedCategories.filter((cat) => categoriesWithItems.has(cat))
    }, [sortedCategories, filteredMenuItems])

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
            {/* Unified sticky header: back link, cafe info, actions */}
            <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-text/10">
                <div className="px-4 py-3 flex items-center gap-3">
                    <Link
                        href={`/cafes/${cafeSlug}`}
                        className="p-2 hover:bg-text/10 rounded-full transition-colors shrink-0"
                        aria-label="Back to cafe"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    {cafeThumbnail && (
                        <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0">
                            <Image
                                src={getCafeThumbnailUrl(cafeThumbnail)}
                                alt={cafeName}
                                fill
                                className="object-cover"
                            />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <h1 className="font-semibold text-sm md:text-base truncate">
                            {cafeName}
                        </h1>
                        {cafeAddressDisplay && (
                            <p className="text-xs text-text/60 truncate hidden sm:block">
                                {cafeAddressDisplay}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        <SuggestMenuItemButton
                            cafeId={cafeId}
                            cafeName={cafeName}
                            variant="compact"
                        />
                        <MenuOcrScanButton
                            cafeId={cafeId}
                            cafeName={cafeName}
                            cafeSlug={cafeSlug}
                            variant="compact"
                        />
                        <button
                            onClick={handleOpenCompareModal}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors cursor-pointer"
                        >
                            <Scale className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Compare</span>
                            <span className="sm:hidden">{compareItemIds.length || "0"}</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Search bar — scrolls with content */}
            <div className="px-4 py-3 bg-tertiary/20 border-b border-text/10">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search menu items..."
                        className="w-full pl-9 pr-9 py-2 bg-background border border-text/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-text/10 rounded-full transition-colors"
                            aria-label="Clear search"
                        >
                            <X className="w-3.5 h-3.5 text-text/50" />
                        </button>
                    )}
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
                    <p className="text-lg font-medium">No items match</p>
                    <p className="text-sm mt-1">
                        {searchQuery ? "Try a different search term or filter" : "Try selecting a different filter"}
                    </p>
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

                    const itemsWithPhotos = categoryItems.filter((item) => item.imageUrl)
                    const itemsWithoutPhotos = categoryItems.filter((item) => !item.imageUrl)

                    const compareButton = (item: MenuItem) => {
                        const isInComparison = isItemInComparison(item.id)
                        const canAddMore = compareItemIds.length < 4 || isInComparison

                        return (
                            <button
                                onClick={() => toggleCompareItem(item)}
                                disabled={!canAddMore}
                                className={`p-1.5 rounded-full shadow-sm transition-all cursor-pointer ${
                                    isInComparison
                                        ? "bg-primary text-white"
                                        : "bg-background/90 backdrop-blur-sm text-text/60 hover:text-primary hover:bg-background"
                                } ${!canAddMore ? "opacity-50 cursor-not-allowed" : ""}`}
                                title={isInComparison ? "Remove from comparison" : compareItemIds.length >= 4 ? "Max 4 items" : "Add to comparison"}
                                aria-label={isInComparison ? "Remove from comparison" : compareItemIds.length >= 4 ? "Max 4 items" : "Add to comparison"}
                            >
                                {isInComparison ? (
                                    <Check className="w-3.5 h-3.5" />
                                ) : (
                                    <Plus className="w-3.5 h-3.5" />
                                )}
                            </button>
                        )
                    }

                    const editButton = (item: MenuItem) => {
                        const buttonClasses = "text-text/30 hover:text-primary transition-colors cursor-pointer"
                        const label = "Suggest an edit"

                        return authUser ? (
                            <button
                                onClick={() => setEditTarget(item)}
                                className={buttonClasses}
                                title={label}
                                aria-label={label}
                            >
                                <Pencil className="w-3.5 h-3.5" />
                            </button>
                        ) : (
                            <Link
                                href={`/auth?redirect=/cafes/${cafeSlug}/menu`}
                                className={buttonClasses}
                                title={label}
                                aria-label={label}
                            >
                                <Pencil className="w-3.5 h-3.5" />
                            </Link>
                        )
                    }

                    const signatureBadge = (item: MenuItem) => item.isSignature ? (
                        <div className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm shrink-0">
                            <span>★</span>
                            <span>Signature</span>
                        </div>
                    ) : null

                    const communityIndicator = (item: MenuItem) => item.communitySubmitted ? (
                        <div className="bg-background/90 backdrop-blur-sm p-1 rounded-full shadow-sm">
                            <Globe className="w-3.5 h-3.5 text-text/50" />
                        </div>
                    ) : null

                    const renderMenuItemCard = (item: MenuItem) => {
                        return (
                            <div
                                ref={(el) => {
                                    if (el) itemRefs.current.set(item.id, el)
                                }}
                                className={`group bg-background rounded-xl border overflow-hidden hover:shadow-md hover:border-text/20 transition-all duration-200 ${
                                    highlightedItemId === item.id
                                        ? 'border-primary ring-2 ring-primary/30 shadow-lg'
                                        : 'border-text/10'
                                }`}
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
                                    {signatureBadge(item) && (
                                        <div className="absolute top-2 left-2">
                                            {signatureBadge(item)}
                                        </div>
                                    )}

                                    {/* Community indicator */}
                                    {communityIndicator(item) && (
                                        <div className="absolute top-2 right-10">
                                            {communityIndicator(item)}
                                        </div>
                                    )}

                                    {/* Compare button */}
                                    <div className="absolute top-2 right-2 z-10">
                                        {compareButton(item)}
                                    </div>
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
                                        {editButton(item)}
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    const renderMenuItemRow = (item: MenuItem) => {
                        return (
                            <div
                                ref={(el) => {
                                    if (el) itemRefs.current.set(item.id, el)
                                }}
                                className={`group flex items-center justify-between gap-3 px-3 py-2.5 bg-tertiary/30 rounded-xl border hover:border-text/20 transition-all ${
                                    highlightedItemId === item.id
                                        ? 'border-primary ring-2 ring-primary/30 shadow-lg'
                                        : 'border-transparent'
                                }`}
                            >
                                <div className="min-w-0 flex-1 flex items-center gap-2.5 overflow-hidden">
                                    <h3 className="font-semibold text-sm text-text shrink-0">
                                        {item.name}
                                    </h3>
                                    <div className="hidden sm:flex items-center gap-1 shrink-0">
                                        {signatureBadge(item)}
                                        {renderBadges(item)}
                                        {communityIndicator(item)}
                                    </div>
                                    {item.description && (
                                        <span className="text-xs text-text/50 truncate hidden md:inline">
                                            {item.description}
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-2.5 shrink-0">
                                    <span className="font-bold text-sm text-primary">
                                        ₱{item.price.toFixed(0)}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        {compareButton(item)}
                                        {editButton(item)}
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
                                            /* Mixed layout: cards for items with photos, rows for items without */
                                            <>
                                                {itemsWithPhotos.length > 0 && (
                                                    <div className="px-4 mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                                        {itemsWithPhotos.map((item, index) => (
                                                            <motion.div
                                                                key={item.id}
                                                                initial={{ opacity: 0, y: 10 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={{ delay: index * 0.05 }}
                                                            >
                                                                {renderMenuItemCard(item)}
                                                            </motion.div>
                                                        ))}
                                                    </div>
                                                )}
                                                {itemsWithoutPhotos.length > 0 && (
                                                    <div className="px-4 mt-2 space-y-2">
                                                        {itemsWithoutPhotos.map((item, index) => (
                                                            <motion.div
                                                                key={item.id}
                                                                initial={{ opacity: 0, x: -10 }}
                                                                animate={{ opacity: 1, x: 0 }}
                                                                transition={{ delay: index * 0.03 }}
                                                            >
                                                                {renderMenuItemRow(item)}
                                                            </motion.div>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
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
                        is_signature: editTarget.isSignature ?? undefined,
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
