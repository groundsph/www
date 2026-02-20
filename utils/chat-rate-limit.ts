import { eq } from "drizzle-orm"
import { db } from "@/db"
import { chatRateLimits } from "@/db/schema/chat-rate-limit"

const MAX_USAGE = 10
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export async function incrementChatUsage(sessionId: string): Promise<void> {
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
        await db
            .update(chatRateLimits)
            .set({
                usedCount: 1,
                windowStartedAt: now,
                updatedAt: now,
            })
            .where(eq(chatRateLimits.sessionId, sessionId))
    } else {
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
    const now = new Date()

    const existing = await db.query.chatRateLimits.findFirst({
        where: eq(chatRateLimits.sessionId, sessionId),
    })

    if (!existing) {
        return MAX_USAGE
    }

    const windowStart = new Date(existing.windowStartedAt)
    const windowExpired = now.getTime() - windowStart.getTime() > SESSION_DURATION_MS

    if (windowExpired) {
        return MAX_USAGE
    }

    return Math.max(0, MAX_USAGE - existing.usedCount)
}
