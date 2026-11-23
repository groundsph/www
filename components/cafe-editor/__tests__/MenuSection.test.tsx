import { describe, it, expect } from "bun:test"

const source = await Bun.file(
    "components/cafe-editor/MenuSection.tsx"
).text()

describe("MenuSection", () => {
    // NOTE: asserted against the full route rather than the bare "/suggestions"
    // substring, because the file legitimately imports
    // "@/components/suggestions/MenuOcrScanButton", which contains it.
    it("no longer links to the non-existent suggestions route", () => {
        expect(source).not.toContain("/cafes/${cafeSlug}/suggestions")
    })

    it("no longer accepts a pendingSuggestionsCount prop", () => {
        expect(source).not.toContain("pendingSuggestionsCount")
    })

    it("still renders the menu filters", () => {
        expect(source).toContain("filterPills")
    })

    // The scan affordance sends an anonymous visitor back to this Cafe, so an
    // optional slug with an empty-string fallback would silently link to the
    // Cafe index instead.
    it("requires the Cafe's slug rather than falling back to an empty one", () => {
        expect(source).not.toContain("cafeSlug?:")
        expect(source).not.toContain('cafeSlug ?? ""')
    })
})
