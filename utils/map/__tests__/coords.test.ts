import { describe, expect, it } from "bun:test"
import { isValidLatLng, normalizeLatLng } from "@/utils/map/coords"

describe("coords", () => {
    it("accepts valid lat/lng (including 0)", () => {
        expect(isValidLatLng({ lat: 14.5995, lng: 120.9842 })).toBe(true)
        expect(isValidLatLng({ lat: 0, lng: 0 })).toBe(true)
    })

    it("rejects NaN, null, and undefined", () => {
        expect(isValidLatLng({ lat: Number.NaN, lng: 120 })).toBe(false)
        expect(isValidLatLng({ lat: 14, lng: Number.NaN })).toBe(false)
        expect(isValidLatLng({ lat: null, lng: 120 } as never)).toBe(false)
        expect(isValidLatLng({ lat: undefined, lng: undefined } as never)).toBe(false)
    })

    it("rejects out-of-range values", () => {
        expect(isValidLatLng({ lat: 91, lng: 120 })).toBe(false)
        expect(isValidLatLng({ lat: 14, lng: 181 })).toBe(false)
    })

    it("normalizes numeric strings", () => {
        expect(normalizeLatLng({ lat: "14.5995", lng: "120.9842" })).toEqual({
            lat: 14.5995,
            lng: 120.9842,
        })
    })
})