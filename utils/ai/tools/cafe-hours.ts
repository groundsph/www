import { db } from "@/db"
import { cafes } from "@/db/schema"
import { eq } from "drizzle-orm"

interface DayHours {
    day: string
    open: string
    close: string
    is_24_hours: boolean
}

export interface CafeHoursResult {
    cafeName: string
    cafeSlug: string
    operatingHours: DayHours[]
    isCurrentlyOpen: boolean | null
    currentTimeInPH: string
    todayHours: DayHours | null
}

function isCurrentlyOpen(hours: DayHours[]): boolean | null {
    try {
        const now = new Date()
        const phTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }))
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        const todayName = dayNames[phTime.getDay()]

        const todaySchedule = hours.find(
            (h) => h.day.toLowerCase() === todayName.toLowerCase()
        )

        if (!todaySchedule) return null
        if (todaySchedule.is_24_hours) return true

        const currentMinutes = phTime.getHours() * 60 + phTime.getMinutes()
        const [openH, openM] = todaySchedule.open.split(":").map(Number)
        const [closeH, closeM] = todaySchedule.close.split(":").map(Number)
        const openMinutes = openH * 60 + openM
        const closeMinutes = closeH * 60 + closeM

        if (closeMinutes > openMinutes) {
            return currentMinutes >= openMinutes && currentMinutes < closeMinutes
        } else {
            // Handles overnight hours (e.g., 20:00 - 02:00)
            return currentMinutes >= openMinutes || currentMinutes < closeMinutes
        }
    } catch {
        return null
    }
}

export async function getCafeHours(
    cafeSlug: string
): Promise<CafeHoursResult | { error: string }> {
    try {
        const result = await db
            .select({
                name: cafes.name,
                slug: cafes.slug,
                operatingHours: cafes.operatingHours,
            })
            .from(cafes)
            .where(eq(cafes.slug, cafeSlug))
            .limit(1)

        if (!result[0]) {
            return { error: `Cafe with slug "${cafeSlug}" not found` }
        }

        const hours = (result[0].operatingHours ?? []) as DayHours[]
        const phTime = new Date().toLocaleString("en-US", {
            timeZone: "Asia/Manila",
            weekday: "long",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        })

        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        const now = new Date()
        const phDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }))
        const todayName = dayNames[phDate.getDay()]
        const todayHours = hours.find((h) => h.day.toLowerCase() === todayName.toLowerCase()) ?? null

        return {
            cafeName: result[0].name,
            cafeSlug: result[0].slug,
            operatingHours: hours,
            isCurrentlyOpen: isCurrentlyOpen(hours),
            currentTimeInPH: phTime,
            todayHours,
        }
    } catch (error) {
        console.error("getCafeHours error:", error)
        return { error: "Failed to fetch cafe hours" }
    }
}
