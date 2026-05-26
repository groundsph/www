import { describe, it, expect } from "bun:test"
import { slugify, generateSlug } from "@/utils/slug"

describe("slugify", () => {
  it("NFD-normalizes accented characters: Café → cafe", () => {
    expect(slugify("Café")).toBe("cafe")
  })

  it("NFD-normalizes accented characters: San José → san-jose", () => {
    expect(slugify("San José")).toBe("san-jose")
  })

  it("strips punctuation and symbols", () => {
    expect(slugify("Café & Restaurant!")).toBe("cafe-restaurant")
  })

  it("trims and collapses spaces", () => {
    expect(slugify("  Spaces  Around  ")).toBe("spaces-around")
  })

  it("returns 'cafe' for empty string", () => {
    expect(slugify("")).toBe("cafe")
  })

  it("truncates to 200 chars max", () => {
    const slug = slugify("a".repeat(300))
    expect(slug.length).toBeLessThanOrEqual(200)
  })
})

describe("generateSlug", () => {
  it("applies NFD normalization on all parts", () => {
    expect(generateSlug("Café", "San José", "Nueva Ecija"))
      .toBe("cafe-san-jose-nueva-ecija")
  })

  it("combines name + city + province", () => {
    expect(generateSlug("Best Coffee", "Makati", "Metro Manila"))
      .toBe("best-coffee-makati-metro-manila")
  })

  it("returns name-only slug when no location", () => {
    expect(generateSlug("Cafe")).toBe("cafe")
  })

  it("truncates combined slug to 200 chars max", () => {
    const slug = generateSlug("A".repeat(300), "City", "Province")
    expect(slug.length).toBeLessThanOrEqual(200)
  })

  it("falls back to 'cafe' for empty name and uses location", () => {
    expect(generateSlug("", "City", "Province")).toBe("cafe-city-province")
  })

  it("preserves existing dashes in name", () => {
    expect(generateSlug("hello-world", "City", "Province"))
      .toBe("hello-world-city-province")
  })

  it("strips symbols and keeps alphanumerics", () => {
    expect(generateSlug("Cafe 123!", "City", "Province"))
      .toBe("cafe-123-city-province")
  })

  it("collapses multiple spaces into single dash", () => {
    expect(generateSlug("multiple   spaces", "City", "Province"))
      .toBe("multiple-spaces-city-province")
  })
})