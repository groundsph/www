import { describe, it, expect } from "bun:test"

describe("Image Processing", () => {
    describe("compression function exports", () => {
        it("should export all compression functions", async () => {
            const mod = await import("@/utils/image-processing")
            expect(typeof mod.compressCoverImage).toBe("function")
            expect(typeof mod.compressGalleryImage).toBe("function")
            expect(typeof mod.compressReviewImage).toBe("function")
            expect(typeof mod.compressBlogCover).toBe("function")
            expect(typeof mod.compressEventCover).toBe("function")
            expect(typeof mod.compressCollectionCover).toBe("function")
            expect(typeof mod.compressAvatar).toBe("function")
        })

        it("should have compressEventCover as alias of compressBlogCover", async () => {
            const mod = await import("@/utils/image-processing")
            expect(mod.compressEventCover).toBe(mod.compressBlogCover)
        })
    })
})
