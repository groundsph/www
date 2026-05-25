import { describe, expect, it } from "bun:test"
import { buildSitemapEntries } from "@/utils/seo/sitemap"

describe("buildSitemapEntries", () => {
    it("includes crawls and collections", () => {
        const entries = buildSitemapEntries({
            baseUrl: "https://grounds.ph",
            staticPages: [
                { path: "/", changeFrequency: "daily", priority: 1 },
                { path: "/cafes", changeFrequency: "daily", priority: 0.9 },
            ],
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

    it("preserves page-specific priorities and changeFrequency", () => {
        const entries = buildSitemapEntries({
            baseUrl: "https://grounds.ph",
            staticPages: [
                { path: "/", changeFrequency: "daily", priority: 1 },
                { path: "/cafes", changeFrequency: "daily", priority: 0.9 },
                { path: "/legal", changeFrequency: "yearly", priority: 0.3 },
            ],
            cafes: [],
            blogs: [],
            menus: [],
            collections: [],
            crawls: [],
            profiles: [],
        })

        const home = entries.find((e) => e.url === "https://grounds.ph/")
        const cafes = entries.find((e) => e.url === "https://grounds.ph/cafes")
        const legal = entries.find((e) => e.url === "https://grounds.ph/legal")

        expect(home?.priority).toBe(1)
        expect(home?.changeFrequency).toBe("daily")

        expect(cafes?.priority).toBe(0.9)
        expect(cafes?.changeFrequency).toBe("daily")

        expect(legal?.priority).toBe(0.3)
        expect(legal?.changeFrequency).toBe("yearly")
    })

    it("uses fallback timestamps for dynamic pages", () => {
        const entries = buildSitemapEntries({
            baseUrl: "https://grounds.ph",
            staticPages: [],
            cafes: [{ slug: "test-cafe", updatedAt: null, createdAt: null }],
            blogs: [],
            menus: [],
            collections: [],
            crawls: [],
            profiles: [],
        })

        const cafe = entries.find((e) => e.url === "https://grounds.ph/cafes/test-cafe")
        expect(cafe?.lastModified).toBeInstanceOf(Date)
        expect(cafe?.priority).toBe(0.8)
        expect(cafe?.changeFrequency).toBe("weekly")
    })

    it("includes profile entries when provided", () => {
        const entries = buildSitemapEntries({
            baseUrl: "https://grounds.ph",
            staticPages: [],
            cafes: [],
            blogs: [],
            menus: [],
            collections: [],
            crawls: [],
            profiles: [
                { username: "adrianbonpin", updatedAt: new Date("2025-01-01") },
                { username: "notwabbit", updatedAt: null },
            ],
        })

        const profileEntries = entries.filter(
            (e) => e.url.includes("/profile/")
        )
        expect(profileEntries.length).toBe(2)
        expect(profileEntries[0].url).toBe("https://grounds.ph/profile/adrianbonpin")
        expect(profileEntries[1].url).toBe("https://grounds.ph/profile/notwabbit")
    })

    it("handles empty profiles gracefully", () => {
        const entries = buildSitemapEntries({
            baseUrl: "https://grounds.ph",
            staticPages: [{ path: "/", changeFrequency: "daily", priority: 1 }],
            cafes: [],
            blogs: [],
            menus: [],
            collections: [],
            crawls: [],
            profiles: [],
        })

        expect(entries.length).toBe(1)
        expect(entries[0].url).toBe("https://grounds.ph/")
    })
})
