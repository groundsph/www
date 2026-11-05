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
})
