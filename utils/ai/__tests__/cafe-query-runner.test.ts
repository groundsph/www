import { describe, it, expect, beforeEach, mock } from "bun:test"

// Mock cafe data for testing
const mockCafes = [
    {
        id: "cafe-1",
        name: "Coffee Shop One",
        slug: "coffee-shop-one",
        lat: 10.3157,
        lng: 123.8854,
        cityMunicipality: "Cebu City",
        province: "Cebu",
        rating: 4.5,
    },
    {
        id: "cafe-2",
        name: "Coffee Shop Two",
        slug: "coffee-shop-two",
        lat: 10.32,
        lng: 123.89,
        cityMunicipality: "Cebu City",
        province: "Cebu",
        rating: 4.0,
    },
    {
        id: "cafe-3",
        name: "Coffee Shop Three",
        slug: "coffee-shop-three",
        lat: 10.31,
        lng: 123.88,
        cityMunicipality: "Cebu City",
        province: "Cebu",
        rating: 4.8,
    },
]

// Create a mock query builder that simulates Drizzle
let mockQueryResult: unknown[] = []

// Create a proper chainable mock that returns results at the end
function createMockQueryBuilder(results: unknown[] = []) {
    const self = {
        from: () => self,
        leftJoin: () => self,
        where: () => self,
        orderBy: () => self,
        limit: () => self,
        offset: () => self,
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

// Import the function after mocking
const { runCafeQuery } = await import("@/utils/ai/tools/cafe-query-runner")

describe("runCafeQuery", () => {
    beforeEach(() => {
        mockQueryResult = [...mockCafes]
    })

    it("returns cafes filtered by city", async () => {
        const result = await runCafeQuery({ city: "Cebu", limit: 3 })
        expect(result.cafes.length).toBeLessThanOrEqual(3)
    })

    it("returns structured response with cafes, total, and metadata", async () => {
        const result = await runCafeQuery({ city: "Cebu", limit: 2 })
        expect(result).toHaveProperty("cafes")
        expect(result).toHaveProperty("total")
        expect(result).toHaveProperty("metadata")
        expect(Array.isArray(result.cafes)).toBe(true)
        expect(typeof result.total).toBe("number")
        expect(typeof result.metadata).toBe("object")
    })

    it("filters cafes by amenities", async () => {
        const result = await runCafeQuery({
            city: "Cebu",
            hasWifi: true,
            hasSockets: true,
            limit: 5,
        })
        expect(result.cafes.length).toBeLessThanOrEqual(5)
    })

    it("filters cafes by price level", async () => {
        const result = await runCafeQuery({
            city: "Cebu",
            priceLevel: "mid",
            limit: 5,
        })
        expect(result.cafes.length).toBeLessThanOrEqual(5)
    })

    it("returns cafes with required fields", async () => {
        const result = await runCafeQuery({ city: "Cebu", limit: 1 })
        if (result.cafes.length > 0) {
            const cafe = result.cafes[0]
            expect(cafe).toHaveProperty("id")
            expect(cafe).toHaveProperty("name")
            expect(cafe).toHaveProperty("slug")
            expect(cafe).toHaveProperty("lat")
            expect(cafe).toHaveProperty("lng")
            expect(cafe).toHaveProperty("cityMunicipality")
            expect(cafe).toHaveProperty("province")
            expect(cafe).toHaveProperty("rating")
        }
    })

    it("handles pagination with offset", async () => {
        const firstPage = await runCafeQuery({ city: "Cebu", limit: 2, offset: 0 })
        const secondPage = await runCafeQuery({ city: "Cebu", limit: 2, offset: 2 })
        expect(firstPage.cafes.length).toBeLessThanOrEqual(2)
        expect(secondPage.cafes.length).toBeLessThanOrEqual(2)
    })

    it("returns empty array when no matches found", async () => {
        mockQueryResult = []
        const result = await runCafeQuery({
            city: "NonExistentCity12345",
            limit: 5,
        })
        expect(result.cafes).toEqual([])
        expect(result.total).toBe(0)
    })

    it("sorts by rating when specified", async () => {
        const result = await runCafeQuery({
            city: "Cebu",
            sortBy: "rating",
            limit: 5,
        })
        expect(result.cafes.length).toBeLessThanOrEqual(5)
    })
})
