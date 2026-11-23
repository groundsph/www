import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"

// The scan affordance reads the session for presentation only.
const session: { user: { id: string } | null } = { user: null }

mock.module("@/components/layout/AuthProvider", () => ({
    useAuth: () => session,
}))

// next/dynamic loads the real scan modal lazily, which never resolves inside a
// jsdom render. Stand in a component that surfaces the props the button passes,
// so the test can tell whether the scan was opened.
mock.module("next/dynamic", () => ({
    default:
        () =>
        function MockScanModal(props: { isOpen: boolean }) {
            return props.isOpen ? <div data-testid='scan-modal' /> : null
        },
}))

const { default: MenuOcrScanButton } = await import(
    "@/components/suggestions/MenuOcrScanButton"
)

const cafe = {
    cafeId: "cafe-1",
    cafeName: "Blue Bottle",
    cafeSlug: "blue-bottle",
}

afterEach(() => {
    cleanup()
})

beforeEach(() => {
    session.user = null
})

describe("MenuOcrScanButton", () => {
    describe("without a session", () => {
        it("still shows the affordance", () => {
            render(<MenuOcrScanButton {...cafe} />)

            expect(screen.getByText("Scan Menu")).toBeDefined()
        })

        it("links to login carrying the current cafe as the return path", () => {
            render(<MenuOcrScanButton {...cafe} />)

            const affordance = screen.getByText("Scan Menu").closest("a")
            expect(affordance).not.toBeNull()
            expect(affordance?.getAttribute("href")).toBe(
                "/auth?redirect=/cafes/blue-bottle"
            )
        })

        it("never opens the scan", () => {
            render(<MenuOcrScanButton {...cafe} />)

            fireEvent.click(screen.getByText("Scan Menu"))

            expect(screen.queryByTestId("scan-modal")).toBeNull()
        })
    })

    describe("with a session", () => {
        beforeEach(() => {
            session.user = { id: "user-1" }
        })

        it("shows the same affordance", () => {
            render(<MenuOcrScanButton {...cafe} />)

            expect(screen.getByText("Scan Menu")).toBeDefined()
        })

        it("opens the scan in place instead of leaving the page", () => {
            render(<MenuOcrScanButton {...cafe} />)

            const affordance = screen.getByText("Scan Menu").closest("a")
            expect(affordance).toBeNull()

            fireEvent.click(screen.getByText("Scan Menu"))

            expect(screen.queryByTestId("scan-modal")).not.toBeNull()
        })

        it("stops opening the scan if the session goes away", () => {
            const { rerender } = render(<MenuOcrScanButton {...cafe} />)
            fireEvent.click(screen.getByText("Scan Menu"))
            expect(screen.queryByTestId("scan-modal")).not.toBeNull()

            session.user = null
            rerender(<MenuOcrScanButton {...cafe} />)

            expect(screen.queryByTestId("scan-modal")).toBeNull()
            expect(screen.getByText("Scan Menu").closest("a")).not.toBeNull()
        })
    })
})
