"use server"

import { db } from "@/db"
import { chatConversations, chatMessages } from "@/db/schema/chat"
import { getCurrentUser } from "@/lib/auth"
import { eq } from "drizzle-orm"

export async function createConversation(sessionId: string): Promise<string> {
    const user = await getCurrentUser()
    const [conv] = await db
        .insert(chatConversations)
        .values({ sessionId, userId: user?.id || null })
        .returning({ id: chatConversations.id })
    return conv.id
}

export async function saveMessage(
    conversationId: string,
    role: string,
    content: string | null,
    toolCalls?: unknown,
    toolCallId?: string
): Promise<void> {
    await db.insert(chatMessages).values({
        conversationId,
        role,
        content,
        toolCalls: toolCalls || null,
        toolCallId: toolCallId || null,
    })
}

export async function endConversation(conversationId: string): Promise<void> {
    await db
        .update(chatConversations)
        .set({ endedAt: new Date() })
        .where(eq(chatConversations.id, conversationId))
}
