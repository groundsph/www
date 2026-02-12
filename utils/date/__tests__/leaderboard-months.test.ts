import { describe, expect, it } from "bun:test"
import {
    parseYearMonth,
    getLastNMonths,
    isFutureMonth,
    getMonthDateRange,
    formatYearMonth,
} from "@/utils/date/leaderboard-months"

describe("parseYearMonth", () => {
    it("parses valid year-month strings", () => {
        expect(parseYearMonth("2024-03")).toEqual({ year: 2024, month: 3 })
        expect(parseYearMonth("2023-12")).toEqual({ year: 2023, month: 12 })
        expect(parseYearMonth("2025-01")).toEqual({ year: 2025, month: 1 })
    })

    it("rejects invalid month format", () => {
        expect(parseYearMonth("2024-13")).toBe(null)
        expect(parseYearMonth("2024-00")).toBe(null)
        expect(parseYearMonth("2024-1")).toBe(null) // Missing leading zero
    })

    it("rejects invalid formats", () => {
        expect(parseYearMonth("invalid")).toBe(null)
        expect(parseYearMonth("2024/03")).toBe(null)
        expect(parseYearMonth("2024")).toBe(null)
        expect(parseYearMonth("03-2024")).toBe(null)
    })

    it("rejects out of range years", () => {
        expect(parseYearMonth("2019-06")).toBe(null)
        expect(parseYearMonth("2101-06")).toBe(null)
    })
})

describe("getLastNMonths", () => {
    it("returns last N months", () => {
        const months = getLastNMonths(3)
        expect(months.length).toBe(3)
        expect(months[0]).toMatch(/^\d{4}-\d{2}$/)
    })

    it("returns empty array for n < 1", () => {
        expect(getLastNMonths(0)).toEqual([])
        expect(getLastNMonths(-1)).toEqual([])
    })

    it("returns months in descending order", () => {
        const months = getLastNMonths(3)
        // Parse each month and verify descending order
        const parsed = months.map((m) => {
            const [year, month] = m.split("-").map(Number)
            return { year, month }
        })

        for (let i = 1; i < parsed.length; i++) {
            const prev = parsed[i - 1]
            const curr = parsed[i]

            // Either same year with previous month, or previous year with month 12
            const prevExpected = prev.month === 1 ? 12 : prev.month - 1
            const yearExpected = prev.month === 1 ? prev.year - 1 : prev.year

            expect(curr.month).toBe(prevExpected)
            expect(curr.year).toBe(yearExpected)
        }
    })

    it("handles year rollover correctly", () => {
        // Test that we can get months across year boundaries
        const months = getLastNMonths(15)
        expect(months.length).toBe(15)

        // Verify all are valid YYYY-MM format
        months.forEach((m) => {
            expect(m).toMatch(/^\d{4}-\d{2}$/)
        })
    })
})

describe("isFutureMonth", () => {
    it("returns true for future months", () => {
        const now = new Date()
        const futureYear = now.getFullYear() + 1
        expect(isFutureMonth({ year: futureYear, month: 1 })).toBe(true)
    })

    it("returns false for past months", () => {
        const now = new Date()
        const pastYear = now.getFullYear() - 1
        expect(isFutureMonth({ year: pastYear, month: 12 })).toBe(false)
    })

    it("returns false for current month", () => {
        const now = new Date()
        const currentYear = now.getFullYear()
        const currentMonth = now.getMonth() + 1
        expect(isFutureMonth({ year: currentYear, month: currentMonth })).toBe(false)
    })
})

describe("getMonthDateRange", () => {
    it("returns correct date range for a month", () => {
        const { startDate, endDate } = getMonthDateRange({ year: 2024, month: 3 })

        expect(startDate.getFullYear()).toBe(2024)
        expect(startDate.getMonth()).toBe(2) // March is index 2
        expect(startDate.getDate()).toBe(1)

        expect(endDate.getFullYear()).toBe(2024)
        expect(endDate.getMonth()).toBe(3) // April is index 3
        expect(endDate.getDate()).toBe(1)
    })

    it("handles year rollover correctly", () => {
        const { startDate, endDate } = getMonthDateRange({ year: 2024, month: 12 })

        expect(startDate.getFullYear()).toBe(2024)
        expect(startDate.getMonth()).toBe(11) // December is index 11

        expect(endDate.getFullYear()).toBe(2025)
        expect(endDate.getMonth()).toBe(0) // January is index 0
    })
})

describe("formatYearMonth", () => {
    it("formats valid year-month strings", () => {
        expect(formatYearMonth("2024-03")).toBe("March 2024")
        expect(formatYearMonth("2024-12")).toBe("December 2024")
        expect(formatYearMonth("2024-01")).toBe("January 2024")
    })

    it("returns original string for invalid format", () => {
        expect(formatYearMonth("invalid")).toBe("invalid")
    })
})
