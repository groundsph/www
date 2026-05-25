import { describe, it, expect } from "bun:test"

// Replicate the slug logic here for direct testing
function generateSlug(name: string, locationSlug?: string): string {
  const nameSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "cafe"

  if (locationSlug) {
    const combined = `${nameSlug}-${locationSlug}`
    return combined.length > 200 ? combined.slice(0, 200).replace(/-$/, "") : combined
  }

  return nameSlug.length > 200 ? nameSlug.slice(0, 200).replace(/-$/, "") : nameSlug
}

function buildLocationSlug(cityMunicipality: string, province: string): string {
  const slugify = (s: string) => s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")

  const citySlug = slugify(cityMunicipality)
  const provinceSlug = slugify(province)

  if (citySlug && provinceSlug) return `${citySlug}-${provinceSlug}`
  if (provinceSlug) return provinceSlug
  return ""
}

describe("generateSlug", () => {
  it("generates simple slug from name", () => {
    expect(generateSlug("Starbucks")).toBe("starbucks")
  })

  it("includes location in slug", () => {
    expect(generateSlug("Starbucks", "makati-metro-manila"))
      .toBe("starbucks-makati-metro-manila")
  })

  it("handles special characters", () => {
    expect(generateSlug("Café & Restaurant!"))
      .toBe("caf-restaurant")
  })

  it("collapses multiple hyphens", () => {
    expect(generateSlug("Test -- Cafe --- Special"))
      .toBe("test-cafe-special")
  })

  it("trims leading/trailing hyphens", () => {
    expect(generateSlug("  ---Hello World---  "))
      .toBe("hello-world")
  })

  it("returns 'cafe' for purely special character names", () => {
    expect(generateSlug("!!!")).toBe("cafe")
  })

  it("truncates long slugs to 200 chars", () => {
    const longName = "a".repeat(250)
    const slug = generateSlug(longName)
    expect(slug.length).toBeLessThanOrEqual(200)
  })

  it("does not end truncated slug with hyphen", () => {
    const longName = "a".repeat(250) + "-"
    const slug = generateSlug(longName)
    expect(slug.endsWith("-")).toBe(false)
  })
})

describe("buildLocationSlug", () => {
  it("builds city-province slug", () => {
    expect(buildLocationSlug("Makati", "Metro Manila"))
      .toBe("makati-metro-manila")
  })

  it("falls back to province only when city is empty", () => {
    expect(buildLocationSlug("", "Metro Manila"))
      .toBe("metro-manila")
  })

  it("returns empty when both are empty", () => {
    expect(buildLocationSlug("", "")).toBe("")
  })

  it("handles special characters in city names", () => {
    expect(buildLocationSlug("San José", "Nueva Ecija"))
      .toBe("san-jos-nueva-ecija")
  })
})