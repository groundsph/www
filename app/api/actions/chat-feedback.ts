"use server"

import { z } from "zod"

const feedbackSchema = z.object({
    messageId: z.string(),
    feedback: z.enum(["positive", "negative"]),
    messageContent: z.string().max(500),
})

export async function submitChatFeedback(
    input: z.infer<typeof feedbackSchema>
): Promise<{ success: boolean; error?: string }> {
    try {
        const parsed = feedbackSchema.parse(input)

        // Log to console for now -- can be stored in DB later
        console.log(`[Chat Feedback] ${parsed.feedback}: ${parsed.messageId}`)

        return { success: true }
    } catch (error) {
        console.error("Chat feedback error:", error)
        return { success: false, error: "Failed to submit feedback" }
    }
}
