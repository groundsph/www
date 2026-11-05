import { describe, it, expect } from "bun:test"

const source = await Bun.file(
    "components/submit/SubmitPage.tsx"
).text()

describe("SubmitPage", () => {
    it("offers a path for owners whose cafe is already listed", () => {
        expect(source).toContain("/for-owners")
    })

    it("keeps the submission form", () => {
        expect(source).toContain("CafeSubmissionForm")
    })
})
