import { describe, it, expect } from "bun:test"
import { buildBreadcrumbList, type BreadcrumbItem } from "@/utils/seo/breadcrumbs"

describe("buildBreadcrumbList", () => {
  it("generates valid BreadcrumbList JSON-LD", () => {
    const items: BreadcrumbItem[] = [
      { name: "Home", url: "https://grounds.ph" },
      { name: "Cafes", url: "https://grounds.ph/cafes" },
      { name: "Starbucks Makati", url: "https://grounds.ph/cafes/starbucks-makati" },
    ]

    const result = buildBreadcrumbList(items)
    expect(result["@context"]).toBe("https://schema.org")
    expect(result["@type"]).toBe("BreadcrumbList")
    expect(result.itemListElement).toHaveLength(3)
    expect(result.itemListElement[0].name).toBe("Home")
    expect(result.itemListElement[0].item).toBe("https://grounds.ph")
    expect(result.itemListElement[0].position).toBe(1)
  })

  it("handles single item", () => {
    const items: BreadcrumbItem[] = [
      { name: "Home", url: "https://grounds.ph" },
    ]

    const result = buildBreadcrumbList(items)
    expect(result.itemListElement).toHaveLength(1)
    expect(result.itemListElement[0].position).toBe(1)
  })

  it("handles empty array", () => {
    const result = buildBreadcrumbList([])
    expect(result.itemListElement).toHaveLength(0)
  })
})