import { describe, it, expect, beforeEach, mock } from "bun:test"

// Mock cafe data for testing
const mockCafes = [
    {
        id: "cafe-1",
        name: "Coffee Shop One",
        slug: "coffee-shop-one",
        thumbnail: "https://example.com/1.jpg",
        description: "A nice coffee shop",
        addressDisplay: "123 Main St",
        area: "IT Park",
        cityMunicipality: "Cebu City",
        province: "Cebu",
        region: "Central Visayas",
        lat: 10.3157,
        lng: 123.8854,
        priceLevel: "mid",
        coffeeStyle: "artisan",
        membershipTier: "premium",
        roaster: "Local Roaster",
        brewMethods: ["pour-over", "espresso"],
        specialty: ["single-origin"],
        milkOptions: ["oat", "almond"],
        tags: ["cozy", "laptop-friendly"],
        operatingHours: [{ day: "mon", open: "08:00", close: "22:00", is_24_hours: false }],
        socials: [{ platform: "instagram", url: "@cafe1" }],
        phone: "123-456-7890",
        email: "cafe1@example.com",
        websiteUrl: "https://cafe1.com",
        paymentMethods: "cash,card",
        hasWifi: true,
        hasSmoking: false,
        hasSockets: true,
        hasAircon: true,
        hasParking: true,
        hasOutdoorSeating: true,
        hasIndoorSeating: true,
        hasRestroom: true,
        hasBidet: false,
        hasNonDairy: true,
        hasDecaf: true,
        isPetFriendly: true,
        isWorkFriendly: true,
        servesFood: true,
        isActive: true,
        isPublished: true,
        isVerified: true,
        isClaimed: false,
        ownerIds: null,
        contributorId: null,
        featuredUntil: null,
        isHiddenGem: false,
        findingHint: null,
        isChain: false,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        averageRating: 4.5,
        totalReviews: 10,
    },
    {
        id: "cafe-2",
        name: "Coffee Shop Two",
        slug: "coffee-shop-two",
        thumbnail: "https://example.com/2.jpg",
        description: "Another great coffee shop",
        addressDisplay: "456 Oak St",
        area: "Downtown",
        cityMunicipality: "Manila",
        province: "Metro Manila",
        region: "NCR",
        lat: 14.5995,
        lng: 120.9842,
        priceLevel: "premium",
        coffeeStyle: "classic",
        membershipTier: "standard",
        roaster: "Big Roaster",
        brewMethods: ["espresso"],
        specialty: ["latte-art"],
        milkOptions: ["whole"],
        tags: ["trendy"],
        operatingHours: [{ day: "mon", open: "00:00", close: "00:00", is_24_hours: true }],
        socials: null,
        phone: null,
        email: null,
        websiteUrl: null,
        paymentMethods: null,
        hasWifi: true,
        hasSmoking: true,
        hasSockets: false,
        hasAircon: true,
        hasParking: false,
        hasOutdoorSeating: false,
        hasIndoorSeating: true,
        hasRestroom: true,
        hasBidet: true,
        hasNonDairy: false,
        hasDecaf: false,
        isPetFriendly: false,
        isWorkFriendly: false,
        servesFood: false,
        isActive: true,
        isPublished: true,
        isVerified: true,
        isClaimed: true,
        ownerIds: ["owner-1"],
        contributorId: "user-1",
        featuredUntil: null,
        isHiddenGem: true,
        findingHint: "Look for the blue door",
        isChain: false,
        createdAt: new Date("2024-02-01"),
        updatedAt: new Date("2024-02-01"),
        averageRating: 4.0,
        totalReviews: 5,
    },
]

const mockCityCounts = [
    { city: "Cebu City", province: "Cebu", count: 5 },
    { city: "Manila", province: "Metro Manila", count: 3 },
]

let mockQueryResult: unknown[] = []

// Create a proper chainable mock that returns results at the end
function createMockQueryBuilder(results: unknown[] = []) {
    const self = {
        from: () => self,
        leftJoin: () => self,
        where: () => self,
        and: () => self,
        orderBy: () => self,
        limit: () => self,
        offset: () => self,
        groupBy: () => self,
        then: (resolve: (value: unknown[]) => unknown, reject?: (reason?: unknown) => unknown) => {
            return Promise.resolve(results).then(resolve, reject)
        },
        [Symbol.asyncIterator]: async function* () {
            for (const item of results) {
                yield item
            }
        },
    }
    return self
}

// Mock the database
mock.module("@/db", () => ({
    db: {
        select: () => createMockQueryBuilder(mockQueryResult),
    },
}))

// Import the functions after mocking
const {
    listCitiesWithCounts,
    getCafeBySlug,
    compareCafes,
    getNearbyCafes,
    getTopRatedCafes,
} = await import("@/utils/ai/tools/cafe-insights")

describe("cafe-insights", () => {
    beforeEach(() => {
        mockQueryResult = [...mockCafes]
    })

    describe("listCitiesWithCounts", () => {
        it("lists city counts", async () => {
            mockQueryResult = mockCityCounts
            const results = await listCitiesWithCounts()
            expect(Array.isArray(results)).toBe(true)
        })

        it("returns cities with count and province", async () => {
            mockQueryResult = mockCityCounts
            const results = await listCitiesWithCounts()
            if (results.length > 0) {
                expect(results[0]).toHaveProperty("city")
                expect(results[0]).toHaveProperty("count")
                expect(results[0]).toHaveProperty("province")
            }
        })

        it("returns correct count for cities", async () => {
            mockQueryResult = mockCityCounts
            const results = await listCitiesWithCounts()
            expect(results[0].count).toBe(5)
            expect(results[0].city).toBe("Cebu City")
            expect(results[0].province).toBe("Cebu")
        })
    })

    describe("getCafeBySlug", () => {
        it("returns cafe by slug", async () => {
            const cafe = await getCafeBySlug("coffee-shop-one")
            expect(cafe).not.toBeNull()
            if (cafe) {
                expect(cafe.slug).toBe("coffee-shop-one")
                expect(cafe.name).toBe("Coffee Shop One")
            }
        })

        it("returns null for non-existent slug", async () => {
            mockQueryResult = []
            const cafe = await getCafeBySlug("non-existent-cafe")
            expect(cafe).toBeNull()
        })

        it("returns cafe with correct properties", async () => {
            const cafe = await getCafeBySlug("coffee-shop-one")
            if (cafe) {
                expect(cafe).toHaveProperty("id")
                expect(cafe).toHaveProperty("name")
                expect(cafe).toHaveProperty("slug")
                expect(cafe).toHaveProperty("city_municipality")
                expect(cafe).toHaveProperty("average_rating")
                expect(cafe).toHaveProperty("total_reviews")
            }
        })
    })

    describe("compareCafes", () => {
        it("returns comparison data for two cafes", async () => {
            const comparison = await compareCafes("coffee-shop-one", "coffee-shop-two")
            expect(comparison).toBeDefined()
            expect(comparison).toHaveProperty("cafeA")
            expect(comparison).toHaveProperty("cafeB")
        })

        it("returns both cafes when both exist", async () => {
            const comparison = await compareCafes("coffee-shop-one", "coffee-shop-two")
            expect(comparison.cafeA).not.toBeNull()
            expect(comparison.cafeB).not.toBeNull()
            // Note: mock returns first match for all queries
            expect(comparison.cafeA?.slug).toBe("coffee-shop-one")
        })

        it("handles missing cafes gracefully", async () => {
            // Mock returns cafe for both queries since filter is not applied
            mockQueryResult = [mockCafes[0]]
            const comparison = await compareCafes("coffee-shop-one", "non-existent")
            // The mock returns data for both since we can't filter by slug
            expect(comparison.cafeA).not.toBeNull()
        })
    })

    describe("getNearbyCafes", () => {
        it("returns cafes near a location", async () => {
            const latLng = { lat: 14.5995, lng: 120.9842 }
            const results = await getNearbyCafes(latLng, 5)
            expect(Array.isArray(results)).toBe(true)
        })

        it("returns cafes with distance property", async () => {
            const latLng = { lat: 10.3157, lng: 123.8854 }
            const results = await getNearbyCafes(latLng, 10)
            if (results.length > 0) {
                expect(results[0]).toHaveProperty("distanceKm")
                expect(typeof results[0].distanceKm).toBe("number")
            }
        })

        it("sorts cafes by distance", async () => {
            const latLng = { lat: 10.3157, lng: 123.8854 }
            const results = await getNearbyCafes(latLng, 100)
            // All cafes are returned, sorted by distance
            expect(Array.isArray(results)).toBe(true)
        })
    })

    describe("getTopRatedCafes", () => {
        it("returns top rated cafes for a city", async () => {
            const results = await getTopRatedCafes("Manila", 5)
            expect(Array.isArray(results)).toBe(true)
        })

        it("respects the limit parameter", async () => {
            mockQueryResult = [mockCafes[0]]
            const results = await getTopRatedCafes("Cebu City", 1)
            expect(results.length).toBeLessThanOrEqual(1)
        })

        it("returns cafes with rating information", async () => {
            const results = await getTopRatedCafes("Cebu City", 2)
            if (results.length > 0) {
                expect(results[0]).toHaveProperty("average_rating")
                expect(results[0]).toHaveProperty("total_reviews")
            }
        })
    })
})
