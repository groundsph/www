import { describe, it, expect } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

describe("CommunityPage Crawls CTA", () => {
    it("contains Create Crawl button in the crawls section", () => {
        const filePath = join(process.cwd(), "components", "community", "CommunityPage.tsx")
        const content = readFileSync(filePath, "utf-8")

        // Should have a link to create crawl
        expect(content).toInclude("/community/crawls/create")
        expect(content).toInclude("Create Crawl")
    })
})
