import { describe, it, expect, mock, afterEach } from "bun:test"

mock.module("@/app/api/actions/claim", () => ({
    submitCafeClaim: mock(() => Promise.resolve({ success: true })),
}))

mock.module("@/utils/storage/client", () => ({
    uploadOwnershipProofWithProgress: mock(() =>
        Promise.resolve({ success: true, url: "https://cdn.grounds.ph/proof.pdf" })
    ),
}))

mock.module("@/hooks/useHaptics", () => ({
    useHaptics: () => ({
        trigger: () => undefined,
        cancel: () => undefined,
        isSupported: false,
    }),
}))

import { render, screen, cleanup } from "@testing-library/react"
import ClaimCafeModal from "@/components/modal/ClaimCafeModal"

const renderModal = () =>
    render(
        <ClaimCafeModal
            isOpen
            onClose={() => undefined}
            cafeId="cafe-1"
            cafeName="Test Cafe"
        />
    )

describe("ClaimCafeModal — owner benefits link", () => {
    afterEach(() => {
        cleanup()
    })

    it("keeps the free-to-claim promise", () => {
        renderModal()
        expect(screen.getByText(/completely free to claim/i)).toBeTruthy()
    })

    it("links to the owner benefits page", () => {
        const { container } = renderModal()
        const link = Array.from(container.querySelectorAll("a")).find(
            (anchor) => anchor.getAttribute("href") === "/for-owners"
        )
        expect(link).toBeTruthy()
        expect(link?.textContent?.trim()).toBe("See everything you get")
    })
})
