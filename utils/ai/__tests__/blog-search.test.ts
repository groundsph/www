import { describe, it, expect } from "bun:test"

describe("searchBlogPosts", () => {
    it("exports a searchBlogPosts function", async () => {
        const mod = await import("@/utils/ai/tools/blog-search")
        expect(typeof mod.searchBlogPosts).toBe("function")
    })
})
