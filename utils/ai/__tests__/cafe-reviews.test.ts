import { describe, it, expect } from "bun:test"

describe("getCafeReviews", () => {
    it("exports a getCafeReviews function", async () => {
        const mod = await import("@/utils/ai/tools/cafe-reviews")
        expect(typeof mod.getCafeReviews).toBe("function")
    })
})
