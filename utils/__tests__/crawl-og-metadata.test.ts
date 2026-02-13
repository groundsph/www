import { buildCrawlShareMetadata } from "@/utils/og/metadata"

describe("buildCrawlShareMetadata", () => {
    test("sets og image url correctly", () => {
        const meta = buildCrawlShareMetadata({
            title: "Laguna Loop",
            description: "A 5-stop route",
            ogImageUrl: "https://grounds.ph/community/crawls/laguna-loop/opengraph-image",
        })
        expect(meta.openGraph?.images?.[0]?.url).toContain("opengraph-image")
    })

    test("sets title correctly", () => {
        const meta = buildCrawlShareMetadata({
            title: "Manila Coffee Tour",
            description: "Best coffee spots in Manila",
            ogImageUrl: "/community/crawls/manila-coffee/opengraph-image",
        })
        expect(meta.title).toBe("Manila Coffee Tour")
    })

    test("sets description correctly", () => {
        const meta = buildCrawlShareMetadata({
            title: "Cebu Crawl",
            description: "Exploring Cebu cafes",
            ogImageUrl: "/community/crawls/cebu/opengraph-image",
        })
        expect(meta.description).toBe("Exploring Cebu cafes")
    })

    test("handles relative og image urls", () => {
        const meta = buildCrawlShareMetadata({
            title: "Test Crawl",
            description: "Test description",
            ogImageUrl: "/community/crawls/test/opengraph-image",
        })
        expect(meta.openGraph?.images?.[0]?.url).toBe("/community/crawls/test/opengraph-image")
    })

    test("handles absolute og image urls", () => {
        const meta = buildCrawlShareMetadata({
            title: "Test Crawl",
            description: "Test description",
            ogImageUrl: "https://example.com/image.png",
        })
        expect(meta.openGraph?.images?.[0]?.url).toBe("https://example.com/image.png")
    })

    test("includes twitter card metadata", () => {
        const meta = buildCrawlShareMetadata({
            title: "Twitter Test",
            description: "Testing Twitter cards",
            ogImageUrl: "/community/crawls/twitter/opengraph-image",
        })
        expect(meta.twitter?.card).toBe("summary_large_image")
        expect(meta.twitter?.title).toBe("Twitter Test")
        expect(meta.twitter?.description).toBe("Testing Twitter cards")
    })
})
