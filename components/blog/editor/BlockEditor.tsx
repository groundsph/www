"use client"

import { useCallback, useEffect, useState } from "react"
import {
    ArrowDown,
    ArrowUp,
    Trash2,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import {
    createBlock,
    type BlogBlock,
    type BlogBlockType,
} from "@/utils/types/blog-blocks"
import { cn } from "@/utils/cn"
import AddBlockMenu, { BLOCK_MENU_ITEMS } from "./AddBlockMenu"
import TextBlockEditor from "./blocks/TextBlockEditor"
import { GalleryBlockEditor, ImageBlockEditor } from "./blocks/ImageBlockEditor"
import {
    CalloutBlockEditor,
    CodeBlockEditor,
    DividerBlockEditor,
    EmbedBlockEditor,
    HeadingBlockEditor,
    LinkCardBlockEditor,
    QuoteBlockEditor,
} from "./blocks/TextualBlockEditors"
import {
    CafeBlockEditor,
    CafeCarouselBlockEditor,
    CrawlBlockEditor,
    MapBlockEditor,
} from "./blocks/EntityBlockEditors"

export interface BlockEditorProps {
    blocks: BlogBlock[]
    onChange: (blocks: BlogBlock[]) => void
    uploadImage: (file: File) => Promise<string | null>
    /** Restrict which block types can be inserted (e.g. community posts). */
    allowedTypes?: BlogBlockType[]
}

const BLOCK_LABELS: Record<BlogBlockType, string> = Object.fromEntries(
    BLOCK_MENU_ITEMS.map((item) => [item.type, item.label])
) as Record<BlogBlockType, string>

/**
 * Block-based body editor.
 *
 * Blocks are ordered and independent: text blocks are TipTap instances while
 * media/entity blocks render bespoke editors. Text blocks are auto-attached
 * (adding text after a text block focuses the existing one instead of
 * fragmenting the content).
 */
export default function BlockEditor({
    blocks,
    onChange,
    uploadImage,
    allowedTypes,
}: BlockEditorProps) {
    const [pendingFocusId, setPendingFocusId] = useState<string | null>(null)

    useEffect(() => {
        if (!pendingFocusId) return
        const timeout = window.setTimeout(() => setPendingFocusId(null), 400)
        return () => window.clearTimeout(timeout)
    }, [pendingFocusId])

    const updateBlock = useCallback(
        <T extends BlogBlock>(id: string, next: T) => {
            onChange(blocks.map((block) => (block.id === id ? next : block)))
        },
        [blocks, onChange]
    )

    const insertBlock = useCallback(
        (type: BlogBlockType, atIndex: number) => {
            // Auto-attach: adding text right after a text block extends that
            // block instead of creating a fragmented one.
            const above = blocks[atIndex - 1]
            if (type === "text" && above && above.type === "text") {
                setPendingFocusId(above.id)
                return
            }

            const newBlock = createBlock(type)
            const next = [...blocks]
            next.splice(atIndex, 0, newBlock)
            onChange(next)
            setPendingFocusId(newBlock.id)
        },
        [blocks, onChange]
    )

    const removeBlock = useCallback(
        (id: string) => {
            const index = blocks.findIndex((block) => block.id === id)
            const remaining = blocks.filter((block) => block.id !== id)
            if (remaining.length === 0) {
                onChange([createBlock("text")])
                return
            }
            onChange(remaining)
            const previous = remaining[Math.max(0, index - 1)]
            if (previous?.type === "text") setPendingFocusId(previous.id)
        },
        [blocks, onChange]
    )

    const moveBlock = useCallback(
        (id: string, direction: -1 | 1) => {
            const index = blocks.findIndex((block) => block.id === id)
            const target = index + direction
            if (index < 0 || target < 0 || target >= blocks.length) return
            const next = [...blocks]
            ;[next[index], next[target]] = [next[target], next[index]]
            onChange(next)
            if (next[target].type === "text") setPendingFocusId(next[target].id)
        },
        [blocks, onChange]
    )

    const renderBlockEditor = (block: BlogBlock) => {
        switch (block.type) {
            case "text":
                return (
                    <TextBlockEditor
                        value={block.content}
                        onChange={(content) => updateBlock(block.id, { ...block, content })}
                        uploadImage={uploadImage}
                        autoFocus={pendingFocusId === block.id}
                    />
                )
            case "heading":
                return (
                    <HeadingBlockEditor
                        block={block}
                        update={(next) => updateBlock(block.id, next)}
                    />
                )
            case "divider":
                return <DividerBlockEditor />
            case "image":
                return (
                    <ImageBlockEditor
                        block={block}
                        update={(next) => updateBlock(block.id, next)}
                        uploadImage={uploadImage}
                    />
                )
            case "gallery":
                return (
                    <GalleryBlockEditor
                        block={block}
                        update={(next) => updateBlock(block.id, next)}
                        uploadImage={uploadImage}
                    />
                )
            case "cafe":
                return (
                    <CafeBlockEditor
                        block={block}
                        update={(next) => updateBlock(block.id, next)}
                    />
                )
            case "cafe-carousel":
                return (
                    <CafeCarouselBlockEditor
                        block={block}
                        update={(next) => updateBlock(block.id, next)}
                    />
                )
            case "callout":
                return (
                    <CalloutBlockEditor
                        block={block}
                        update={(next) => updateBlock(block.id, next)}
                    />
                )
            case "quote":
                return (
                    <QuoteBlockEditor
                        block={block}
                        update={(next) => updateBlock(block.id, next)}
                    />
                )
            case "embed":
                return (
                    <EmbedBlockEditor
                        block={block}
                        update={(next) => updateBlock(block.id, next)}
                    />
                )
            case "link-card":
                return (
                    <LinkCardBlockEditor
                        block={block}
                        update={(next) => updateBlock(block.id, next)}
                    />
                )
            case "code":
                return (
                    <CodeBlockEditor
                        block={block}
                        update={(next) => updateBlock(block.id, next)}
                    />
                )
            case "map":
                return (
                    <MapBlockEditor
                        block={block}
                        update={(next) => updateBlock(block.id, next)}
                    />
                )
            case "crawl":
                return (
                    <CrawlBlockEditor
                        block={block}
                        update={(next) => updateBlock(block.id, next)}
                    />
                )
        }
    }

    return (
        <div className="space-y-3">
            {blocks.map((block, index) => (
                <div key={block.id} className="group/block relative">
                    {/* Block shell */}
                    <div
                        className={cn(
                            "rounded-2xl border border-text/10 bg-tertiary/5 p-3 transition-colors md:p-4",
                            "focus-within:border-primary/30",
                            pendingFocusId === block.id && "ring-1 ring-primary/20"
                        )}
                    >
                        {/* Header row */}
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="rounded-full bg-text/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text/45">
                                {BLOCK_LABELS[block.type]}
                            </span>
                            <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/block:opacity-100 focus-within:opacity-100">
                                <button
                                    type="button"
                                    onClick={() => moveBlock(block.id, -1)}
                                    disabled={index === 0}
                                    className="rounded-md p-1 text-text/50 transition-colors hover:bg-text/10 hover:text-text disabled:opacity-30"
                                    aria-label="Move block up"
                                >
                                    <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => moveBlock(block.id, 1)}
                                    disabled={index === blocks.length - 1}
                                    className="rounded-md p-1 text-text/50 transition-colors hover:bg-text/10 hover:text-text disabled:opacity-30"
                                    aria-label="Move block down"
                                >
                                    <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => removeBlock(block.id)}
                                    className="rounded-md p-1 text-text/50 transition-colors hover:bg-red-500/10 hover:text-red-500"
                                    aria-label="Delete block"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        {renderBlockEditor(block)}
                    </div>

                    {/* Insert-between control */}
                    <div className="flex justify-center py-1">
                        <AddBlockMenu
                            variant="compact"
                            label="Add block"
                            dropUp={index >= blocks.length - 2}
                            allowedTypes={allowedTypes}
                            onSelect={(type) => insertBlock(type, index + 1)}
                        />
                    </div>
                </div>
            ))}

            <AnimatePresence>
                {blocks.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="rounded-2xl border-2 border-dashed border-text/20 p-8 text-center"
                    >
                        <p className="mb-3 text-sm text-text/50">
                            This post has no content yet.
                        </p>
                        <AddBlockMenu
                            onSelect={(type) => insertBlock(type, 0)}
                            label="Add your first block"
                            allowedTypes={allowedTypes}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
