"use server"

import { dummyCafes } from "@/utils/dummy/cafes"
import { getDayOfYear } from "@/utils/featured"
import { createClient } from "@/utils/supabase/server"

const db = await createClient()

export async function getCafeBySlug(slug: string) {
    // Utilize dummy data for now
    const cafe = dummyCafes.find((cafe) => cafe.slug === slug)
    return cafe
}

export async function getDailyFeatured() {
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
