import { describe, it, expect } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

describe("CrawlRouteMap animations", () => {
    it("adds timeline classes to map markers", () => {
        const filePath = join(process.cwd(), "components", "map", "CrawlRouteMapInternal.tsx")
        const source = readFileSync(filePath, "utf-8")
        expect(source).toContain("crawl-marker-active")
    })
})
