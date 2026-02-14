import { describe, it, expect } from "bun:test"
import { buildCrawlMarkerHtml } from "@/utils/map/crawl-marker"
import { CAFE_PLACEHOLDER_URL } from "@/utils/extras"

describe("crawl marker", () => {
    it("falls back to placeholder when image missing", () => {
        const html = buildCrawlMarkerHtml({ imageUrl: null, label: "Cafe" })
        expect(html).toContain(CAFE_PLACEHOLDER_URL)
    })
})
