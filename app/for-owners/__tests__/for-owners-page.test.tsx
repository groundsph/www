import { describe, it, expect, afterEach } from "bun:test"
import { render, screen, cleanup } from "@testing-library/react"
import { FAQ_ITEMS } from "@/components/owner/owner-benefits-content"
import ForOwnersPage, { metadata } from "@/app/for-owners/page"

describe("For owners page", () => {
    afterEach(() => {
        cleanup()
    })

    it("renders the owner benefits content", () => {
        render(<ForOwnersPage />)
        expect(
            screen.getByText(/Free to claim\. Free to manage\./)
        ).toBeTruthy()
    })

    it("titles itself for cafe owners without hardcoding the brand", () => {
        expect(metadata.title).toBe("Cafe Owner Benefits")
        expect(metadata.alternates?.canonical).toBe("/for-owners")
        expect(String(metadata.description).length).toBeGreaterThan(80)
    })

    it("emits two JSON-LD blocks", () => {
        const { container } = render(<ForOwnersPage />)
        const scripts = container.querySelectorAll(
            'script[type="application/ld+json"]'
        )
        expect(scripts.length).toBe(2)
    })

    it("emits a FAQPage block that matches the FAQ exactly", () => {
        const { container } = render(<ForOwnersPage />)
        const scripts = Array.from(
            container.querySelectorAll('script[type="application/ld+json"]')
        )
        const payloads = scripts.map((script) =>
            JSON.parse(script.innerHTML) as Record<string, unknown>
        )
        const faq = payloads.find(
            (payload) => payload["@type"] === "FAQPage"
        ) as { mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }> }

        expect(faq).toBeDefined()
        expect(faq.mainEntity.length).toBe(FAQ_ITEMS.length)
        expect(faq.mainEntity[0].name).toBe(FAQ_ITEMS[0].question)
        expect(faq.mainEntity[0].acceptedAnswer.text).toBe(
            FAQ_ITEMS[0].answer
        )
        expect(faq.mainEntity[FAQ_ITEMS.length - 1].name).toBe(
            FAQ_ITEMS[FAQ_ITEMS.length - 1].question
        )
    })

    it("emits a BreadcrumbList for Home then For Cafe Owners", () => {
        const { container } = render(<ForOwnersPage />)
        const scripts = Array.from(
            container.querySelectorAll('script[type="application/ld+json"]')
        )
        const payloads = scripts.map((script) =>
            JSON.parse(script.innerHTML) as Record<string, unknown>
        )
        const crumbs = payloads.find(
            (payload) => payload["@type"] === "BreadcrumbList"
        ) as { itemListElement: Array<{ name: string; item: string }> }

        expect(crumbs).toBeDefined()
        expect(crumbs.itemListElement.length).toBe(2)
        expect(crumbs.itemListElement[1].name).toBe("For Cafe Owners")
        expect(crumbs.itemListElement[1].item.endsWith("/for-owners")).toBe(
            true
        )
    })
})
