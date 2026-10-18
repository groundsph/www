import { describe, it, expect } from "bun:test"
import { validateFile, sniffImageMime, STORAGE_BUCKETS } from "@/utils/storage"

function pngBytes(): Uint8Array {
    return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
}

function jpegBytes(): Uint8Array {
    return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46])
}

describe("sniffImageMime", () => {
    it("detects png and jpeg signatures", () => {
        expect(sniffImageMime(pngBytes())).toBe("image/png")
        expect(sniffImageMime(jpegBytes())).toBe("image/jpeg")
    })

    it("returns null for non-image bytes", () => {
        expect(sniffImageMime(new TextEncoder().encode("<?php echo 1; ?>"))).toBeNull()
    })
})

describe("validateFile content checks", () => {
    it("rejects a text file renamed to .png", async () => {
        const file = new File(["not really a png"], "menu.png", { type: "image/png" })
        const result = await validateFile(file, STORAGE_BUCKETS.CAFES)
        expect(result.valid).toBe(false)
        expect(result.error).toContain("not a recognised image")
    })

    it("accepts a real png for the cafes bucket", async () => {
        const file = new File([pngBytes()], "cafe.png", { type: "image/png" })
        expect((await validateFile(file, STORAGE_BUCKETS.CAFES)).valid).toBe(true)
    })

    it("rejects a jpeg for the png-only badges bucket", async () => {
        const file = new File([jpegBytes()], "stamp.jpg", { type: "image/jpeg" })
        const result = await validateFile(file, STORAGE_BUCKETS.BADGES)
        expect(result.valid).toBe(false)
    })

    it("still rejects an oversize file before reading bytes", async () => {
        const big = new File([new Uint8Array(6 * 1024 * 1024)], "big.png", { type: "image/png" })
        const result = await validateFile(big, STORAGE_BUCKETS.CAFES)
        expect(result.valid).toBe(false)
        expect(result.error).toContain("too large")
    })

    it("does not sniff non-image buckets", async () => {
        const pdf = new File(["%PDF-1.4"], "proof.pdf", { type: "application/pdf" })
        expect((await validateFile(pdf, STORAGE_BUCKETS.OWNERSHIP_PROOFS)).valid).toBe(true)
    })
})
