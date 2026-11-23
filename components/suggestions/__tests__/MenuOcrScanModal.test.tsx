import { describe, it, expect, mock, beforeEach } from "bun:test"
import { fireEvent, render, waitFor } from "@testing-library/react"

/**
 * Seam S1: the scan affordance, rendered.
 *
 * The modal reaches straight for the compressor, the OCR stream client and the
 * server actions at import time, so each is faked at its module boundary. What
 * is asserted is what a visitor gets: two named ways to pick a photo, a readable
 * refusal before any work happens, and a second selection of the same photo
 * starting a second scan.
 */

const MB = 1024 * 1024

interface CompressionOptions {
    maxSizeMB?: number
    maxWidthOrHeight?: number
}

const compressionSpy = mock(
    async (file: File, options?: CompressionOptions) => {
        void options
        return file
    }
)
const streamScanSpy = mock(
    async (
        _cafeId: string | undefined,
        _base64: string,
        _mimeType: string | undefined,
        callbacks: { onError: (message: string) => void }
    ) => {
        callbacks.onError("The AI service is unavailable")
    }
)
const saveItemsSpy = mock(async () => ({ success: true, saved: 0 }))

mock.module("browser-image-compression", () => ({ default: compressionSpy }))
mock.module("@/app/api/actions/menu-ocr", () => ({
    saveOcrMenuItems: saveItemsSpy,
    deduplicateMenuItems: mock(),
}))
mock.module("@/utils/ocr-stream-client", () => ({
    OCR_PHASE_CONFIG: {
        uploading: { timeoutMs: 15_000, label: "Uploading image...", color: "#3b82f6" },
        "ai-processing": { timeoutMs: 30_000, label: "AI analyzing menu...", color: "#06b6d4" },
        streaming: { timeoutMs: 120_000, label: "Extracting items...", color: "#10b981" },
        "processing-results": { timeoutMs: 10_000, label: "Processing results...", color: "#22c55e" },
    },
    streamOcrScan: streamScanSpy,
    describeEmptyOcrResult: () => null,
}))

import MenuOcrScanModal from "@/components/suggestions/MenuOcrScanModal"

// jsdom implements neither object URLs nor a real image pipeline; the preview
// only needs somewhere to point.
globalThis.URL.createObjectURL = (() => "blob:menu-preview") as typeof URL.createObjectURL
globalThis.URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL

/**
 * jsdom's object URLs are opaque. Stand-ins are numbered so a test can tell one
 * scan's preview from the next, and every release is recorded.
 */
function spyOnObjectUrls() {
    const created: string[] = []
    const revoked: string[] = []
    let next = 0

    globalThis.URL.createObjectURL = (() => {
        next += 1
        const url = `blob:menu-preview-${next}`
        created.push(url)
        return url
    }) as typeof URL.createObjectURL

    globalThis.URL.revokeObjectURL = ((url: string) => {
        revoked.push(url)
    }) as typeof URL.revokeObjectURL

    return { created, revoked }
}
// test-setup.ts copies only a handful of jsdom globals; the modal reads the
// chosen file with a FileReader, which jsdom does implement on its window.
globalThis.FileReader = window.FileReader

function renderModal() {
    return render(
        <MenuOcrScanModal
            isOpen
            onClose={mock()}
            cafeId='cafe1'
            cafeName='Moni Cafe'
            cafeSlug='moni-cafe'
        />
    )
}

function photoFile(name = "menu.jpg", type = "image/jpeg"): File {
    // Built from jsdom's own File so jsdom's FileReader accepts it.
    return new window.File(["menu photo"], name, { type })
}

function withSize(file: File, size: number): File {
    Object.defineProperty(file, "size", { value: size })
    return file
}

/** jsdom cannot populate `input.files`, so set it the way React reads it. */
function choose(input: HTMLInputElement, file: File) {
    Object.defineProperty(input, "files", {
        value: [file],
        configurable: true,
    })
    fireEvent.change(input)
}

/**
 * jsdom never assigns `input.value` for a real selection, so record the writes
 * the component makes. Writing `""` is what lets a browser fire `change` again
 * for the same file.
 */
function recordValueWrites(input: HTMLInputElement): string[] {
    const writes: string[] = []
    const native = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
    )
    Object.defineProperty(input, "value", {
        configurable: true,
        get() {
            return native?.get?.call(input) ?? ""
        },
        set(value: string) {
            writes.push(value)
            native?.set?.call(input, value)
        },
    })
    return writes
}

beforeEach(() => {
    compressionSpy.mockClear()
    streamScanSpy.mockClear()
    saveItemsSpy.mockClear()
    saveItemsSpy.mockImplementation(async () => ({ success: true, saved: 0 }))
    globalThis.URL.createObjectURL = (() => "blob:menu-preview") as typeof URL.createObjectURL
    globalThis.URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL
    compressionSpy.mockImplementation(async (file: File) => file)
    streamScanSpy.mockImplementation(
        async (
            _cafeId: string | undefined,
            _base64: string,
            _mimeType: string | undefined,
            callbacks: { onError: (message: string) => void }
        ) => {
            callbacks.onError("The AI service is unavailable")
        }
    )
})

describe("MenuOcrScanModal — choosing a photo", () => {
    it("offers a camera target and a device target, both accepting the tile's formats", () => {
        const { getByLabelText, container } = renderModal()

        const camera = getByLabelText("Take photo") as HTMLInputElement
        const device = getByLabelText("Upload from device") as HTMLInputElement

        expect(camera.getAttribute("capture")).toBe("environment")
        expect(device.hasAttribute("capture")).toBe(false)
        expect(camera.type).toBe("file")
        expect(device.type).toBe("file")
        expect(camera.accept).toBe("image/jpeg,image/png,image/webp")
        expect(device.accept).toBe("image/jpeg,image/png,image/webp")

        // The tile's promise, as the visitor reads it.
        expect(container.textContent).toContain("JPEG, PNG, WebP up to 10 MB")
    })

    it("runs the same scan whichever target was used", async () => {
        const { getByLabelText } = renderModal()

        choose(getByLabelText("Take photo") as HTMLInputElement, photoFile("camera.jpg"))
        await waitFor(() => expect(streamScanSpy).toHaveBeenCalledTimes(1))

        choose(
            getByLabelText("Upload from device") as HTMLInputElement,
            photoFile("gallery.jpg")
        )
        await waitFor(() => expect(streamScanSpy).toHaveBeenCalledTimes(2))
    })

    it("refuses a format the tile does not list, before compressing", async () => {
        const { getByLabelText, findByText } = renderModal()

        choose(
            getByLabelText("Upload from device") as HTMLInputElement,
            photoFile("menu.gif", "image/gif")
        )

        expect(await findByText(/JPEG, PNG, or WebP/)).toBeTruthy()
        expect(compressionSpy).not.toHaveBeenCalled()
        expect(streamScanSpy).not.toHaveBeenCalled()
        // Still on the upload step: both targets are there to try again.
        expect(getByLabelText("Take photo")).toBeTruthy()
        expect(getByLabelText("Upload from device")).toBeTruthy()
    })

    it("refuses a photo that is not a photo at all", async () => {
        const { getByLabelText, findByText } = renderModal()

        choose(
            getByLabelText("Upload from device") as HTMLInputElement,
            photoFile("menu.pdf", "application/pdf")
        )

        expect(await findByText(/JPEG, PNG, or WebP/)).toBeTruthy()
        expect(compressionSpy).not.toHaveBeenCalled()
    })

    it("refuses a photo over the stated size, before compressing", async () => {
        const { getByLabelText, findByText } = renderModal()

        choose(
            getByLabelText("Upload from device") as HTMLInputElement,
            withSize(photoFile("huge.jpg"), 10 * MB + 1)
        )

        expect(await findByText(/larger than 10 MB/)).toBeTruthy()
        expect(compressionSpy).not.toHaveBeenCalled()
        expect(streamScanSpy).not.toHaveBeenCalled()
        expect(getByLabelText("Upload from device")).toBeTruthy()
    })

    it("scans a photo within the stated limits", async () => {
        const { getByLabelText } = renderModal()

        const accepted = withSize(photoFile("menu.jpg"), 10 * MB)
        choose(getByLabelText("Upload from device") as HTMLInputElement, accepted)

        await waitFor(() => expect(compressionSpy).toHaveBeenCalledTimes(1))
        expect(compressionSpy.mock.calls[0][0]).toBe(accepted)
        await waitFor(() => expect(streamScanSpy).toHaveBeenCalledTimes(1))
    })

    it("compresses to the budget that keeps a dense Menu readable", async () => {
        const { getByLabelText } = renderModal()

        choose(
            getByLabelText("Upload from device") as HTMLInputElement,
            photoFile("dense-drinks-menu.jpg")
        )

        await waitFor(() => expect(compressionSpy).toHaveBeenCalledTimes(1))
        const options = compressionSpy.mock.calls[0][1]

        // Written out here rather than imported from the component: reading the
        // constant back and comparing it to itself would pass whatever number
        // reached the compressor.
        expect(options?.maxWidthOrHeight).toBe(1600)
        expect(options?.maxSizeMB).toBe(1.5)
    })

    it("clears the input and starts a second scan for the same photo", async () => {
        const { getByLabelText, findByText } = renderModal()

        const first = getByLabelText("Upload from device") as HTMLInputElement
        const valueWrites = recordValueWrites(first)
        const photo = photoFile("retry.jpg")

        choose(first, photo)
        await findByText(/AI service is unavailable/)

        // A browser only fires `change` for a repeat choice once the value is cleared.
        expect(valueWrites).toContain("")
        expect(streamScanSpy).toHaveBeenCalledTimes(1)

        const second = getByLabelText("Upload from device") as HTMLInputElement
        expect(second.value).toBe("")
        choose(second, photo)

        await waitFor(() => expect(streamScanSpy).toHaveBeenCalledTimes(2))
    })
})

/**
 * The success step has two shapes: a trusted save reports what it added and
 * offers the way to the Menu, while a queued scan must say it is under review
 * in wording nobody can read as a saved confirmation.
 */
const scannedItems = [
    { name: "Americano", category: "Drinks", price: 120 },
    { name: "Kapeng Barako", category: "Drinks", price: 95 },
]

function scanFindsTwoItems() {
    streamScanSpy.mockImplementation(
        async (
            _cafeId: string | undefined,
            _base64: string,
            _mimeType: string | undefined,
            callbacks: { onComplete: (data: unknown) => void }
        ) => {
            callbacks.onComplete({
                items: scannedItems,
                deduplicated: scannedItems,
                duplicates: [],
            })
        }
    )
}

async function saveScannedItems(saveResult: Record<string, unknown>) {
    saveItemsSpy.mockImplementation(async () => saveResult)
    const rendered = renderModal()

    choose(
        rendered.getByLabelText("Upload from device") as HTMLInputElement,
        photoFile("menu.jpg")
    )

    const saveButton = await rendered.findByRole("button", { name: /^Save/ })
    fireEvent.click(saveButton)

    return rendered
}

describe("MenuOcrScanModal — what the success step says", () => {
    it("reports the item count and offers the Cafe's Menu after a direct save", async () => {
        scanFindsTwoItems()
        const { container, getByText } = await saveScannedItems({
            success: true,
            saved: 2,
        })

        await waitFor(() => expect(getByText("Done")).toBeTruthy())

        expect(container.textContent).toContain("2 items added!")
        expect(container.textContent).toContain("Moni Cafe menu has been updated")
        expect(container.textContent).not.toContain("under review")
        expect(
            container.querySelector('a[href="/cafes/moni-cafe/menu"]')
        ).toBeTruthy()
    })

    it("tells a queued contributor the scan is under review, not saved", async () => {
        scanFindsTwoItems()
        const { container, getByText } = await saveScannedItems({
            success: true,
            underReview: true,
            queued: 2,
            batchId: "batch-1",
        })

        await waitFor(() => expect(getByText("Done")).toBeTruthy())

        expect(container.textContent).toContain("under review")
        expect(container.textContent).toContain("2 items from this scan are under review")
        expect(container.textContent).not.toContain("added!")
        expect(container.textContent).not.toContain("menu has been updated")
        // Nothing is on the Menu yet, so there is nothing to go and look at.
        expect(
            container.querySelector('a[href="/cafes/moni-cafe/menu"]')
        ).toBeNull()
    })
})

describe("MenuOcrScanModal — the preview blob", () => {
    /** A scan that never settles holds its preview on screen for as long as the modal lives. */
    function holdScanOpen() {
        streamScanSpy.mockImplementation(() => new Promise<void>(() => {}))
    }

    it("releases the previous preview when a scan is retried", async () => {
        const urls = spyOnObjectUrls()
        const { getByLabelText } = renderModal()

        choose(
            getByLabelText("Upload from device") as HTMLInputElement,
            photoFile("first.jpg")
        )
        await waitFor(() => expect(streamScanSpy).toHaveBeenCalledTimes(1))
        const first = urls.created[0]

        choose(getByLabelText("Take photo") as HTMLInputElement, photoFile("second.jpg"))
        await waitFor(() => expect(streamScanSpy).toHaveBeenCalledTimes(2))

        expect(urls.created.length).toBe(2)
        expect(urls.revoked.filter((url) => url === first)).toEqual([first])
    })

    it("releases the live preview when the modal closes", async () => {
        const urls = spyOnObjectUrls()
        holdScanOpen()
        const { getByLabelText, rerender } = renderModal()

        choose(getByLabelText("Upload from device") as HTMLInputElement, photoFile("live.jpg"))
        await waitFor(() => expect(streamScanSpy).toHaveBeenCalledTimes(1))
        expect(urls.created.length).toBe(1)

        rerender(<MenuOcrScanModal isOpen={false} onClose={mock()} cafeId='cafe1' />)

        await waitFor(() => expect(urls.revoked).toEqual([urls.created[0]]))
    })

    it("releases the live preview when the component unmounts", async () => {
        const urls = spyOnObjectUrls()
        holdScanOpen()
        const { getByLabelText, unmount } = renderModal()

        choose(getByLabelText("Upload from device") as HTMLInputElement, photoFile("live.jpg"))
        await waitFor(() => expect(streamScanSpy).toHaveBeenCalledTimes(1))

        unmount()

        expect(urls.revoked).toEqual(urls.created)
    })

    it("leaves no preview retained after several scans in one session", async () => {
        const urls = spyOnObjectUrls()
        const { getByLabelText, unmount } = renderModal()

        for (let scan = 1; scan <= 3; scan++) {
            choose(
                getByLabelText("Upload from device") as HTMLInputElement,
                photoFile(`scan-${scan}.jpg`)
            )
            await waitFor(() => expect(streamScanSpy).toHaveBeenCalledTimes(scan))
        }

        unmount()

        expect(urls.created.length).toBe(3)
        expect(urls.revoked.slice().sort()).toEqual(urls.created.slice().sort())
        // Each blob is released once: never leaked, never revoked twice.
        expect(new Set(urls.revoked).size).toBe(urls.revoked.length)
    })
})
