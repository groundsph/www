import { z } from "zod"

export const crawlItemSchema = z.object({
    cafeId: z.string().uuid(),
    note: z.string().max(200).optional(),
    sortOrder: z.number().int().min(0).optional(),
})

export const cafeCrawlSchema = z.object({
    id: z.string(),
    userId: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    coverImage: z.string().nullable(),
    isPublic: z.boolean(),
    status: z.enum(["draft", "published", "archived"]),
    createdAt: z.string(),
    updatedAt: z.string(),
})

export const cafeCrawlItemSchema = z.object({
    id: z.string(),
    crawlId: z.string(),
    cafeId: z.string(),
    note: z.string().nullable(),
    sortOrder: z.number(),
    createdAt: z.string(),
})

export type CafeCrawl = z.infer<typeof cafeCrawlSchema>
export type CafeCrawlItem = z.infer<typeof cafeCrawlItemSchema>
export type CrawlItem = z.infer<typeof crawlItemSchema>

export interface CafeCrawlWithItems extends CafeCrawl {
    items?: CafeCrawlItem[]
}
