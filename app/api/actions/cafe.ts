/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase relational queries return complex nested types that require any for flattening */
"use server"

import { getDayOfYear } from "@/utils/featured"
import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"
import { CafeFilters, CafeWithRatings } from "@/utils/types/extra"

export async function getCafeBySlug(slug: string) {
    const db = await createClient()
    const { data: cafe, error } = await db
        .from("cafes")
        .select(`
            *,
            cafe_rating_stats(average_rating, total_reviews),
            cafe_stories(*)
        `)
        .eq("slug", slug)
        .single()

    if (error || !cafe) return null

    // Flatten result
    const flatCafe = {
        ...(cafe as any),
        average_rating: (cafe as any).cafe_rating_stats?.average_rating ?? null,
        total_reviews: (cafe as any).cafe_rating_stats?.total_reviews ?? null,
        story: (cafe as any).cafe_stories?.[0] ?? null
    }
    delete (flatCafe as any).cafe_rating_stats
    delete (flatCafe as any).cafe_stories

    return flatCafe as CafeWithRatings
}

export async function getDailyFeatured() {
    const db = await createClient()
    const now = new Date().toISOString()

    // 1. Priority: Manual Schedule
    const { data: scheduled } = await db
        .from("featured_schedules")
        .select(`
            *,
            cafe:cafes(*, cafe_rating_stats(average_rating, total_reviews))
        `)
        .eq("slot_type", "hero")
        .eq("is_active", true)
        .lte("start_date", now)
        .gte("end_date", now)
        .order("priority", { ascending: false })
        .limit(1)
        .maybeSingle()

    if ((scheduled as any)?.cafe) {
        const c = (scheduled as any).cafe
        const flat = {
            ...c,
            average_rating: c.cafe_rating_stats?.average_rating ?? null,
            total_reviews: c.cafe_rating_stats?.total_reviews ?? null
        }
        delete flat.cafe_rating_stats
        return flat as CafeWithRatings
    }

    // 2. Fallback: Algorithmic Selection
    // Since we need to order by rating, we join cafe_rating_stats and order by its column
    const { data: cafes } = await db
        .from("cafes")
        .select(`
            *,
            cafe_rating_stats(average_rating, total_reviews)
        `)
        .eq("is_published", true)
        .order("average_rating", { referencedTable: 'cafe_rating_stats', ascending: false })
        .limit(10) // Fetch a pool to rotate

    if (!cafes?.length) return null

    const dayOfYear = getDayOfYear(new Date())
    const selected = cafes[dayOfYear % cafes.length] as any

    const flatSelected = {
        ...selected,
        average_rating: selected.cafe_rating_stats?.average_rating ?? null,
        total_reviews: selected.cafe_rating_stats?.total_reviews ?? null
    }
    delete flatSelected.cafe_rating_stats

    return flatSelected as CafeWithRatings
}

/**
 * Get featured cafe based on user's location (city/region)
 * Priority: 1) Manual schedule for user's region, 2) City match, 3) Region match
 */
export async function getLocationFeatured(city?: string, region?: string): Promise<CafeWithRatings | null> {
    if (!city && !region) return null

    const db = await createClient()
    const now = new Date().toISOString()
    const dayOfYear = getDayOfYear(new Date())

    // 1. Check for manual schedule matching user's location (region_context)
    if (region) {
        const { data: scheduled } = await db
            .from("featured_schedules")
            .select(`
                *,
                cafe:cafes(*, cafe_rating_stats(average_rating, total_reviews))
            `)
            .eq("slot_type", "hero")
            .eq("is_active", true)
            .ilike("region_context", `%${region}%`)
            .lte("start_date", now)
            .gte("end_date", now)
            .order("priority", { ascending: false })
            .limit(1)
            .maybeSingle()

        if ((scheduled as any)?.cafe) {
            const c = (scheduled as any).cafe
            const flat = {
                ...c,
                average_rating: c.cafe_rating_stats?.average_rating ?? null,
                total_reviews: c.cafe_rating_stats?.total_reviews ?? null
            }
            delete flat.cafe_rating_stats
            return flat as CafeWithRatings
        }
    }

    // 2. Try city_municipality algorithmic match
    if (city) {
        const { data: cityCafes } = await db
            .from("cafes")
            .select("*, cafe_rating_stats(average_rating, total_reviews)")
            .eq("is_published", true)
            .ilike("city_municipality", `%${city}%`)
            .order("average_rating", { referencedTable: 'cafe_rating_stats', ascending: false })
            .limit(10)

        if (cityCafes?.length) {
            const selected = cityCafes[dayOfYear % cityCafes.length] as any
            const flat = {
                ...selected,
                average_rating: selected.cafe_rating_stats?.average_rating ?? null,
                total_reviews: selected.cafe_rating_stats?.total_reviews ?? null
            }
            delete flat.cafe_rating_stats
            return flat as CafeWithRatings
        }
    }

    // 3. Fallback to region algorithmic match
    if (region) {
        const { data: regionCafes } = await db
            .from("cafes")
            .select("*, cafe_rating_stats(average_rating, total_reviews)")
            .eq("is_published", true)
            .ilike("region", `%${region}%`)
            .order("average_rating", { referencedTable: 'cafe_rating_stats', ascending: false })
            .limit(10)

        if (regionCafes?.length) {
            const selected = regionCafes[dayOfYear % regionCafes.length] as any
            const flat = {
                ...selected,
                average_rating: selected.cafe_rating_stats?.average_rating ?? null,
                total_reviews: selected.cafe_rating_stats?.total_reviews ?? null
            }
            delete flat.cafe_rating_stats
            return flat as CafeWithRatings
        }
    }

    return null
}

export async function getAllCafes(
    page: number = 1,
    limit: number = 12,
    filters: CafeFilters = {}
) {
    const db = await createClient()
    const from = (page - 1) * limit
    const to = from + limit - 1

    // Use RPC for Full-Text Search if query exists
    if (filters.search) {
        const { data: searchResults } = await db.rpc('search_cafes', {
            query_text: filters.search
        } as any)
        // Search results might miss ratings, return as is for now or fetch ratings separately. 
        // For simplicity and to match type, we'll assume null ratings if missing.
        return (searchResults || []).slice(from, to + 1).map(c => ({
            ...(c as any),
            average_rating: null,
            total_reviews: null
        })) as CafeWithRatings[]
    }

    let query = db
        .from("cafes")
        .select("*, cafe_rating_stats(average_rating, total_reviews)")
        .eq("is_published", true)

    // Filters
    if (filters.has_wifi) query = query.eq("has_wifi", true)
    if (filters.has_sockets) query = query.eq("has_sockets", true)
    if (filters.has_parking) query = query.eq("has_parking", true)
    if (filters.has_aircon) query = query.eq("has_aircon", true)
    if (filters.is_pet_friendly) query = query.eq("is_pet_friendly", true)
    if (filters.has_outdoor_seating) query = query.eq("has_outdoor_seating", true)
    if (filters.is_work_friendly) query = query.eq("is_work_friendly", true)
    if (filters.price_level) query = query.eq("price_level", filters.price_level)
    if (filters.region) query = query.eq("region", filters.region)

    // Sorting
    switch (filters.sortBy) {
        case "rating":
            query = query.order("average_rating", { referencedTable: 'cafe_rating_stats', ascending: false })
            break
        case "reviews":
            query = query.order("total_reviews", { referencedTable: 'cafe_rating_stats', ascending: false })
            break
        default:
            query = query.order("created_at", { ascending: false })
    }

    const { data: cafes } = await query.range(from, to)

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
 * Get reviews for a specific cafe
 */
export async function getReviewsByCafeId(cafeId: string) {
    const db = await createClient()
    const { data: reviews } = await db
        .from("reviews")
        .select(`
            id,
            rating,
            comment,
            created_at,
            user_id,
            images,
            likes_count,
            review_interactions(user_id, interaction_type),
            author:profiles(display_name, username, avatar_url)
        `)
        .eq("cafe_id", cafeId)
        .eq("status", "published")
        .order("created_at", { ascending: false })

    return reviews || []
}

/**
 * Simple search for cafe name existence check during submission
 */
export async function searchCafesSimple(query: string) {
    if (!query || query.length < 3) return []

    const db = await createAdminClient()

    // Fuzzy search by name using ilike
    const { data: cafes, error } = await db
        .from("cafes")
        .select("id, name, slug, address_display, thumbnail, is_published")
        .ilike("name", `%${query}%`)
        .limit(5)

    if (error) {
        console.error("[searchCafesSimple] Error:", error)
        return []
    }

    return cafes || []
}