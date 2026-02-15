import { describe, it, expect } from "bun:test"
import { buildCrawlMapPoints } from "@/utils/map/crawl-map-points"

describe("buildCrawlMapPoints", () => {
    it("filters invalid items and sorts by order", () => {
        const points = buildCrawlMapPoints([
            { name: "B", slug: "b", thumbnail: null, lat: 2, lng: 2, sortOrder: 1 },
            { name: "A", slug: "a", thumbnail: null, lat: 1, lng: 1, sortOrder: 0 },
            { name: "No", slug: "no", thumbnail: null, lat: null, lng: null, sortOrder: 2 },
        ])
        expect(points.map((p) => p.label)).toEqual(["A", "B"])
    })
})
