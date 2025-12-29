/**
 * Storage Provider Factory
 * 
 * This module creates and returns the appropriate storage provider
 * based on environment configuration. Switch providers by setting
 * the STORAGE_PROVIDER environment variable.
 */

import type { StorageProvider } from "./types"

export type StorageProviderType = "supabase" | "cloudflare-r2"

/**
 * Get the configured storage provider
 * 
 * Set STORAGE_PROVIDER environment variable to:
 * - "supabase" (default) - Use Supabase Storage
 * - "cloudflare-r2" - Use Cloudflare R2
 */
export async function getStorageProvider(): Promise<StorageProvider> {
    const providerType = (process.env.STORAGE_PROVIDER || "supabase") as StorageProviderType

    switch (providerType) {
        case "cloudflare-r2": {
            // Dynamic import to avoid loading R2 dependencies when not needed
            const { getCloudflareR2Provider } = await import("./providers/cloudflare-r2")
            return getCloudflareR2Provider()
        }
        case "supabase":
        default: {
            const { getSupabaseStorageProvider } = await import("./providers/supabase")
            return getSupabaseStorageProvider()
        }
    }
}

/**
 * Get the name of the currently configured storage provider
 */
export function getStorageProviderName(): StorageProviderType {
    return (process.env.STORAGE_PROVIDER || "supabase") as StorageProviderType
}

/**
 * Check if the application is configured to use Cloudflare R2
 */
export function isUsingR2(): boolean {
    return process.env.STORAGE_PROVIDER === "cloudflare-r2"
}

/**
 * Check if the application is configured to use Supabase Storage
 */
export function isUsingSupabase(): boolean {
    return !process.env.STORAGE_PROVIDER || process.env.STORAGE_PROVIDER === "supabase"
}
