"use server"

import { db } from "@/db"
import { profiles, cafes, reviews, blogPosts, cafeClaims } from "@/db/schema"
import { eq, count } from "drizzle-orm"
import { sql } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
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
            collections: number
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
 * Get storage stats from the configured provider (R2)
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
        collections: number
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
        STORAGE_BUCKETS.COLLECTIONS,
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
        collections: 0,
        crawls: 0,
    }

    const bucketKeyMap: Record<StorageBucket, keyof typeof bucketSizes> = {
        cafes: "cafes",
        reviews: "reviews",
        avatars: "avatars",
        blogs: "blogs",
        badges: "badges",
        "menu-photos": "menu_photos",
        events: "events",
        "ownership-proofs": "ownership_proofs",
        collections: "collections",
        crawls: "crawls",
    }

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
            collections: number
            crawls: number
        },
        provider: storage.name,
    }
}

/**
 * Fetch system stats using Drizzle queries
 * Only accessible by admins and moderators
 */
export async function getSystemStats(): Promise<StatsResult> {
    // 1. Verify Authentication
    const user = await getCurrentUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    // 2. Verify Role
    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, user.id))
        .limit(1)

    const role = profileResult[0]?.role
    if (role !== "admin" && role !== "moderator") {
        return { success: false, error: "Unauthorized access" }
    }

    try {
        // 3. Fetch all stats with parallel Drizzle queries
        const [
            usersCountResult,
            dbSizeResult,
            cafesTotalResult,
            cafesVerifiedResult,
            cafesPublishedResult,
            reviewsTotalResult,
            blogPostsTotalResult,
            pendingClaimsResult,
        ] = await Promise.all([
            // User count
            db.select({ count: count() }).from(profiles),
            // DB size (approximate via pg_database_size)
            db.execute(sql`SELECT pg_database_size(current_database()) as size`),
            // Total cafes
            db.select({ count: count() }).from(cafes),
            // Verified cafes
            db.select({ count: count() }).from(cafes).where(eq(cafes.isVerified, true)),
            // Published cafes
            db.select({ count: count() }).from(cafes).where(eq(cafes.isPublished, true)),
            // Total reviews
            db.select({ count: count() }).from(reviews),
            // Total blog posts
            db.select({ count: count() }).from(blogPosts),
            // Pending claims
            db.select({ count: count() }).from(cafeClaims).where(eq(cafeClaims.status, "pending")),
        ])

        // 4. Get storage stats from R2
        const storageStats = await getStorageStats()

        // 5. Calculate storage limits (R2 has 10GB free tier)
        const isR2 = storageStats.provider === "cloudflare-r2"
        const STORAGE_LIMIT_GB = isR2 ? 10 : 1
        const STORAGE_LIMIT_BYTES = STORAGE_LIMIT_GB * 1024 * 1024 * 1024

        const stats: SystemStats = {
            system: {
                users_count: usersCountResult[0]?.count ?? 0,
                db_size_bytes: Number((dbSizeResult.rows[0] as { size: string })?.size ?? 0),
            },
            storage: {
                total_bytes: storageStats.total_bytes,
                buckets: storageStats.buckets,
                provider: storageStats.provider,
                storage_limit_bytes: STORAGE_LIMIT_BYTES,
                storage_left_bytes: Math.max(0, STORAGE_LIMIT_BYTES - storageStats.total_bytes),
            },
            business: {
                cafes_total: cafesTotalResult[0]?.count ?? 0,
                cafes_verified: cafesVerifiedResult[0]?.count ?? 0,
                cafes_published: cafesPublishedResult[0]?.count ?? 0,
                reviews_total: reviewsTotalResult[0]?.count ?? 0,
                blog_posts_total: blogPostsTotalResult[0]?.count ?? 0,
                pending_claims: pendingClaimsResult[0]?.count ?? 0,
            },
        }

        return { success: true, data: stats }
    } catch (error) {
        console.error("Error fetching admin stats:", error)
        return { success: false, error: "Failed to fetch stats" }
    }
}
