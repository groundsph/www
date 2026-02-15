import { describe, it, expect } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

describe("BlogEditor", () => {
    it("includes gallery, tagged cafes, and crawl link sections", () => {
        const source = readFileSync(join(process.cwd(), "components", "blog", "BlogEditor.tsx"), "utf-8")
        expect(source).toContain("Gallery Images")
        expect(source).toContain("Tagged Cafes")
        expect(source).toContain("Linked Crawl")
    })
})
