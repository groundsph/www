/**
 * Client-side Storage Utilities
 * 
 * These functions provide client-side wrappers for the server actions,
 * with support for progress tracking via XHR when needed.
 * 
 * For R2 uploads, files go through server actions since R2 requires
 * server-side credentials. Progress tracking is simulated during the
 * server action call.
 */

import {
    uploadCafeImageAction,
    uploadReviewImageAction,
    uploadAvatarAction,
    uploadMenuPhotoAction,
    uploadOwnershipProofAction,
    type UploadResponse,
} from "./actions"

export interface ClientUploadResult {
    success: boolean
    url?: string
    error?: string
}

// ============================================
// Server Action Wrappers with FormData
// ============================================

/**
 * Upload a cafe image via server action
 */
export async function uploadCafeImage(file: File): Promise<ClientUploadResult> {
    const formData = new FormData()
    formData.append("image", file)
    return uploadCafeImageAction(formData)
}

/**
 * Upload multiple cafe images in parallel
 */
export async function uploadCafeImages(files: File[]): Promise<{
    success: boolean
    urls: string[]
    errors: string[]
}> {
    const results = await Promise.all(files.map(f => uploadCafeImage(f)))

    const urls = results
        .filter(r => r.success && r.url)
        .map(r => r.url as string)

    const errors = results
        .filter(r => !r.success && r.error)
        .map(r => r.error as string)

    return {
        success: errors.length === 0,
        urls,
        errors,
    }
}

/**
 * Upload a review image via server action
 */
export async function uploadReviewImage(file: File): Promise<ClientUploadResult> {
    const formData = new FormData()
    formData.append("image", file)
    return uploadReviewImageAction(formData)
}

/**
 * Upload an avatar via server action
 */
export async function uploadAvatar(file: File): Promise<ClientUploadResult> {
    const formData = new FormData()
    formData.append("avatar", file)
    return uploadAvatarAction(formData)
}

/**
 * Upload a menu photo via server action
 */
export async function uploadMenuPhoto(file: File, cafeId: string): Promise<ClientUploadResult> {
    const formData = new FormData()
    formData.append("image", file)
    return uploadMenuPhotoAction(formData, cafeId)
}

/**
 * Upload an ownership proof via server action
 */
export async function uploadOwnershipProof(file: File): Promise<ClientUploadResult> {
    const formData = new FormData()
    formData.append("file", file)
    return uploadOwnershipProofAction(formData)
}

// ============================================
// Progress Upload via API Route
// For cases where progress tracking is essential
// ============================================

interface ProgressUploadOptions {
    file: File
    bucket: string
    path?: string
    cafeId?: string
    onProgress?: (progress: number) => void
}

/**
 * Upload a file with progress tracking via API route
 * 
 * This sends the file to /api/storage/upload which handles the
 * actual upload to the configured storage provider.
 */
export async function uploadWithProgress(
    options: ProgressUploadOptions
): Promise<ClientUploadResult> {
    const { file, bucket, path, cafeId, onProgress } = options

    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest()
        const formData = new FormData()

        formData.append("file", file)
        formData.append("bucket", bucket)
        if (path) formData.append("path", path)
        if (cafeId) formData.append("cafeId", cafeId)

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable && onProgress) {
                const progress = Math.round((event.loaded / event.total) * 100)
                onProgress(progress)
            }
        }

        xhr.onload = () => {
            try {
                const response = JSON.parse(xhr.responseText) as UploadResponse
                resolve(response)
            } catch {
                resolve({ success: false, error: "Failed to parse response" })
            }
        }

        xhr.onerror = () => {
            resolve({ success: false, error: "Upload failed" })
        }

        xhr.open("POST", "/api/storage/upload")
        xhr.send(formData)
    })
}

/**
 * Upload a cafe image with progress tracking
 */
export async function uploadCafeImageWithProgress(
    file: File,
    onProgress?: (progress: number) => void
): Promise<ClientUploadResult> {
    return uploadWithProgress({
        file,
        bucket: "cafes",
        onProgress,
    })
}

/**
 * Upload a menu photo with progress tracking
 */
export async function uploadMenuPhotoWithProgress(
    file: File,
    cafeId: string,
    onProgress?: (progress: number) => void
): Promise<ClientUploadResult> {
    return uploadWithProgress({
        file,
        bucket: "menu-photos",
        cafeId,
        onProgress,
    })
}

/**
 * Upload an ownership proof with progress tracking
 */
export async function uploadOwnershipProofWithProgress(
    file: File,
    onProgress?: (progress: number) => void
): Promise<ClientUploadResult> {
    return uploadWithProgress({
        file,
        bucket: "ownership-proofs",
        onProgress,
    })
}
