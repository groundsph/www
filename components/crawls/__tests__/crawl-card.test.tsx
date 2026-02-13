import { describe, it, expect } from "bun:test"
import CrawlCard from "@/components/crawls/CrawlCard"

describe("CrawlCard", () => {
    it("exports a component", () => {
        expect(typeof CrawlCard).toBe("function")
    })

    it("has correct displayName", () => {
        expect(CrawlCard.name).toBe("CrawlCard")
    })

    it("renders with crawl data", () => {
        const mockCrawl = {
            id: "1",
            title: "Test Crawl",
            slug: "test-crawl",
            coverImage: null,
            itemCount: 5,
            viewsCount: 100,
            savesCount: 10,
        }

        const element = CrawlCard({ crawl: mockCrawl })
        expect(element).toBeDefined()
        expect(element.props.href).toBe("/community/crawls/test-crawl")
    })
})
