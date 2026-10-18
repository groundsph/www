import { describe, it, expect } from "bun:test"
import { render } from "@testing-library/react"
import EditorHeader from "@/components/cafe-editor/EditorHeader"

describe("EditorHeader", () => {
    it("renders the title, status chips and quick actions", () => {
        const { container } = render(
            <EditorHeader
                title='Kapi & Co.'
                subtitle='Submitted 12 Oct 2026'
                chips={[
                    { label: "Pending", tone: "amber" },
                    { label: "Verified", tone: "green" },
                ]}
                actions={<button>Approve</button>}
            />
        )

        expect(container.textContent).toContain("Kapi & Co.")
        expect(container.textContent).toContain("Pending")
        expect(container.textContent).toContain("Verified")
        expect(container.textContent).toContain("Approve")
    })

    it("renders a back link when given a destination", () => {
        const { container } = render(<EditorHeader title='Kapi' backHref='/manage/cafes' backLabel='Cafes' />)
        expect(container.querySelector("a")?.getAttribute("href")).toBe("/manage/cafes")
    })

    it("omits the chip row when there are no chips", () => {
        const { container } = render(<EditorHeader title='Kapi' />)
        expect(container.querySelector("[data-testid='editor-chips']")).toBeNull()
    })
})
