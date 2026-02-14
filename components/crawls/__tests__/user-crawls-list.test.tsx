import { describe, it, expect } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

describe("Profile crawls section", () => {
    it("shows a Crawls section with Personal and Saved tabs", () => {
        const filePath = join(process.cwd(), "components", "profile", "Profile.tsx")
        const source = readFileSync(filePath, "utf-8")
        expect(source).toContain("Crawls")
        expect(source).toContain("Personal")
        expect(source).toContain("Saved")
    })
})
