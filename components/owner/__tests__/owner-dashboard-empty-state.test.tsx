import { describe, it, expect } from "bun:test"

const source = await Bun.file(
    "components/owner/OwnerDashboard.tsx"
).text()

describe("OwnerDashboard empty state", () => {
    it("links to the owner benefits page", () => {
        expect(source).toContain("/for-owners")
    })

    it("keeps the existing submit and browse actions", () => {
        expect(source).toContain("Submit New Cafe")
        expect(source).toContain("Browse Cafes to Claim")
    })
})
