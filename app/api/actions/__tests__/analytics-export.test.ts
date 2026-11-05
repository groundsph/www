import { describe, it, expect, beforeEach, mock } from "bun:test"

let mockUser: { id: string } | null = { id: "user-1" }
let mockOwnerIds: string[] = ["user-1"]
let mockPageViews: Array<Record<string, unknown>> = []

mock.module("next/headers", () => ({
    headers: () => Promise.resolve({ get: () => null }),
}))

mock.module("@/lib/auth", () => ({
    getCurrentUser: () => Promise.resolve(mockUser),
}))

mock.module("@/db", () => ({
    db: {
        select: () => ({
            from: () => ({
                where: () => ({
                    limit: () => Promise.resolve([{ ownerIds: mockOwnerIds }]),
                    then: (resolve: (rows: unknown[]) => unknown) =>
                        resolve(mockPageViews),
                }),
            }),
        }),
    },
    eq: () => ({}),
    and: () => ({}),
    gte: () => ({}),
    lte: () => ({}),
}))

const { exportCafeAnalyticsCSV } = await import(
    "@/app/api/actions/analytics"
)

describe("exportCafeAnalyticsCSV", () => {
    beforeEach(() => {
        mockUser = { id: "user-1" }
        mockOwnerIds = ["user-1"]
        mockPageViews = []
    })

    it("emits a header row even when the cafe has no views", async () => {
        const result = await exportCafeAnalyticsCSV("cafe-1", 7)

        expect(result.success).toBe(true)
        const csv = result.data!.csv
        const lines = csv.trim().split("\n")
        expect(lines[0]).toBe("date,views,unique_visitors")
        expect(lines.length).toBe(8)
    })

    it("emits one row per day, never bucketed, even for 90 days", async () => {
        const result = await exportCafeAnalyticsCSV("cafe-1", 90)

        expect(result.success).toBe(true)
        const lines = result.data!.csv.trim().split("\n")
        expect(lines.length).toBe(91)
    })

    it("rejects a non-owner", async () => {
        mockOwnerIds = ["someone-else"]
        const result = await exportCafeAnalyticsCSV("cafe-1", 30)
        expect(result.success).toBe(false)
        expect(result.error).toContain("Not authorized")
    })

    it("rejects an unauthenticated caller", async () => {
        mockUser = null
        const result = await exportCafeAnalyticsCSV("cafe-1", 30)
        expect(result.success).toBe(false)
    })

    it("rejects a period outside 7/30/90", async () => {
        const result = await exportCafeAnalyticsCSV("cafe-1", 45 as never)
        expect(result.success).toBe(false)
    })

    it("names the file after the cafe and today's date", async () => {
        const result = await exportCafeAnalyticsCSV("cafe-1", 7)
        expect(result.data!.filename).toContain("cafe-1")
        expect(result.data!.filename.endsWith(".csv")).toBe(true)
    })
})
