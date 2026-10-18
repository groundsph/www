import { describe, it, expect } from "bun:test"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useImageUploadQueue } from "@/utils/hooks/useImageUploadQueue"

const file = (name: string) => new File(["bytes"], name, { type: "image/png" })

// These hooks drive real timers (debounce) and React scheduling. Under a full
// concurrent suite run the default 1s waitFor window is too tight, so give the
// state machine room instead of racing it.
const waitForSettled = (assertion: () => void) => waitFor(assertion, { timeout: 5_000 })


describe("useImageUploadQueue", () => {
    it("uploads queued files and reports each result", async () => {
        const uploaded: string[] = []
        const { result } = renderHook(() => useImageUploadQueue({
            purpose: "cafe-gallery",
            compress: async (_purpose, f) => f,
            upload: async (f) => {
                uploaded.push(f.name)
                return { success: true, url: `https://cdn.grounds.ph/cafes/x/${f.name}` }
            },
        }))

        act(() => result.current.enqueue([file("a.png"), file("b.png")]))

        await waitForSettled(() => expect(result.current.items.every(i => i.status === "done")).toBe(true))
        expect(uploaded.sort()).toEqual(["a.png", "b.png"])
        expect(result.current.items[0].url).toContain("a.png")
    })

    it("keeps a failed file retryable and then succeeds", async () => {
        let attempt = 0
        const { result } = renderHook(() => useImageUploadQueue({
            purpose: "cafe-gallery",
            compress: async (_purpose, f) => f,
            upload: async (f) => {
                attempt += 1
                if (attempt === 1) return { success: false, error: "Network error" }
                return { success: true, url: `https://cdn.grounds.ph/cafes/x/${f.name}` }
            },
        }))

        act(() => result.current.enqueue([file("a.png")]))
        await waitForSettled(() => expect(result.current.items[0].status).toBe("error"))
        expect(result.current.items[0].error).toBe("Network error")

        act(() => result.current.retry(result.current.items[0].id))
        await waitForSettled(() => expect(result.current.items[0].status).toBe("done"))
    })

    it("rejects an unsupported type before uploading", async () => {
        let uploadCalls = 0
        const { result } = renderHook(() => useImageUploadQueue({
            purpose: "cafe-gallery",
            compress: async (_purpose, f) => f,
            upload: async (f) => {
                uploadCalls += 1
                return { success: true, url: f.name }
            },
        }))

        act(() => result.current.enqueue([new File(["x"], "notes.txt", { type: "text/plain" })]))

        await waitForSettled(() => expect(result.current.items).toHaveLength(0))
        expect(uploadCalls).toBe(0)
    })

    it("dismisses an item and keeps the rest", async () => {
        const { result } = renderHook(() => useImageUploadQueue({
            purpose: "cafe-gallery",
            compress: async (_purpose, f) => f,
            upload: async (f) => ({ success: true, url: f.name }),
        }))

        act(() => result.current.enqueue([file("a.png"), file("b.png")]))
        await waitForSettled(() => expect(result.current.items).toHaveLength(2))

        act(() => result.current.dismiss(result.current.items[0].id))
        expect(result.current.items).toHaveLength(1)
    })

    it("enforces the gallery cap", async () => {
        const { result } = renderHook(() => useImageUploadQueue({
            purpose: "cafe-gallery",
            maxFiles: 1,
            compress: async (_purpose, f) => f,
            upload: async (f) => ({ success: true, url: f.name }),
        }))

        act(() => result.current.enqueue([file("a.png"), file("b.png")]))
        await waitForSettled(() => expect(result.current.items).toHaveLength(1))
    })

    it("reports each completed upload to onComplete", async () => {
        const completed: string[] = []
        const { result } = renderHook(() => useImageUploadQueue({
            purpose: "cafe-gallery",
            compress: async (_purpose, f) => f,
            upload: async (f) => ({ success: true, url: `https://cdn.grounds.ph/cafes/x/${f.name}` }),
            onComplete: ({ url }) => completed.push(url),
        }))

        act(() => result.current.enqueue([file("a.png"), file("b.png")]))
        await waitForSettled(() => expect(completed).toHaveLength(2))
        expect(completed[0]).toContain("https://cdn.grounds.ph/cafes/x/")
    })
})
