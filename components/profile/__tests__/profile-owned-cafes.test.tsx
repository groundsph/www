import { describe, it, expect } from "bun:test"

const source = await Bun.file("components/profile/Profile.tsx").text()

describe("Profile owned-cafes section", () => {
    it("links to the owner benefits page", () => {
        expect(source).toContain("/for-owners")
    })

    it("keeps the dashboard link", () => {
        expect(source).toContain("Go to Owner Dashboard")
    })
})
