import {
    AlertTriangle,
    ArrowUpRight,
    Info,
    Lightbulb,
    Link2,
    Quote as QuoteIcon,
    Youtube,
    CheckCircle2,
} from "lucide-react"
import MarkdownRender from "@/components/ui/MarkdownRender"
import { CafeWithRatings } from "@/utils/types/extra"
import {
    BlogBlock,
    extractVideoId,
    type CalloutVariant,
} from "@/utils/types/blog-blocks"
import type { CrawlEmbedData } from "@/components/blog/BlogCrawlEmbed"
import ImageBlockView from "./ImageBlockView"
import ImageCarousel from "./ImageCarousel"
import CafeCarousel from "./CafeCarousel"
import MapBlockView from "./MapBlockView"
import CrawlBlockView from "./CrawlBlockView"
import CodeBlockView from "./CodeBlockView"

export interface BlockRendererProps {
    blocks: BlogBlock[]
    /** Resolved cafes keyed by id (referenced by cafe / cafe-carousel / map blocks). */
    cafesById?: Record<string, CafeWithRatings>
    /** Resolved crawls keyed by id (referenced by crawl blocks). */
    crawlsById?: Record<string, CrawlEmbedData>
}

const CALLOUT_STYLES: Record<
    CalloutVariant,
    { border: string; bg: string; text: string; icon: typeof Info }
> = {
    info: {
        border: "border-l-primary/60",
        bg: "bg-primary/5",
        text: "text-primary",
        icon: Info,
    },
    tip: {
        border: "border-l-emerald-500/60",
        bg: "bg-emerald-500/5",
        text: "text-emerald-600",
        icon: Lightbulb,
    },
    warning: {
        border: "border-l-amber-500/60",
        bg: "bg-amber-500/5",
        text: "text-amber-600",
        icon: AlertTriangle,
    },
    success: {
        border: "border-l-green-500/60",
        bg: "bg-green-500/5",
        text: "text-green-600",
        icon: CheckCircle2,
    },
}

function resolveCafes(
    ids: string[],
    cafesById: Record<string, CafeWithRatings> | undefined
): CafeWithRatings[] {
    if (!cafesById) return []
    return ids.map((id) => cafesById[id]).filter((c): c is CafeWithRatings => Boolean(c))
}

function EmbedView({ url, title }: { url: string; title?: string }) {
    const videoId = extractVideoId(url)
    const isYoutube = /youtu\.?be/i.test(url)
    const isVimeo = /vimeo\.com/i.test(url)

    if (videoId && (isYoutube || isVimeo)) {
        const src = isYoutube
            ? `https://www.youtube.com/embed/${videoId}`
            : `https://player.vimeo.com/video/${videoId}`
        return (
            <div className="my-6 overflow-hidden rounded-2xl border border-text/10 bg-black/5">
                <div className="relative aspect-video w-full">
                    <iframe
                        src={src}
                        title={title || "Embedded video"}
                        className="absolute inset-0 h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        loading="lazy"
                    />
                </div>
                {title && (
                    <p className="flex items-center gap-2 border-t border-text/10 px-4 py-2 text-sm text-text/60">
                        <Youtube className="w-4 h-4 text-red-500" />
                        {title}
                    </p>
                )}
            </div>
        )
    }

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="my-4 flex items-center gap-3 rounded-2xl border border-text/10 bg-text/5 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-primary/5"
        >
            <Link2 className="w-4 h-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate text-sm text-text/80">
                {title || url}
            </span>
            <ArrowUpRight className="w-4 h-4 shrink-0 text-text/40" />
        </a>
    )
}

function LinkCardView({
    url,
    title,
    description,
    image,
    label,
}: {
    url: string
    title?: string
    description?: string
    image?: string
    label?: string
}) {
    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="my-6 flex flex-col overflow-hidden rounded-2xl border border-text/10 bg-background transition-all hover:border-primary/40 hover:shadow-md sm:flex-row"
        >
            {image && (
                <div className="relative h-40 w-full shrink-0 bg-text/5 sm:h-auto sm:w-48">
                    {/* eslint-disable-next-line @next/next/no-img-element -- user-provided card images */}
                    <img
                        src={image}
                        alt={title || ""}
                        loading="lazy"
                        className="h-full w-full object-cover"
                    />
                </div>
            )}
            <div className="flex flex-1 flex-col gap-1.5 p-5">
                {label && (
                    <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                        {label}
                    </span>
                )}
                <span className="font-semibold text-text">
                    {title || url}
                </span>
                {description && (
                    <span className="text-sm leading-relaxed text-text/60">
                        {description}
                    </span>
                )}
                <span className="mt-auto flex items-center gap-1.5 pt-2 text-sm font-medium text-primary">
                    Open link
                    <ArrowUpRight className="w-4 h-4" />
                </span>
            </div>
        </a>
    )
}

/**
 * Renders a blog post's block body.
 *
 * Server component: textual blocks are rendered directly, while interactive
 * blocks (carousels, lightbox, maps) delegate to client components.
 */
export default function BlockRenderer({
    blocks,
    cafesById,
    crawlsById,
}: BlockRendererProps) {
    if (!blocks || blocks.length === 0) return null

    return (
        <div className="max-w-none">
            {blocks.map((block) => {
                switch (block.type) {
                    case "text":
                        return block.content.trim() ? (
                            <MarkdownRender key={block.id} content={block.content} />
                        ) : null

                    case "heading":
                        return block.text.trim() ? (
                            block.level === 3 ? (
                                <h3
                                    key={block.id}
                                    className="mb-2 mt-6 text-xl font-medium text-text md:text-2xl"
                                >
                                    {block.text}
                                </h3>
                            ) : (
                                <h2
                                    key={block.id}
                                    className="mb-3 mt-8 text-2xl font-semibold text-text md:text-3xl"
                                >
                                    {block.text}
                                </h2>
                            )
                        ) : null

                    case "divider":
                        return (
                            <hr
                                key={block.id}
                                className="my-8 border-t border-text/10"
                            />
                        )

                    case "image":
                        return (
                            <ImageBlockView
                                key={block.id}
                                url={block.url}
                                alt={block.alt}
                                caption={block.caption}
                            />
                        )

                    case "gallery":
                        return (
                            <ImageCarousel
                                key={block.id}
                                images={block.images}
                                title={block.title}
                            />
                        )

                    case "cafe": {
                        const cafes = resolveCafes([block.cafeId], cafesById)
                        return (
                            <CafeCarousel
                                key={block.id}
                                cafes={cafes}
                                note={block.note}
                                variant="auto"
                            />
                        )
                    }

                    case "cafe-carousel": {
                        const cafes = resolveCafes(block.cafeIds, cafesById)
                        return (
                            <CafeCarousel
                                key={block.id}
                                cafes={cafes}
                                title={block.title}
                                variant="carousel"
                            />
                        )
                    }

                    case "callout": {
                        const style = CALLOUT_STYLES[block.variant]
                        const Icon = style.icon
                        return (
                            <aside
                                key={block.id}
                                className={`my-6 rounded-xl border border-text/10 border-l-4 ${style.border} ${style.bg} p-4`}
                            >
                                <p
                                    className={`mb-1 flex items-center gap-2 text-sm font-semibold ${style.text}`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {block.title ||
                                        block.variant.charAt(0).toUpperCase() +
                                            block.variant.slice(1)}
                                </p>
                                {block.content.trim() && (
                                    <MarkdownRender content={block.content} compact />
                                )}
                            </aside>
                        )
                    }

                    case "quote":
                        return block.content.trim() ? (
                            <blockquote
                                key={block.id}
                                className="my-6 border-l-4 border-primary/40 bg-muted/30 py-3 pl-5 pr-4 italic"
                            >
                                <QuoteIcon className="mb-2 w-4 h-4 text-primary/50" />
                                <MarkdownRender content={block.content} compact />
                                {block.attribution && (
                                    <footer className="mt-2 text-sm not-italic text-text/60">
                                        — {block.attribution}
                                    </footer>
                                )}
                            </blockquote>
                        ) : null

                    case "embed":
                        return (
                            <EmbedView
                                key={block.id}
                                url={block.url}
                                title={block.title}
                            />
                        )

                    case "link-card":
                        return (
                            <LinkCardView
                                key={block.id}
                                url={block.url}
                                title={block.title}
                                description={block.description}
                                image={block.image}
                                label={block.label}
                            />
                        )

                    case "code":
                        return block.code.trim() ? (
                            <CodeBlockView
                                key={block.id}
                                code={block.code}
                                language={block.language}
                            />
                        ) : null

                    case "map": {
                        const cafes = resolveCafes(block.cafeIds, cafesById)
                        return (
                            <MapBlockView
                                key={block.id}
                                cafes={cafes}
                                title={block.title}
                                caption={block.caption}
                            />
                        )
                    }

                    case "crawl":
                        return (
                            <CrawlBlockView
                                key={block.id}
                                crawl={crawlsById?.[block.crawlId]}
                            />
                        )
                }
            })}
        </div>
    )
}
