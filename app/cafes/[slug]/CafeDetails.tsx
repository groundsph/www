/* eslint-disable react-hooks/static-components -- ReviewsSection is an intentional render helper */
"use client"

import Link from "next/link"
import { CafeWithRatings } from "@/utils/types/extra"
import { CafeMenuItem } from "@/utils/types/owner"
import Image from "next/image"
import { useState, useContext } from "react"
import { AuthContext } from "@/components/AuthProvider"

// Components
import CafeHero from "./components/CafeHero"
import CafeSidebar from "./components/CafeSidebar"
import CafeTabs from "./components/CafeTabs"
import {
    AboutTabContent,
    DetailsTabContent,
} from "./components/CafeMobileContent"
import ReviewModal from "@/components/reviews/ReviewModal"
import ReviewItem from "@/components/reviews/ReviewItem"
import MarkdownRender from "@/components/MarkdownRender"
import ImageLightbox from "@/components/ImageLightbox"
import ClaimCafeModal from "@/components/ClaimCafeModal"

// Hooks
import { useCafeActions } from "@/hooks/useCafeActions"

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
}: {
    cafe: CafeWithRatings
    reviews?: Review[]
    menuItems?: CafeMenuItem[]
}) {
    // Auth
    const authContext = useContext(AuthContext)
    const authUser = authContext?.user

    // Cafe Actions Hook
    const {
        user,
        isVisited,
        isFavorite,
        isInWishlist,
        toggleVisited,
        toggleFavorite,
        toggleWishlist,
    } = useCafeActions(cafe.id)

    // Review Modal State
    const [isReviewOpen, setIsReviewOpen] = useState(false)
    const [editingReview, setEditingReview] = useState<Review | undefined>(
        undefined
    )

    // Claim Modal State
    const [isClaimOpen, setIsClaimOpen] = useState(false)

    // Lightbox State
    const [isLightboxOpen, setIsLightboxOpen] = useState(false)
    const [lightboxIndex, setLightboxIndex] = useState(0)

    // Computed
    const story = cafe.story
    const gallery = cafe.gallery ?? []

    // Find if user has reviewed
    const userReview = user
        ? reviews.find((r) => r.user_id === user.id)
        : undefined

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
                            currentUser={authUser}
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
                user={user}
                isVisited={isVisited}
                isFavorite={isFavorite}
                isInWishlist={isInWishlist}
                onToggleVisited={toggleVisited}
                onToggleFavorite={toggleFavorite}
                onToggleWishlist={toggleWishlist}
                onOpenClaim={() => setIsClaimOpen(true)}
            />

            {/* Mobile Layout (< md) */}
            <section className='md:hidden px-4 py-4 w-full'>
                <CafeTabs
                    reviewCount={reviews.length}
                    tabContent={{
                        about: <AboutTabContent cafe={cafe} />,
                        details: (
                            <DetailsTabContent
                                cafe={cafe}
                                reviews={reviews}
                            />
                        ),
                        reviews: <ReviewsSection />,
                    }}
                />
            </section>

            {/* Desktop Layout (>= md) */}
            <section
                id='desktop-body'
                className='hidden md:flex w-full flex-row items-start justify-start px-4 py-4 gap-4'
            >
                {/* Sidebar */}
                <CafeSidebar
                    cafe={cafe}
                    reviews={reviews}
                />

                {/* Main Content */}
                <div className='flex-1 flex flex-col gap-6'>
                    {/* Gallery - Horizontal Scroll */}
                    {gallery.length > 0 && (
                        <div className='w-full'>
                            <div
                                className='flex flex-row gap-3 overflow-x-auto pb-2 scrollbar-hide'
                                style={{
                                    scrollSnapType: "x mandatory",
                                    scrollBehavior: "smooth",
                                    msOverflowStyle: "none",
                                    scrollbarWidth: "none",
                                }}
                            >
                                {gallery.map((image, idx) => (
                                    <div
                                        key={`${cafe.id}-gallery-${idx}`}
                                        className='shrink-0 h-48 sm:h-56 md:h-64 overflow-hidden rounded-sm shadow-md shadow-black/10 cursor-pointer hover:opacity-90 transition-opacity'
                                        style={{ scrollSnapAlign: "start" }}
                                        onClick={() => {
                                            setLightboxIndex(idx)
                                            setIsLightboxOpen(true)
                                        }}
                                    >
                                        <Image
                                            src={image}
                                            alt={`${cafe.name} photo ${idx + 1}`}
                                            width={400}
                                            height={300}
                                            className='h-full w-auto object-cover transition-transform duration-300'
                                        />
                                    </div>
                                ))}
                            </div>
                            {gallery.length > 1 && (
                                <p className='text-xs text-text/40 mt-2 text-center'>
                                    ← Scroll to see {gallery.length} photos →
                                </p>
                            )}
                        </div>
                    )}

                    {/* Story */}
                    {story ? (
                        <div className='w-full'>
                            <MarkdownRender content={story.content} />
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

                    {/* Menu Section */}
                    {menuItems.length > 0 && (
                        <section className='w-full mt-6'>
                            <h2 className='text-xl font-semibold mb-4'>Menu</h2>
                            <div className='grid gap-4'>
                                {/* Group by category */}
                                {Array.from(
                                    new Set(
                                        menuItems.map((item) => item.category)
                                    )
                                ).map((category) => (
                                    <div
                                        key={category}
                                        className='space-y-2'
                                    >
                                        <h3 className='text-sm font-medium text-text/60 uppercase tracking-wide'>
                                            {category}
                                        </h3>
                                        <div className='grid gap-2'>
                                            {menuItems
                                                .filter(
                                                    (item) =>
                                                        item.category ===
                                                            category &&
                                                        item.is_available
                                                )
                                                .map((item) => (
                                                    <div
                                                        key={item.id}
                                                        className='flex justify-between items-start p-3 bg-tertiary/50 rounded-lg'
                                                    >
                                                        <div className='flex-1 min-w-0'>
                                                            <div className='flex items-center gap-2'>
                                                                <span className='font-medium'>
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
                                                                    {
                                                                        item.description
                                                                    }
                                                                </p>
                                                            )}
                                                        </div>
                                                        <span className='font-semibold text-primary ml-4'>
                                                            ₱
                                                            {item.price.toFixed(
                                                                0
                                                            )}
                                                        </span>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                ))}
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
                images={gallery}
                initialIndex={lightboxIndex}
                isOpen={isLightboxOpen}
                onClose={() => setIsLightboxOpen(false)}
                altPrefix={`${cafe.name} photo`}
            />
        </>
    )
}
