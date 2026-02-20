import { eq } from "drizzle-orm"
import { db } from "@/db"
import { chatRateLimits } from "@/db/schema/chat-rate-limit"

const MAX_USAGE = process.env.NODE_ENV === "development" ? Infinity : 10
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// Skip rate limit in development
const isDev = process.env.NODE_ENV === "development"

export class RateLimitExceededError extends Error {
    constructor(message = "Rate limit exceeded") {
        super(message)
        this.name = "RateLimitExceededError"
    }
}

function validateSessionId(sessionId: string): void {
    if (!sessionId || typeof sessionId !== "string" || sessionId.length < 8) {
        throw new Error("Invalid sessionId")
    }
}

export async function incrementChatUsage(sessionId: string): Promise<void> {
    if (isDev) return // Skip rate limit in development

    validateSessionId(sessionId)

    const now = new Date()

    const existing = await db.query.chatRateLimits.findFirst({
        where: eq(chatRateLimits.sessionId, sessionId),
    })

    if (!existing) {
        await db.insert(chatRateLimits).values({
            sessionId,
            usedCount: 1,
            windowStartedAt: now,
            updatedAt: now,
        })
        return
    }

    const windowStart = new Date(existing.windowStartedAt)
    const windowExpired = now.getTime() - windowStart.getTime() > SESSION_DURATION_MS

    if (windowExpired) {
        // Reset window
        await db
            .update(chatRateLimits)
            .set({
                usedCount: 1,
                windowStartedAt: now,
                updatedAt: now,
            })
            .where(eq(chatRateLimits.sessionId, sessionId))
    } else {
        // Check limit before incrementing
        if (existing.usedCount >= MAX_USAGE) {
            throw new RateLimitExceededError()
        }
        await db
            .update(chatRateLimits)
            .set({
                usedCount: existing.usedCount + 1,
                updatedAt: now,
            })
            .where(eq(chatRateLimits.sessionId, sessionId))
    }
}

export async function getChatRemaining(sessionId: string): Promise<number> {
    if (isDev) return Infinity // No limit in development

    validateSessionId(sessionId)

    const now = new Date()

    const existing = await db.query.chatRateLimits.findFirst({
        where: eq(chatRateLimits.sessionId, sessionId),
    })

    if (!existing) {
        return MAX_USAGE as number
    }

    const windowStart = new Date(existing.windowStartedAt)
    const windowExpired = now.getTime() - windowStart.getTime() > SESSION_DURATION_MS

    if (windowExpired) {
        return MAX_USAGE as number
    }

    return Math.max(0, (MAX_USAGE as number) - existing.usedCount)
}

export async function checkChatLimit(sessionId: string): Promise<{ canSend: boolean; remaining: number }> {
    if (isDev) {
        return { canSend: true, remaining: Infinity }
    }

    const remaining = await getChatRemaining(sessionId)
    return {
        canSend: remaining > 0,
        remaining,
    }
}
