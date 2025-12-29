"use server"

/**
 * New Storage Actions using Provider Abstraction
 * 
 * These actions use the storage provider interface and will upload to
 * whichever provider is configured (Supabase or R2).
 * 
 * For client-side uploads, we provide server actions that accept FormData.
 * This approach works well with R2 since credentials stay on the server.
 */

import { createClient } from "@/utils/supabase/server"
import {
    getStorageProvider,
    STORAGE_BUCKETS,
    validateFile,
    generateFilePath,
    generateCafeFilePath,
    generateRootFilePath,
    type StorageBucket,
} from "@/utils/storage"

// ============================================
// Response Types
// ============================================

export interface UploadResponse {
    success: boolean
    url?: string
    error?: string
}

export interface DeleteResponse {
    success: boolean
    error?: string
}

// ============================================
// Helper: Get authenticated user
// ============================================

async function getAuthenticatedUser() {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    return user
}

async function isUserAdmin(userId: string) {
    const db = await createClient()
    const { data: profile } = await db
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single()
    return profile && ["admin", "moderator"].includes(profile.role || "")
}

// ============================================
// Generic Upload Function
// ============================================

async function uploadFile(
    bucket: StorageBucket,
    path: string,
    file: File,
    options?: { contentType?: string }
): Promise<UploadResponse> {
    try {
        const storage = await getStorageProvider()

        const result = await storage.upload(bucket, path, file, {
            contentType: options?.contentType || file.type,
        })

        if (!result.success) {
            return { success: false, error: result.error || "Upload failed" }
        }

        return { success: true, url: result.url }
    } catch (error) {
        console.error(`[Storage] Upload error:`, error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Upload failed",
        }
    }
}

// ============================================
// Generic Delete Function
// ============================================

async function deleteFiles(
    bucket: StorageBucket,
    urls: string[]
): Promise<DeleteResponse> {
    if (urls.length === 0) {
        return { success: true }
    }

    try {
        const storage = await getStorageProvider()

        // Extract paths from URLs
        const paths = urls
            .map(url => storage.extractPathFromUrl(url, bucket))
            .filter((p): p is string => p !== null)

        if (paths.length === 0) {
            return { success: true }
        }

        const result = await storage.delete(bucket, paths)

        if (!result.success) {
            return { success: false, error: result.error }
        }

        return { success: true }
    } catch (error) {
        console.error(`[Storage] Delete error:`, error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Delete failed",
        }
    }
}

// ============================================
// Cafe Image Actions
// ============================================

/**
 * Upload a cafe image (thumbnail or gallery)
 */
export async function uploadCafeImageAction(formData: FormData): Promise<UploadResponse> {
    const user = await getAuthenticatedUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    const file = formData.get("image") as File | null
    if (!file) {
        return { success: false, error: "No file provided" }
    }

    // Validate file
    const validation = validateFile(file, STORAGE_BUCKETS.CAFES)
    if (!validation.valid) {
        return { success: false, error: validation.error }
    }

    const path = generateFilePath(user.id, file.name)
    return uploadFile(STORAGE_BUCKETS.CAFES, path, file)
}

/**
 * Delete cafe images (thumbnail + gallery)
 */
export async function deleteCafeImagesAction(
    thumbnail: string | null,
    gallery: string[] | null
): Promise<DeleteResponse> {
    const urls: string[] = []
    if (thumbnail) urls.push(thumbnail)
    if (gallery) urls.push(...gallery)

    return deleteFiles(STORAGE_BUCKETS.CAFES, urls)
}

/**
 * Delete a single cafe image
 */
export async function deleteSingleCafeImageAction(imageUrl: string): Promise<DeleteResponse> {
    if (!imageUrl) {
        return { success: false, error: "No image URL provided" }
    }
    return deleteFiles(STORAGE_BUCKETS.CAFES, [imageUrl])
}

// ============================================
// Review Image Actions
// ============================================

/**
 * Upload a review image
 */
export async function uploadReviewImageAction(formData: FormData): Promise<UploadResponse> {
    const user = await getAuthenticatedUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    const file = formData.get("image") as File | null
    if (!file) {
        return { success: false, error: "No file provided" }
    }

    const validation = validateFile(file, STORAGE_BUCKETS.REVIEWS)
    if (!validation.valid) {
        return { success: false, error: validation.error }
    }

    const path = generateFilePath(user.id, file.name)
    return uploadFile(STORAGE_BUCKETS.REVIEWS, path, file)
}

/**
 * Delete review images
 */
export async function deleteReviewImagesAction(images: string[] | null): Promise<DeleteResponse> {
    if (!images || images.length === 0) {
        return { success: true }
    }
    return deleteFiles(STORAGE_BUCKETS.REVIEWS, images)
}

// ============================================
// Avatar Actions
// ============================================

/**
 * Upload an avatar and update profile
 */
export async function uploadAvatarAction(formData: FormData): Promise<UploadResponse> {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()

    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    const file = formData.get("avatar") as File | null
    if (!file) {
        return { success: false, error: "No file provided" }
    }

    const validation = validateFile(file, STORAGE_BUCKETS.AVATARS)
    if (!validation.valid) {
        return { success: false, error: validation.error }
    }

    // Generate path with just timestamp (not random) for avatars
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"
    const path = `${user.id}/${Date.now()}.${ext}`

    const uploadResult = await uploadFile(STORAGE_BUCKETS.AVATARS, path, file)

    if (!uploadResult.success) {
        return uploadResult
    }

    // Add cache buster and update profile
    const avatarUrl = `${uploadResult.url}?t=${Date.now()}`

    const { error: updateError } = await db
        .from("profiles")
        .update({
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)

    if (updateError) {
        return { success: false, error: "Failed to update profile" }
    }

    return { success: true, url: avatarUrl }
}

/**
 * Remove the current user's avatar
 */
export async function removeAvatarAction(): Promise<DeleteResponse> {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()

    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    // Get current avatar URL
    const { data: profile } = await db
        .from("profiles")
        .select("avatar_url")
        .eq("id", user.id)
        .single()

    if (profile?.avatar_url) {
        await deleteFiles(STORAGE_BUCKETS.AVATARS, [profile.avatar_url])
    }

    // Clear avatar_url in profile
    const { error: updateError } = await db
        .from("profiles")
        .update({
            avatar_url: null,
            updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)

    if (updateError) {
        return { success: false, error: "Failed to update profile" }
    }

    return { success: true }
}

// ============================================
// Badge Image Actions (Admin only)
// ============================================

/**
 * Upload a badge image (Admin only)
 */
export async function uploadBadgeImageAction(formData: FormData): Promise<UploadResponse> {
    const user = await getAuthenticatedUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    const isAdmin = await isUserAdmin(user.id)
    if (!isAdmin) {
        return { success: false, error: "Admin access required" }
    }

    const file = formData.get("image") as File | null
    if (!file) {
        return { success: false, error: "No file provided" }
    }

    // Badge-specific validation
    const ext = file.name.split(".").pop()?.toLowerCase()
    if (ext !== "png" && file.type !== "image/png") {
        return { success: false, error: "Badge images must be PNG format" }
    }

    const validation = validateFile(file, STORAGE_BUCKETS.BADGES)
    if (!validation.valid) {
        return { success: false, error: validation.error }
    }

    // Validate dimensions
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    // PNG signature check
    const isPNG = buffer[0] === 0x89 && buffer[1] === 0x50 &&
        buffer[2] === 0x4E && buffer[3] === 0x47

    if (!isPNG) {
        return { success: false, error: "Invalid PNG file" }
    }

    // Extract dimensions from IHDR chunk
    const width = (buffer[16] << 24) | (buffer[17] << 16) | (buffer[18] << 8) | buffer[19]
    const height = (buffer[20] << 24) | (buffer[21] << 16) | (buffer[22] << 8) | buffer[23]

    if (width !== 512 || height !== 512) {
        return { success: false, error: `Badge images must be 512x512px (got ${width}x${height})` }
    }

    const path = generateRootFilePath(file.name)
    return uploadFile(STORAGE_BUCKETS.BADGES, path, file, { contentType: "image/png" })
}

/**
 * Delete a badge image (Admin only)
 */
export async function deleteBadgeImageAction(imageUrl: string): Promise<DeleteResponse> {
    const user = await getAuthenticatedUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    const isAdmin = await isUserAdmin(user.id)
    if (!isAdmin) {
        return { success: false, error: "Admin access required" }
    }

    return deleteFiles(STORAGE_BUCKETS.BADGES, [imageUrl])
}

// ============================================
// Blog Image Actions
// ============================================

/**
 * Upload a blog cover image
 */
export async function uploadBlogImageAction(formData: FormData): Promise<UploadResponse> {
    const user = await getAuthenticatedUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    const isAdmin = await isUserAdmin(user.id)
    if (!isAdmin) {
        return { success: false, error: "Admin access required" }
    }

    const file = formData.get("image") as File | null
    if (!file) {
        return { success: false, error: "No file provided" }
    }

    const validation = validateFile(file, STORAGE_BUCKETS.BLOGS)
    if (!validation.valid) {
        return { success: false, error: validation.error }
    }

    const path = generateFilePath(user.id, file.name)
    return uploadFile(STORAGE_BUCKETS.BLOGS, path, file)
}

/**
 * Delete a blog image
 */
export async function deleteBlogImageAction(imageUrl: string): Promise<DeleteResponse> {
    if (!imageUrl) {
        return { success: true }
    }
    return deleteFiles(STORAGE_BUCKETS.BLOGS, [imageUrl])
}

// ============================================
// Event Image Actions
// ============================================

/**
 * Upload an event cover image
 */
export async function uploadEventImageAction(
    formData: FormData,
    cafeId?: string
): Promise<UploadResponse> {
    const user = await getAuthenticatedUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    const file = formData.get("image") as File | null
    if (!file) {
        return { success: false, error: "No file provided" }
    }

    const validation = validateFile(file, STORAGE_BUCKETS.EVENTS)
    if (!validation.valid) {
        return { success: false, error: validation.error }
    }

    // Use cafeId if provided, otherwise user.id
    const scopeId = cafeId || user.id
    const path = generateCafeFilePath(scopeId, file.name)
    return uploadFile(STORAGE_BUCKETS.EVENTS, path, file)
}

/**
 * Delete an event image
 */
export async function deleteEventImageAction(imageUrl: string): Promise<DeleteResponse> {
    if (!imageUrl) {
        return { success: true }
    }
    return deleteFiles(STORAGE_BUCKETS.EVENTS, [imageUrl])
}

// ============================================
// Menu Photo Actions
// ============================================

/**
 * Upload a menu item photo
 */
export async function uploadMenuPhotoAction(
    formData: FormData,
    cafeId: string
): Promise<UploadResponse> {
    const user = await getAuthenticatedUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    const file = formData.get("image") as File | null
    if (!file) {
        return { success: false, error: "No file provided" }
    }

    const validation = validateFile(file, STORAGE_BUCKETS.MENU_PHOTOS)
    if (!validation.valid) {
        return { success: false, error: validation.error }
    }

    const path = generateCafeFilePath(cafeId, file.name)
    return uploadFile(STORAGE_BUCKETS.MENU_PHOTOS, path, file)
}

/**
 * Delete a menu photo
 */
export async function deleteMenuPhotoAction(imageUrl: string): Promise<DeleteResponse> {
    if (!imageUrl) {
        return { success: true }
    }
    return deleteFiles(STORAGE_BUCKETS.MENU_PHOTOS, [imageUrl])
}

// ============================================
// Ownership Proof Actions
// ============================================

/**
 * Upload an ownership proof document
 */
export async function uploadOwnershipProofAction(formData: FormData): Promise<UploadResponse> {
    const user = await getAuthenticatedUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    const file = formData.get("file") as File | null
    if (!file) {
        return { success: false, error: "No file provided" }
    }

    const validation = validateFile(file, STORAGE_BUCKETS.OWNERSHIP_PROOFS)
    if (!validation.valid) {
        return { success: false, error: validation.error }
    }

    const path = generateFilePath(user.id, file.name)
    return uploadFile(STORAGE_BUCKETS.OWNERSHIP_PROOFS, path, file)
}

/**
 * Get a signed URL for an ownership proof (Admin only)
 */
export async function getOwnershipProofSignedUrlAction(
    proofPath: string
): Promise<{ success: boolean; url?: string; error?: string }> {
    const user = await getAuthenticatedUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    const isAdmin = await isUserAdmin(user.id)
    if (!isAdmin) {
        return { success: false, error: "Admin access required" }
    }

    try {
        const storage = await getStorageProvider()
        const result = await storage.createSignedUrl(
            STORAGE_BUCKETS.OWNERSHIP_PROOFS,
            proofPath,
            3600 // 1 hour
        )

        if (!result.success) {
            return { success: false, error: result.error }
        }

        return { success: true, url: result.signedUrl }
    } catch (error) {
        console.error("[Storage] Signed URL error:", error)
        return { success: false, error: "Failed to create signed URL" }
    }
}
