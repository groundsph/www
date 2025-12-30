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
import { CAFE_PLACEHOLDER_URL } from "@/utils/extras"

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

// ============================================
// Cleanup Actions (Admin only)
// ============================================

export interface CleanupResult {
    success: boolean
    deleted: {
        cafes: number
        reviews: number
        avatars: number
        blogs: number
        events: number
        menuPhotos: number
        badges: number
        ownershipProofs: number
    }
    error?: string
}

/**
 * Clean up orphaned images across all storage buckets
 * This function lists all files in storage and checks if they're referenced in the database
 * Files not referenced anywhere are deleted
 */
export async function cleanupOrphanedImages(): Promise<CleanupResult> {
    const user = await getAuthenticatedUser()
    if (!user) {
        return { success: false, deleted: { cafes: 0, reviews: 0, avatars: 0, blogs: 0, events: 0, menuPhotos: 0, badges: 0, ownershipProofs: 0 }, error: "Not authenticated" }
    }

    const isAdmin = await isUserAdmin(user.id)
    if (!isAdmin) {
        return { success: false, deleted: { cafes: 0, reviews: 0, avatars: 0, blogs: 0, events: 0, menuPhotos: 0, badges: 0, ownershipProofs: 0 }, error: "Admin access required" }
    }

    const { createAdminClient } = await import("@/utils/supabase/admin")
    const adminDb = await createAdminClient()
    const storage = await getStorageProvider()

    const deleted = {
        cafes: 0,
        reviews: 0,
        avatars: 0,
        blogs: 0,
        events: 0,
        menuPhotos: 0,
        badges: 0,
        ownershipProofs: 0,
    }

    try {
        // Helper to check if URL is referenced
        const isUrlReferenced = async (
            table: string,
            column: string,
            url: string,
            isArray: boolean = false
        ): Promise<boolean> => {
            if (isArray) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { data } = await (adminDb as any)
                    .from(table)
                    .select("id")
                    .contains(column, [url])
                    .limit(1)
                    .maybeSingle()
                return !!data
            } else {
                // For avatar_url, match with LIKE to handle cache busters
                const baseUrl = url.split("?")[0]
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { data } = await (adminDb as any)
                    .from(table)
                    .select("id")
                    .like(column, `${baseUrl}%`)
                    .limit(1)
                    .maybeSingle()
                return !!data
            }
        }

        // 1. Clean cafe images
        const cafeFiles = await storage.list(STORAGE_BUCKETS.CAFES, { limit: 1000 })
        if (cafeFiles.success && cafeFiles.files) {
            for (const file of cafeFiles.files) {
                if (file.isDirectory) continue
                const publicUrl = storage.getPublicUrl(STORAGE_BUCKETS.CAFES, file.path)

                // Skip placeholder
                if (publicUrl === CAFE_PLACEHOLDER_URL) continue

                // Check thumbnail
                const { data: thumbRef } = await adminDb
                    .from("cafes")
                    .select("id")
                    .eq("thumbnail", publicUrl)
                    .limit(1)
                    .maybeSingle()

                // Check gallery
                const { data: galleryRef } = await adminDb
                    .from("cafes")
                    .select("id")
                    .contains("gallery", [publicUrl])
                    .limit(1)
                    .maybeSingle()

                if (!thumbRef && !galleryRef) {
                    await storage.delete(STORAGE_BUCKETS.CAFES, [file.path])
                    deleted.cafes++
                }
            }
        }

        // 2. Clean review images
        const reviewFiles = await storage.list(STORAGE_BUCKETS.REVIEWS, { limit: 1000 })
        if (reviewFiles.success && reviewFiles.files) {
            for (const file of reviewFiles.files) {
                if (file.isDirectory) continue
                const publicUrl = storage.getPublicUrl(STORAGE_BUCKETS.REVIEWS, file.path)
                const referenced = await isUrlReferenced("reviews", "images", publicUrl, true)
                if (!referenced) {
                    await storage.delete(STORAGE_BUCKETS.REVIEWS, [file.path])
                    deleted.reviews++
                }
            }
        }

        // 3. Clean avatar images
        const avatarFiles = await storage.list(STORAGE_BUCKETS.AVATARS, { limit: 1000 })
        if (avatarFiles.success && avatarFiles.files) {
            for (const file of avatarFiles.files) {
                if (file.isDirectory) continue
                const publicUrl = storage.getPublicUrl(STORAGE_BUCKETS.AVATARS, file.path)
                const referenced = await isUrlReferenced("profiles", "avatar_url", publicUrl, false)
                if (!referenced) {
                    await storage.delete(STORAGE_BUCKETS.AVATARS, [file.path])
                    deleted.avatars++
                }
            }
        }

        // 4. Clean blog images
        const blogFiles = await storage.list(STORAGE_BUCKETS.BLOGS, { limit: 1000 })
        if (blogFiles.success && blogFiles.files) {
            for (const file of blogFiles.files) {
                if (file.isDirectory) continue
                const publicUrl = storage.getPublicUrl(STORAGE_BUCKETS.BLOGS, file.path)
                const { data: blogRef } = await adminDb
                    .from("blog_posts")
                    .select("id")
                    .eq("cover_image", publicUrl)
                    .limit(1)
                    .maybeSingle()
                if (!blogRef) {
                    await storage.delete(STORAGE_BUCKETS.BLOGS, [file.path])
                    deleted.blogs++
                }
            }
        }

        // 5. Clean event images
        const eventFiles = await storage.list(STORAGE_BUCKETS.EVENTS, { limit: 1000 })
        if (eventFiles.success && eventFiles.files) {
            for (const file of eventFiles.files) {
                if (file.isDirectory) continue
                const publicUrl = storage.getPublicUrl(STORAGE_BUCKETS.EVENTS, file.path)
                const { data: eventRef } = await adminDb
                    .from("events")
                    .select("id")
                    .eq("image_url", publicUrl)
                    .limit(1)
                    .maybeSingle()
                if (!eventRef) {
                    await storage.delete(STORAGE_BUCKETS.EVENTS, [file.path])
                    deleted.events++
                }
            }
        }

        // 6. Clean menu photos
        const menuFiles = await storage.list(STORAGE_BUCKETS.MENU_PHOTOS, { limit: 1000 })
        if (menuFiles.success && menuFiles.files) {
            for (const file of menuFiles.files) {
                if (file.isDirectory) continue
                const publicUrl = storage.getPublicUrl(STORAGE_BUCKETS.MENU_PHOTOS, file.path)
                const { data: menuRef } = await adminDb
                    .from("cafe_menu_items")
                    .select("id")
                    .eq("image_url", publicUrl)
                    .limit(1)
                    .maybeSingle()
                if (!menuRef) {
                    await storage.delete(STORAGE_BUCKETS.MENU_PHOTOS, [file.path])
                    deleted.menuPhotos++
                }
            }
        }

        // 7. Clean badge images
        const badgeFiles = await storage.list(STORAGE_BUCKETS.BADGES, { limit: 1000 })
        if (badgeFiles.success && badgeFiles.files) {
            for (const file of badgeFiles.files) {
                if (file.isDirectory) continue
                const publicUrl = storage.getPublicUrl(STORAGE_BUCKETS.BADGES, file.path)
                const { data: badgeRef } = await adminDb
                    .from("badge_definitions")
                    .select("id")
                    .eq("image_url", publicUrl)
                    .limit(1)
                    .maybeSingle()
                if (!badgeRef) {
                    await storage.delete(STORAGE_BUCKETS.BADGES, [file.path])
                    deleted.badges++
                }
            }
        }

        // 8. Clean ownership proofs
        const proofFiles = await storage.list(STORAGE_BUCKETS.OWNERSHIP_PROOFS, { limit: 1000 })
        if (proofFiles.success && proofFiles.files) {
            for (const file of proofFiles.files) {
                if (file.isDirectory) continue
                // Ownership proofs store paths, not URLs
                const { data: claimRef } = await adminDb
                    .from("cafe_claims")
                    .select("id")
                    .contains("proof_urls", [file.path])
                    .limit(1)
                    .maybeSingle()
                if (!claimRef) {
                    await storage.delete(STORAGE_BUCKETS.OWNERSHIP_PROOFS, [file.path])
                    deleted.ownershipProofs++
                }
            }
        }

        return { success: true, deleted }
    } catch (error) {
        console.error("[Storage] Cleanup error:", error)
        return { success: false, deleted, error: "Cleanup failed" }
    }
}

/**
 * Process the avatar deletion queue
 * Deletes avatars that were queued when profiles were deleted
 */
export async function processAvatarDeletionQueue(): Promise<{
    success: boolean
    processed: number
    error?: string
}> {
    const user = await getAuthenticatedUser()
    if (!user) {
        return { success: false, processed: 0, error: "Not authenticated" }
    }

    const isAdmin = await isUserAdmin(user.id)
    if (!isAdmin) {
        return { success: false, processed: 0, error: "Admin access required" }
    }

    const { createAdminClient } = await import("@/utils/supabase/admin")
    const adminDb = await createAdminClient()
    const storage = await getStorageProvider()
    let processed = 0

    try {
        // Fetch pending deletions
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: queue, error: fetchError } = await (adminDb as any)
            .from("avatar_deletion_queue")
            .select("id, avatar_url")
            .limit(100) as { data: { id: string; avatar_url: string }[] | null; error: { message: string } | null }

        if (fetchError) {
            console.warn("Avatar deletion queue not found or error:", fetchError.message)
            return { success: true, processed: 0 }
        }

        if (!queue || queue.length === 0) {
            return { success: true, processed: 0 }
        }

        for (const item of queue) {
            // Extract path from URL and delete
            const path = storage.extractPathFromUrl(item.avatar_url, STORAGE_BUCKETS.AVATARS)
            if (path) {
                await storage.delete(STORAGE_BUCKETS.AVATARS, [path])
            }

            // Remove from queue
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (adminDb as any)
                .from("avatar_deletion_queue")
                .delete()
                .eq("id", item.id)

            processed++
        }

        return { success: true, processed }
    } catch (error) {
        console.error("[Storage] Avatar queue error:", error)
        return { success: false, processed, error: "Processing failed" }
    }
}
