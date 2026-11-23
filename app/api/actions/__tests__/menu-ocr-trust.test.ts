import { describe, it, expect, beforeEach, mock } from "bun:test"
import type { OcrMenuItem } from "@/utils/ai/menu-ocr"
import { cafeMenuItems, cafes, menuItemSuggestions } from "@/db/schema/tables"

/**
 * Seam S3, the trust half: saving a scan is decided by who is saving.
 *
 * The role matrix is asserted as behaviour — rows written, rows queued, the
 * action's returned result — with the database faked at the module boundary.
 * The caller is always supplied: the point of the test is who may do what.
 */

interface Caller {
    id: string
    role?: string | null
}

let mockCaller: Caller | null = null
/** The owner list stored on the Cafe row — never anything the caller says. */
let mockStoredOwnerIds: string[] = []
let mockCafe: { slug: string | null } | null = { slug: "kape-lolo" }

const insertedMenuItems: Array<Record<string, unknown>> = []
const insertedSuggestions: Array<Record<string, unknown>> = []
const revalidatedPaths: string[] = []

mock.module("@/lib/auth", () => ({
    getCurrentUser: () => Promise.resolve(mockCaller),
}))

mock.module("next/cache", () => ({
    revalidatePath: (path: string) => {
        revalidatedPaths.push(path)
    },
}))

mock.module("@/db", () => ({
    db: {
        query: {
            cafes: {
                findFirst: () => Promise.resolve(mockCafe),
            },
        },
        select: () => ({
            from: (table: unknown) => ({
                where: () => {
                    if (table === cafes) {
                        return {
                            limit: () => Promise.resolve([{ ownerIds: mockStoredOwnerIds }]),
                        }
                    }
                    if (table === cafeMenuItems) {
                        // Read two ways by the save path: the highest sort order
                        // (chained with orderBy/limit) and the prices the price
                        // level is recalculated from (awaited directly).
                        return Object.assign(Promise.resolve([{ price: 120 }]), {
                            orderBy: () => ({
                                limit: () => Promise.resolve([{ sortOrder: 4 }]),
                            }),
                        })
                    }
                    return Promise.resolve([])
                },
            }),
        }),
        insert: (table: unknown) => ({
            values: (rows: Record<string, unknown> | Record<string, unknown>[]) => {
                const list = Array.isArray(rows) ? rows : [rows]
                if (table === menuItemSuggestions) {
                    insertedSuggestions.push(...list)
                } else if (table === cafeMenuItems) {
                    insertedMenuItems.push(...list)
                }
                const inserted = Promise.resolve(undefined) as Promise<undefined> & {
                    returning?: (selection: unknown) => Promise<Array<{ id: string }>>
                }
                // The one-item suggestion path reads the new row's id back.
                inserted.returning = () => Promise.resolve([{ id: "suggestion-1" }])
                return inserted
            },
        }),
        update: () => ({
            set: () => ({ where: () => Promise.resolve(undefined) }),
        }),
    },
}))

const { saveOcrMenuItems } = await import("@/app/api/actions/menu-ocr")
const { submitMenuItemSuggestion } = await import("@/app/api/actions/menu-suggestions")

const scannedItems: OcrMenuItem[] = [
    { name: "Americano", category: "Drinks", price: 120 },
    { name: "Kapeng Barako", category: "Drinks", price: 95 },
]

beforeEach(() => {
    mockCaller = null
    mockStoredOwnerIds = []
    mockCafe = { slug: "kape-lolo" }
    insertedMenuItems.length = 0
    insertedSuggestions.length = 0
    revalidatedPaths.length = 0
})

describe("saveOcrMenuItems — who may write the Menu", () => {
    it("writes Menu items for the Cafe's owner", async () => {
        mockCaller = { id: "user-1", role: "user" }
        mockStoredOwnerIds = ["user-1"]

        const result = await saveOcrMenuItems("cafe-1", scannedItems)

        expect(result.success).toBe(true)
        expect(result.saved).toBe(2)
        expect(result.underReview).toBeUndefined()
        expect(insertedMenuItems).toHaveLength(2)
        expect(insertedMenuItems.map((item) => item.name)).toEqual([
            "Americano",
            "Kapeng Barako",
        ])
        expect(insertedSuggestions).toEqual([])
    })

    it("writes Menu items for an admin", async () => {
        mockCaller = { id: "admin-1", role: "admin" }
        mockStoredOwnerIds = []

        const result = await saveOcrMenuItems("cafe-1", scannedItems)

        expect(result.success).toBe(true)
        expect(result.saved).toBe(2)
        expect(insertedMenuItems).toHaveLength(2)
        expect(insertedSuggestions).toEqual([])
    })

    it("queues a logged-in person who is neither the owner nor an admin", async () => {
        mockCaller = { id: "stranger-1", role: "user" }
        mockStoredOwnerIds = ["user-1"]

        const result = await saveOcrMenuItems("cafe-1", scannedItems)

        expect(result.success).toBe(true)
        expect(result.underReview).toBe(true)
        expect(result.queued).toBe(2)
        expect(result.saved).toBeUndefined()
        expect(insertedMenuItems).toEqual([])
        expect(insertedSuggestions).toHaveLength(2)
        expect(insertedSuggestions.every((s) => s.status === "pending")).toBe(true)
        expect(insertedSuggestions.every((s) => s.type === "add")).toBe(true)
        expect(insertedSuggestions.every((s) => s.userId === "stranger-1")).toBe(true)
    })

    it("queues a moderator: moderation is a different permission from trusted writing", async () => {
        mockCaller = { id: "moderator-1", role: "moderator" }
        mockStoredOwnerIds = ["user-1"]

        const result = await saveOcrMenuItems("cafe-1", scannedItems)

        expect(result.success).toBe(true)
        expect(result.underReview).toBe(true)
        expect(result.queued).toBe(2)
        expect(insertedMenuItems).toEqual([])
        expect(insertedSuggestions).toHaveLength(2)
    })

    it("does not grant trust to a moderator who happens to own nothing here", async () => {
        mockCaller = { id: "moderator-1", role: "moderator" }
        mockStoredOwnerIds = []

        await saveOcrMenuItems("cafe-1", scannedItems)

        expect(insertedMenuItems).toEqual([])
    })

    it("refuses a caller without a session as a returned error", async () => {
        mockCaller = null

        const result = await saveOcrMenuItems("cafe-1", scannedItems)

        expect(result.success).toBe(false)
        expect(result.error).toBe("Authentication required")
        expect(insertedMenuItems).toEqual([])
        expect(insertedSuggestions).toEqual([])
    })

    it("takes ownership from the stored Cafe row, not from the caller", async () => {
        // The caller claims nothing; the stored owner list is the only input to
        // the ownership half of the decision.
        mockCaller = { id: "user-1", role: "user" }
        mockStoredOwnerIds = ["someone-else"]

        const result = await saveOcrMenuItems("cafe-1", scannedItems)

        expect(result.underReview).toBe(true)
        expect(insertedMenuItems).toEqual([])
    })
})

describe("saveOcrMenuItems — a scan is one batch", () => {
    it("gives every suggestion from one scan the same batch id", async () => {
        mockCaller = { id: "stranger-1", role: "user" }
        mockStoredOwnerIds = []

        const result = await saveOcrMenuItems("cafe-1", scannedItems)

        const batchIds = insertedSuggestions.map((s) => s.batchId)
        expect(batchIds).toHaveLength(2)
        expect(batchIds[0]).toEqual(expect.any(String))
        expect(batchIds[0]).toBe(batchIds[1])
        expect(result.batchId).toBe(batchIds[0])
    })

    it("gives separate scans separate batches", async () => {
        mockCaller = { id: "stranger-1", role: "user" }
        mockStoredOwnerIds = []

        const first = await saveOcrMenuItems("cafe-1", scannedItems)
        const second = await saveOcrMenuItems("cafe-1", scannedItems)

        expect(first.batchId).toEqual(expect.any(String))
        expect(second.batchId).toEqual(expect.any(String))
        expect(first.batchId).not.toBe(second.batchId)
        expect(new Set(insertedSuggestions.map((s) => s.batchId)).size).toBe(2)
    })

    it("keeps no batch id for a suggestion made one item at a time", async () => {
        mockCaller = { id: "stranger-1", role: "user" }
        mockStoredOwnerIds = []

        await submitMenuItemSuggestion("cafe-1", "add", {
            name: "Americano",
            category: "Drinks",
            price: 120,
        })

        expect(insertedSuggestions).toHaveLength(1)
        expect(insertedSuggestions[0].batchId ?? null).toBeNull()
    })
})
