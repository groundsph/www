/**
 * Storage Provider Factory
 * 
 * This module creates and returns the appropriate storage provider
 * based on environment configuration. Currently using Cloudflare R2.
 */

import type { StorageProvider } from "./types"

export type StorageProviderType = "cloudflare-r2"

/**
 * Get the configured storage provider (Cloudflare R2)
 */
export async function getStorageProvider(): Promise<StorageProvider> {
    const { getCloudflareR2Provider } = await import("./providers/cloudflare-r2")
    return getCloudflareR2Provider()
}

/**
 * Get the name of the currently configured storage provider
 */
export function getStorageProviderName(): StorageProviderType {
    return "cloudflare-r2"
}

/**
 * Check if the application is configured to use Cloudflare R2
 */
export function isUsingR2(): boolean {
    return true
}
