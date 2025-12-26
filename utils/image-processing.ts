/**
 * Client-side image processing utilities
 */

interface ResizeOptions {
    maxWidth: number
    maxHeight: number
    quality?: number // 0 to 1, default 0.8
    format?: "image/jpeg" | "image/webp" | "image/png"
}

/**
 * Resizes an image file client-side using HTMLCanvasElement.
 * Returns a new File object with the resized image.
 */
export async function resizeImage(
    file: File,
    options: ResizeOptions
): Promise<File> {
    return new Promise((resolve, reject) => {
        const {
            maxWidth,
            maxHeight,
            quality = 0.8,
            format = "image/webp", // Default to WebP for better compression
        } = options

        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = (event) => {
            const img = new Image()
            img.src = event.target?.result as string
            img.onload = () => {
                // Calculate new dimensions
                let width = img.width
                let height = img.height

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width)
                    width = maxWidth
                }

                if (height > maxHeight) {
                    width = Math.round((width * maxHeight) / height)
                    height = maxHeight
                }

                // Create canvas
                const canvas = document.createElement("canvas")
                canvas.width = width
                canvas.height = height

                const ctx = canvas.getContext("2d")
                if (!ctx) {
                    reject(new Error("Failed to get canvas context"))
                    return
                }

                // Draw image to canvas
                ctx.drawImage(img, 0, 0, width, height)

                // Convert to blob/file
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error("Failed to create blob"))
                            return
                        }

                        // Create new file
                        const newFile = new File(
                            [blob],
                            file.name.replace(/\.[^/.]+$/, "") +
                            (format === "image/webp"
                                ? ".webp"
                                : format === "image/jpeg"
                                    ? ".jpg"
                                    : ".png"),
                            {
                                type: format,
                                lastModified: Date.now(),
                            }
                        )
                        resolve(newFile)
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

interface CropResizeOptions {
    targetAspectRatio?: number // Optional: if undefined, preserves original aspect ratio
    maxWidth: number
    maxHeight: number
    quality?: number // 0 to 1, default 0.8
    format?: "image/jpeg" | "image/webp" | "image/png"
}

/**
 * Crops an image to a target aspect ratio (center crop) and then resizes it.
 * Returns a new File object with the cropped and resized image.
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
            img.onload = () => {
                const srcWidth = img.width
                const srcHeight = img.height
                const srcAspectRatio = srcWidth / srcHeight

                // Use provided targetAspectRatio or default to source aspect ratio (no cropping)
                const targetAspectRatio = options.targetAspectRatio || srcAspectRatio

                // Calculate crop dimensions to achieve target aspect ratio
                let cropWidth: number
                let cropHeight: number
                let cropX: number
                let cropY: number

                if (srcAspectRatio > targetAspectRatio) {
                    // Image is wider than target - crop sides
                    cropHeight = srcHeight
                    cropWidth = Math.round(srcHeight * targetAspectRatio)
                    cropX = Math.round((srcWidth - cropWidth) / 2)
                    cropY = 0
                } else {
                    // Image is taller than target - crop top/bottom
                    cropWidth = srcWidth
                    cropHeight = Math.round(srcWidth / targetAspectRatio)
                    cropX = 0
                    cropY = Math.round((srcHeight - cropHeight) / 2)
                }

                // Calculate final output dimensions (respecting max constraints)
                let outputWidth = cropWidth
                let outputHeight = cropHeight

                if (outputWidth > maxWidth) {
                    outputHeight = Math.round(
                        (outputHeight * maxWidth) / outputWidth
                    )
                    outputWidth = maxWidth
                }

                if (outputHeight > maxHeight) {
                    outputWidth = Math.round(
                        (outputWidth * maxHeight) / outputHeight
                    )
                    outputHeight = maxHeight
                }

                // Create canvas
                const canvas = document.createElement("canvas")
                canvas.width = outputWidth
                canvas.height = outputHeight

                const ctx = canvas.getContext("2d")
                if (!ctx) {
                    reject(new Error("Failed to get canvas context"))
                    return
                }

                // Draw cropped and resized image to canvas
                ctx.drawImage(
                    img,
                    cropX,
                    cropY,
                    cropWidth,
                    cropHeight,
                    0,
                    0,
                    outputWidth,
                    outputHeight
                )

                // Convert to blob/file
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error("Failed to create blob"))
                            return
                        }

                        // Create new file
                        const newFile = new File(
                            [blob],
                            file.name.replace(/\.[^/.]+$/, "") +
                            (format === "image/webp"
                                ? ".webp"
                                : format === "image/jpeg"
                                    ? ".jpg"
                                    : ".png"),
                            {
                                type: format,
                                lastModified: Date.now(),
                            }
                        )
                        resolve(newFile)
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
