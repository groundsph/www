export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"

export function getPHDayKey(): DayKey {
    // PH is UTC+8
    const phDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }))
    const days: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
    return days[phDate.getDay()]
}
