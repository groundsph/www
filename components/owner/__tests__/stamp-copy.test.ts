import { describe, it, expect } from "bun:test"

const source = await Bun.file(
    "components/owner/CafeManagement.tsx"
).text()

/**
 * Source-scan guard, deliberately not a render test: `CafeManagement.tsx` is
 * ~2,300 lines long and mounting it to assert one sentence is disproportionate.
 * Render-level proof lands in the E2E phase.
 *
 * The scan is scoped to the Badge Stamp paragraph rather than the whole file,
 * because the QR-code section legitimately tells owners the code leads visitors
 * to "your cafe page and check in" -- that copy is correct and must not be
 * flagged (or reworded) by this guard.
 */
const stampHeadingIndex = source.indexOf("Badge Stamp")
const stampParagraphEnd = source.indexOf("</p>", stampHeadingIndex)
const stampCopy = source.slice(stampHeadingIndex, stampParagraphEnd)

describe("badge stamp copy", () => {
    it("does not claim the stamp is displayed on the cafe page", () => {
        // Guard against a vacuous pass if the slice ever stops matching.
        expect(stampCopy).toContain("Upload a custom")
        expect(stampCopy).not.toContain("display on")
        expect(stampCopy).not.toContain("your cafe page")
    })

    it("tells the owner the stamp appears in visitors' Passport", () => {
        expect(stampCopy.toLowerCase()).toContain("passport")
        expect(stampCopy.toLowerCase()).toContain("not shown")
    })
})
