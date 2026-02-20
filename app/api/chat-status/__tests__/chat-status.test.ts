import { describe, it, expect, mock } from "bun:test"

const mockGetChatEnabled = mock(() => Promise.resolve(true))

mock.module("@/utils/feature-flags", () => ({
    getChatEnabled: mockGetChatEnabled,
}))

const { GET } = await import("@/app/api/chat-status/route")

describe("GET /api/chat-status", () => {
    it("returns enabled true", async () => {
        mockGetChatEnabled.mockImplementation(() => Promise.resolve(true))
        const response = await GET()
        const json = await response.json()
        expect(json.enabled).toBe(true)
    })

    it("returns enabled false", async () => {
        mockGetChatEnabled.mockImplementation(() => Promise.resolve(false))
        const response = await GET()
        const json = await response.json()
        expect(json.enabled).toBe(false)
    })
})
