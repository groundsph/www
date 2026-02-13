import { buildCrawlShareMetadata } from "@/utils/og/metadata"

test("buildCrawlShareMetadata sets og image", () => {
    const meta = buildCrawlShareMetadata({
        title: "Laguna Loop",
        description: "A 5-stop route",
        ogImageUrl: "https://grounds.ph/community/crawls/laguna-loop/opengraph-image",
    })
    expect(meta.openGraph?.images?.[0]?.url).toContain("opengraph-image")
})
