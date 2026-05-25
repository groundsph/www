import { describe, it, expect } from "bun:test"
import { buildMetadata } from "@/utils/seo/landing-metadata"

describe("city landing metadata", () => {
  it("builds correct title with city and province", () => {
    const meta = buildMetadata({
      city: "Makati",
      province: "Metro Manila",
      cafeCount: 42,
    })
    expect(meta.title).toContain("Makati")
    expect(meta.title).toContain("Metro Manila")
    expect(meta.description).toContain("42")
  })

  it("includes location keywords", () => {
    const meta = buildMetadata({
      city: "Cebu City",
      province: "Cebu",
      cafeCount: 15,
    })
    expect(meta.keywords).toContain("cafes in Cebu City")
    expect(meta.keywords).toContain("coffee shops Cebu City")
    expect(meta.keywords).toContain("Cebu City cafe guide")
  })

  it("sets canonical to self", () => {
    const meta = buildMetadata({
      city: "Makati",
      province: "Metro Manila",
      cafeCount: 10,
    })
    expect(meta.alternates?.canonical).toContain("/cafes/location/metro-manila/makati")
  })
})