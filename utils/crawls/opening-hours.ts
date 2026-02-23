import type { OperatingHours, OperatingHour } from "@/utils/types/cafe"

const DAYS: OperatingHour["day"][] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]

function toMinutes(time: string) {
    const [h, m] = time.split(":").map(Number)
    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
        throw new Error(`Invalid time: ${time}`)
    }
    return h * 60 + m
}

export function isOpenAt(hours: OperatingHours, day: OperatingHour["day"], time: string): boolean {
    const entry = hours.find((h) => h.day === day)
    if (!entry || entry.is_closed) return false
    if (entry.is_24_hours) return true
    const open = toMinutes(entry.open)
    const close = toMinutes(entry.close)
    const t = toMinutes(time)
    if (close < open) {
        return t >= open || t < close
    }
    return t >= open && t < close
}

export function nextOpenWindow(
    hours: OperatingHours,
    day: OperatingHour["day"],
    time: string
): OperatingHour | null {
    const startIndex = DAYS.indexOf(day)
    for (let i = 0; i < DAYS.length; i++) {
        const idx = (startIndex + i) % DAYS.length
        const entry = hours.find((h) => h.day === DAYS[idx] && !h.is_closed)
        if (!entry) continue
        if (i === 0 && isOpenAt(hours, day, time)) return entry
        if (i === 0 && !isOpenAt(hours, day, time) && toMinutes(time) < toMinutes(entry.open)) {
            return entry
        }
        if (i > 0) return entry
    }
    return null
}
