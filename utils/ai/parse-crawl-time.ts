const DAY_MAP: Record<string, "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat"> = {
    sunday: "sun",
    sun: "sun",
    monday: "mon",
    mon: "mon",
    tuesday: "tue",
    tue: "tue",
    wednesday: "wed",
    wed: "wed",
    thursday: "thu",
    thu: "thu",
    friday: "fri",
    fri: "fri",
    saturday: "sat",
    sat: "sat",
}

export function parseCrawlTimePreferences(text: string) {
    const lower = text.toLowerCase()
    const dayMatch = Object.keys(DAY_MAP).find((d) => lower.includes(d))
    const timeMatch = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/)
    const day = dayMatch ? DAY_MAP[dayMatch] : "sat"
    let time = "09:00"
    if (timeMatch) {
        const h = Number(timeMatch[1]) % 12
        const m = Number(timeMatch[2] ?? "00")
        const isPm = timeMatch[3] === "pm"
        const hh = String(h + (isPm ? 12 : 0)).padStart(2, "0")
        const mm = String(m).padStart(2, "0")
        time = `${hh}:${mm}`
    }
    return { day, time }
}
