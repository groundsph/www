/**
 * Supabase Storage Provider Implementation
 * 
 * This provider wraps the existing Supabase storage functionality,
 * maintaining backward compatibility during the migration to Cloudflare R2.
 */

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import type {
    StorageProvider,
    StorageBucket,
    UploadOptions,
    UploadResult,
    DeleteResult,
    ListOptions,
    ListResult,
    SignedUrlResult,
    StorageFileObject,
} from "../types"

export class SupabaseStorageProvider implements StorageProvider {
    readonly name = "supabase"

    /**
     * Extract storage path from a Supabase storage public URL
     * Example URL: https://xxx.supabase.co/storage/v1/object/public/cafes/userId/file.jpg
     * Returns: userId/file.jpg
     */
    extractPathFromUrl(url: string, bucket: StorageBucket): string | null {
        try {
            const pattern = new RegExp(`/storage/v1/object/public/${bucket}/(.+)`)
            const match = url.match(pattern)
            if (match && match[1]) {
                // Remove query params (like cache busters)
                return match[1].split("?")[0]
            }
            return null
        } catch {
            return null
        }
    }

    async upload(
        bucket: StorageBucket,
        path: string,
        file: File | Blob | Buffer,
        options?: UploadOptions
    ): Promise<UploadResult> {
        try {
            const db = await createClient()

            const uploadOptions: { upsert?: boolean; contentType?: string } = {}
            if (options?.upsert) uploadOptions.upsert = true
            if (options?.contentType) uploadOptions.contentType = options.contentType

            const { error: uploadError } = await db.storage
                .from(bucket)
                .upload(path, file, uploadOptions)

            if (uploadError) {
                console.error(`[Supabase Storage] Upload error for ${bucket}/${path}:`, uploadError)
                return { success: false, error: uploadError.message }
            }

            const { data: urlData } = db.storage.from(bucket).getPublicUrl(path)

            return {
                success: true,
                path,
                url: urlData.publicUrl,
            }
        } catch (error) {
            console.error(`[Supabase Storage] Upload exception for ${bucket}/${path}:`, error)
            return {
                success: false,
                error: error instanceof Error ? error.message : "Upload failed",
            }
        }
    }

    async delete(bucket: StorageBucket, paths: string[]): Promise<DeleteResult> {
        if (paths.length === 0) {
            return { success: true, deleted: 0 }
        }

        try {
            const adminDb = await createAdminClient()
            const { error } = await adminDb.storage.from(bucket).remove(paths)

            if (error) {
                console.error(`[Supabase Storage] Delete error for ${bucket}:`, error)
                return { success: false, error: error.message }
            }

            return { success: true, deleted: paths.length }
        } catch (error) {
            console.error(`[Supabase Storage] Delete exception for ${bucket}:`, error)
            return {
                success: false,
                error: error instanceof Error ? error.message : "Delete failed",
            }
        }
    }

    getPublicUrl(bucket: StorageBucket, path: string): string {
        // For server-side calls, we construct the URL directly
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        if (!supabaseUrl) {
            throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured")
        }
        return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`
    }

    async createSignedUrl(
        bucket: StorageBucket,
        path: string,
        expiresIn: number
    ): Promise<SignedUrlResult> {
        try {
            const adminDb = await createAdminClient()
            const { data, error } = await adminDb.storage
                .from(bucket)
                .createSignedUrl(path, expiresIn)

            if (error || !data) {
                console.error(`[Supabase Storage] Signed URL error for ${bucket}/${path}:`, error)
                return { success: false, error: error?.message || "Failed to create signed URL" }
            }

            return {
                success: true,
                signedUrl: data.signedUrl,
                expiresAt: new Date(Date.now() + expiresIn * 1000),
            }
        } catch (error) {
            console.error(`[Supabase Storage] Signed URL exception for ${bucket}/${path}:`, error)
            return {
                success: false,
                error: error instanceof Error ? error.message : "Failed to create signed URL",
            }
        }
    }

    async list(bucket: StorageBucket, options?: ListOptions): Promise<ListResult> {
        try {
            const adminDb = await createAdminClient()

            const { data, error } = await adminDb.storage.from(bucket).list(options?.prefix || "", {
                limit: options?.limit || 1000,
                offset: options?.offset || 0,
            })

            if (error) {
                console.error(`[Supabase Storage] List error for ${bucket}:`, error)
                return { success: false, error: error.message }
            }

            const files: StorageFileObject[] = (data || []).map((item) => ({
                name: item.name,
                path: options?.prefix ? `${options.prefix}/${item.name}` : item.name,
                size: item.metadata?.size || 0,
                lastModified: new Date(item.updated_at || item.created_at),
                contentType: item.metadata?.mimetype,
                isDirectory: item.id === null, // Folders have null id in Supabase
            }))

            return {
                success: true,
                files,
                hasMore: (data?.length || 0) === (options?.limit || 1000),
            }
        } catch (error) {
            console.error(`[Supabase Storage] List exception for ${bucket}:`, error)
            return {
                success: false,
                error: error instanceof Error ? error.message : "List failed",
            }
        }
    }
}

/**
 * Singleton instance for server-side usage
 */
let _instance: SupabaseStorageProvider | null = null

export function getSupabaseStorageProvider(): SupabaseStorageProvider {
    if (!_instance) {
        _instance = new SupabaseStorageProvider()
    }
    return _instance
}
