"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { XIcon, Loader2 } from "lucide-react"
import StarRating from "./StarRating"
import { createReview, updateReview } from "@/app/api/actions/review"
import { useRouter } from "next/navigation"
import ImageUpload from "./ImageUpload"
import { uploadReviewImage } from "@/utils/storage/client"
import { resizeImage } from "@/utils/image-processing"

interface ReviewModalProps {
    isOpen: boolean
    onClose: () => void
    cafeId: string
    cafeName: string
    existingReview?: {
        id: string
        rating: number
        comment: string
        images?: string[] | null
    }
}

export default function ReviewModal({
    isOpen,
    onClose,
    cafeId,
    cafeName,
    existingReview,
}: ReviewModalProps) {
    const router = useRouter()
    const [rating, setRating] = useState(existingReview?.rating || 0)
    const [comment, setComment] = useState(existingReview?.comment || "")
    // Update state type to accept strings and Files
    const [images, setImages] = useState<(string | File)[]>(
        existingReview?.images || []
    )
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async () => {
        if (rating === 0) {
            setError("Please select a rating")
            return
        }
        if (comment.trim().length < 10) {
            setError("Review must be at least 10 characters long")
            return
        }

        setIsSubmitting(true)
        setError(null)

        try {
            // Separate existing URLs from new Files
            const existingUrls = images.filter(
                (img): img is string => typeof img === "string"
            )
            const newFiles = images.filter(
                (img): img is File => img instanceof File
            )

            const uploadedUrls: string[] = []

            // Upload new files (client-side, direct to storage)
            if (newFiles.length > 0) {
                for (const file of newFiles) {
                    // Compress and resize for efficiency
                    const compressedFile = await resizeImage(file, {
                        maxWidth: 1200,
                        maxHeight: 1200,
                        quality: 0.85,
                        format: "image/jpeg",
                    })

                    const result = await uploadReviewImage(compressedFile)

                    if (result.success && result.url) {
                        uploadedUrls.push(result.url)
                    } else {
                        throw new Error(
                            result.error || "Failed to upload image"
                        )
                    }
                }
            }

            // Combine all URLs
            const finalImages = [...existingUrls, ...uploadedUrls]

            let result
            if (existingReview) {
                result = await updateReview(
                    existingReview.id,
                    rating,
                    comment,
                    finalImages
                )
            } else {
                result = await createReview(
                    cafeId,
                    rating,
                    comment,
                    finalImages
                )
            }

            if (result.error) {
                setError(result.error)
            } else {
                router.refresh()
                onClose()
            }
        } catch (e: unknown) {
            setError(
                e instanceof Error ? e.message : "An unexpected error occurred"
            )
        } finally {
            setIsSubmitting(false)
        }
    }
    // ... rest of the component

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className='fixed inset-0 bg-black/40 z-50 backdrop-blur-sm'
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className='fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl mx-4 bg-background text-text rounded-xl shadow-2xl z-50 flex flex-col max-h-[90vh] overflow-hidden border border-text/10'
                    >
                        <div className='p-6 md:p-8 overflow-y-auto custom-scrollbar relative'>
                            <div className='flex flex-col items-center gap-6'>
                                {/* Close Button */}
                                <button
                                    onClick={onClose}
                                    className='absolute top-4 right-4 p-2 hover:bg-text/10 rounded-lg transition-colors text-text/40 hover:text-text cursor-pointer'
                                >
                                    <XIcon className='w-5 h-5' />
                                </button>

                                {/* Title Section */}
                                <div className='text-center space-y-1'>
                                    <span className='text-xs font-medium tracking-wide uppercase text-text/50'>
                                        {existingReview
                                            ? "Edit Review"
                                            : "Write a Review"}
                                    </span>
                                    <h2 className='text-2xl md:text-3xl font-serif font-semibold text-text'>
                                        {cafeName}
                                    </h2>
                                </div>

                                {/* Rating Section */}
                                <div className='flex flex-col items-center gap-2 w-full py-4 bg-text/5 rounded-xl border border-text/10'>
                                    <span className='text-xs font-medium text-text/50 uppercase tracking-wide'>
                                        Your Rating
                                    </span>
                                    <StarRating
                                        rating={rating}
                                        onRatingChange={setRating}
                                        size='lg'
                                        totalStars={5}
                                    />
                                    <span className='text-sm font-medium text-text/60'>
                                        {rating === 0
                                            ? "Tap to rate"
                                            : rating === 5
                                              ? "Excellent!"
                                              : rating >= 4
                                                ? "Very Good"
                                                : rating >= 3
                                                  ? "Average"
                                                  : "Could be better"}
                                    </span>
                                </div>

                                {/* Review Content */}
                                <div className='w-full space-y-2'>
                                    <label className='text-sm font-medium text-text/60'>
                                        Your Review
                                    </label>
                                    <div className='relative'>
                                        <textarea
                                            value={comment}
                                            onChange={(e) =>
                                                setComment(e.target.value)
                                            }
                                            placeholder='Share your experience...'
                                            className='w-full min-h-[160px] bg-text/5 text-base leading-relaxed placeholder:text-text/30 focus:outline-none p-4 resize-none rounded-xl border border-text/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-text'
                                        />
                                        <div className='absolute bottom-3 right-3 text-xs text-text/40'>
                                            {comment.length} characters
                                        </div>
                                    </div>
                                </div>

                                {/* Photos */}
                                <div className='w-full space-y-2'>
                                    <label className='text-sm font-medium text-text/60 flex items-center gap-2'>
                                        Add Photos
                                        <span className='text-xs text-text/40'>
                                            (Optional)
                                        </span>
                                    </label>
                                    <ImageUpload
                                        value={images}
                                        onChange={setImages}
                                        disabled={isSubmitting}
                                    />
                                </div>

                                {/* Error Display */}
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className='w-full text-center text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200'
                                    >
                                        {error}
                                    </motion.div>
                                )}

                                {/* Submit Action */}
                                <div className='w-full pt-2'>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={isSubmitting}
                                        className='w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer'
                                    >
                                        {isSubmitting && (
                                            <Loader2 className='w-5 h-5 animate-spin' />
                                        )}
                                        {existingReview
                                            ? "Update Review"
                                            : "Submit Review"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
