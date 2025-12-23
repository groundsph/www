'use server'

import { createClient } from "@/utils/supabase/server"
import { CafeWithRatings } from "@/utils/types/extra"

/**
 * Check if the current user has admin or moderator role
 */
export async function isAdmin(): Promise<boolean> {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()

    if (!user) return false

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    return profile?.role === 'admin' || profile?.role === 'moderator'
}

/**
 * Get all pending (unpublished) cafe submissions
 * Only accessible by admins/moderators
 */
export async function getPendingCafes(): Promise<CafeWithRatings[]> {
    const db = await createClient()

    // Verify admin access
    const { data: { user } } = await db.auth.getUser()
    if (!user) return []

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        return []
    }

    // Fetch pending cafes with contributor info
    const { data: cafes, error } = await db
        .from('cafes')
        .select(`
            *,
            contributor:profiles!cafes_contributor_id_fkey(
                id,
                username,
                display_name,
                avatar_url
            )
        `)
        .eq('is_published', false)
        .order('created_at', { ascending: false })

    if (error) {
        console.error("Error fetching pending cafes:", error)
        return []
    }

    return cafes as unknown as CafeWithRatings[]
}

export interface AdminActionResult {
    success: boolean
    error?: string
}

/**
 * Approve a cafe submission (set is_published = true)
 */
export async function approveCafe(cafeId: string): Promise<AdminActionResult> {
    const db = await createClient()

    // Verify admin access
    const { data: { user } } = await db.auth.getUser()
    if (!user) return { success: false, error: "Not authenticated" }

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    const { error } = await db
        .from('cafes')
        .update({
            is_published: true,
            is_verified: true
        })
        .eq('id', cafeId)

    if (error) {
        console.error("Error approving cafe:", error)
        return { success: false, error: "Failed to approve cafe" }
    }

    return { success: true }
}

/**
 * Reject a cafe submission (delete it)
 */
export async function rejectCafe(cafeId: string): Promise<AdminActionResult> {
    const db = await createClient()

    // Verify admin access
    const { data: { user } } = await db.auth.getUser()
    if (!user) return { success: false, error: "Not authenticated" }

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    const { error } = await db
        .from('cafes')
        .delete()
        .eq('id', cafeId)

    if (error) {
        console.error("Error rejecting cafe:", error)
        return { success: false, error: "Failed to reject cafe" }
    }

    return { success: true }
}

/**
 * Get a single cafe by ID (for admin preview/edit)
 */
export async function getCafeById(cafeId: string): Promise<CafeWithRatings | null> {
    const db = await createClient()

    // Verify admin access
    const { data: { user } } = await db.auth.getUser()
    if (!user) return null

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        return null
    }

    const { data: cafe, error } = await db
        .from('cafes')
        .select(`
            *,
            contributor:profiles!cafes_contributor_id_fkey(
                id,
                username,
                display_name,
                avatar_url
            )
        `)
        .eq('id', cafeId)
        .single()

    if (error) {
        console.error("Error fetching cafe:", error)
        return null
    }

    return cafe as unknown as CafeWithRatings
}

/**
 * Update cafe details (admin only)
 */
export async function updateCafe(
    cafeId: string,
    updates: Partial<{
        name: string
        description: string
        address_display: string
        area: string
        lat: number
        lng: number
        has_wifi: boolean
        has_sockets: boolean
        has_parking: boolean
        has_aircon: boolean
        is_pet_friendly: boolean
        has_outdoor_seating: boolean
        serves_food: boolean
        is_work_friendly: boolean
        price_level: "low" | "medium" | "high"
        specialty: string[]
        tags: string[]
        brew_methods: string[]
        payment_methods: string
        roaster: string
        operating_hours: Record<string, unknown>[] | null
        website_url: string
        phone: string
        email: string
        socials: Record<string, unknown>[] | null
    }>
): Promise<AdminActionResult> {
    const db = await createClient()

    // Verify admin access
    const { data: { user } } = await db.auth.getUser()
    if (!user) return { success: false, error: "Not authenticated" }

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    const { error } = await db
        .from('cafes')
        .update(updates as Record<string, unknown>)
        .eq('id', cafeId)

    if (error) {
        console.error("Error updating cafe:", error)
        return { success: false, error: "Failed to update cafe" }
    }

    return { success: true }
}

/**
 * Get all published cafes (for admin management)
 */
export async function getPublishedCafes(): Promise<CafeWithRatings[]> {
    const db = await createClient()

    // Verify admin access
    const { data: { user } } = await db.auth.getUser()
    if (!user) return []

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        return []
    }

    const { data: cafes, error } = await db
        .from('cafes')
        .select(`
            *,
            contributor:profiles!cafes_contributor_id_fkey(
                id,
                username,
                display_name,
                avatar_url
            )
        `)
        .eq('is_published', true)
        .order('name', { ascending: true })

    if (error) {
        console.error("Error fetching published cafes:", error)
        return []
    }

    return cafes as unknown as CafeWithRatings[]
}

/**
 * Unpublish a cafe (set is_published = false)
 */
export async function unpublishCafe(cafeId: string): Promise<AdminActionResult> {
    const db = await createClient()

    // Verify admin access
    const { data: { user } } = await db.auth.getUser()
    if (!user) return { success: false, error: "Not authenticated" }

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    const { error } = await db
        .from('cafes')
        .update({
            is_published: false
        })
        .eq('id', cafeId)

    if (error) {
        console.error("Error unpublishing cafe:", error)
        return { success: false, error: "Failed to unpublish cafe" }
    }

    return { success: true }
}

/**
 * Get cafe story by cafe ID
 */
export async function getCafeStory(cafeId: string): Promise<{ id: string; content: string } | null> {
    const db = await createClient()

    // Verify admin access
    const { data: { user } } = await db.auth.getUser()
    if (!user) return null

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        return null
    }

    const { data: story, error } = await db
        .from('cafe_stories')
        .select('id, content')
        .eq('cafe_id', cafeId)
        .single()

    if (error) {
        // No story exists, that's ok
        return null
    }

    return story
}

/**
 * Create or update cafe story
 */
export async function upsertCafeStory(
    cafeId: string,
    content: string
): Promise<AdminActionResult> {
    const db = await createClient()

    // Verify admin access
    const { data: { user } } = await db.auth.getUser()
    if (!user) return { success: false, error: "Not authenticated" }

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    // Check if story exists
    const { data: existing } = await db
        .from('cafe_stories')
        .select('id')
        .eq('cafe_id', cafeId)
        .single()

    if (existing) {
        // Update existing story
        const { error } = await db
            .from('cafe_stories')
            .update({ content, updated_at: new Date().toISOString() })
            .eq('id', existing.id)

        if (error) {
            console.error("Error updating cafe story:", error)
            return { success: false, error: "Failed to update story" }
        }
    } else {
        // Create new story
        const { error } = await db
            .from('cafe_stories')
            .insert({ cafe_id: cafeId, content })

        if (error) {
            console.error("Error creating cafe story:", error)
            return { success: false, error: "Failed to create story" }
        }
    }

    return { success: true }
}

/**
 * Delete cafe story
 */
export async function deleteCafeStory(cafeId: string): Promise<AdminActionResult> {
    const db = await createClient()

    // Verify admin access
    const { data: { user } } = await db.auth.getUser()
    if (!user) return { success: false, error: "Not authenticated" }

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    const { error } = await db
        .from('cafe_stories')
        .delete()
        .eq('cafe_id', cafeId)

    if (error) {
        console.error("Error deleting cafe story:", error)
        return { success: false, error: "Failed to delete story" }
    }

    return { success: true }
}
