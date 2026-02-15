import { describe, expect, it } from "bun:test"
import { buildPageMetadata } from "@/utils/seo/metadata"

describe("buildPageMetadata", () => {
    it("builds canonical and OG/Twitter metadata", () => {
        const meta = buildPageMetadata({
            title: "Test",
            description: "Desc",
            urlPath: "/community/crawls/test",
            ogImagePath: "/community/crawls/test/opengraph-image",
        })

        expect(meta.alternates?.canonical).toBe("https://grounds.ph/community/crawls/test")
        expect(meta.openGraph?.url).toBe("https://grounds.ph/community/crawls/test")
        expect(meta.twitter?.images?.[0]).toBe(
            "https://grounds.ph/community/crawls/test/opengraph-image"
        )
    })

    it("supports noindex", () => {
        const meta = buildPageMetadata({
            title: "Hidden",
            description: "Hidden",
            urlPath: "/community/crawls/create",
            index: false,
        })
        expect(meta.robots).toEqual({ index: false, follow: false })
    })
})
