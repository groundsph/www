"use client"

import { Code2, Megaphone, Quote as QuoteIcon } from "lucide-react"
import type {
    CalloutBlock,
    CalloutVariant,
    CodeBlock,
    EmbedBlock,
    HeadingBlock,
    LinkCardBlock,
    QuoteBlock,
} from "@/utils/types/blog-blocks"
import { Field, SelectInput, TextArea, TextInput } from "./BlockFields"

const HEADING_LEVELS = [
    { value: "2", label: "Heading 2" },
    { value: "3", label: "Heading 3" },
]

const CALLOUT_VARIANTS: { value: CalloutVariant; label: string }[] = [
    { value: "info", label: "Info" },
    { value: "tip", label: "Tip" },
    { value: "warning", label: "Warning" },
    { value: "success", label: "Success" },
]

const CODE_LANGUAGES = [
    { value: "text", label: "Plain text" },
    { value: "ts", label: "TypeScript" },
    { value: "js", label: "JavaScript" },
    { value: "tsx", label: "TSX" },
    { value: "jsx", label: "JSX" },
    { value: "json", label: "JSON" },
    { value: "bash", label: "Bash" },
    { value: "css", label: "CSS" },
    { value: "html", label: "HTML" },
    { value: "python", label: "Python" },
    { value: "sql", label: "SQL" },
    { value: "md", label: "Markdown" },
]

export function HeadingBlockEditor({
    block,
    update,
}: {
    block: HeadingBlock
    update: (next: HeadingBlock) => void
}) {
    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_160px]">
            <Field label="Heading text">
                <TextInput
                    value={block.text}
                    onChange={(text) => update({ ...block, text })}
                    placeholder="Section title"
                />
            </Field>
            <Field label="Level">
                <SelectInput
                    value={String(block.level)}
                    onChange={(level) =>
                        update({ ...block, level: level === "3" ? 3 : 2 })
                    }
                    options={HEADING_LEVELS}
                />
            </Field>
        </div>
    )
}

export function CalloutBlockEditor({
    block,
    update,
}: {
    block: CalloutBlock
    update: (next: CalloutBlock) => void
}) {
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Variant">
                    <SelectInput
                        value={block.variant}
                        onChange={(variant) => update({ ...block, variant })}
                        options={CALLOUT_VARIANTS}
                    />
                </Field>
                <Field label="Title">
                    <TextInput
                        value={block.title || ""}
                        onChange={(title) => update({ ...block, title })}
                        placeholder="Optional title"
                    />
                </Field>
            </div>
            <Field label="Message">
                <TextArea
                    value={block.content}
                    onChange={(content) => update({ ...block, content })}
                    placeholder="Write the callout message…"
                />
            </Field>
            <p className="flex items-center gap-1.5 text-[11px] text-text/40">
                <Megaphone className="w-3 h-3" />
                Markdown formatting is supported.
            </p>
        </div>
    )
}

export function QuoteBlockEditor({
    block,
    update,
}: {
    block: QuoteBlock
    update: (next: QuoteBlock) => void
}) {
    return (
        <div className="space-y-3">
            <Field label="Quote">
                <TextArea
                    value={block.content}
                    onChange={(content) => update({ ...block, content })}
                    placeholder="A memorable line…"
                />
            </Field>
            <Field label="Attribution" hint="Shown after an em dash.">
                <TextInput
                    value={block.attribution || ""}
                    onChange={(attribution) => update({ ...block, attribution })}
                    placeholder="Who said it?"
                />
            </Field>
            <p className="flex items-center gap-1.5 text-[11px] text-text/40">
                <QuoteIcon className="w-3 h-3" />
                Markdown formatting is supported.
            </p>
        </div>
    )
}

export function CodeBlockEditor({
    block,
    update,
}: {
    block: CodeBlock
    update: (next: CodeBlock) => void
}) {
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[200px_1fr]">
                <Field label="Language">
                    <SelectInput
                        value={block.language}
                        onChange={(language) => update({ ...block, language })}
                        options={CODE_LANGUAGES}
                    />
                </Field>
                <div className="flex items-end text-[11px] text-text/40">
                    <span className="inline-flex items-center gap-1.5">
                        <Code2 className="w-3 h-3" />
                        Highlighting is applied on the published post.
                    </span>
                </div>
            </div>
            <textarea
                value={block.code}
                onChange={(e) => update({ ...block, code: e.target.value })}
                rows={8}
                spellCheck={false}
                placeholder="Paste your code here…"
                className="w-full resize-y rounded-lg border border-text/15 bg-secondary/10 p-3 font-mono text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
        </div>
    )
}

export function EmbedBlockEditor({
    block,
    update,
}: {
    block: EmbedBlock
    update: (next: EmbedBlock) => void
}) {
    return (
        <div className="space-y-3">
            <Field label="URL" hint="YouTube, Vimeo, or any external link.">
                <TextInput
                    value={block.url}
                    onChange={(url) => update({ ...block, url })}
                    placeholder="https://youtube.com/watch?v=…"
                />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Title">
                    <TextInput
                        value={block.title || ""}
                        onChange={(title) => update({ ...block, title })}
                        placeholder="Optional title"
                    />
                </Field>
                <Field label="Description">
                    <TextInput
                        value={block.description || ""}
                        onChange={(description) => update({ ...block, description })}
                        placeholder="Optional description"
                    />
                </Field>
            </div>
        </div>
    )
}

export function LinkCardBlockEditor({
    block,
    update,
}: {
    block: LinkCardBlock
    update: (next: LinkCardBlock) => void
}) {
    return (
        <div className="space-y-3">
            <Field label="URL">
                <TextInput
                    value={block.url}
                    onChange={(url) => update({ ...block, url })}
                    placeholder="https://…"
                />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Title">
                    <TextInput
                        value={block.title || ""}
                        onChange={(title) => update({ ...block, title })}
                        placeholder="Link title"
                    />
                </Field>
                <Field label="Label" hint="Small text above the title.">
                    <TextInput
                        value={block.label || ""}
                        onChange={(label) => update({ ...block, label })}
                        placeholder="e.g. Read more"
                    />
                </Field>
            </div>
            <Field label="Description">
                <TextArea
                    value={block.description || ""}
                    onChange={(description) => update({ ...block, description })}
                    rows={2}
                    placeholder="Short description"
                />
            </Field>
        </div>
    )
}

export function DividerBlockEditor() {
    return (
        <div className="flex items-center gap-3 text-xs text-text/40">
            <span className="h-px flex-1 bg-text/15" />
            Divider
            <span className="h-px flex-1 bg-text/15" />
        </div>
    )
}
