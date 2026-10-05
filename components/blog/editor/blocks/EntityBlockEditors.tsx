"use client"

import type {
    CafeBlock,
    CafeCarouselBlock,
    CrawlBlock,
    MapBlock,
} from "@/utils/types/blog-blocks"
import BlogCafePicker from "@/components/blog/BlogCafePicker"
import BlogCrawlPicker from "@/components/blog/BlogCrawlPicker"
import { Field, TextArea, TextInput } from "./BlockFields"

export function CafeBlockEditor({
    block,
    update,
}: {
    block: CafeBlock
    update: (next: CafeBlock) => void
}) {
    return (
        <div className="space-y-3">
            <BlogCafePicker
                selectedCafeIds={block.cafeId ? [block.cafeId] : []}
                onChange={(ids) => update({ ...block, cafeId: ids[0] ?? "" })}
                maxCafes={1}
            />
            <Field label="Note" hint="Optional context shown under the heading.">
                <TextInput
                    value={block.note || ""}
                    onChange={(note) => update({ ...block, note })}
                    placeholder="Why this cafe?"
                />
            </Field>
        </div>
    )
}

export function CafeCarouselBlockEditor({
    block,
    update,
}: {
    block: CafeCarouselBlock
    update: (next: CafeCarouselBlock) => void
}) {
    return (
        <div className="space-y-3">
            <Field label="Section title">
                <TextInput
                    value={block.title || ""}
                    onChange={(title) => update({ ...block, title })}
                    placeholder="Featured Cafes"
                />
            </Field>
            <BlogCafePicker
                selectedCafeIds={block.cafeIds}
                onChange={(cafeIds) => update({ ...block, cafeIds })}
                maxCafes={8}
            />
        </div>
    )
}

export function MapBlockEditor({
    block,
    update,
}: {
    block: MapBlock
    update: (next: MapBlock) => void
}) {
    return (
        <div className="space-y-3">
            <Field label="Title">
                <TextInput
                    value={block.title || ""}
                    onChange={(title) => update({ ...block, title })}
                    placeholder="Cafes on this map"
                />
            </Field>
            <BlogCafePicker
                selectedCafeIds={block.cafeIds}
                onChange={(cafeIds) => update({ ...block, cafeIds })}
                maxCafes={12}
            />
            <Field label="Caption">
                <TextArea
                    value={block.caption || ""}
                    onChange={(caption) => update({ ...block, caption })}
                    rows={2}
                    placeholder="Optional caption"
                />
            </Field>
        </div>
    )
}

export function CrawlBlockEditor({
    block,
    update,
}: {
    block: CrawlBlock
    update: (next: CrawlBlock) => void
}) {
    return (
        <BlogCrawlPicker
            selectedCrawlId={block.crawlId || null}
            onChange={(crawlId) => update({ ...block, crawlId: crawlId ?? "" })}
        />
    )
}
