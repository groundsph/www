"use server"

import { createClient } from "@/utils/supabase/server"

const AVATAR_BUCKET = "avatars"
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

/**
 * Upload a user's avatar to Supabase Storage
 * File is stored at: avatars/{userId}/avatar.{ext}
 */
export async function uploadAvatar(formData: FormData): Promise<{
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

    const file = formData.get("avatar") as File | null
    if (!file) {
        return { success: false, error: "No file provided" }
    }

    // Validate file type - check both file.type and extension for canvas blobs
    const fileExt = file.name.split(".").pop()?.toLowerCase() || ""
    const isValidType = ALLOWED_TYPES.includes(file.type) ||
        ["jpg", "jpeg", "png", "webp", "gif"].includes(fileExt)

    if (!isValidType) {
        return { success: false, error: "Invalid file type. Use JPEG, PNG, WebP, or GIF" }
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
        return { success: false, error: "File too large. Maximum 2MB" }
    }

    // Always use jpg since we convert on client side
    const filePath = `${user.id}/avatar.jpg`

    console.log("Uploading avatar to:", filePath, "Size:", file.size)

    // Upload new avatar (upsert will overwrite existing)
    const { error: uploadError } = await db.storage
        .from(AVATAR_BUCKET)
        .upload(filePath, file, {
            upsert: true,
            contentType: "image/jpeg"
        })

    if (uploadError) {
        console.error("Upload error:", uploadError)
        return { success: false, error: `Upload failed: ${uploadError.message}` }
    }

    // Get public URL with cache buster
    const { data: urlData } = db.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(filePath)

    // Add timestamp to bust cache
    const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`

    // Update profile with new avatar URL
    const { error: updateError } = await (db
        .from("profiles") as any)
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
    const { error: updateError } = await (db
        .from("profiles") as any)
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
