import { describe, it, expect } from "bun:test"
import { parseCafeImagesPatch, MAX_CAFE_GALLERY } from "@/utils/validation/cafe-images"

const cafeUrl = (name: string) =>
    `https://cdn.grounds.ph/cafes/b6e75615-7db4-4ad0-b949-37b09502d846/${name}`

describe("parseCafeImagesPatch", () => {
    it("accepts a gallery of cafe image URLs", () => {
        const result = parseCafeImagesPatch({ gallery: [cafeUrl("a.webp"), cafeUrl("b.jpg")] })
        expect(result.ok).toBe(true)
    })

    it("accepts an explicitly cleared cover", () => {
        const result = parseCafeImagesPatch({ thumbnail: null })
        expect(result.ok).toBe(true)
    })

    it("accepts a legacy uploader-scoped path", () => {
        // Uploads used <userId>/<file> inside the cafes bucket before cafe-scoping
        const result = parseCafeImagesPatch({
            thumbnail: "https://cdn.grounds.ph/cafes/2b919190-537d-4576-8b6f-3464d54bde33/1700000000000-abc123.webp",
        })
        expect(result.ok).toBe(true)
    })

    it("rejects a URL outside the cafes bucket", () => {
        const result = parseCafeImagesPatch({ thumbnail: "https://cdn.grounds.ph/avatars/user.png" })
        expect(result.ok).toBe(false)
    })

    it("rejects a non-image extension", () => {
        const result = parseCafeImagesPatch({ gallery: [cafeUrl("payload.svg")] })
        expect(result.ok).toBe(false)
    })

    it("rejects more than the gallery cap", () => {
        const gallery = Array.from({ length: MAX_CAFE_GALLERY + 1 }, (_, i) => cafeUrl(`${i}.webp`))
        const result = parseCafeImagesPatch({ gallery })
        expect(result.ok).toBe(false)
    })

    it("rejects an empty patch", () => {
        expect(parseCafeImagesPatch({}).ok).toBe(false)
    })

    it("rejects unknown keys", () => {
        expect(parseCafeImagesPatch({ is_verified: true }).ok).toBe(false)
    })
})
