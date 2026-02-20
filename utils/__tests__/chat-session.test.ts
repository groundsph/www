import { describe, it, expect, beforeEach, mock } from "bun:test"

// Track cookie operations for verification
const cookieStore: Map<string, string> = new Map()

// Mock next/headers before importing the module under test
mock.module("next/headers", () => ({
	cookies: () =>
		Promise.resolve({
			get: (name: string) => {
				const value = cookieStore.get(name)
				return value ? { name, value } : undefined
			},
			set: (name: string, value: string) => {
				cookieStore.set(name, value)
			},
			delete: (name: string) => {
				cookieStore.delete(name)
			},
		}),
}))

// Import the actual functions after mocking
const { getOrCreateChatSessionId } = await import("@/utils/chat-session")

describe("getOrCreateChatSessionId", () => {
	beforeEach(() => {
		// Clear cookie store between tests
		cookieStore.clear()
	})

	it("creates a new session id when missing", async () => {
		// Pass null to simulate no existing session
		const sessionId = await getOrCreateChatSessionId(null)

		expect(sessionId.length).toBeGreaterThan(10)
		expect(typeof sessionId).toBe("string")
	})

	it("returns existing session id when provided", async () => {
		const existingId = "existing-session-123"
		const sessionId = await getOrCreateChatSessionId(existingId)

		expect(sessionId).toBe(existingId)
	})

	it("generates unique session ids each time", async () => {
		const sessionId1 = await getOrCreateChatSessionId(null)
		const sessionId2 = await getOrCreateChatSessionId(null)

		expect(sessionId1).not.toBe(sessionId2)
		expect(sessionId1.length).toBeGreaterThan(10)
		expect(sessionId2.length).toBeGreaterThan(10)
	})
})
