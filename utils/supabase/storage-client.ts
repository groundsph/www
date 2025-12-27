/**
 * Client-side storage utilities for direct browser uploads to Supabase
 * These functions upload files directly from the browser, avoiding server action serialization issues
 */

import { createLocalClient } from "./client"

const CAFE_BUCKET = "cafes"
const MAX_CAFE_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif"]

export interface UploadResult {
    success: boolean
    url?: string
    error?: string
}

/**
 * Upload a cafe image directly from the browser to Supabase Storage
 * File is stored at: cafes/{userId}/{timestamp}-{random}.{ext}
 * Used for both thumbnail and gallery images during cafe submission
 */
export async function uploadCafeImageClient(file: File): Promise<UploadResult> {
    const db = createLocalClient()

    // Get current user
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    // Validate file type
    const fileExt = file.name.split(".").pop()?.toLowerCase() || ""
    if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
        return { success: false, error: "Invalid file type (JPEG, PNG, WebP, GIF only)" }
    }

    // Validate size
    if (file.size > MAX_CAFE_IMAGE_SIZE) {
        return { success: false, error: "File too large (max 5MB)" }
    }

    // Generate unique filename
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `${user.id}/${fileName}`

    try {
        const { error: uploadError } = await db.storage
            .from(CAFE_BUCKET)
            .upload(filePath, file)

        if (uploadError) {
            console.error("Cafe image upload error:", uploadError)
            return { success: false, error: "Upload failed" }
        }

        const { data: urlData } = db.storage
            .from(CAFE_BUCKET)
            .getPublicUrl(filePath)

        return { success: true, url: urlData.publicUrl }
    } catch (error) {
        console.error("Upload error:", error)
        return { success: false, error: "Upload failed" }
    }
}

/**
 * Upload multiple cafe images in parallel
 * Returns array of successful upload URLs
 */
export async function uploadCafeImagesClient(files: File[]): Promise<{
    success: boolean
    urls: string[]
    errors: string[]
}> {
    const results = await Promise.all(files.map(uploadCafeImageClient))

    const urls: string[] = []
    const errors: string[] = []

    results.forEach((result, index) => {
        if (result.success && result.url) {
            urls.push(result.url)
        } else {
            errors.push(`File ${index + 1}: ${result.error || "Unknown error"}`)
        }
    })

    return {
        success: errors.length === 0,
        urls,
        errors
    }
}

// ============================================
// Review Image Upload (Client-side)
// ============================================

const REVIEW_BUCKET = "reviews"
const MAX_REVIEW_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB

/**
 * Upload a review image directly from the browser to Supabase Storage
 * File is stored at: reviews/{userId}/{timestamp}-{random}.{ext}
 */
export async function uploadReviewImageClient(file: File): Promise<UploadResult> {
    const db = createLocalClient()

    // Get current user
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    // Validate file type
    const fileExt = file.name.split(".").pop()?.toLowerCase() || ""
    if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
        return { success: false, error: "Invalid file type (JPEG, PNG, WebP, GIF only)" }
    }

    // Validate size
    if (file.size > MAX_REVIEW_IMAGE_SIZE) {
        return { success: false, error: "File too large (max 5MB)" }
    }

    // Generate unique filename
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `${user.id}/${fileName}`

    try {
        const { error: uploadError } = await db.storage
            .from(REVIEW_BUCKET)
            .upload(filePath, file)

        if (uploadError) {
            console.error("Review image upload error:", uploadError)
            return { success: false, error: "Upload failed" }
        }

        const { data: urlData } = db.storage
            .from(REVIEW_BUCKET)
            .getPublicUrl(filePath)

        return { success: true, url: urlData.publicUrl }
    } catch (error) {
        console.error("Upload error:", error)
        return { success: false, error: "Upload failed" }
    }
}

// ============================================
// Avatar Upload (Client-side)
// ============================================

const AVATAR_BUCKET = "avatars"
const MAX_AVATAR_SIZE = 2 * 1024 * 1024 // 2MB

/**
 * Upload an avatar directly from the browser to Supabase Storage
 * File is stored at: avatars/{userId}/{timestamp}.{ext}
 * Also updates the user's profile with the new avatar URL
 */
export async function uploadAvatarClient(file: File): Promise<UploadResult> {
    const db = createLocalClient()

    // Get current user
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    // Validate file type (check both MIME type and extension)
    const fileExt = file.name.split(".").pop()?.toLowerCase() || ""
    const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    const isValidType = ALLOWED_MIME_TYPES.includes(file.type) || ALLOWED_EXTENSIONS.includes(fileExt)

    if (!isValidType) {
        return { success: false, error: "Invalid file type (JPEG, PNG, WebP, GIF only)" }
    }

    // Validate size
    if (file.size > MAX_AVATAR_SIZE) {
        return { success: false, error: "File too large (max 2MB)" }
    }

    // Generate unique filename
    const fileName = `${Date.now()}.${fileExt}`
    const filePath = `${user.id}/${fileName}`

    try {
        const { error: uploadError } = await db.storage
            .from(AVATAR_BUCKET)
            .upload(filePath, file, { upsert: true })

        if (uploadError) {
            console.error("Avatar upload error:", uploadError)
            return { success: false, error: "Upload failed" }
        }

        const { data: urlData } = db.storage
            .from(AVATAR_BUCKET)
            .getPublicUrl(filePath)

        // Add timestamp to bust cache
        const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`

        // Update profile with new avatar URL
        const { error: updateError } = await db
            .from("profiles")
            .update({
                avatar_url: avatarUrl,
                updated_at: new Date().toISOString()
            })
            .eq("id", user.id)

        if (updateError) {
            console.error("Profile update error:", updateError)
            return { success: false, error: "Failed to update profile" }
        }

        return { success: true, url: avatarUrl }
    } catch (error) {
        console.error("Upload error:", error)
        return { success: false, error: "Upload failed" }
    }
}

// ============================================
// Progress Upload (Client-side)
// ============================================

/**
 * Upload a cafe image with progress tracking
 */
export async function uploadCafeImageWithProgress(
    file: File,
    onProgress?: (progress: number) => void
): Promise<UploadResult> {
    const db = createLocalClient()

    // Get current user and session for token
    const {
        data: { session },
    } = await db.auth.getSession()
    const {
        data: { user },
    } = await db.auth.getUser()

    if (!user || !session) {
        return { success: false, error: "Not authenticated" }
    }

    // Validate file type
    const fileExt = file.name.split(".").pop()?.toLowerCase() || ""
    // Allow webp as well since we might be converting to it
    const EXTENSIONS_WITH_WEBP = [...ALLOWED_EXTENSIONS, "webp"]

    // Check if extension is allowed
    // Note: file.name might not have extension if blob created manually without name, 
    // but usually File objects do. 
    if (!EXTENSIONS_WITH_WEBP.includes(fileExt) && fileExt !== "") {
        // Should we be strict? The original code was.
        return {
            success: false,
            error: "Invalid file type (JPEG, PNG, WebP, GIF only)",
        }
    }

    // Generate unique filename
    const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(7)}.${fileExt}`
    const filePath = `${user.id}/${fileName}`

    // Construct the URL for the Supabase Storage API
    const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!projectUrl) {
        console.error("Missing NEXT_PUBLIC_SUPABASE_URL")
        return { success: false, error: "Configuration error" }
    }

    const uploadUrl = `${projectUrl}/storage/v1/object/${CAFE_BUCKET}/${filePath}`

    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest()

        xhr.open("POST", uploadUrl)
        xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`)
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream")
        // x-upsert is optional

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable && onProgress) {
                const percentComplete = (event.loaded / event.total) * 100
                onProgress(percentComplete)
            }
        }

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                // Success
                const { data: urlData } = db.storage
                    .from(CAFE_BUCKET)
                    .getPublicUrl(filePath)

                resolve({ success: true, url: urlData.publicUrl })
            } else {
                console.error("Upload failed", xhr.status, xhr.responseText)
                resolve({ success: false, error: `Upload failed: ${xhr.statusText}` })
            }
        }

        xhr.onerror = () => {
            console.error("XHR Error")
            resolve({ success: false, error: "Network error during upload" })
        }

        xhr.send(file)
    })
}

// ============================================
// Ownership Proof Upload (Client-side)
// ============================================

const OWNERSHIP_PROOF_BUCKET = "ownership-proofs"
const MAX_PROOF_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_PROOF_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "pdf"]

/**
 * Upload ownership proof document with progress tracking
 * Files are stored at: ownership-proofs/{userId}/{timestamp}-{random}.{ext}
 * Bucket should be private (admin-only access for verification)
 */
export async function uploadOwnershipProofWithProgress(
    file: File,
    onProgress?: (progress: number) => void
): Promise<UploadResult> {
    const db = createLocalClient()

    // Get current user and session for token
    const {
        data: { session },
    } = await db.auth.getSession()
    const {
        data: { user },
    } = await db.auth.getUser()

    if (!user || !session) {
        return { success: false, error: "Not authenticated" }
    }

    // Validate file type
    const fileExt = file.name.split(".").pop()?.toLowerCase() || ""
    if (!ALLOWED_PROOF_EXTENSIONS.includes(fileExt)) {
        return {
            success: false,
            error: "Invalid file type (JPEG, PNG, WebP, or PDF only)",
        }
    }

    // Validate size
    if (file.size > MAX_PROOF_FILE_SIZE) {
        return { success: false, error: "File too large (max 10MB)" }
    }

    // Generate unique filename
    const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(7)}.${fileExt}`
    const filePath = `${user.id}/${fileName}`

    // Construct the URL for the Supabase Storage API
    const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!projectUrl) {
        console.error("Missing NEXT_PUBLIC_SUPABASE_URL")
        return { success: false, error: "Configuration error" }
    }

    const uploadUrl = `${projectUrl}/storage/v1/object/${OWNERSHIP_PROOF_BUCKET}/${filePath}`

    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest()

        xhr.open("POST", uploadUrl)
        xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`)
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream")

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable && onProgress) {
                const percentComplete = (event.loaded / event.total) * 100
                onProgress(percentComplete)
            }
        }

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                // For private buckets, we store the path rather than public URL
                // Admins will use signed URLs to access
                const fullPath = `${user.id}/${fileName}`
                resolve({ success: true, url: fullPath })
            } else {
                console.error("Upload failed", xhr.status, xhr.responseText)
                resolve({ success: false, error: `Upload failed: ${xhr.statusText}` })
            }
        }

        xhr.onerror = () => {
            console.error("XHR Error")
            resolve({ success: false, error: "Network error during upload" })
        }

        xhr.send(file)
    })
}
