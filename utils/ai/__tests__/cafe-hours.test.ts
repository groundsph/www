import { describe, it, expect } from "bun:test"

describe("getCafeHours", () => {
    it("exports a getCafeHours function", async () => {
        const mod = await import("@/utils/ai/tools/cafe-hours")
        expect(typeof mod.getCafeHours).toBe("function")
    })

    it("returns error for unknown slug", async () => {
        const { getCafeHours } = await import("@/utils/ai/tools/cafe-hours")
        const result = await getCafeHours("nonexistent-cafe-xyz-12345")
        expect(result).toHaveProperty("error")
    })
})
