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
})
