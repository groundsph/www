import { describe, it, expect, mock, afterEach } from "bun:test"
import { render, cleanup } from "@testing-library/react"
import type { UseMenuItemsReturn } from "@/utils/hooks/useMenuItems"

/**
 * The owner's Menu editor, as an anonymous visitor sees its scan affordance.
 *
 * Spec user story 10 sends a visitor through auth and back to the Cafe they were
 * looking at, so the affordance must carry that Cafe's real path. An empty or
 * missing slug would land them on the Cafe index instead.
 */

mock.module("@/components/layout/AuthProvider", () => ({
    useAuth: () => ({ user: null }),
}))

const { default: MenuSection } = await import("@/components/cafe-editor/MenuSection")

const emptyMenu = {
    items: [],
    openCreateModal: () => {},
    openEditModal: () => {},
    deleteItem: () => {},
    toggleAvailability: () => {},
} as unknown as UseMenuItemsReturn

afterEach(() => {
    cleanup()
})

describe("MenuSection scan affordance", () => {
    it("sends an anonymous visitor back to the Cafe whose Menu is being edited", () => {
        const { container } = render(
            <MenuSection
                menu={emptyMenu}
                cafeId="cafe-1"
                cafeName="Kape Lolo"
                cafeSlug="kape-lolo"
            />
        )

        expect(
            container.querySelector('a[href="/auth?redirect=/cafes/kape-lolo"]')
        ).toBeTruthy()
        // The Cafe index is not the Cafe: an empty slug must not be offered.
        expect(container.querySelector('a[href="/auth?redirect=/cafes/"]')).toBeNull()
    })
})
