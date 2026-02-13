import { describe, it, expect } from "bun:test"
import {
    createCafeCrawlSchema,
    updateCafeCrawlSchema,
    reorderCafeCrawlSchema,
    crawlItemSchema,
} from "@/utils/validation/cafe-crawls"

describe("createCafeCrawlSchema", () => {
    it("rejects empty title", () => {
        const result = createCafeCrawlSchema.safeParse({ title: "" })
        expect(result.success).toBe(false)
    })

    it("rejects title exceeding 100 characters", () => {
        const result = createCafeCrawlSchema.safeParse({
            title: "a".repeat(101),
        })
        expect(result.success).toBe(false)
    })

    it("accepts valid title only", () => {
        const result = createCafeCrawlSchema.safeParse({
            title: "My Cafe Crawl",
        })
        expect(result.success).toBe(true)
    })

    it("accepts valid data with all optional fields", () => {
        const result = createCafeCrawlSchema.safeParse({
            title: "My Cafe Crawl",
            description: "A wonderful coffee journey",
            coverImage: "https://example.com/image.jpg",
            isPublic: true,
            status: "published",
            items: [
                {
                    cafeId: "550e8400-e29b-41d4-a716-446655440000",
                    note: "Great espresso",
                    sortOrder: 0,
                },
            ],
        })
        expect(result.success).toBe(true)
    })

    it("rejects invalid URL for coverImage", () => {
        const result = createCafeCrawlSchema.safeParse({
            title: "My Cafe Crawl",
            coverImage: "not-a-url",
        })
        expect(result.success).toBe(false)
    })

    it("rejects invalid status enum", () => {
        const result = createCafeCrawlSchema.safeParse({
            title: "My Cafe Crawl",
            status: "invalid-status",
        })
        expect(result.success).toBe(false)
    })

    it("accepts all valid status values", () => {
        const statuses = ["draft", "published", "archived"]
        for (const status of statuses) {
            const result = createCafeCrawlSchema.safeParse({
                title: "My Cafe Crawl",
                status,
            })
            expect(result.success).toBe(true)
        }
    })

    it("rejects description exceeding 500 characters", () => {
        const result = createCafeCrawlSchema.safeParse({
            title: "My Cafe Crawl",
            description: "a".repeat(501),
        })
        expect(result.success).toBe(false)
    })
})

describe("crawlItemSchema", () => {
    it("rejects invalid UUID for cafeId", () => {
        const result = crawlItemSchema.safeParse({
            cafeId: "not-a-uuid",
        })
        expect(result.success).toBe(false)
    })

    it("accepts valid cafeId", () => {
        const result = crawlItemSchema.safeParse({
            cafeId: "550e8400-e29b-41d4-a716-446655440000",
        })
        expect(result.success).toBe(true)
    })

    it("rejects note exceeding 200 characters", () => {
        const result = crawlItemSchema.safeParse({
            cafeId: "550e8400-e29b-41d4-a716-446655440000",
            note: "a".repeat(201),
        })
        expect(result.success).toBe(false)
    })

    it("rejects negative sortOrder", () => {
        const result = crawlItemSchema.safeParse({
            cafeId: "550e8400-e29b-41d4-a716-446655440000",
            sortOrder: -1,
        })
        expect(result.success).toBe(false)
    })

    it("accepts valid sortOrder", () => {
        const result = crawlItemSchema.safeParse({
            cafeId: "550e8400-e29b-41d4-a716-446655440000",
            sortOrder: 5,
        })
        expect(result.success).toBe(true)
    })
})

describe("updateCafeCrawlSchema", () => {
    it("accepts partial updates", () => {
        const result = updateCafeCrawlSchema.safeParse({
            description: "Updated description",
        })
        expect(result.success).toBe(true)
    })

    it("accepts empty object", () => {
        const result = updateCafeCrawlSchema.safeParse({})
        expect(result.success).toBe(true)
    })

    it("rejects empty title when provided", () => {
        const result = updateCafeCrawlSchema.safeParse({
            title: "",
        })
        expect(result.success).toBe(false)
    })
})

describe("reorderCafeCrawlSchema", () => {
    it("accepts valid reorder data", () => {
        const result = reorderCafeCrawlSchema.safeParse({
            items: [
                {
                    cafeId: "550e8400-e29b-41d4-a716-446655440000",
                    sortOrder: 0,
                },
                {
                    cafeId: "550e8400-e29b-41d4-a716-446655440001",
                    sortOrder: 1,
                },
            ],
        })
        expect(result.success).toBe(true)
    })

    it("rejects invalid UUID in reorder", () => {
        const result = reorderCafeCrawlSchema.safeParse({
            items: [
                {
                    cafeId: "not-a-uuid",
                    sortOrder: 0,
                },
            ],
        })
        expect(result.success).toBe(false)
    })

    it("rejects negative sortOrder in reorder", () => {
        const result = reorderCafeCrawlSchema.safeParse({
            items: [
                {
                    cafeId: "550e8400-e29b-41d4-a716-446655440000",
                    sortOrder: -1,
                },
            ],
        })
        expect(result.success).toBe(false)
    })

    it("rejects empty items array", () => {
        const result = reorderCafeCrawlSchema.safeParse({
            items: [],
        })
        expect(result.success).toBe(false)
    })
})
