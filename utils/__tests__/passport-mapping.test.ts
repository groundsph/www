import { describe, it, expect } from "bun:test"
import { mapPassportCafe } from "@/utils/passport/map"

describe("passport mapping", () => {
    it("includes badge_stamp_url", () => {
        const result = mapPassportCafe({
            cafeName: "Test",
            cafeSlug: "test",
            cafeThumbnail: null,
            badgeStampUrl: "https://cdn.../stamp.png",
            firstVisit: "2026-02-13T00:00:00.000Z",
        })
        expect(result.badge_stamp_url).toBe("https://cdn.../stamp.png")
    })
})
