import { describe, it, expect } from "bun:test"
import { groupMenuSuggestionQueue } from "@/utils/menu/suggestion-batches"

/**
 * The queue's grouping, asserted as the entries a reviewer would see: a scan
 * collapses into one entry headed by its Cafe and item count, a one-off
 * suggestion stays an entry of its own in its original position.
 */

interface Row {
    id: string
    cafeId: string
    batchId: string | null
    cafeName?: string | null
    name: string
}

function row(id: string, batchId: string | null, name: string, cafeId = "cafe-1"): Row {
    return { id, cafeId, batchId, cafeName: "Kape Lolo", name }
}

describe("groupMenuSuggestionQueue", () => {
    it("leaves suggestions with no batch as individual entries, in order", () => {
        const first = row("s1", null, "Espresso")
        const second = row("s2", null, "Cortado")

        const entries = groupMenuSuggestionQueue([first, second])

        expect(entries).toEqual([
            { kind: "single", suggestion: first },
            { kind: "single", suggestion: second },
        ])
        // Untouched: the queue's existing single-item rows render the same object.
        expect(entries[0].kind === "single" && entries[0].suggestion).toBe(first)
    })

    it("presents everything sharing a batch id as one entry naming the Cafe and its count", () => {
        const entries = groupMenuSuggestionQueue([
            row("s1", "batch-1", "Americano"),
            row("s2", "batch-1", "Kapeng Barako"),
            row("s3", "batch-1", "Calamansi Juice"),
        ])

        expect(entries).toHaveLength(1)
        const [entry] = entries
        expect(entry.kind).toBe("batch")
        if (entry.kind !== "batch") throw new Error("expected a batch entry")

        expect(entry.batch.batchId).toBe("batch-1")
        expect(entry.batch.cafeName).toBe("Kape Lolo")
        expect(entry.batch.cafeId).toBe("cafe-1")
        expect(entry.batch.itemCount).toBe(3)
        expect(entry.batch.items.map((item) => item.id)).toEqual(["s1", "s2", "s3"])
    })

    it("keeps a batch where its first row sat among the one-off suggestions", () => {
        const entries = groupMenuSuggestionQueue([
            row("s1", null, "Espresso"),
            row("s2", "batch-1", "Americano"),
            row("s3", null, "Cortado"),
            row("s4", "batch-1", "Kapeng Barako"),
        ])

        expect(entries.map((entry) => entry.kind)).toEqual(["single", "batch", "single"])
        const batch = entries[1]
        if (batch.kind !== "batch") throw new Error("expected a batch entry")
        expect(batch.batch.itemCount).toBe(2)
    })

    it("groups separate scans separately", () => {
        const entries = groupMenuSuggestionQueue([
            row("s1", "batch-1", "Americano"),
            row("s2", "batch-2", "Iced Tea"),
            row("s3", "batch-1", "Kapeng Barako"),
        ])

        expect(entries).toHaveLength(2)
        expect(entries.map((entry) => (entry.kind === "batch" ? entry.batch.itemCount : 0))).toEqual(
            [2, 1]
        )
    })

    it("keeps a one-item scan as a batch so it is still decided as a scan", () => {
        const entries = groupMenuSuggestionQueue([row("s1", "batch-1", "Americano")])

        expect(entries).toHaveLength(1)
        expect(entries[0].kind).toBe("batch")
    })

    it("falls back to no Cafe name when the query could not resolve one", () => {
        const entries = groupMenuSuggestionQueue([
            { id: "s1", cafeId: "cafe-9", batchId: "batch-1", name: "Americano" },
        ])

        const [entry] = entries
        if (entry.kind !== "batch") throw new Error("expected a batch entry")
        expect(entry.batch.cafeName).toBeNull()
    })

    it("has no entries when nothing is pending", () => {
        expect(groupMenuSuggestionQueue([])).toEqual([])
    })
})
