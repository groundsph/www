import { describe, it, expect } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

describe("profiles schema", () => {
    it("includes moderator regions column", () => {
        const source = readFileSync(join(process.cwd(), "db", "schema", "tables.ts"), "utf-8")
        expect(source).toContain('moderatorRegions: text("moderator_regions").array()')
    })
})
