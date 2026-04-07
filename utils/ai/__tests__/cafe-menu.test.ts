import { describe, it, expect } from "bun:test"

describe("getCafeMenu", () => {
    it("exports a getCafeMenu function", async () => {
        const mod = await import("@/utils/ai/tools/cafe-menu")
        expect(typeof mod.getCafeMenu).toBe("function")
    })
})
