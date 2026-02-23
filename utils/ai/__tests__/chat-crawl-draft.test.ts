import { describe, expect, it } from "bun:test"
import { buildChatCrawlDraft } from "@/utils/ai/chat-crawl-draft"

const mockFetch = (durations: number[][]) => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () =>
        ({ ok: true, json: async () => ({ durations }) }) as unknown as Response) as typeof fetch
    return () => {
        globalThis.fetch = originalFetch
    }
}

describe("chat crawl from recent cafes", () => {
    it("builds a crawl from recent cafes without new tool calls", async () => {
        const recent = [
            { id: "1", slug: "a", title: "Cafe A", coverImageUrl: null, city: "Cebu", lat: 10.3157, lng: 123.8854 },
            { id: "2", slug: "b", title: "Cafe B", coverImageUrl: null, city: "Cebu", lat: 10.3170, lng: 123.8820 },
        ]
        const restoreFetch = mockFetch([
            [0, 1],
            [1, 0],
        ])
        try {
            const draft = await buildChatCrawlDraft(
                [], // Empty records - no new tool calls
                "Make a crawl from those",
                { recentCafes: recent }
            )
            expect(draft?.items.length).toBe(2)
        } finally {
            restoreFetch()
        }
    })

    it("uses recent cafes when asking for the first count", async () => {
        const recent = [
            { id: "1", slug: "a", title: "Cafe A", coverImageUrl: null, city: "Cebu", lat: 10.3157, lng: 123.8854 },
            { id: "2", slug: "b", title: "Cafe B", coverImageUrl: null, city: "Cebu", lat: 10.3170, lng: 123.8820 },
            { id: "3", slug: "c", title: "Cafe C", coverImageUrl: null, city: "Cebu", lat: 10.3180, lng: 123.8830 },
        ]
        const restoreFetch = mockFetch([
            [0, 1, 2],
            [1, 0, 1],
            [2, 1, 0],
        ])
        try {
            const draft = await buildChatCrawlDraft(
                [],
                "Make a crawl from the first 2",
                { recentCafes: recent }
            )
            expect(draft?.items.length).toBe(2)
        } finally {
            restoreFetch()
        }
    })

    it("does not use recent cafes without a reference", async () => {
        const recent = [
            { id: "1", slug: "a", title: "Cafe A", coverImageUrl: null, city: "Cebu", lat: 10.3157, lng: 123.8854 },
        ]
        const draft = await buildChatCrawlDraft(
            [],
            "Make a crawl",
            { recentCafes: recent }
        )
        expect(draft).toBeNull()
    })
})

describe("buildChatCrawlDraft", () => {
    it("adds visit notes when hours are present", async () => {
        const draft = await buildChatCrawlDraft(
            [
                {
                    toolName: "query_cafes",
                    params: { city: "Cebu" },
                    result: {
                        cafes: [
                            {
                                id: "1",
                                name: "A",
                                slug: "a",
                                lat: 10.3157,
                                lng: 123.8854,
                                operatingHours: [
                                    { day: "mon", open: "08:00", close: "18:00", is_24_hours: false },
                                ],
                            },
                        ],
                    },
                },
            ],
            "Build me a crawl in Cebu on Monday at 9am"
        )

        expect(draft?.items[0].note).toContain("Visit")
    })

    it("builds a draft when crawl intent is present", async () => {
        const draft = await buildChatCrawlDraft(
            [
                {
                    toolName: "query_cafes",
                    params: { city: "Cebu" },
                    result: {
                        cafes: [
                            {
                                id: "1",
                                name: "Cafe Uno",
                                slug: "cafe-uno",
                                thumbnail: null,
                                cityMunicipality: "Cebu City",
                                region: "Central Visayas",
                                lat: 10.3157,
                                lng: 123.8854,
                            },
                        ],
                    },
                },
            ],
            "Build me a crawl in Cebu"
        )

        expect(draft?.title).toContain("Cebu")
        expect(draft?.items.length).toBe(1)
        expect(draft?.isPublic).toBe(false)
    })

    it("returns null when no crawl intent", async () => {
        const draft = await buildChatCrawlDraft([], "Top cafes in Cebu")
        expect(draft).toBeNull()
    })
})
