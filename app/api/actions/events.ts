"use server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { Event, EventWithCafe, EventFilters, EventStatus } from "@/utils/types/extra"

// Event input type for create/update operations
export interface EventInput {
    title: string
    description?: string | null
    start_date: string
    end_date?: string | null
    location_name?: string | null
    address?: string | null
    city?: string | null
    province?: string | null
    region?: string | null
    cafe_id?: string | null
    image_url?: string | null
    ticket_link?: string | null
    is_national?: boolean
    status?: EventStatus
}

export interface EventActionResult {
    success: boolean
    error?: string
    event?: EventWithCafe
}

// ============================================
// Helper Functions
// ============================================

async function isAdminOrModerator(): Promise<boolean> {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return false

    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

    return profile?.role === "admin" || profile?.role === "moderator"
}

async function isCafeOwner(cafeId: string): Promise<boolean> {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return false

    const { data: cafe } = await supabase
        .from("cafes")
        .select("owner_ids")
        .eq("id", cafeId)
        .single()

    return cafe?.owner_ids?.includes(user.id) || false
}

async function getCurrentUserId(): Promise<string | null> {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    return user?.id || null
}

async function canManageEvent(event: Event): Promise<boolean> {
    const userId = await getCurrentUserId()
    if (!userId) return false

    // Admin/mod can manage any event
    if (await isAdminOrModerator()) return true

    // Creator can manage their own event
    if (event.created_by === userId) return true

    // Cafe owner can manage cafe events
    if (event.cafe_id && (await isCafeOwner(event.cafe_id))) return true

    return false
}

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

// ============================================
// Create/Update/Delete Operations
// ============================================

/**
 * Create a new event
 */
export async function createEvent(
    input: EventInput
): Promise<EventActionResult> {
    const supabase = await createClient()
    const userId = await getCurrentUserId()

    if (!userId) {
        return { success: false, error: "Not authenticated" }
    }

    // Check permissions
    const isAdmin = await isAdminOrModerator()
    const canCreate =
        isAdmin || (input.cafe_id && (await isCafeOwner(input.cafe_id)))

    if (!canCreate) {
        return {
            success: false,
            error: "You don't have permission to create events",
        }
    }

    // Cafe owners can only create events for their own cafes
    if (!isAdmin && input.cafe_id) {
        const isOwner = await isCafeOwner(input.cafe_id)
        if (!isOwner) {
            return {
                success: false,
                error: "You can only create events for cafes you own",
            }
        }

        // Tier check - only Premium can create events
        const adminClient = await createAdminClient()
        const { data: subscription } = await adminClient
            .from("cafe_subscriptions")
            .select("tier")
            .eq("cafe_id", input.cafe_id)
            .single()

        const tier = subscription?.tier || "free"
        if (tier !== "premium") {
            return {
                success: false,
                error: "Event creation is an exclusive Feature for Premium subscribers. Upgrade to host events!",
            }
        }
    }

    const { data, error } = await supabase
        .from("events")
        .insert({
            title: input.title,
            description: input.description || null,
            start_date: input.start_date,
            end_date: input.end_date || null,
            location_name: input.location_name || null,
            address: input.address || null,
            city: input.city || null,
            province: input.province || null,
            region: input.region || null,
            cafe_id: input.cafe_id || null,
            image_url: input.image_url || null,
            ticket_link: input.ticket_link || null,
            is_national: input.is_national ?? false,
            status: input.status || "draft",
            created_by: userId,
        })
        .select()
        .single()

    if (error) {
        console.error("Error creating event:", error)
        return { success: false, error: error.message }
    }

    // Fetch full event with relations
    const fullEvent = await getEvent(data.id)

    return { success: true, event: fullEvent || undefined }
}

/**
 * Update an existing event
 */
export async function updateEvent(
    eventId: string,
    input: Partial<EventInput>
): Promise<EventActionResult> {
    const supabase = await createClient()

    // Fetch existing event to check permissions
    const { data: existingEvent } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single()

    if (!existingEvent) {
        return { success: false, error: "Event not found" }
    }

    if (!(await canManageEvent(existingEvent as Event))) {
        return {
            success: false,
            error: "You don't have permission to update this event",
        }
    }

    const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
    }

    // Only include fields that are provided
    if (input.title !== undefined) updateData.title = input.title
    if (input.description !== undefined)
        updateData.description = input.description
    if (input.start_date !== undefined) updateData.start_date = input.start_date
    if (input.end_date !== undefined) updateData.end_date = input.end_date
    if (input.location_name !== undefined)
        updateData.location_name = input.location_name
    if (input.address !== undefined) updateData.address = input.address
    if (input.city !== undefined) updateData.city = input.city
    if (input.province !== undefined) updateData.province = input.province
    if (input.region !== undefined) updateData.region = input.region
    if (input.cafe_id !== undefined) updateData.cafe_id = input.cafe_id
    if (input.image_url !== undefined) updateData.image_url = input.image_url
    if (input.ticket_link !== undefined)
        updateData.ticket_link = input.ticket_link
    if (input.is_national !== undefined)
        updateData.is_national = input.is_national
    if (input.status !== undefined) updateData.status = input.status

    const { error } = await supabase
        .from("events")
        .update(updateData)
        .eq("id", eventId)

    if (error) {
        console.error("Error updating event:", error)
        return { success: false, error: error.message }
    }

    const fullEvent = await getEvent(eventId)
    return { success: true, event: fullEvent || undefined }
}

/**
 * Delete an event
 */
export async function deleteEvent(eventId: string): Promise<EventActionResult> {
    const supabase = await createClient()

    // Fetch existing event to check permissions
    const { data: existingEvent } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single()

    if (!existingEvent) {
        return { success: false, error: "Event not found" }
    }

    if (!(await canManageEvent(existingEvent as Event))) {
        return {
            success: false,
            error: "You don't have permission to delete this event",
        }
    }

    const { error } = await supabase.from("events").delete().eq("id", eventId)

    if (error) {
        console.error("Error deleting event:", error)
        return { success: false, error: error.message }
    }

    return { success: true }
}

/**
 * Publish an event (change status to published)
 */
export async function publishEvent(
    eventId: string
): Promise<EventActionResult> {
    return updateEvent(eventId, { status: "published" })
}

/**
 * Cancel an event
 */
export async function cancelEvent(eventId: string): Promise<EventActionResult> {
    return updateEvent(eventId, { status: "cancelled" })
}

/**
 * Get all events for admin/moderator view (including drafts)
 */
export async function getAdminEvents(
    page: number = 1,
    pageSize: number = 20
): Promise<{ events: EventWithCafe[]; total: number }> {
    const supabase = await createClient()

    if (!(await isAdminOrModerator())) {
        return { events: [], total: 0 }
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await supabase
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
        .order("created_at", { ascending: false })
        .range(from, to)

    if (error) {
        console.error("Error fetching admin events:", error)
        return { events: [], total: 0 }
    }

    return {
        events: (data as unknown as EventWithCafe[]) || [],
        total: count || 0,
    }
}

/**
 * Get events for a specific cafe (for owner dashboard)
 */
export async function getCafeEvents(
    cafeId: string
): Promise<EventWithCafe[]> {
    const supabase = await createClient()

    // Check if user is owner of this cafe
    if (!(await isCafeOwner(cafeId)) && !(await isAdminOrModerator())) {
        return []
    }

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
        .eq("cafe_id", cafeId)
        .order("start_date", { ascending: false })

    if (error) {
        console.error("Error fetching cafe events:", error)
        return []
    }

    return (data as unknown as EventWithCafe[]) || []
}
