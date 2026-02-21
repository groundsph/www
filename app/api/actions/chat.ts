"use server"

import { getCurrentUser } from "@/lib/auth"
import { getOrCreateChatSessionId } from "@/utils/chat-session"
import { checkChatLimit, incrementChatUsage } from "@/utils/chat-rate-limit"
import { runChatWithTools } from "@/utils/ai/chat-tools"
import { getChatEnabled } from "@/utils/feature-flags"
import type { ChatCafeCard, ChatCardContext } from "@/utils/types/chat"
import { z } from "zod"

const sendChatMessageSchema = z.object({
    message: z.string().min(1).max(2000),
})

export interface SendChatMessageInput {
    message: string
}

export interface SendChatMessageResult {
    success: boolean
    message?: string
    remaining: number
    error?: string
    cafes?: ChatCafeCard[]
    cardContext?: ChatCardContext
}

export async function sendChatMessage(
    input: SendChatMessageInput
): Promise<SendChatMessageResult> {
    try {
        // Validate input
        const validated = sendChatMessageSchema.safeParse(input)
        if (!validated.success) {
            return {
                success: false,
                remaining: 10,
                error: "Invalid message. Message must be between 1 and 2000 characters.",
            }
        }

        // Check if chat is enabled
        if (!(await getChatEnabled())) {
            return {
                success: false,
                remaining: 0,
                error: "Chat is temporarily unavailable.",
            }
        }

        // Get current user (if authenticated) for user-linked session
        const user = await getCurrentUser()

        // Get or create session ID - use user ID if authenticated, otherwise use cookie
        const sessionId = user?.id ?? await getOrCreateChatSessionId(null)

        // Check rate limit
        const { canSend, remaining } = await checkChatLimit(sessionId)

        if (!canSend) {
            return {
                success: false,
                remaining: 0,
                error: "Rate limit exceeded. Please try again later.",
            }
        }

        // Call AI with tools
        const result = await runChatWithTools({
            message: validated.data.message,
            sessionId,
        })

        // Increment usage count after successful AI call
        await incrementChatUsage(sessionId)

        // Calculate remaining after increment
        const remainingAfter = remaining - 1

        return {
            success: true,
            message: result.message,
            remaining: Math.max(0, remainingAfter),
        }
    } catch (error) {
        console.error("Error in sendChatMessage:", error)
        return {
            success: false,
            remaining: 0,
            error: "An error occurred while processing your message. Please try again.",
        }
    }
}
