import { describe, it, expect } from "bun:test"

describe("getCafeStats", () => {
    it("exports a getCafeStats function", async () => {
        const mod = await import("@/utils/ai/tools/cafe-stats")
        expect(typeof mod.getCafeStats).toBe("function")
    })
})
