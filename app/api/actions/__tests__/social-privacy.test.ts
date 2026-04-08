import { describe, it, expect, beforeEach, mock } from "bun:test"

let mockUser: { id: string; role?: string } | null = null

mock.module("next/headers", () => ({
    headers: () =>
        Promise.resolve({
            get: () => null,
        }),
}))

mock.module("@/lib/auth", () => ({
    getCurrentUser: () => Promise.resolve(mockUser),
}))

mock.module("@/db", () => ({
    db: {
        select: () => ({
            from: () => ({
                where: () => ({
                    and: () => ({
                        orderBy: () => ({
                            limit: () => ({
                                offset: () => Promise.resolve([]),
                                limit: () => Promise.resolve([]),
                            }),
                            limit: () => Promise.resolve([]),
                        }),
                        limit: () => Promise.resolve([]),
                    }),
                    limit: () => Promise.resolve([]),
                }),
                leftJoin: () => ({
                    where: () => Promise.resolve([]),
                }),
                innerJoin: () => ({
                    where: () => ({
                        orderBy: () => ({
                            limit: () => ({
                                offset: () => Promise.resolve([]),
                            }),
                            limit: () => Promise.resolve([]),
                        }),
                        limit: () => Promise.resolve([]),
                    }),
                }),
            }),
        }),
        insert: () => ({
            values: () => ({
                returning: () => Promise.resolve([{ id: "new-id" }]),
            }),
        }),
        update: () => ({
            set: () => ({
                where: () => Promise.resolve({ rowsAffected: 1 }),
            }),
        }),
    },
    eq: () => ({}),
    and: () => ({}),
    or: () => ({}),
    desc: () => ({}),
    sql: () => ({}),
    inArray: () => ({}),
    count: () => ({}),
}))

const { updateProfile } = await import("../profile")

describe("Privacy Enforcement Tests", () => {
    beforeEach(() => {
        mockUser = null
    })

    describe("updateProfile authorization", () => {
        it("rejects updates from non-owner users", async () => {
            mockUser = { id: "stranger-id" }

            const result = await updateProfile("alice-id", { display_name: "Hacker" })

            expect(result.success).toBe(false)
            expect(result.error).toBe("Not authorized to update this profile")
        })

        it("allows updates from the owner", async () => {
            mockUser = { id: "alice-id" }

            const result = await updateProfile("alice-id", { display_name: "Alice Updated" })

            expect(result.success).toBe(true)
        })

        it("allows admin updates to any profile", async () => {
            mockUser = { id: "admin-id", role: "admin" }

            const result = await updateProfile("alice-id", { display_name: "Admin Update" })

            expect(result.success).toBe(true)
        })

        it("rejects updates when not authenticated", async () => {
            mockUser = null

            const result = await updateProfile("alice-id", { display_name: "Hacker" })

            expect(result.success).toBe(false)
            expect(result.error).toBe("Authentication required")
        })
    })
})
