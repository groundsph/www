import { describe, it, expect } from "bun:test"
import { PLACEHOLDER_THUMBNAIL, CAFE_PLACEHOLDER_URL, getCafeThumbnailUrl, toStoredThumbnail } from "@/utils/extras"

describe("thumbnail read boundary", () => {
    it("coalesces a null cover to the placeholder sentinel", () => {
        expect(toStoredThumbnail(null)).toBe(PLACEHOLDER_THUMBNAIL)
        expect(toStoredThumbnail(undefined)).toBe(PLACEHOLDER_THUMBNAIL)
    })

    it("leaves a real cover URL untouched", () => {
        const url = "https://cdn.grounds.ph/cafes/aaa/cover.webp"
        expect(toStoredThumbnail(url)).toBe(url)
    })

    it("resolves the sentinel to the branded placeholder image", () => {
        expect(getCafeThumbnailUrl(PLACEHOLDER_THUMBNAIL)).toBe(CAFE_PLACEHOLDER_URL)
        expect(getCafeThumbnailUrl(toStoredThumbnail(null))).toBe(CAFE_PLACEHOLDER_URL)
    })
})
