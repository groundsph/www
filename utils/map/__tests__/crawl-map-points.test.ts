import { describe, expect, it } from "bun:test"
import { buildCrawlMapPoints } from "@/utils/map/crawl-map-points"

describe("buildCrawlMapPoints", () => {
    it("filters invalid lat/lng and preserves sort order", () => {
        const points = buildCrawlMapPoints([
            {
                name: "Valid",
                slug: "valid",
                thumbnail: null,
                lat: 14.5,
                lng: 120.9,
                sortOrder: 1,
            },
            {
                name: "Invalid",
                slug: "invalid",
                thumbnail: null,
                lat: Number.NaN,
                lng: 120.9,
                sortOrder: 0,
            },
            {
                name: "String",
                slug: "string",
                thumbnail: null,
                lat: "14.6",
                lng: "121.0",
                sortOrder: 2,
            } as never,
        ])

        expect(points.length).toBe(2)
        expect(points[0].label).toBe("Valid")
        expect(points[1].label).toBe("String")
        expect(points[0].index).toBe(1)
        expect(points[1].index).toBe(2)
    })
})
