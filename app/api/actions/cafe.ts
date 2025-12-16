"use server"

import { getDayOfYear } from "@/utils/featured"
import { createClient } from "@/utils/supabase/server"
import { Cafe } from "@/utils/types/cafe"

export async function getCafeBySlug(slug: string) {
    const db = await createClient()
    const { data: cafe } = await db
        .from("cafes")
        .select("*")
        .eq("slug", slug)
        .single()
    if (!cafe) return null

    return cafe as Cafe
}

export async function getDailyFeatured() {
    const db = await createClient()
    const today = new Date().toISOString().split("T")[0]

    // Check if today has manually set featured cafe
    const { data: scheduled } = await db
        .from("featured_cafes")
        .select("cafe_id, cafes(*)")
        .eq("featured_date", today)
        .single()

    if (scheduled) return scheduled.cafes

    // If not, Auto-select based on date
    const { data: cafes } = await db
        .from("cafes")
        .select("*")
        .eq("is_active", true)
        .eq("is_verified", true)
        .order("rating", { ascending: false })

    if (!cafes?.length) return null

    const dayOfYear = getDayOfYear(new Date())

    return cafes[dayOfYear % cafes.length]
}

export async function getRecentAdditions() {
    const db = await createClient()
    const { data: cafes } = await db
        .from("cafes")
        .select("*")
        .eq("is_active", true)
        .eq("is_verified", true)
        .order("created_at", { ascending: false })
        .limit(10)
    return cafes as Cafe[]
}

// Filter options for getAllCafes
export interface CafeFilters {
    has_wifi?: boolean
    has_sockets?: boolean
    has_parking?: boolean
    has_aircon?: boolean
    is_pet_friendly?: boolean
    has_outdoor_seating?: boolean
    price_level?: "low" | "medium" | "high"
    search?: string
    sortBy?: "recommended" | "rating" | "reviews" | "price_low" | "price_high"
}

// Paginated cafes with filters
export async function getAllCafes(
    page: number = 1,
    limit: number = 12,
    filters: CafeFilters = {}
) {
    const db = await createClient()
    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = db
        .from("cafes")
        .select("*")
        .eq("is_active", true)
        .eq("is_verified", true)

    // Apply amenity filters
    if (filters.has_wifi) query = query.eq("has_wifi", true)
    if (filters.has_sockets) query = query.eq("has_sockets", true)
    if (filters.has_parking) query = query.eq("has_parking", true)
    if (filters.has_aircon) query = query.eq("has_aircon", true)
    if (filters.is_pet_friendly) query = query.eq("is_pet_friendly", true)
    if (filters.has_outdoor_seating) query = query.eq("has_outdoor_seating", true)
    if (filters.price_level) query = query.eq("price_level", filters.price_level)

    // Apply text search (searches name and address)
    if (filters.search) {
        query = query.or(
            `name.ilike.%${filters.search}%,address_display.ilike.%${filters.search}%`
        )
    }

    // Apply sorting
    switch (filters.sortBy) {
        case "rating":
            query = query.order("rating", { ascending: false })
            break
        case "reviews":
            query = query.order("reviews", { ascending: false })
            break
        case "price_low":
            query = query.order("price_level", { ascending: true })
            break
        case "price_high":
            query = query.order("price_level", { ascending: false })
            break
        default:
            query = query.order("created_at", { ascending: false })
    }

    const { data: cafes } = await query.range(from, to)

    return cafes as Cafe[]
}
