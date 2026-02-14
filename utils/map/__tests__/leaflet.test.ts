import { describe, it, expect } from "bun:test"
import { invalidateMapSize } from "@/utils/map/leaflet"

describe("leaflet utils", () => {
    it("calls invalidateSize on map", () => {
        let called = false
        const map = {
            invalidateSize: () => {
                called = true
            },
        }
        invalidateMapSize(map)
        expect(called).toBe(true)
    })
})
