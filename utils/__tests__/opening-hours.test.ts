import { describe, expect, it } from "bun:test"
import { isOpenAt, nextOpenWindow } from "@/utils/crawls/opening-hours"
import type { OperatingHours } from "@/utils/types/cafe"

describe("opening hours", () => {
    const hours: OperatingHours = [
        { day: "mon", open: "08:00", close: "18:00", is_24_hours: false },
        { day: "tue", open: "08:00", close: "18:00", is_24_hours: false },
    ]

    it("checks open state for a given day/time", () => {
        expect(isOpenAt(hours, "mon", "09:30")).toBe(true)
        expect(isOpenAt(hours, "mon", "19:00")).toBe(false)
    })

    it("finds the next open window", () => {
        const window = nextOpenWindow(hours, "mon", "19:00")
        expect(window?.day).toBe("tue")
        expect(window?.open).toBe("08:00")
    })
})
