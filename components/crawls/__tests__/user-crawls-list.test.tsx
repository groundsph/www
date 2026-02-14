import { describe, it, expect } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

describe("Profile crawls section", () => {
    it("shows a Crawls section with My and Saved tabs", () => {
        const filePath = join(process.cwd(), "components", "profile", "Profile.tsx")
        const source = readFileSync(filePath, "utf-8")
        expect(source).toContain("Crawls")
        expect(source).toContain("My Crawls")
        expect(source).toContain("Saved Crawls")
    })
})
