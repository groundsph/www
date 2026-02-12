/**
 * Leaderboard month selection utilities
 */

export interface YearMonth {
    year: number
    month: number
}

/**
 * Parse a YYYY-MM string into year and month components
 * @param yearMonth - String in format "YYYY-MM" (e.g., "2024-03")
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

/**
 * Get the last N months as YYYY-MM strings
 * Most recent month first (descending order)
 * @param n - Number of months to return
 * @returns Array of YYYY-MM strings
 */
export function getLastNMonths(n: number): string[] {
    if (n < 1) {
        return []
    }

    const months: string[] = []
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1 // 1-12

    for (let i = 0; i < n; i++) {
        let year = currentYear
        let month = currentMonth - i

        // Handle year rollover
        while (month <= 0) {
            year -= 1
            month += 12
        }

        // Format as YYYY-MM
        const formattedMonth = month.toString().padStart(2, "0")
        months.push(`${year}-${formattedMonth}`)
    }

    return months
}

/**
 * Check if a given year-month is in the future
 * @param yearMonth - YearMonth object to check
 * @returns true if the month is in the future
 */
export function isFutureMonth(yearMonth: YearMonth): boolean {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1 // 1-12

    if (yearMonth.year > currentYear) {
        return true
    }

    if (yearMonth.year === currentYear && yearMonth.month > currentMonth) {
        return true
    }

    return false
}

/**
 * Get start and end dates for a given year-month
 * @param yearMonth - YearMonth object
 * @returns Object with startDate (inclusive) and endDate (exclusive for next month)
 */
export function getMonthDateRange(yearMonth: YearMonth): {
    startDate: Date
    endDate: Date
} {
    const startDate = new Date(yearMonth.year, yearMonth.month - 1, 1)
    const endDate = new Date(yearMonth.year, yearMonth.month, 1)

    return { startDate, endDate }
}

/**
 * Format a YYYY-MM string for display
 * @param yearMonth - String in format "YYYY-MM"
 * @returns Formatted string like "March 2024"
 */
export function formatYearMonth(yearMonth: string): string {
    const parsed = parseYearMonth(yearMonth)

    if (!parsed) {
        return yearMonth
    }

    const date = new Date(parsed.year, parsed.month - 1, 1)
    return date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
    })
}
