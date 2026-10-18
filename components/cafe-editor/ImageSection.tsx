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
    Download,
} from "lucide-react"
import {
    type ColorScheme,
    getColorClasses,
    moveArrayItem,
} from "@/utils/hooks/cafe-form"
import { useCoverImageUpload } from "@/utils/hooks/useCoverImageUpload"
import { compressBadgeStamp } from "@/utils/image-processing"
import { useImageUploadQueue } from "@/utils/hooks/useImageUploadQueue"
import { MAX_CAFE_GALLERY } from "@/utils/validation/cafe-images"
import { useNotification } from "@/components/layout/NotificationProvider"
import { useConfirm } from "@/hooks/useConfirm"
import { uploadCafeBadgeStamp } from "@/utils/storage/client"
import { getCafeThumbnailUrl } from "@/utils/extras"
import { getOptimizedImageUrl, getResponsiveSrcSet } from "@/utils/cloudflare-image"
import { downloadImage } from "@/utils/image-download"
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
    /** Update gallery order */
    onGalleryChange: (urls: string[]) => void
    /** Delete a gallery image; the caller persists first, then removes the file */
    onDeleteImage: (url: string, index: number) => Promise<void>
    /** Clear the cover image; the caller persists first, then removes the file */
    onRemoveCoverImage?: () => Promise<void>
    /** A single finished upload, so the caller can append it to its own state */
    onImageUploaded?: (url: string) => void
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
    onRemoveCoverImage,
    onImageUploaded,
    colorScheme = "primary",
    badgeStampUrl,
    onBadgeStampChange,
}: ImageSectionProps) {
    const colors = getColorClasses(colorScheme)
    const [uploadingBadgeStamp, setUploadingBadgeStamp] = useState(false)
    const { addNotification } = useNotification()
    const { confirm, dialog } = useConfirm()

    // Gallery uploads: compress, upload with progress, keep failures retryable
    const uploadQueue = useImageUploadQueue({
        purpose: "cafe-gallery",
        cafeId,
        maxFiles: MAX_CAFE_GALLERY - gallery.length,
        onComplete: ({ url }) => onImageUploaded?.(url),
        onReject: (fileName, reason) => {
            console.warn(`Rejected ${fileName}: ${reason}`)
        },
    })

    const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        uploadQueue.enqueue(Array.from(e.target.files || []))
        e.target.value = ""
    }

    // Use the shared cover image upload hook.
    // No onDelete here on purpose: replacing a cover must not delete the old file
    // until the new URL is persisted. useCafeImages owns that deferred deletion.
    const coverImage = useCoverImageUpload({
        currentThumbnail: thumbnail,
        cafeId,
        onUpdate: onThumbnailChange,
    })

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

    // Handle gallery image removal (the caller persists, then deletes the file)
    const handleRemoveGalleryImage = async (index: number) => {
        if (!(await confirm({
            title: "Remove this image?",
            description: "The file is deleted from storage once the removal is saved.",
            confirmLabel: "Remove",
            destructive: true,
        }))) return
        await onDeleteImage(gallery[index], index)
    }

    // Handle cover image removal (the caller persists, then deletes the file)
    const handleRemoveCover = async () => {
        if (!(await confirm({
            title: "Remove cover image?",
            description: "This cafe will show the placeholder cover until you upload a new one.",
            confirmLabel: "Remove",
            destructive: true,
        }))) return
        if (onRemoveCoverImage) {
            await onRemoveCoverImage()
        }
    }

    // Handle badge stamp upload
    const handleBadgeStampUpload = async (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = e.target.files?.[0]
        if (!file || !onBadgeStampChange) return

        // Validate file type (PNG only)
        if (file.type !== "image/png") {
            addNotification("Please upload a PNG file only", "error")
            e.target.value = ""
            return
        }

        // Validate file size (max 500KB)
        if (file.size > 500 * 1024) {
            addNotification("File size must be less than 500KB", "error")
            e.target.value = ""
            return
        }

        setUploadingBadgeStamp(true)
        const processed = await compressBadgeStamp(file)
        const result = await uploadCafeBadgeStamp(processed, cafeId)
        if (result.success && result.url) {
            onBadgeStampChange(result.url)
        } else {
            addNotification(result.error || "Failed to upload badge stamp", "error")
        }
        setUploadingBadgeStamp(false)
        e.target.value = ""
    }

    // Handle badge stamp removal
    const handleRemoveBadgeStamp = async () => {
        if (!(await confirm({ title: "Remove badge stamp?", confirmLabel: "Remove", destructive: true }))) return
        if (badgeStampUrl && onBadgeStampChange) {
            onBadgeStampChange(null)
        }
    }

    const handleDownloadThumbnail = () => {
        if (thumbnail) {
            downloadImage(thumbnail, `${cafeName}-thumbnail`).catch((error) => {
                console.error("Failed to download thumbnail:", error)
            })
        }
    }

    const handleDownloadGalleryImage = (url: string, index: number) => {
        downloadImage(url, `${cafeName}-gallery-${index + 1}`).catch((error) => {
            console.error("Failed to download gallery image:", error)
        })
    }

    return (
        <div className='space-y-8'>
            {dialog}
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
                                <>
                                    <button
                                        type='button'
                                        onClick={handleDownloadThumbnail}
                                        className='p-2 bg-blue-500/80 text-white rounded-lg hover:bg-blue-600 transition'
                                        title='Download image'
                                    >
                                        <Download className='w-4 h-4' />
                                    </button>
                                    <button
                                        type='button'
                                        onClick={handleRemoveCover}
                                        className='p-2 bg-red-500/80 text-white rounded-lg hover:bg-red-600 transition'
                                    >
                                        <Trash2 className='w-4 h-4' />
                                    </button>
                                </>
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
                        {uploadQueue.isBusy ? (
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
                            disabled={uploadQueue.isBusy}
                            onChange={handleGalleryUpload}
                        />
                    </label>
                </div>

                {gallery.length > 0 || uploadQueue.items.length > 0 ? (
                    <div className='flex flex-row gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-text/10'>
                    <Reorder.Group
                        axis='x'
                        values={gallery}
                        onReorder={onGalleryChange}
                        className='flex flex-row gap-4'
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

                                {/* Download Button */}
                                <button
                                    type='button'
                                    onClick={() =>
                                        handleDownloadGalleryImage(url, idx)
                                    }
                                    className='absolute top-2 left-2 p-2 bg-blue-500 text-white rounded-full md:opacity-0 group-hover:opacity-100 transition hover:bg-blue-600 z-10'
                                    title='Download image'
                                >
                                    <Download className='w-4 h-4' />
                                </button>
                            </Reorder.Item>
                        ))}
                    </Reorder.Group>

                        {/* In-flight uploads: one tile per file, with progress and retry */}
                        {uploadQueue.items.map((item) => (
                            <div
                                key={item.id}
                                className='relative h-48 w-40 shrink-0 rounded-lg overflow-hidden border border-text/10 bg-text/5'
                            >
                                <img
                                    src={item.previewUrl}
                                    alt={item.fileName}
                                    className='absolute inset-0 h-full w-full object-cover opacity-30'
                                />
                                <div className='absolute inset-0 flex flex-col items-center justify-center gap-1 p-2 text-center'>
                                    {item.status === "error" ? (
                                        <>
                                            <span className='text-[11px] leading-tight text-red-600'>
                                                {item.error}
                                            </span>
                                            <div className='flex gap-1'>
                                                <button
                                                    type='button'
                                                    onClick={() => uploadQueue.retry(item.id)}
                                                    className='rounded bg-background px-2 py-1 text-[11px]'
                                                >
                                                    Retry
                                                </button>
                                                <button
                                                    type='button'
                                                    onClick={() => uploadQueue.dismiss(item.id)}
                                                    className='rounded bg-background px-2 py-1 text-[11px]'
                                                >
                                                    Dismiss
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <span className='w-full truncate text-[11px] text-text/70'>
                                                {item.fileName}
                                            </span>
                                            <span className='text-[11px] font-medium text-text'>
                                                {item.status === "compressing"
                                                    ? "Optimising…"
                                                    : `${item.progress}%`}
                                            </span>
                                            <div className='h-1 w-16 overflow-hidden rounded-full bg-text/20'>
                                                <div
                                                    className={colors.bg}
                                                    style={{ width: `${item.progress}%` }}
                                                />
                                            </div>
                                            <button
                                                type='button'
                                                onClick={() => uploadQueue.dismiss(item.id)}
                                                className='text-[11px] text-text/50 underline'
                                            >
                                                Cancel
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
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
