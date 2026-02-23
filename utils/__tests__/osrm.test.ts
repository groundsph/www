import { describe, it, expect } from "bun:test"
import { buildOsrmUrl, buildOsrmTableUrl } from "@/utils/map/osrm"

describe("osrm", () => {
    it("builds route url", () => {
        const url = buildOsrmUrl(
            { lat: 14.5995, lng: 120.9842 },
            { lat: 14.5547, lng: 121.0244 },
            "driving"
        )
        expect(url).toContain("route/v1/driving")
        expect(url).toContain("120.9842,14.5995")
    })

    it("uses driving profile by default", () => {
        const url = buildOsrmUrl(
            { lat: 14.5995, lng: 120.9842 },
            { lat: 14.5547, lng: 121.0244 }
        )
        expect(url).toContain("route/v1/driving")
    })

    it("uses correct coordinate order (lng,lat)", () => {
        const url = buildOsrmUrl(
            { lat: 10.0, lng: 20.0 },
            { lat: 30.0, lng: 40.0 },
            "driving"
        )
        expect(url).toContain("20,10;40,30")
    })

    it("supports foot profile", () => {
        const url = buildOsrmUrl(
            { lat: 14.5995, lng: 120.9842 },
            { lat: 14.5547, lng: 121.0244 },
            "foot"
        )
        expect(url).toContain("route/v1/foot")
    })

    it("includes required query parameters", () => {
        const url = buildOsrmUrl(
            { lat: 14.5995, lng: 120.9842 },
            { lat: 14.5547, lng: 121.0244 },
            "driving"
        )
        expect(url).toContain("overview=full")
        expect(url).toContain("geometries=geojson")
        expect(url).toContain("steps=false")
    })
})

describe("buildOsrmTableUrl", () => {
    it("builds a foot profile table URL with annotations", () => {
        const url = buildOsrmTableUrl(
            [
                { lat: 10.3157, lng: 123.8854 },
                { lat: 10.317, lng: 123.882 },
            ],
            "foot",
            "duration"
        )
        expect(url).toContain("/table/v1/foot/")
        expect(url).toContain("annotations=duration")
        expect(url).toContain("123.8854,10.3157;123.882,10.317")
    })
})
