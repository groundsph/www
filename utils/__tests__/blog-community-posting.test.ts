import { describe, it, expect } from "bun:test"
import { canSubmitCommunityBlog } from "@/utils/blog/community-posting"

describe("canSubmitCommunityBlog", () => {
    it("allows regular users to submit community posts without a cafe", () => {
        const result = canSubmitCommunityBlog({
            role: "user",
            category: "community",
            hasCafeOwnership: false,
        })
        expect(result.allowed).toBe(true)
        expect(result.requiresCafe).toBe(false)
    })

    it("blocks regular users from non-community categories", () => {
        const result = canSubmitCommunityBlog({
            role: "user",
            category: "guides",
            hasCafeOwnership: false,
        })
        expect(result.allowed).toBe(false)
    })
})
