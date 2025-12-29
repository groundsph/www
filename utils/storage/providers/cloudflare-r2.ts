/**
 * Cloudflare R2 Storage Provider Implementation
 * 
 * This provider uses the S3-compatible API to interact with Cloudflare R2.
 * It requires the @aws-sdk/client-s3 package for S3 protocol compatibility.
 * 
 * Required environment variables:
 * - R2_ACCOUNT_ID: Cloudflare account ID
 * - R2_ACCESS_KEY_ID: R2 API access key
 * - R2_SECRET_ACCESS_KEY: R2 API secret key
 * - R2_BUCKET_NAME: The R2 bucket name (or use per-"bucket" prefixes)
 * - R2_PUBLIC_URL: Public URL base for accessing files (e.g., https://cdn.yourdomain.com)
 */

import {
    S3Client,
    PutObjectCommand,
    DeleteObjectsCommand,
    ListObjectsV2Command,
    GetObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
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

/**
 * R2 Configuration
 * 
 * Since R2 typically uses a single bucket, we use prefixes to simulate
 * multiple "buckets" (e.g., "cafes/userId/file.jpg")
 */
interface R2Config {
    accountId: string
    accessKeyId: string
    secretAccessKey: string
    bucketName: string
    publicUrl: string
}

function getR2Config(): R2Config {
    const accountId = process.env.R2_ACCOUNT_ID
    const accessKeyId = process.env.R2_ACCESS_KEY_ID
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
    const bucketName = process.env.R2_BUCKET_NAME
    const publicUrl = process.env.R2_PUBLIC_URL

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
        throw new Error(
            "Missing R2 configuration. Required: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL"
        )
    }

    return { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl }
}

function createR2Client(config: R2Config): S3Client {
    return new S3Client({
        region: "auto",
        endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
        },
    })
}

export class CloudflareR2Provider implements StorageProvider {
    readonly name = "cloudflare-r2"
    private client: S3Client
    private config: R2Config

    constructor() {
        this.config = getR2Config()
        this.client = createR2Client(this.config)
    }

    /**
     * Build the full object key including bucket prefix
     * e.g., bucket="cafes", path="userId/file.jpg" -> "cafes/userId/file.jpg"
     */
    private getObjectKey(bucket: StorageBucket, path: string): string {
        return `${bucket}/${path}`
    }

    /**
     * Extract storage path from a Cloudflare R2 public URL
     * Example URL: https://cdn.yourdomain.com/cafes/userId/file.jpg
     * Returns: userId/file.jpg
     */
    extractPathFromUrl(url: string, bucket: StorageBucket): string | null {
        try {
            const publicUrl = this.config.publicUrl.replace(/\/$/, "")
            const pattern = new RegExp(`^${publicUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/${bucket}/(.+)`)
            const match = url.match(pattern)
            if (match && match[1]) {
                // Remove query params
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
            const key = this.getObjectKey(bucket, path)

            // Convert file to Buffer if needed
            let body: Buffer
            if (Buffer.isBuffer(file)) {
                body = file
            } else if (file instanceof Blob) {
                const arrayBuffer = await file.arrayBuffer()
                body = Buffer.from(arrayBuffer)
            } else {
                const arrayBuffer = await (file as File).arrayBuffer()
                body = Buffer.from(arrayBuffer)
            }

            // Determine content type
            let contentType = options?.contentType
            if (!contentType && file instanceof File) {
                contentType = file.type || "application/octet-stream"
            }
            if (!contentType) {
                contentType = "application/octet-stream"
            }

            const command = new PutObjectCommand({
                Bucket: this.config.bucketName,
                Key: key,
                Body: body,
                ContentType: contentType,
                Metadata: options?.metadata,
            })

            await this.client.send(command)

            const publicUrl = this.getPublicUrl(bucket, path)

            return {
                success: true,
                path,
                url: publicUrl,
            }
        } catch (error) {
            console.error(`[R2 Storage] Upload error for ${bucket}/${path}:`, error)
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
            // R2 supports batch delete up to 1000 objects
            const objects = paths.map((p) => ({ Key: this.getObjectKey(bucket, p) }))

            const command = new DeleteObjectsCommand({
                Bucket: this.config.bucketName,
                Delete: { Objects: objects },
            })

            const result = await this.client.send(command)

            return {
                success: true,
                deleted: result.Deleted?.length || 0,
            }
        } catch (error) {
            console.error(`[R2 Storage] Delete error for ${bucket}:`, error)
            return {
                success: false,
                error: error instanceof Error ? error.message : "Delete failed",
            }
        }
    }

    getPublicUrl(bucket: StorageBucket, path: string): string {
        const publicUrl = this.config.publicUrl.replace(/\/$/, "")
        return `${publicUrl}/${bucket}/${path}`
    }

    async createSignedUrl(
        bucket: StorageBucket,
        path: string,
        expiresIn: number
    ): Promise<SignedUrlResult> {
        try {
            const key = this.getObjectKey(bucket, path)

            const command = new GetObjectCommand({
                Bucket: this.config.bucketName,
                Key: key,
            })

            const signedUrl = await getSignedUrl(this.client, command, { expiresIn })

            return {
                success: true,
                signedUrl,
                expiresAt: new Date(Date.now() + expiresIn * 1000),
            }
        } catch (error) {
            console.error(`[R2 Storage] Signed URL error for ${bucket}/${path}:`, error)
            return {
                success: false,
                error: error instanceof Error ? error.message : "Failed to create signed URL",
            }
        }
    }

    async list(bucket: StorageBucket, options?: ListOptions): Promise<ListResult> {
        try {
            const prefix = options?.prefix
                ? this.getObjectKey(bucket, options.prefix)
                : `${bucket}/`

            const command = new ListObjectsV2Command({
                Bucket: this.config.bucketName,
                Prefix: prefix,
                MaxKeys: options?.limit || 1000,
            })

            const result = await this.client.send(command)

            const files: StorageFileObject[] = (result.Contents || []).map((item) => {
                const fullKey = item.Key || ""
                // Remove the bucket prefix to get the relative path
                const relativePath = fullKey.replace(`${bucket}/`, "")
                const name = relativePath.split("/").pop() || relativePath

                return {
                    name,
                    path: relativePath,
                    size: item.Size || 0,
                    lastModified: item.LastModified || new Date(),
                    isDirectory: false,
                }
            })

            return {
                success: true,
                files,
                hasMore: result.IsTruncated || false,
            }
        } catch (error) {
            console.error(`[R2 Storage] List error for ${bucket}:`, error)
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
let _instance: CloudflareR2Provider | null = null

export function getCloudflareR2Provider(): CloudflareR2Provider {
    if (!_instance) {
        _instance = new CloudflareR2Provider()
    }
    return _instance
}
