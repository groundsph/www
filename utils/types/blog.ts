import { Database, Json } from "./database.types"

// Database types
export type BlogPostRow = Database["public"]["Tables"]["blog_posts"]["Row"]
export type BlogPostInsert = Database["public"]["Tables"]["blog_posts"]["Insert"]
export type BlogPostUpdate = Database["public"]["Tables"]["blog_posts"]["Update"]

// Enum types from database
export type BlogStatus = Database["public"]["Enums"]["blog_status"]
export type BlogCategory = Database["public"]["Enums"]["blog_category"]

// Extended blog post with author and cafe info
export interface BlogPost extends Omit<BlogPostRow, "search_vector"> {
    author?: {
        id: string
        display_name: string
        avatar_url: string | null
        username: string
    } | null
    cafe?: {
        id: string
        name: string
        slug: string
        thumbnail: string
    } | null
    llm_review: Json | null
}

// Input for creating/updating blog posts
export interface BlogPostInput {
    title: string
    slug?: string
    excerpt?: string
    content: string
    cover_image?: string | null
    cafe_id?: string | null
    category: BlogCategory
    status: BlogStatus
    tags?: string[]
    featured?: boolean
    images?: string[]
    tagged_cafe_ids?: string[]
    crawl_id?: string | null
}

// Blog category metadata
export const BLOG_CATEGORIES: {
    value: BlogCategory
    label: string
    description: string
    ownerAllowed: boolean
}[] = [
        {
            value: "news",
            label: "News",
            description: "Platform announcements and updates",
            ownerAllowed: false,
        },
        {
            value: "guides",
            label: "Guides",
            description: "Coffee brewing guides and tips",
            ownerAllowed: false,
        },
        {
            value: "events",
            label: "Events",
            description: "Cafe events and community gatherings",
            ownerAllowed: true,
        },
        {
            value: "promotions",
            label: "Promotions",
            description: "Special offers and deals",
            ownerAllowed: true,
        },
        {
            value: "community",
            label: "Community",
            description: "Community spotlights and stories",
            ownerAllowed: false,
        },
        {
            value: "cafe_update",
            label: "Cafe Update",
            description: "Updates from specific cafes",
            ownerAllowed: true,
        },
    ]

// Blog status metadata
export const BLOG_STATUSES: {
    value: BlogStatus
    label: string
    color: string
}[] = [
        { value: "pending", label: "Pending", color: "text-orange-600 bg-orange-100" },
        { value: "draft", label: "Draft", color: "text-yellow-600 bg-yellow-100" },
        {
            value: "published",
            label: "Published",
            color: "text-green-600 bg-green-100",
        },
        { value: "archived", label: "Archived", color: "text-gray-600 bg-gray-100" },
    ]

// Helper to generate slug from title
export function generateSlug(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .substring(0, 100)
}

// Helper to estimate reading time
export function estimateReadingTime(content: string): number {
    const wordsPerMinute = 200
    const wordCount = content.split(/\s+/).length
    return Math.ceil(wordCount / wordsPerMinute)
}
