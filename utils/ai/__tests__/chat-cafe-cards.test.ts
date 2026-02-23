import { describe, it, expect } from "bun:test"
import { buildChatCafeCards } from "@/utils/ai/chat-cafe-cards"

describe("buildChatCafeCards", () => {
    it("maps query_cafes results to cards with context", () => {
        const result = buildChatCafeCards([
            {
                toolName: "query_cafes",
                params: { city: "Cebu" },
                result: {
                    cafes: [
                        {
                            id: "1",
                            name: "Cafe Uno",
                            slug: "cafe-uno",
                            thumbnail: "uno.jpg",
                            cityMunicipality: "Cebu City",
                            province: "Cebu",
                            lat: 10.3157,
                            lng: 123.8854,
                            rating: 4.4,
                            totalReviews: 14,
                            hasWifi: true,
                            hasSockets: true,
                            isHalalCertified: false,
                        },
                    ],
                },
            },
        ])

        expect(result.cafes.length).toBe(1)
        expect(result.cafes[0].title).toBe("Cafe Uno")
        expect(result.cafes[0].lat).toBe(10.3157)
        expect(result.cafes[0].lng).toBe(123.8854)
        expect(result.cardContext?.title).toBe("Cebu")
    })
})
