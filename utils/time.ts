export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"

export function getPHDayKey(): DayKey {
    // PH is UTC+8
    const phDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }))
    const days: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
    return days[phDate.getDay()]
}

export function getPHTime(): { hours: number; minutes: number } {
    // PH is UTC+8
    const phDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }))
    return {
        hours: phDate.getHours(),
        minutes: phDate.getMinutes(),
    }
}

export function isCafeOpenNow(
    operatingHours: unknown,
    todayKey: DayKey
): boolean {
    if (!Array.isArray(operatingHours)) return false

    const todayEntry = operatingHours.find(
        (h: { day: string; is_24_hours?: boolean; is_closed?: boolean; open?: string; close?: string }) =>
            h.day === todayKey
    )

    if (!todayEntry) return false
    if (todayEntry.is_24_hours) return true
    if (todayEntry.is_closed) return false
    if (!todayEntry.open || !todayEntry.close) return false

    const { hours: currentHours, minutes: currentMinutes } = getPHTime()
    const currentTime = currentHours * 60 + currentMinutes

    // Parse open time
    const [openHours, openMinutes] = todayEntry.open.split(':').map(Number)
    const openTime = openHours * 60 + openMinutes

    // Parse close time
    const [closeHours, closeMinutes] = todayEntry.close.split(':').map(Number)
    let closeTime = closeHours * 60 + closeMinutes

    // Handle overnight hours (e.g., closes at 2am next day)
    if (closeTime < openTime) {
        closeTime += 24 * 60 // Add 24 hours
    }

    return currentTime >= openTime && currentTime < closeTime
}
