/* eslint-disable react-hooks/static-components -- ReviewsSection is an intentional render helper */
"use client"

import Link from "next/link"
import { CafeWithRatings } from "@/utils/types/extra"
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
}

export default function CafeDetails({
    cafe,
    reviews = [],
}: {
    cafe: CafeWithRatings
    reviews?: Review[]
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
                                        className='shrink-0 h-48 sm:h-56 md:h-64 overflow-hidden rounded-sm shadow-md shadow-black/10'
                                        style={{ scrollSnapAlign: "start" }}
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
        </>
    )
}
