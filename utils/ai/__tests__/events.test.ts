import { describe, it, expect } from "bun:test"

describe("getUpcomingEvents", () => {
    it("exports a getUpcomingEvents function", async () => {
        const mod = await import("@/utils/ai/tools/events")
        expect(typeof mod.getUpcomingEvents).toBe("function")
    })
})
