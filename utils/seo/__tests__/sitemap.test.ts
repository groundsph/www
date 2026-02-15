import { describe, expect, it } from "bun:test"
import { buildSitemapEntries } from "@/utils/seo/sitemap"

describe("buildSitemapEntries", () => {
    it("includes crawls and collections", () => {
        const entries = buildSitemapEntries({
            baseUrl: "https://grounds.ph",
            staticPages: ["/", "/cafes"],
            cafes: [],
            blogs: [],
            menus: [],
            collections: [{ slug: "cozy" }],
            crawls: [{ slug: "weekend" }],
            profiles: [],
        })

        const urls = entries.map((e) => e.url)
        expect(urls).toContain("https://grounds.ph/community/cozy")
        expect(urls).toContain("https://grounds.ph/community/crawls/weekend")
    })
})
