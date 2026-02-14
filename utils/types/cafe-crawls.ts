import { z } from "zod"
import { crawlItemSchema } from "@/utils/validation/cafe-crawls"

export const cafeCrawlSchema = z.object({
    id: z.string(),
    userId: z.string(),
    title: z.string(),
    description: z.string().optional(),
    coverImage: z.string().optional(),
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

export interface Crawl {
    id: string
    title: string
    slug: string
    coverImage?: string | null
    itemCount?: number
    viewsCount?: number
    savesCount?: number
    likesCount?: number
    createdAt?: string
    author?: {
        id: string
        username: string
        displayName: string
        avatarUrl: string | null
    }
}
