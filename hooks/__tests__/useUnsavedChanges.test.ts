import { describe, it, expect, mock, afterEach } from "bun:test"
import { renderHook } from "@testing-library/react"
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges"

const originalAdd = window.addEventListener
const originalRemove = window.removeEventListener

afterEach(() => {
    window.addEventListener = originalAdd
    window.removeEventListener = originalRemove
})

describe("useUnsavedChanges", () => {
    it("registers a beforeunload listener while dirty", () => {
        const addSpy = mock(() => {})
        window.addEventListener = addSpy as unknown as typeof window.addEventListener

        renderHook(({ dirty }) => useUnsavedChanges(dirty), { initialProps: { dirty: true } })

        expect(addSpy).toHaveBeenCalledTimes(1)
        expect(addSpy.mock.calls[0][0]).toBe("beforeunload")
    })

    it("removes the listener on unmount", () => {
        const removeSpy = mock(() => {})
        window.removeEventListener = removeSpy as unknown as typeof window.removeEventListener

        const { unmount } = renderHook(({ dirty }) => useUnsavedChanges(dirty), {
            initialProps: { dirty: true },
        })
        unmount()

        expect(removeSpy.mock.calls[0][0]).toBe("beforeunload")
    })

    it("registers nothing while clean", () => {
        const addSpy = mock(() => {})
        window.addEventListener = addSpy as unknown as typeof window.addEventListener

        renderHook(({ dirty }) => useUnsavedChanges(dirty), { initialProps: { dirty: false } })

        expect(addSpy).not.toHaveBeenCalled()
    })
})
