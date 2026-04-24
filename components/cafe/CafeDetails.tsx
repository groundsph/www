"use client"

import { useHaptics } from "@/hooks/useHaptics"
import Link from "next/link"
import { CafeWithRatings } from "@/utils/types/extra"
import { CafeMenuItem } from "@/utils/types/owner"
import type { ComparableMenuItem } from "@/utils/types/menu-comparison"
import Image from "next/image"
import { useState, useEffect, useMemo, useCallback } from "react"
import dynamic from "next/dynamic"
import { getReviewsByCafeIdPaginated } from "@/app/api/actions/cafe"
import {
    WifiIcon,
    PlugIcon,
    CarIcon,
    SnowflakeIcon,
    PawPrintIcon,
    SunIcon,
    BriefcaseIcon,
    Toilet,
    Droplet,
    MilkOff,
    Armchair,
    Cigarette,
    Coffee,
    Scale,
    Plus,
    Check,
    Pencil,
} from "lucide-react"

// Components
import CafeHero from "@/components/cafe/CafeHero"
import CafeSidebar from "@/components/cafe/CafeSidebar"
import CafeTabs from "@/components/cafe/CafeTabs"
import CafeEditBanner from "@/components/cafe/CafeEditBanner"
import {
    AboutTabContent,
    DetailsTabContent,
} from "@/components/cafe/CafeMobileContent"
import ReviewModal from "@/components/reviews/ReviewModal"
import ReviewItem from "@/components/reviews/ReviewItem"
import MarkdownRender from "@/components/ui/MarkdownRender"
import ClaimCafeModal from "@/components/modal/ClaimCafeModal"
import ContributionHistoryModal from "@/components/history/ContributionHistoryModal"
import AddToCollectionModal from "@/components/collections/AddToCollectionModal"
import MilestoneCelebration from "@/components/ui/MilestoneCelebration"
import GroupCheckInModal from "@/components/checkin/GroupCheckInModal"
import SuggestMenuItemButton from "@/components/suggestions/SuggestMenuItemButton"
import MenuOcrScanButton from "@/components/suggestions/MenuOcrScanButton"
import CafeDiscounts from "@/components/cafe/CafeDiscounts"

const ImageLightbox = dynamic(
    () => import("@/components/modal/ImageLightbox"),
    { ssr: false }
)

const MenuComparisonModal = dynamic(
    () => import("@/components/menu/MenuComparisonModal"),
    { ssr: false }
)

const SuggestMenuItemModal = dynamic(
    () => import("@/components/suggestions/SuggestMenuItemModal"),
    { ssr: false }
)

// Hooks
import { useCafeActions } from "@/hooks/useCafeActions"
import { trackCafePageView } from "@/utils/analytics"
import { useAuth } from "@/components/layout/AuthProvider"

export interface Review {
    id: string
    rating: number
    comment: string
    created_at: string | null
    user_id: string
    images?: string[] | null
    likes_count?: number | null
    review_interactions?: { user_id: string; interaction_type: string }[]
    is_edited?: boolean
    author: {
        display_name: string
        username: string
        avatar_url: string | null
    }
    owner_response?: {
        id: string
        response_text: string
        created_at: string | null
        updated_at: string | null
        owner: {
            display_name: string
            avatar_url: string | null
        }
    } | null
}

const REVIEWS_PER_PAGE = 10

export default function CafeDetails({
    cafe,
    initialReviews = [],
    initialHasMore = false,
    menuItems = [],
    heroImage,
    canEdit = false,
    editRole = null,
}: {
    cafe: CafeWithRatings
    initialReviews?: Review[]
    initialHasMore?: boolean
    menuItems?: CafeMenuItem[]
    /** Server-rendered hero image for better LCP */
    heroImage?: React.ReactNode
    canEdit?: boolean
    editRole?: "admin" | "moderator" | null
}) {
    // Auth
    const authUser = useAuth().user
    const { trigger } = useHaptics()

    // Cafe Actions Hook
    const {
        user,
        isVisited,
        isFavorite,
        isInWishlist,
        visitCount,
        visitedToday,
        isCheckingIn,
        currentCompanions,
        checkIn,
        updateCheckInCompanions,
        toggleVisited,
        toggleFavorite,
        toggleWishlist,
    } = useCafeActions(cafe.id)

    // Review Modal State
    const [isReviewOpen, setIsReviewOpen] = useState(false)
    const [editingReview, setEditingReview] = useState<Review | undefined>(
        undefined,
    )

    // Claim Modal State
    const [isClaimOpen, setIsClaimOpen] = useState(false)

    // Lightbox State
    const [isLightboxOpen, setIsLightboxOpen] = useState(false)
    const [lightboxIndex, setLightboxIndex] = useState(0)

    // History Modal State
    const [isHistoryOpen, setIsHistoryOpen] = useState(false)

    // Add to Collection Modal State
    const [isAddToCollectionOpen, setIsAddToCollectionOpen] = useState(false)

    // Milestone celebration state
    const [milestone, setMilestone] = useState<number | null>(null)

    // Group Check-in Modal State
    const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false)

    // Menu Comparison Modal State
    const [isCompareModalOpen, setIsCompareModalOpen] = useState(false)
    const [compareItemIds, setCompareItemIds] = useState<string[]>([])

    // Menu Item Edit State
    const [editTargetItem, setEditTargetItem] = useState<CafeMenuItem | null>(null)

    // Pagination state for reviews
    const [allReviews, setAllReviews] = useState<Review[]>(initialReviews)
    const [hasMoreReviews, setHasMoreReviews] = useState(initialHasMore)
    const [currentReviewPage, setCurrentReviewPage] = useState(1)
    const [isLoadingMoreReviews, setIsLoadingMoreReviews] = useState(false)

    // Check-in handler (called from modal) - no longer triggers milestone here
    const handleCheckIn = async (companionIds?: string[]) => {
        const result = await checkIn(companionIds)
        return result
    }

    // Called when check-in modal closes after successful check-in
    const handleCheckInComplete = (result: { milestone?: number | null }) => {
        // Show milestone celebration after modal closes
        if (result?.milestone) {
            setTimeout(() => setMilestone(result.milestone ?? null), 300)
        }
    }

    // Open the check-in modal instead of direct check-in
    const handleCheckInClick = () => {
        trigger("medium")
        setIsCheckInModalOpen(true)
    }

    // Menu comparison handlers
    const toggleCompareItem = useCallback((itemId: string) => {
        setCompareItemIds((prev) => {
            if (prev.includes(itemId)) {
                return prev.filter((id) => id !== itemId)
            }
            if (prev.length >= 4) {
                return prev
            }
            return [...prev, itemId]
        })
    }, [])

    const isItemInComparison = useCallback(
        (itemId: string) => compareItemIds.includes(itemId),
        [compareItemIds]
    )

    // Helper to render edit button with auth check
    const renderEditButton = useCallback((item: CafeMenuItem) => {
        const className = "p-1 rounded-full text-text/30 hover:text-primary hover:bg-primary/10 transition-all cursor-pointer"
        const title = "Suggest an edit"
        const ariaLabel = "Suggest an edit to this menu item"
        const icon = <Pencil className="w-3 h-3" />

        if (authUser) {
            return (
                <button
                    onClick={() => setEditTargetItem(item)}
                    className={className}
                    title={title}
                    aria-label={ariaLabel}
                >
                    {icon}
                </button>
            )
        }

        return (
            <Link
                href={`/auth?redirect=/cafes/${cafe.slug}`}
                className={className}
                title={title}
                aria-label={ariaLabel}
            >
                {icon}
            </Link>
        )
    }, [authUser, cafe.slug])

    const handleOpenCompareModal = useCallback(() => {
        setIsCompareModalOpen(true)
    }, [])

    const handleCloseCompareModal = useCallback(() => {
        setIsCompareModalOpen(false)
    }, [])

    // Convert CafeMenuItem to ComparableMenuItem
    const toComparableItem = useCallback((item: CafeMenuItem): ComparableMenuItem => ({
        id: item.id,
        cafeId: item.cafe_id,
        cafeName: cafe.name,
        cafeSlug: cafe.slug,
        name: item.name,
        category: item.category,
        price: item.price,
        description: item.description,
        isAvailable: item.is_available,
        isFood: item.is_food,
        isHot: item.is_hot,
        isCold: item.is_cold,
        calories: item.calories,
        isVegan: item.is_vegan,
        isVegetarian: item.is_vegetarian,
        sizeOptions: item.size_options,
        imageUrl: item.image_url,
    }), [cafe.name, cafe.slug])

    // Get selected items for comparison
    const selectedCompareItems = useMemo(() => {
        return menuItems
            .filter((item) => compareItemIds.includes(item.id))
            .map(toComparableItem)
    }, [menuItems, compareItemIds, toComparableItem])

    // Haptic-wrapped toggle handlers
    const handleToggleFavorite = async () => {
        trigger(isFavorite ? "soft" : "medium")
        await toggleFavorite()
    }

    const handleToggleWishlist = async () => {
        trigger(isInWishlist ? "soft" : "rigid")
        await toggleWishlist()
    }

    const handleToggleVisited = async () => {
        trigger(isVisited ? "soft" : "medium")
        await toggleVisited()
    }

    // Computed
    const story = cafe.story
    const gallery = useMemo(() => cafe.gallery ?? [], [cafe.gallery])

    // Find if user has reviewed
    const userReview = user
        ? allReviews.find((r) => r.user_id === user.id)
        : undefined

    // Track page view for analytics
    useEffect(() => {
        trackCafePageView(cafe.id)
    }, [cafe.id])

    // Amenity Pill Component
    const AmenityPill = ({
        icon,
        label,
    }: {
        icon?: React.ReactNode
        label: string
    }) => (
        <li className='flex items-center gap-1.5 text-text bg-secondary/40 px-2 py-1 rounded-full text-xs font-semibold cursor-default'>
            {icon}
            {label}
        </li>
    )

    // Load more reviews handler
    const loadMoreReviews = useCallback(async () => {
        if (isLoadingMoreReviews || !hasMoreReviews) return

        setIsLoadingMoreReviews(true)
        const nextPage = currentReviewPage + 1

        try {
            const { reviews: newReviews, hasMore } = await getReviewsByCafeIdPaginated(
                cafe.id,
                nextPage,
                REVIEWS_PER_PAGE
            )
            setAllReviews((prev) => [...prev, ...newReviews])
            setHasMoreReviews(hasMore)
            setCurrentReviewPage(nextPage)
        } catch (error) {
            console.error("Failed to load more reviews:", error)
        } finally {
            setIsLoadingMoreReviews(false)
        }
    }, [cafe.id, currentReviewPage, hasMoreReviews, isLoadingMoreReviews])

    // Reviews Section Component (shared between mobile tabs and desktop)
    const ReviewsSection = () => (
        <div className='flex flex-col gap-6'>
            <div className='flex flex-row items-center justify-between'>
                <h2 className='text-xl font-semibold font-serif flex items-center gap-2'>
                    Reviews
                    {allReviews.length > 0 && (
                        <span className='text-sm font-normal text-text/60'>
                            ({allReviews.length})
                        </span>
                    )}
                </h2>
                {user ? (
                    <button
                        onClick={() => setIsReviewOpen(true)}
                        className='px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors cursor-pointer'
                    >
                        {userReview ? "Edit Review" : "Write a Review"}
                    </button>
                ) : (
                    <Link
                        href={`/auth?redirect=/cafes/${cafe.slug}`}
                        className='px-4 py-2 bg-secondary/50 text-text text-sm font-bold rounded-xl hover:bg-secondary/70 transition-colors'
                    >
                        Login to Review
                    </Link>
                )}
            </div>

            {allReviews.length > 0 ? (
                <div className='flex flex-col gap-4'>
                    {allReviews.map((review) => (
                        <ReviewItem
                            key={review.id}
                            review={review}
                            currentUser={authUser ?? null}
                            onEdit={(r) => {
                                if (user) {
                                    setEditingReview(r)
                                    setIsReviewOpen(true)
                                }
                            }}
                        />
                    ))}
                    {hasMoreReviews && (
                        <button
                            onClick={loadMoreReviews}
                            disabled={isLoadingMoreReviews}
                            className='w-full py-3 text-sm text-text/60 hover:text-text transition-colors disabled:opacity-50 cursor-pointer'
                        >
                            {isLoadingMoreReviews ? "Loading..." : "Load more reviews"}
                        </button>
                    )}
                </div>
            ) : (
                <div className='bg-text/5 rounded-xl border border-text/10 p-8 text-center'>
                    <p className='text-text/60 font-medium'>
                        No reviews yet. Be the first to share your experience!
                    </p>
                </div>
            )}
        </div>
    )

    return (
        <>
            {/* Hero Section */}
            <CafeHero
                cafe={cafe}
                user={user ?? null}
                isVisited={isVisited}
                isFavorite={isFavorite}
                isInWishlist={isInWishlist}
                visitCount={visitCount}
                visitedToday={visitedToday}
                isCheckingIn={isCheckingIn}
                onCheckIn={handleCheckInClick}
                onToggleVisited={handleToggleVisited}
                onToggleFavorite={handleToggleFavorite}
                onToggleWishlist={handleToggleWishlist}
                onOpenClaim={() => setIsClaimOpen(true)}
                onOpenAddToCollection={() => setIsAddToCollectionOpen(true)}
                heroImage={heroImage}
            />

            {/* Edit Banner - shown for admins/moderators */}
            {canEdit && editRole && (
                <CafeEditBanner
                    cafeId={cafe.id}
                    cafeName={cafe.name}
                    role={editRole}
                />
            )}

            {/* Mobile Layout (< md) */}
            <section className='md:hidden py-4 w-full'>
                <section className='px-4 pb-4'>
                        <CafeDiscounts cafeId={cafe.id} />
                </section>
                <CafeTabs
                    reviewCount={allReviews.length}
                    menuCount={menuItems.length}
                    tabContent={{
                        about: <AboutTabContent cafe={cafe} />,
                        details: (
                            <DetailsTabContent
                                cafe={cafe}
                                reviews={allReviews}
                                onOpenHistory={() => setIsHistoryOpen(true)}
                            />
                        ),
                        menu:
                            menuItems.length > 0 ? (
                                <div className='space-y-3 bg-tertiary/30 p-4 rounded-xl'>
                                    {/* Compare button header */}
                                    <div className="flex items-center justify-between pb-2 border-b border-text/10">
                                        <div className="flex items-center gap-2">
                                            {compareItemIds.length > 0 && (
                                                <span className="text-sm text-text/60">
                                                    {compareItemIds.length} item{compareItemIds.length === 1 ? "" : "s"} selected
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            onClick={handleOpenCompareModal}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
                                        >
                                            <Scale className="w-3.5 h-3.5" />
                                            Compare
                                        </button>
                                    </div>
                                    {menuItems
                                        .filter(
                                            (item) =>
                                                item.is_available &&
                                                item.category !== "Add-ons",
                                        )
                                        .sort((a, b) => {
                                            const aIsSpecialty = a.category
                                                .toLowerCase()
                                                .includes("special")
                                            const bIsSpecialty = b.category
                                                .toLowerCase()
                                                .includes("special")
                                            if (aIsSpecialty && !bIsSpecialty)
                                                return -1
                                            if (!aIsSpecialty && bIsSpecialty)
                                                return 1
                                            if (
                                                a.is_signature &&
                                                !b.is_signature
                                            )
                                                return -1
                                            if (
                                                !a.is_signature &&
                                                b.is_signature
                                            )
                                                return 1
                                            return 0
                                        })
                                        .slice(0, 5)
                                        .map((item) => {
                                            const isInComparison = isItemInComparison(item.id)
                                            const canAddMore = compareItemIds.length < 4 || isInComparison
                                            return (
                                            <div
                                                key={item.id}
                                                className='flex justify-between items-start gap-4 group'
                                            >
                                                <div className='flex-1 min-w-0'>
                                                    <div className='flex items-center gap-2'>
                                                        <span className='font-semibold'>
                                                            {item.name}
                                                        </span>
                                                        {item.is_signature && (
                                                            <span className='px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded'>
                                                                ★
                                                            </span>
                                                        )}
                                                    </div>
                                                    {item.description && (
                                                        <p className='text-sm text-text/60 mt-0.5'>
                                                            {item.description}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className='font-medium text-text/80 shrink-0'>
                                                        ₱{item.price.toFixed(0)}
                                                    </span>
                                                    <button
                                                        onClick={() => toggleCompareItem(item.id)}
                                                        disabled={!canAddMore}
                                                        className={`p-1 rounded-full transition-all cursor-pointer ${
                                                            isInComparison
                                                                ? 'bg-primary text-white'
                                                                : 'text-text/40 hover:text-primary hover:bg-primary/10'
                                                        } ${!canAddMore ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                        title={isInComparison ? 'Remove from comparison' : compareItemIds.length >= 4 ? 'Max 4 items' : 'Add to comparison'}
                                                    >
                                                        {isInComparison ? (
                                                            <Check className='w-3.5 h-3.5' />
                                                        ) : (
                                                            <Plus className='w-3.5 h-3.5' />
                                                        )}
                                                    </button>
                                                    {renderEditButton(item)}
                                                </div>
                                            </div>
                                            )
                                        })}
                                    {menuItems.filter(
                                        (item) =>
                                            item.is_available &&
                                            item.category !== "Add-ons",
                                    ).length > 5 && (
                                        <Link
                                            href={`/cafes/${cafe.slug}/menu`}
                                            className='block text-center text-sm text-primary hover:text-primary/80 font-medium transition-colors pt-2'
                                        >
                                            View Full Menu (
                                            {
                                                menuItems.filter(
                                                    (item) =>
                                                        item.is_available &&
                                                        item.category !==
                                                            "Add-ons",
                                                ).length
                                            }{" "}
                                            items) →
                                        </Link>
                                    )}
                                    <div className='pt-2 border-t border-text/10 flex items-center gap-3'>
                                        <SuggestMenuItemButton
                                            cafeId={cafe.id}
                                            cafeName={cafe.name}
                                            variant='compact'
                                        />
                                        <MenuOcrScanButton
                                            cafeId={cafe.id}
                                            cafeName={cafe.name}
                                            cafeSlug={cafe.slug}
                                            variant='compact'
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className='space-y-4'>
                                    <div className='text-center py-8 text-text/50 bg-tertiary/30 rounded-xl'>
                                        <p>No menu items available</p>
                                    </div>
                                    <div className='flex justify-center gap-3'>
                                        <SuggestMenuItemButton
                                            cafeId={cafe.id}
                                            cafeName={cafe.name}
                                            variant='compact'
                                        />
                                        <MenuOcrScanButton
                                            cafeId={cafe.id}
                                            cafeName={cafe.name}
                                            cafeSlug={cafe.slug}
                                            variant='compact'
                                        />
                                    </div>
                                </div>
                            ),
                        reviews: <ReviewsSection />,
                    }}
                />
            </section>

            {/* Desktop Layout (>= md) */}
            <section
                id='desktop-body'
                className='hidden md:grid md:grid-cols-12 w-full px-4 py-4 gap-6 mx-auto'
            >
                {/* Sidebar */}
                <aside className='md:col-span-3'>
                    <CafeSidebar
                        cafe={cafe}
                        reviews={allReviews}
                        onOpenHistory={() => setIsHistoryOpen(true)}
                    />
                </aside>

                {/* Main Content */}
                <div className='md:col-span-9 flex flex-col gap-6'>
                    {/* Gallery — Mosaic Grid (desktop only) */}
                    {gallery.length > 0 && (
                        <section className='w-full'>
                            <h2 className='text-xl font-semibold font-serif flex items-center gap-2 mb-4'>
                                Gallery
                            </h2>
                            <div
                                className={`grid gap-2 rounded-xl overflow-hidden ${
                                    gallery.length === 1
                                        ? "grid-cols-1"
                                        : gallery.length === 2
                                          ? "grid-cols-2"
                                          : "grid-cols-4 grid-rows-2"
                                }`}
                                style={{
                                    height:
                                        gallery.length >= 3 ? "420px" : "300px",
                                }}
                            >
                                {gallery.length >= 3 ? (
                                    <>
                                        {/* Large featured — 2 cols × 2 rows */}
                                        <div
                                            className='col-span-2 row-span-2 relative group cursor-pointer overflow-hidden'
                                            onClick={() => {
                                                setLightboxIndex(0)
                                                setIsLightboxOpen(true)
                                            }}
                                        >
                                            <Image
                                                src={gallery[0]}
                                                alt={`${cafe.name} photo 1`}
                                                fill
                                                className='object-cover transition-transform duration-500 group-hover:scale-105'
                                                sizes='(min-width: 768px) 50vw, 100vw'
                                                priority
                                            />
                                            <div className='absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors' />
                                        </div>

                                        {/* Smaller photos — up to 4 */}
                                        {gallery
                                            .slice(1, 5)
                                            .map((image, idx) => {
                                                const isLastVisible =
                                                    idx === 3 &&
                                                    gallery.length > 5
                                                return (
                                                    <div
                                                        key={`${cafe.id}-mosaic-${idx + 1}`}
                                                        className='relative group cursor-pointer overflow-hidden'
                                                        onClick={() => {
                                                            setLightboxIndex(
                                                                idx + 1,
                                                            )
                                                            setIsLightboxOpen(
                                                                true,
                                                            )
                                                        }}
                                                    >
                                                        <Image
                                                            src={image}
                                                            alt={`${cafe.name} photo ${idx + 2}`}
                                                            fill
                                                            loading='lazy'
                                                            className='object-cover transition-transform duration-500 group-hover:scale-110'
                                                            sizes='(min-width: 768px) 25vw, 50vw'
                                                        />
                                                        <div className='absolute inset-0 bg-black/5 group-hover:bg-black/0 transition-colors' />
                                                        {isLastVisible && (
                                                            <div className='absolute inset-0 bg-black/50 flex items-center justify-center'>
                                                                <span className='text-white font-bold text-sm'>
                                                                    +
                                                                    {gallery.length -
                                                                        5}{" "}
                                                                    more
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                    </>
                                ) : (
                                    gallery.slice(0, 2).map((image, idx) => (
                                        <div
                                            key={`${cafe.id}-mosaic-${idx}`}
                                            className='relative group cursor-pointer overflow-hidden'
                                            onClick={() => {
                                                setLightboxIndex(idx)
                                                setIsLightboxOpen(true)
                                            }}
                                        >
                                            <Image
                                                src={image}
                                                alt={`${cafe.name} photo ${idx + 1}`}
                                                fill
                                                className='object-cover transition-transform duration-500 group-hover:scale-105'
                                                sizes='(min-width: 768px) 50vw, 100vw'
                                                priority={idx === 0}
                                            />
                                            <div className='absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors' />
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>
                    )}

                    {/* Amenities & Extras — moved from sidebar */}
                    {(cafe.has_wifi ||
                        cafe.has_sockets ||
                        cafe.has_parking ||
                        cafe.has_aircon ||
                        cafe.is_pet_friendly ||
                        cafe.has_outdoor_seating ||
                        cafe.has_indoor_seating ||
                        cafe.has_restroom ||
                        cafe.has_bidet ||
                        cafe.has_non_dairy ||
                        cafe.has_decaf ||
                        cafe.is_work_friendly ||
                        cafe.is_halal_certified ||
                        cafe.has_smoking ||
                        cafe.serves_food ||
                        (cafe.brew_methods && cafe.brew_methods.length > 0) ||
                        (cafe.specialty && cafe.specialty.length > 0) ||
                        (cafe.tags && cafe.tags.length > 0)) && (
                        <div className='grid grid-cols-2 gap-8 p-6 bg-text/5 border border-text/10 rounded-xl'>
                            {/* Amenities column */}
                            <section>
                                <h3 className='text-xs font-bold uppercase tracking-widest text-text/40 mb-4'>
                                    Amenities
                                </h3>
                                <ul className='flex flex-row flex-wrap gap-2'>
                                    {cafe.has_wifi && (
                                        <AmenityPill
                                            icon={
                                                <WifiIcon className='w-3.5 h-3.5' />
                                            }
                                            label='WiFi'
                                        />
                                    )}
                                    {cafe.has_sockets && (
                                        <AmenityPill
                                            icon={
                                                <PlugIcon className='w-3.5 h-3.5' />
                                            }
                                            label='Power Outlets'
                                        />
                                    )}
                                    {cafe.has_parking && (
                                        <AmenityPill
                                            icon={
                                                <CarIcon className='w-3.5 h-3.5' />
                                            }
                                            label='Parking'
                                        />
                                    )}
                                    {cafe.has_aircon && (
                                        <AmenityPill
                                            icon={
                                                <SnowflakeIcon className='w-3.5 h-3.5' />
                                            }
                                            label='Air Conditioning'
                                        />
                                    )}
                                    {cafe.is_pet_friendly && (
                                        <AmenityPill
                                            icon={
                                                <PawPrintIcon className='w-3.5 h-3.5' />
                                            }
                                            label='Pet Friendly'
                                        />
                                    )}
                                    {cafe.has_outdoor_seating && (
                                        <AmenityPill
                                            icon={
                                                <SunIcon className='w-3.5 h-3.5' />
                                            }
                                            label='Outdoor Seating'
                                        />
                                    )}
                                    {cafe.has_indoor_seating && (
                                        <AmenityPill
                                            icon={
                                                <Armchair className='w-3.5 h-3.5' />
                                            }
                                            label='Indoor Seating'
                                        />
                                    )}
                                    {cafe.has_restroom && (
                                        <AmenityPill
                                            icon={
                                                <Toilet className='w-3.5 h-3.5' />
                                            }
                                            label='Restroom'
                                        />
                                    )}
                                    {cafe.has_bidet && (
                                        <AmenityPill
                                            icon={
                                                <Droplet className='w-3.5 h-3.5' />
                                            }
                                            label='Bidet'
                                        />
                                    )}
                                    {cafe.has_non_dairy && (
                                        <AmenityPill
                                            icon={
                                                <MilkOff className='w-3.5 h-3.5' />
                                            }
                                            label='Non-Dairy Milk'
                                        />
                                    )}
                                    {cafe.has_decaf && (
                                        <AmenityPill
                                            icon={
                                                <Coffee className='w-3.5 h-3.5' />
                                            }
                                            label='Decaf Options'
                                        />
                                    )}
                                    {cafe.is_work_friendly && (
                                        <AmenityPill
                                            icon={
                                                <BriefcaseIcon className='w-3.5 h-3.5' />
                                            }
                                            label='Work Friendly'
                                        />
                                    )}
                                    {cafe.is_halal_certified && (
                                        <AmenityPill label='Halal Certified' />
                                    )}
                                    {cafe.has_smoking && (
                                        <AmenityPill
                                            icon={
                                                <Cigarette className='w-3.5 h-3.5' />
                                            }
                                            label='Smoking Area'
                                        />
                                    )}
                                </ul>
                            </section>

                            {/* Extras / Vibe column */}
                            <section>
                                <h3 className='text-xs font-bold uppercase tracking-widest text-text/40 mb-4'>
                                    Vibe & Extras
                                </h3>
                                <ul className='flex flex-row flex-wrap gap-2'>
                                    {cafe.serves_food && (
                                        <AmenityPill label='Serves Food' />
                                    )}
                                    {cafe.brew_methods?.map((m) => (
                                        <AmenityPill
                                            key={m}
                                            label={m.split("_").join(" ")}
                                        />
                                    ))}
                                    {cafe.specialty?.map((s) => (
                                        <AmenityPill
                                            key={s}
                                            label={s.split("_").join(" ")}
                                        />
                                    ))}
                                    {cafe.tags?.map((t) => (
                                        <AmenityPill
                                            key={t}
                                            label={t.split("_").join(" ")}
                                        />
                                    ))}
                                </ul>
                            </section>
                        </div>
                    )}

                    {/* Story - Limited height on desktop to keep reviews visible */}
                    {story ? (
                        <div className='w-full relative'>
                            <div className='max-h-[350px] overflow-hidden'>
                                <MarkdownRender content={story.content} />
                            </div>
                            {/* Gradient fade overlay */}
                            <div className='absolute bottom-0 left-0 right-0 h-20 bg-linear-to-t from-background via-background/80 to-transparent pointer-events-none' />
                            {/* Read more indicator */}
                            <p className='text-sm text-text/50 text-center mt-2'>
                                Scroll down on desktop or visit the cafe to
                                learn more
                            </p>
                        </div>
                    ) : (
                        <div className='w-full bg-text/5 rounded-xl border border-dashed border-text/20 p-8 text-center'>
                            <p className='text-text/50 font-serif italic'>
                                This cafe&apos;s story is yet to be told...
                            </p>
                            <p className='text-text/40 text-sm mt-2'>
                                Check back later for more about {cafe.name}
                            </p>
                        </div>
                    )}

                    {/* Menu Section - Preview with specialties priority */}
                    {menuItems.length > 0 ? (
                        <section className='w-full'>
                            <div className='flex items-center justify-between mb-4'>
                                <h2 className='text-xl font-semibold'>Menu</h2>
                                <div className="flex items-center gap-2">
                                    {compareItemIds.length > 0 && (
                                        <span className="text-sm text-text/60">
                                            {compareItemIds.length} selected
                                        </span>
                                    )}
                                    <button
                                        onClick={handleOpenCompareModal}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
                                    >
                                        <Scale className="w-3.5 h-3.5" />
                                        Compare
                                    </button>
                                    <Link
                                        href={`/cafes/${cafe.slug}/menu`}
                                        className='text-sm text-primary hover:text-primary/80 font-medium transition-colors'
                                    >
                                        View Full Menu →
                                    </Link>
                                </div>
                            </div>
                            <div className='space-y-3 bg-tertiary/30 p-4 rounded-xl'>
                                {/* Sort items: specialties first, then by signature status */}
                                {menuItems
                                    .filter(
                                        (item) =>
                                            item.is_available &&
                                            item.category !== "Add-ons",
                                    )
                                    .sort((a, b) => {
                                        const aIsSpecialty = a.category
                                            .toLowerCase()
                                            .includes("special")
                                        const bIsSpecialty = b.category
                                            .toLowerCase()
                                            .includes("special")
                                        if (aIsSpecialty && !bIsSpecialty)
                                            return -1
                                        if (!aIsSpecialty && bIsSpecialty)
                                            return 1
                                        if (a.is_signature && !b.is_signature)
                                            return -1
                                        if (!a.is_signature && b.is_signature)
                                            return 1
                                        return 0
                                    })
                                    .slice(0, 5)
                                    .map((item) => {
                                        const isInComparison = isItemInComparison(item.id)
                                        const canAddMore = compareItemIds.length < 4 || isInComparison
                                        return (
                                        <div
                                            key={item.id}
                                            className='flex justify-between items-start gap-4 group'
                                        >
                                            <div className='flex-1 min-w-0'>
                                                <div className='flex items-center gap-2'>
                                                    <span className='font-semibold'>
                                                        {item.name}
                                                    </span>
                                                    {item.is_signature && (
                                                        <span className='px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded'>
                                                            ★
                                                        </span>
                                                    )}
                                                </div>
                                                {item.description && (
                                                    <p className='text-sm text-text/60 mt-0.5'>
                                                        {item.description}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className='font-medium text-text/80 shrink-0'>
                                                    ₱{item.price.toFixed(0)}
                                                </span>
                                                <button
                                                    onClick={() => toggleCompareItem(item.id)}
                                                    disabled={!canAddMore}
                                                    className={`p-1 rounded-full transition-all cursor-pointer ${
                                                        isInComparison
                                                            ? 'bg-primary text-white'
                                                            : 'text-text/40 hover:text-primary hover:bg-primary/10'
                                                    } ${!canAddMore ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    title={isInComparison ? 'Remove from comparison' : compareItemIds.length >= 4 ? 'Max 4 items' : 'Add to comparison'}
                                                >
                                                    {isInComparison ? (
                                                        <Check className='w-3.5 h-3.5' />
                                                    ) : (
                                                        <Plus className='w-3.5 h-3.5' />
                                                    )}
                                                </button>
                                                {renderEditButton(item)}
                                            </div>
                                        </div>
                                        )
                                    })}
                                {menuItems.filter(
                                    (item) =>
                                        item.is_available &&
                                        item.category !== "Add-ons",
                                ).length > 5 && (
                                    <Link
                                        href={`/cafes/${cafe.slug}/menu`}
                                        className='block text-center text-sm text-primary hover:text-primary/80 font-medium transition-colors pt-2'
                                    >
                                        View Full Menu (
                                        {
                                            menuItems.filter(
                                                (item) =>
                                                    item.is_available &&
                                                    item.category !== "Add-ons",
                                            ).length
                                        }{" "}
                                        items) →
                                    </Link>
                                )}
                                <div className='pt-3 border-t border-text/10 flex items-center justify-center gap-3'>
                                    <SuggestMenuItemButton
                                        cafeId={cafe.id}
                                        cafeName={cafe.name}
                                        variant='default'
                                    />
                                    <MenuOcrScanButton
                                        cafeId={cafe.id}
                                        cafeName={cafe.name}
                                        cafeSlug={cafe.slug}
                                        variant='default'
                                    />
                                </div>
                            </div>
                        </section>
                    ) : (
                        <section className='w-full'>
                            <div className='flex items-center justify-between mb-4'>
                                <h2 className='text-xl font-semibold'>Menu</h2>
                            </div>
                            <div className='bg-tertiary/30 p-8 rounded-xl text-center space-y-4'>
                                <p className='text-text/50'>
                                    No menu items available yet
                                </p>
                                <div className='flex justify-center gap-3'>
                                    <SuggestMenuItemButton
                                        cafeId={cafe.id}
                                        cafeName={cafe.name}
                                        variant='default'
                                    />
                                    <MenuOcrScanButton
                                        cafeId={cafe.id}
                                        cafeName={cafe.name}
                                        cafeSlug={cafe.slug}
                                        variant='default'
                                    />
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Discounts Section */}
                    <section className='w-full'>
                    <CafeDiscounts cafeId={cafe.id} />
                    </section>

                    {/* Reviews Section */}
                    <section className='w-full mt-6'>
                        <ReviewsSection />
                    </section>
                </div>
            </section>

            {/* Review Modal */}
            <ReviewModal
                isOpen={isReviewOpen}
                onClose={() => {
                    setIsReviewOpen(false)
                    setEditingReview(undefined)
                }}
                cafeId={cafe.id}
                cafeName={cafe.name}
                existingReview={editingReview || userReview}
            />

            {/* Claim Cafe Modal */}
            <ClaimCafeModal
                isOpen={isClaimOpen}
                onClose={() => setIsClaimOpen(false)}
                cafeId={cafe.id}
                cafeName={cafe.name}
            />

            {/* Gallery Lightbox */}
            <ImageLightbox
                key={
                    isLightboxOpen
                        ? `lightbox-${lightboxIndex}`
                        : "lightbox-closed"
                }
                images={gallery}
                initialIndex={lightboxIndex}
                isOpen={isLightboxOpen}
                onClose={() => setIsLightboxOpen(false)}
                altPrefix={`${cafe.name} photo`}
            />

            {/* Contribution History Modal */}
            <ContributionHistoryModal
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
                cafeId={cafe.id}
                cafeName={cafe.name}
            />

            {/* Add to Collection Modal */}
            <AddToCollectionModal
                isOpen={isAddToCollectionOpen}
                onClose={() => setIsAddToCollectionOpen(false)}
                cafeId={cafe.id}
                cafeName={cafe.name}
            />

            {/* Milestone Celebration */}
            <MilestoneCelebration
                milestone={milestone}
                cafeName={cafe.name}
                onClose={() => setMilestone(null)}
            />

            {/* Group Check-in Modal */}
            <GroupCheckInModal
                isOpen={isCheckInModalOpen}
                onClose={() => setIsCheckInModalOpen(false)}
                cafeName={cafe.name}
                onCheckIn={handleCheckIn}
                onComplete={handleCheckInComplete}
                onUpdateCheckIn={updateCheckInCompanions}
                visitedToday={visitedToday}
                visitCount={visitCount}
                initialCompanions={currentCompanions}
            />

            {/* Menu Comparison Modal */}
            <MenuComparisonModal
                isOpen={isCompareModalOpen}
                onClose={handleCloseCompareModal}
                initialItems={selectedCompareItems}
            />

            {/* Suggest Edit Modal */}
            {editTargetItem && (
                <SuggestMenuItemModal
                    isOpen={!!editTargetItem}
                    onClose={() => setEditTargetItem(null)}
                    cafeId={cafe.id}
                    cafeName={cafe.name}
                    mode="edit"
                    existingItem={{
                        id: editTargetItem.id,
                        name: editTargetItem.name,
                        category: editTargetItem.category,
                        price: editTargetItem.price,
                        description: editTargetItem.description,
                        is_food: editTargetItem.is_food ?? undefined,
                        is_hot: editTargetItem.is_hot ?? undefined,
                        is_cold: editTargetItem.is_cold ?? undefined,
                        is_vegan: editTargetItem.is_vegan ?? undefined,
                        is_vegetarian: editTargetItem.is_vegetarian ?? undefined,
                        calories: editTargetItem.calories ?? undefined,
                        size_options: editTargetItem.size_options ?? undefined,
                    }}
                />
            )}
        </>
    )
}
