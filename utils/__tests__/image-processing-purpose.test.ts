import { describe, it, expect, mock, beforeEach } from "bun:test"

let capturedOptions: Record<string, unknown> | null = null

mock.module("browser-image-compression", () => ({
    default: async (file: File, options: Record<string, unknown>) => {
        capturedOptions = options
        return new Blob([file], { type: String(options.fileType) })
    },
}))

import { compressImageFor, compressBadgeStamp } from "@/utils/image-processing"

beforeEach(() => {
    capturedOptions = null
})

const sourceFile = () => new File(["x"], "photo.png", { type: "image/png" })

describe("compressImageFor", () => {
    it("produces a webp for cafe gallery images", async () => {
        const result = await compressImageFor("cafe-gallery", sourceFile())
        expect(result.type).toBe("image/webp")
        expect(result.name).toBe("photo.webp")
        expect(capturedOptions?.maxSizeMB).toBe(0.2)
    })

    it("produces a webp for cafe covers at a larger budget", async () => {
        const result = await compressImageFor("cafe-cover", sourceFile())
        expect(result.type).toBe("image/webp")
        expect(capturedOptions?.maxSizeMB).toBe(0.3)
    })

    it("keeps png for badge stamps and caps the long edge", async () => {
        const result = await compressBadgeStamp(sourceFile())
        expect(result.type).toBe("image/png")
        expect(capturedOptions?.maxWidthOrHeight).toBe(512)
    })
})
