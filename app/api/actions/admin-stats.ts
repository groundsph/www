"use server"

import { createClient } from "@/utils/supabase/server"
import { getStorageProvider, STORAGE_BUCKETS, type StorageBucket } from "@/utils/storage"

export interface SystemStats {
    system: {
        users_count: number
        db_size_bytes: number
    }
    storage: {
        total_bytes: number
        buckets: {
            cafes: number
            reviews: number
            avatars: number
            blogs: number
            badges: number
            menu_photos: number
            events: number
            ownership_proofs: number
        }
        storage_limit_bytes?: number
        storage_left_bytes?: number
        provider?: string
    }
    business: {
        cafes_total: number
        cafes_verified: number
        cafes_published: number
        reviews_total: number
        blog_posts_total: number
        pending_claims: number
    }
}

export interface StatsResult {
    success: boolean
    data?: SystemStats
    error?: string
}

/**
 * Get storage stats from the configured provider (R2 or Supabase)
 */
async function getStorageStats(): Promise<{
    total_bytes: number
    buckets: {
        cafes: number
        reviews: number
        avatars: number
        blogs: number
        badges: number
        menu_photos: number
        events: number
        ownership_proofs: number
    }
    provider: string
}> {
    const storage = await getStorageProvider()

    const buckets: StorageBucket[] = [
        STORAGE_BUCKETS.CAFES,
        STORAGE_BUCKETS.REVIEWS,
        STORAGE_BUCKETS.AVATARS,
        STORAGE_BUCKETS.BLOGS,
        STORAGE_BUCKETS.BADGES,
        STORAGE_BUCKETS.MENU_PHOTOS,
        STORAGE_BUCKETS.EVENTS,
        STORAGE_BUCKETS.OWNERSHIP_PROOFS,
    ]

    const bucketSizes: Record<string, number> = {
        cafes: 0,
        reviews: 0,
        avatars: 0,
        blogs: 0,
        badges: 0,
        menu_photos: 0,
        events: 0,
        ownership_proofs: 0,
    }

    // Map bucket names to stats keys
    const bucketKeyMap: Record<StorageBucket, keyof typeof bucketSizes> = {
        "cafes": "cafes",
        "reviews": "reviews",
        "avatars": "avatars",
        "blogs": "blogs",
        "badges": "badges",
        "menu-photos": "menu_photos",
        "events": "events",
        "ownership-proofs": "ownership_proofs",
    }

    // Fetch sizes for each bucket
    for (const bucket of buckets) {
        try {
            const listResult = await storage.list(bucket, { limit: 10000 })
            if (listResult.success && listResult.files) {
                const size = listResult.files.reduce((sum, file) => sum + (file.size || 0), 0)
                const key = bucketKeyMap[bucket]
                bucketSizes[key] = size
            }
        } catch (error) {
            console.warn(`Failed to get size for bucket ${bucket}:`, error)
        }
    }

    const total_bytes = Object.values(bucketSizes).reduce((sum, size) => sum + size, 0)

    return {
        total_bytes,
        buckets: bucketSizes as {
            cafes: number
            reviews: number
            avatars: number
            blogs: number
            badges: number
            menu_photos: number
            events: number
            ownership_proofs: number
        },
        provider: storage.name,
    }
}

/**
 * Fetch system stats using the admin RPC function and provider storage stats
 * Only accessible by admins and moderators
 */
export async function getSystemStats(): Promise<StatsResult> {
    const db = await createClient()

    // 1. Verify Authentication
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    // 2. Verify Role
    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        return { success: false, error: "Unauthorized access" }
    }

    // 3. Call RPC function for system & business stats
    const { data, error } = await db.rpc('get_admin_stats')

    if (error) {
        console.error("Error fetching admin stats:", error)
        return { success: false, error: "Failed to fetch stats" }
    }

    const stats = data as unknown as SystemStats

    // 4. Get storage stats from provider (R2 or Supabase)
    try {
        const storageStats = await getStorageStats()

        // Replace SQL-based storage stats with provider-based stats
        stats.storage = {
            total_bytes: storageStats.total_bytes,
            buckets: storageStats.buckets,
            provider: storageStats.provider,
        }
    } catch (error) {
        console.warn("Failed to get storage stats from provider, using DB stats:", error)
        // Fall back to stats from DB if provider fails
    }

    // 5. Calculate storage limits (R2 has 10GB free tier)
    const isR2 = stats.storage?.provider === "cloudflare-r2"
    const STORAGE_LIMIT_GB = isR2 ? 10 : 1 // R2 = 10GB free, Supabase = 1GB free
    const STORAGE_LIMIT_BYTES = STORAGE_LIMIT_GB * 1024 * 1024 * 1024

    if (stats && stats.storage) {
        stats.storage.storage_limit_bytes = STORAGE_LIMIT_BYTES
        stats.storage.storage_left_bytes = Math.max(0, STORAGE_LIMIT_BYTES - stats.storage.total_bytes)
    }

    return { success: true, data: stats }
}

