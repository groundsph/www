/* eslint-disable react-hooks/static-components -- ReviewsSection is an intentional render helper */
"use client"

import Link from "next/link"
import { CafeWithRatings } from "@/utils/types/extra"
import { CafeMenuItem } from "@/utils/types/owner"
import Image from "next/image"
import { useState, useEffect, useMemo } from "react"
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
} from "lucide-react"

// Components
import CafeHero from "@/components/cafe/CafeHero"
import CafeSidebar from "@/components/cafe/CafeSidebar"
import CafeTabs from "@/components/cafe/CafeTabs"
import {
    AboutTabContent,
    DetailsTabContent,
} from "@/components/cafe/CafeMobileContent"
import ReviewModal from "@/components/reviews/ReviewModal"
import ReviewItem from "@/components/reviews/ReviewItem"
import MarkdownRender from "@/components/ui/MarkdownRender"
import ImageLightbox from "@/components/modal/ImageLightbox"
import ClaimCafeModal from "@/components/modal/ClaimCafeModal"
import ContributionHistoryModal from "@/components/history/ContributionHistoryModal"
import AddToCollectionModal from "@/components/collections/AddToCollectionModal"
import MilestoneCelebration from "@/components/ui/MilestoneCelebration"
import GroupCheckInModal from "@/components/checkin/GroupCheckInModal"

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

export default function CafeDetails({
    cafe,
    reviews = [],
    menuItems = [],
    heroImage,
}: {
    cafe: CafeWithRatings
    reviews?: Review[]
    menuItems?: CafeMenuItem[]
    /** Server-rendered hero image for better LCP */
    heroImage?: React.ReactNode
}) {
    // Auth
    const authUser = useAuth().user

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
        setIsCheckInModalOpen(true)
    }

    // Computed
    const story = cafe.story
    const gallery = useMemo(() => cafe.gallery ?? [], [cafe.gallery])

    // Find if user has reviewed
    const userReview = user
        ? reviews.find((r) => r.user_id === user.id)
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

    // Reviews Section Component (shared between mobile tabs and desktop)
    const ReviewsSection = () => (
        <div className='flex flex-col gap-6'>
            <div className='flex flex-row items-center justify-between'>
                <h2 className='text-xl font-semibold font-serif flex items-center gap-2'>
                    Reviews
                    {reviews.length > 0 && (
                        <span className='text-sm font-normal text-text/60'>
                            ({reviews.length})
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

            {reviews.length > 0 ? (
                <div className='flex flex-col gap-4'>
                    {reviews.map((review) => (
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
                onToggleVisited={toggleVisited}
                onToggleFavorite={toggleFavorite}
                onToggleWishlist={toggleWishlist}
                onOpenClaim={() => setIsClaimOpen(true)}
                onOpenAddToCollection={() => setIsAddToCollectionOpen(true)}
                heroImage={heroImage}
            />

            {/* Mobile Layout (< md) */}
            <section className='md:hidden py-4 w-full'>
                <CafeTabs
                    reviewCount={reviews.length}
                    menuCount={menuItems.length}
                    tabContent={{
                        about: <AboutTabContent cafe={cafe} />,
                        details: (
                            <DetailsTabContent
                                cafe={cafe}
                                reviews={reviews}
                                onOpenHistory={() => setIsHistoryOpen(true)}
                            />
                        ),
                        menu:
                            menuItems.length > 0 ? (
                                <div className='space-y-3 bg-tertiary/30 p-4 rounded-xl'>
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
                                        .map((item) => (
                                            <div
                                                key={item.id}
                                                className='flex justify-between items-start gap-4'
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
                                                <span className='font-medium text-text/80 shrink-0'>
                                                    ₱{item.price.toFixed(2)}
                                                </span>
                                            </div>
                                        ))}
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
                                </div>
                            ) : (
                                <div className='text-center py-8 text-text/50'>
                                    <p>No menu items available</p>
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
                        reviews={reviews}
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
                    {menuItems.length > 0 && (
                        <section className='w-full'>
                            <div className='flex items-center justify-between mb-4'>
                                <h2 className='text-xl font-semibold'>Menu</h2>
                                <Link
                                    href={`/cafes/${cafe.slug}/menu`}
                                    className='text-sm text-primary hover:text-primary/80 font-medium transition-colors'
                                >
                                    View Full Menu →
                                </Link>
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
                                    .map((item) => (
                                        <div
                                            key={item.id}
                                            className='flex justify-between items-start gap-4'
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
                                            <span className='font-medium text-text/80 shrink-0'>
                                                ₱{item.price.toFixed(2)}
                                            </span>
                                        </div>
                                    ))}
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
                            </div>
                        </section>
                    )}

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
        </>
    )
}
