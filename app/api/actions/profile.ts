"use server"

import { createClient } from "@/utils/supabase/server"
import { CafeWithRatings, ProfilePassport, ProfileStats, ProfileWithBadges, Tables } from "@/utils/types/extra"

/**
 * Get a user's profile with their earned badges
 */
export async function getProfileWithBadges(userId: string): Promise<ProfileWithBadges | null> {
    const db = await createClient()

    // Fetch profile
    const { data: profile, error: profileError } = await db
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single()

    if (profileError || !profile) return null

    // Fetch user's badges with badge definitions
    const { data: userBadges } = await db
        .from("user_badges")
        .select(`
            *,
            badge:badge_definitions(*)
        `)
        .eq("user_id", userId)

    return {
        ...(profile as any),
        stats: (profile as any).stats as ProfileStats | null,
        passport: (profile as any).passport as ProfilePassport | null,
        badges: (userBadges || []) as ProfileWithBadges['badges']
    }
}

/**
 * Get all available badge definitions
 */
export async function getAllBadges(): Promise<Tables<'badge_definitions'>[]> {
    const db = await createClient()

    const { data: badges } = await db
        .from("badge_definitions")
        .select("*")
        .order("rarity", { ascending: true })
        .order("name", { ascending: true })

    return badges || []
}

/**
 * Update user's profile
 */
export async function updateProfile(data: {
    display_name?: string
    bio?: string
    avatar_url?: string
}): Promise<{ success: boolean; error?: string }> {
    const db = await createClient()

    // Get current user
    const { data: { user } } = await db.auth.getUser()
    if (!user) return { success: false, error: "Not authenticated" }

    // Build update payload
    const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString()
    }
    if (data.display_name !== undefined) updatePayload.display_name = data.display_name
    if (data.bio !== undefined) updatePayload.bio = data.bio
    if (data.avatar_url !== undefined) updatePayload.avatar_url = data.avatar_url

    const { error } = await (db
        .from("profiles") as any)
        .update(updatePayload)
        .eq("id", user.id)

    if (error) return { success: false, error: error.message }

    return { success: true }
}

/**
 * Get cafes by their IDs (for passport visited/wishlist)
 */
export async function getCafesByIds(ids: string[]): Promise<CafeWithRatings[]> {
    if (!ids.length) return []

    const db = await createClient()

    const { data: cafes } = await db
        .from("cafes")
        .select("*, cafe_rating_stats(average_rating, total_reviews)")
        .in("id", ids)

    return (cafes || []).map((c: any) => {
        const flat = {
            ...c,
            average_rating: c.cafe_rating_stats?.average_rating ?? null,
            total_reviews: c.cafe_rating_stats?.total_reviews ?? null
        }
        delete flat.cafe_rating_stats
        return flat
    }) as CafeWithRatings[]
}

/**
 * Get a user's public profile by username
 */
export async function getProfileByUsername(username: string): Promise<ProfileWithBadges | null> {
    const db = await createClient()

    // Fetch profile by username
    const { data: profile, error: profileError } = await db
        .from("profiles")
        .select("*")
        .eq("username", username)
        .single()

    if (profileError || !profile) return null

    // Fetch user's badges with badge definitions
    const { data: userBadges } = await db
        .from("user_badges")
        .select(`
            *,
            badge:badge_definitions(*)
        `)
        .eq("user_id", profile.id)

    return {
        ...(profile as any),
        stats: (profile as any).stats as ProfileStats | null,
        passport: (profile as any).passport as ProfilePassport | null,
        badges: (userBadges || []) as ProfileWithBadges['badges']
    }
}

/**
 * Get a user's reviews with cafe info
 */
export async function getUserReviews(userId: string): Promise<{
    id: string
    rating: number
    comment: string
    created_at: string | null
    cafe: { name: string; slug: string; thumbnail: string } | null
}[]> {
    const db = await createClient()

    const { data: reviews } = await db
        .from("reviews")
        .select(`
            id,
            rating,
            comment,
            created_at,
            cafe:cafes(name, slug, thumbnail)
        `)
        .eq("user_id", userId)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(20)

    return (reviews || []).map((r: any) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        created_at: r.created_at,
        cafe: r.cafe
    }))
}
