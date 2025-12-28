"use client"

/**
 * Hook for managing cover image upload with aspect ratio checking and cropping.
 * Used by CafeEditor, CafeEditClient, SuggestEditModal, and CafeSubmissionForm.
 */

import { useState, useCallback } from "react"
import { checkAspectRatio } from "./cafe-form"
import { resizeImage } from "@/utils/image-processing"
import { uploadCafeImageClient } from "@/utils/supabase/storage-client"

interface UseCoverImageUploadOptions {
    /** Current thumbnail URL (for replacement/deletion) */
    currentThumbnail: string | null
    /** Cafe ID (required for owner delete actions) */
    cafeId?: string
    /** Callback when thumbnail is updated */
    onUpdate: (url: string) => void
    /** Optional callback for deleting old thumbnail */
    onDelete?: (url: string) => Promise<void>
    /** Optional error handler */
    onError?: (error: string) => void
}

interface UseCoverImageUploadReturn {
    /** Whether upload is in progress */
    uploading: boolean
    /** Whether the cropper modal is open */
    cropperOpen: boolean
    /** The file being cropped (for ImageCropper) */
    croppingImage: File | null
    /** Handle file input change - checks aspect ratio and either uploads or opens cropper */
    handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>
    /** Handle crop completion - uploads the cropped blob */
    handleCropComplete: (croppedBlob: Blob) => Promise<void>
    /** Close the cropper without saving */
    closeCropper: () => void
}

/**
 * Hook for managing cover image upload with automatic aspect ratio detection and cropping.
 * 
 * If the selected image is already 16:9, it uploads directly.
 * Otherwise, it opens the cropper for the user to adjust.
 * 
 * @example
 * ```tsx
 * const coverImage = useCoverImageUpload({
 *   currentThumbnail: cafe.thumbnail,
 *   cafeId: cafe.id,
 *   onUpdate: (url) => updateField("thumbnail", url),
 *   onDelete: async (url) => await deleteCafeImageAsOwner(cafe.id, url),
 *   onError: (err) => addNotification(err, "error"),
 * })
 * 
 * // In JSX:
 * <input type="file" onChange={coverImage.handleFileChange} disabled={coverImage.uploading} />
 * {coverImage.cropperOpen && (
 *   <ImageCropper
 *     imageSrc={URL.createObjectURL(coverImage.croppingImage!)}
 *     onCropComplete={coverImage.handleCropComplete}
 *     onCancel={coverImage.closeCropper}
 *   />
 * )}
 * ```
 */
export function useCoverImageUpload(
    options: UseCoverImageUploadOptions
): UseCoverImageUploadReturn {
    const { currentThumbnail, onUpdate, onDelete, onError } = options

    const [uploading, setUploading] = useState(false)
    const [cropperOpen, setCropperOpen] = useState(false)
    const [croppingImage, setCroppingImage] = useState<File | null>(null)

    const handleFileChange = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0]
            if (!file) return

            const is16by9 = await checkAspectRatio(file)

            if (is16by9) {
                // Image is already 16:9, upload directly
                setUploading(true)
                const result = await uploadCafeImageClient(file)
                setUploading(false)

                if (result.success && result.url) {
                    // Delete old thumbnail if exists and onDelete is provided
                    if (currentThumbnail && onDelete) {
                        await onDelete(currentThumbnail)
                    }
                    onUpdate(result.url)
                } else {
                    onError?.(result.error || "Failed to upload image")
                }
            } else {
                // Open cropper for aspect ratio adjustment
                setCroppingImage(file)
                setCropperOpen(true)
            }

            // Reset the input so the same file can be selected again
            e.target.value = ""
        },
        [currentThumbnail, onUpdate, onDelete, onError]
    )

    const handleCropComplete = useCallback(
        async (croppedBlob: Blob) => {
            const file = new File(
                [croppedBlob],
                croppingImage?.name || "cover.webp",
                {
                    type: "image/webp",
                    lastModified: Date.now(),
                }
            )

            // Resize if needed (max 2560x1440 for cover images)
            const finalFile = await resizeImage(file, {
                maxWidth: 2560,
                maxHeight: 1440,
                quality: 0.9,
                format: "image/webp",
            })

            setUploading(true)
            const result = await uploadCafeImageClient(finalFile)
            setUploading(false)

            if (result.success && result.url) {
                // Delete old thumbnail if exists and onDelete is provided
                if (currentThumbnail && onDelete) {
                    await onDelete(currentThumbnail)
                }
                onUpdate(result.url)
            } else {
                onError?.(result.error || "Failed to upload image")
            }

            setCropperOpen(false)
            setCroppingImage(null)
        },
        [croppingImage, currentThumbnail, onUpdate, onDelete, onError]
    )

    const closeCropper = useCallback(() => {
        setCropperOpen(false)
        setCroppingImage(null)
    }, [])

    return {
        uploading,
        cropperOpen,
        croppingImage,
        handleFileChange,
        handleCropComplete,
        closeCropper,
    }
}
