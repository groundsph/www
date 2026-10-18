import { describe, it, expect } from "bun:test"
import { render, fireEvent } from "@testing-library/react"
import EditorShell from "@/components/cafe-editor/EditorShell"

const tabs = [{ id: "basic", label: "Basic" }, { id: "images", label: "Images" }]

const shell = (props: Partial<React.ComponentProps<typeof EditorShell>> = {}) => (
    <EditorShell
        header={<h1>Kapi &amp; Co.</h1>}
        tabs={tabs}
        activeSection='basic'
        onSectionChange={() => {}}
        saveState={{ dirty: false, saving: false, lastSavedAt: null, error: null }}
        onSave={() => {}}
        onDiscard={() => {}}
        ariaLabel='Cafe sections'
        {...props}
    >
        <p>section body</p>
    </EditorShell>
)

describe("EditorShell", () => {
    it("renders the header, the tab strip and the active section", () => {
        const { container } = render(shell())

        expect(container.textContent).toContain("Kapi")
        expect(container.querySelector("[role='tablist']")).toBeTruthy()
        expect(container.textContent).toContain("section body")
    })

    it("shows unsaved state and enables Save while dirty", () => {
        const { container } = render(shell({
            saveState: { dirty: true, saving: false, lastSavedAt: null, error: null },
        }))

        expect(container.textContent).toContain("Unsaved changes")
        const save = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("Save changes"))
        expect((save as HTMLButtonElement).disabled).toBe(false)
    })

    it("disables Save when there is nothing to save", () => {
        const { container } = render(shell())
        const save = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("Save changes"))
        expect((save as HTMLButtonElement).disabled).toBe(true)
    })

    it("surfaces a save error", () => {
        const { container } = render(shell({
            saveState: { dirty: true, saving: false, lastSavedAt: null, error: "Failed to save images" },
        }))

        expect(container.textContent).toContain("Failed to save images")
    })

    it("calls onSectionChange when a tab is clicked", () => {
        const changes: string[] = []
        const { container } = render(shell({ onSectionChange: (id) => changes.push(id) }))

        fireEvent.click(container.querySelectorAll("[role='tab']")[1])
        expect(changes).toEqual(["images"])
    })

    it("calls onSave and onDiscard", () => {
        const calls: string[] = []
        const { container } = render(shell({
            saveState: { dirty: true, saving: false, lastSavedAt: null, error: null },
            onSave: () => { calls.push("save") },
            onDiscard: () => { calls.push("discard") },
        }))

        const buttons = [...container.querySelectorAll("button")]
        fireEvent.click(buttons.find((b) => b.textContent === "Discard")!)
        fireEvent.click(buttons.find((b) => b.textContent?.includes("Save changes"))!)

        expect(calls).toEqual(["discard", "save"])
    })
})
