import { describe, it, expect } from "bun:test"
import {
    escapeXml,
    toRfc822,
    stripHtml,
    buildRssXml,
} from "@/utils/blog/feed"
import type { BlogPost } from "@/utils/types/blog"

// Minimal fields needed by the builder.
const post = (overrides: Partial<BlogPost> = {}): BlogPost => ({
    id: "post-1",
    title: "Best Cafes in Manila",
    slug: "best-cafes-in-manila",
    excerpt: "A guide to the best cafes.",
    content: "<p>Full <strong>content</strong> &amp; more.</p>",
    cover_image: "https://cdn.grounds.ph/cover.jpg",
    author_id: "u1",
    cafe_id: null,
    category: "guides",
    status: "published",
    tags: ["cafe"],
    images: [],
    tagged_cafe_ids: [],
    crawl_id: null,
    featured: false,
    views_count: 10,
    published_at: "2026-01-02T03:04:05+08:00",
    created_at: "2026-01-02T03:04:05+08:00",
    updated_at: "2026-01-02T03:04:05+08:00",
    author: { id: "u1", display_name: "Jane & Doe", avatar_url: null, username: "jane" },
    cafe: null,
    ...overrides,
})

describe("blog RSS feed", () => {
    it("escapes XML special characters", () => {
        expect(escapeXml(`a & b <c> "x" 'y'`)).toBe(
            "a &amp; b &lt;c&gt; &quot;x&quot; &apos;y&apos;"
        )
        expect(escapeXml(null)).toBe("")
    })

    it("formats dates as RFC 822", () => {
        // 2026-01-02 03:04:05 +08:00 == 2026-01-01 19:04:05 UTC.
        expect(toRfc822("2026-01-02T03:04:05+08:00")).toBe(
            "Thu, 01 Jan 2026 19:04:05 GMT"
        )
        expect(toRfc822(null)).toBe("Thu, 01 Jan 1970 00:00:00 GMT")
    })

    it("strips HTML tags from content", () => {
        expect(stripHtml("<p>Hello <strong>there</strong></p>&nbsp;  world")).toBe(
            "Hello there world"
        )
    })

    it("builds a well-formed RSS 2.0 document with items", () => {
        const posts = [post()]
        const url = "https://grounds.ph"

        const xml = buildRssXml(posts, url, {
            title: "GroundsPH Blog",
            link: `${url}/blog`,
            description: "Latest cafe news",
            selfUrl: `${url}/feed.xml`,
        })

        expect(xml).toContain(`<rss version="2.0"`)
        expect(xml).toContain(`<title>GroundsPH Blog</title>`)
        expect(xml).toContain(`<link>${url}/blog</link>`)
        expect(xml).toContain(`<atom:link href="${url}/feed.xml" rel="self"`)
        expect(xml).toContain(`<item>`)
        expect(xml).toContain(`<title>Best Cafes in Manila</title>`)
        expect(xml).toContain(`<link>${url}/blog/best-cafes-in-manila</link>`)
        expect(xml).toContain(`<guid isPermaLink="false">post-1</guid>`)
        expect(xml).toContain(`<pubDate>Thu, 01 Jan 2026 19:04:05 GMT</pubDate>`)
        expect(xml).toContain(`<dc:creator>Jane &amp; Doe</dc:creator>`)
        expect(xml).toContain(`type="image/jpeg"`)
        expect(xml).toContain(`<content:encoded>&lt;p&gt;Full &lt;strong&gt;content`)
        expect(xml).not.toContain("undefined")
        expect(xml).not.toContain("null")
    })

    it("omits optional fields when absent", () => {
        const bare: BlogPost = post({
            excerpt: null,
            cover_image: null,
            content: "",
            author: null,
            category: null,
            published_at: null,
        })
        const xml = buildRssXml([bare], "https://grounds.ph", {
            title: "T",
            link: "https://grounds.ph/blog",
            description: "D",
            selfUrl: "https://grounds.ph/feed.xml",
        })
        expect(xml).not.toContain("<category>")
        expect(xml).not.toContain("<enclosure")
        expect(xml).not.toContain("<dc:creator>")
        // Empty content block should still render as an empty element.
        expect(xml).toContain("<content:encoded></content:encoded>")
    })
})
