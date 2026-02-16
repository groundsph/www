import { describe, it, expect } from "bun:test"

describe("blog actions exports", () => {
    it("exports createCommunityBlogPost", async () => {
        const mod = await import("@/app/api/actions/blog")
        expect(typeof mod.createCommunityBlogPost).toBe("function")
    })

    it("exports getUserBlogPosts", async () => {
        const mod = await import("@/app/api/actions/blog")
        expect(typeof mod.getUserBlogPosts).toBe("function")
    })
})
