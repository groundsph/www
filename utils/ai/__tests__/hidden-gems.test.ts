import { describe, it, expect } from "bun:test"

describe("findHiddenGems", () => {
    it("exports a findHiddenGems function", async () => {
        const mod = await import("@/utils/ai/tools/hidden-gems")
        expect(typeof mod.findHiddenGems).toBe("function")
    })
})
