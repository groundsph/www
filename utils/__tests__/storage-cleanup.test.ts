import { describe, it, expect } from "bun:test"
import { collectCafeStampUrls, collectCrawlCoverUrls, collectBlogImageUrls } from "@/utils/storage/cleanup"

describe("storage cleanup", () => {
    it("includes cafe badge stamp urls", () => {
        const urls = collectCafeStampUrls([{ badgeStampUrl: "https://x" }])
        expect(urls.has("https://x")).toBe(true)
    })

    it("includes crawl cover urls", () => {
        const urls = collectCrawlCoverUrls([{ coverImage: "https://crawl" }])
        expect(urls.has("https://crawl")).toBe(true)
    })
})

describe("collectBlogImageUrls", () => {
    it("includes cover and gallery images", () => {
        const urls = collectBlogImageUrls([
            { coverImage: "https://cover", images: ["https://a", "https://b"] },
        ])
        expect(urls.has("https://cover")).toBe(true)
        expect(urls.has("https://a")).toBe(true)
        expect(urls.has("https://b")).toBe(true)
    })
})
