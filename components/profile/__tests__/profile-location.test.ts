import { describe, it, expect } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

describe("Profile location map", () => {
    it("adds a ProfileLocationMap section", () => {
        const filePath = join(process.cwd(), "components", "profile", "Profile.tsx")
        const source = readFileSync(filePath, "utf-8")
        expect(source).toContain("ProfileLocationMap")
    })
})
