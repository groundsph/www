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

    for (const file of filesToCheck) {
      const content = readFileSync(file, "utf-8")
      
      // Only check files that use lucide-react
      if (!content.includes('from "lucide-react"')) {
        continue
      }

      // Find all lucide icon elements with className containing incorrect opacity
      // Match patterns for all three quote styles:
      // 1. Single-quoted: <IconName className='...text-color/number...'/>
      // 2. Double-quoted: <IconName className="...text-color/number..."/>
      // 3. Template literals: <IconName className={`...text-color/number...`}/>
      
      const singleQuotePattern = /<([A-Z][a-zA-Z]*)\s+[^>]*className='([^']*text-[a-z]+\/\d+[^']*)'/g
      const doubleQuotePattern = /<([A-Z][a-zA-Z]*)\s+[^>]*className="([^"]*text-[a-z]+\/\d+[^"]*)"/g
      const templateLiteralPattern = /<([A-Z][a-zA-Z]*)\s+[^>]*className={`([^`]*text-[a-z]+\/\d+[^`]*)`}/g

      const patterns = [
        { regex: singleQuotePattern, name: "single-quote" },
        { regex: doubleQuotePattern, name: "double-quote" },
        { regex: templateLiteralPattern, name: "template-literal" },
      ]

      for (const { regex, name } of patterns) {
        let match
        while ((match = regex.exec(content)) !== null) {
          const iconName = match[1]
          // Skip Link components (Next.js)
          if (iconName === "Link") {
            continue
          }
          const iconElement = match[0]
          incorrectPatterns.push(`${file}:${iconName} (${name}): ${iconElement.substring(0, 80)}`)
        }
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
