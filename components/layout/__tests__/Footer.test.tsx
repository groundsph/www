import { describe, it, expect, afterEach } from "bun:test"
import { render, cleanup } from "@testing-library/react"
import Footer from "@/components/layout/Footer"

describe("Footer — cafe owner benefits link", () => {
    afterEach(() => {
        cleanup()
    })

    it("links to the cafe owner benefits page", () => {
        const { container } = render(<Footer />)
        const link = Array.from(container.querySelectorAll("a")).find(
            (anchor) => anchor.getAttribute("href") === "/for-owners"
        )
        expect(link).toBeTruthy()
        expect(link?.textContent?.trim()).toBe("For Cafe Owners")
    })

    it("places the link directly after Submit a Cafe", () => {
        const { container } = render(<Footer />)
        const hrefs = Array.from(container.querySelectorAll("a")).map(
            (anchor) => anchor.getAttribute("href")
        )
        const submitIndex = hrefs.indexOf("/submit")
        const ownersIndex = hrefs.indexOf("/for-owners")
        expect(submitIndex).toBeGreaterThanOrEqual(0)
        expect(ownersIndex).toBe(submitIndex + 1)
    })
})
