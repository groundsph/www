import { describe, expect, it } from "bun:test"
import { chatRequestSchema, chatResponseSchema } from "@/utils/types/chat"

describe("chat schemas", () => {
    it("accepts valid request data", () => {
        const req = { message: "hi", sessionId: "abc12345" }
        const parsed = chatRequestSchema.parse(req)
        expect(parsed.message).toBe("hi")
        expect(parsed.sessionId).toBe("abc12345")
    })

    it("accepts valid response data", () => {
        const res = { success: true, message: "ok", remaining: 9 }
        const parsed = chatResponseSchema.parse(res)
        expect(parsed.success).toBe(true)
        expect(parsed.message).toBe("ok")
        expect(parsed.remaining).toBe(9)
    })

    it("accepts minimal response without optional fields", () => {
        const res = { success: true, remaining: 5 }
        const parsed = chatResponseSchema.parse(res)
        expect(parsed.success).toBe(true)
        expect(parsed.remaining).toBe(5)
        expect(parsed.message).toBeUndefined()
        expect(parsed.error).toBeUndefined()
        expect(parsed.data).toBeUndefined()
    })

    it("accepts error response", () => {
        const res = { success: false, error: "Rate limit exceeded", remaining: 0 }
        const parsed = chatResponseSchema.parse(res)
        expect(parsed.success).toBe(false)
        expect(parsed.error).toBe("Rate limit exceeded")
        expect(parsed.remaining).toBe(0)
    })

    it("rejects message that is too long", () => {
        const longMessage = "a".repeat(2001)
        const req = { message: longMessage, sessionId: "abc12345" }
        expect(() => chatRequestSchema.parse(req)).toThrow()
    })

    it("rejects empty message", () => {
        const req = { message: "", sessionId: "abc12345" }
        expect(() => chatRequestSchema.parse(req)).toThrow()
    })

    it("rejects short sessionId", () => {
        const req = { message: "hi", sessionId: "short" }
        expect(() => chatRequestSchema.parse(req)).toThrow()
    })

    it("accepts cafe cards and card context", () => {
        const res = {
            success: true,
            remaining: 9,
            cafes: [
                {
                    id: "c1",
                    slug: "demo-cafe",
                    title: "Demo Cafe",
                    coverImageUrl: "https://cdn.example.com/demo.jpg",
                    city: "Manila",
                    province: "Metro Manila",
                    rating: 4.6,
                    reviewCount: 120,
                    filters: ["WiFi", "Sockets"],
                    flags: ["Halal"],
                    custom: "Near you",
                },
            ],
            cardContext: {
                queryType: "nearby",
                title: "Near you",
                subtitle: "Based on your location",
                custom: "Near you",
            },
        }
        const parsed = chatResponseSchema.parse(res)
        expect(parsed.cafes?.length).toBe(1)
        expect(parsed.cardContext?.queryType).toBe("nearby")
    })
})
