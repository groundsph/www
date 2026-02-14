import { describe, it, expect } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

describe("CrawlRouteMap bounds", () => {
    it("includes fitBounds logic", () => {
        const filePath = join(process.cwd(), "components", "map", "CrawlRouteMapInternal.tsx")
        const source = readFileSync(filePath, "utf-8")
        expect(source).toContain("fitBounds")
    })
})
