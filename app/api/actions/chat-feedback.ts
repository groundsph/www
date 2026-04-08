"use server"

import { db } from "@/db"
import { chatFeedback } from "@/db/schema/tables"
import { getCurrentUser } from "@/lib/auth"
import { getChatSessionId } from "@/utils/chat-session"

export async function submitChatFeedback(
    messageId: string,
    rating: 1 | -1,
    comment?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        // Get current user and session
        const user = await getCurrentUser()
        const sessionId = await getChatSessionId()

        if (!sessionId) {
            return { success: false, error: "No session found" }
        }

        await db.insert(chatFeedback).values({
            messageId,
            sessionId,
            userId: user?.id || null,
            rating,
            comment: comment || null,
        })

        return { success: true }
    } catch (error) {
        console.error("Failed to save chat feedback:", error)
        return { success: false, error: "Failed to save feedback" }
    }
}
