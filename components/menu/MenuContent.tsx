"use client"

import { useState, useCallback } from "react"
import Image from "next/image"
import { X, ChevronDown, Scale, Plus, Check } from "lucide-react"
import dynamic from "next/dynamic"

const MenuComparisonModal = dynamic(
    () => import("@/components/menu/MenuComparisonModal"),
    { ssr: false }
)

interface MenuItem {
    id: string
    name: string
    description: string | null
    price: number
    category: string
    imageUrl: string | null
    isSignature: boolean | null
    isAvailable: boolean | null
}

interface MenuContentProps {
    menuItems: MenuItem[]
    categories: string[]
}

export default function MenuContent({
    menuItems,
    categories,
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
                <button
                    onClick={handleOpenCompareModal}
                    disabled={compareItemIds.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                    <Scale className="w-4 h-4" />
                    Compare Items
                </button>
            </div>

            {categories.map((category) => {
                const categoryItems = menuItems
                    .filter((item) => item.category === category)
                    .sort((a, b) => {
                        // Signatures first
                        if (a.isSignature && !b.isSignature) return -1
                        if (!a.isSignature && b.isSignature) return 1
                        return 0
                    })
                const totalItems = categoryItems.length

                // First row: 2 items on mobile, 3 on lg
                // We need to determine how many items go in the first row based on screen size
                // Since we can't know screen size at render, we'll use CSS to show/hide appropriately
                // Mobile first row: first 2 items, LG first row: first 3 items
                const firstRowItems = categoryItems.slice(0, 3) // Take up to 3 for first row
                const remainingItems = categoryItems.slice(3) // Rest go in 2-col grid

                // For mobile, we only show first 2 in the "3-col" grid, third item moves to remaining
                // const mobileFirstRowCount = Math.min(totalItems, 2)
                // const lgFirstRowCount = Math.min(totalItems, 3)

                // Placeholders needed
                const needsMobilePlaceholder = totalItems === 1
                const needsLgOnePlaceholder = totalItems === 1 // 1 on each side
                const needsLgTwoPlaceholder = totalItems === 2 // 1 on left only

                // Helper to render a menu item
                const renderMenuItem = (item: MenuItem) => {
                    const isInComparison = isItemInComparison(item.id)
                    const canAddMore = compareItemIds.length < 4 || isInComparison

                    return (
                    <div
                        key={item.id}
                        className='relative p-3 flex flex-col min-h-[180px]'
                    >
                        {/* Compare button - top right */}
                        <button
                            onClick={() => toggleCompareItem(item)}
                            disabled={!canAddMore}
                            className={`absolute top-2 right-2 z-10 p-1.5 rounded-full transition-all cursor-pointer ${
                                isInComparison
                                    ? 'bg-primary text-white'
                                    : 'bg-background/80 text-text/60 hover:text-primary hover:bg-background'
                            } ${!canAddMore ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title={isInComparison ? 'Remove from comparison' : compareItemIds.length >= 4 ? 'Max 4 items' : 'Add to comparison'}
                        >
                            {isInComparison ? (
                                <Check className='w-3.5 h-3.5' />
                            ) : (
                                <Plus className='w-3.5 h-3.5' />
                            )}
                        </button>

                        <div className='flex flex-col-reverse md:flex-row gap-3 flex-1'>
                            <div className='flex-1 flex flex-col'>
                                <h3 className='font-bold text-base uppercase leading-tight'>
                                    {item.name}
                                    {item.isSignature && (
                                        <span className='ml-1 text-amber-600'>
                                            ★
                                        </span>
                                    )}
                                </h3>
                                <p className='text-sm font-medium text-text/70 md:mt-1'>
                                    ₱{item.price.toFixed(2)}
                                </p>
                                <div className='flex-1 hidden md:block' />
                                {item.description && (
                                    <p className='text-xs text-text/60 uppercase tracking-wide line-clamp-2 mt-2 md:mt-0'>
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
                                    className='relative w-full h-auto md:h-full md:w-auto aspect-square rounded-sm shadow-sm overflow-clip shrink-0 self-center cursor-pointer hover:opacity-90 transition-opacity'
                                >
                                    <Image
                                        src={item.imageUrl}
                                        alt={item.name}
                                        fill
                                        className='object-contain'
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
                            className='w-full flex items-center justify-between text-xl font-bold text-text uppercase tracking-wider border-b border-text/20 px-4 py-3 pb-1 hover:bg-text/5 transition-colors'
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
                                    <div className='bg-tertiary/40 px-4'>
                                        <div className='grid grid-cols-1 md:grid-cols-2 gap-2'>
                                            {categoryItems.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className='flex flex-col items-center justify-between py-2'
                                                >
                                                    <div className='w-full flex justify-between items-center gap-4'>
                                                        <span className='font-semibold text-sm'>
                                                            {item.name}
                                                        </span>
                                                        <div className='flex-1 border-b border-text/20 border-dashed' />
                                                        <span className='text-sm font-semibold text-primary'>
                                                            ₱
                                                            {item.price.toFixed(
                                                                2
                                                            )}
                                                        </span>
                                                    </div>
                                                    {item.description && (
                                                        <span className='text-xs text-text/60 font-bold w-full text-left'>
                                                            {item.description}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {/* First Row: 2 cols mobile, 3 cols lg */}
                                        <div className='grid grid-cols-2 lg:grid-cols-3 bg-tertiary/40'>
                                            {/* Left placeholder for centering (lg: 1 or 2 items) */}
                                            {needsLgOnePlaceholder && (
                                                <div className='hidden lg:block min-h-[180px] border-2 border-dashed border-text/10' />
                                            )}
                                            {needsLgTwoPlaceholder && (
                                                <div className='hidden lg:block min-h-[180px]' />
                                            )}

                                            {/* Show first 2 items on mobile, first 3 on lg */}
                                            {firstRowItems
                                                .slice(0, 2)
                                                .map(renderMenuItem)}
                                            {/* Third item: hidden on mobile, shown on lg */}
                                            {firstRowItems[2] && (
                                                <div className='hidden lg:flex'>
                                                    {renderMenuItem(
                                                        firstRowItems[2]
                                                    )}
                                                </div>
                                            )}

                                            {/* Right placeholder for single item */}
                                            {needsMobilePlaceholder && (
                                                <>
                                                    {/* Mobile: single right placeholder */}
                                                    <div className='min-h-[180px] border-2 border-dashed border-text/10 lg:hidden' />
                                                    {/* LG: right placeholder to balance */}
                                                    <div className='hidden lg:block min-h-[180px] border-2 border-dashed border-text/10' />
                                                </>
                                            )}
                                        </div>

                                        {/* Remaining Rows: always 2 cols */}
                                        {(remainingItems.length > 0 ||
                                            (totalItems > 2 &&
                                                firstRowItems[2])) && (
                                            <div className='grid grid-cols-2 bg-tertiary/40'>
                                                {/* On mobile, third item goes here */}
                                                {firstRowItems[2] && (
                                                    <div className='lg:hidden'>
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
                                                    <div className='min-h-[180px] border-2 border-dashed border-text/10 lg:hidden' />
                                                )}
                                                {remainingItems.length % 2 !==
                                                    0 && (
                                                    <div className='hidden lg:block min-h-[180px] border-2 border-dashed border-text/10' />
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </section>
                )
            })}

            {/* Menu Comparison Modal */}
            <MenuComparisonModal
                isOpen={isCompareModalOpen}
                onClose={handleCloseCompareModal}
            />

            {/* Lightbox Modal */}
            {lightboxImage && (
                <div
                    className='fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4'
                    onClick={() => setLightboxImage(null)}
                >
                    <button
                        onClick={() => setLightboxImage(null)}
                        className='absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors'
                    >
                        <X className='w-8 h-8' />
                    </button>
                    <div className='relative max-w-3xl max-h-[80vh] w-full h-full'>
                        <Image
                            src={lightboxImage.url}
                            alt={lightboxImage.alt}
                            fill
                            className='object-contain'
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                    <p className='absolute bottom-6 left-0 right-0 text-center text-white/80 text-lg font-medium'>
                        {lightboxImage.alt}
                    </p>
                </div>
            )}
        </>
    )
}
