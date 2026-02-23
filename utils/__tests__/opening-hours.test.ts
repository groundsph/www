import { describe, expect, it } from "bun:test"
import { isOpenAt, nextOpenWindow } from "@/utils/crawls/opening-hours"
import type { OperatingHours } from "@/utils/types/cafe"

describe("opening hours", () => {
    describe("isOpenAt", () => {
        const hours: OperatingHours = [
            { day: "mon", open: "08:00", close: "18:00", is_24_hours: false },
            { day: "tue", open: "08:00", close: "18:00", is_24_hours: false },
            { day: "wed", open: "10:00", close: "22:00", is_24_hours: false },
        ]

        it("checks open state for a given day/time", () => {
            expect(isOpenAt(hours, "mon", "09:30")).toBe(true)
            expect(isOpenAt(hours, "mon", "19:00")).toBe(false)
        })

        it("handles boundary times correctly", () => {
            expect(isOpenAt(hours, "mon", "08:00")).toBe(true)
            expect(isOpenAt(hours, "mon", "18:00")).toBe(false)
            expect(isOpenAt(hours, "mon", "07:59")).toBe(false)
            expect(isOpenAt(hours, "mon", "17:59")).toBe(true)
        })
    })

    describe("isOpenAt - overnight hours", () => {
        const hours: OperatingHours = [
            { day: "fri", open: "22:00", close: "02:00", is_24_hours: false },
        ]

        it("handles overnight hours (close < open)", () => {
            expect(isOpenAt(hours, "fri", "23:00")).toBe(true)
            expect(isOpenAt(hours, "fri", "01:00")).toBe(true)
            expect(isOpenAt(hours, "fri", "03:00")).toBe(false)
            expect(isOpenAt(hours, "fri", "21:00")).toBe(false)
        })

        it("handles overnight boundary times", () => {
            expect(isOpenAt(hours, "fri", "22:00")).toBe(true)
            expect(isOpenAt(hours, "fri", "02:00")).toBe(false)
        })
    })

    describe("isOpenAt - 24 hours", () => {
        const hours: OperatingHours = [
            { day: "sat", open: "00:00", close: "00:00", is_24_hours: true },
        ]

        it("returns true for any time when is_24_hours is true", () => {
            expect(isOpenAt(hours, "sat", "00:00")).toBe(true)
            expect(isOpenAt(hours, "sat", "12:00")).toBe(true)
            expect(isOpenAt(hours, "sat", "23:59")).toBe(true)
        })
    })

    describe("isOpenAt - closed days", () => {
        const hours: OperatingHours = [
            { day: "sun", open: "08:00", close: "18:00", is_24_hours: false, is_closed: true },
        ]

        it("returns false when is_closed is true", () => {
            expect(isOpenAt(hours, "sun", "12:00")).toBe(false)
            expect(isOpenAt(hours, "sun", "08:00")).toBe(false)
        })
    })

    describe("nextOpenWindow", () => {
        const hours: OperatingHours = [
            { day: "mon", open: "08:00", close: "18:00", is_24_hours: false },
            { day: "tue", open: "08:00", close: "18:00", is_24_hours: false },
            { day: "wed", open: "10:00", close: "22:00", is_24_hours: false },
        ]

        it("finds the next open window when currently closed", () => {
            const window = nextOpenWindow(hours, "mon", "19:00")
            expect(window?.day).toBe("tue")
            expect(window?.open).toBe("08:00")
        })

        it("returns current day when currently open", () => {
            const window = nextOpenWindow(hours, "mon", "09:00")
            expect(window?.day).toBe("mon")
            expect(window?.open).toBe("08:00")
        })
    })

    describe("nextOpenWindow - opens later today", () => {
        const hours: OperatingHours = [
            { day: "mon", open: "08:00", close: "18:00", is_24_hours: false },
            { day: "tue", open: "09:00", close: "17:00", is_24_hours: false },
        ]

        it("returns today's entry when cafe opens later today", () => {
            const window = nextOpenWindow(hours, "mon", "06:00")
            expect(window?.day).toBe("mon")
            expect(window?.open).toBe("08:00")
        })

        it("returns tomorrow when already closed for the day", () => {
            const window = nextOpenWindow(hours, "mon", "19:00")
            expect(window?.day).toBe("tue")
            expect(window?.open).toBe("09:00")
        })
    })

    describe("nextOpenWindow - week wraparound", () => {
        const hours: OperatingHours = [
            { day: "sat", open: "10:00", close: "20:00", is_24_hours: false },
            { day: "sun", open: "12:00", close: "18:00", is_24_hours: false },
            { day: "mon", open: "08:00", close: "18:00", is_24_hours: false },
        ]

        it("wraps from Saturday to Sunday to Monday", () => {
            const satWindow = nextOpenWindow(hours, "sat", "21:00")
            expect(satWindow?.day).toBe("sun")
            
            const sunWindow = nextOpenWindow(hours, "sun", "19:00")
            expect(sunWindow?.day).toBe("mon")
        })

        it("wraps from Sunday to Monday when closed on Sunday evening", () => {
            const window = nextOpenWindow(hours, "sun", "19:00")
            expect(window?.day).toBe("mon")
            expect(window?.open).toBe("08:00")
        })
    })

    describe("nextOpenWindow - with closed days", () => {
        const hours: OperatingHours = [
            { day: "mon", open: "08:00", close: "18:00", is_24_hours: false },
            { day: "tue", open: "08:00", close: "18:00", is_24_hours: false, is_closed: true },
            { day: "wed", open: "10:00", close: "22:00", is_24_hours: false },
        ]

        it("skips closed days", () => {
            const window = nextOpenWindow(hours, "mon", "19:00")
            expect(window?.day).toBe("wed")
            expect(window?.open).toBe("10:00")
        })
    })

    describe("nextOpenWindow - 24 hour cafes", () => {
        const hours: OperatingHours = [
            { day: "fri", open: "00:00", close: "00:00", is_24_hours: true },
            { day: "sat", open: "10:00", close: "20:00", is_24_hours: false },
        ]

        it("returns 24-hour entry when currently open", () => {
            const window = nextOpenWindow(hours, "fri", "15:00")
            expect(window?.day).toBe("fri")
            expect(window?.is_24_hours).toBe(true)
        })
    })

    describe("toMinutes validation", () => {
        it("throws error for invalid time format", () => {
            expect(() => isOpenAt([{ day: "mon", open: "25:00", close: "18:00", is_24_hours: false }], "mon", "12:00")).toThrow("Invalid time: 25:00")
            expect(() => isOpenAt([{ day: "mon", open: "08:00", close: "18:00", is_24_hours: false }], "mon", "invalid")).toThrow("Invalid time: invalid")
        })

        it("throws error for out of range hours/minutes", () => {
            expect(() => isOpenAt([{ day: "mon", open: "08:00", close: "18:00", is_24_hours: false }], "mon", "24:00")).toThrow("Invalid time: 24:00")
            expect(() => isOpenAt([{ day: "mon", open: "08:00", close: "18:00", is_24_hours: false }], "mon", "12:60")).toThrow("Invalid time: 12:60")
            expect(() => isOpenAt([{ day: "mon", open: "08:00", close: "18:00", is_24_hours: false }], "mon", "-1:00")).toThrow("Invalid time: -1:00")
        })
    })
})
