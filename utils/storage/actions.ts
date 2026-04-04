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

import { getCurrentUser } from "@/lib/auth"
import { db } from "@/db"
import { profiles, cafes, reviews, blogPosts, events, badgeDefinitions, cafeClaims, cafeMenuItems, collections, avatarDeletionQueue, cafeCrawls } from "@/db/schema"
import { eq, sql, isNotNull } from "drizzle-orm"
import {
    getStorageProvider,
    STORAGE_BUCKETS,
    validateFile,
    generateFilePath,
    generateCafeFilePath,
    generateRootFilePath,
    type StorageBucket,
} from "@/utils/storage"
import { collectCafeStampUrls, collectCrawlCoverUrls, collectBlogImageUrls } from "@/utils/storage/cleanup"
import { CAFE_PLACEHOLDER_URL } from "@/utils/extras"
import { isOwnerOfCafe } from "@/app/api/actions/owner"

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
    return await getCurrentUser()
}

async function isUserAdmin(userId: string) {
    const result = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1)
    return result[0] && ["admin", "moderator"].includes(result[0].role || "")
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
    const user = await getCurrentUser()

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

    try {
        await db
            .update(profiles)
            .set({
                avatarUrl: avatarUrl,
                updatedAt: new Date(),
            })
            .where(eq(profiles.id, user.id))
    } catch {
        return { success: false, error: "Failed to update profile" }
    }

    return { success: true, url: avatarUrl }
}

/**
 * Remove the current user's avatar
 */
export async function removeAvatarAction(): Promise<DeleteResponse> {
    const user = await getCurrentUser()

    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    // Get current avatar URL
    const profileResult = await db
        .select({ avatarUrl: profiles.avatarUrl })
        .from(profiles)
        .where(eq(profiles.id, user.id))
        .limit(1)

    const profile = profileResult[0]

    if (profile?.avatarUrl) {
        await deleteFiles(STORAGE_BUCKETS.AVATARS, [profile.avatarUrl])
    }

    // Clear avatar_url in profile
    try {
        await db
            .update(profiles)
            .set({
                avatarUrl: null,
                updatedAt: new Date(),
            })
            .where(eq(profiles.id, user.id))
    } catch {
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
// Cafe Badge Stamp Actions (Owner only)
// ============================================

/**
 * Upload a cafe badge stamp image (Owner only)
 * Uses the badges bucket with same constraints as badge images
 */
export async function uploadCafeBadgeStampAction(
    formData: FormData,
    cafeId: string
): Promise<UploadResponse> {
    const user = await getAuthenticatedUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    // Check if user is owner of this cafe
    const isOwner = await isOwnerOfCafe(cafeId)
    if (!isOwner) {
        return { success: false, error: "Only cafe owners can upload badge stamps" }
    }

    const file = formData.get("image") as File | null
    if (!file) {
        return { success: false, error: "No file provided" }
    }

    // Badge-specific validation - PNG only
    const ext = file.name.split(".").pop()?.toLowerCase()
    if (ext !== "png" && file.type !== "image/png") {
        return { success: false, error: "Badge stamp images must be PNG format" }
    }

    const validation = validateFile(file, STORAGE_BUCKETS.BADGES)
    if (!validation.valid) {
        return { success: false, error: validation.error }
    }

    // Validate dimensions (512x512)
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
        return { success: false, error: `Badge stamp images must be 512x512px (got ${width}x${height})` }
    }

    // Use cafe-specific path for namespace isolation
    const path = generateCafeFilePath(cafeId, file.name)
    return uploadFile(STORAGE_BUCKETS.BADGES, path, file, { contentType: "image/png" })
}

/**
 * Delete a cafe badge stamp image (Owner only)
 */
export async function deleteCafeBadgeStampAction(imageUrl: string): Promise<DeleteResponse> {
    const user = await getAuthenticatedUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    // Extract cafeId from path to verify ownership
    // Path format: cafeId/timestamp-random.png
    const storage = await getStorageProvider()
    const path = storage.extractPathFromUrl(imageUrl, STORAGE_BUCKETS.BADGES)
    if (!path) {
        return { success: false, error: "Invalid image URL" }
    }

    const cafeId = path.split("/")[0]
    if (!cafeId) {
        return { success: false, error: "Invalid image path" }
    }

    const isOwner = await isOwnerOfCafe(cafeId)
    if (!isOwner) {
        return { success: false, error: "Only cafe owners can delete badge stamps" }
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
        collections: number
        crawls: number
    }
    error?: string
}

/**
 * Clean up orphaned images across all storage buckets
 * This function lists all files in storage and checks if they're referenced in the database
 * Files not referenced anywhere are deleted
 */
/**
 * Clean up orphaned images across all storage buckets
 * Optimized to use batch DB queries and proper pagination
 */
export async function cleanupOrphanedImages(): Promise<CleanupResult> {
    const user = await getAuthenticatedUser()
    if (!user) {
        return { success: false, deleted: createEmptyCleanupStats(), error: "Not authenticated" }
    }

    const isAdmin = await isUserAdmin(user.id)
    if (!isAdmin) {
        return { success: false, deleted: createEmptyCleanupStats(), error: "Admin access required" }
    }

    const storage = await getStorageProvider()
    const deleted = createEmptyCleanupStats()

    try {
        // ---------------------------------------------------------
        // 1. Fetch all valid image URLs from DB (Batching)
        // ---------------------------------------------------------

        // Cafe Images
        const cafeImages = new Set<string>()
        const cafesResult = await db.select({ thumbnail: cafes.thumbnail, gallery: cafes.gallery, badgeStampUrl: cafes.badgeStampUrl }).from(cafes)
        for (const c of cafesResult) {
            if (c.thumbnail) cafeImages.add(c.thumbnail)
            if (c.gallery) c.gallery.forEach(url => cafeImages.add(url))
        }
        // Collect cafe badge stamp URLs (stored in badges bucket)
        const cafeStampUrls = collectCafeStampUrls(cafesResult)

        // Review Images
        const reviewImages = new Set<string>()
        const reviewsResult = await db.select({ images: reviews.images }).from(reviews).where(sql`array_length(images, 1) > 0`)
        for (const r of reviewsResult) {
            r.images?.forEach(url => reviewImages.add(url))
        }

        // Avatar Images (strip query params for matching)
        const avatarImages = new Set<string>()
        const profilesResult = await db.select({ avatarUrl: profiles.avatarUrl }).from(profiles).where(isNotNull(profiles.avatarUrl))
        for (const p of profilesResult) {
            if (p.avatarUrl) avatarImages.add(p.avatarUrl.split('?')[0])
        }

        // Blog Images
        const blogsResult = await db.select({ coverImage: blogPosts.coverImage, images: blogPosts.images }).from(blogPosts)
        const blogImages = collectBlogImageUrls(blogsResult)

        // Event Images
        const eventImages = new Set<string>()
        const eventsResult = await db.select({ imageUrl: events.imageUrl }).from(events).where(isNotNull(events.imageUrl))
        for (const e of eventsResult) {
            if (e.imageUrl) eventImages.add(e.imageUrl)
        }

        // Menu Photo Images
        const menuImages = new Set<string>()
        const menuResult = await db.select({ imageUrl: cafeMenuItems.imageUrl }).from(cafeMenuItems).where(isNotNull(cafeMenuItems.imageUrl))
        for (const m of menuResult) {
            if (m.imageUrl) menuImages.add(m.imageUrl)
        }

        // Badge Images (includes both badge definitions and cafe badge stamps)
        const badgeImages = new Set<string>()
        const badgeResult = await db.select({ imageUrl: badgeDefinitions.imageUrl }).from(badgeDefinitions).where(isNotNull(badgeDefinitions.imageUrl))
        for (const b of badgeResult) {
            if (b.imageUrl) badgeImages.add(b.imageUrl)
        }
        // Add cafe badge stamp URLs to valid badge images
        for (const url of cafeStampUrls) {
            badgeImages.add(url)
        }

        // Ownership Proofs
        const proofImages = new Set<string>()
        const proofResult = await db.select({ proofDocumentUrl: cafeClaims.proofDocumentUrl }).from(cafeClaims).where(isNotNull(cafeClaims.proofDocumentUrl))
        for (const p of proofResult) {
            if (p.proofDocumentUrl) proofImages.add(p.proofDocumentUrl)
        }

        // Collection Images
        const collectionImages = new Set<string>()
        const collectionsResult = await db.select({ coverImage: collections.coverImage }).from(collections).where(isNotNull(collections.coverImage))
        for (const c of collectionsResult) {
            if (c.coverImage) collectionImages.add(c.coverImage)
        }

        // Crawl Cover Images
        const crawlsResult = await db
            .select({ coverImage: cafeCrawls.coverImage })
            .from(cafeCrawls)
            .where(isNotNull(cafeCrawls.coverImage))
        const crawlImages = collectCrawlCoverUrls(crawlsResult)

        // ---------------------------------------------------------
        // 2. Iterate Storage and Delete Orphans
        // ---------------------------------------------------------

        // Helper to process a bucket
        const processBucket = async (
            bucket: StorageBucket,
            validUrls: Set<string>,
            statsKey: keyof typeof deleted,
            isAvatar = false
        ) => {
            let offset = 0
            const LIMIT = 1000
            let hasMore = true

            while (hasMore) {
                const result = await storage.list(bucket, { limit: LIMIT, offset })
                if (!result.success || !result.files) break

                const toDelete: string[] = []

                for (const file of result.files) {
                    if (file.isDirectory) continue

                    const publicUrl = storage.getPublicUrl(bucket, file.path)

                    // Skip placeholder
                    if (publicUrl === CAFE_PLACEHOLDER_URL) continue

                    let isReferenced = false
                    if (isAvatar) {
                        // For avatars, exact match usually fails due to cache buster query params
                        // We checked the validUrls set which has query params stripped
                        // So we strip them here too
                        isReferenced = validUrls.has(publicUrl.split('?')[0])
                    } else {
                        isReferenced = validUrls.has(publicUrl)
                    }

                    if (!isReferenced) {
                        toDelete.push(file.path)
                    }
                }

                if (toDelete.length > 0) {
                    await storage.delete(bucket, toDelete)
                    deleted[statsKey] += toDelete.length
                }

                if (result.files.length < LIMIT) {
                    hasMore = false
                } else {
                    offset += LIMIT
                }
            }
        }

        await processBucket(STORAGE_BUCKETS.CAFES, cafeImages, 'cafes')
        await processBucket(STORAGE_BUCKETS.REVIEWS, reviewImages, 'reviews')
        await processBucket(STORAGE_BUCKETS.AVATARS, avatarImages, 'avatars', true)
        await processBucket(STORAGE_BUCKETS.BLOGS, blogImages, 'blogs')
        await processBucket(STORAGE_BUCKETS.EVENTS, eventImages, 'events')
        await processBucket(STORAGE_BUCKETS.MENU_PHOTOS, menuImages, 'menuPhotos')
        await processBucket(STORAGE_BUCKETS.BADGES, badgeImages, 'badges')
        await processBucket(STORAGE_BUCKETS.OWNERSHIP_PROOFS, proofImages, 'ownershipProofs')
        await processBucket(STORAGE_BUCKETS.COLLECTIONS, collectionImages, 'collections')
        await processBucket(STORAGE_BUCKETS.CRAWLS, crawlImages, 'crawls')

        return { success: true, deleted }
    } catch (error) {
        console.error("[Storage] Cleanup error:", error)
        return { success: false, deleted, error: "Cleanup failed" }
    }
}

function createEmptyCleanupStats() {
    return {
        cafes: 0,
        reviews: 0,
        avatars: 0,
        blogs: 0,
        events: 0,
        menuPhotos: 0,
        badges: 0,
        ownershipProofs: 0,
        collections: 0,
        crawls: 0,
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

    const storage = await getStorageProvider()
    let processed = 0

    try {
        // Fetch pending deletions
        const queue = await db
            .select({ id: avatarDeletionQueue.id, avatarUrl: avatarDeletionQueue.avatarUrl })
            .from(avatarDeletionQueue)
            .limit(100)

        if (!queue || queue.length === 0) {
            return { success: true, processed: 0 }
        }

        for (const item of queue) {
            // Extract path from URL and delete
            if (item.avatarUrl) {
                const path = storage.extractPathFromUrl(item.avatarUrl, STORAGE_BUCKETS.AVATARS)
                if (path) {
                    await storage.delete(STORAGE_BUCKETS.AVATARS, [path])
                }
            }

            // Remove from queue
            await db
                .delete(avatarDeletionQueue)
                .where(eq(avatarDeletionQueue.id, item.id))

            processed++
        }

        return { success: true, processed }
    } catch (error) {
        console.error("[Storage] Avatar queue error:", error)
        return { success: false, processed, error: "Processing failed" }
    }
}
