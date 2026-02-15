import { describe, it, expect } from "bun:test"
import { extractCafeSlugsFromContent } from "@/utils/blog/link-detection"

describe("extractCafeSlugsFromContent", () => {
  it("extracts grounds.ph cafe slugs from absolute and relative links", () => {
    const content = `Visit https://grounds.ph/cafes/dennys and /cafes/sunny-roast?ref=blog`;
    const slugs = extractCafeSlugsFromContent(content)
    expect(slugs).toEqual(["dennys", "sunny-roast"])
  })

  it("dedupes slugs and ignores non-cafe links", () => {
    const content = `https://grounds.ph/cafes/alpha https://grounds.ph/blog/test /cafes/alpha`;
    const slugs = extractCafeSlugsFromContent(content)
    expect(slugs).toEqual(["alpha"])
  })
})
