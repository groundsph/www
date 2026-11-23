import { describe, it, expect, beforeEach } from "bun:test"
import { installMenuSuggestionMocks } from "./support/menu-suggestion-store"
import type { MenuItemSuggestionData } from "@/app/api/actions/menu-suggestions"

/**
 * Seam S3, the batch half: a Menu scan is reviewed as one decision.
 *
 * Everything here is asserted as behaviour — rows in the store, the action's
 * returned result — with the database faked at the module boundary so that
 * "nothing half-applied" means the rows really are untouched. The caller is
 * always supplied; the point of a review queue is who may decide.
 */

const fake = installMenuSuggestionMocks()

const {
    approveMenuSuggestionBatch,
    rejectMenuSuggestionBatch,
    getPendingMenuItemSuggestions,
} = await import("@/app/api/actions/menu-suggestions")

const BATCH = "batch-1"
const CAFE = "cafe-1"

function scannedItem(name: string, price: number): MenuItemSuggestionData {
    return { name, category: "Drinks", price }
}

function seedScan(
    items: MenuItemSuggestionData[],
    options: { batchId?: string; cafeId?: string } = {}
) {
    const batchId = options.batchId ?? BATCH
    const cafeId = options.cafeId ?? CAFE

    return items.map((item, index) =>
        fake.seedSuggestion({
            id: `${batchId}-row-${index}`,
            cafeId,
            batchId,
            userId: "contributor-1",
            suggestedData: item as unknown as Record<string, unknown>,
        })
    )
}

const scan = [
    scannedItem("Americano", 120),
    scannedItem("Kapeng Barako", 95),
    scannedItem("Calamansi Juice", 80),
]

beforeEach(() => {
    fake.reset()
    fake.control.currentUser = { id: "admin-1", role: "admin" }
    fake.seedCafe({ id: CAFE, name: "Kape Lolo", slug: "kape-lolo" })
})

describe("approveMenuSuggestionBatch", () => {
    it("puts every pending item of the scan on the Menu in one action", async () => {
        fake.seedMenuItem({ id: "existing-1", cafeId: CAFE, name: "House Blend", sortOrder: 4 })
        seedScan(scan)

        const result = await approveMenuSuggestionBatch(BATCH)

        expect(result).toEqual({ success: true, data: { approved: 3, cafeId: CAFE } })
        expect(fake.store.menuItems.map((item) => item.name)).toEqual([
            "House Blend",
            "Americano",
            "Kapeng Barako",
            "Calamansi Juice",
        ])

        const added = fake.store.menuItems.filter((item) => item.communitySubmitted)
        expect(added).toHaveLength(3)
        expect(added.every((item) => item.lastUpdatedBy === "contributor-1")).toBe(true)
        // The scan is appended after what the Menu already had, in scan order.
        expect(added.map((item) => item.sortOrder)).toEqual([5, 6, 7])

        expect(fake.store.suggestions.every((row) => row.status === "approved")).toBe(true)
        expect(fake.store.suggestions.every((row) => row.reviewedBy === "admin-1")).toBe(true)
        expect(fake.store.suggestions.every((row) => row.reviewedAt instanceof Date)).toBe(true)
    })

    it("writes a scan item with the same defaults a one-off suggestion gets", async () => {
        seedScan([{ name: "Tap Water", category: "Drinks", price: 20 }])

        await approveMenuSuggestionBatch(BATCH)

        const [item] = fake.store.menuItems
        expect(item.isFood).toBe(false)
        expect(item.isHot).toBe(false)
        expect(item.isVegan).toBe(false)
        expect(item.calories).toBeNull()
        expect(item.sizeOptions).toBeNull()
        expect(item.communitySubmitted).toBe(true)
        expect(item.lastUpdatedBy).toBe("contributor-1")
    })

    it("refuses a second approval and adds no duplicate items", async () => {
        seedScan(scan)

        const first = await approveMenuSuggestionBatch(BATCH)
        const second = await approveMenuSuggestionBatch(BATCH)

        expect(first.success).toBe(true)
        expect(second).toEqual({ success: false, error: "Nothing left to approve" })
        expect(fake.store.menuItems).toHaveLength(3)
    })

    it("applies only the rows that are still pending rather than erroring", async () => {
        const [alreadyDone] = seedScan(scan)
        alreadyDone.status = "approved"
        alreadyDone.reviewedAt = new Date("2026-11-02T00:00:00Z")

        const result = await approveMenuSuggestionBatch(BATCH)

        expect(result).toEqual({ success: true, data: { approved: 2, cafeId: CAFE } })
        expect(fake.store.menuItems.map((item) => item.name)).toEqual([
            "Kapeng Barako",
            "Calamansi Juice",
        ])
        expect(alreadyDone.status).toBe("approved")
    })

    it("leaves the whole scan unapplied when the write fails partway", async () => {
        seedScan(scan)
        // The items are written first; the status update then fails, which is the
        // half-applied state the transaction exists to prevent.
        fake.control.failNextSuggestionUpdate = true

        const result = await approveMenuSuggestionBatch(BATCH)

        expect(result).toEqual({ success: false, error: "Failed to approve menu scan batch" })
        expect(fake.store.menuItems).toEqual([])
        expect(fake.store.suggestions.every((row) => row.status === "pending")).toBe(true)
        expect(fake.control.revalidatedPaths).toEqual([])
    })

    it("leaves nothing behind when the Menu insert itself fails", async () => {
        seedScan(scan)
        fake.control.failNextMenuInsert = true

        const result = await approveMenuSuggestionBatch(BATCH)

        expect(result).toEqual({ success: false, error: "Failed to approve menu scan batch" })
        expect(fake.store.menuItems).toEqual([])
        expect(fake.store.suggestions.every((row) => row.status === "pending")).toBe(true)
    })

    it("recalculates the price level and revalidates only after the batch commits", async () => {
        seedScan([
            scannedItem("A", 500),
            scannedItem("B", 500),
            scannedItem("C", 500),
            scannedItem("D", 500),
            scannedItem("E", 500),
        ])

        const result = await approveMenuSuggestionBatch(BATCH)

        expect(result.success).toBe(true)
        // Kape Lolo was seeded as a budget Cafe; five 500 items make it luxury.
        expect(fake.store.cafes[0].priceLevel).toBe("luxury")
        expect(fake.control.revalidatedPaths).toEqual([
            "/cafes/kape-lolo",
            "/cafes/kape-lolo/menu",
            "/cafes",
        ])
        // At revalidation time the transaction had already committed: the items
        // exist and the rows are approved, so neither call ran inside it.
        expect(fake.control.revalidationSnapshots[0]).toEqual({
            menuItems: 5,
            approved: 5,
            pending: 0,
        })
    })

    it("reports nothing to approve when the batch has no rows at all", async () => {
        const result = await approveMenuSuggestionBatch("unknown-batch")

        expect(result).toEqual({ success: false, error: "Nothing left to approve" })
        expect(fake.store.menuItems).toEqual([])
    })

    it("decides only the batch it was given", async () => {
        seedScan(scan)
        seedScan([scannedItem("Iced Tea", 70)], { batchId: "batch-2" })
        fake.seedSuggestion({
            id: "one-off",
            cafeId: CAFE,
            suggestedData: scannedItem("Brewed Coffee", 60) as unknown as Record<string, unknown>,
        })

        await approveMenuSuggestionBatch(BATCH)

        expect(fake.store.menuItems.map((item) => item.name)).toEqual([
            "Americano",
            "Kapeng Barako",
            "Calamansi Juice",
        ])
        expect(fake.store.suggestions.find((row) => row.batchId === "batch-2")?.status).toBe(
            "pending"
        )
        // A suggestion made one item at a time is nobody's batch.
        expect(fake.store.suggestions.find((row) => row.id === "one-off")?.status).toBe(
            "pending"
        )
    })

    it("refuses a caller without a session", async () => {
        seedScan(scan)
        fake.control.currentUser = null

        const result = await approveMenuSuggestionBatch(BATCH)

        expect(result).toEqual({ success: false, error: "Unauthorized" })
        expect(fake.store.menuItems).toEqual([])
        expect(fake.store.suggestions.every((row) => row.status === "pending")).toBe(true)
    })

    it("refuses an authenticated caller who is not an admin or moderator", async () => {
        seedScan(scan)
        fake.control.currentUser = { id: "user-1", role: "user" }

        const result = await approveMenuSuggestionBatch(BATCH)

        expect(result).toEqual({ success: false, error: "Unauthorized" })
        expect(fake.store.menuItems).toEqual([])
        expect(fake.store.suggestions.every((row) => row.status === "pending")).toBe(true)
    })

    it("allows a moderator to approve a batch", async () => {
        seedScan(scan)
        fake.control.currentUser = { id: "moderator-1", role: "moderator" }

        const result = await approveMenuSuggestionBatch(BATCH)

        expect(result).toEqual({ success: true, data: { approved: 3, cafeId: CAFE } })
        expect(fake.store.suggestions.every((row) => row.reviewedBy === "moderator-1")).toBe(true)
    })
})

describe("rejectMenuSuggestionBatch", () => {
    it("marks the batch's pending rows rejected and adds no Menu items", async () => {
        seedScan(scan)

        const result = await rejectMenuSuggestionBatch(BATCH, "Prices are unreadable")

        expect(result).toEqual({ success: true, data: { rejected: 3 } })
        expect(fake.store.menuItems).toEqual([])
        expect(fake.store.suggestions.every((row) => row.status === "rejected")).toBe(true)
        expect(fake.store.suggestions.every((row) => row.adminNotes === "Prices are unreadable")).toBe(
            true
        )
        expect(fake.store.suggestions.every((row) => row.reviewedBy === "admin-1")).toBe(true)
        // Nothing public changed, so nothing is revalidated.
        expect(fake.control.revalidatedPaths).toEqual([])
    })

    it("refuses a second rejection instead of re-processing the batch", async () => {
        seedScan(scan)

        await rejectMenuSuggestionBatch(BATCH)
        const second = await rejectMenuSuggestionBatch(BATCH)

        expect(second).toEqual({ success: false, error: "Nothing left to reject" })
        expect(fake.store.suggestions.every((row) => row.status === "rejected")).toBe(true)
    })

    it("leaves the rows of another batch pending", async () => {
        seedScan(scan)
        seedScan([scannedItem("Iced Tea", 70)], { batchId: "batch-2" })

        await rejectMenuSuggestionBatch(BATCH)

        const otherBatch = fake.store.suggestions.filter((row) => row.batchId === "batch-2")
        expect(otherBatch).toHaveLength(1)
        expect(otherBatch[0].status).toBe("pending")
    })

    it("refuses an authenticated caller who is not an admin or moderator", async () => {
        seedScan(scan)
        fake.control.currentUser = { id: "user-1", role: "user" }

        const result = await rejectMenuSuggestionBatch(BATCH)

        expect(result).toEqual({ success: false, error: "Unauthorized" })
        expect(fake.store.suggestions.every((row) => row.status === "pending")).toBe(true)
    })

    it("refuses a caller without a session", async () => {
        seedScan(scan)
        fake.control.currentUser = null

        const result = await rejectMenuSuggestionBatch(BATCH)

        expect(result).toEqual({ success: false, error: "Unauthorized" })
        expect(fake.store.suggestions.every((row) => row.status === "pending")).toBe(true)
    })

    it("allows a moderator to reject a batch", async () => {
        seedScan(scan)
        fake.control.currentUser = { id: "moderator-1", role: "moderator" }

        const result = await rejectMenuSuggestionBatch(BATCH)

        expect(result).toEqual({ success: true, data: { rejected: 3 } })
        expect(fake.store.suggestions.every((row) => row.reviewedBy === "moderator-1")).toBe(true)
    })
})

describe("getPendingMenuItemSuggestions", () => {
    it("names the Cafe a pending suggestion is for and keeps its batch id", async () => {
        seedScan(scan)

        const pending = await getPendingMenuItemSuggestions()

        expect(pending).toHaveLength(3)
        expect(pending.every((row) => row.cafeName === "Kape Lolo")).toBe(true)
        expect(pending.every((row) => row.batchId === BATCH)).toBe(true)
    })

    it("reports no batch for a suggestion made one item at a time", async () => {
        fake.seedSuggestion({
            id: "one-off",
            cafeId: CAFE,
            suggestedData: scannedItem("Brewed Coffee", 60) as unknown as Record<string, unknown>,
        })

        const pending = await getPendingMenuItemSuggestions()

        expect(pending).toHaveLength(1)
        expect(pending[0].batchId).toBeNull()
        expect(pending[0].cafeName).toBe("Kape Lolo")
    })

    it("returns nothing to a caller who may not review", async () => {
        seedScan(scan)
        fake.control.currentUser = { id: "user-1", role: "user" }

        expect(await getPendingMenuItemSuggestions()).toEqual([])
    })
})
