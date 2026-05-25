import { describe, it, expect } from "bun:test"
import {
  buildBlogPostingJsonLd,
  buildItemListJsonLd,
  buildItemListElement,
} from "@/utils/seo/jsonld"

describe("buildBlogPostingJsonLd", () => {
  it("generates valid BlogPosting JSON-LD", () => {
    const result = buildBlogPostingJsonLd({
      title: "Test Blog Post",
      url: "https://grounds.ph/blog/test-post",
      description: "A test post about coffee",
      imageUrl: "https://cdn.grounds.ph/test.jpg",
      authorName: "Adrian Bonpin",
      authorUrl: "https://grounds.ph/profile/adrianbonpin",
      datePublished: "2025-01-15T00:00:00.000Z",
      dateModified: "2025-01-16T00:00:00.000Z",
    })

    expect(result["@context"]).toBe("https://schema.org")
    expect(result["@type"]).toBe("BlogPosting")
    expect(result.headline).toBe("Test Blog Post")
    expect(result.author["@type"]).toBe("Person")
    expect(result.author.name).toBe("Adrian Bonpin")
    expect(result.datePublished).toBe("2025-01-15T00:00:00.000Z")
  })

  it("handles missing optional fields", () => {
    const result = buildBlogPostingJsonLd({
      title: "Minimal Post",
      url: "https://grounds.ph/blog/minimal",
      description: "Minimal",
      authorName: "Author",
      datePublished: "2025-01-01T00:00:00.000Z",
    })

    expect(result.image).toBeUndefined()
    expect(result.author.url).toBeUndefined()
  })
})

describe("buildItemListJsonLd", () => {
  it("generates valid ItemList JSON-LD", () => {
    const elements = [
      buildItemListElement("Cafe One", "https://grounds.ph/cafes/cafe-one", 1),
      buildItemListElement("Cafe Two", "https://grounds.ph/cafes/cafe-two", 2),
    ]

    const result = buildItemListJsonLd(elements, "collection")
    expect(result["@type"]).toBe("ItemList")
    expect(result.itemListElement).toHaveLength(2)
    expect(result.itemListElement[0].position).toBe(1)
  })
})