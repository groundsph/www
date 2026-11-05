import { describe, it, expect } from "bun:test"

const source = await Bun.file(
    "components/owner/OwnerBenefits.tsx"
).text()

describe("OwnerBenefits decorative icons", () => {
    it("does not fade lucide icons with an alpha colour token", () => {
        expect(source).not.toContain("text-primary/5")
        expect(source).not.toContain("text-accent/5")
    })

    it("fades them with element opacity instead", () => {
        expect(source).toContain("opacity-5")
    })

    it("leaves the semantic chip icons at full opacity", () => {
        expect(source).toContain("bg-primary/10")
    })

    it("leaves the background blur blob on its bg token", () => {
        expect(source).toContain("bg-accent/5")
    })
})

describe("OwnerBenefits layout width", () => {
    it("uses max-w-7xl for every page container", () => {
        const containers = source.match(/max-w-7xl/g) ?? []
        expect(containers.length).toBe(5)
    })

    it("no longer uses max-w-5xl", () => {
        expect(source).not.toContain("max-w-5xl")
    })

    it("keeps the narrow text measures", () => {
        expect(source).toContain("max-w-3xl")
        expect(source).toContain("max-w-2xl")
        expect(source).toContain("max-w-xl")
    })
})
