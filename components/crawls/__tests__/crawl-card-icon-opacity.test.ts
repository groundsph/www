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
    const incorrectPatterns: string[] = []
    const opacityRegex = /text-[a-z]+\/\d+/g

    for (const file of filesToCheck) {
      const content = readFileSync(file, "utf-8")
      
      // Only check files that use lucide-react
      if (!content.includes('from "lucide-react"')) {
        continue
      }

      // Find all lucide icon elements with className containing incorrect opacity
      // Match: <IconName className='...text-color/number...'
      // Exclude Link components
      const iconPattern = /<([A-Z][a-zA-Z]*)\s+[^>]*className='([^']*text-[a-z]+\/\d+[^']*)'/g
      let match
      while ((match = iconPattern.exec(content)) !== null) {
        const iconName = match[1]
        // Skip Link components (Next.js)
        if (iconName === "Link") {
          continue
        }
        const iconElement = match[0]
        incorrectPatterns.push(`${file}:${iconName}: ${iconElement.substring(0, 80)}`)
      }
    }

    // Report all incorrect patterns found
    if (incorrectPatterns.length > 0) {
      console.error("\nFound incorrect opacity syntax on lucide icons:")
      incorrectPatterns.forEach((pattern) => {
        console.error(`  - ${pattern}`)
      })
    }

    expect(incorrectPatterns.length).toBe(0)
  })
})
