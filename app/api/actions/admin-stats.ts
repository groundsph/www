"use server"

import { createClient } from "@/utils/supabase/server"

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
 * Fetch system stats using the admin RPC function
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

    // 3. Call RPC function
    // We use the authenticated client, assuming the user has permission to call this RPC
    // OR the RPC is defined with SECURITY DEFINER and revoked from public, strictly controlled?
    // The RPC is 'security definer', so it bypasses RLS within the function execution.
    // However, we need to ensure the user CAN call it. By default, 'public' might have execute permission.
    // Ideally, we should use admin client to call it if it's restricted, or rely on the function logic.
    // Since we're doing a role check in code, calling it with the user's client is fine provided the function is accessible.
    // But to be safe and robust against RLS/permission issues on the function itself, 
    // we can use the admin client? Actually, 'createClient' is sufficient if the function is exposed.
    // The plan said "Call `supabase.rpc('get_admin_stats')`".

    // Default limit: 1GB (can be overridden by env var per project if needed)
    // Supabase Free Tier is 1GB. Pro starts at 100GB.
    const STORAGE_LIMIT_GB = 1
    const STORAGE_LIMIT_BYTES = STORAGE_LIMIT_GB * 1024 * 1024 * 1024

    // Remove @ts-ignore as types should be synced now
    const { data, error } = await db.rpc('get_admin_stats')

    if (error) {
        console.error("Error fetching admin stats:", error)
        return { success: false, error: "Failed to fetch stats" }
    }

    const stats = data as unknown as SystemStats

    // Calculate storage left
    if (stats && stats.storage) {
        stats.storage.storage_limit_bytes = STORAGE_LIMIT_BYTES
        stats.storage.storage_left_bytes = Math.max(0, STORAGE_LIMIT_BYTES - stats.storage.total_bytes)
    }

    return { success: true, data: stats }
}
