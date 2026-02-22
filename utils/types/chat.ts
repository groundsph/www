import { z } from "zod"

export const chatRequestSchema = z.object({
    message: z.string().min(1).max(2000),
    sessionId: z.string().min(8),
})

export const chatCafeCardSchema = z.object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    coverImageUrl: z.string().url().nullable(),
    city: z.string().nullable().optional(),
    province: z.string().nullable().optional(),
    rating: z.number().nullable().optional(),
    reviewCount: z.number().nullable().optional(),
    filters: z.array(z.string()).optional(),
    flags: z.array(z.string()).optional(),
    custom: z.string().optional(),
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
})

export type ChatRequest = z.infer<typeof chatRequestSchema>
export type ChatResponse = z.infer<typeof chatResponseSchema>
export type ChatCafeCard = z.infer<typeof chatCafeCardSchema>
export type ChatCardContext = z.infer<typeof chatCardContextSchema>
export type ChatCrawlDraft = z.infer<typeof chatCrawlDraftSchema>
export type ChatCrawlItem = z.infer<typeof chatCrawlItemSchema>
