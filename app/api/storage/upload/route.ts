import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import {
    getStorageProvider,
    STORAGE_BUCKETS,
    validateFile,
    generateFilePath,
    generateCafeFilePath,
    type StorageBucket,
} from "@/utils/storage"

/**
 * POST /api/storage/upload
 * 
 * Handles file uploads with progress tracking support.
 * This route accepts multipart form data and uploads to the configured
 * storage provider (Supabase or R2).
 */
export async function POST(request: NextRequest) {
    try {
        // Auth check
        const db = await createClient()
        const { data: { user } } = await db.auth.getUser()

        if (!user) {
            return NextResponse.json(
                { success: false, error: "Not authenticated" },
                { status: 401 }
            )
        }

        // Parse form data
        const formData = await request.formData()
        const file = formData.get("file") as File | null
        const bucket = formData.get("bucket") as StorageBucket | null
        const cafeId = formData.get("cafeId") as string | null

        if (!file) {
            return NextResponse.json(
                { success: false, error: "No file provided" },
                { status: 400 }
            )
        }

        if (!bucket || !Object.values(STORAGE_BUCKETS).includes(bucket)) {
            return NextResponse.json(
                { success: false, error: "Invalid bucket" },
                { status: 400 }
            )
        }

        // Validate file
        const validation = validateFile(file, bucket)
        if (!validation.valid) {
            return NextResponse.json(
                { success: false, error: validation.error },
                { status: 400 }
            )
        }

        // Generate path based on bucket type
        let path: string
        switch (bucket) {
            case STORAGE_BUCKETS.MENU_PHOTOS:
                if (!cafeId) {
                    return NextResponse.json(
                        { success: false, error: "cafeId required for menu photos" },
                        { status: 400 }
                    )
                }
                path = generateCafeFilePath(cafeId, file.name)
                break
            case STORAGE_BUCKETS.EVENTS:
                path = generateCafeFilePath(cafeId || user.id, file.name)
                break
            case STORAGE_BUCKETS.BADGES:
                // Badges stored at root level
                const ext = file.name.split(".").pop()?.toLowerCase() || "png"
                path = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`
                break
            default:
                path = generateFilePath(user.id, file.name)
        }

        // Upload to storage provider
        const storage = await getStorageProvider()
        const result = await storage.upload(bucket, path, file, {
            contentType: file.type,
        })

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error || "Upload failed" },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            url: result.url,
            path: result.path,
        })

    } catch (error) {
        console.error("[API] Storage upload error:", error)
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        )
    }
}

export const config = {
    api: {
        bodyParser: false,
    },
}
