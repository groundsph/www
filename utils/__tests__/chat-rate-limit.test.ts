import { describe, it, expect, mock, beforeEach } from "bun:test"

// In-memory store for rate limit data
interface RateLimitRecord {
    sessionId: string
    usedCount: number
    windowStartedAt: Date
    updatedAt: Date
}

let mockRateLimitStore: Map<string, RateLimitRecord> = new Map()

// Track the last where clause for update operations
let lastUpdateWhere: { sessionId: string } | null = null

// Mock drizzle-orm eq function
mock.module("drizzle-orm", () => ({
    eq: (left: unknown, right: string) => ({
        left,
        right,
        _: { value: right },
        toString: () => right,
    }),
    and: (...conditions: unknown[]) => ({ conditions }),
    or: (...conditions: unknown[]) => ({ conditions }),
    desc: (column: unknown) => ({ column, direction: "desc" }),
    asc: (column: unknown) => ({ column, direction: "asc" }),
}))

// Mock the database
mock.module("@/db", () => ({
    db: {
        query: {
            chatRateLimits: {
                findFirst: ({ where }: { where: { right?: string; _?: { value?: string } } }) => {
                    const sessionId = where?._?.value || where?.right
                    if (!sessionId) return Promise.resolve(null)
                    const record = mockRateLimitStore.get(sessionId)
                    return Promise.resolve(record || null)
                },
            },
        },
        insert: () => ({
            values: (data: RateLimitRecord) => {
                mockRateLimitStore.set(data.sessionId, { ...data })
                return {
                    returning: () => Promise.resolve([data]),
                }
            },
        }),
        update: () => ({
            set: (data: Partial<RateLimitRecord>) => ({
                where: (whereClause: { right?: string; _?: { value?: string } }) => {
                    const sessionId = whereClause?._?.value || whereClause?.right
                    if (!sessionId) return Promise.resolve([])
                    const existing = mockRateLimitStore.get(sessionId)
                    if (existing) {
                        mockRateLimitStore.set(sessionId, { ...existing, ...data })
                    }
                    return Promise.resolve([{ ...existing, ...data }])
                },
            }),
        }),
    },
}))

// Reset store before each test
const resetStore = () => {
    mockRateLimitStore = new Map()
    lastUpdateWhere = null
}

// Import functions after mocking
const { incrementChatUsage, getChatRemaining } = await import(
    "@/utils/chat-rate-limit"
)

describe("chat-rate-limit", () => {
    beforeEach(() => {
        resetStore()
    })

    it("enforces 10 per session", async () => {
        const sessionId = "test-session"
        for (let i = 0; i < 10; i++) {
            await incrementChatUsage(sessionId)
        }
        const remaining = await getChatRemaining(sessionId)
        expect(remaining).toBe(0)
    })

    it("throws RateLimitExceededError on 11th request", async () => {
        const sessionId = "test-session"
        for (let i = 0; i < 10; i++) {
            await incrementChatUsage(sessionId)
        }
        expect(incrementChatUsage(sessionId)).rejects.toThrow()
    })

    it("resets window after 7 days", async () => {
        const sessionId = "test-session"
        // Use up all 10 requests
        for (let i = 0; i < 10; i++) {
            await incrementChatUsage(sessionId)
        }

        // Simulate time passing by updating the record's windowStartedAt
        const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
        mockRateLimitStore.set(sessionId, {
            sessionId,
            usedCount: 10,
            windowStartedAt: eightDaysAgo,
            updatedAt: eightDaysAgo,
        })

        // Should be able to send again
        await incrementChatUsage(sessionId)
        const remaining = await getChatRemaining(sessionId)
        expect(remaining).toBe(9)
    })

    it("returns 10 for new session", async () => {
        const sessionId = "new-session"
        const remaining = await getChatRemaining(sessionId)
        expect(remaining).toBe(10)
    })

    it("validates sessionId length", async () => {
        await expect(incrementChatUsage("short")).rejects.toThrow("Invalid sessionId")
        await expect(getChatRemaining("short")).rejects.toThrow("Invalid sessionId")
    })

    it("validates empty sessionId", async () => {
        await expect(incrementChatUsage("")).rejects.toThrow("Invalid sessionId")
        await expect(getChatRemaining("")).rejects.toThrow("Invalid sessionId")
    })

    it("tracks multiple sessions independently", async () => {
        const sessionA = "session-a-123"
        const sessionB = "session-b-456"

        await incrementChatUsage(sessionA)
        await incrementChatUsage(sessionA)
        await incrementChatUsage(sessionB)

        expect(await getChatRemaining(sessionA)).toBe(8)
        expect(await getChatRemaining(sessionB)).toBe(9)
    })
})
