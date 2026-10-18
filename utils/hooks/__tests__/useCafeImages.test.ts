import { describe, it, expect } from "bun:test"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useCafeImages } from "@/utils/hooks/useCafeImages"

const thumb = "https://cdn.grounds.ph/cafes/aaa/cover.webp"

// These hooks drive real timers (debounce) and React scheduling. Under a full
// concurrent suite run the default 1s waitFor window is too tight, so give the
// state machine room instead of racing it.
const waitForSettled = (assertion: () => void) => waitFor(assertion, { timeout: 5_000 })

const second = "https://cdn.grounds.ph/cafes/aaa/second.webp"

describe("useCafeImages", () => {
    it("persists a gallery addition after the debounce", async () => {
        const saved: unknown[] = []
        const { result } = renderHook(() => useCafeImages({
            cafeId: "c1",
            initial: { thumbnail: thumb, gallery: [] },
            save: async (patch) => { saved.push(patch); return { success: true } },
            removeFile: async () => ({ success: true }),
            debounceMs: 5,
        }))

        act(() => result.current.appendGallery([second]))
        await waitForSettled(() => expect(saved).toHaveLength(1))
        expect(saved[0]).toEqual({ gallery: [second] })
    })

    it("saves before deleting the storage object when removing an image", async () => {
        const order: string[] = []
        const { result } = renderHook(() => useCafeImages({
            cafeId: "c1",
            initial: { thumbnail: thumb, gallery: [second] },
            save: async () => { order.push("save"); return { success: true } },
            removeFile: async () => { order.push("delete"); return { success: true } },
            debounceMs: 5,
        }))

        await act(async () => { await result.current.removeGalleryAt(0) })
        await waitForSettled(() => expect(order).toContain("delete"))
        expect(order.indexOf("save")).toBeLessThan(order.indexOf("delete"))
        expect(result.current.gallery).toEqual([])
    })

    it("restores the image and deletes nothing when the save fails", async () => {
        const order: string[] = []
        const { result } = renderHook(() => useCafeImages({
            cafeId: "c1",
            initial: { thumbnail: thumb, gallery: [second] },
            save: async () => ({ success: false, error: "Boom" }),
            removeFile: async () => { order.push("delete"); return { success: true } },
            debounceMs: 5,
        }))

        await act(async () => { await result.current.removeGalleryAt(0) })
        await waitForSettled(() => expect(result.current.saveState.error).toBe("Boom"))
        expect(result.current.gallery).toEqual([second])
        expect(order).toEqual([])
    })

    it("clears the cover and persists null", async () => {
        const saved: unknown[] = []
        const { result } = renderHook(() => useCafeImages({
            cafeId: "c1",
            initial: { thumbnail: thumb, gallery: [] },
            save: async (patch) => { saved.push(patch); return { success: true } },
            removeFile: async () => ({ success: true }),
            debounceMs: 5,
        }))

        await act(async () => { await result.current.clearThumbnail() })
        await waitForSettled(() => expect(result.current.thumbnail).toBeNull())
        expect(saved[0]).toEqual({ thumbnail: null })
    })

    it("refuses to exceed the gallery cap", async () => {
        const gallery = Array.from({ length: 12 }, (_, i) => `https://cdn.grounds.ph/cafes/aaa/${i}.webp`)
        const { result } = renderHook(() => useCafeImages({
            cafeId: "c1",
            initial: { thumbnail: thumb, gallery },
            save: async () => ({ success: true }),
            removeFile: async () => ({ success: true }),
            debounceMs: 5,
        }))

        act(() => result.current.appendGallery([second]))
        expect(result.current.gallery).toHaveLength(12)
    })

    it("deletes a replaced cover only after the save succeeds", async () => {
        const order: string[] = []
        const next = "https://cdn.grounds.ph/cafes/aaa/new-cover.webp"
        const { result } = renderHook(() => useCafeImages({
            cafeId: "c1",
            initial: { thumbnail: thumb, gallery: [] },
            save: async () => { order.push("save"); return { success: true } },
            removeFile: async () => { order.push("delete"); return { success: true } },
            debounceMs: 5,
        }))

        act(() => result.current.setCoverImage(next))
        await waitForSettled(() => expect(order).toContain("delete"))
        expect(order.indexOf("save")).toBeLessThan(order.indexOf("delete"))
        expect(result.current.thumbnail).toBe(next)
    })

    it("keeps the replaced cover when the save fails", async () => {
        const order: string[] = []
        const next = "https://cdn.grounds.ph/cafes/aaa/new-cover.webp"
        const { result } = renderHook(() => useCafeImages({
            cafeId: "c1",
            initial: { thumbnail: thumb, gallery: [] },
            save: async () => ({ success: false, error: "Boom" }),
            removeFile: async () => { order.push("delete"); return { success: true } },
            debounceMs: 5,
        }))

        act(() => result.current.setCoverImage(next))
        await waitForSettled(() => expect(result.current.saveState.error).toBe("Boom"))
        expect(order).toEqual([])
    })

    it("persists a reorder through replaceGallery", async () => {
        const saved: unknown[] = []
        const { result } = renderHook(() => useCafeImages({
            cafeId: "c1",
            initial: { thumbnail: thumb, gallery: [thumb, second] },
            save: async (patch) => { saved.push(patch); return { success: true } },
            removeFile: async () => ({ success: true }),
            debounceMs: 5,
        }))

        act(() => result.current.replaceGallery([second, thumb]))
        await waitForSettled(() => expect(saved).toHaveLength(1))
        expect(saved[0]).toEqual({ gallery: [second, thumb] })
    })
})
