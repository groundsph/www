import { describe, it, expect } from "bun:test"
import { buildOsrmUrl } from "@/utils/map/osrm"

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
