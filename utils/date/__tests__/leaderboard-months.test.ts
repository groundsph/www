import { describe, it, expect } from "bun:test"
import {
    currentDayKey,
    currentMonthKey,
    formatYearMonth,
    formatYearMonthKey,
    getLastNMonths,
    getMonthWindow,
    isFutureMonth,
    parseYearMonth,
} from "@/utils/date/leaderboard-months"

/**
 * Assertions are on absolute instants, never on local getters. That is the whole
 * point of the module: these must pass identically on a machine in Manila, in
 * UTC, and in PST (`TZ=UTC bun run test` is run alongside the normal suite).
 */

describe("parseYearMonth", () => {
    it("parses valid year-month strings", () => {
        expect(parseYearMonth("2024-03")).toEqual({ year: 2024, month: 3 })
        expect(parseYearMonth("2023-12")).toEqual({ year: 2023, month: 12 })
    })

    it("rejects out-of-range months", () => {
        expect(parseYearMonth("2024-13")).toBe(null)
        expect(parseYearMonth("2024-00")).toBe(null)
        expect(parseYearMonth("2024-1")).toBe(null)
    })

    it("rejects malformed input", () => {
        expect(parseYearMonth("invalid")).toBe(null)
        expect(parseYearMonth("2024/03")).toBe(null)
    })

    it("rejects years outside the supported range", () => {
        expect(parseYearMonth("2019-06")).toBe(null)
        expect(parseYearMonth("2101-06")).toBe(null)
    })
})

describe("formatYearMonthKey", () => {
    it("pads the month", () => {
        expect(formatYearMonthKey({ year: 2024, month: 3 })).toBe("2024-03")
        expect(formatYearMonthKey({ year: 2024, month: 12 })).toBe("2024-12")
    })
})

describe("getMonthWindow", () => {
    it("starts and ends at Manila midnight expressed as UTC", () => {
        const window = getMonthWindow("2026-10")!

        expect(window.startIso).toBe("2026-09-30T16:00:00.000Z")
        expect(window.endIso).toBe("2026-10-31T16:00:00.000Z")
    })

    it("handles January, whose window opens in the previous year", () => {
        const window = getMonthWindow("2026-01")!

        expect(window.startIso).toBe("2025-12-31T16:00:00.000Z")
        expect(window.endIso).toBe("2026-01-31T16:00:00.000Z")
    })

    it("handles December, whose window closes in the same year", () => {
        const window = getMonthWindow("2026-12")!

        expect(window.startIso).toBe("2026-11-30T16:00:00.000Z")
        expect(window.endIso).toBe("2026-12-31T16:00:00.000Z")
    })

    it("returns null for an invalid month", () => {
        expect(getMonthWindow("2026-13")).toBe(null)
    })

    it("is half-open: the last instant of the month is inside, midnight of the next is not", () => {
        const october = getMonthWindow("2026-10")!
        const november = getMonthWindow("2026-11")!

        const lastInstant = new Date("2026-10-31T15:59:59.999Z")
        const firstInstantOfNext = new Date("2026-10-31T16:00:00.000Z")

        expect(lastInstant >= october.startUtc && lastInstant < october.endUtc).toBe(true)
        expect(firstInstantOfNext >= october.startUtc && firstInstantOfNext < october.endUtc).toBe(false)
        expect(firstInstantOfNext >= november.startUtc && firstInstantOfNext < november.endUtc).toBe(true)
        // Adjacent windows are contiguous: no gap, no overlap.
        expect(october.endUtc.getTime()).toBe(november.startUtc.getTime())
    })
})

describe("currentMonthKey", () => {
    it("is the Manila month, not the UTC month", () => {
        // 2026-10-31T16:00Z is already 1 November in Manila.
        expect(currentMonthKey(new Date("2026-10-31T16:00:00.000Z"))).toBe("2026-11")
        // One millisecond earlier it is still October.
        expect(currentMonthKey(new Date("2026-10-31T15:59:59.999Z"))).toBe("2026-10")
    })

    it("agrees with the window it names", () => {
        const now = new Date("2026-11-15T04:30:00.000Z")
        const key = currentMonthKey(now)
        const window = getMonthWindow(key)!

        expect(now >= window.startUtc && now < window.endUtc).toBe(true)
    })
})

describe("currentDayKey", () => {
    it("is the Manila day, not the UTC day", () => {
        expect(currentDayKey(new Date("2026-10-31T16:00:00.000Z"))).toBe("2026-11-01")
        expect(currentDayKey(new Date("2026-10-31T15:59:59.999Z"))).toBe("2026-10-31")
    })
})

describe("getLastNMonths", () => {
    it("returns the most recent N months, newest first", () => {
        expect(getLastNMonths(3, new Date("2026-01-15T00:00:00.000Z"))).toEqual([
            "2026-01",
            "2025-12",
            "2025-11",
        ])
    })

    it("rolls the whole list forward once Manila has crossed midnight", () => {
        // 2026-01-31T20:00Z is 1 February in Manila.
        expect(getLastNMonths(3, new Date("2026-01-31T20:00:00.000Z"))).toEqual([
            "2026-02",
            "2026-01",
            "2025-12",
        ])
    })

    it("walks back across a year boundary", () => {
        const months = getLastNMonths(15, new Date("2026-01-15T00:00:00.000Z"))

        expect(months).toHaveLength(15)
        expect(months[0]).toBe("2026-01")
        expect(months[12]).toBe("2025-01")
        expect(months[14]).toBe("2024-11")
    })

    it("returns nothing for a non-positive count", () => {
        expect(getLastNMonths(0)).toEqual([])
        expect(getLastNMonths(-1)).toEqual([])
    })
})

describe("isFutureMonth", () => {
    it("is false for the current Manila month", () => {
        // Still October in Manila at 15:59Z on the 31st.
        expect(
            isFutureMonth({ year: 2026, month: 10 }, new Date("2026-10-31T15:59:59.999Z"))
        ).toBe(false)
    })

    it("flips at Manila midnight, not UTC midnight", () => {
        expect(
            isFutureMonth({ year: 2026, month: 10 }, new Date("2026-10-31T16:00:00.000Z"))
        ).toBe(false)
        expect(
            isFutureMonth({ year: 2026, month: 11 }, new Date("2026-10-31T15:59:59.999Z"))
        ).toBe(true)
        expect(
            isFutureMonth({ year: 2026, month: 11 }, new Date("2026-10-31T16:00:00.000Z"))
        ).toBe(false)
    })

    it("handles year boundaries", () => {
        const now = new Date("2025-12-31T16:00:00.000Z") // 1 January 2026 in Manila
        expect(isFutureMonth({ year: 2026, month: 1 }, now)).toBe(false)
        expect(isFutureMonth({ year: 2027, month: 1 }, now)).toBe(true)
        expect(isFutureMonth({ year: 2025, month: 12 }, now)).toBe(false)
    })
})

describe("formatYearMonth", () => {
    it("labels the month without a Date round-trip", () => {
        expect(formatYearMonth("2024-03")).toBe("March 2024")
        expect(formatYearMonth("2024-12")).toBe("December 2024")
        expect(formatYearMonth("2024-01")).toBe("January 2024")
    })

    it("passes invalid input through unchanged", () => {
        expect(formatYearMonth("invalid")).toBe("invalid")
    })
})
