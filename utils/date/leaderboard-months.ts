/**
 * Leaderboard month selection utilities.
 *
 * Everything here is anchored to Asia/Manila (UTC+8, no DST). The rule this
 * module exists to enforce: a "month" in this product is a Manila calendar
 * month, never a UTC one and never the calendar of whatever machine happens to
 * be running the code.
 *
 * The bug it replaces: month boundaries used to be computed with
 * `new Date(year, month - 1, 1)` — server-local midnights — and each caller then
 * converted those to UTC in its own way (one subtracted eight hours, another
 * called `toISOString()` directly). On a UTC server the two disagreed by eight
 * hours, so a check-in at 03:00 Manila on the first of the month counted towards
 * the previous month on one leaderboard and the current month on the other. On a
 * developer machine in another timezone both were wrong in a third way.
 *
 * Nothing in this file reads the ambient timezone: instants are built with
 * `Date.UTC` and read with `getUTC*`, and tests assert absolute instants.
 */

/** Manila is UTC+8 all year; the Philippines has no daylight saving. */
export const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000

export interface YearMonth {
    year: number
    month: number
}

/**
 * A Manila calendar month expressed as UTC instants, ready to compare against
 * `timestamptz` columns.
 */
export interface MonthWindow {
    /** `YYYY-MM` */
    yearMonth: string
    /** First instant of the month: Manila 00:00 on the 1st, inclusive. */
    startUtc: Date
    /** First instant of the next month, exclusive. */
    endUtc: Date
    /** `startUtc` as an ISO-8601 instant, for passing straight to SQL. */
    startIso: string
    /** `endUtc` as an ISO-8601 instant, for passing straight to SQL. */
    endIso: string
}

/**
 * Parse a YYYY-MM string into year and month components
 * @param yearMonth - String in format "YYYY-MM" (e.g. "2024-03")
 * @returns YearMonth object or null if invalid
 */
export function parseYearMonth(yearMonth: string): YearMonth | null {
    // Validate format with regex
    const regex = /^(\d{4})-(\d{2})$/
    const match = yearMonth.match(regex)

    if (!match) {
        return null
    }

    const year = parseInt(match[1], 10)
    const month = parseInt(match[2], 10)

    // Validate month range (1-12)
    if (month < 1 || month > 12) {
        return null
    }

    // Validate year range (reasonable bounds: 2020-2100)
    if (year < 2020 || year > 2100) {
        return null
    }

    return { year, month }
}

/** Format a YearMonth as `YYYY-MM`. */
export function formatYearMonthKey(yearMonth: YearMonth): string {
    return `${yearMonth.year}-${String(yearMonth.month).padStart(2, "0")}`
}

/**
 * A UTC instant as a wall-clock reading in Manila. Read with `getUTC*` so the
 * result does not depend on the runtime's timezone.
 */
function manilaParts(instant: Date): { year: number; month: number; day: number } {
    const shifted = new Date(instant.getTime() + MANILA_OFFSET_MS)
    return {
        year: shifted.getUTCFullYear(),
        month: shifted.getUTCMonth() + 1,
        day: shifted.getUTCDate(),
    }
}

/**
 * The Manila month it is right now.
 * @param now - Injectable clock, for tests.
 */
export function currentMonthKey(now: Date = new Date()): string {
    return formatYearMonthKey(manilaParts(now))
}

/**
 * The Manila calendar day it is right now, as `YYYY-MM-DD`. This is the day a
 * visit belongs to.
 * @param now - Injectable clock, for tests.
 */
export function currentDayKey(now: Date = new Date()): string {
    const { year, month, day } = manilaParts(now)
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/**
 * The UTC bounds of the Manila calendar day it is at `now`, plus that day's key.
 *
 * Use this instead of building local midnights and shifting them by hand: the
 * hand-shifted version is only correct on a server that happens to run UTC.
 */
export function getManilaDayWindow(now: Date = new Date()): {
    dayKey: string
    startUtc: Date
    endUtc: Date
} {
    const { year, month, day } = manilaParts(now)

    const startUtc = new Date(
        Date.UTC(year, month - 1, day) - MANILA_OFFSET_MS
    )
    const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000)

    return {
        dayKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        startUtc,
        endUtc,
    }
}

/**
 * The UTC bounds of a Manila calendar month. `startUtc` is inclusive and
 * `endUtc` exclusive, so `[startUtc, endUtc)` never double-counts a midnight
 * boundary.
 *
 * @example getMonthWindow("2026-10") => 2026-09-30T16:00:00.000Z .. 2026-10-31T16:00:00.000Z
 */
export function getMonthWindow(yearMonth: string): MonthWindow | null {
    const parsed = parseYearMonth(yearMonth)
    if (!parsed) return null

    // Date.UTC normalises month overflow, so month 13 becomes January of the
    // next year without a rollover special case.
    const startUtc = new Date(
        Date.UTC(parsed.year, parsed.month - 1, 1) - MANILA_OFFSET_MS
    )
    const endUtc = new Date(
        Date.UTC(parsed.year, parsed.month, 1) - MANILA_OFFSET_MS
    )

    return {
        yearMonth,
        startUtc,
        endUtc,
        startIso: startUtc.toISOString(),
        endIso: endUtc.toISOString(),
    }
}

/**
 * Get the last N Manila months as YYYY-MM strings, most recent first.
 * @param n - Number of months to return
 * @param now - Injectable clock, for tests.
 */
export function getLastNMonths(n: number, now: Date = new Date()): string[] {
    if (n < 1) {
        return []
    }

    const { year: currentYear, month: currentMonth } = manilaParts(now)
    const months: string[] = []

    for (let i = 0; i < n; i++) {
        let year = currentYear
        let month = currentMonth - i

        // Handle year rollover
        while (month <= 0) {
            year -= 1
            month += 12
        }

        months.push(formatYearMonthKey({ year, month }))
    }

    return months
}

/**
 * Check if a given year-month is in the future according to the Manila
 * calendar. This is what stops a visitor whose clock (or browser locale) is
 * ahead of Manila from selecting a month that has not happened yet.
 * @param yearMonth - YearMonth object to check
 * @param now - Injectable clock, for tests.
 */
export function isFutureMonth(
    yearMonth: YearMonth,
    now: Date = new Date()
): boolean {
    const current = manilaParts(now)

    if (yearMonth.year > current.year) {
        return true
    }

    if (yearMonth.year === current.year && yearMonth.month > current.month) {
        return true
    }

    return false
}

/**
 * Resolve what a caller asked for into a month that exists: the requested month,
 * or the current Manila month when the request is missing or in the future.
 *
 * Both leaderboard read paths used to re-implement this clamp inline, which is
 * how they drifted apart in the first place.
 */
export function resolveLeaderboardMonth(
    yearMonth: string | null | undefined,
    now: Date = new Date()
): YearMonth {
    const parsed = parseYearMonth(yearMonth || "")

    if (!parsed || isFutureMonth(parsed, now)) {
        return parseYearMonth(currentMonthKey(now))!
    }

    return parsed
}

/**
 * Walk backwards from a given month, without consulting any clock.
 *
 * The client needs a month list, but the client's clock is not authoritative —
 * a browser in UTC+13 is already in next month while Manila is not. So the list
 * is derived from the month the server said it is, pure string arithmetic, no
 * `Date`.
 *
 * @param endMonthKey - `YYYY-MM`, included as the first element
 * @param count - How many months to return
 */
export function getMonthsEndingAt(endMonthKey: string, count: number): string[] {
    if (count < 1) return []

    const end = parseYearMonth(endMonthKey)
    if (!end) return []

    const months: string[] = []

    for (let i = 0; i < count; i++) {
        let year = end.year
        let month = end.month - i

        while (month <= 0) {
            year -= 1
            month += 12
        }

        months.push(formatYearMonthKey({ year, month }))
    }

    return months
}

/**
 * Every month from `startMonthKey` to `endMonthKey` inclusive, newest first.
 * @param startMonthKey - `YYYY-MM`
 * @param endMonthKey - `YYYY-MM`
 */
export function getMonthsBetween(
    startMonthKey: string,
    endMonthKey: string
): string[] {
    const start = parseYearMonth(startMonthKey)
    const end = parseYearMonth(endMonthKey)
    if (!start || !end) return []

    const startIndex = start.year * 12 + (start.month - 1)
    const endIndex = end.year * 12 + (end.month - 1)
    if (endIndex < startIndex) return []

    const months: string[] = []

    for (let index = endIndex; index >= startIndex; index--) {
        months.push(
            formatYearMonthKey({
                year: Math.floor(index / 12),
                month: (index % 12) + 1,
            })
        )
    }

    return months
}

/**
 * Format a YYYY-MM string for display, e.g. "March 2024".
 *
 * Formats from parts rather than through a `Date`, so the label cannot drift a
 * month on a machine west of UTC.
 * @param yearMonth - String in format "YYYY-MM"
 * @returns Formatted string like "March 2024"
 */
export function formatYearMonth(yearMonth: string): string {
    const parsed = parseYearMonth(yearMonth)

    if (!parsed) {
        return yearMonth
    }

    const monthName = new Date(Date.UTC(2000, parsed.month - 1, 1)).toLocaleDateString(
        "en-US",
        { month: "long", timeZone: "UTC" }
    )

    return `${monthName} ${parsed.year}`
}
