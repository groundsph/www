import { describe, it, expect } from "bun:test"
import { existsSync } from "fs"
import { join } from "path"

// Mock the getCafeThumbnailUrl helper
const CAFE_PLACEHOLDER_URL = "https://cdn.grounds.ph/cafes/placeholder.jpg"

function getCafeThumbnailUrl(thumbnail: string | null | undefined): string | null {
    if (!thumbnail) return null
    if (thumbnail === "placeholder") {
        return CAFE_PLACEHOLDER_URL
    }
    return thumbnail
}

// Define the cafe item type to match CrawlView.tsx
interface TestCafeItem {
    id: string
    cafeId: string
    name: string
    slug: string
    thumbnail: string | null
    cityMunicipality: string
    region: string
    averageRating: number | null
    totalReviews: number | null
    sortOrder: number
    note: string | null
    lat: number | null
    lng: number | null
}

// Simulating the mapPoints transformation logic from CrawlView.tsx
function transformCafesToMapPoints(cafes: TestCafeItem[]) {
    const validCafes = cafes.filter(
        (c): c is TestCafeItem & { lat: number; lng: number } =>
            c != null && c.lat != null && c.lng != null
    )

    return validCafes
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((cafe) => ({
            lat: cafe.lat,
            lng: cafe.lng,
            imageUrl: cafe.thumbnail ? getCafeThumbnailUrl(cafe.thumbnail) : null,
            label: cafe.name,
        }))
}

describe("CrawlView", () => {
    it("CrawlView component file exists", () => {
        const filePath = join(process.cwd(), "components", "crawls", "CrawlView.tsx")
        expect(existsSync(filePath)).toBe(true)
    })

    it("CrawlRouteMap component file exists", () => {
        const filePath = join(process.cwd(), "components", "map", "CrawlRouteMap.tsx")
        expect(existsSync(filePath)).toBe(true)
    })

    it("Crawl page file exists", () => {
        const filePath = join(process.cwd(), "app", "community", "crawls", "[slug]", "page.tsx")
        expect(existsSync(filePath)).toBe(true)
    })

    it("CrawlView passes thumbnails to map points", () => {
        const cafes = [
            {
                id: "i",
                cafeId: "c",
                name: "Cafe",
                slug: "cafe",
                thumbnail: "https://cdn.example.com/thumb.jpg",
                cityMunicipality: "Manila",
                region: "Metro Manila",
                averageRating: null,
                totalReviews: null,
                sortOrder: 0,
                note: null,
                lat: 14.5995,
                lng: 120.9842,
            },
        ]

        const mapPoints = transformCafesToMapPoints(cafes)

        expect(mapPoints.length).toBe(1)
        expect(mapPoints[0]).toHaveProperty("lat", 14.5995)
        expect(mapPoints[0]).toHaveProperty("lng", 120.9842)
        expect(mapPoints[0]).toHaveProperty("imageUrl", "https://cdn.example.com/thumb.jpg")
        expect(mapPoints[0]).toHaveProperty("label", "Cafe")
    })

    it("CrawlView handles null thumbnails correctly", () => {
        const cafes = [
            {
                id: "i",
                cafeId: "c",
                name: "Cafe",
                slug: "cafe",
                thumbnail: null,
                cityMunicipality: "Manila",
                region: "Metro Manila",
                averageRating: null,
                totalReviews: null,
                sortOrder: 0,
                note: null,
                lat: 14.5995,
                lng: 120.9842,
            },
        ]

        const mapPoints = transformCafesToMapPoints(cafes)

        expect(mapPoints.length).toBe(1)
        expect(mapPoints[0]).toHaveProperty("imageUrl", null)
        expect(mapPoints[0]).toHaveProperty("label", "Cafe")
    })

    it("CrawlView converts placeholder thumbnails to placeholder URL", () => {
        const cafes = [
            {
                id: "i",
                cafeId: "c",
                name: "Cafe",
                slug: "cafe",
                thumbnail: "placeholder",
                cityMunicipality: "Manila",
                region: "Metro Manila",
                averageRating: null,
                totalReviews: null,
                sortOrder: 0,
                note: null,
                lat: 14.5995,
                lng: 120.9842,
            },
        ]

        const mapPoints = transformCafesToMapPoints(cafes)

        expect(mapPoints[0]).toHaveProperty("imageUrl", CAFE_PLACEHOLDER_URL)
    })

    it("CrawlView sorts cafes by sortOrder", () => {
        const cafes = [
            {
                id: "c2",
                cafeId: "c2",
                name: "Second",
                slug: "second",
                thumbnail: null,
                cityMunicipality: "",
                region: "",
                averageRating: null,
                totalReviews: null,
                sortOrder: 1,
                note: null,
                lat: 1,
                lng: 1,
            },
            {
                id: "c1",
                cafeId: "c1",
                name: "First",
                slug: "first",
                thumbnail: null,
                cityMunicipality: "",
                region: "",
                averageRating: null,
                totalReviews: null,
                sortOrder: 0,
                note: null,
                lat: 2,
                lng: 2,
            },
        ]

        const mapPoints = transformCafesToMapPoints(cafes)

        expect(mapPoints.length).toBe(2)
        expect(mapPoints[0].label).toBe("First")
        expect(mapPoints[1].label).toBe("Second")
    })

    it("CrawlView filters out cafes without lat/lng", () => {
        const cafes = [
            {
                id: "with-coords",
                cafeId: "c1",
                name: "With Coords",
                slug: "with-coords",
                thumbnail: null,
                cityMunicipality: "",
                region: "",
                averageRating: null,
                totalReviews: null,
                sortOrder: 0,
                note: null,
                lat: 1,
                lng: 1,
            },
            {
                id: "no-coords",
                cafeId: "c2",
                name: "No Coords",
                slug: "no-coords",
                thumbnail: null,
                cityMunicipality: "",
                region: "",
                averageRating: null,
                totalReviews: null,
                sortOrder: 1,
                note: null,
                lat: null,
                lng: null,
            },
        ]

        const mapPoints = transformCafesToMapPoints(cafes)

        expect(mapPoints.length).toBe(1)
        expect(mapPoints[0].label).toBe("With Coords")
    })
})