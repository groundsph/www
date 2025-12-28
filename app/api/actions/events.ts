"use server"

import { createClient } from "@/utils/supabase/server"
import { Event, EventWithCafe, EventFilters } from "@/utils/types/extra"

/**
 * Get events with optional filtering
 */
export async function getEvents(
    filters: EventFilters = {},
    page: number = 1,
    pageSize: number = 20
): Promise<{ events: EventWithCafe[]; total: number }> {
    const supabase = await createClient()

    let query = supabase
        .from("events")
        .select(
            `
            *,
            cafe:cafes!cafe_id (
                id,
                name,
                slug,
                thumbnail
            ),
            creator:profiles!created_by (
                id,
                display_name,
                avatar_url
            )
        `,
            { count: "exact" }
        )
        .eq("status", filters.status ?? "published")
        .order("start_date", { ascending: true })

    // Apply filters
    if (filters.city) {
        query = query.eq("city", filters.city)
    }
    if (filters.region) {
        query = query.eq("region", filters.region)
    }
    if (filters.is_national !== undefined) {
        query = query.eq("is_national", filters.is_national)
    }
    if (filters.start_after) {
        query = query.gte("start_date", filters.start_after)
    }
    if (filters.start_before) {
        query = query.lte("start_date", filters.start_before)
    }

    // Pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
        console.error("Error fetching events:", error)
        return { events: [], total: 0 }
    }

    return {
        events: (data as unknown as EventWithCafe[]) || [],
        total: count || 0,
    }
}

/**
 * Get a single event by ID
 */
export async function getEvent(id: string): Promise<EventWithCafe | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from("events")
        .select(
            `
            *,
            cafe:cafes!cafe_id (
                id,
                name,
                slug,
                thumbnail
            ),
            creator:profiles!created_by (
                id,
                display_name,
                avatar_url
            )
        `
        )
        .eq("id", id)
        .single()

    if (error) {
        console.error("Error fetching event:", error)
        return null
    }

    return data as unknown as EventWithCafe
}

/**
 * Get upcoming events (next 30 days by default)
 */
export async function getUpcomingEvents(
    limit: number = 10
): Promise<EventWithCafe[]> {
    const supabase = await createClient()
    const now = new Date().toISOString()

    const { data, error } = await supabase
        .from("events")
        .select(
            `
            *,
            cafe:cafes!cafe_id (
                id,
                name,
                slug,
                thumbnail
            ),
            creator:profiles!created_by (
                id,
                display_name,
                avatar_url
            )
        `
        )
        .eq("status", "published")
        .gte("start_date", now)
        .order("start_date", { ascending: true })
        .limit(limit)

    if (error) {
        console.error("Error fetching upcoming events:", error)
        return []
    }

    return (data as unknown as EventWithCafe[]) || []
}

/**
 * Get events for a specific month (for calendar view)
 */
export async function getEventsForMonth(
    year: number,
    month: number, // 0-indexed (0 = January)
    filters: Pick<EventFilters, "city" | "region" | "is_national"> = {}
): Promise<Event[]> {
    const supabase = await createClient()

    // First day of month
    const startDate = new Date(year, month, 1).toISOString()
    // First day of next month
    const endDate = new Date(year, month + 1, 1).toISOString()

    let query = supabase
        .from("events")
        .select("*")
        .eq("status", "published")
        .gte("start_date", startDate)
        .lt("start_date", endDate)
        .order("start_date", { ascending: true })

    if (filters.city) {
        query = query.eq("city", filters.city)
    }
    if (filters.region) {
        query = query.eq("region", filters.region)
    }
    if (filters.is_national !== undefined) {
        query = query.eq("is_national", filters.is_national)
    }

    const { data, error } = await query

    if (error) {
        console.error("Error fetching events for month:", error)
        return []
    }

    return (data as Event[]) || []
}

/**
 * Get local events based on user's city/region
 */
export async function getLocalEvents(
    city?: string,
    region?: string,
    limit: number = 10
): Promise<EventWithCafe[]> {
    const supabase = await createClient()
    const now = new Date().toISOString()

    let query = supabase
        .from("events")
        .select(
            `
            *,
            cafe:cafes!cafe_id (
                id,
                name,
                slug,
                thumbnail
            ),
            creator:profiles!created_by (
                id,
                display_name,
                avatar_url
            )
        `
        )
        .eq("status", "published")
        .eq("is_national", false)
        .gte("start_date", now)
        .order("start_date", { ascending: true })
        .limit(limit)

    // Prioritize city match, fallback to region
    if (city) {
        query = query.eq("city", city)
    } else if (region) {
        query = query.eq("region", region)
    }

    const { data, error } = await query

    if (error) {
        console.error("Error fetching local events:", error)
        return []
    }

    return (data as unknown as EventWithCafe[]) || []
}

/**
 * Get national events
 */
export async function getNationalEvents(
    limit: number = 10
): Promise<EventWithCafe[]> {
    const supabase = await createClient()
    const now = new Date().toISOString()

    const { data, error } = await supabase
        .from("events")
        .select(
            `
            *,
            cafe:cafes!cafe_id (
                id,
                name,
                slug,
                thumbnail
            ),
            creator:profiles!created_by (
                id,
                display_name,
                avatar_url
            )
        `
        )
        .eq("status", "published")
        .eq("is_national", true)
        .gte("start_date", now)
        .order("start_date", { ascending: true })
        .limit(limit)

    if (error) {
        console.error("Error fetching national events:", error)
        return []
    }

    return (data as unknown as EventWithCafe[]) || []
}
