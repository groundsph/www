import { describe, it, expect } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

describe("blog posts schema", () => {
  it("includes gallery, tagged cafes, and crawl link columns", () => {
    const source = readFileSync(join(process.cwd(), "db", "schema", "tables.ts"), "utf-8")
    expect(source).toContain('images: text("images").array()')
    expect(source).toContain('taggedCafeIds: uuid("tagged_cafe_ids").array()')
    expect(source).toContain("crawlId: uuid(\"crawl_id\")")
  })
})
