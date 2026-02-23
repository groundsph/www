import { z } from "zod"

export const chatCafeCardSchema = z.object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    coverImageUrl: z.string().nullable(),
    city: z.string().nullable().optional(),
    province: z.string().nullable().optional(),
    rating: z.number().nullable().optional(),
    reviewCount: z.number().nullable().optional(),
    filters: z.array(z.string()).optional(),
    flags: z.array(z.string()).optional(),
    custom: z.string().optional(),
    lat: z.number().nullable().optional(),
    lng: z.number().nullable().optional(),
})

export const chatContextSchema = z.object({
    pathname: z.string().optional(),
    pageTitle: z.string().optional(),
    cafeSlug: z.string().optional(),
    crawlSlug: z.string().optional(),
    location: z.object({
        lat: z.number().optional(),
        lng: z.number().optional(),
        city: z.string().optional(),
        region: z.string().optional(),
        isEstimate: z.boolean().optional(),
    }).optional(),
    navigationHistory: z.array(z.string()).optional(),
    uiContext: z.record(z.string(), z.unknown()).optional(),
    recentCafes: z.array(chatCafeCardSchema).optional(),
    recentToolCalls: z.array(z.object({
        toolName: z.string(),
        params: z.unknown(),
        result: z.unknown(),
    })).optional(),
})

export const chatRequestSchema = z.object({
    message: z.string().min(1).max(2000),
    sessionId: z.string().min(8),
    context: chatContextSchema.optional(),
})

export const chatCardContextSchema = z.object({
    queryType: z.enum(["search", "nearby", "top_rated", "details", "compare", "unknown"]),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    custom: z.string().optional(),
    filters: z.array(z.string()).optional(),
})

export const chatCrawlItemSchema = z.object({
    cafeId: z.string(),
    name: z.string(),
    slug: z.string(),
    thumbnail: z.string().nullable(),
    cityMunicipality: z.string().nullable().optional(),
    region: z.string().nullable().optional(),
    lat: z.number().nullable().optional(),
    lng: z.number().nullable().optional(),
    sortOrder: z.number().int(),
    note: z.string().nullable().optional(),
})

export const chatCrawlDraftSchema = z.object({
    title: z.string(),
    description: z.string().optional(),
    isPublic: z.boolean().optional(),
    items: z.array(chatCrawlItemSchema),
})

export const chatResponseSchema = z.object({
    success: z.boolean(),
    message: z.string().optional(),
    remaining: z.number().int().min(0),
    error: z.string().optional(),
    data: z.unknown().optional(),
    cafes: z.array(chatCafeCardSchema).optional(),
    cardContext: chatCardContextSchema.optional(),
    crawlDraft: chatCrawlDraftSchema.optional(),
    debug: z
        .object({
            maxCalls: z.number().int(),
            callCount: z.number().int(),
            reason: z.enum(["no_response", "max_tool_calls", "error"]).optional(),
            lastAssistantContent: z.string().nullable().optional(),
            toolCalls: z
                .array(
                    z.object({
                        toolName: z.string(),
                        params: z.unknown(),
                    })
                )
                .optional(),
        })
        .optional(),
})

export type ChatRequest = z.infer<typeof chatRequestSchema>
export type ChatContext = z.infer<typeof chatContextSchema>
export type ChatResponse = z.infer<typeof chatResponseSchema>
export type ChatCafeCard = z.infer<typeof chatCafeCardSchema>
export type ChatCardContext = z.infer<typeof chatCardContextSchema>
export type ChatCrawlDraft = z.infer<typeof chatCrawlDraftSchema>
export type ChatCrawlItem = z.infer<typeof chatCrawlItemSchema>

// Streaming chunk types
export const chatStreamChunkSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("progress"),
        message: z.string(),
        step: z.number().int().optional(),
    }),
    z.object({
        type: z.literal("tool"),
        toolName: z.string(),
        params: z.unknown(),
    }),
    z.object({
        type: z.literal("cafes"),
        cafes: z.array(chatCafeCardSchema),
        cardContext: chatCardContextSchema.optional(),
    }),
    z.object({
        type: z.literal("crawlDraft"),
        crawlDraft: chatCrawlDraftSchema,
    }),
    z.object({
        type: z.literal("complete"),
        message: z.string(),
        remaining: z.number().int(),
    }),
    z.object({
        type: z.literal("error"),
        error: z.string(),
    }),
    z.object({
        type: z.literal("remaining"),
        remaining: z.number().int(),
    }),
])

export type ChatStreamChunk = z.infer<typeof chatStreamChunkSchema>
