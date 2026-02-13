import { describe, it, expect } from "bun:test"
import CrawlActions from "@/components/crawls/CrawlActions"

describe("CrawlActions", () => {
    it("exports a component", () => {
        expect(typeof CrawlActions).toBe("function")
    })

    it("has correct displayName", () => {
        expect(CrawlActions.name).toBe("CrawlActions")
    })
})
