import { z } from "zod"

export const crawlItemSchema = z.object({
    cafeId: z.string().uuid(),
    note: z.string().max(200).optional(),
    sortOrder: z.number().int().min(0).optional(),
})

export const createCafeCrawlSchema = z.object({
    title: z.string().min(1, "Title is required").max(100),
    description: z.string().max(500).optional(),
    coverImage: z.string().url().optional(),
    isPublic: z.boolean().optional(),
    status: z.enum(["draft", "published", "archived"]).optional(),
    items: z.array(crawlItemSchema).optional(),
})

export const updateCafeCrawlSchema = createCafeCrawlSchema.partial()

export const reorderCafeCrawlSchema = z.object({
    items: z.array(
        z.object({
            cafeId: z.string().uuid(),
            sortOrder: z.number().int().min(0),
        })
    ).min(1, "At least one item is required"),
})

export type CreateCafeCrawlInput = z.infer<typeof createCafeCrawlSchema>
export type UpdateCafeCrawlInput = z.infer<typeof updateCafeCrawlSchema>
export type ReorderCafeCrawlInput = z.infer<typeof reorderCafeCrawlSchema>
