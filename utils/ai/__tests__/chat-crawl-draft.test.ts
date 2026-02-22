import { describe, it, expect } from "bun:test"
import { buildChatCrawlDraft } from "@/utils/ai/chat-crawl-draft"

describe("buildChatCrawlDraft", () => {
    it("builds a draft when crawl intent is present", () => {
        const draft = buildChatCrawlDraft(
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

    it("returns null when no crawl intent", () => {
        const draft = buildChatCrawlDraft([], "Top cafes in Cebu")
        expect(draft).toBeNull()
    })
})
