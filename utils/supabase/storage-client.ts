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
