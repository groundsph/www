import { describe, it, expect, beforeEach, mock } from "bun:test"

// Mock next/headers before importing anything that uses it
mock.module("next/headers", () => ({
    cookies: () => Promise.resolve({
        get: (name: string) => name === "chat_session_id" ? { value: "test-session-id" } : undefined,
        set: () => {},
    }),
    headers: () => Promise.resolve(new Map()),
}))

// Mock auth module
mock.module("@/lib/auth", () => ({
    getCurrentUser: () => Promise.resolve(null),
}))

// Mock chat-session
mock.module("@/utils/chat-session", () => ({
    getOrCreateChatSessionId: () => Promise.resolve("test-session-id"),
}))

// Mock chat-rate-limit
const mockCheckChatLimit = mock(() => Promise.resolve({ canSend: true, remaining: 9 }))
const mockIncrementChatUsage = mock(() => Promise.resolve())

mock.module("@/utils/chat-rate-limit", () => ({
    checkChatLimit: mockCheckChatLimit,
    incrementChatUsage: mockIncrementChatUsage,
}))

// Mock chat-tools
const mockRunChatWithTools = mock(() => Promise.resolve({ message: "Hello!" }))

mock.module("@/utils/ai/chat-tools", () => ({
    runChatWithTools: mockRunChatWithTools,
}))

// Import after mocking
const { sendChatMessage } = await import("@/app/api/actions/chat")

describe("sendChatMessage", () => {
    beforeEach(() => {
        mockCheckChatLimit.mockClear()
        mockIncrementChatUsage.mockClear()
        mockRunChatWithTools.mockClear()
    })

    it("returns error when rate limit exceeded", async () => {
        mockCheckChatLimit.mockImplementation(() => Promise.resolve({ canSend: false, remaining: 0 }))

        const response = await sendChatMessage({ message: "hi" })
        expect(response.success).toBe(false)
        expect(response.error).toBe("Rate limit exceeded. Please try again later.")
        expect(response.remaining).toBe(0)
    })

    it("returns success with message and remaining count", async () => {
        mockCheckChatLimit.mockImplementation(() => Promise.resolve({ canSend: true, remaining: 5 }))
        mockRunChatWithTools.mockImplementation(() => Promise.resolve({ message: "Here's what I found!" }))

        const response = await sendChatMessage({ message: "Find cafes in Manila" })
        expect(response.success).toBe(true)
        expect(response.message).toBe("Here's what I found!")
        expect(response.remaining).toBe(4)
    })

    it("calls AI tools with correct parameters", async () => {
        mockCheckChatLimit.mockImplementation(() => Promise.resolve({ canSend: true, remaining: 8 }))

        await sendChatMessage({ message: "Find cafes in Cebu" })

        expect(mockRunChatWithTools).toHaveBeenCalledWith({
            message: "Find cafes in Cebu",
            sessionId: "test-session-id",
        })
    })

    it("increments usage after successful AI call", async () => {
        mockCheckChatLimit.mockImplementation(() => Promise.resolve({ canSend: true, remaining: 7 }))

        await sendChatMessage({ message: "Hello" })

        expect(mockIncrementChatUsage).toHaveBeenCalledWith("test-session-id")
    })
})
