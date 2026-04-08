"use client"

/* eslint-disable @next/next/no-img-element */

/**
 * ImageSection - Shared component for cafe image management.
 * Used by CafeEditor (admin) and CafeEditClient (owner).
 */

import { useState } from "react"
import Image from "next/image"
import { Reorder } from "motion/react"
import {
    ImagePlus,
    Trash2,
    Upload,
    Loader2,
    ChevronLeft,
    ChevronRight,
    X,
} from "lucide-react"
import {
    type ColorScheme,
    getColorClasses,
    moveArrayItem,
} from "@/utils/hooks/cafe-form"
import { useCoverImageUpload } from "@/utils/hooks/useCoverImageUpload"
import { compressGalleryImage } from "@/utils/image-processing"
import { uploadCafeImage, uploadCafeBadgeStamp } from "@/utils/storage/client"
import { getCafeThumbnailUrl } from "@/utils/extras"
import { getOptimizedImageUrl, getResponsiveSrcSet } from "@/utils/cloudflare-image"
import ImageCropper from "@/components/ui/ImageCropper"

interface ImageSectionProps {
    /** Current thumbnail URL */
    thumbnail: string | null
    /** Current gallery URLs */
    gallery: string[]
    /** Cafe ID (for delete operations) */
    cafeId: string
    /** Cafe name (for alt text) */
    cafeName: string
    /** Update thumbnail */
    onThumbnailChange: (url: string | null) => void
    /** Update gallery */
    onGalleryChange: (urls: string[]) => void
    /** Delete image action (admin vs owner have different actions) */
    onDeleteImage: (url: string) => Promise<void>
    /** Color scheme for theming */
    colorScheme?: ColorScheme
    /** Current badge stamp URL (optional) */
    badgeStampUrl?: string | null
    /** Update badge stamp */
    onBadgeStampChange?: (url: string | null) => void
}

/**
 * Image management section for cafe editing.
 * Includes cover image upload with cropping and gallery with drag-to-reorder.
 */
export default function ImageSection({
    thumbnail,
    gallery,
    cafeId,
    cafeName,
    onThumbnailChange,
    onGalleryChange,
    onDeleteImage,
    colorScheme = "primary",
    badgeStampUrl,
    onBadgeStampChange,
}: ImageSectionProps) {
    const colors = getColorClasses(colorScheme)
    const [uploadingGallery, setUploadingGallery] = useState(false)
    const [uploadingBadgeStamp, setUploadingBadgeStamp] = useState(false)

    // Use the shared cover image upload hook
    const coverImage = useCoverImageUpload({
        currentThumbnail: thumbnail,
        cafeId,
        onUpdate: onThumbnailChange,
        onDelete: onDeleteImage,
    })

    // Handle gallery image upload
    const handleGalleryUpload = async (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const files = Array.from(e.target.files || [])
        if (files.length === 0) return

        setUploadingGallery(true)
        const newUrls: string[] = []

        for (const file of files) {
            // Compress gallery image (120KB WebP)
            const processedFile = await compressGalleryImage(file)
            const result = await uploadCafeImage(processedFile)
            if (result.success && result.url) {
                newUrls.push(result.url)
            }
        }

        if (newUrls.length > 0) {
            onGalleryChange([...gallery, ...newUrls])
        }

        setUploadingGallery(false)
        e.target.value = ""
    }

    // Handle gallery reorder via buttons (fallback for non-drag)
    const handleMoveGalleryImage = (
        index: number,
        direction: "left" | "right"
    ) => {
        const newGallery = moveArrayItem(gallery, index, direction)
        if (newGallery !== gallery) {
            onGalleryChange(newGallery)
        }
    }

    // Handle gallery image removal
    const handleRemoveGalleryImage = async (index: number) => {
        if (!confirm("Remove this image?")) return
        const url = gallery[index]
        await onDeleteImage(url)
        onGalleryChange(gallery.filter((_, i) => i !== index))
    }

    // Handle cover image removal
    const handleRemoveCover = async () => {
        if (!confirm("Remove cover image?")) return
        if (thumbnail) {
            await onDeleteImage(thumbnail)
        }
        onThumbnailChange(null)
    }

    // Handle badge stamp upload
    const handleBadgeStampUpload = async (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = e.target.files?.[0]
        if (!file || !onBadgeStampChange) return

        // Validate file type (PNG only)
        if (file.type !== "image/png") {
            alert("Please upload a PNG file only")
            e.target.value = ""
            return
        }

        // Validate file size (max 500KB)
        if (file.size > 500 * 1024) {
            alert("File size must be less than 500KB")
            e.target.value = ""
            return
        }

        setUploadingBadgeStamp(true)
        const result = await uploadCafeBadgeStamp(file, cafeId)
        if (result.success && result.url) {
            onBadgeStampChange(result.url)
        } else {
            alert(result.error || "Failed to upload badge stamp")
        }
        setUploadingBadgeStamp(false)
        e.target.value = ""
    }

    // Handle badge stamp removal
    const handleRemoveBadgeStamp = async () => {
        if (!confirm("Remove badge stamp?")) return
        if (badgeStampUrl && onBadgeStampChange) {
            onBadgeStampChange(null)
        }
    }

    return (
        <div className='space-y-8'>
            {/* Cover Image */}
            <div>
                <label className='block text-sm font-medium text-text/60 mb-4'>
                    Cover Image
                </label>
                <div className='relative group'>
                    <div className='relative h-auto aspect-video rounded-xl overflow-hidden bg-text/10'>
                        {thumbnail ? (
                            <>
                                <Image
                                    src={getCafeThumbnailUrl(thumbnail)}
                                    alt={cafeName}
                                    fill
                                    className='object-cover'
                                />
                                {thumbnail === "placeholder" && (
                                    <div className='absolute top-3 left-3 px-2 py-1 bg-amber-500/90 text-white text-xs font-medium rounded z-10'>
                                        Placeholder Image
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className='w-full h-full flex items-center justify-center text-text opacity-30'>
                                <ImagePlus className='w-12 h-12' />
                            </div>
                        )}

                        {/* Overlay with actions */}
                        <div className='absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-4'>
                            <label
                                className={`cursor-pointer flex items-center gap-2 px-4 py-2 ${colors.bg} text-white rounded-lg hover:opacity-80 transition`}
                            >
                                {coverImage.uploading ? (
                                    <Loader2 className='w-4 h-4 animate-spin' />
                                ) : (
                                    <Upload className='w-4 h-4' />
                                )}
                                {thumbnail ? "Change" : "Upload"}
                                <input
                                    type='file'
                                    accept='image/jpeg,image/png,image/webp,image/gif'
                                    className='hidden'
                                    disabled={coverImage.uploading}
                                    onChange={coverImage.handleFileChange}
                                />
                            </label>

                            {thumbnail && (
                                <button
                                    type='button'
                                    onClick={handleRemoveCover}
                                    className='p-2 bg-red-500/80 text-white rounded-lg hover:bg-red-600 transition'
                                >
                                    <Trash2 className='w-4 h-4' />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Gallery */}
            <div>
                <div className='flex items-center justify-between mb-4'>
                    <label className='text-sm font-medium text-text/60'>
                        Gallery ({gallery.length} images)
                    </label>
                    <label
                        className={`cursor-pointer flex items-center gap-2 px-4 py-2 ${colors.bgLight} ${colors.text} rounded-lg hover:opacity-80 transition`}
                    >
                        {uploadingGallery ? (
                            <Loader2 className='w-4 h-4 animate-spin' />
                        ) : (
                            <ImagePlus className='w-4 h-4' />
                        )}
                        Add Photos
                        <input
                            type='file'
                            accept='image/jpeg,image/png,image/webp,image/gif'
                            multiple
                            className='hidden'
                            disabled={uploadingGallery}
                            onChange={handleGalleryUpload}
                        />
                    </label>
                </div>

                {gallery.length > 0 ? (
                    <Reorder.Group
                        axis='x'
                        values={gallery}
                        onReorder={onGalleryChange}
                        className='flex flex-row gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-text/10'
                    >
                        {gallery.map((url, idx) => (
                            <Reorder.Item
                                key={url}
                                value={url}
                                className='relative h-48 w-auto shrink-0 rounded-lg overflow-hidden group cursor-move active:cursor-grabbing bg-gray-50 flex items-center justify-center border border-text/10'
                            >
                                <img
                                    src={getOptimizedImageUrl(url, { width: 1024 })}
                                    srcSet={getResponsiveSrcSet(url)}
                                    alt={`Gallery ${idx + 1}`}
                                    className='h-full w-auto object-contain pointer-events-none max-w-none'
                                />

                                {/* Move Controls */}
                                <div className='absolute bottom-2 left-2 right-2 flex justify-between md:opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-full px-2 py-1 backdrop-blur-sm z-10'>
                                    <button
                                        type='button'
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleMoveGalleryImage(idx, "left")
                                        }}
                                        className={`p-1 text-white hover:text-white/80 transition ${idx === 0 ? "opacity-20 cursor-not-allowed" : ""}`}
                                        disabled={idx === 0}
                                        title='Move left'
                                    >
                                        <ChevronLeft className='w-4 h-4' />
                                    </button>
                                    <button
                                        type='button'
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleMoveGalleryImage(idx, "right")
                                        }}
                                        className={`p-1 text-white hover:text-white/80 transition ${idx === gallery.length - 1 ? "opacity-20 cursor-not-allowed" : ""}`}
                                        disabled={idx === gallery.length - 1}
                                        title='Move right'
                                    >
                                        <ChevronRight className='w-4 h-4' />
                                    </button>
                                </div>

                                {/* Delete Button */}
                                <button
                                    type='button'
                                    onClick={() =>
                                        handleRemoveGalleryImage(idx)
                                    }
                                    className='absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full md:opacity-0 group-hover:opacity-100 transition hover:bg-red-600 z-10'
                                    title='Remove image'
                                >
                                    <X className='w-4 h-4' />
                                </button>
                            </Reorder.Item>
                        ))}
                    </Reorder.Group>
                ) : (
                    <div className='bg-text/5 border border-text/10 border-dashed rounded-xl p-12 text-center text-text/40'>
                        <ImagePlus className='w-12 h-12 mx-auto mb-4 opacity-50' />
                        <p>No gallery images yet</p>
                        <p className='text-sm mt-1'>
                            Click &quot;Add Photos&quot; to upload
                        </p>
                    </div>
                )}
            </div>

            {/* Badge Stamp */}
            {onBadgeStampChange && (
                <div>
                    <label className='block text-sm font-medium text-text/60 mb-4'>
                        Badge Stamp
                    </label>
                    <div className='relative group'>
                        <div className='relative h-48 w-48 rounded-xl overflow-hidden bg-text/10 border border-text/10'>
                            {badgeStampUrl ? (
                                <img
                                    src={badgeStampUrl}
                                    alt={`${cafeName} badge stamp`}
                                    className='w-full h-full object-contain'
                                />
                            ) : (
                                <div className='w-full h-full flex items-center justify-center text-text opacity-30'>
                                    <ImagePlus className='w-12 h-12' />
                                </div>
                            )}

                            {/* Overlay with actions */}
                            <div className='absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-4'>
                                <label
                                    className={`cursor-pointer flex items-center gap-2 px-4 py-2 ${colors.bg} text-white rounded-lg hover:opacity-80 transition`}
                                >
                                    {uploadingBadgeStamp ? (
                                        <Loader2 className='w-4 h-4 animate-spin' />
                                    ) : (
                                        <Upload className='w-4 h-4' />
                                    )}
                                    {badgeStampUrl ? "Change" : "Upload"}
                                    <input
                                        type='file'
                                        accept='image/png'
                                        className='hidden'
                                        disabled={uploadingBadgeStamp}
                                        onChange={handleBadgeStampUpload}
                                    />
                                </label>

                                {badgeStampUrl && (
                                    <button
                                        type='button'
                                        onClick={handleRemoveBadgeStamp}
                                        className='p-2 bg-red-500/80 text-white rounded-lg hover:bg-red-600 transition'
                                    >
                                        <Trash2 className='w-4 h-4' />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    <p className='mt-2 text-xs text-text/60'>
                        512x512 PNG, transparent background, max 500KB
                    </p>
                </div>
            )}

            {/* Image Cropper Modal */}
            <ImageCropper
                open={
                    coverImage.cropperOpen && coverImage.croppingImage !== null
                }
                image={coverImage.croppingImage}
                aspect={16 / 9}
                onComplete={coverImage.handleCropComplete}
                onCancel={coverImage.closeCropper}
            />
        </div>
    )
}
