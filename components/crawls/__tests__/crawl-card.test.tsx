import { describe, it, expect } from "bun:test"
import CrawlCard from "@/components/crawls/CrawlCard"

describe("CrawlCard", () => {
    it("exports a component", () => {
        expect(typeof CrawlCard).toBe("function")
    })

    it("has correct displayName", () => {
        expect(CrawlCard.name).toBe("CrawlCard")
    })
})
