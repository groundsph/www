import { describe, it, expect } from "bun:test"
import { collectCafeStampUrls, collectCrawlCoverUrls } from "@/utils/storage/cleanup"

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
