/**
 * Storage Helper Utilities
 * 
 * Common helper functions for file validation, path generation,
 * and other storage-related utilities.
 */

import { BUCKET_CONFIGS, STORAGE_BUCKETS, type StorageBucket } from "./types"

const IMAGE_BUCKETS: StorageBucket[] = [
    STORAGE_BUCKETS.CAFES,
    STORAGE_BUCKETS.REVIEWS,
    STORAGE_BUCKETS.AVATARS,
    STORAGE_BUCKETS.BLOGS,
    STORAGE_BUCKETS.EVENTS,
    STORAGE_BUCKETS.MENU_PHOTOS,
    STORAGE_BUCKETS.BADGES,
    STORAGE_BUCKETS.COLLECTIONS,
    STORAGE_BUCKETS.CRAWLS,
]

/**
 * Detect an image MIME type from its leading bytes.
 * Guards against a non-image file renamed to .png/.jpg.
 */
export function sniffImageMime(bytes: Uint8Array): string | null {
    const startsWith = (signature: number[]) =>
        signature.every((byte, index) => bytes[index] === byte)

    if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg"
    if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png"
    if (
        startsWith([0x52, 0x49, 0x46, 0x46]) &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    ) return "image/webp"
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return "image/gif"

    const brand = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7])
    if (brand === "ftyp") {
        const compat = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11])
        if (compat === "avif" || compat === "avis") return "image/avif"
    }

    return null
}

/**
 * Validate a file against bucket configuration.
 * Async because image buckets are verified by their content, not their name.
 */
export async function validateFile(
    file: File,
    bucket: StorageBucket
): Promise<{ valid: boolean; error?: string }> {
    const config = BUCKET_CONFIGS[bucket]
    if (!config) {
        return { valid: false, error: `Unknown bucket: ${bucket}` }
    }

    // Check file size
    if (config.maxFileSize && file.size > config.maxFileSize) {
        const maxMB = (config.maxFileSize / (1024 * 1024)).toFixed(1)
        return { valid: false, error: `File too large (max ${maxMB}MB)` }
    }

    // Check file extension
    if (config.allowedExtensions && config.allowedExtensions.length > 0) {
        const ext = file.name.split(".").pop()?.toLowerCase() || ""
        if (!config.allowedExtensions.includes(ext)) {
            return {
                valid: false,
                error: `Invalid file type. Allowed: ${config.allowedExtensions.join(", ")}`,
            }
        }
    }

    // Check MIME type if configured
    if (config.allowedMimeTypes && config.allowedMimeTypes.length > 0) {
        if (!config.allowedMimeTypes.includes(file.type)) {
            return {
                valid: false,
                error: `Invalid file type: ${file.type}`,
            }
        }
    }

    // Verify the bytes, not just the name, for image buckets
    if (IMAGE_BUCKETS.includes(bucket)) {
        const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
        const sniffed = sniffImageMime(head)
        if (!sniffed) {
            return { valid: false, error: "File content is not a recognised image" }
        }
        if (config.allowedMimeTypes && !config.allowedMimeTypes.includes(sniffed)) {
            return { valid: false, error: `Image format not allowed: ${sniffed}` }
        }
    }

    return { valid: true }
}

/**
 * Generate a unique file path for uploads
 * 
 * @param userId - User ID to namespace files
 * @param fileName - Original file name
 * @returns Path like "userId/1703913600000-abc123.jpg"
 */
export function generateFilePath(userId: string, fileName: string): string {
    const ext = fileName.split(".").pop()?.toLowerCase() || "bin"
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    return `${userId}/${timestamp}-${random}.${ext}`
}

/**
 * Generate a unique file path for cafe-scoped uploads (like menu photos)
 */
export function generateCafeFilePath(cafeId: string, fileName: string): string {
    const ext = fileName.split(".").pop()?.toLowerCase() || "bin"
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    return `${cafeId}/${timestamp}-${random}.${ext}`
}

/**
 * Generate a root-level file path (for badges, etc.)
 */
export function generateRootFilePath(fileName: string): string {
    const ext = fileName.split(".").pop()?.toLowerCase() || "bin"
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    return `${timestamp}-${random}.${ext}`
}

/**
 * Add a cache-busting query parameter to a URL
 */
export function addCacheBuster(url: string): string {
    const separator = url.includes("?") ? "&" : "?"
    return `${url}${separator}t=${Date.now()}`
}

/**
 * Remove query parameters from a URL
 */
export function stripQueryParams(url: string): string {
    return url.split("?")[0]
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Get the file extension from a filename or URL
 */
export function getFileExtension(fileNameOrUrl: string): string {
    const path = fileNameOrUrl.split("?")[0] // Remove query params
    const parts = path.split(".")
    return parts.length > 1 ? parts.pop()?.toLowerCase() || "" : ""
}

/**
 * Check if a URL is a placeholder/default image
 */
export function isPlaceholderUrl(url: string | null | undefined): boolean {
    if (!url) return true
    return url.includes("placeholder") || url.includes("default")
}
