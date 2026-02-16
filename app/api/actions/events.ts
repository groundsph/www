"use server"

import { db } from "@/db"
import { events, cafes, profiles, cafeSubscriptions, user } from "@/db/schema"
import { eq, and, gte, lt, lte, desc, asc, count, inArray, or, ilike, sql } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
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
    const user = await getCurrentUser()
    if (!user) return false

    const result = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, user.id))
        .limit(1)

    const role = result[0]?.role
    return role === "admin" || role === "moderator"
}

async function isCafeOwner(cafeId: string): Promise<boolean> {
    const user = await getCurrentUser()
    if (!user) return false

    const result = await db
        .select({ ownerIds: cafes.ownerIds })
        .from(cafes)
        .where(eq(cafes.id, cafeId))
        .limit(1)

    return result[0]?.ownerIds?.includes(user.id) || false
}

async function getCurrentUserId(): Promise<string | null> {
    const user = await getCurrentUser()
    return user?.id || null
}

async function canManageEvent(event: Event): Promise<boolean> {
    const userId = await getCurrentUserId()
    if (!userId) return false

    if (await isAdminOrModerator()) return true
    if (event.created_by === userId) return true
    if (event.cafe_id && (await isCafeOwner(event.cafe_id))) return true

    return false
}

/**
 * Test-only wrapper for canAutoPublishCommunityEvent with injectable dependencies
 */
export async function canAutoPublishCommunityEventForTest(input: {
    userId: string
    isAdminOrModerator: () => Promise<boolean>
    isOwner: (userId: string) => Promise<boolean>
}): Promise<boolean> {
    if (await input.isAdminOrModerator()) return true
    return Boolean(await input.isOwner(input.userId))
}

/**
 * Check if user can auto-publish community events (admin, moderator, or cafe owner)
 */
async function canAutoPublishCommunityEvent(userId: string): Promise<boolean> {
    return canAutoPublishCommunityEventForTest({
        userId,
        isAdminOrModerator,
        isOwner: async (uid: string) => {
            const ownerResult = await db.select({ id: cafes.id })
                .from(cafes)
                .where(sql`${cafes.ownerIds} @> ARRAY[${uid}]::uuid[]`)
                .limit(1)
            return Boolean(ownerResult[0])
        },
    })
}

// Helper to map event result to snake_case
function mapEventToSnakeCase(e: {
    id: string
    title: string
    description: string | null
    startDate: Date
    endDate: Date | null
    locationName: string | null
    address: string | null
    city: string | null
    province: string | null
    region: string | null
    cafeId: string | null
    imageUrl: string | null
    ticketLink: string | null
    isNational: boolean | null
    status: string | null
    createdBy: string | null
    createdAt: Date | null
    updatedAt: Date | null
}, cafe?: { id: string; name: string; slug: string; thumbnail: string } | null, creator?: { id: string; displayName: string; avatarUrl: string | null } | null): EventWithCafe {
    return {
        id: e.id,
        title: e.title,
        description: e.description,
        start_date: e.startDate.toISOString(),
        end_date: e.endDate?.toISOString() ?? null,
        location_name: e.locationName,
        address: e.address,
        city: e.city,
        province: e.province,
        region: e.region,
        cafe_id: e.cafeId,
        image_url: e.imageUrl,
        ticket_link: e.ticketLink,
        is_national: e.isNational ?? false,
        status: e.status as EventStatus,
        created_by: e.createdBy,
        created_at: e.createdAt?.toISOString() ?? '',
        updated_at: e.updatedAt?.toISOString() ?? '',
        cafe: cafe ? { id: cafe.id, name: cafe.name, slug: cafe.slug, thumbnail: cafe.thumbnail } : null,
        creator: creator ? { id: creator.id, display_name: creator.displayName, avatar_url: creator.avatarUrl } : null,
    } as EventWithCafe
}

// Fetch event with cafe and creator info
async function fetchEventWithRelations(eventId: string): Promise<EventWithCafe | null> {
    const eventResult = await db
        .select({
            id: events.id, title: events.title, description: events.description,
            startDate: events.startDate, endDate: events.endDate, locationName: events.locationName,
            address: events.address, city: events.city, province: events.province, region: events.region,
            cafeId: events.cafeId, imageUrl: events.imageUrl, ticketLink: events.ticketLink,
            isNational: events.isNational, status: events.status, createdBy: events.createdBy,
            createdAt: events.createdAt, updatedAt: events.updatedAt,
        })
        .from(events)
        .where(eq(events.id, eventId))
        .limit(1)

    const e = eventResult[0]
    if (!e) return null

    // Fetch cafe and creator in parallel
    const [cafeResult, creatorResult] = await Promise.all([
        e.cafeId ? db.select({ id: cafes.id, name: cafes.name, slug: cafes.slug, thumbnail: cafes.thumbnail })
            .from(cafes).where(eq(cafes.id, e.cafeId)).limit(1) : Promise.resolve([]),
        e.createdBy ? db.select({ id: profiles.id, displayName: profiles.displayName, avatarUrl: profiles.avatarUrl })
            .from(profiles).where(eq(profiles.id, e.createdBy)).limit(1) : Promise.resolve([]),
    ])

    return mapEventToSnakeCase(e, cafeResult[0], creatorResult[0])
}

/**
 * Get events with optional filtering
 */
export async function getEvents(
    filters: EventFilters = {},
    page: number = 1,
    pageSize: number = 20
): Promise<{ events: EventWithCafe[]; total: number }> {
    const offset = (page - 1) * pageSize
    const conditions = [eq(events.status, filters.status ?? "published")]

    if (filters.city) conditions.push(eq(events.city, filters.city))
    if (filters.region) conditions.push(eq(events.region, filters.region))
    if (filters.is_national !== undefined) conditions.push(eq(events.isNational, filters.is_national))
    if (filters.start_after) conditions.push(gte(events.startDate, new Date(filters.start_after)))
    if (filters.start_before) conditions.push(lte(events.startDate, new Date(filters.start_before)))
    if (filters.search) {
        const searchCondition = or(
            ilike(events.title, `%${filters.search}%`),
            ilike(events.description, `%${filters.search}%`)
        )
        if (searchCondition) conditions.push(searchCondition)
    }

    const [eventsResult, countResult] = await Promise.all([
        db.select({
            id: events.id, title: events.title, description: events.description,
            startDate: events.startDate, endDate: events.endDate, locationName: events.locationName,
            address: events.address, city: events.city, province: events.province, region: events.region,
            cafeId: events.cafeId, imageUrl: events.imageUrl, ticketLink: events.ticketLink,
            isNational: events.isNational, status: events.status, createdBy: events.createdBy,
            createdAt: events.createdAt, updatedAt: events.updatedAt,
        })
            .from(events)
            .where(and(...conditions))
            .orderBy(asc(events.startDate))
            .limit(pageSize)
            .offset(offset),
        db.select({ count: count() }).from(events).where(and(...conditions)),
    ])

    // Fetch cafe and creator for each event
    const eventIds = eventsResult.map(e => e.id)
    if (eventIds.length === 0) return { events: [], total: countResult[0]?.count ?? 0 }

    const cafeIds = [...new Set(eventsResult.map(e => e.cafeId).filter(Boolean))] as string[]
    const creatorIds = [...new Set(eventsResult.map(e => e.createdBy).filter(Boolean))] as string[]

    const [cafesResult, creatorsResult] = await Promise.all([
        cafeIds.length > 0 ? db.select({ id: cafes.id, name: cafes.name, slug: cafes.slug, thumbnail: cafes.thumbnail })
            .from(cafes).where(inArray(cafes.id, cafeIds)) : Promise.resolve([]),
        creatorIds.length > 0 ? db.select({ id: profiles.id, displayName: profiles.displayName, avatarUrl: profiles.avatarUrl })
            .from(profiles).where(inArray(profiles.id, creatorIds)) : Promise.resolve([]),
    ])

    const cafeMap = new Map(cafesResult.map(c => [c.id, c]))
    const creatorMap = new Map(creatorsResult.map(c => [c.id, c]))

    return {
        events: eventsResult.map(e => mapEventToSnakeCase(e, e.cafeId ? cafeMap.get(e.cafeId) : null, e.createdBy ? creatorMap.get(e.createdBy) : null)),
        total: countResult[0]?.count ?? 0,
    }
}

/**
 * Get a single event by ID
 */
export async function getEvent(id: string): Promise<EventWithCafe | null> {
    return fetchEventWithRelations(id)
}

/**
 * Get upcoming events
 */
export async function getUpcomingEvents(limit: number = 10): Promise<EventWithCafe[]> {
    const now = new Date()

    const eventsResult = await db.select({
        id: events.id, title: events.title, description: events.description,
        startDate: events.startDate, endDate: events.endDate, locationName: events.locationName,
        address: events.address, city: events.city, province: events.province, region: events.region,
        cafeId: events.cafeId, imageUrl: events.imageUrl, ticketLink: events.ticketLink,
        isNational: events.isNational, status: events.status, createdBy: events.createdBy,
        createdAt: events.createdAt, updatedAt: events.updatedAt,
    })
        .from(events)
        .where(and(eq(events.status, "published"), gte(events.startDate, now)))
        .orderBy(asc(events.startDate))
        .limit(limit)

    if (eventsResult.length === 0) return []

    // Fetch related data
    const cafeIds = [...new Set(eventsResult.map(e => e.cafeId).filter(Boolean))] as string[]
    const creatorIds = [...new Set(eventsResult.map(e => e.createdBy).filter(Boolean))] as string[]

    const [cafesResult, creatorsResult] = await Promise.all([
        cafeIds.length > 0 ? db.select({ id: cafes.id, name: cafes.name, slug: cafes.slug, thumbnail: cafes.thumbnail })
            .from(cafes).where(inArray(cafes.id, cafeIds)) : Promise.resolve([]),
        creatorIds.length > 0 ? db.select({ id: profiles.id, displayName: profiles.displayName, avatarUrl: profiles.avatarUrl })
            .from(profiles).where(inArray(profiles.id, creatorIds)) : Promise.resolve([]),
    ])

    const cafeMap = new Map(cafesResult.map(c => [c.id, c]))
    const creatorMap = new Map(creatorsResult.map(c => [c.id, c]))

    return eventsResult.map(e => mapEventToSnakeCase(e, e.cafeId ? cafeMap.get(e.cafeId) : null, e.createdBy ? creatorMap.get(e.createdBy) : null))
}

/**
 * Get events for a specific month
 */
export async function getEventsForMonth(
    year: number,
    month: number,
    filters: Pick<EventFilters, "city" | "region" | "is_national"> = {}
): Promise<Event[]> {
    const startDate = new Date(year, month, 1)
    const endDate = new Date(year, month + 1, 1)

    const conditions = [
        eq(events.status, "published"),
        gte(events.startDate, startDate),
        lt(events.startDate, endDate),
    ]

    if (filters.city) conditions.push(eq(events.city, filters.city))
    if (filters.region) conditions.push(eq(events.region, filters.region))
    if (filters.is_national !== undefined) conditions.push(eq(events.isNational, filters.is_national))

    const result = await db.select({
        id: events.id, title: events.title, description: events.description,
        startDate: events.startDate, endDate: events.endDate, locationName: events.locationName,
        address: events.address, city: events.city, province: events.province, region: events.region,
        cafeId: events.cafeId, imageUrl: events.imageUrl, ticketLink: events.ticketLink,
        isNational: events.isNational, status: events.status, createdBy: events.createdBy,
        createdAt: events.createdAt, updatedAt: events.updatedAt,
    })
        .from(events)
        .where(and(...conditions))
        .orderBy(asc(events.startDate))

    return result.map(e => ({
        id: e.id,
        title: e.title,
        description: e.description,
        start_date: e.startDate.toISOString(),
        end_date: e.endDate?.toISOString() ?? null,
        location_name: e.locationName,
        address: e.address,
        city: e.city,
        province: e.province,
        region: e.region,
        cafe_id: e.cafeId,
        image_url: e.imageUrl,
        ticket_link: e.ticketLink,
        is_national: e.isNational ?? false,
        status: e.status as EventStatus,
        created_by: e.createdBy,
        created_at: e.createdAt?.toISOString() ?? '',
        updated_at: e.updatedAt?.toISOString() ?? '',
    })) as Event[]
}

/**
 * Get local events
 */
export async function getLocalEvents(city?: string, region?: string, limit: number = 10): Promise<EventWithCafe[]> {
    const now = new Date()

    const conditions = [
        eq(events.status, "published"),
        eq(events.isNational, false),
        gte(events.startDate, now),
    ]

    if (city) {
        conditions.push(eq(events.city, city))
    } else if (region) {
        conditions.push(eq(events.region, region))
    }

    const eventsResult = await db.select({
        id: events.id, title: events.title, description: events.description,
        startDate: events.startDate, endDate: events.endDate, locationName: events.locationName,
        address: events.address, city: events.city, province: events.province, region: events.region,
        cafeId: events.cafeId, imageUrl: events.imageUrl, ticketLink: events.ticketLink,
        isNational: events.isNational, status: events.status, createdBy: events.createdBy,
        createdAt: events.createdAt, updatedAt: events.updatedAt,
    })
        .from(events)
        .where(and(...conditions))
        .orderBy(asc(events.startDate))
        .limit(limit)

    if (eventsResult.length === 0) return []

    const cafeIds = [...new Set(eventsResult.map(e => e.cafeId).filter(Boolean))] as string[]
    const creatorIds = [...new Set(eventsResult.map(e => e.createdBy).filter(Boolean))] as string[]

    const [cafesResult, creatorsResult] = await Promise.all([
        cafeIds.length > 0 ? db.select({ id: cafes.id, name: cafes.name, slug: cafes.slug, thumbnail: cafes.thumbnail })
            .from(cafes).where(inArray(cafes.id, cafeIds)) : Promise.resolve([]),
        creatorIds.length > 0 ? db.select({ id: profiles.id, displayName: profiles.displayName, avatarUrl: profiles.avatarUrl })
            .from(profiles).where(inArray(profiles.id, creatorIds)) : Promise.resolve([]),
    ])

    const cafeMap = new Map(cafesResult.map(c => [c.id, c]))
    const creatorMap = new Map(creatorsResult.map(c => [c.id, c]))

    return eventsResult.map(e => mapEventToSnakeCase(e, e.cafeId ? cafeMap.get(e.cafeId) : null, e.createdBy ? creatorMap.get(e.createdBy) : null))
}

/**
 * Get national events
 */
export async function getNationalEvents(limit: number = 10): Promise<EventWithCafe[]> {
    const now = new Date()

    const eventsResult = await db.select({
        id: events.id, title: events.title, description: events.description,
        startDate: events.startDate, endDate: events.endDate, locationName: events.locationName,
        address: events.address, city: events.city, province: events.province, region: events.region,
        cafeId: events.cafeId, imageUrl: events.imageUrl, ticketLink: events.ticketLink,
        isNational: events.isNational, status: events.status, createdBy: events.createdBy,
        createdAt: events.createdAt, updatedAt: events.updatedAt,
    })
        .from(events)
        .where(and(eq(events.status, "published"), eq(events.isNational, true), gte(events.startDate, now)))
        .orderBy(asc(events.startDate))
        .limit(limit)

    if (eventsResult.length === 0) return []

    const cafeIds = [...new Set(eventsResult.map(e => e.cafeId).filter(Boolean))] as string[]
    const creatorIds = [...new Set(eventsResult.map(e => e.createdBy).filter(Boolean))] as string[]

    const [cafesResult, creatorsResult] = await Promise.all([
        cafeIds.length > 0 ? db.select({ id: cafes.id, name: cafes.name, slug: cafes.slug, thumbnail: cafes.thumbnail })
            .from(cafes).where(inArray(cafes.id, cafeIds)) : Promise.resolve([]),
        creatorIds.length > 0 ? db.select({ id: profiles.id, displayName: profiles.displayName, avatarUrl: profiles.avatarUrl })
            .from(profiles).where(inArray(profiles.id, creatorIds)) : Promise.resolve([]),
    ])

    const cafeMap = new Map(cafesResult.map(c => [c.id, c]))
    const creatorMap = new Map(creatorsResult.map(c => [c.id, c]))

    return eventsResult.map(e => mapEventToSnakeCase(e, e.cafeId ? cafeMap.get(e.cafeId) : null, e.createdBy ? creatorMap.get(e.createdBy) : null))
}

// ============================================
// Create/Update/Delete Operations
// ============================================

/**
 * Create a new event
 */
export async function createEvent(input: EventInput): Promise<EventActionResult> {
    const userId = await getCurrentUserId()
    if (!userId) return { success: false, error: "Not authenticated" }

    const isAdmin = await isAdminOrModerator()
    const canCreate = isAdmin || (input.cafe_id && (await isCafeOwner(input.cafe_id)))

    if (!canCreate) {
        return { success: false, error: "You don't have permission to create events" }
    }

    // Cafe owners need Premium tier
    if (!isAdmin && input.cafe_id) {
        const isOwner = await isCafeOwner(input.cafe_id)
        if (!isOwner) {
            return { success: false, error: "You can only create events for cafes you own" }
        }

        const subResult = await db.select({ tier: cafeSubscriptions.tier })
            .from(cafeSubscriptions)
            .where(eq(cafeSubscriptions.cafeId, input.cafe_id))
            .limit(1)

        const tier = subResult[0]?.tier || "free"
        if (tier !== "premium") {
            return { success: false, error: "Event creation is an exclusive Feature for Premium subscribers. Upgrade to host events!" }
        }
    }

    const [inserted] = await db.insert(events).values({
        title: input.title,
        description: input.description || null,
        startDate: new Date(input.start_date),
        endDate: input.end_date ? new Date(input.end_date) : null,
        locationName: input.location_name || null,
        address: input.address || null,
        city: input.city || null,
        province: input.province || null,
        region: input.region || null,
        cafeId: input.cafe_id || null,
        imageUrl: input.image_url || null,
        ticketLink: input.ticket_link || null,
        isNational: input.is_national ?? false,
        status: input.status || "draft",
        createdBy: userId,
    }).returning()

    if (!inserted) return { success: false, error: "Failed to create event" }

    const fullEvent = await getEvent(inserted.id)
    return { success: true, event: fullEvent || undefined }
}

/**
 * Update an existing event
 */
export async function updateEvent(eventId: string, input: Partial<EventInput>): Promise<EventActionResult> {
    const eventResult = await db.select().from(events).where(eq(events.id, eventId)).limit(1)
    const existingEvent = eventResult[0]

    if (!existingEvent) return { success: false, error: "Event not found" }

    // Convert to snake_case for permission check
    const eventForCheck: Event = {
        id: existingEvent.id,
        title: existingEvent.title,
        description: existingEvent.description,
        start_date: existingEvent.startDate.toISOString(),
        end_date: existingEvent.endDate?.toISOString() ?? null,
        location_name: existingEvent.locationName,
        address: existingEvent.address,
        city: existingEvent.city,
        province: existingEvent.province,
        region: existingEvent.region,
        cafe_id: existingEvent.cafeId,
        image_url: existingEvent.imageUrl,
        ticket_link: existingEvent.ticketLink,
        is_national: existingEvent.isNational ?? false,
        status: existingEvent.status as EventStatus,
        created_by: existingEvent.createdBy,
        created_at: existingEvent.createdAt?.toISOString() ?? '',
        updated_at: existingEvent.updatedAt?.toISOString() ?? '',
    }

    if (!(await canManageEvent(eventForCheck))) {
        return { success: false, error: "You don't have permission to update this event" }
    }

    const updateData: Partial<typeof events.$inferInsert> = { updatedAt: new Date() }
    if (input.title !== undefined) updateData.title = input.title
    if (input.description !== undefined) updateData.description = input.description
    if (input.start_date !== undefined) updateData.startDate = new Date(input.start_date)
    if (input.end_date !== undefined) updateData.endDate = input.end_date ? new Date(input.end_date) : null
    if (input.location_name !== undefined) updateData.locationName = input.location_name
    if (input.address !== undefined) updateData.address = input.address
    if (input.city !== undefined) updateData.city = input.city
    if (input.province !== undefined) updateData.province = input.province
    if (input.region !== undefined) updateData.region = input.region
    if (input.cafe_id !== undefined) updateData.cafeId = input.cafe_id
    if (input.image_url !== undefined) updateData.imageUrl = input.image_url
    if (input.ticket_link !== undefined) updateData.ticketLink = input.ticket_link
    if (input.is_national !== undefined) updateData.isNational = input.is_national
    if (input.status !== undefined) updateData.status = input.status

    await db.update(events).set(updateData).where(eq(events.id, eventId))

    const fullEvent = await getEvent(eventId)
    return { success: true, event: fullEvent || undefined }
}

/**
 * Delete an event
 */
export async function deleteEvent(eventId: string): Promise<EventActionResult> {
    const eventResult = await db.select().from(events).where(eq(events.id, eventId)).limit(1)
    const existingEvent = eventResult[0]

    if (!existingEvent) return { success: false, error: "Event not found" }

    const eventForCheck: Event = {
        id: existingEvent.id,
        title: existingEvent.title,
        description: existingEvent.description,
        start_date: existingEvent.startDate.toISOString(),
        end_date: existingEvent.endDate?.toISOString() ?? null,
        location_name: existingEvent.locationName,
        address: existingEvent.address,
        city: existingEvent.city,
        province: existingEvent.province,
        region: existingEvent.region,
        cafe_id: existingEvent.cafeId,
        image_url: existingEvent.imageUrl,
        ticket_link: existingEvent.ticketLink,
        is_national: existingEvent.isNational ?? false,
        status: existingEvent.status as EventStatus,
        created_by: existingEvent.createdBy,
        created_at: existingEvent.createdAt?.toISOString() ?? '',
        updated_at: existingEvent.updatedAt?.toISOString() ?? '',
    }

    if (!(await canManageEvent(eventForCheck))) {
        return { success: false, error: "You don't have permission to delete this event" }
    }

    await db.delete(events).where(eq(events.id, eventId))
    return { success: true }
}

export async function publishEvent(eventId: string): Promise<EventActionResult> {
    return updateEvent(eventId, { status: "published" })
}

export async function cancelEvent(eventId: string): Promise<EventActionResult> {
    return updateEvent(eventId, { status: "cancelled" })
}

/**
 * Get all events for admin view
 */
export async function getAdminEvents(page: number = 1, pageSize: number = 20): Promise<{ events: EventWithCafe[]; total: number }> {
    if (!(await isAdminOrModerator())) return { events: [], total: 0 }

    const offset = (page - 1) * pageSize

    const [eventsResult, countResult] = await Promise.all([
        db.select({
            id: events.id, title: events.title, description: events.description,
            startDate: events.startDate, endDate: events.endDate, locationName: events.locationName,
            address: events.address, city: events.city, province: events.province, region: events.region,
            cafeId: events.cafeId, imageUrl: events.imageUrl, ticketLink: events.ticketLink,
            isNational: events.isNational, status: events.status, createdBy: events.createdBy,
            createdAt: events.createdAt, updatedAt: events.updatedAt,
        })
            .from(events)
            .orderBy(desc(events.createdAt))
            .limit(pageSize)
            .offset(offset),
        db.select({ count: count() }).from(events),
    ])

    if (eventsResult.length === 0) return { events: [], total: countResult[0]?.count ?? 0 }

    const cafeIds = [...new Set(eventsResult.map(e => e.cafeId).filter(Boolean))] as string[]
    const creatorIds = [...new Set(eventsResult.map(e => e.createdBy).filter(Boolean))] as string[]

    const [cafesResult, creatorsResult] = await Promise.all([
        cafeIds.length > 0 ? db.select({ id: cafes.id, name: cafes.name, slug: cafes.slug, thumbnail: cafes.thumbnail })
            .from(cafes).where(inArray(cafes.id, cafeIds)) : Promise.resolve([]),
        creatorIds.length > 0 ? db.select({ id: profiles.id, displayName: profiles.displayName, avatarUrl: profiles.avatarUrl })
            .from(profiles).where(inArray(profiles.id, creatorIds)) : Promise.resolve([]),
    ])

    const cafeMap = new Map(cafesResult.map(c => [c.id, c]))
    const creatorMap = new Map(creatorsResult.map(c => [c.id, c]))

    return {
        events: eventsResult.map(e => mapEventToSnakeCase(e, e.cafeId ? cafeMap.get(e.cafeId) : null, e.createdBy ? creatorMap.get(e.createdBy) : null)),
        total: countResult[0]?.count ?? 0,
    }
}

/**
 * Get events for a specific cafe
 */
export async function getCafeEvents(cafeId: string): Promise<EventWithCafe[]> {
    if (!(await isCafeOwner(cafeId)) && !(await isAdminOrModerator())) return []

    const eventsResult = await db.select({
        id: events.id, title: events.title, description: events.description,
        startDate: events.startDate, endDate: events.endDate, locationName: events.locationName,
        address: events.address, city: events.city, province: events.province, region: events.region,
        cafeId: events.cafeId, imageUrl: events.imageUrl, ticketLink: events.ticketLink,
        isNational: events.isNational, status: events.status, createdBy: events.createdBy,
        createdAt: events.createdAt, updatedAt: events.updatedAt,
    })
        .from(events)
        .where(eq(events.cafeId, cafeId))
        .orderBy(desc(events.startDate))

    if (eventsResult.length === 0) return []

    const cafeResult = await db.select({ id: cafes.id, name: cafes.name, slug: cafes.slug, thumbnail: cafes.thumbnail })
        .from(cafes).where(eq(cafes.id, cafeId)).limit(1)
    const cafe = cafeResult[0]

    const creatorIds = [...new Set(eventsResult.map(e => e.createdBy).filter(Boolean))] as string[]
    const creatorsResult = creatorIds.length > 0
        ? await db.select({ id: profiles.id, displayName: profiles.displayName, avatarUrl: profiles.avatarUrl })
            .from(profiles).where(inArray(profiles.id, creatorIds))
        : []
    const creatorMap = new Map(creatorsResult.map(c => [c.id, c]))

    return eventsResult.map(e => mapEventToSnakeCase(e, cafe, e.createdBy ? creatorMap.get(e.createdBy) : null))
}

// ============================================
// Community Event Submissions
// ============================================

export interface CommunityEventInput {
    title: string
    description: string
    start_date: string
    end_date?: string | null
    location_name: string
    address: string
    city?: string | null
    province?: string | null
    region: string
    image_url?: string | null
    ticket_link: string
}

/**
 * Submit a community event (any authenticated user)
 * Creates event with status "published" for privileged users (admin/moderator/owner),
 * otherwise "pending" for moderation
 */
export async function submitCommunityEvent(input: CommunityEventInput): Promise<EventActionResult> {
    const userId = await getCurrentUserId()
    if (!userId) return { success: false, error: "You must be logged in to submit an event" }

    // Validation
    if (!input.title.trim()) return { success: false, error: "Event title is required" }
    if (!input.description.trim()) return { success: false, error: "Event description is required" }
    if (!input.start_date) return { success: false, error: "Start date is required" }
    if (!input.location_name.trim()) return { success: false, error: "Venue name is required" }
    if (!input.address.trim()) return { success: false, error: "Address is required" }
    if (!input.region) return { success: false, error: "Region is required" }
    if (!input.ticket_link.trim()) return { success: false, error: "Event link is required" }

    // Determine if event should be auto-published
    const canAutoPublish = await canAutoPublishCommunityEvent(userId)
    const status = canAutoPublish ? "published" : "pending"

    const [inserted] = await db.insert(events).values({
        title: input.title.trim(),
        description: input.description.trim(),
        startDate: new Date(input.start_date),
        endDate: input.end_date ? new Date(input.end_date) : null,
        locationName: input.location_name.trim(),
        address: input.address.trim(),
        city: input.city || null,
        province: input.province || null,
        region: input.region,
        imageUrl: input.image_url || null,
        ticketLink: input.ticket_link.trim(),
        isNational: false,
        status,
        createdBy: userId,
    }).returning()

    if (!inserted) return { success: false, error: "Failed to submit event" }

    // Get submitter name for notification
    const submitterResult = await db.select({ displayName: profiles.displayName })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1)
    const submitterName = submitterResult[0]?.displayName

    // Notify Discord about the new submission
    const { notifyDiscordEventSubmission } = await import("@/app/api/actions/notify")
    await notifyDiscordEventSubmission(
        {
            title: input.title.trim(),
            location: `${input.location_name.trim()}${input.city ? `, ${input.city}` : ""}`,
            startDate: input.start_date,
        },
        submitterName
    )

    const fullEvent = await getEvent(inserted.id)
    return { success: true, event: fullEvent || undefined }
}

/**
 * Get all pending community events for moderation (admin/moderator only)
 */
export async function getPendingEvents(): Promise<EventWithCafe[]> {
    if (!(await isAdminOrModerator())) return []

    const eventsResult = await db.select({
        id: events.id, title: events.title, description: events.description,
        startDate: events.startDate, endDate: events.endDate, locationName: events.locationName,
        address: events.address, city: events.city, province: events.province, region: events.region,
        cafeId: events.cafeId, imageUrl: events.imageUrl, ticketLink: events.ticketLink,
        isNational: events.isNational, status: events.status, createdBy: events.createdBy,
        createdAt: events.createdAt, updatedAt: events.updatedAt,
    })
        .from(events)
        .where(eq(events.status, "pending"))
        .orderBy(asc(events.createdAt))

    if (eventsResult.length === 0) return []

    const creatorIds = [...new Set(eventsResult.map(e => e.createdBy).filter(Boolean))] as string[]
    const creatorsResult = creatorIds.length > 0
        ? await db.select({ id: profiles.id, displayName: profiles.displayName, avatarUrl: profiles.avatarUrl })
            .from(profiles).where(inArray(profiles.id, creatorIds))
        : []
    const creatorMap = new Map(creatorsResult.map(c => [c.id, c]))

    return eventsResult.map(e => mapEventToSnakeCase(e, null, e.createdBy ? creatorMap.get(e.createdBy) : null))
}

/**
 * Approve a pending community event (admin/moderator only)
 */
export async function approveCommunityEvent(eventId: string): Promise<EventActionResult & { submitterEmail?: string; submitterName?: string; eventTitle?: string }> {
    if (!(await isAdminOrModerator())) {
        return { success: false, error: "You don't have permission to approve events" }
    }

    const eventResult = await db.select().from(events).where(eq(events.id, eventId)).limit(1)
    const existingEvent = eventResult[0]

    if (!existingEvent) return { success: false, error: "Event not found" }
    if (existingEvent.status !== "pending") {
        return { success: false, error: "Only pending events can be approved" }
    }

    // Get submitter info for email
    let submitterEmail: string | undefined
    let submitterName: string | undefined
    if (existingEvent.createdBy) {
        const [profileResult, userResult] = await Promise.all([
            db.select({ displayName: profiles.displayName })
                .from(profiles)
                .where(eq(profiles.id, existingEvent.createdBy))
                .limit(1),
            db.select({ email: user.email })
                .from(user)
                .where(eq(user.id, existingEvent.createdBy))
                .limit(1)
        ])
        submitterName = profileResult[0]?.displayName
        submitterEmail = userResult[0]?.email
    }

    await db.update(events).set({ status: "published", updatedAt: new Date() }).where(eq(events.id, eventId))

    // Send approval email
    if (submitterEmail) {
        const { sendEventApprovedEmail } = await import("@/utils/email")
        await sendEventApprovedEmail(submitterEmail, existingEvent.title, submitterName)
    }

    const fullEvent = await getEvent(eventId)
    return {
        success: true,
        event: fullEvent || undefined,
        submitterEmail,
        submitterName,
        eventTitle: existingEvent.title
    }
}

/**
 * Reject a pending community event (admin/moderator only)
 */
export async function rejectCommunityEvent(eventId: string, reason?: string): Promise<EventActionResult & { submitterEmail?: string; submitterName?: string; eventTitle?: string }> {
    if (!(await isAdminOrModerator())) {
        return { success: false, error: "You don't have permission to reject events" }
    }

    const eventResult = await db.select().from(events).where(eq(events.id, eventId)).limit(1)
    const existingEvent = eventResult[0]

    if (!existingEvent) return { success: false, error: "Event not found" }
    if (existingEvent.status !== "pending") {
        return { success: false, error: "Only pending events can be rejected" }
    }

    // Get submitter info for email
    let submitterEmail: string | undefined
    let submitterName: string | undefined
    if (existingEvent.createdBy) {
        const [profileResult, userResult] = await Promise.all([
            db.select({ displayName: profiles.displayName })
                .from(profiles)
                .where(eq(profiles.id, existingEvent.createdBy))
                .limit(1),
            db.select({ email: user.email })
                .from(user)
                .where(eq(user.id, existingEvent.createdBy))
                .limit(1)
        ])
        submitterName = profileResult[0]?.displayName
        submitterEmail = userResult[0]?.email
    }

    const eventTitle = existingEvent.title

    // Send rejection email before deleting
    if (submitterEmail) {
        const { sendEventRejectedEmail } = await import("@/utils/email")
        await sendEventRejectedEmail(submitterEmail, eventTitle, submitterName, reason)
    }

    // Delete the rejected event
    await db.delete(events).where(eq(events.id, eventId))

    return {
        success: true,
        submitterEmail,
        submitterName,
        eventTitle
    }
}
