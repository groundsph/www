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
