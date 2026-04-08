import { describe, it, expect } from "bun:test"
import { readdirSync, readFileSync } from "fs"
import { join } from "path"

describe("icon opacity styling", () => {
  it("avoids incorrect opacity syntax on lucide icons in all components", () => {
    const componentsDir = join(process.cwd(), "components")
    const filesToCheck: string[] = []

    // Recursively find all TSX/TS files in components directory
    function findFiles(dir: string) {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          findFiles(fullPath)
        } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
          filesToCheck.push(fullPath)
        }
      }
    }
    findFiles(componentsDir)

    // Check each file for incorrect opacity patterns on lucide icons
    // The text-color/opacity syntax (e.g., text-text/40) is valid Tailwind CSS v4
    // This test now just verifies the syntax is consistent
    const incorrectPatterns: string[] = []

    for (const file of filesToCheck) {
      const content = readFileSync(file, "utf-8")

      // Only check files that use lucide-react
      if (!content.includes('from "lucide-react"')) {
        continue
      }

      // Check for actual invalid patterns (e.g., missing number after slash)
      // Invalid: text-text/ (no number), text-text/abc (non-numeric), text-text/-5 (negative)
      const invalidOpacityPattern = /className=['"`{][^'"`}]*text-[a-z]+\/[^0-9][^'"`}]*['"`}]/g

      let match
      while ((match = invalidOpacityPattern.exec(content)) !== null) {
        // Only report truly invalid patterns
        const classValue = match[0]
        // Skip valid patterns like text-text/40, text-primary/50, etc.
        if (/text-[a-z]+\/\d+/.test(classValue)) {
          continue
        }
        incorrectPatterns.push(`${file}: ${classValue.substring(0, 80)}`)
      }
    }

    // Report all incorrect patterns found
    if (incorrectPatterns.length > 0) {
      console.error("\nFound invalid opacity syntax on lucide icons:")
      incorrectPatterns.forEach((pattern) => {
        console.error(`  - ${pattern}`)
      })
    }

    expect(incorrectPatterns.length).toBe(0)
  })
})
