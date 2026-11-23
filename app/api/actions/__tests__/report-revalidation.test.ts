import { describe, it, expect, beforeEach, mock } from "bun:test"

// The database and session are faked at the module boundary, and the expected
// paths are written literally rather than derived from the helper under test.

let mockCafeLookupResult: { slug: string | null } | null = { slug: "kape-lolo" }
const mockRevalidatedPaths: string[] = []
const mockInsertedReports: unknown[] = []

mock.module("@/lib/auth", () => ({
    auth: {
        api: {
            getSession: () => Promise.resolve({ user: { id: "user-1" } }),
        },
    },
}))

mock.module("next/headers", () => ({
    headers: () => Promise.resolve({ get: () => null }),
}))

mock.module("next/cache", () => ({
    revalidatePath: (path: string) => {
        mockRevalidatedPaths.push(path)
    },
}))

mock.module("@/db", () => ({
    db: {
        query: {
            cafeReports: {
                findFirst: () => Promise.resolve(null),
            },
            cafes: {
                findFirst: () => Promise.resolve(mockCafeLookupResult),
            },
        },
        insert: () => ({
            values: (report: unknown) => {
                mockInsertedReports.push(report)
                return Promise.resolve(undefined)
            },
        }),
        select: () => ({
            from: () => ({
                where: () => Promise.resolve([{ count: 1 }]),
            }),
        }),
        update: () => ({
            set: () => ({ where: () => Promise.resolve(undefined) }),
        }),
    },
}))

const { submitCafeReport } = await import("@/app/api/actions/report")

describe("submitCafeReport revalidation", () => {
    beforeEach(() => {
        mockCafeLookupResult = { slug: "kape-lolo" }
        mockRevalidatedPaths.length = 0
        mockInsertedReports.length = 0
    })

    it("revalidates the cafe page and the cafe menu page after a report", async () => {
        const result = await submitCafeReport("cafe-1", "other")

        expect(result.success).toBe(true)
        expect(mockInsertedReports).toHaveLength(1)
        expect(mockRevalidatedPaths).toEqual([
            "/cafes/kape-lolo",
            "/cafes/kape-lolo/menu",
        ])
    })

    it("never revalidates a /cafe/<id> shaped path", async () => {
        await submitCafeReport("cafe-1", "other")

        expect(mockRevalidatedPaths.filter((path) => path.startsWith("/cafe/"))).toEqual([])
    })
})
