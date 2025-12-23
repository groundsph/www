"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { XIcon, Loader2 } from "lucide-react"
import StarRating from "./StarRating"
import { createReview, updateReview } from "@/app/api/actions/review"
import { useRouter } from "next/navigation"
import ImageUpload from "./ImageUpload"
import { uploadReviewImage } from "@/utils/supabase/storage"

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

            // Upload new files
            if (newFiles.length > 0) {
                for (const file of newFiles) {
                    const formData = new FormData()
                    formData.append("image", file)
                    const result = await uploadReviewImage(formData)

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
        } catch (e: any) {
            setError(e.message || "An unexpected error occurred")
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
                        className='fixed inset-0 bg-black/10 z-50 backdrop-blur-sm'
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className='fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-background text-text rounded-2xl shadow-2xl z-50 flex flex-col max-h-[90vh] overflow-hidden border border-text/10'
                    >
                        <div className='p-8 md:p-12 overflow-y-auto custom-scrollbar relative'>
                            {/* Paper Texture Effect - Keeping subtle for "magazine" feel but using theme colors */}
                            <div
                                className='absolute inset-0 opacity-[0.03] pointer-events-none'
                                style={{
                                    backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`,
                                    backgroundSize: "24px 24px",
                                }}
                            />

                            <div className='relative z-10 flex flex-col items-center gap-8'>
                                {/* Close Button */}
                                <button
                                    onClick={onClose}
                                    className='absolute -top-2 -right-2 p-2 hover:bg-text/5 rounded-full transition-colors text-text/40 hover:text-text cursor-pointer'
                                >
                                    <XIcon className='w-6 h-6' />
                                </button>

                                {/* Title Section */}
                                <div className='text-center space-y-2'>
                                    <span className='text-xs font-bold tracking-widest uppercase text-text/40'>
                                        {existingReview
                                            ? "Edit Your Entry"
                                            : "New Entry"}
                                    </span>
                                    <h2 className='text-3xl md:text-4xl font-serif font-bold text-text'>
                                        {cafeName}
                                    </h2>
                                    <p className='text-text/60 font-serif italic'>
                                        How was your experience?
                                    </p>
                                </div>

                                {/* Rating Section */}
                                <div className='flex flex-col items-center gap-3 w-full py-4 border-y border-text/10'>
                                    <StarRating
                                        rating={rating}
                                        onRatingChange={setRating}
                                        size='lg'
                                        totalStars={5}
                                    />
                                    <span className='text-sm font-medium text-text/40'>
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
                                <div className='w-full space-y-4'>
                                    <div className='relative'>
                                        <textarea
                                            value={comment}
                                            onChange={(e) =>
                                                setComment(e.target.value)
                                            }
                                            placeholder='Write your story here...'
                                            className='w-full min-h-[200px] bg-transparent text-lg font-serif leading-relaxed placeholder:text-text/20 focus:outline-hidden p-0 resize-none border-b border-dashed border-text/10 focus:border-text/30 transition-colors text-text'
                                        />
                                        <div className='absolute bottom-2 right-0 text-xs text-text/30 font-mono'>
                                            {comment.length} chars
                                        </div>
                                    </div>
                                </div>

                                {/* Photos */}
                                <div className='w-full space-y-3'>
                                    <label className='text-sm font-bold uppercase tracking-wider text-text/40 flex items-center gap-2'>
                                        <span>Capture the Moment</span>
                                        <span className='text-[10px] font-normal normal-case opacity-50'>
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
                                        className='w-full text-center text-sm text-red-500 font-serif italic bg-red-500/5 p-3 rounded-lg border border-red-500/10'
                                    >
                                        "{error}"
                                    </motion.div>
                                )}

                                {/* Submit Action */}
                                <div className='w-full pt-4'>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={isSubmitting}
                                        className='group w-full py-4 bg-primary text-white rounded-lg font-bold text-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 relative overflow-hidden cursor-pointer'
                                    >
                                        <div className='absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300' />
                                        <span className='relative flex items-center gap-2'>
                                            {isSubmitting && (
                                                <Loader2 className='w-5 h-5 animate-spin' />
                                            )}
                                            {existingReview
                                                ? "Update Review"
                                                : "Publish"}
                                        </span>
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
