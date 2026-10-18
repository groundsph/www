import { describe, it, expect } from "bun:test"
import { render, fireEvent, waitFor, renderHook, act } from "@testing-library/react"
import ConfirmDialog from "@/components/ui/ConfirmDialog"
import { useConfirm } from "@/hooks/useConfirm"

describe("ConfirmDialog", () => {
    it("renders an accessible modal with title and description", () => {
        const { container } = render(
            <ConfirmDialog
                open
                title='Remove this image?'
                description='The file will be deleted from storage.'
                onConfirm={() => {}}
                onCancel={() => {}}
            />
        )

        const dialog = container.querySelector("[role='dialog']")
        expect(dialog?.getAttribute("aria-modal")).toBe("true")
        expect(container.textContent).toContain("Remove this image?")
        expect(container.textContent).toContain("deleted from storage")
    })

    it("cancels on Escape", () => {
        let cancelled = false
        const { container } = render(
            <ConfirmDialog open title='Delete cafe?' onConfirm={() => {}} onCancel={() => { cancelled = true }} />
        )

        fireEvent.keyDown(container.querySelector("[role='dialog']")!, { key: "Escape" })
        expect(cancelled).toBe(true)
    })

    it("renders nothing when closed", () => {
        const { container } = render(
            <ConfirmDialog open={false} title='Hidden' onConfirm={() => {}} onCancel={() => {}} />
        )
        expect(container.querySelector("[role='dialog']")).toBeNull()
    })

    it("uses destructive styling when destructive", () => {
        const { container } = render(
            <ConfirmDialog open destructive title='Delete cafe?' confirmLabel='Delete' onConfirm={() => {}} onCancel={() => {}} />
        )
        const confirmButton = [...container.querySelectorAll("button")].find((b) => b.textContent === "Delete")
        expect(confirmButton?.className).toContain("red")
    })
})

describe("useConfirm", () => {
    it("resolves true when confirmed and clears the dialog", async () => {
        const { result } = renderHook(() => useConfirm())

        let answer: boolean | null = null
        act(() => {
            void result.current.confirm({ title: "Remove image?" }).then((value) => { answer = value })
        })

        await waitFor(() => expect(result.current.dialog).toBeTruthy())

        act(() => { result.current.dialogResolve(true) })
        await waitFor(() => expect(answer).toBe(true))
        expect(result.current.dialog).toBeNull()
    })

    it("resolves false when cancelled", async () => {
        const { result } = renderHook(() => useConfirm())

        let answer: boolean | null = null
        act(() => {
            void result.current.confirm({ title: "Remove image?" }).then((value) => { answer = value })
        })
        await waitFor(() => expect(result.current.dialog).toBeTruthy())

        act(() => { result.current.dialogResolve(false) })
        await waitFor(() => expect(answer).toBe(false))
    })
})
