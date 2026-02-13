import { describe, it, expect } from "bun:test"
import { existsSync } from "fs"
import { join } from "path"

describe("CrawlView", () => {
    it("CrawlView component file exists", () => {
        const filePath = join(process.cwd(), "components", "crawls", "CrawlView.tsx")
        expect(existsSync(filePath)).toBe(true)
    })

    it("CrawlRouteMap component file exists", () => {
        const filePath = join(process.cwd(), "components", "map", "CrawlRouteMap.tsx")
        expect(existsSync(filePath)).toBe(true)
    })

    it("Crawl page file exists", () => {
        const filePath = join(process.cwd(), "app", "community", "crawls", "[slug]", "page.tsx")
        expect(existsSync(filePath)).toBe(true)
    })
})
