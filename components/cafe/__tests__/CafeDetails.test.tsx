import { describe, it, expect } from "bun:test"

const source = await Bun.file("components/cafe/CafeDetails.tsx").text()

describe("CafeDetails amenities", () => {
    it("renders the straw amenity, matching the mobile view", () => {
        expect(source).toContain("straw_type")
    })

    it("formats the straw label with the shared formatter", () => {
        expect(source).toContain("formatCafeStrawType")
    })

    it("keeps the amenities that already worked", () => {
        expect(source).toContain("Decaf Options")
        expect(source).toContain("Halal Certified")
        expect(source).toContain("Non-Dairy Milk")
    })
})
