import { describe, it, expect } from "bun:test"
import { incrementChatUsage, getChatRemaining } from "@/utils/chat-rate-limit"

describe("chat-rate-limit", () => {
    it("enforces 10 per session", async () => {
        const sessionId = "test-session"
        for (let i = 0; i < 10; i++) {
            await incrementChatUsage(sessionId)
        }
        const remaining = await getChatRemaining(sessionId)
        expect(remaining).toBe(0)
    })
})
