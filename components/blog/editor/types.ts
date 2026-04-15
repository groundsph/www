import { BlogCategory } from "@/utils/types/blog"

export interface RichBlogEditorProps {
    post?: {
        id: string
        title: string
        slug: string
        content: string
        excerpt?: string | null
        cover_image?: string | null
        category: BlogCategory
        status?: string | null
        tags?: string[] | null
        featured?: boolean | null
        images?: string[] | null
        tagged_cafe_ids?: string[] | null
        crawl_id?: string | null
    }
    cafeId?: string
    cafeName?: string
    onSuccess?: (slug: string) => void
    onCancel?: () => void
    allowedCategories?: BlogCategory[]
    showTags?: boolean
    showCafePicker?: boolean
    showCrawlPicker?: boolean
    showFeatured?: boolean
    showSlug?: boolean
    mode?: "full" | "community"
}

export type SaveStatus = "idle" | "saving" | "saved" | "error"

export interface AutoSaveState {
    status: SaveStatus
    lastSaved?: Date
    error?: string
}
