import { describe, it, expect } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

describe("Crawl edit link", () => {
    it("uses the community edit route", () => {
        const filePath = join(process.cwd(), "components", "crawls", "CrawlView.tsx")
        const source = readFileSync(filePath, "utf-8")
        expect(source).toContain("/community/crawls/")
        expect(source).toContain("/edit")
    })
})
