/**
 * @deprecated LEGACY: Supabase-specific storage utilities
 * 
 * This file contains Supabase-specific storage functions that haven't been migrated
 * to the provider-agnostic storage module yet.
 * 
 * STILL IN USE:
 * - cleanupOrphanedImages() - Admin cleanup function that lists all buckets
 * - processAvatarDeletionQueue() - Background job for avatar cleanup
 * 
 * For new code, use:
 * - Server actions: @/utils/storage/actions
 * - Client utilities: @/utils/storage/client
 * 
 * This file will be removed once all functions are migrated to the new storage module.
 */
"use server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"

const AVATAR_BUCKET = "avatars"
const REVIEW_BUCKET = "reviews"
const CAFE_BUCKET = "cafes"
const BADGE_BUCKET = "badges"
const BLOG_BUCKET = "blogs"
const EVENT_BUCKET = "events"
const MENU_PHOTOS_BUCKET = "menu-photos"
const OWNERSHIP_PROOFS_BUCKET = "ownership-proofs"
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const MAX_CAFE_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_BLOG_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_EVENT_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_BADGE_FILE_SIZE = 500 * 1024 // 500KB
const BADGE_IMAGE_DIMENSION = 512 // Badge images must be 512x512px

/**
 * Extract storage path from a Supabase storage public URL (internal helper)
 * Example URL: https://xxx.supabase.co/storage/v1/object/public/cafes/userId/file.jpg
 * Returns: userId/file.jpg
 */
function extractStoragePath(url: string, bucket: string): string | null {
    try {
        const pattern = new RegExp(`/storage/v1/object/public/${bucket}/(.+)`)
        const match = url.match(pattern)
        if (match && match[1]) {
            // Remove query params (like cache busters)
            return match[1].split('?')[0]
        }
        return null
    } catch {
        return null
    }
}

/**
 * Delete files from a storage bucket using admin client (bypasses RLS)
 */
export async function deleteStorageFiles(bucket: string, paths: string[]): Promise<void> {
    if (paths.length === 0) return

    const adminDb = await createAdminClient()
    const { error } = await adminDb.storage.from(bucket).remove(paths)

    if (error) {
        console.error(`Error deleting files from ${bucket}:`, error)
    }
}

/**
 * Delete cafe images (thumbnail + gallery) from storage
 */
export async function deleteCafeImages(thumbnail: string | null, gallery: string[] | null): Promise<void> {
    const paths: string[] = []

    if (thumbnail) {
        const path = extractStoragePath(thumbnail, CAFE_BUCKET)
        if (path) paths.push(path)
    }

    if (gallery && gallery.length > 0) {
        for (const url of gallery) {
            const path = extractStoragePath(url, CAFE_BUCKET)
            if (path) paths.push(path)
        }
    }

    await deleteStorageFiles(CAFE_BUCKET, paths)
}

/**
 * Delete a single cafe image from storage (Admin only)
 * Used when removing individual images from cafe thumbnail or gallery
 */
export async function deleteSingleCafeImage(imageUrl: string): Promise<{
    success: boolean
    error?: string
}> {
    if (!imageUrl) {
        return { success: false, error: "No image URL provided" }
    }

    const path = extractStoragePath(imageUrl, CAFE_BUCKET)
    if (!path) {
        return { success: false, error: "Invalid image URL" }
    }

    try {
        await deleteStorageFiles(CAFE_BUCKET, [path])
        return { success: true }
    } catch (error) {
        console.error("Error deleting cafe image:", error)
        return { success: false, error: "Failed to delete image" }
    }
}

/**
 * Delete review images from storage
 */
export async function deleteReviewImages(images: string[] | null): Promise<void> {
    if (!images || images.length === 0) return

    const paths: string[] = []
    for (const url of images) {
        const path = extractStoragePath(url, REVIEW_BUCKET)
        if (path) paths.push(path)
    }

    await deleteStorageFiles(REVIEW_BUCKET, paths)
}

/**
 * Delete avatar image from storage
 */
export async function deleteAvatarImage(avatarUrl: string | null): Promise<void> {
    if (!avatarUrl) return

    const path = extractStoragePath(avatarUrl, AVATAR_BUCKET)
    if (path) {
        await deleteStorageFiles(AVATAR_BUCKET, [path])
    }
}

/**
 * Clean up orphaned images from storage buckets
 * This finds files in storage that are not referenced in the database
 * Should be run periodically by admins to free up storage space
 * 
 * Checks the following buckets:
 * - cafes: thumbnail + gallery in cafes table
 * - reviews: images array in reviews table
 * - avatars: avatar_url in profiles table
 * - blogs: cover_image in blog_posts table
 * - events: image_url in events table
 * - menu-photos: image_url in menu_items table
 * - badges: image_url in badge_definitions table
 * - ownership-proofs: proof_urls in cafe_claims table
 */
export async function cleanupOrphanedImages(): Promise<{
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
}> {
    const adminDb = await createAdminClient()
    const deleted = {
        cafes: 0,
        reviews: 0,
        avatars: 0,
        blogs: 0,
        events: 0,
        menuPhotos: 0,
        badges: 0,
        ownershipProofs: 0
    }

    try {
        // 1. Clean orphaned cafe images
        const { data: cafeFiles } = await adminDb.storage.from(CAFE_BUCKET).list('', { limit: 1000 })
        if (cafeFiles) {
            // Get all folders (user IDs)
            for (const folder of cafeFiles) {
                if (folder.id) continue // Skip if it's a file at root level

                const { data: userFiles } = await adminDb.storage.from(CAFE_BUCKET).list(folder.name, { limit: 1000 })
                if (!userFiles) continue

                for (const file of userFiles) {
                    const fullPath = `${folder.name}/${file.name}`
                    const publicUrl = adminDb.storage.from(CAFE_BUCKET).getPublicUrl(fullPath).data.publicUrl

                    // Check if this URL exists in cafes table
                    const { data: cafeRef } = await adminDb
                        .from('cafes')
                        .select('id')
                        .or(`thumbnail.eq.${publicUrl},gallery.cs.{${publicUrl}}`)
                        .limit(1)
                        .maybeSingle()

                    if (!cafeRef) {
                        await adminDb.storage.from(CAFE_BUCKET).remove([fullPath])
                        deleted.cafes++
                    }
                }
            }
        }

        // 2. Clean orphaned review images
        const { data: reviewFolders } = await adminDb.storage.from(REVIEW_BUCKET).list('', { limit: 1000 })
        if (reviewFolders) {
            for (const folder of reviewFolders) {
                if (folder.id) continue

                const { data: userFiles } = await adminDb.storage.from(REVIEW_BUCKET).list(folder.name, { limit: 1000 })
                if (!userFiles) continue

                for (const file of userFiles) {
                    const fullPath = `${folder.name}/${file.name}`
                    const publicUrl = adminDb.storage.from(REVIEW_BUCKET).getPublicUrl(fullPath).data.publicUrl

                    // Check if this URL exists in reviews table
                    const { data: reviewRef } = await adminDb
                        .from('reviews')
                        .select('id')
                        .contains('images', [publicUrl])
                        .limit(1)
                        .maybeSingle()

                    if (!reviewRef) {
                        await adminDb.storage.from(REVIEW_BUCKET).remove([fullPath])
                        deleted.reviews++
                    }
                }
            }
        }

        // 3. Clean orphaned avatar images
        const { data: avatarFolders } = await adminDb.storage.from(AVATAR_BUCKET).list('', { limit: 1000 })
        if (avatarFolders) {
            for (const folder of avatarFolders) {
                if (folder.id) continue

                const { data: userFiles } = await adminDb.storage.from(AVATAR_BUCKET).list(folder.name, { limit: 1000 })
                if (!userFiles) continue

                for (const file of userFiles) {
                    const fullPath = `${folder.name}/${file.name}`
                    const publicUrl = adminDb.storage.from(AVATAR_BUCKET).getPublicUrl(fullPath).data.publicUrl
                    // Remove cache buster for comparison
                    const baseUrl = publicUrl.split('?')[0]

                    // Check if this URL exists in profiles table
                    const { data: profileRef } = await adminDb
                        .from('profiles')
                        .select('id')
                        .like('avatar_url', `${baseUrl}%`)
                        .limit(1)
                        .maybeSingle()

                    if (!profileRef) {
                        await adminDb.storage.from(AVATAR_BUCKET).remove([fullPath])
                        deleted.avatars++
                    }
                }
            }
        }

        // 4. Clean orphaned blog images
        const { data: blogFolders } = await adminDb.storage.from(BLOG_BUCKET).list('', { limit: 1000 })
        if (blogFolders) {
            for (const folder of blogFolders) {
                if (folder.id) continue

                const { data: userFiles } = await adminDb.storage.from(BLOG_BUCKET).list(folder.name, { limit: 1000 })
                if (!userFiles) continue

                for (const file of userFiles) {
                    const fullPath = `${folder.name}/${file.name}`
                    const publicUrl = adminDb.storage.from(BLOG_BUCKET).getPublicUrl(fullPath).data.publicUrl

                    // Check if this URL exists in blog_posts table
                    const { data: blogRef } = await adminDb
                        .from('blog_posts')
                        .select('id')
                        .eq('cover_image', publicUrl)
                        .limit(1)
                        .maybeSingle()

                    if (!blogRef) {
                        await adminDb.storage.from(BLOG_BUCKET).remove([fullPath])
                        deleted.blogs++
                    }
                }
            }
        }

        // 5. Clean orphaned event images
        const { data: eventFolders } = await adminDb.storage.from(EVENT_BUCKET).list('', { limit: 1000 })
        if (eventFolders) {
            for (const folder of eventFolders) {
                if (folder.id) continue

                const { data: eventFiles } = await adminDb.storage.from(EVENT_BUCKET).list(folder.name, { limit: 1000 })
                if (!eventFiles) continue

                for (const file of eventFiles) {
                    const fullPath = `${folder.name}/${file.name}`
                    const publicUrl = adminDb.storage.from(EVENT_BUCKET).getPublicUrl(fullPath).data.publicUrl

                    // Check if this URL exists in events table
                    const { data: eventRef } = await adminDb
                        .from('events')
                        .select('id')
                        .eq('image_url', publicUrl)
                        .limit(1)
                        .maybeSingle()

                    if (!eventRef) {
                        await adminDb.storage.from(EVENT_BUCKET).remove([fullPath])
                        deleted.events++
                    }
                }
            }
        }

        // 6. Clean orphaned menu photo images
        const { data: menuFolders } = await adminDb.storage.from(MENU_PHOTOS_BUCKET).list('', { limit: 1000 })
        if (menuFolders) {
            for (const folder of menuFolders) {
                if (folder.id) continue

                const { data: menuFiles } = await adminDb.storage.from(MENU_PHOTOS_BUCKET).list(folder.name, { limit: 1000 })
                if (!menuFiles) continue

                for (const file of menuFiles) {
                    const fullPath = `${folder.name}/${file.name}`
                    const publicUrl = adminDb.storage.from(MENU_PHOTOS_BUCKET).getPublicUrl(fullPath).data.publicUrl

                    // Check if this URL exists in cafe_menu_items table
                    const { data: menuRef } = await adminDb
                        .from('cafe_menu_items')
                        .select('id')
                        .eq('image_url', publicUrl)
                        .limit(1)
                        .maybeSingle()

                    if (!menuRef) {
                        await adminDb.storage.from(MENU_PHOTOS_BUCKET).remove([fullPath])
                        deleted.menuPhotos++
                    }
                }
            }
        }

        // 7. Clean orphaned badge images (stored at root level, not in folders)
        const { data: badgeFiles } = await adminDb.storage.from(BADGE_BUCKET).list('', { limit: 1000 })
        if (badgeFiles) {
            for (const file of badgeFiles) {
                // Badge images are stored at root level
                if (!file.name || file.id === null) continue

                const fullPath = file.name
                const publicUrl = adminDb.storage.from(BADGE_BUCKET).getPublicUrl(fullPath).data.publicUrl

                // Check if this URL exists in badge_definitions table
                const { data: badgeRef } = await adminDb
                    .from('badge_definitions')
                    .select('id')
                    .eq('image_url', publicUrl)
                    .limit(1)
                    .maybeSingle()

                if (!badgeRef) {
                    await adminDb.storage.from(BADGE_BUCKET).remove([fullPath])
                    deleted.badges++
                }
            }
        }

        // 8. Clean orphaned ownership proof files
        const { data: proofFolders } = await adminDb.storage.from(OWNERSHIP_PROOFS_BUCKET).list('', { limit: 1000 })
        if (proofFolders) {
            for (const folder of proofFolders) {
                if (folder.id) continue

                const { data: proofFiles } = await adminDb.storage.from(OWNERSHIP_PROOFS_BUCKET).list(folder.name, { limit: 1000 })
                if (!proofFiles) continue

                for (const file of proofFiles) {
                    const fullPath = `${folder.name}/${file.name}`

                    // For ownership-proofs, we store paths not public URLs
                    // Check if this path exists in cafe_claims table proof_urls array
                    const { data: claimRef } = await adminDb
                        .from('cafe_claims')
                        .select('id')
                        .contains('proof_urls', [fullPath])
                        .limit(1)
                        .maybeSingle()

                    if (!claimRef) {
                        await adminDb.storage.from(OWNERSHIP_PROOFS_BUCKET).remove([fullPath])
                        deleted.ownershipProofs++
                    }
                }
            }
        }

        return { success: true, deleted }
    } catch (error) {
        console.error("Error cleaning up orphaned images:", error)
        return { success: false, deleted, error: "Cleanup failed" }
    }
}

/**
 * Process the avatar deletion queue
 * This should be called periodically (e.g., via a cron job or admin action)
 * to delete avatars that were queued when profiles were deleted
 */
export async function processAvatarDeletionQueue(): Promise<{
    success: boolean
    processed: number
    error?: string
}> {
    const adminDb = await createAdminClient()
    let processed = 0

    try {
        // Fetch pending deletions (using type assertion since table may not exist in types)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: queue, error: fetchError } = await (adminDb as any)
            .from('avatar_deletion_queue')
            .select('id, avatar_url')
            .limit(100) as { data: { id: string; avatar_url: string }[] | null; error: { message: string } | null }

        if (fetchError) {
            // Table might not exist yet
            console.warn("Avatar deletion queue not found or error:", fetchError.message)
            return { success: true, processed: 0 }
        }

        if (!queue || queue.length === 0) {
            return { success: true, processed: 0 }
        }

        for (const item of queue) {
            // Delete the avatar from storage
            await deleteAvatarImage(item.avatar_url)

            // Remove from queue
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (adminDb as any)
                .from('avatar_deletion_queue')
                .delete()
                .eq('id', item.id)

            processed++
        }

        return { success: true, processed }
    } catch (error) {
        console.error("Error processing avatar deletion queue:", error)
        return { success: false, processed, error: "Processing failed" }
    }
}

/**
 * Upload a cafe image to Supabase Storage
 * File is stored at: cafes/{userId}/{timestamp}-{random}.{ext}
 * Used for both thumbnail and gallery images during cafe submission
 */
export async function uploadCafeImage(formData: FormData): Promise<{
    success: boolean
    url?: string
    error?: string
}> {
    const db = await createClient()

    // Get current user
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    const file = formData.get("image") as File | null
    if (!file) {
        return { success: false, error: "No file provided" }
    }

    // Validate file type
    const fileExt = file.name.split(".").pop()?.toLowerCase() || ""
    const isValidType = ["jpg", "jpeg", "png", "webp", "gif"].includes(fileExt)

    if (!isValidType) {
        return { success: false, error: "Invalid file type (JPEG, PNG, WebP, GIF only)" }
    }

    // Validate size
    if (file.size > MAX_CAFE_IMAGE_SIZE) {
        return { success: false, error: "File too large (max 5MB)" }
    }

    // Generate unique filename
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `${user.id}/${fileName}`

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
}



/**
 * Upload a review image to Supabase Storage
 * File is stored at: reviews/{userId}/{timestamp}-{random}.{ext}
 */
export async function uploadReviewImage(formData: FormData): Promise<{
    success: boolean
    url?: string
    error?: string
}> {
    const db = await createClient()

    // Get current user
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    const file = formData.get("image") as File | null
    if (!file) {
        return { success: false, error: "No file provided" }
    }

    // Validate file type
    const fileExt = file.name.split(".").pop()?.toLowerCase() || ""
    const isValidType = ["jpg", "jpeg", "png", "webp", "gif"].includes(fileExt)

    if (!isValidType) {
        return { success: false, error: "Invalid file type" }
    }

    // Limit size 5MB
    const MAX_REVIEW_IMAGE_SIZE = 5 * 1024 * 1024
    if (file.size > MAX_REVIEW_IMAGE_SIZE) {
        return { success: false, error: "File too large (max 5MB)" }
    }

    // Generate unique filename
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `${user.id}/${fileName}`

    const { error: uploadError } = await db.storage
        .from(REVIEW_BUCKET)
        .upload(filePath, file)

    if (uploadError) {
        console.error("Upload error:", uploadError)
        return { success: false, error: "Upload failed" }
    }

    const { data: urlData } = db.storage
        .from(REVIEW_BUCKET)
        .getPublicUrl(filePath)

    return { success: true, url: urlData.publicUrl }
}
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

/**
 * Upload an avatar to Supabase Storage
 * File is stored at: avatars/{userId}/{timestamp}.{ext}
 */
export async function uploadAvatar(formData: FormData): Promise<{
    success: boolean
    url?: string
    error?: string
}> {
    const db = await createClient()

    // Get current user
    const {
        data: { user },
    } = await db.auth.getUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    const file = formData.get("avatar") as File | null
    if (!file) {
        return { success: false, error: "No file provided" }
    }

    // Validate file type
    const fileExt = file.name.split(".").pop()?.toLowerCase() || ""
    const isValidType = ALLOWED_TYPES.includes(file.type) || ["jpg", "jpeg", "png", "webp", "gif"].includes(fileExt)

    if (!isValidType) {
        return { success: false, error: "Invalid file type (JPEG, PNG, WebP, GIF)" }
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
        return { success: false, error: "File too large (max 2MB)" }
    }

    // Generate unique filename
    const fileName = `${Date.now()}.${fileExt}`
    const filePath = `${user.id}/${fileName}`

    // Upload
    const { error: uploadError } = await db.storage
        .from(AVATAR_BUCKET)
        .upload(filePath, file, {
            upsert: true,
        })

    if (uploadError) {
        console.error("Upload error:", uploadError)
        return { success: false, error: "Upload failed" }
    }

    // Get public URL
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

    console.log("Avatar uploaded successfully:", avatarUrl)
    return { success: true, url: avatarUrl }
}

/**
 * Remove the current user's avatar
 */
export async function removeAvatar(): Promise<{
    success: boolean
    error?: string
}> {
    const db = await createClient()

    // Get current user
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    // List and delete all files in user's avatar folder
    const { data: existingFiles } = await db.storage
        .from(AVATAR_BUCKET)
        .list(user.id)

    if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles.map(f => `${user.id}/${f.name}`)
        await db.storage.from(AVATAR_BUCKET).remove(filesToDelete)
    }

    // Clear avatar_url in profile
    const { error: updateError } = await db
        .from("profiles")
        .update({
            avatar_url: null,
            updated_at: new Date().toISOString()
        })
        .eq("id", user.id)

    if (updateError) {
        return { success: false, error: "Failed to update profile" }
    }

    return { success: true }
}

/**
 * Upload a badge image to Supabase Storage (Admin only)
 * Requirements: PNG with transparency, 512x512px, max 500KB
 * File is stored at: badges/{timestamp}-{random}.png
 */
export async function uploadBadgeImage(formData: FormData): Promise<{
    success: boolean
    url?: string
    error?: string
}> {
    const db = await createClient()

    // Get current user and check admin status
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    // Check if user is admin
    const { data: profile } = await db
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

    if (!profile || !["admin", "moderator"].includes(profile.role || "")) {
        return { success: false, error: "Admin access required" }
    }

    const file = formData.get("image") as File | null
    if (!file) {
        return { success: false, error: "No file provided" }
    }

    // Validate PNG format
    const fileExt = file.name.split(".").pop()?.toLowerCase() || ""
    if (fileExt !== "png" && file.type !== "image/png") {
        return { success: false, error: "Badge images must be PNG format" }
    }

    // Validate size
    if (file.size > MAX_BADGE_FILE_SIZE) {
        return { success: false, error: "File too large (max 500KB)" }
    }

    // Validate dimensions by reading image
    try {
        const arrayBuffer = await file.arrayBuffer()
        const buffer = new Uint8Array(arrayBuffer)

        // PNG header check and dimension extraction
        // PNG signature: 89 50 4E 47 0D 0A 1A 0A
        const isPNG = buffer[0] === 0x89 && buffer[1] === 0x50 &&
            buffer[2] === 0x4E && buffer[3] === 0x47

        if (!isPNG) {
            return { success: false, error: "Invalid PNG file" }
        }

        // IHDR chunk starts at byte 8, width at bytes 16-19, height at bytes 20-23
        const width = (buffer[16] << 24) | (buffer[17] << 16) | (buffer[18] << 8) | buffer[19]
        const height = (buffer[20] << 24) | (buffer[21] << 16) | (buffer[22] << 8) | buffer[23]

        if (width !== BADGE_IMAGE_DIMENSION || height !== BADGE_IMAGE_DIMENSION) {
            return {
                success: false,
                error: `Badge images must be ${BADGE_IMAGE_DIMENSION}x${BADGE_IMAGE_DIMENSION}px (got ${width}x${height})`
            }
        }

        // Generate unique filename (stored at root level, not per-user)
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.png`

        // Use admin client to bypass potential RLS issues
        const adminDb = await createAdminClient()

        const { error: uploadError } = await adminDb.storage
            .from(BADGE_BUCKET)
            .upload(fileName, file, {
                contentType: "image/png"
            })

        if (uploadError) {
            console.error("Badge image upload error:", uploadError)
            return { success: false, error: "Upload failed" }
        }

        const { data: urlData } = adminDb.storage
            .from(BADGE_BUCKET)
            .getPublicUrl(fileName)

        return { success: true, url: urlData.publicUrl }

    } catch (error) {
        console.error("Error processing badge image:", error)
        return { success: false, error: "Failed to process image" }
    }
}

/**
 * Delete a badge image from storage (Admin only)
 */
export async function deleteBadgeImage(imageUrl: string): Promise<void> {
    if (!imageUrl) return

    const path = extractStoragePath(imageUrl, BADGE_BUCKET)
    if (path) {
        await deleteStorageFiles(BADGE_BUCKET, [path])
    }
}

// ============================================
// Blog Image Storage Functions
// ============================================

/**
 * Upload a blog cover image to Supabase Storage
 * File is stored at: blogs/{userId}/{timestamp}-{random}.{ext}
 * Used for blog post cover images (recommended 16:9 aspect ratio)
 */
export async function uploadBlogImage(formData: FormData): Promise<{
    success: boolean
    url?: string
    error?: string
}> {
    const db = await createClient()

    // Get current user
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    // Check if user is admin/mod or cafe owner
    const { data: profile } = await db
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

    const isAdminOrMod = profile?.role === "admin" || profile?.role === "moderator"

    // Check if cafe owner
    const { data: ownedCafes } = await db
        .from("cafes")
        .select("id")
        .contains("owner_ids", [user.id])
        .limit(1)

    const isCafeOwner = ownedCafes && ownedCafes.length > 0

    if (!isAdminOrMod && !isCafeOwner) {
        return { success: false, error: "Not authorized to upload blog images" }
    }

    const file = formData.get("image") as File | null
    if (!file) {
        return { success: false, error: "No file provided" }
    }

    // Validate file type
    const fileExt = file.name.split(".").pop()?.toLowerCase() || ""
    const isValidType = ["jpg", "jpeg", "png", "webp", "gif"].includes(fileExt)

    if (!isValidType) {
        return { success: false, error: "Invalid file type (JPEG, PNG, WebP, GIF only)" }
    }

    // Validate size
    if (file.size > MAX_BLOG_IMAGE_SIZE) {
        return { success: false, error: "File too large (max 5MB)" }
    }

    // Generate unique filename
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `${user.id}/${fileName}`

    // Use admin client to upload (bypass potential RLS issues)
    const adminDb = await createAdminClient()

    const { error: uploadError } = await adminDb.storage
        .from(BLOG_BUCKET)
        .upload(filePath, file)

    if (uploadError) {
        console.error("Blog image upload error:", uploadError)
        return { success: false, error: "Upload failed" }
    }

    const { data: urlData } = adminDb.storage
        .from(BLOG_BUCKET)
        .getPublicUrl(filePath)

    return { success: true, url: urlData.publicUrl }
}

/**
 * Delete a blog image from storage
 */
export async function deleteBlogImage(imageUrl: string): Promise<void> {
    if (!imageUrl) return

    const path = extractStoragePath(imageUrl, BLOG_BUCKET)
    if (path) {
        await deleteStorageFiles(BLOG_BUCKET, [path])
    }
}

/**
 * Delete all blog images for a post (cover + content images)
 */
export async function deleteBlogPostImages(coverImage: string | null): Promise<void> {
    if (coverImage) {
        await deleteBlogImage(coverImage)
    }
    // Note: Content images would need to be parsed from markdown and deleted
    // This is a simplified version that only handles cover images
}

// ============================================
// Event Image Storage Functions
// ============================================

/**
 * Upload an event cover image to Supabase Storage
 * File is stored at: events/{cafeId}/{timestamp}-{random}.{ext} or events/{userId}/{timestamp}-{random}.{ext}
 * Used for event cover images (recommended 16:9 aspect ratio)
 */
export async function uploadEventImage(formData: FormData, cafeId?: string): Promise<{
    success: boolean
    url?: string
    error?: string
}> {
    const db = await createClient()

    // Get current user
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    // Check if user is admin/mod
    const { data: profile } = await db
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

    const isAdminOrMod = profile?.role === "admin" || profile?.role === "moderator"

    // Check if cafe owner (if cafeId provided)
    let isCafeOwner = false
    if (cafeId) {
        const { data: cafe } = await db
            .from("cafes")
            .select("owner_ids")
            .eq("id", cafeId)
            .single()

        isCafeOwner = cafe?.owner_ids?.includes(user.id) || false
    }

    if (!isAdminOrMod && !isCafeOwner) {
        return { success: false, error: "Not authorized to upload event images" }
    }

    const file = formData.get("image") as File | null
    if (!file) {
        return { success: false, error: "No file provided" }
    }

    // Validate file type
    const fileExt = file.name.split(".").pop()?.toLowerCase() || ""
    const isValidType = ["jpg", "jpeg", "png", "webp", "gif"].includes(fileExt)

    if (!isValidType) {
        return { success: false, error: "Invalid file type (JPEG, PNG, WebP, GIF only)" }
    }

    // Validate size
    if (file.size > MAX_EVENT_IMAGE_SIZE) {
        return { success: false, error: "File too large (max 5MB)" }
    }

    // Generate unique filename
    // Use cafeId as folder if provided, otherwise use userId
    const folder = cafeId || user.id
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `${folder}/${fileName}`

    // Use admin client to upload (bypass potential RLS issues)
    const adminDb = await createAdminClient()

    const { error: uploadError } = await adminDb.storage
        .from(EVENT_BUCKET)
        .upload(filePath, file)

    if (uploadError) {
        console.error("Event image upload error:", uploadError)
        return { success: false, error: "Upload failed" }
    }

    const { data: urlData } = adminDb.storage
        .from(EVENT_BUCKET)
        .getPublicUrl(filePath)

    return { success: true, url: urlData.publicUrl }
}

/**
 * Delete an event image from storage
 */
export async function deleteEventImage(imageUrl: string): Promise<void> {
    if (!imageUrl) return

    const path = extractStoragePath(imageUrl, EVENT_BUCKET)
    if (path) {
        await deleteStorageFiles(EVENT_BUCKET, [path])
    }
}

// ============================================
// Menu Photo Storage Functions
// ============================================

const MAX_MENU_PHOTO_SIZE = 5 * 1024 * 1024 // 5MB

/**
 * Upload a menu photo to Supabase Storage (uses admin client to bypass RLS)
 * File is stored at: menu-photos/{cafeId}/{timestamp}-{random}.{ext}
 */
export async function uploadMenuPhoto(formData: FormData): Promise<{
    success: boolean
    url?: string
    error?: string
}> {
    const db = await createClient()

    // Get current user
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    const file = formData.get("image") as File | null
    const cafeId = formData.get("cafeId") as string | null

    if (!file) {
        return { success: false, error: "No file provided" }
    }

    if (!cafeId) {
        return { success: false, error: "No cafe ID provided" }
    }

    // Check if user is admin/mod or cafe owner
    const { data: profile } = await db
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

    const isAdminOrMod = profile?.role === "admin" || profile?.role === "moderator"

    // Check if cafe owner
    const { data: cafe } = await db
        .from("cafes")
        .select("owner_ids")
        .eq("id", cafeId)
        .single()

    const isCafeOwner = cafe?.owner_ids?.includes(user.id) || false

    if (!isAdminOrMod && !isCafeOwner) {
        return { success: false, error: "Not authorized to upload menu photos for this cafe" }
    }

    // Validate file type (check both extension and MIME type)
    const fileExt = file.name.split(".").pop()?.toLowerCase() || ""
    const validExtensions = ["jpg", "jpeg", "png", "webp", "gif"]
    const validMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    const isValidType = validExtensions.includes(fileExt) || validMimeTypes.includes(file.type)

    if (!isValidType) {
        console.log("Invalid file:", { name: file.name, type: file.type, ext: fileExt })
        return { success: false, error: "Invalid file type (JPEG, PNG, WebP, GIF only)" }
    }

    // Determine extension to use for filename
    const uploadExt = fileExt && validExtensions.includes(fileExt) ? fileExt :
        file.type === "image/jpeg" ? "jpg" :
            file.type === "image/png" ? "png" :
                file.type === "image/webp" ? "webp" :
                    file.type === "image/gif" ? "gif" : "webp"

    // Validate size
    if (file.size > MAX_MENU_PHOTO_SIZE) {
        return { success: false, error: "File too large (max 5MB)" }
    }

    // Generate unique filename
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${uploadExt}`
    const filePath = `${cafeId}/${fileName}`

    // Use admin client to upload (bypass RLS/JWT issues)
    const adminDb = await createAdminClient()

    const { error: uploadError } = await adminDb.storage
        .from(MENU_PHOTOS_BUCKET)
        .upload(filePath, file)

    if (uploadError) {
        console.error("Menu photo upload error:", uploadError)
        return { success: false, error: "Upload failed" }
    }

    const { data: urlData } = adminDb.storage
        .from(MENU_PHOTOS_BUCKET)
        .getPublicUrl(filePath)

    return { success: true, url: urlData.publicUrl }
}

/**
 * Delete a menu photo from storage
 */
export async function deleteMenuPhoto(imageUrl: string): Promise<void> {
    if (!imageUrl) return

    const path = extractStoragePath(imageUrl, MENU_PHOTOS_BUCKET)
    if (path) {
        await deleteStorageFiles(MENU_PHOTOS_BUCKET, [path])
    }
}
