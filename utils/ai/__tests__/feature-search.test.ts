import { describe, it, expect } from "bun:test"

describe("findCafesWithFeature", () => {
    it("exports a findCafesWithFeature function", async () => {
        const mod = await import("@/utils/ai/tools/feature-search")
        expect(typeof mod.findCafesWithFeature).toBe("function")
    })
})
