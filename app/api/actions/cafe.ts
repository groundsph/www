"use server"

import { getDayOfYear } from "@/utils/featured"
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
    if (filters.price_level) query = query.eq("price_level", filters.price_level)

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