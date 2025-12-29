/**
 * Storage Helper Utilities
 * 
 * Common helper functions for file validation, path generation,
 * and other storage-related utilities.
 */

import { BUCKET_CONFIGS, type StorageBucket } from "./types"

/**
 * Validate a file against bucket configuration
 */
export function validateFile(
    file: File,
    bucket: StorageBucket
): { valid: boolean; error?: string } {
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
