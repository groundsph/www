import { NextRequest } from "next/server"
import { runChatStream } from "@/utils/ai/chat-stream"
import { getCurrentUser } from "@/lib/auth"
import { getOrCreateChatSessionId } from "@/utils/chat-session"
import { checkChatLimit, incrementChatUsage } from "@/utils/chat-rate-limit"
import { getChatEnabled } from "@/utils/feature-flags"
import { chatContextSchema } from "@/utils/types/chat"
import { moderateMessage } from "@/utils/chat-moderation"
import { z } from "zod"

const requestSchema = z.object({
    message: z.string().min(1).max(2000),
    sessionId: z.string().min(8).optional(),
    context: chatContextSchema.optional(),
    history: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
    })).max(10).optional(),
})

export async function POST(request: NextRequest) {
    try {
        // Check if chat is enabled
        if (!(await getChatEnabled())) {
            return new Response(
                JSON.stringify({ type: "error", error: "Chat is temporarily unavailable" }),
                { status: 503, headers: { "Content-Type": "application/json" } }
            )
        }

        // Parse request
        const body = await request.json()
        const validated = requestSchema.safeParse(body)
        if (!validated.success) {
            return new Response(
                JSON.stringify({ type: "error", error: "Invalid message" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            )
        }

        // Moderate message content
        const moderation = moderateMessage(validated.data.message)
        if (!moderation.allowed) {
            return new Response(
                JSON.stringify({ type: "error", error: moderation.reason }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            )
        }

        // Get user and session
        const user = await getCurrentUser()
        const sessionId = user?.id ?? (await getOrCreateChatSessionId(null))

        // Check rate limit
        const { canSend, remaining } = await checkChatLimit(sessionId)
        if (!canSend) {
            return new Response(
                JSON.stringify({ type: "error", error: "Rate limit exceeded" }),
                { status: 429, headers: { "Content-Type": "application/json" } }
            )
        }

        // Create streaming response
        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder()

                try {
                    await runChatStream({
                        message: validated.data.message,
                        sessionId,
                        context: validated.data.context,
                        history: validated.data.history,
                        onChunk: async (chunk) => {
                            const data = JSON.stringify(chunk)
                            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
                        },
                    })

                    // Increment usage after successful completion
                    await incrementChatUsage(sessionId)

                    // Send final remaining count
                    // Handle Infinity for dev mode (JSON doesn't support Infinity)
                    const finalRemaining = remaining === Infinity ? 1000 : Math.max(0, remaining - 1)
                    const finalChunk = JSON.stringify({
                        type: "remaining",
                        remaining: finalRemaining,
                    })
                    controller.enqueue(encoder.encode(`data: ${finalChunk}\n\n`))
                } catch (error) {
                    console.error("Stream error:", error)
                    const errorChunk = JSON.stringify({
                        type: "error",
                        error: "Stream processing failed",
                    })
                    controller.enqueue(encoder.encode(`data: ${errorChunk}\n\n`))
                } finally {
                    controller.close()
                }
            },
        })

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        })
    } catch (error) {
        console.error("API error:", error)
        return new Response(
            JSON.stringify({ type: "error", error: "Internal server error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        )
    }
}