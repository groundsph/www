import { db } from "@/db"
import { events, cafes } from "@/db/schema"
import { eq, and, gte, asc } from "drizzle-orm"

export interface EventResult {
    id: string
    title: string
    description: string | null
    imageUrl: string | null
    startDate: string
    endDate: string | null
    locationName: string | null
    city: string | null
    province: string | null
    ticketLink: string | null
    isNational: boolean
    cafeName: string | null
}

export interface EventsResult {
    events: EventResult[]
    total: number
}

export async function getUpcomingEvents(
    city?: string,
    limit: number = 10
): Promise<EventsResult | { error: string }> {
    try {
        const now = new Date()

        const conditions = [
            eq(events.status, "published"),
            gte(events.startDate, now),
        ]

        if (city) {
            conditions.push(eq(events.city, city))
        }

        const query = db
            .select({
                id: events.id,
                title: events.title,
                description: events.description,
                imageUrl: events.imageUrl,
                startDate: events.startDate,
                endDate: events.endDate,
                locationName: events.locationName,
                city: events.city,
                province: events.province,
                ticketLink: events.ticketLink,
                isNational: events.isNational,
                cafeName: cafes.name,
            })
            .from(events)
            .leftJoin(cafes, eq(events.cafeId, cafes.id))
            .where(and(...conditions))
            .orderBy(asc(events.startDate))
            .limit(limit)

        const results = await query

        return {
            events: results.map((r) => ({
                id: r.id,
                title: r.title,
                description: r.description,
                imageUrl: r.imageUrl,
                startDate: r.startDate?.toISOString() ?? "",
                endDate: r.endDate?.toISOString() ?? null,
                locationName: r.locationName,
                city: r.city,
                province: r.province,
                ticketLink: r.ticketLink,
                isNational: r.isNational ?? false,
                cafeName: r.cafeName,
            })),
            total: results.length,
        }
    } catch (error) {
        console.error("getUpcomingEvents error:", error)
        return { error: "Failed to fetch upcoming events" }
    }
}
