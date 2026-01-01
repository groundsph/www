/**
 * Storage Provider Abstraction Types
 * 
 * This module defines the interface for storage providers, allowing
 * the application to switch between Supabase Storage and Cloudflare R2
 * (or other S3-compatible providers) without changing business logic.
 */

/**
 * Options for file upload operations
 */
export interface UploadOptions {
    /** MIME type of the file */
    contentType?: string
    /** If true, overwrites existing file at the same path */
    upsert?: boolean
    /** Progress callback for client-side uploads (0-100) */
    onProgress?: (progress: number) => void
    /** Custom metadata to attach to the file */
    metadata?: Record<string, string>
}

/**
 * Result of an upload operation
 */
export interface UploadResult {
    success: boolean
    /** Path where the file was stored (relative to bucket) */
    path?: string
    /** Public URL to access the file (for public buckets) */
    url?: string
    /** Error message if upload failed */
    error?: string
}

/**
 * Result of a delete operation
 */
export interface DeleteResult {
    success: boolean
    /** Number of files successfully deleted */
    deleted?: number
    /** Error message if deletion failed */
    error?: string
}

/**
 * File object returned from list operations
 */
export interface StorageFileObject {
    /** File name */
    name: string
    /** Full path within the bucket */
    path: string
    /** File size in bytes */
    size: number
    /** Last modified timestamp */
    lastModified: Date
    /** MIME type if available */
    contentType?: string
    /** Whether this is a directory/prefix */
    isDirectory: boolean
}

/**
 * Options for listing files
 */
export interface ListOptions {
    /** Maximum number of results to return */
    limit?: number
    /** Pagination offset */
    offset?: number
    /** Only return files matching this prefix */
    prefix?: string
}

/**
 * Result of a list operation
 */
export interface ListResult {
    success: boolean
    files?: StorageFileObject[]
    /** Whether there are more results available */
    hasMore?: boolean
    error?: string
}

/**
 * Result of a signed URL generation
 */
export interface SignedUrlResult {
    success: boolean
    /** The signed URL */
    signedUrl?: string
    /** URL expiration timestamp */
    expiresAt?: Date
    error?: string
}

/**
 * Storage bucket configuration
 */
export interface BucketConfig {
    /** Bucket name/identifier */
    name: string
    /** Whether the bucket allows public access */
    isPublic: boolean
    /** Maximum file size in bytes */
    maxFileSize?: number
    /** Allowed file extensions (without dot) */
    allowedExtensions?: string[]
    /** Allowed MIME types */
    allowedMimeTypes?: string[]
}

/**
 * The storage buckets used by the application
 */
export const STORAGE_BUCKETS = {
    CAFES: 'cafes',
    REVIEWS: 'reviews',
    AVATARS: 'avatars',
    BLOGS: 'blogs',
    EVENTS: 'events',
    MENU_PHOTOS: 'menu-photos',
    BADGES: 'badges',
    OWNERSHIP_PROOFS: 'ownership-proofs',
    COLLECTIONS: 'collections',
} as const

export type StorageBucket = typeof STORAGE_BUCKETS[keyof typeof STORAGE_BUCKETS]

/**
 * Bucket configurations with their access settings
 */
export const BUCKET_CONFIGS: Record<StorageBucket, BucketConfig> = {
    [STORAGE_BUCKETS.CAFES]: {
        name: STORAGE_BUCKETS.CAFES,
        isPublic: true,
        maxFileSize: 5 * 1024 * 1024, // 5MB
        allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    },
    [STORAGE_BUCKETS.REVIEWS]: {
        name: STORAGE_BUCKETS.REVIEWS,
        isPublic: true,
        maxFileSize: 5 * 1024 * 1024,
        allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    },
    [STORAGE_BUCKETS.AVATARS]: {
        name: STORAGE_BUCKETS.AVATARS,
        isPublic: true,
        maxFileSize: 2 * 1024 * 1024, // 2MB
        allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    },
    [STORAGE_BUCKETS.BLOGS]: {
        name: STORAGE_BUCKETS.BLOGS,
        isPublic: true,
        maxFileSize: 5 * 1024 * 1024,
        allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    },
    [STORAGE_BUCKETS.EVENTS]: {
        name: STORAGE_BUCKETS.EVENTS,
        isPublic: true,
        maxFileSize: 5 * 1024 * 1024,
        allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    },
    [STORAGE_BUCKETS.MENU_PHOTOS]: {
        name: STORAGE_BUCKETS.MENU_PHOTOS,
        isPublic: true,
        maxFileSize: 5 * 1024 * 1024,
        allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    },
    [STORAGE_BUCKETS.BADGES]: {
        name: STORAGE_BUCKETS.BADGES,
        isPublic: true,
        maxFileSize: 500 * 1024, // 500KB
        allowedExtensions: ['png'],
    },
    [STORAGE_BUCKETS.OWNERSHIP_PROOFS]: {
        name: STORAGE_BUCKETS.OWNERSHIP_PROOFS,
        isPublic: false, // Private bucket - requires signed URLs
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
    },
    [STORAGE_BUCKETS.COLLECTIONS]: {
        name: STORAGE_BUCKETS.COLLECTIONS,
        isPublic: true,
        maxFileSize: 5 * 1024 * 1024, // 5MB
        allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    },
}

/**
 * Storage provider interface
 * 
 * Implementations of this interface handle the actual storage operations
 * for a specific provider (Supabase, Cloudflare R2, etc.)
 */
export interface StorageProvider {
    /**
     * Provider name for logging and debugging
     */
    readonly name: string

    /**
     * Upload a file to storage
     * 
     * @param bucket - The bucket to upload to
     * @param path - The path within the bucket (e.g., "userId/filename.jpg")
     * @param file - The file data (File, Blob, or Buffer)
     * @param options - Upload options
     */
    upload(
        bucket: StorageBucket,
        path: string,
        file: File | Blob | Buffer,
        options?: UploadOptions
    ): Promise<UploadResult>

    /**
     * Delete files from storage
     * 
     * @param bucket - The bucket to delete from
     * @param paths - Array of paths to delete
     */
    delete(bucket: StorageBucket, paths: string[]): Promise<DeleteResult>

    /**
     * Get the public URL for a file
     * Only works for public buckets
     * 
     * @param bucket - The bucket name
     * @param path - The file path within the bucket
     */
    getPublicUrl(bucket: StorageBucket, path: string): string

    /**
     * Create a signed URL for temporary access to a file
     * Required for private buckets, optional for public ones
     * 
     * @param bucket - The bucket name
     * @param path - The file path within the bucket
     * @param expiresIn - Seconds until the URL expires
     */
    createSignedUrl(
        bucket: StorageBucket,
        path: string,
        expiresIn: number
    ): Promise<SignedUrlResult>

    /**
     * List files in a bucket
     * 
     * @param bucket - The bucket to list
     * @param options - List options (prefix, limit, offset)
     */
    list(bucket: StorageBucket, options?: ListOptions): Promise<ListResult>

    /**
     * Extract the storage path from a full URL
     * This is provider-specific since URL formats differ
     * 
     * @param url - The full URL
     * @param bucket - The bucket the file is in
     * @returns The path within the bucket, or null if URL format doesn't match
     */
    extractPathFromUrl(url: string, bucket: StorageBucket): string | null
}
