/**
 * Client-side image processing utilities using browser-image-compression
 *
 * Image types and their compression settings:
 * - Cover images (cafe thumbnails): WebP, 300KB, 1920px
 * - Gallery images: WebP, 200KB, 1920px
 * - Review images: WebP, 250KB, 1920px
 * - Blog/Event covers: JPEG, 200KB, 1920px (display in list cards)
 * - Collection covers: JPEG, 150KB, 1200px (for OG images)
 * - Profile avatars: JPEG, 100KB, 400px (for OG images)
 */

import imageCompression from "browser-image-compression"

// ============================================================================
// Cafe Cover Image (Hero/Thumbnail)
// ============================================================================

/**
 * Compress a cover image for cafe hero/thumbnails.
 * @returns Compressed File (WebP, max 300KB, max 1920px)
 */
export async function compressCoverImage(file: File): Promise<File> {
    const compressed = await imageCompression(file, {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: "image/webp",
        initialQuality: 0.9,
    })

    return new File(
        [compressed],
        file.name.replace(/\.[^/.]+$/, "") + ".webp",
        { type: "image/webp", lastModified: Date.now() }
    )
}

// ============================================================================
// Gallery Images
// ============================================================================

/**
 * Compress a gallery image for cafe galleries.
 * @returns Compressed File (WebP, max 200KB, max 1920px)
 */
export async function compressGalleryImage(file: File): Promise<File> {
    const compressed = await imageCompression(file, {
        maxSizeMB: 0.2,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: "image/webp",
        initialQuality: 0.85,
    })

    return new File(
        [compressed],
        file.name.replace(/\.[^/.]+$/, "") + ".webp",
        { type: "image/webp", lastModified: Date.now() }
    )
}

// ============================================================================
// Review Images
// ============================================================================

/**
 * Compress a review image.
 * @returns Compressed File (WebP, max 250KB, max 1920px)
 */
export async function compressReviewImage(file: File): Promise<File> {
    const compressed = await imageCompression(file, {
        maxSizeMB: 0.25,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: "image/webp",
        initialQuality: 0.85,
    })

    return new File(
        [compressed],
        file.name.replace(/\.[^/.]+$/, "") + ".webp",
        { type: "image/webp", lastModified: Date.now() }
    )
}

// ============================================================================
// Blog/Event Cover Images (used in OG images, list cards)
// ============================================================================

/**
 * Compress a blog or event cover image.
 * Uses JPEG for wider compatibility in social previews.
 * @returns Compressed File (JPEG, max 200KB, max 1920px)
 */
export async function compressBlogCover(file: File): Promise<File> {
    const compressed = await imageCompression(file, {
        maxSizeMB: 0.2,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: "image/jpeg",
        initialQuality: 0.85,
    })

    return new File(
        [compressed],
        file.name.replace(/\.[^/.]+$/, "") + ".jpg",
        { type: "image/jpeg", lastModified: Date.now() }
    )
}

// Alias for event covers
export const compressEventCover = compressBlogCover

// ============================================================================
// Collection Covers (used in OG images via Satori)
// ============================================================================

/**
 * Compress a collection cover image.
 * Uses JPEG for Satori OG image compatibility.
 * @returns Compressed File (JPEG, max 150KB, max 1200px)
 */
export async function compressCollectionCover(file: File): Promise<File> {
    const compressed = await imageCompression(file, {
        maxSizeMB: 0.15,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
        fileType: "image/jpeg",
        initialQuality: 0.85,
    })

    return new File(
        [compressed],
        file.name.replace(/\.[^/.]+$/, "") + ".jpg",
        { type: "image/jpeg", lastModified: Date.now() }
    )
}

// ============================================================================
// Profile Avatars (used in OG images via Satori)
// ============================================================================

/**
 * Compress a profile avatar image.
 * Uses JPEG for Satori OG image compatibility.
 * @returns Compressed File (JPEG, max 100KB, max 400px)
 */
export async function compressAvatar(file: File): Promise<File> {
    const compressed = await imageCompression(file, {
        maxSizeMB: 0.1,
        maxWidthOrHeight: 400,
        useWebWorker: true,
        fileType: "image/jpeg",
        initialQuality: 0.9,
    })

    return new File(
        [compressed],
        file.name.replace(/\.[^/.]+$/, "") + ".jpg",
        { type: "image/jpeg", lastModified: Date.now() }
    )
}

// ============================================================================
// Legacy functions (kept for backward compatibility)
// ============================================================================

interface ResizeOptions {
    maxWidth: number
    maxHeight: number
    quality?: number
    format?: "image/jpeg" | "image/webp" | "image/png"
}

/**
 * @deprecated Use the specific compress functions instead.
 */
export async function resizeImage(
    file: File,
    options: ResizeOptions
): Promise<File> {
    const {
        maxWidth,
        maxHeight,
        quality = 0.8,
        format = "image/webp",
    } = options

    const compressed = await imageCompression(file, {
        maxWidthOrHeight: Math.max(maxWidth, maxHeight),
        useWebWorker: true,
        fileType: format,
        initialQuality: quality,
    })

    const ext = format === "image/webp" ? ".webp" : format === "image/jpeg" ? ".jpg" : ".png"

    return new File(
        [compressed],
        file.name.replace(/\.[^/.]+$/, "") + ext,
        { type: format, lastModified: Date.now() }
    )
}

interface CropResizeOptions {
    targetAspectRatio?: number
    maxWidth: number
    maxHeight: number
    quality?: number
    format?: "image/jpeg" | "image/webp" | "image/png"
}

/**
 * @deprecated Use compressCoverImage after cropping with ImageCropper instead.
 */
export async function cropAndResizeImage(
    file: File,
    options: CropResizeOptions
): Promise<File> {
    return new Promise((resolve, reject) => {
        const {
            maxWidth,
            maxHeight,
            quality = 0.8,
            format = "image/webp",
        } = options

        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = (event) => {
            const img = new Image()
            img.src = event.target?.result as string
            img.onload = async () => {
                const srcWidth = img.width
                const srcHeight = img.height
                const srcAspectRatio = srcWidth / srcHeight
                const targetAspectRatio = options.targetAspectRatio || srcAspectRatio

                let cropWidth: number, cropHeight: number, cropX: number, cropY: number

                if (srcAspectRatio > targetAspectRatio) {
                    cropHeight = srcHeight
                    cropWidth = Math.round(srcHeight * targetAspectRatio)
                    cropX = Math.round((srcWidth - cropWidth) / 2)
                    cropY = 0
                } else {
                    cropWidth = srcWidth
                    cropHeight = Math.round(srcWidth / targetAspectRatio)
                    cropX = 0
                    cropY = Math.round((srcHeight - cropHeight) / 2)
                }

                let outputWidth = cropWidth, outputHeight = cropHeight

                if (outputWidth > maxWidth) {
                    outputHeight = Math.round((outputHeight * maxWidth) / outputWidth)
                    outputWidth = maxWidth
                }
                if (outputHeight > maxHeight) {
                    outputWidth = Math.round((outputWidth * maxHeight) / outputHeight)
                    outputHeight = maxHeight
                }

                const canvas = document.createElement("canvas")
                canvas.width = outputWidth
                canvas.height = outputHeight

                const ctx = canvas.getContext("2d")
                if (!ctx) {
                    reject(new Error("Failed to get canvas context"))
                    return
                }

                ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, outputWidth, outputHeight)

                canvas.toBlob(
                    async (blob) => {
                        if (!blob) {
                            reject(new Error("Failed to create blob"))
                            return
                        }

                        try {
                            const tempFile = new File([blob], file.name, { type: format })
                            const compressed = await imageCompression(tempFile, {
                                maxSizeMB: format === "image/jpeg" ? 0.25 : 0.12,
                                useWebWorker: true,
                                fileType: format,
                                initialQuality: quality,
                            })

                            const ext = format === "image/webp" ? ".webp" : format === "image/jpeg" ? ".jpg" : ".png"
                            const newFile = new File(
                                [compressed],
                                file.name.replace(/\.[^/.]+$/, "") + ext,
                                { type: format, lastModified: Date.now() }
                            )
                            resolve(newFile)
                        } catch (err) {
                            reject(err)
                        }
                    },
                    format,
                    quality
                )
            }
            img.onerror = (error) => reject(error)
        }
        reader.onerror = (error) => reject(error)
    })
}
