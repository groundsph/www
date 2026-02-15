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

  it("returns empty array for empty content", () => {
    expect(extractCafeSlugsFromContent("")).toEqual([])
    expect(extractCafeSlugsFromContent("   ")).toEqual([])
  })

  it("handles null and undefined by returning empty array", () => {
    expect(extractCafeSlugsFromContent(null as unknown as string)).toEqual([])
    expect(extractCafeSlugsFromContent(undefined as unknown as string)).toEqual([])
  })

  it("normalizes uppercase slugs to lowercase", () => {
    const content = `https://grounds.ph/cafes/UPPER-CASE check out /cafes/MixedCase too`
    const slugs = extractCafeSlugsFromContent(content)
    expect(slugs).toEqual(["upper-case", "mixedcase"])
  })

  it("handles query parameters and hashes in URLs", () => {
    const content = `
      https://grounds.ph/cafes/cafe-one?ref=blog
      https://grounds.ph/cafes/cafe-two?utm_source=email
      /cafes/cafe-three#section
      /cafes/cafe-four?ref=blog#comments
    `
    const slugs = extractCafeSlugsFromContent(content)
    expect(slugs).toEqual(["cafe-one", "cafe-two", "cafe-three", "cafe-four"])
  })

  it("handles www. prefix in URLs", () => {
    const content = `
      https://www.grounds.ph/cafes/www-cafe
      http://www.grounds.ph/cafes/another-www
    `
    const slugs = extractCafeSlugsFromContent(content)
    expect(slugs).toEqual(["www-cafe", "another-www"])
  })

  it("handles various protocol variations", () => {
    const content = `
      https://grounds.ph/cafes/secure-cafe
      http://grounds.ph/cafes/insecure-cafe
    `
    const slugs = extractCafeSlugsFromContent(content)
    expect(slugs).toEqual(["secure-cafe", "insecure-cafe"])
  })

  it("handles multiple links separated by different delimiters", () => {
    const content = `
      Check out https://grounds.ph/cafes/first-cafe,
      then visit /cafes/second-cafe.
      Finally, try https://grounds.ph/cafes/third-cafe!
    `
    const slugs = extractCafeSlugsFromContent(content)
    expect(slugs).toEqual(["first-cafe", "second-cafe", "third-cafe"])
  })

  it("ignores invalid cafe paths", () => {
    const content = `
      https://grounds.ph/cafes/
      https://grounds.ph/cafes
      https://grounds.ph/other/path
    `
    const slugs = extractCafeSlugsFromContent(content)
    expect(slugs).toEqual([])
  })
})
