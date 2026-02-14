import { describe, it, expect } from "bun:test"
import { buildCrawlMarkerHtml } from "@/utils/map/crawl-marker"
import { CAFE_PLACEHOLDER_URL } from "@/utils/extras"

describe("crawl marker", () => {
    it("falls back to placeholder when image missing", () => {
        const html = buildCrawlMarkerHtml({ imageUrl: null, label: "Cafe" })
        expect(html).toContain(CAFE_PLACEHOLDER_URL)
    })

    it("uses provided image URL", () => {
        const imageUrl = "https://example.com/cafe.jpg"
        const html = buildCrawlMarkerHtml({ imageUrl, label: "Cafe" })
        expect(html).toContain(imageUrl)
        expect(html).not.toContain(CAFE_PLACEHOLDER_URL)
    })

    it("includes label in aria-label attribute", () => {
        const label = "Test Cafe"
        const html = buildCrawlMarkerHtml({ imageUrl: "https://example.com/img.jpg", label })
        expect(html).toContain(`aria-label="${label}"`)
    })

    it("has correct HTML structure", () => {
        const html = buildCrawlMarkerHtml({ imageUrl: "https://example.com/img.jpg", label: "Cafe" })
        expect(html).toContain('<div class="crawl-marker-pin">')
        expect(html).toContain('<div class="crawl-marker-circle"')
        expect(html).toContain("background-image:url")
    })

    it("escapes XSS in imageUrl", () => {
        const maliciousUrl = "'><script>alert('xss')</script>"
        const html = buildCrawlMarkerHtml({ imageUrl: maliciousUrl, label: "Cafe" })
        expect(html).not.toContain("<script>")
        expect(html).toContain("&#39;")
        expect(html).toContain("&lt;")
        expect(html).toContain("&gt;")
    })

    it("escapes XSS in label", () => {
        const maliciousLabel = '"><script>stealCookies()</script>'
        const html = buildCrawlMarkerHtml({ imageUrl: "https://example.com/img.jpg", label: maliciousLabel })
        expect(html).not.toContain("<script>")
        expect(html).toContain("&quot;")
        expect(html).toContain("&lt;")
        expect(html).toContain("&gt;")
    })

    it("escapes ampersand in label", () => {
        const label = "Cafe & Coffee"
        const html = buildCrawlMarkerHtml({ imageUrl: "https://example.com/img.jpg", label })
        expect(html).toContain("&amp;")
        expect(html).not.toContain(" & Coffee")
    })

    it("renders a number when index is provided", () => {
        const html = buildCrawlMarkerHtml({ imageUrl: "https://example.com/img.jpg", label: "Cafe", index: 3 })
        expect(html).toContain("crawl-marker-number")
        expect(html).toContain(">3<")
    })
})
