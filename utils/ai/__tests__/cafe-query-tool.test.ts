import { describe, it, expect } from "bun:test"
import { cafeQuerySchema } from "@/utils/ai/tools/cafe-query"

describe("cafeQuerySchema", () => {
    it("validates common filters", () => {
        const input = {
            city: "Cebu",
            limit: 5,
            hasWifi: true,
            sortBy: "rating",
        }
        expect(cafeQuerySchema.parse(input).city).toBe("Cebu")
    })

    it("validates location filters", () => {
        const input = {
            city: "Cebu City",
            province: "Cebu",
            region: "Central Visayas",
            area: "IT Park",
            nearLatLng: { lat: 10.3157, lng: 123.8854 },
            radiusKm: 10,
        }
        const result = cafeQuerySchema.parse(input)
        expect(result.city).toBe("Cebu City")
        expect(result.province).toBe("Cebu")
        expect(result.region).toBe("Central Visayas")
        expect(result.area).toBe("IT Park")
        expect(result.nearLatLng).toEqual({ lat: 10.3157, lng: 123.8854 })
        expect(result.radiusKm).toBe(10)
    })

    it("validates pagination", () => {
        const input = {
            limit: 25,
            offset: 10,
        }
        const result = cafeQuerySchema.parse(input)
        expect(result.limit).toBe(25)
        expect(result.offset).toBe(10)
    })

    it("validates sorting options", () => {
        const sortOptions = ["rating", "distance", "recent", "reviews"]
        for (const sortBy of sortOptions) {
            const result = cafeQuerySchema.parse({ sortBy })
            expect(result.sortBy).toBe(sortBy)
        }
    })

    it("validates amenities", () => {
        const input = {
            hasWifi: true,
            hasSockets: true,
            hasAircon: true,
            isPetFriendly: false,
            isWorkFriendly: true,
            servesFood: true,
            hasOutdoorSeating: true,
        }
        const result = cafeQuerySchema.parse(input)
        expect(result.hasWifi).toBe(true)
        expect(result.hasSockets).toBe(true)
        expect(result.hasAircon).toBe(true)
        expect(result.isPetFriendly).toBe(false)
        expect(result.isWorkFriendly).toBe(true)
        expect(result.servesFood).toBe(true)
        expect(result.hasOutdoorSeating).toBe(true)
    })

    it("validates pricing fields", () => {
        const input = {
            priceLevel: "medium",
            coffeeStyle: "artisan",
            membershipTier: "premium",
        }
        const result = cafeQuerySchema.parse(input)
        expect(result.priceLevel).toBe("medium")
        expect(result.coffeeStyle).toBe("artisan")
        expect(result.membershipTier).toBe("premium")
    })

    it("validates status fields", () => {
        const input = {
            isPublished: true,
            isHiddenGem: true,
            isChain: false,
        }
        const result = cafeQuerySchema.parse(input)
        expect(result.isPublished).toBe(true)
        expect(result.isHiddenGem).toBe(true)
        expect(result.isChain).toBe(false)
    })

    it("validates tag arrays", () => {
        const input = {
            tags: ["cozy", "laptop-friendly"],
            brewMethods: ["pour-over", "espresso"],
            specialty: ["single-origin", "latte-art"],
            milkOptions: ["oat", "almond"],
        }
        const result = cafeQuerySchema.parse(input)
        expect(result.tags).toEqual(["cozy", "laptop-friendly"])
        expect(result.brewMethods).toEqual(["pour-over", "espresso"])
        expect(result.specialty).toEqual(["single-origin", "latte-art"])
        expect(result.milkOptions).toEqual(["oat", "almond"])
    })

    it("validates empty object (all optional)", () => {
        const result = cafeQuerySchema.parse({})
        expect(result).toEqual({})
    })

    it("rejects limit above 50", () => {
        expect(() => cafeQuerySchema.parse({ limit: 100 })).toThrow()
    })

    it("rejects radiusKm above 50", () => {
        expect(() => cafeQuerySchema.parse({ radiusKm: 100 })).toThrow()
    })

    it("rejects invalid sortBy", () => {
        expect(() => cafeQuerySchema.parse({ sortBy: "invalid" })).toThrow()
    })

    it("rejects invalid priceLevel", () => {
        expect(() => cafeQuerySchema.parse({ priceLevel: "expensive" })).toThrow()
    })
})
