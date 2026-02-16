import { describe, it, expect } from "bun:test"
import { canSubmitBlogPost } from "@/utils/blog/community-posting"
import type { BlogCategory } from "@/utils/types/blog"

describe("canSubmitBlogPost", () => {
    const allCategories: BlogCategory[] = ["news", "guides", "events", "promotions", "community"]

    describe("admin and moderator roles", () => {
        it("allows admin to submit to any category without cafe ownership", () => {
            for (const category of allCategories) {
                const result = canSubmitBlogPost({
                    role: "admin",
                    category,
                    hasCafeOwnership: false,
                })
                expect(result.allowed).toBe(true)
            }
        })

        it("allows moderator to submit to any category without cafe ownership", () => {
            for (const category of allCategories) {
                const result = canSubmitBlogPost({
                    role: "moderator",
                    category,
                    hasCafeOwnership: false,
                })
                expect(result.allowed).toBe(true)
            }
        })
    })

    describe("writer role", () => {
        it("allows writer to submit to allowed categories (news, guides, community)", () => {
            const allowedCategories: BlogCategory[] = ["news", "guides", "community"]
            for (const category of allowedCategories) {
                const result = canSubmitBlogPost({
                    role: "writer",
                    category,
                    hasCafeOwnership: false,
                })
                expect(result.allowed).toBe(true)
            }
        })

        it("blocks writer from restricted categories (events, promotions)", () => {
            const restrictedCategories: BlogCategory[] = ["events", "promotions"]
            for (const category of restrictedCategories) {
                const result = canSubmitBlogPost({
                    role: "writer",
                    category,
                    hasCafeOwnership: false,
                })
                expect(result.allowed).toBe(false)
            }
        })
    })

    describe("regular user role", () => {
        it("allows user to submit community posts without cafe ownership", () => {
            const result = canSubmitBlogPost({
                role: "user",
                category: "community",
                hasCafeOwnership: false,
            })
            expect(result.allowed).toBe(true)
        })

        it("blocks user from submitting to non-community categories", () => {
            const nonCommunityCategories: BlogCategory[] = ["news", "guides", "events", "promotions"]
            for (const category of nonCommunityCategories) {
                const result = canSubmitBlogPost({
                    role: "user",
                    category,
                    hasCafeOwnership: false,
                })
                expect(result.allowed).toBe(false)
            }
        })

        it("allows user with cafe ownership to submit any category", () => {
            for (const category of allCategories) {
                const result = canSubmitBlogPost({
                    role: "user",
                    category,
                    hasCafeOwnership: true,
                })
                expect(result.allowed).toBe(true)
            }
        })
    })

    describe("null role handling", () => {
        it("blocks null role without cafe ownership", () => {
            for (const category of allCategories) {
                const result = canSubmitBlogPost({
                    role: null,
                    category,
                    hasCafeOwnership: false,
                })
                expect(result.allowed).toBe(false)
            }
        })

        it("allows null role with cafe ownership", () => {
            for (const category of allCategories) {
                const result = canSubmitBlogPost({
                    role: null,
                    category,
                    hasCafeOwnership: true,
                })
                expect(result.allowed).toBe(true)
            }
        })
    })

    describe("cafe ownership", () => {
        it("allows cafe owners to submit regardless of role", () => {
            const roles: ("user" | "writer" | null)[] = ["user", "writer", null]
            for (const role of roles) {
                for (const category of allCategories) {
                    const result = canSubmitBlogPost({
                        role,
                        category,
                        hasCafeOwnership: true,
                    })
                    expect(result.allowed).toBe(true)
                }
            }
        })

        it("requires cafe ownership for users posting non-community content", () => {
            const result = canSubmitBlogPost({
                role: "user",
                category: "news",
                hasCafeOwnership: false,
            })
            expect(result.allowed).toBe(false)
        })
    })
})
