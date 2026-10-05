/**
 * Block-based blog content model.
 *
 * A blog post's body is an ordered array of typed blocks. Text lives in
 * markdown inside `text` blocks, while media/entities (images, cafes, crawls)
 * are first-class blocks so they can be edited, reordered and rendered
 * independently.
 *
 * The legacy `blog_posts.content` markdown column is kept as a *derived
 * projection* of the textual blocks so search, RSS, SEO, excerpt generation
 * and old renderers keep working.
 */

export type BlogBlockType =
    | "text"
    | "heading"
    | "divider"
    | "image"
    | "gallery"
    | "cafe"
    | "cafe-carousel"
    | "callout"
    | "quote"
    | "embed"
    | "link-card"
    | "code"
    | "map"
    | "crawl"

export type CalloutVariant = "info" | "tip" | "warning" | "success"

export type EmbedProvider = "youtube" | "vimeo" | "link"

export interface GalleryImage {
    url: string
    caption?: string
}

interface BlockBase {
    /** Stable id used for React keys and reordering. */
    id: string
}

export interface TextBlock extends BlockBase {
    type: "text"
    /** Markdown body. */
    content: string
}

export interface HeadingBlock extends BlockBase {
    type: "heading"
    text: string
    level: 2 | 3
}

export interface DividerBlock extends BlockBase {
    type: "divider"
}

export interface ImageBlock extends BlockBase {
    type: "image"
    url: string
    alt?: string
    caption?: string
}

export interface GalleryBlock extends BlockBase {
    type: "gallery"
    images: GalleryImage[]
    title?: string
}

export interface CafeBlock extends BlockBase {
    type: "cafe"
    cafeId: string
    note?: string
}

export interface CafeCarouselBlock extends BlockBase {
    type: "cafe-carousel"
    cafeIds: string[]
    title?: string
}

export interface CalloutBlock extends BlockBase {
    type: "callout"
    variant: CalloutVariant
    title?: string
    /** Markdown body. */
    content: string
}

export interface QuoteBlock extends BlockBase {
    type: "quote"
    /** Markdown body. */
    content: string
    attribution?: string
}

export interface EmbedBlock extends BlockBase {
    type: "embed"
    url: string
    provider?: EmbedProvider
    title?: string
    description?: string
    thumbnail?: string
}

export interface LinkCardBlock extends BlockBase {
    type: "link-card"
    url: string
    title?: string
    description?: string
    image?: string
    label?: string
}

export interface CodeBlock extends BlockBase {
    type: "code"
    language: string
    code: string
}

export interface MapBlock extends BlockBase {
    type: "map"
    cafeIds: string[]
    title?: string
    caption?: string
}

export interface CrawlBlock extends BlockBase {
    type: "crawl"
    crawlId: string
}

export type BlogBlock =
    | TextBlock
    | HeadingBlock
    | DividerBlock
    | ImageBlock
    | GalleryBlock
    | CafeBlock
    | CafeCarouselBlock
    | CalloutBlock
    | QuoteBlock
    | EmbedBlock
    | LinkCardBlock
    | CodeBlock
    | MapBlock
    | CrawlBlock

/** Block types that can be created from the editor's "add block" menu. */
export const ADDABLE_BLOCK_TYPES: BlogBlockType[] = [
    "text",
    "heading",
    "image",
    "gallery",
    "cafe",
    "cafe-carousel",
    "callout",
    "quote",
    "embed",
    "link-card",
    "code",
    "map",
    "crawl",
    "divider",
]

type RandomSource = { randomUUID?: () => string }

/** Generate a stable, collision-resistant block id. */
export function createBlockId(): string {
    const cryptoObj = (globalThis as { crypto?: RandomSource }).crypto
    if (cryptoObj?.randomUUID) return cryptoObj.randomUUID()
    return `blk_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

/** Create a new, empty block of the given type. */
export function createBlock(type: BlogBlockType): BlogBlock {
    const id = createBlockId()
    switch (type) {
        case "text":
            return { id, type, content: "" }
        case "heading":
            return { id, type, text: "", level: 2 }
        case "divider":
            return { id, type }
        case "image":
            return { id, type, url: "" }
        case "gallery":
            return { id, type, images: [] }
        case "cafe":
            return { id, type, cafeId: "" }
        case "cafe-carousel":
            return { id, type, cafeIds: [] }
        case "callout":
            return { id, type, variant: "info", content: "" }
        case "quote":
            return { id, type, content: "" }
        case "embed":
            return { id, type, url: "" }
        case "link-card":
            return { id, type, url: "" }
        case "code":
            return { id, type, language: "text", code: "" }
        case "map":
            return { id, type, cafeIds: [] }
        case "crawl":
            return { id, type, crawlId: "" }
    }
}

// ---------------------------------------------------------------------------
// Parsing / normalization (DB jsonb is untrusted input)
// ---------------------------------------------------------------------------

const VALID_TYPES = new Set<BlogBlockType>(ADDABLE_BLOCK_TYPES)

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string {
    return typeof value === "string" ? value : ""
}

function asOptionalString(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined
}

function asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return []
    return value.filter((v): v is string => typeof v === "string")
}

function asGalleryImages(value: unknown): GalleryImage[] {
    if (!Array.isArray(value)) return []
    return value
        .filter(isRecord)
        .map((img) => ({ url: asString(img.url), caption: asOptionalString(img.caption) }))
        .filter((img) => img.url.length > 0)
}

function normalizeBlock(raw: unknown): BlogBlock | null {
    if (!isRecord(raw)) return null
    const type = raw.type
    if (typeof type !== "string" || !VALID_TYPES.has(type as BlogBlockType)) {
        return null
    }
    const id = asString(raw.id) || createBlockId()

    switch (type as BlogBlockType) {
        case "text":
            return { id, type: "text", content: asString(raw.content) }
        case "heading": {
            const level = raw.level === 3 ? 3 : 2
            return { id, type: "heading", text: asString(raw.text), level }
        }
        case "divider":
            return { id, type: "divider" }
        case "image": {
            const url = asString(raw.url)
            if (!url) return null
            return {
                id,
                type: "image",
                url,
                alt: asOptionalString(raw.alt),
                caption: asOptionalString(raw.caption),
            }
        }
        case "gallery": {
            const images = asGalleryImages(raw.images)
            if (images.length === 0) return null
            return { id, type: "gallery", images, title: asOptionalString(raw.title) }
        }
        case "cafe": {
            const cafeId = asString(raw.cafeId)
            if (!cafeId) return null
            return { id, type: "cafe", cafeId, note: asOptionalString(raw.note) }
        }
        case "cafe-carousel": {
            const cafeIds = asStringArray(raw.cafeIds)
            if (cafeIds.length === 0) return null
            return {
                id,
                type: "cafe-carousel",
                cafeIds,
                title: asOptionalString(raw.title),
            }
        }
        case "callout": {
            const variant = (["info", "tip", "warning", "success"] as const).includes(
                raw.variant as CalloutVariant
            )
                ? (raw.variant as CalloutVariant)
                : "info"
            return {
                id,
                type: "callout",
                variant,
                title: asOptionalString(raw.title),
                content: asString(raw.content),
            }
        }
        case "quote":
            return {
                id,
                type: "quote",
                content: asString(raw.content),
                attribution: asOptionalString(raw.attribution),
            }
        case "embed": {
            const url = asString(raw.url)
            if (!url) return null
            const provider = (["youtube", "vimeo", "link"] as const).includes(
                raw.provider as EmbedProvider
            )
                ? (raw.provider as EmbedProvider)
                : inferEmbedProvider(url)
            return {
                id,
                type: "embed",
                url,
                provider,
                title: asOptionalString(raw.title),
                description: asOptionalString(raw.description),
                thumbnail: asOptionalString(raw.thumbnail),
            }
        }
        case "link-card": {
            const url = asString(raw.url)
            if (!url) return null
            return {
                id,
                type: "link-card",
                url,
                title: asOptionalString(raw.title),
                description: asOptionalString(raw.description),
                image: asOptionalString(raw.image),
                label: asOptionalString(raw.label),
            }
        }
        case "code":
            return {
                id,
                type: "code",
                language: asString(raw.language) || "text",
                code: asString(raw.code),
            }
        case "map": {
            const cafeIds = asStringArray(raw.cafeIds)
            if (cafeIds.length === 0) return null
            return {
                id,
                type: "map",
                cafeIds,
                title: asOptionalString(raw.title),
                caption: asOptionalString(raw.caption),
            }
        }
        case "crawl": {
            const crawlId = asString(raw.crawlId)
            if (!crawlId) return null
            return { id, type: "crawl", crawlId }
        }
        default:
            return null
    }
}

/**
 * Coerce arbitrary jsonb content into a safe, typed block array.
 * Invalid blocks are dropped rather than throwing.
 */
export function normalizeBlocks(raw: unknown): BlogBlock[] {
    if (!Array.isArray(raw)) return []
    const blocks: BlogBlock[] = []
    for (const entry of raw) {
        const block = normalizeBlock(entry)
        if (block) blocks.push(block)
    }
    return blocks
}

/** Detect the embed provider for a URL. */
export function inferEmbedProvider(url: string): EmbedProvider {
    if (/youtu\.?be/i.test(url)) return "youtube"
    if (/vimeo\.com/i.test(url)) return "vimeo"
    return "link"
}

/** Extract a YouTube/Vimeo video id from a URL, if any. */
export function extractVideoId(url: string): string | null {
    const youtubePatterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{6,})/i,
    ]
    for (const pattern of youtubePatterns) {
        const match = url.match(pattern)
        if (match?.[1]) return match[1]
    }
    const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i)
    return vimeo?.[1] ?? null
}

// ---------------------------------------------------------------------------
// Markdown projection
// ---------------------------------------------------------------------------

function codeFence(code: string, language: string): string {
    const fence = code.includes("```") ? "````" : "```"
    return `${fence}${language || ""}\n${code}\n${fence}`
}

function escapeAlt(text: string): string {
    return text.replace(/\]/g, "\\]")
}

/**
 * Flatten the textual portion of a block array into markdown.
 *
 * Non-textual blocks (cafes, maps, crawls) intentionally contribute nothing:
 * they render as cards, exactly like the legacy `tagged_cafe_ids` behaviour,
 * and including them would pollute excerpts and search results.
 */
export function blocksToMarkdown(blocks: BlogBlock[]): string {
    const parts: string[] = []
    for (const block of blocks) {
        switch (block.type) {
            case "text":
                if (block.content.trim()) parts.push(block.content.trim())
                break
            case "heading":
                if (block.text.trim()) {
                    parts.push(`${"#".repeat(block.level)} ${block.text.trim()}`)
                }
                break
            case "divider":
                parts.push("---")
                break
            case "image": {
                const alt = escapeAlt(block.alt || block.caption || "")
                const image = `![${alt}](${block.url})`
                parts.push(block.caption ? `${image}\n\n_${block.caption}_` : image)
                break
            }
            case "gallery":
                parts.push(
                    block.images
                        .map((img) => `![${escapeAlt(img.caption || "")}](${img.url})`)
                        .join("\n\n")
                )
                break
            case "callout": {
                const label = block.title || block.variant.toUpperCase()
                const body = block.content.trim()
                parts.push(`> **${label}**: ${body}`)
                break
            }
            case "quote": {
                const body = block.content.trim()
                const quoted = body
                    .split("\n")
                    .map((line) => `> ${line}`)
                    .join("\n")
                parts.push(
                    block.attribution ? `${quoted}\n>\n> — ${block.attribution}` : quoted
                )
                break
            }
            case "embed":
                parts.push(block.title ? `[${block.title}](${block.url})` : block.url)
                break
            case "link-card":
                parts.push(`[${block.title || block.label || block.url}](${block.url})`)
                break
            case "code":
                parts.push(codeFence(block.code, block.language))
                break
            case "cafe":
            case "cafe-carousel":
            case "map":
            case "crawl":
                break
        }
    }
    return parts.join("\n\n").trim()
}

/** True when the blocks contain at least one renderable piece of content. */
export function hasRenderableContent(blocks: BlogBlock[]): boolean {
    return blocks.some((block) => {
        switch (block.type) {
            case "text":
            case "callout":
            case "quote":
                return block.content.trim().length > 0
            case "heading":
                return block.text.trim().length > 0
            case "divider":
                return true
            case "image":
                return block.url.length > 0
            case "gallery":
                return block.images.length > 0
            case "cafe":
                return block.cafeId.length > 0
            case "cafe-carousel":
            case "map":
                return block.cafeIds.length > 0
            case "embed":
            case "link-card":
                return block.url.length > 0
            case "code":
                return block.code.trim().length > 0
            case "crawl":
                return block.crawlId.length > 0
        }
    })
}

/**
 * Ensure a block array is renderable: collapses empty text blocks that would
 * otherwise render as stray whitespace, keeping at least the media blocks.
 */
export function pruneEmptyTextBlocks(blocks: BlogBlock[]): BlogBlock[] {
    return blocks.filter((block) => {
        if (block.type === "text") return block.content.trim().length > 0
        if (block.type === "heading") return block.text.trim().length > 0
        return true
    })
}

// ---------------------------------------------------------------------------
// Legacy conversion
// ---------------------------------------------------------------------------

/**
 * Convert a legacy markdown post into blocks.
 *
 * - `content` becomes a single text block (headings stay inline).
 * - `images` becomes an image block (1 image) or gallery block (2+).
 * - `cafeIds` becomes a cafe block (1) or cafe-carousel block (2+).
 * - `crawlId` becomes a crawl block.
 *
 * This mirrors the order the legacy viewer rendered: content → gallery →
 * cafe highlights → crawl embed.
 */
export function legacyContentToBlocks(input: {
    content: string
    images?: string[] | null
    cafeIds?: string[] | null
    crawlId?: string | null
}): BlogBlock[] {
    const blocks: BlogBlock[] = []

    const content = (input.content ?? "").trim()
    if (content) {
        blocks.push({ id: createBlockId(), type: "text", content })
    }

    const images = (input.images ?? []).filter((url) => typeof url === "string" && url)
    if (images.length === 1) {
        blocks.push({ id: createBlockId(), type: "image", url: images[0] })
    } else if (images.length > 1) {
        blocks.push({
            id: createBlockId(),
            type: "gallery",
            images: images.map((url) => ({ url })),
        })
    }

    const cafeIds = (input.cafeIds ?? []).filter((id) => typeof id === "string" && id)
    if (cafeIds.length === 1) {
        blocks.push({ id: createBlockId(), type: "cafe", cafeId: cafeIds[0] })
    } else if (cafeIds.length > 1) {
        blocks.push({ id: createBlockId(), type: "cafe-carousel", cafeIds })
    }

    if (input.crawlId) {
        blocks.push({ id: createBlockId(), type: "crawl", crawlId: input.crawlId })
    }

    return blocks
}

/** Collect every cafe id referenced by a block array. */
export function collectBlockCafeIds(blocks: BlogBlock[]): string[] {
    const ids = new Set<string>()
    for (const block of blocks) {
        if (block.type === "cafe") ids.add(block.cafeId)
        else if (block.type === "cafe-carousel" || block.type === "map") {
            block.cafeIds.forEach((id) => ids.add(id))
        }
    }
    return [...ids]
}

/** Collect every crawl id referenced by a block array. */
export function collectBlockCrawlIds(blocks: BlogBlock[]): string[] {
    const ids = new Set<string>()
    for (const block of blocks) {
        if (block.type === "crawl") ids.add(block.crawlId)
    }
    return [...ids]
}
