import { describe, it, expect, beforeEach, mock } from "bun:test"
import type { OcrMenuItem } from "@/utils/ai/menu-ocr"

// The database is faked at the module boundary and every expected path is
// written literally, so this test fails if the save path goes back to a
// `/cafe/<id>` shape or stops refreshing the Cafe's real pages.

let mockCafeLookupResult: { slug: string | null } | null = { slug: "kape-lolo" }
let mockSelectResults: unknown[][] = []
const mockRevalidatedPaths: string[] = []
const mockInsertedItems: unknown[][] = []

mock.module("@/lib/auth", () => ({
    getCurrentUser: () => Promise.resolve({ id: "user-1", role: "owner" }),
}))

mock.module("next/cache", () => ({
    revalidatePath: (path: string) => {
        mockRevalidatedPaths.push(path)
    },
}))

function whereResult(rows: unknown[]) {
    // `where(...)` is read three ways by the save path: awaited directly (the
    // price level lookup), chained with `.orderBy(...).limit(...)` (the
    // sort-order lookup), and chained with `.limit(...)` (the owner lookup).
    return Object.assign(Promise.resolve(rows), {
        orderBy: () => ({ limit: () => Promise.resolve(rows) }),
        limit: () => Promise.resolve(rows),
    })
}

mock.module("@/db", () => ({
    db: {
        select: () => ({
            from: () => ({
                where: () => whereResult(mockSelectResults.shift() ?? []),
            }),
        }),
        insert: () => ({
            values: (items: unknown[]) => {
                mockInsertedItems.push(items)
                return Promise.resolve(undefined)
            },
        }),
        update: () => ({
            set: () => ({ where: () => Promise.resolve(undefined) }),
        }),
        query: {
            cafes: {
                findFirst: () => Promise.resolve(mockCafeLookupResult),
            },
        },
    },
}))

const { saveOcrMenuItems } = await import("@/app/api/actions/menu-ocr")

const scannedItems: OcrMenuItem[] = [
    { name: "Americano", category: "Drinks", price: 120 },
]

describe("saveOcrMenuItems revalidation", () => {
    beforeEach(() => {
        mockCafeLookupResult = { slug: "kape-lolo" }
        // The save path asks whether the caller is staff before it writes
        // anything, then whether they own the Cafe, then reads the highest sort
        // order, then the prices for the price level.
        mockSelectResults = [
            [{ role: "user" }],
            [{ ownerIds: ["user-1"] }],
            [{ sortOrder: 4 }],
            [{ price: 120 }],
        ]
        mockRevalidatedPaths.length = 0
        mockInsertedItems.length = 0
    })

    it("revalidates the cafe page and the cafe menu page after saving a scan", async () => {
        const result = await saveOcrMenuItems("cafe-1", scannedItems)

        expect(result.success).toBe(true)
        expect(result.saved).toBe(1)
        expect(mockInsertedItems).toHaveLength(1)
        expect(mockRevalidatedPaths).toEqual([
            "/cafes/kape-lolo",
            "/cafes/kape-lolo/menu",
        ])
    })

    it("never revalidates a /cafe/<id> shaped path", async () => {
        await saveOcrMenuItems("cafe-1", scannedItems)

        expect(mockRevalidatedPaths.filter((path) => path.startsWith("/cafe/"))).toEqual([])
    })

    it("refuses a scan for a cafe that no longer resolves, writing nothing", async () => {
        mockCafeLookupResult = null

        const result = await saveOcrMenuItems("cafe-1", scannedItems)

        // Ownership cannot be established for a Cafe that is not there, so the
        // write fails closed rather than falling back to anyone with a session.
        expect(result.success).toBe(false)
        expect(mockInsertedItems).toEqual([])
        expect(mockRevalidatedPaths).toEqual([])
    })
})
