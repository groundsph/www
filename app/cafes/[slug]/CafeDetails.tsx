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
    const firstImage = gallery[0]
    const secondImage = gallery[1]
    const thirdImage = gallery[2]
    const remainingImages = gallery.slice(3)

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
                    children={{
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
                    {/* Gallery */}
                    {gallery.length > 0 && (
                        <div className='w-full flex flex-col gap-2'>
                            {firstImage && (
                                <>
                                    <div className='w-full h-auto aspect-video relative rounded-xl overflow-hidden'>
                                        <Image
                                            src={firstImage}
                                            alt={`${cafe.name} photo`}
                                            fill
                                            className='object-cover object-center'
                                        />
                                    </div>
                                    {secondImage && (
                                        <div className='w-full h-auto aspect-6/2 flex flex-row gap-2'>
                                            <div className='h-full w-auto aspect-video relative rounded-xl overflow-hidden'>
                                                <Image
                                                    src={secondImage}
                                                    alt={`${cafe.name} photo`}
                                                    fill
                                                    className='object-cover object-center'
                                                />
                                            </div>
                                            {thirdImage && (
                                                <div className='flex-1 relative rounded-xl overflow-hidden'>
                                                    <Image
                                                        src={thirdImage}
                                                        alt={`${cafe.name} photo`}
                                                        fill
                                                        className='object-cover object-center'
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
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

            {/* Additional Images Section */}
            {remainingImages && remainingImages.length > 0 && (
                <section
                    id='images'
                    className='px-4 py-10 w-full max-w-7xl mx-auto'
                >
                    <h2 className='text-xl font-semibold font-serif'>
                        More Photos
                    </h2>
                    <div className='flex flex-row gap-4 flex-wrap py-6 w-full'>
                        {remainingImages.map((image, idx) => (
                            <div
                                key={`${cafe.id}-image-${idx}`}
                                className='relative w-full sm:w-auto sm:h-48 aspect-video rounded-xl overflow-hidden'
                            >
                                <Image
                                    src={image}
                                    alt={`${cafe.name} gallery image ${idx + 4}`}
                                    fill
                                    className='object-cover'
                                />
                            </div>
                        ))}
                    </div>
                </section>
            )}

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
