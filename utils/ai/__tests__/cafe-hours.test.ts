import { describe, it, expect, mock } from "bun:test"

// Mock the db module before importing the function
mock.module("@/db", () => ({
    db: {
        select: () => ({
            from: () => ({
                where: () => ({
                    limit: () => Promise.resolve([]),
                }),
            }),
        }),
    },
}))

describe("getCafeHours", () => {
    it("exports a getCafeHours function", async () => {
        const mod = await import("@/utils/ai/tools/cafe-hours")
        expect(typeof mod.getCafeHours).toBe("function")
    })

    it("returns error for unknown slug", async () => {
        const { getCafeHours } = await import("@/utils/ai/tools/cafe-hours")
        const result = await getCafeHours("nonexistent-cafe-xyz-12345")
        expect(result).toHaveProperty("error")
    })
})
