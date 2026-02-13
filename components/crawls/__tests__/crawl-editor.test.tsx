import { describe, it, expect } from "bun:test"
import { existsSync } from "fs"
import { join } from "path"

describe("CrawlEditor", () => {
    it("CrawlEditor component file exists", () => {
        const filePath = join(process.cwd(), "components", "crawls", "CrawlEditor.tsx")
        expect(existsSync(filePath)).toBe(true)
    })

    it("Create page file exists", () => {
        const filePath = join(process.cwd(), "app", "community", "crawls", "create", "page.tsx")
        expect(existsSync(filePath)).toBe(true)
    })

    it("Edit page file exists", () => {
        const filePath = join(process.cwd(), "app", "community", "crawls", "[slug]", "edit", "page.tsx")
        expect(existsSync(filePath)).toBe(true)
    })
})
