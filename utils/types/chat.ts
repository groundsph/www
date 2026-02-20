import { z } from "zod"

export const chatRequestSchema = z.object({
    message: z.string().min(1).max(2000),
    sessionId: z.string().min(8),
})

export const chatResponseSchema = z.object({
    success: z.boolean(),
    message: z.string().optional(),
    remaining: z.number().int().min(0),
    error: z.string().optional(),
    data: z.unknown().optional(),
})

export type ChatRequest = z.infer<typeof chatRequestSchema>
export type ChatResponse = z.infer<typeof chatResponseSchema>
