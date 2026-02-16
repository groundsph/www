import { describe, it, expect } from "bun:test"
import { resolveBlogStatus } from "@/utils/blog/moderation"

describe("resolveBlogStatus", () => {
    it("forces pending for non-admin publish", () => {
        expect(resolveBlogStatus("published", false)).toBe("pending")
    })

    it("allows published for admin/moderator", () => {
        expect(resolveBlogStatus("published", true)).toBe("published")
    })

    it("passes through draft status regardless of role", () => {
        expect(resolveBlogStatus("draft", false)).toBe("draft")
        expect(resolveBlogStatus("draft", true)).toBe("draft")
    })

    it("passes through pending status regardless of role", () => {
        expect(resolveBlogStatus("pending", false)).toBe("pending")
        expect(resolveBlogStatus("pending", true)).toBe("pending")
    })

    it("passes through archived status regardless of role", () => {
        expect(resolveBlogStatus("archived", false)).toBe("archived")
        expect(resolveBlogStatus("archived", true)).toBe("archived")
    })
})
