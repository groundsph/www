import { describe, it, expect } from "bun:test"

const managementSource = await Bun.file(
    "components/owner/CafeManagement.tsx"
).text()
const editSource = await Bun.file("components/owner/CafeEdit.tsx").text()

describe("cafe lifecycle disclosure", () => {
    it("removes the dead Remove My Ownership button", () => {
        expect(managementSource).not.toContain("Remove My Ownership")
    })

    it("removes the Danger Zone card entirely", () => {
        expect(managementSource).not.toContain("Danger Zone")
    })

    it("states in the management view that only staff can unpublish or remove", () => {
        expect(managementSource).toContain("Only GroundsPH staff can")
    })

    it("states the same thing next to the publication status chip", () => {
        expect(editSource).toContain("Only GroundsPH staff can")
    })

    it("keeps the publication status chip working", () => {
        expect(editSource).toContain("Published")
        expect(editSource).toContain("Pending review")
    })
})
