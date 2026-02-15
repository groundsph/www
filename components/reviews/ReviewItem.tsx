"use client"

import type { Review } from "@/components/cafe/CafeDetails"
import { formatDistanceToNow } from "date-fns"
import {
    Heart,
    MoreVertical,
    Star,
    Trash2,
    Edit2,
    User,
    Flag,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import {
    toggleReviewLike,
    deleteReview,
    reportReview,
} from "@/app/api/actions/review"
import { useRouter } from "next/navigation"
import { cn } from "@/utils/cn"
import MarkdownRender from "@/components/ui/MarkdownRender"
import ImageLightbox from "@/components/modal/ImageLightbox"

// Simple user type - only needs id for this component
type SimpleUser = { id: string } | null

interface ReviewItemProps {
    review: Review
    currentUser: SimpleUser
    onEdit?: (review: Review) => void
}

export default function ReviewItem({
    review,
    currentUser,
    onEdit,
}: ReviewItemProps) {
    const router = useRouter()
    const [likesCount, setLikesCount] = useState(review.likes_count || 0)

    // Check if current user has liked this review
    const isLikedInitially = review.review_interactions?.some(
        (i: { user_id: string; interaction_type: string }) =>
            i.user_id === currentUser?.id && i.interaction_type === "like"
    )
    const [isLiked, setIsLiked] = useState(!!isLikedInitially)
    const [isLiking, setIsLiking] = useState(false)
    const [showMenu, setShowMenu] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isReporting, setIsReporting] = useState(false)
    const [hasReported, setHasReported] = useState(false)

    // Derived states
    const isOwner = currentUser?.id === review.user_id
    const avatarUrl = review.author?.avatar_url
    const displayName = review.author?.display_name || "Unknown User"
    const username = review.author?.username || "user"

    // Lightbox state
    const [isLightboxOpen, setIsLightboxOpen] = useState(false)
    const [lightboxIndex, setLightboxIndex] = useState(0)

    const handleLike = async () => {
        if (!currentUser || isLiking) return

        // Optimistic update
        const newIsLiked = !isLiked
        const newCount = newIsLiked
            ? likesCount + 1
            : Math.max(0, likesCount - 1)

        setIsLiked(newIsLiked)
        setLikesCount(newCount)
        setIsLiking(true)

        try {
            await toggleReviewLike(review.id)
        } catch (error) {
            // Revert on error
            setIsLiked(!newIsLiked)
            setLikesCount(likesCount)
            console.error("Like failed", error)
        } finally {
            setIsLiking(false)
        }
    }

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this review?")) return

        setIsDeleting(true)
        try {
            const result = await deleteReview(review.id)
            if (result.success) {
                router.refresh()
            }
        } catch (error) {
            console.error("Delete failed", error)
            setIsDeleting(false)
        }
    }

    const handleReport = async () => {
        if (!currentUser || isReporting || hasReported) return

        if (
            !confirm(
                "Are you sure you want to report this review? It will be flagged for moderator review."
            )
        ) {
            return
        }

        setIsReporting(true)
        setShowMenu(false)

        try {
            const result = await reportReview(review.id)
            if (result.reported) {
                setHasReported(true)
            } else if (result.error) {
                alert(result.error)
            }
        } catch (error) {
            console.error("Report failed", error)
        } finally {
            setIsReporting(false)
        }
    }

    return (
        <div className='bg-background border border-text/5 rounded-xl p-5 hover:border-text/10 transition-colors animate-in fade-in slide-in-from-bottom-2 duration-500 group'>
            {/* Header: Author & Options */}
            <div className='flex items-start justify-between mb-4'>
                <Link
                    href={`/profile/${username}`}
                    className='flex items-center gap-3'
                >
                    <div className='relative w-10 h-10 rounded-full overflow-hidden bg-text/5 border border-text/10 group-hover:border-primary/50 transition-colors'>
                        {avatarUrl ? (
                            <Image
                                src={avatarUrl}
                                alt={displayName}
                                fill
                                className='object-cover'
                            />
                        ) : (
                            <div className='w-full h-full flex items-center justify-center'>
                                <User className='w-5 h-5 text-text opacity-40' />
                            </div>
                        )}
                    </div>
                    <div className='flex flex-col'>
                        <span className='font-bold text-sm text-text group-hover/link:text-primary transition-colors'>
                            {displayName}
                        </span>
                        <div className='flex items-center gap-2 text-xs text-text/50 font-medium'>
                            <span>@{username}</span>
                            <span>•</span>
                            <span>
                                {review.created_at
                                    ? formatDistanceToNow(
                                          new Date(review.created_at),
                                          { addSuffix: true }
                                      )
                                    : "Just now"}
                            </span>
                            {review.is_edited && (
                                <span className='text-text/40 italic'>
                                    (edited)
                                </span>
                            )}
                        </div>
                    </div>
                </Link>

                <div className='flex items-center gap-2'>
                    {/* Menu for Owner or Report */}
                    <div className='relative'>
                        <button
                            onClick={() => setShowMenu(!showMenu)}
                            className='p-1.5 hover:bg-text/5 rounded-full transition-colors text-text/40 hover:text-text opacity-0 group-hover:opacity-100'
                        >
                            <MoreVertical className='w-4 h-4' />
                        </button>

                        {showMenu && (
                            <>
                                <div
                                    className='fixed inset-0 z-10'
                                    onClick={() => setShowMenu(false)}
                                />
                                <div className='absolute right-0 top-full mt-1 w-32 bg-background border border-text/10 rounded-lg shadow-xl z-20 py-1 text-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200'>
                                    {isOwner ? (
                                        <>
                                            <button
                                                onClick={() => {
                                                    setShowMenu(false)
                                                    onEdit?.(review)
                                                }}
                                                className='w-full px-4 py-2 text-left hover:bg-text/5 flex items-center gap-2 font-medium'
                                            >
                                                <Edit2 className='w-3.5 h-3.5' />
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setShowMenu(false)
                                                    handleDelete()
                                                }}
                                                className='w-full px-4 py-2 text-left hover:bg-red-500/10 text-red-500 flex items-center gap-2 font-medium'
                                                disabled={isDeleting}
                                            >
                                                <Trash2 className='w-3.5 h-3.5' />
                                                Delete
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            className='w-full px-4 py-2 text-left hover:bg-red-500/10 flex items-center gap-2 text-text/60 hover:text-red-500 font-medium disabled:opacity-50'
                                            onClick={handleReport}
                                            disabled={
                                                isReporting ||
                                                hasReported ||
                                                !currentUser
                                            }
                                        >
                                            <Flag className='w-3.5 h-3.5' />
                                            {hasReported
                                                ? "Reported"
                                                : isReporting
                                                  ? "Reporting..."
                                                  : "Report"}
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Rating & Content */}
            <div className='mb-4'>
                <div className='flex items-center gap-1 mb-2'>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                            key={i}
                            className={`w-4 h-4 ${
                                i < review.rating
                                    ? "fill-primary text-primary"
                                    : "fill-text/5 text-text opacity-10"
                            }`}
                        />
                    ))}
                </div>

                <div className='text-sm text-text/80 leading-relaxed font-serif'>
                    <MarkdownRender content={review.comment} />
                </div>
            </div>

            {review.images &&
                Array.isArray(review.images) &&
                review.images.length > 0 && (
                    <div className='flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide'>
                        {review.images.map((img: string, idx: number) => (
                            <div
                                key={idx}
                                className='relative h-20 w-20 shrink-0 rounded-lg overflow-hidden border border-text/10 cursor-pointer hover:opacity-90 transition-opacity'
                                onClick={() => {
                                    setLightboxIndex(idx)
                                    setIsLightboxOpen(true)
                                }}
                            >
                                <Image
                                    src={img}
                                    alt={`Review image ${idx + 1}`}
                                    fill
                                    className='object-cover'
                                />
                            </div>
                        ))}
                    </div>
                )}

            {/* Owner Response */}
            {review.owner_response && (
                <div className='mt-4 ml-4 p-4 bg-primary/5 border-l-2 border-primary rounded-r-lg'>
                    <div className='flex items-center gap-2 mb-2'>
                        <div className='relative w-6 h-6 rounded-full overflow-hidden bg-text/10 border border-primary/20'>
                            {review.owner_response.owner?.avatar_url ? (
                                <Image
                                    src={review.owner_response.owner.avatar_url}
                                    alt={
                                        review.owner_response.owner
                                            .display_name || "Owner"
                                    }
                                    fill
                                    className='object-cover'
                                />
                            ) : (
                                <div className='w-full h-full flex items-center justify-center'>
                                    <User className='w-3 h-3 text-primary opacity-60' />
                                </div>
                            )}
                        </div>
                        <span className='text-sm font-semibold text-primary'>
                            {review.owner_response.owner?.display_name ||
                                "Cafe Owner"}
                        </span>
                        <span className='text-xs px-1.5 py-0.5 bg-primary/20 text-primary rounded font-medium'>
                            Owner
                        </span>
                        <span className='text-xs text-text/40'>
                            {review.owner_response.created_at
                                ? formatDistanceToNow(
                                      new Date(
                                          review.owner_response.created_at
                                      ),
                                      { addSuffix: true }
                                  )
                                : ""}
                        </span>
                    </div>
                    <p className='text-sm text-text/70 leading-relaxed'>
                        {review.owner_response.response_text}
                    </p>
                </div>
            )}

            {/* Footer: Likes */}
            <div className='flex items-center gap-4 border-t border-text/5 pt-3 mt-1'>
                <button
                    onClick={handleLike}
                    disabled={!currentUser}
                    className={cn(
                        "flex items-center gap-1.5 text-xs font-semibold transition-all px-2 py-1 -ml-2 rounded-lg",
                        isLiked
                            ? "text-red-500 bg-red-500/5"
                            : "text-text/40 hover:text-text/70 hover:bg-text/5",
                        !currentUser && "opacity-50 cursor-not-allowed"
                    )}
                >
                    <Heart
                        className={cn("w-3.5 h-3.5", isLiked && "fill-current")}
                    />
                    {likesCount > 0 ? (
                        <span>
                            {likesCount}{" "}
                            <span className='font-normal opacity-80'>
                                likes
                            </span>
                        </span>
                    ) : (
                        "Like"
                    )}
                </button>
            </div>

            {/* Review Images Lightbox */}
            {review.images &&
                Array.isArray(review.images) &&
                review.images.length > 0 && (
                    <ImageLightbox
                        images={review.images}
                        initialIndex={lightboxIndex}
                        isOpen={isLightboxOpen}
                        onClose={() => setIsLightboxOpen(false)}
                        altPrefix='Review image'
                    />
                )}
        </div>
    )
}
