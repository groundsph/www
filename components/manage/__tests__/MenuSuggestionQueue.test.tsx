import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { render, fireEvent, waitFor, cleanup } from "@testing-library/react"
import { useState } from "react"
import { installMenuSuggestionMocks } from "@/app/api/actions/__tests__/support/menu-suggestion-store"
import type { PendingMenuItemSuggestion } from "@/app/api/actions/menu-suggestions"

/**
 * The Menu suggestion queue as it renders.
 *
 * A scan is one entry, a one-off suggestion is the row it always was, and after
 * either decision the entry leaves the list and the existing empty state takes
 * over — no reload. The approve and reject clicks go through the real server
 * actions against the faked database, so what the reviewer sees and what the
 * Menu contains are asserted together.
 */

const fake = installMenuSuggestionMocks()

const { default: MenuSuggestionQueue } = await import("@/components/manage/MenuSuggestionQueue")

const CAFE = "cafe-1"
const CAFE_NAME = "Kape Lolo"

function queueRow(
    row: ReturnType<typeof fake.seedSuggestion>,
    cafeName: string | null = CAFE_NAME
): PendingMenuItemSuggestion {
    return { ...row, cafeName } as unknown as PendingMenuItemSuggestion
}

function scanned(
    id: string,
    name: string,
    price: number,
    batchId: string | null,
    cafeId: string = CAFE
): PendingMenuItemSuggestion {
    return queueRow(
        fake.seedSuggestion({
            id,
            cafeId,
            batchId,
            suggestedData: { name, category: "Drinks", price },
        })
    )
}

/** Mirrors the manage page: a reviewed entry leaves the list without a reload. */
function QueueHarness({ initial }: { initial: PendingMenuItemSuggestion[] }) {
    const [suggestions, setSuggestions] = useState(initial)

    return (
        <MenuSuggestionQueue
            suggestions={suggestions}
            onProcessed={(processed) =>
                setSuggestions((previous) =>
                    previous.filter((suggestion) => !processed.includes(suggestion.id))
                )
            }
        />
    )
}

const originalConfirm = globalThis.confirm

beforeEach(() => {
    fake.reset()
    fake.control.currentUser = { id: "admin-1", role: "admin" }
    fake.seedCafe({ id: CAFE, name: CAFE_NAME, slug: "kape-lolo" })
    // Rejecting a scan asks for confirmation, as rejecting one suggestion does.
    globalThis.confirm = () => true
})

afterEach(() => {
    cleanup()
    globalThis.confirm = originalConfirm
})

describe("MenuSuggestionQueue", () => {
    it("shows a whole scan as one entry naming the Cafe and its item count", () => {
        const { container } = render(
            <MenuSuggestionQueue
                suggestions={[
                    scanned("s1", "Americano", 120, "batch-1"),
                    scanned("s2", "Kapeng Barako", 95, "batch-1"),
                    scanned("s3", "Calamansi Juice", 80, "batch-1"),
                ]}
                onProcessed={() => {}}
            />
        )

        expect(container.textContent).toContain(CAFE_NAME)
        expect(container.textContent).toContain("3 items")
        expect(container.textContent).toContain("Menu scan")
        // One decision for the scan, not one per item.
        expect(container.querySelectorAll("[aria-label='Approve this scan']")).toHaveLength(1)
        expect(container.querySelectorAll("[title='Approve']")).toHaveLength(0)
        // The three items are not three queue rows.
        expect(container.querySelectorAll("h3")).toHaveLength(1)
    })

    it("expands a scan into the items it carries", () => {
        const { container } = render(
            <MenuSuggestionQueue
                suggestions={[
                    scanned("s1", "Americano", 120, "batch-1"),
                    scanned("s2", "Kapeng Barako", 95, "batch-1"),
                ]}
                onProcessed={() => {}}
            />
        )

        expect(container.textContent).not.toContain("Kapeng Barako")

        fireEvent.click(container.querySelector("h3")!)

        expect(container.textContent).toContain("Americano")
        expect(container.textContent).toContain("Kapeng Barako")
        expect(container.textContent).toContain("₱95.00")
        // Expanding is not a second decision point.
        expect(container.querySelectorAll("[aria-label='Approve this scan']")).toHaveLength(1)
    })

    it("renders a suggestion with no batch exactly as it did before", () => {
        const { container } = render(
            <MenuSuggestionQueue
                suggestions={[scanned("s1", "Espresso", 120, null)]}
                onProcessed={() => {}}
            />
        )

        expect(container.textContent).toContain("Espresso")
        expect(container.textContent).toContain("₱120.00")
        expect(container.textContent).toContain("Add")
        expect(container.textContent).toContain("Drinks")
        expect(container.textContent).toContain("Suggested for cafe ID: cafe-1")
        expect(container.querySelectorAll("[title='Approve']")).toHaveLength(1)
        expect(container.querySelectorAll("[title='Reject']")).toHaveLength(1)
        expect(container.querySelectorAll("[aria-label='Approve this scan']")).toHaveLength(0)
    })

    it("shows scans and one-off suggestions together", () => {
        const { container } = render(
            <MenuSuggestionQueue
                suggestions={[
                    scanned("s1", "Espresso", 120, null),
                    scanned("s2", "Americano", 130, "batch-1"),
                    scanned("s3", "Kapeng Barako", 95, "batch-1"),
                ]}
                onProcessed={() => {}}
            />
        )

        expect(container.querySelectorAll("[title='Approve']")).toHaveLength(1)
        expect(container.querySelectorAll("[aria-label='Approve this scan']")).toHaveLength(1)
        expect(container.textContent).toContain("2 items")
    })

    it("approving a scan writes its items, drops the entry and falls back to the empty state", async () => {
        const { container } = render(
            <QueueHarness
                initial={[
                    scanned("s1", "Americano", 120, "batch-1"),
                    scanned("s2", "Kapeng Barako", 95, "batch-1"),
                ]}
            />
        )

        fireEvent.click(container.querySelector("[aria-label='Approve this scan']")!)

        await waitFor(() => {
            expect(container.textContent).toContain("No pending menu suggestions")
        })

        expect(container.textContent).toContain(
            "Community-submitted menu item suggestions will appear here for review."
        )
        expect(fake.store.menuItems.map((item) => item.name)).toEqual([
            "Americano",
            "Kapeng Barako",
        ])
        expect(fake.store.suggestions.every((row) => row.status === "approved")).toBe(true)
    })

    it("rejecting a scan writes no items, drops the entry and falls back to the empty state", async () => {
        const { container } = render(
            <QueueHarness
                initial={[
                    scanned("s1", "Americano", 120, "batch-1"),
                    scanned("s2", "Kapeng Barako", 95, "batch-1"),
                ]}
            />
        )

        fireEvent.click(container.querySelector("[aria-label='Reject this scan']")!)

        await waitFor(() => {
            expect(container.textContent).toContain("No pending menu suggestions")
        })

        expect(fake.store.menuItems).toEqual([])
        expect(fake.store.suggestions.every((row) => row.status === "rejected")).toBe(true)
    })

    it("keeps the one-off row when a scan is reviewed", async () => {
        const { container } = render(
            <QueueHarness
                initial={[
                    scanned("s1", "Espresso", 120, null),
                    scanned("s2", "Americano", 130, "batch-1"),
                ]}
            />
        )

        fireEvent.click(container.querySelector("[aria-label='Approve this scan']")!)

        await waitFor(() => {
            expect(container.querySelectorAll("[aria-label='Approve this scan']")).toHaveLength(0)
        })

        expect(container.textContent).toContain("Espresso")
        expect(container.querySelectorAll("[title='Approve']")).toHaveLength(1)
        expect(fake.store.suggestions.find((row) => row.id === "s1")?.status).toBe("pending")
    })

    it("shows the existing empty state when there is nothing pending", () => {
        const { container } = render(
            <MenuSuggestionQueue suggestions={[]} onProcessed={() => {}} />
        )

        expect(container.textContent).toContain("No pending menu suggestions")
        expect(container.textContent).toContain(
            "Community-submitted menu item suggestions will appear here for review."
        )
    })
})
