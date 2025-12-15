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

// Paginated cafes
export async function getAllCafes(page: number = 1, limit: number = 12) {
    const db = await createClient()
    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data: cafes } = await db
        .from("cafes")
        .select("*")
        .eq("is_active", true)
        .eq("is_verified", true)
        .order("created_at", { ascending: false })
        .range(from, to)

    return cafes as Cafe[]
}
