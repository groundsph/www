import { describe, it, expect } from "bun:test"
import { existsSync, readFileSync } from "fs"
import { join } from "path"

describe("Profile Collections Merge", () => {
    const filePath = join(process.cwd(), "components", "profile", "Profile.tsx")

    it("Profile.tsx file exists", () => {
        expect(existsSync(filePath)).toBe(true)
    })

    it("has activeCollectionsTab state", () => {
        const content = readFileSync(filePath, "utf-8")
        expect(content).toInclude("activeCollectionsTab")
        expect(content).toInclude('useState<"mine" | "saved">')
    })

    it("has a single Collections section with tabs", () => {
        const content = readFileSync(filePath, "utf-8")

        // Check for the single "Collections" header (h2 element with text "Collections")
        // Match h2 tags that contain "Collections" as the only text
        const collectionsH2Pattern = /<h2[^>]*>\s*Collections\s*<\/h2>/g
        const collectionsH2Matches = content.match(collectionsH2Pattern)
        expect(collectionsH2Matches?.length).toBe(1)

        // Check that "Saved Collections" is NOT a separate section header
        // (it should only appear as a tab label now)
        const savedCollectionsH2Pattern = /<h2[^>]*>\s*Saved Collections\s*<\/h2>/g
        const savedCollectionsAsHeader = content.match(savedCollectionsH2Pattern)
        expect(savedCollectionsAsHeader).toBeNull()

        // Check that "My Collections" is NOT a separate section header either
        const myCollectionsH2Pattern = /<h2[^>]*>\s*My Collections\s*<\/h2>/g
        const myCollectionsAsHeader = content.match(myCollectionsH2Pattern)
        expect(myCollectionsAsHeader).toBeNull()

        // Check for tab buttons
        expect(content).toInclude('setActiveCollectionsTab("mine")')
        expect(content).toInclude('setActiveCollectionsTab("saved")')

        // Check for tab button labels (text content inside button elements)
        expect(content).toInclude("Personal")
        expect(content).toInclude("Saved")
    })



    it("maintains links to collection pages", () => {
        const content = readFileSync(filePath, "utf-8")
        expect(content).toInclude("/profile/collections")
        expect(content).toInclude("/profile/collections/saved")
    })
})
