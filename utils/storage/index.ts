/**
 * Storage Module - Provider Agnostic Storage Utilities
 * 
 * This module exports all storage-related types, interfaces, and utilities.
 * Use getStorageProvider() to get the configured storage provider instance.
 * 
 * Example usage:
 * ```typescript
 * import { getStorageProvider, STORAGE_BUCKETS } from '@/utils/storage'
 * 
 * const storage = await getStorageProvider()
 * const result = await storage.upload(STORAGE_BUCKETS.CAFES, 'path/to/file.jpg', file)
 * ```
 */

// Types and interfaces
export type {
    StorageProvider,
    StorageBucket,
    UploadOptions,
    UploadResult,
    DeleteResult,
    ListOptions,
    ListResult,
    SignedUrlResult,
    StorageFileObject,
    BucketConfig,
} from "./types"

// Constants
export { STORAGE_BUCKETS, BUCKET_CONFIGS } from "./types"

// Factory
export {
    getStorageProvider,
    getStorageProviderName,
    isUsingR2,
    isUsingSupabase,
    type StorageProviderType,
} from "./factory"

// Re-export providers for direct access if needed
export { getSupabaseStorageProvider } from "./providers/supabase"
// Note: R2 provider is loaded dynamically to avoid dependency issues

// Helpers
export {
    validateFile,
    generateFilePath,
    generateCafeFilePath,
    generateRootFilePath,
    addCacheBuster,
    stripQueryParams,
    formatFileSize,
    getFileExtension,
    isPlaceholderUrl,
} from "./helpers"

// Server Actions (use these from Server Components or Server Actions)
export {
    uploadCafeImageAction,
    deleteCafeImagesAction,
    deleteSingleCafeImageAction,
    uploadReviewImageAction,
    deleteReviewImagesAction,
    uploadAvatarAction,
    removeAvatarAction,
    uploadBadgeImageAction,
    deleteBadgeImageAction,
    uploadBlogImageAction,
    deleteBlogImageAction,
    uploadEventImageAction,
    deleteEventImageAction,
    uploadMenuPhotoAction,
    deleteMenuPhotoAction,
    uploadOwnershipProofAction,
    getOwnershipProofSignedUrlAction,
    type UploadResponse,
    type DeleteResponse,
} from "./actions"

// Client utilities (use these from Client Components)
// Note: These are re-exported but should be imported directly
// from "@/utils/storage/client" in client components
