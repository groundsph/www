import { describe, it, expect } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

describe("blog status enum", () => {
    it("includes pending status in blogStatusEnum", () => {
        const source = readFileSync(join(process.cwd(), "db", "schema", "enums.ts"), "utf-8")
        // Find the blogStatusEnum definition and check it contains "pending"
        const blogStatusMatch = source.match(/blogStatusEnum\s*=\s*pgEnum\("blog_status",\s*\[([\s\S]+?)\]/)
        expect(blogStatusMatch).toBeTruthy()
        expect(blogStatusMatch![1]).toContain('"pending"')
    })
})
