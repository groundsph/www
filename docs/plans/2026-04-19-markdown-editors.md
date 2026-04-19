# Markdown Editors Improvement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade all markdown text editors in the project to use a shared TipTap-based component system, fix rendering inconsistencies, and resolve all lint/build errors.

**Architecture:** Create a shared `MarkdownEditor` component built on TipTap with configurable mode presets (full, medium, light, minimal, description). Extract a shared `MarkdownToolbar` from the existing blog editor. Refactor all textarea-based editors (StorySection, ReviewModal, owner responses, cafe descriptions) to use the new component. Fix `MarkdownRender` usage inconsistencies (owner responses, cafe descriptions, blog page double-styling).

**Tech Stack:** TipTap (already installed), tiptap-markdown, react-markdown, remark-gfm, Tailwind CSS v4

---

## Phase 1: Shared Foundation

### Task 1: Create Shared TipTap Extensions Module

**Files:**
- Create: `components/ui/markdown-editor/extensions.ts`
- Modify: `components/blog/editor/extensions.ts`

**Context:** Currently all TipTap extensions are defined in `components/blog/editor/extensions.ts` as a single `getEditorExtensions()` function. We need to extract shared extensions and create mode-specific compositions while maintaining backward compatibility with the blog editor.

**Step 1: Create the shared extensions module**

Create `components/ui/markdown-editor/extensions.ts`:

```typescript
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Image from "@tiptap/extension-image"
import Placeholder from "@tiptap/extension-placeholder"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight"
import { Table } from "@tiptap/extension-table"
import TableRow from "@tiptap/extension-table-row"
import TableCell from "@tiptap/extension-table-cell"
import TableHeader from "@tiptap/extension-table-header"
import Youtube from "@tiptap/extension-youtube"
import { Markdown } from "tiptap-markdown"
import { common, createLowlight } from "lowlight"

const lowlight = createLowlight(common)

export type EditorMode = "full" | "medium" | "light" | "minimal" | "description"

const baseExtensions = [
    StarterKit.configure({
        heading: {
            levels: [1, 2, 3],
        },
    }),
    Link.configure({
        openOnClick: false,
        HTMLAttributes: {
            class: "text-primary underline cursor-pointer",
        },
    }),
    Markdown.configure({
        html: true,
        transformCopiedText: true,
        transformPastedText: true,
    }),
]

const imageExtension = Image.configure({
    HTMLAttributes: {
        class: "rounded-lg max-w-full h-auto my-4",
    },
})

export function getEditorExtensions(
    mode: EditorMode,
    placeholder?: string,
): Extension[] {
    const extensions: Extension[] = [...baseExtensions]

    if (placeholder) {
        extensions.push(
            Placeholder.configure({ placeholder }),
        )
    }

    switch (mode) {
        case "full":
            extensions.push(
                imageExtension,
                TaskList,
                TaskItem.configure({ nested: true }),
                CodeBlockLowlight.configure({ lowlight }),
                Table.configure({ resizable: true }),
                TableRow,
                TableCell,
                TableHeader,
                Youtube.configure({
                    width: 640,
                    height: 360,
                    HTMLAttributes: {
                        class: "rounded-lg my-4",
                    },
                }),
            )
            break

        case "medium":
            extensions.push(
                imageExtension,
                TaskList,
                TaskItem.configure({ nested: true }),
            )
            break

        case "light":
            // Bold, italic, inline code, links, lists — already in StarterKit + Link
            break

        case "minimal":
            // Bold, italic, links — StarterKit already provides these minus code
            // Remove code block from StarterKit for minimal mode
            break

        case "description":
            // Bold, italic, links only
            break
    }

    return extensions
}
```

**Important:** The `Extension[]` type import needs to come from `@tiptap/core`. Also, `StarterKit` already includes code (inline) but we need to conditionally exclude `codeBlock` for non-full modes, and potentially `code` (inline) for minimal/description modes. We'll handle this by configuring StarterKit differently per mode:

```typescript
import type { Extension } from "@tiptap/core"

export function getEditorExtensions(
    mode: EditorMode,
    placeholder?: string,
): Extension[] {
    const starterKitConfig: Record<string, unknown> = {
        heading: { levels: [1, 2, 3] },
    }

    if (mode === "minimal" || mode === "description") {
        starterKitConfig.codeBlock = false
        starterKitConfig.blockquote = false
        starterKitConfig.horizontalRule = false
        starterKitConfig.strike = false
    }
    if (mode === "description") {
        starterKitConfig.heading = false
    }

    const extensions: Extension[] = [
        StarterKit.configure(starterKitConfig),
        Link.configure({
            openOnClick: false,
            HTMLAttributes: {
                class: "text-primary underline cursor-pointer",
            },
        }),
        Markdown.configure({
            html: true,
            transformCopiedText: true,
            transformPastedText: true,
        }),
    ]

    if (placeholder) {
        extensions.push(Placeholder.configure({ placeholder }))
    }

    if (mode === "full") {
        extensions.push(
            imageExtension,
            TaskList,
            TaskItem.configure({ nested: true }),
            CodeBlockLowlight.configure({ lowlight }),
            Table.configure({ resizable: true }),
            TableRow,
            TableCell,
            TableHeader,
            Youtube.configure({
                width: 640,
                height: 360,
                HTMLAttributes: { class: "rounded-lg my-4" },
            }),
        )
    } else if (mode === "medium") {
        extensions.push(
            imageExtension,
            TaskList,
            TaskItem.configure({ nested: true }),
        )
    }

    if (mode === "medium" || mode === "full") {
        extensions.push(Placeholder.configure({ placeholder: placeholder || "Start writing..." }))
    }

    return extensions
}
```

**Step 2: Verify no import errors**

Run: `bun build --no-lint 2>&1 | head -20`
This will catch TypeScript/import issues early.

**Step 3: Commit**

```bash
git add components/ui/markdown-editor/extensions.ts
git commit -m "feat: add shared TipTap extensions module for markdown editor modes"
```

---

### Task 2: Create `MarkdownToolbar` Component

**Files:**
- Create: `components/ui/markdown-editor/MarkdownToolbar.tsx`

**Context:** Extract the toolbar logic from `EditorToolbar.tsx` and make it configurable by mode. Each mode controls which buttons appear.

**Step 1: Create the toolbar types and mode configs**

Create `components/ui/markdown-editor/MarkdownToolbar.tsx`:

```tsx
"use client"

import { Editor } from "@tiptap/react"
import {
    Bold, Italic, Strikethrough, Code,
    List, ListOrdered, ListChecks, Quote, CodeSquare, LinkIcon,
    ImageIcon, Minus, HelpCircle, ChevronDown,
    Table2, Heading1, Heading2, Heading3, Type,
} from "lucide-react"
import { useState, useCallback } from "react"
import ShortcutHelpModal from "@/components/blog/editor/ShortcutHelpModal"

export type ToolbarFeature =
    | "heading"
    | "bold"
    | "italic"
    | "strikethrough"
    | "inlineCode"
    | "bulletList"
    | "orderedList"
    | "taskList"
    | "blockquote"
    | "codeBlock"
    | "link"
    | "image"
    | "horizontalRule"
    | "table"
    | "help"
    | "preview"

export const TOOLBAR_PRESETS: Record<string, ToolbarFeature[]> = {
    full: [
        "heading", "bold", "italic", "strikethrough", "inlineCode",
        "bulletList", "orderedList", "taskList",
        "blockquote", "codeBlock",
        "link", "image", "horizontalRule", "table",
        "help",
    ],
    medium: [
        "heading", "bold", "italic", "inlineCode",
        "bulletList", "orderedList", "taskList",
        "blockquote",
        "link", "image",
    ],
    light: [
        "bold", "italic", "inlineCode",
        "bulletList", "orderedList",
        "link",
        "preview",
    ],
    minimal: [
        "bold", "italic", "link",
        "preview",
    ],
    description: [
        "bold", "italic", "link",
        "preview",
    ],
}

interface MarkdownToolbarProps {
    editor: Editor | null
    features: ToolbarFeature[]
    onImageUpload?: () => void
    onPreviewToggle?: () => void
    isPreviewing?: boolean
    className?: string
}

type HeadingLevel = 1 | 2 | 3 | 0

const ToolbarDivider = () => <div className="w-px h-5 bg-text/10 mx-1" />

const ToolbarButton = ({
    onClick,
    isActive,
    title,
    children,
    disabled = false,
    size = "md",
}: {
    onClick: () => void
    isActive?: boolean
    title: string
    children: React.ReactNode
    disabled?: boolean
    size?: "md" | "sm"
}) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
            size === "sm" ? "p-1" : ""
        } ${
            isActive
                ? "bg-primary/10 text-primary"
                : "text-text/60 hover:bg-text/5 hover:text-text"
        }`}
    >
        {children}
    </button>
)

export default function MarkdownToolbar({
    editor,
    features,
    onImageUpload,
    onPreviewToggle,
    isPreviewing = false,
    className = "",
}: MarkdownToolbarProps) {
    const [showHeadingDropdown, setShowHeadingDropdown] = useState(false)
    const [showShortcutHelp, setShowShortcutHelp] = useState(false)

    const setLink = useCallback(() => {
        if (!editor) return
        const previousUrl = editor.getAttributes("link").href as string
        const url = window.prompt("URL", previousUrl)
        if (url === null) return
        if (url === "") {
            editor.chain().focus().extendMarkRange("link").unsetLink().run()
            return
        }
        editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
    }, [editor])

    if (!editor) return null

    const currentHeading: HeadingLevel = editor.isActive("heading", { level: 1 })
        ? 1
        : editor.isActive("heading", { level: 2 })
            ? 2
            : editor.isActive("heading", { level: 3 })
                ? 3
                : 0

    const hasHeading = features.includes("heading")
    const hasDividerBefore = (feature: ToolbarFeature) => {
        const dividers: ToolbarFeature[] = ["bold", "bulletList", "blockquote", "link"]
        return dividers.includes(feature)
    }

    const iconSize = features.includes("preview") ? "w-3.5 h-3.5" : "w-4 h-4"

    return (
        <>
            <div className={`flex items-center gap-0.5 flex-wrap px-2 py-1.5 border-b border-text/10 bg-tertiary/10 ${className}`}>
                {features.map((feature, i) => {
                    if (hasDividerBefore(feature) && i > 0) {
                        return [<ToolbarDivider key={`div-${i}`} />, renderFeature(feature, iconSize)]
                    }
                    return renderFeature(feature, iconSize)
                })}
            </div>

            {showShortcutHelp && (
                <ShortcutHelpModal
                    isOpen={showShortcutHelp}
                    onClose={() => setShowShortcutHelp(false)}
                />
            )}
        </>
    )

    function renderFeature(feature: ToolbarFeature, iconSize: string) {
        switch (feature) {
            case "heading":
                return (
                    <div key="heading" className="relative mr-1">
                        <button
                            key="heading-btn"
                            type="button"
                            onClick={() => setShowHeadingDropdown(!showHeadingDropdown)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-sm text-text/70 hover:bg-text/5 transition-colors"
                        >
                            <Type className="w-3.5 h-3.5" />
                            <ChevronDown className="w-3 h-3" />
                        </button>
                        {showHeadingDropdown && (
                            <div className="absolute top-full left-0 mt-1 bg-background border border-text/10 rounded-xl shadow-lg z-20 overflow-hidden min-w-[140px]">
                                {([0, 1, 2, 3] as HeadingLevel[]).map((level) => (
                                    <button
                                        key={`heading-${level}`}
                                        type="button"
                                        onClick={() => {
                                            if (level === 0) {
                                                editor.chain().focus().setParagraph().run()
                                            } else {
                                                editor.chain().focus().toggleHeading({ level }).run()
                                            }
                                            setShowHeadingDropdown(false)
                                        }}
                                        className={`w-full text-left px-3 py-2 text-sm hover:bg-text/5 transition-colors ${
                                            currentHeading === level
                                                ? "bg-primary/5 text-primary font-medium"
                                                : "text-text/70"
                                        }`}
                                    >
                                        {level === 0 ? "Paragraph" : `Heading ${level}`}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )
            case "bold":
                return (
                    <ToolbarButton
                        key="bold"
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        isActive={editor.isActive("bold")}
                        title="Bold (Ctrl+B)"
                    >
                        <Bold className={iconSize} />
                    </ToolbarButton>
                )
            case "italic":
                return (
                    <ToolbarButton
                        key="italic"
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        isActive={editor.isActive("italic")}
                        title="Italic (Ctrl+I)"
                    >
                        <Italic className={iconSize} />
                    </ToolbarButton>
                )
            case "strikethrough":
                return (
                    <ToolbarButton
                        key="strikethrough"
                        onClick={() => editor.chain().focus().toggleStrike().run()}
                        isActive={editor.isActive("strike")}
                        title="Strikethrough"
                    >
                        <Strikethrough className={iconSize} />
                    </ToolbarButton>
                )
            case "inlineCode":
                return (
                    <ToolbarButton
                        key="inlineCode"
                        onClick={() => editor.chain().focus().toggleCode().run()}
                        isActive={editor.isActive("code")}
                        title="Inline Code (Ctrl+E)"
                    >
                        <Code className={iconSize} />
                    </ToolbarButton>
                )
            case "bulletList":
                return (
                    <ToolbarButton
                        key="bulletList"
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        isActive={editor.isActive("bulletList")}
                        title="Bullet List"
                    >
                        <List className={iconSize} />
                    </ToolbarButton>
                )
            case "orderedList":
                return (
                    <ToolbarButton
                        key="orderedList"
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        isActive={editor.isActive("orderedList")}
                        title="Ordered List"
                    >
                        <ListOrdered className={iconSize} />
                    </ToolbarButton>
                )
            case "taskList":
                return (
                    <ToolbarButton
                        key="taskList"
                        onClick={() => editor.chain().focus().toggleTaskList().run()}
                        isActive={editor.isActive("taskList")}
                        title="Task List"
                    >
                        <ListChecks className={iconSize} />
                    </ToolbarButton>
                )
            case "blockquote":
                return (
                    <ToolbarButton
                        key="blockquote"
                        onClick={() => editor.chain().focus().toggleBlockquote().run()}
                        isActive={editor.isActive("blockquote")}
                        title="Blockquote"
                    >
                        <Quote className={iconSize} />
                    </ToolbarButton>
                )
            case "codeBlock":
                return (
                    <ToolbarButton
                        key="codeBlock"
                        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                        isActive={editor.isActive("codeBlock")}
                        title="Code Block"
                    >
                        <CodeSquare className={iconSize} />
                    </ToolbarButton>
                )
            case "link":
                return (
                    <ToolbarButton
                        key="link"
                        onClick={setLink}
                        isActive={editor.isActive("link")}
                        title="Link (Ctrl+K)"
                    >
                        <LinkIcon className={iconSize} />
                    </ToolbarButton>
                )
            case "image":
                return (
                    <ToolbarButton
                        key="image"
                        onClick={onImageUpload || (() => {})}
                        title="Insert Image"
                    >
                        <ImageIcon className={iconSize} />
                    </ToolbarButton>
                )
            case "horizontalRule":
                return (
                    <ToolbarButton
                        key="hr"
                        onClick={() => editor.chain().focus().setHorizontalRule().run()}
                        title="Horizontal Rule"
                    >
                        <Minus className={iconSize} />
                    </ToolbarButton>
                )
            case "table":
                return (
                    <ToolbarButton
                        key="table"
                        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                        title="Insert Table"
                    >
                        <Table2 className={iconSize} />
                    </ToolbarButton>
                )
            case "help":
                return (
                    <ToolbarButton
                        key="help"
                        onClick={() => setShowShortcutHelp(true)}
                        title="Keyboard Shortcuts"
                    >
                        <HelpCircle className={iconSize} />
                    </ToolbarButton>
                )
            case "preview":
                return (
                    <ToolbarButton
                        key="preview"
                        onClick={onPreviewToggle || (() => {})}
                        isActive={isPreviewing}
                        title={isPreviewing ? "Edit" : "Preview"}
                    >
                        <Type className={iconSize} />
                    </ToolbarButton>
                )
            default:
                return null
        }
    }
}
```

**Step 2: Verify component renders**

Run: `bun build 2>&1 | head -30`
Expected: No TypeScript errors related to MarkdownToolbar.

**Step 3: Commit**

```bash
git add components/ui/markdown-editor/MarkdownToolbar.tsx
git commit -m "feat: add shared MarkdownToolbar component with mode presets"
```

---

### Task 3: Create `MarkdownEditor` Component

**Files:**
- Create: `components/ui/markdown-editor/MarkdownEditor.tsx`
- Create: `components/ui/markdown-editor/index.ts`

**Context:** This is the main shared editor component. It wraps TipTap's `useEditor` and `EditorContent`, combining the extensions module and toolbar. It manages markdown serialization/deserialization via tiptap-markdown.

**Step 1: Create the MarkdownEditor component**

Create `components/ui/markdown-editor/MarkdownEditor.tsx`:

```tsx
"use client"

import { useState, useCallback, useEffect } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import { getEditorExtensions, type EditorMode } from "./extensions"
import MarkdownToolbar, { TOOLBAR_PRESETS, type ToolbarFeature } from "./MarkdownToolbar"
import MarkdownRender from "@/components/ui/MarkdownRender"
import { Eye, Edit3 } from "lucide-react"

interface MarkdownEditorProps {
    /** Editor mode preset */
    mode: EditorMode
    /** Current markdown content */
    value: string
    /** Called when content changes (markdown string) */
    onChange: (markdown: string) => void
    /** Placeholder text */
    placeholder?: string
    /** Maximum character/word limit (for description mode) */
    maxLength?: number
    /** Show character count */
    showCharCount?: boolean
    /** Whether the editor is disabled */
    disabled?: boolean
    /** Custom toolbar features (overrides mode preset) */
    toolbarFeatures?: ToolbarFeature[]
    /** Auto-save configuration */
    autoSave?: {
        key: string
        interval?: number
        onSave?: (content: string) => Promise<void>
    }
    /** Callback for image upload */
    onImageUpload?: () => void
    /** Show preview toggle (for modes that support it) */
    showPreview?: boolean
    /** Color scheme for theming */
    colorScheme?: "primary" | "secondary" | "tertiary"
    /** Additional CSS classes */
    className?: string
    /** Minimum height in pixels */
    minHeight?: number
    /** Auto-focus on mount */
    autoFocus?: boolean
}

export default function MarkdownEditor({
    mode,
    value,
    onChange,
    placeholder,
    maxLength,
    showCharCount = false,
    disabled = false,
    toolbarFeatures,
    autoSave,
    onImageUpload,
    showPreview: showPreviewProp,
    colorScheme = "primary",
    className = "",
    minHeight = 200,
    autoFocus = false,
}: MarkdownEditorProps) {
    const shouldShowPreview = showPreviewProp ?? (mode === "light" || mode === "minimal" || mode === "description")
    const [showPreview, setShowPreview] = useState(false)
    const [charCount, setCharCount] = useState(0)

    const extensions = getEditorExtensions(mode, placeholder)

    const editor = useEditor({
        extensions,
        content: value,
        editable: !disabled,
        immediatelyRender: false,
        onUpdate: ({ editor: e }) => {
            const md = (e.storage as Record<string, unknown>).markdown as { getMarkdown: () => string } | undefined
            const markdown = md?.getMarkdown?.() ?? e.getText()
            const text = e.getText()
            setCharCount(text.length)

            if (maxLength && text.length > maxLength) {
                return
            }

            onChange(markdown)
        },
        editorProps: {
            attributes: {
                class: `prose prose-sm max-w-none focus:outline-none min-h-[${minHeight}px] ${
                    mode === "minimal" || mode === "description" ? "text-sm" : ""
                }`,
            },
        },
        autofocus: autoFocus,
    })

    // Sync external value changes into the editor
    useEffect(() => {
        if (editor && !editor.isFocused) {
            const currentContent = (editor.storage as Record<string, unknown>).markdown as { getMarkdown: () => string } | undefined
            const currentMd = currentContent?.getMarkdown?.() ?? editor.getText()
            if (currentMd !== value) {
                editor.commands.setContent(value)
            }
        }
    }, [value, editor])

    // Auto-save logic
    useEffect(() => {
        if (!autoSave) return

        const interval = autoSave.interval ?? 30000
        const key = `md-editor-draft-${autoSave.key}`

        // Load draft on mount
        const draft = localStorage.getItem(key)
        if (draft && editor) {
            editor.commands.setContent(draft)
        }

        const timer = setInterval(() => {
            if (editor && !editor.isEmpty) {
                const md = (editor.storage as Record<string, unknown>).markdown as { getMarkdown: () => string } | undefined
                const markdown = md?.getMarkdown?.() ?? editor.getText()
                localStorage.setItem(key, markdown)
                autoSave.onSave?.(markdown)
            }
        }, interval)

        return () => clearInterval(timer)
    }, [editor, autoSave])

    const features = toolbarFeatures ?? TOOLBAR_PRESETS[mode]

    const handlePreviewToggle = useCallback(() => {
        setShowPreview((prev) => !prev)
    }, [])

    return (
        <div className={`border border-text/10 rounded-lg overflow-hidden ${className}`}>
            {(shouldShowPreview || features.length > 0) && !showPreview && (
                <MarkdownToolbar
                    editor={editor}
                    features={features}
                    onImageUpload={onImageUpload}
                    onPreviewToggle={shouldShowPreview ? handlePreviewToggle : undefined}
                    isPreviewing={showPreview}
                />
            )}

            {showPreview ? (
                <div className="p-4 min-h-[200px] prose prose-sm max-w-none">
                    <MarkdownRender content={value} compact={mode !== "full"} />
                </div>
            ) : (
                <EditorContent
                    editor={editor}
                    className="markdown-editor-content"
                />
            )}

            {showPreview && (
                <button
                    type="button"
                    onClick={handlePreviewToggle}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm text-text/50 hover:text-text/70 border-t border-text/10 w-full justify-center"
                >
                    <Edit3 className="w-3.5 h-3.5" />
                    Back to Edit
                </button>
            )}

            {showCharCount && (
                <div className="px-3 py-1.5 text-xs text-text/40 border-t border-text/10 text-right">
                    {charCount}{maxLength ? `/${maxLength}` : ""} characters
                </div>
            )}
        </div>
    )
}
```

**Step 2: Create the barrel export**

Create `components/ui/markdown-editor/index.ts`:

```typescript
export { default as MarkdownEditor } from "./MarkdownEditor"
export { default as MarkdownToolbar } from "./MarkdownToolbar"
export { TOOLBAR_PRESETS, type ToolbarFeature } from "./MarkdownToolbar"
export { getEditorExtensions, type EditorMode } from "./extensions"
```

**Step 3: Verify build**

Run: `bun build 2>&1 | head -30`

**Step 4: Commit**

```bash
git add components/ui/markdown-editor/
git commit -m "feat: add shared MarkdownEditor component with mode presets"
```

---

## Phase 2: Component Refactoring

### Task 4: Refactor `StorySection` to Use `MarkdownEditor`

**Files:**
- Modify: `components/cafe-editor/StorySection.tsx`

**Context:** Replace the plain `<textarea>` with `MarkdownEditor` in `medium` mode. This gives cafe story editors a proper WYSIWYG toolbar with headings, bold, italic, lists, links, blockquote, and image support.

**Step 1: Write the refactored StorySection**

Replace the content of `components/cafe-editor/StorySection.tsx`:

```tsx
"use client"

import { useState } from "react"
import { Save, Trash2, Loader2 } from "lucide-react"
import { type ColorScheme, getColorClasses } from "@/utils/hooks/cafe-form"
import MarkdownRender from "@/components/ui/MarkdownRender"
import MarkdownEditor from "@/components/ui/markdown-editor/MarkdownEditor"

interface StorySectionProps {
    content: string
    onChange: (content: string) => void
    onSave: () => Promise<void>
    onDelete?: () => Promise<void>
    hasChanges: boolean
    saving: boolean
    colorScheme?: ColorScheme
}

export default function StorySection({
    content,
    onChange,
    onSave,
    onDelete,
    hasChanges,
    saving,
    colorScheme = "primary",
}: StorySectionProps) {
    const colors = getColorClasses(colorScheme)

    return (
        <div className="space-y-4">
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-text/60">
                        Cafe Story (Markdown)
                    </label>
                    <div className="flex items-center gap-2">
                        {content && onDelete && (
                            <button
                                type="button"
                                onClick={async () => {
                                    if (!confirm("Are you sure you want to delete this story?")) return
                                    await onDelete()
                                }}
                                disabled={saving}
                                className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 text-red-500 rounded-lg text-sm hover:bg-red-500/30 transition disabled:opacity-50"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete
                            </button>
                        )}
                        {hasChanges && (
                            <button
                                type="button"
                                onClick={onSave}
                                disabled={saving}
                                className={`flex items-center gap-1 px-3 py-1.5 ${colors.bgLight} ${colors.text} rounded-lg text-sm hover:opacity-80 transition disabled:opacity-50`}
                            >
                                {saving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                Save Story
                            </button>
                        )}
                    </div>
                </div>

                <MarkdownEditor
                    mode="medium"
                    value={content}
                    onChange={onChange}
                    placeholder="Write your cafe's story... Use the toolbar for formatting."
                    minHeight={300}
                    colorScheme={colorScheme}
                />
            </div>
        </div>
    )
}
```

**Step 2: Verify StorySection builds**

Run: `bun build 2>&1 | grep -i "StorySection\|error" | head -10`

**Step 3: Test manually**

1. Navigate to cafe editor (admin) or cafe edit (owner)
2. Verify the StorySection now shows a TipTap WYSIWYG editor with a toolbar
3. Test formatting: bold, italic, headings, lists, links
4. Test that saving and loading works correctly
5. Test that existing markdown content renders properly in the editor

**Step 4: Commit**

```bash
git add components/cafe-editor/StorySection.tsx
git commit -m "refactor: StorySection to use MarkdownEditor medium mode"
```

---

### Task 5: Refactor `ReviewModal` to Use `MarkdownEditor`

**Files:**
- Modify: `components/reviews/ReviewModal.tsx`

**Context:** Replace the plain `<textarea>` in the review modal with `MarkdownEditor` in `light` mode. This gives reviewers basic formatting (bold, italic, inline code, lists, links) with a preview toggle.

**Step 1: Write the refactored ReviewModal**

The key change is replacing the `<textarea>` around line 206-213 with the `MarkdownEditor`:

Replace the review content section (approximately lines 200-218) with:

```tsx
<div className="w-full space-y-2">
    <label className="text-sm font-medium text-text/60">
        Your Review
    </label>
    <MarkdownEditor
        mode="light"
        value={comment}
        onChange={setComment}
        placeholder="Share your experience..."
        showCharCount
        className="border-0"
    />
    {comment.length < 10 && comment.length > 0 && (
        <p className="text-xs text-text/40">
            {10 - comment.length} more characters needed
        </p>
    )}
</div>
```

Add the import at the top:

```tsx
import MarkdownEditor from "@/components/ui/markdown-editor/MarkdownEditor"
```

**Step 2: Verify build**

Run: `bun build 2>&1 | grep -i "ReviewModal\|error" | head -10`

**Step 3: Test manually**

1. Navigate to a cafe page and click "Write a Review"
2. Verify the review modal now shows a TipTap editor with light toolbar
3. Test basic formatting: bold, italic, inline code, lists, links
4. Test the preview toggle
5. Test that review submission works
6. Test that existing reviews with Markdown render properly on the page

**Step 4: Commit**

```bash
git add components/reviews/ReviewModal.tsx
git commit -m "refactor: ReviewModal to use MarkdownEditor light mode"
```

---

### Task 6: Refactor Owner Review Response Editor

**Files:**
- Modify: `components/owner/CafeManagement.tsx`

**Context:** Replace the plain `<textarea>` in the owner review response section with `MarkdownEditor` in `minimal` mode. Also update the rendering of owner responses to use `MarkdownRender`.

**Step 1: Add MarkdownEditor import**

Add to the imports section of `CafeManagement.tsx`:

```tsx
import MarkdownEditor from "@/components/ui/markdown-editor/MarkdownEditor"
import MarkdownRender from "@/components/ui/MarkdownRender"
```

**Step 2: Replace the owner response textarea**

Find the textarea around lines 1386-1397 and replace with:

```tsx
<MarkdownEditor
    mode="minimal"
    value={responseText}
    onChange={setResponseText}
    placeholder="Write your response..."
    maxLength={1000}
    showCharCount
    minHeight={80}
    className="small"
/>
```

Note: We need a custom CSS variant for the "small" class on the editor wrapper to make it fit in the review response context. We'll add this as a Tailwind utility or inline style. The "small" class should reduce padding and font size.

Actually, for the owner response, the `MarkdownEditor` border styling might conflict with the existing card layout. Let's use a simpler approach - just use `className` prop to override:

```tsx
<MarkdownEditor
    mode="minimal"
    value={responseText}
    onChange={setResponseText}
    placeholder="Write your response..."
    showCharCount
    className="border-text/20"
/>
```

**Step 3: Replace the owner response rendering with MarkdownRender**

Find line 1371-1375 where owner response text is rendered:

```tsx
<p className='text-sm text-text/80 mt-1'>
    {review.owner_response.response}
</p>
```

Replace with:

```tsx
<div className='text-sm text-text/80 mt-1'>
    <MarkdownRender content={review.owner_response.response} compact />
</div>
```

Also update the review.comment rendering at line 1346-1348:

```tsx
// Change from:
<p className='mt-3 text-text/80'>
    {review.comment}
</p>
// To:
<div className='mt-3 text-text/80'>
    <MarkdownRender content={review.comment} compact />
</div>
```

**Step 4: Update ReviewItem.tsx owner response rendering**

In `components/reviews/ReviewItem.tsx`, find lines 317-320:

```tsx
<p className='text-sm text-text/70 leading-relaxed'>
    {review.owner_response.response_text}
</p>
```

Replace with:

```tsx
<div className='text-sm text-text/70 leading-relaxed'>
    <MarkdownRender content={review.owner_response.response_text} compact />
</div>
```

**Step 5: Verify build**

Run: `bun build 2>&1 | grep -i "CafeManagement\|ReviewItem\|error" | head -10`

**Step 6: Commit**

```bash
git add components/owner/CafeManagement.tsx components/reviews/ReviewItem.tsx
git commit -m "refactor: owner review response to use MarkdownEditor and MarkdownRender"
```

---

### Task 7: Refactor Cafe Description Editor

**Files:**
- Modify: `components/owner/CafeEdit.tsx`

**Context:** Replace the plain `<textarea>` for cafe description with `MarkdownEditor` in `description` mode. This allows bold, italic, and links in short descriptions.

**Step 1: Replace the description textarea**

In `CafeEdit.tsx`, find the description textarea (around lines 346-370) and replace with:

```tsx
<div>
    <label className='block text-sm font-medium text-text/60 mb-2'>
        Description
    </label>
    <MarkdownEditor
        mode="description"
        value={cafe.description || ""}
        onChange={(value) => {
            if (value.length <= 300) {
                updateField("description", value)
            }
        }}
        maxLength={300}
        showCharCount
        placeholder="Tell us about this cafe..."
        minHeight={80}
    />
</div>
```

Add the import:

```tsx
import MarkdownEditor from "@/components/ui/markdown-editor/MarkdownEditor"
```

**Step 2: Update cafe description rendering in CafeDetails**

In `components/cafe/CafeDetails.tsx`, find where `cafe.description` is rendered and wrap it with `MarkdownRender`. Search for where description is displayed — it's likely in a paragraph tag.

Search for `cafe.description` in `CafeDetails.tsx` and replace plain text rendering with:

```tsx
<MarkdownRender content={cafe.description || ""} compact />
```

**Step 3: Verify build**

Run: `bun build 2>&1 | grep -i "CafeEdit\|CafeDetails\|error" | head -10`

**Step 4: Commit**

```bash
git add components/owner/CafeEdit.tsx components/cafe/CafeDetails.tsx
git commit -m "refactor: cafe description to use MarkdownEditor and MarkdownRender"
```

---

## Phase 3: Rendering Consistency Fixes

### Task 8: Ensure All MarkdownRender Usages Are Consistent

**Files:**
- Modify: `app/blog/[slug]/page.tsx`
- Audit: All components using `MarkdownRender`

**Context:** The blog page wraps `MarkdownRender` in extra `prose` classes that conflict with `MarkdownRender`'s built-in styles. We need to remove the duplicate styling.

**Step 1: Fix blog page double-styling**

In `app/blog/[slug]/page.tsx`, line 268, change:

```tsx
// FROM:
<div className='prose prose-lg prose-stone max-w-none mb-12'>
    <MarkdownRender content={post.content} />
</div>

// TO:
<div className='max-w-none mb-12'>
    <MarkdownRender content={post.content} />
</div>
```

**Step 2: Audit all MarkdownRender usages**

Search for all `<MarkdownRender` usages and verify they're consistent:

```bash
rg "MarkdownRender" --include="*.tsx" -l
```

Verify each usage:
- `components/blog/RichBlogEditor.tsx` — if it uses MarkdownRender, check styling
- `components/cafe/CafeDetails.tsx` — already being updated in Task 7
- `components/cafe-editor/StorySection.tsx` — preview mode, already fine
- `components/reviews/ReviewItem.tsx` — already being updated in Task 6
- `components/chat/ChatMessage.tsx` — uses `compact`, correct
- `components/manage/PostPreviewModal.tsx` — needs to be checked

**Step 3: Check PostPreviewModal**

Read `components/manage/PostPreviewModal.tsx` and verify its `MarkdownRender` usage doesn't have double `prose` classes.

**Step 4: Commit**

```bash
git add app/blog/[slug]/page.tsx
git commit -m "fix: remove duplicate prose styling around MarkdownRender on blog page"
```

---

### Task 9: Add MarkdownRender `compact` Prop to Cafe Description Display

**Files:**
- Modify: `components/cafe/CafeDetails.tsx`
- Check: `components/owner/CafeEdit.tsx` (description character count display)

**Context:** When we render cafe descriptions as Markdown, we should use `compact` mode since descriptions are short.

**Step 1: In CafeDetails.tsx, find where `cafe.description` is displayed and use compact mode**

Search for the description display in CafeDetails and ensure it uses:

```tsx
<MarkdownRender content={cafe.description || ""} compact />
```

**Step 2: Verify description display in cafe cards**

Check if cafe descriptions appear in any card/list components. If so, those should also use `compact`.

```bash
rg "description" --include="*.tsx" -l | head -20
```

**Step 3: Commit**

```bash
git add components/cafe/CafeDetails.tsx
git commit -m "fix: use compact MarkdownRender for cafe descriptions"
```

---

## Phase 4: Blog Editor Cleanup

### Task 10: Refactor RichBlogEditor to Use Shared Extensions

**Files:**
- Modify: `components/blog/editor/extensions.ts`
- Modify: `components/blog/RichBlogEditor.tsx`

**Context:** The blog editor should use the shared `getEditorExtensions("full", placeholder)` function instead of its own private version. This reduces duplication and ensures the blog editor stays in sync with the shared module.

**Step 1: Update `components/blog/editor/extensions.ts`**

Replace its contents with a re-export from the shared module:

```typescript
import { getEditorExtensions } from "@/components/ui/markdown-editor/extensions"
import type { EditorMode } from "@/components/ui/markdown-editor/extensions"

export { getEditorExtensions }
export type { EditorMode }
```

Wait — the blog editor's `getEditorExtensions` currently accepts an optional `placeholder` string parameter and calls `Placeholder.configure()`. Our shared version should handle this the same way. Let me check if our shared version already does.

Yes, in the shared `extensions.ts`, `getEditorExtensions(mode, placeholder)` already handles the placeholder. But the blog editor currently includes `Placeholder` in its extensions list even without a custom placeholder — it defaults to `"Start writing your post... Type / for commands"`.

We need to make sure the blog editor call passes the same placeholder. In `RichBlogEditor.tsx`, the editor is initialized with:

```tsx
const editor = useEditor({
    extensions: getEditorExtensions("Start writing your post... Type / for commands"),
    // ...
})
```

We need to change this to:

```tsx
const editor = useEditor({
    extensions: getEditorExtensions("full", "Start writing your post... Type / for commands"),
    // ...
})
```

And the blog editor's `extensions.ts` can delegate to the shared module:

```typescript
// Re-export from shared module for backward compatibility
export { getEditorExtensions } from "@/components/ui/markdown-editor/extensions"
```

**Step 2: Update the blog's `EditorToolbar.tsx` to optionally use shared toolbar**

The blog editor has its own `EditorToolbar.tsx` which is more complex than the shared `MarkdownToolbar`. For now, we keep the blog's specialized toolbar since it has image upload integration and other blog-specific features. The shared `MarkdownToolbar` is for non-blog editors.

However, we should ensure the blog toolbar can coexist. No changes needed to `EditorToolbar.tsx` at this stage — it remains blog-specific.

**Step 3: Verify the blog editor still works**

Run: `bun build 2>&1 | grep -i "error" | head -10`

Test the blog editor:
1. Navigate to `/blog/new` (admin)
2. Type text, use toolbar formatting
3. Verify bold, italic, headings, lists all work
4. Test saving and publishing

**Step 4: Commit**

```bash
git add components/blog/editor/extensions.ts components/blog/RichBlogEditor.tsx
git commit -m "refactor: blog editor to use shared TipTap extensions module"
```

---

### Task 11: Fix Slash Command Extension Dead Code

**Files:**
- Modify: `components/blog/editor/SlashCommandList.tsx`
- Modify: `components/blog/editor/extensions.ts` (or shared extensions)

**Context:** The `SlashCommandExtension` is defined in `SlashCommandList.tsx` but not connected to the editor's extensions. We should either:
1. Connect it properly to the blog editor, or
2. Remove the dead code

Since implementing slash commands properly requires more work (suggestion UI, filtering, etc.) and the blog editor already has a toolbar, we'll add a TODO comment and leave the code but not connect it yet. This is a separate feature.

**Step 1: Read the SlashCommandList.tsx to understand its current state**

Read `components/blog/editor/SlashCommandList.tsx` to verify what's there.

**Step 2: If the extension is completely disconnected, remove the unused import and add a comment**

If `SlashCommandExtension` is exported but never imported by `extensions.ts`, we can safely leave it as-is with a documentation comment. But if it's causing TypeScript warnings, clean those up.

**Step 3: Commit**

```bash
git add components/blog/editor/SlashCommandList.tsx
git commit -m "docs: add TODO comment for unimplemented slash command extension"
```

---

## Phase 5: Lint & Build Error Fixes

### Task 12: Run Lint and Fix All Issues

**Files:**
- All modified files from Phases 1-4

**Step 1: Run the linter**

```bash
bun lint 2>&1
```

**Step 2: Fix all lint errors**

Address each error:
- Unused imports
- Missing type annotations
- Formatting issues
- Any `any` types that need proper typing

**Step 3: Re-run lint to confirm clean**

```bash
bun lint 2>&1
```

Expected: No errors

**Step 4: Commit**

```bash
git add -A
git commit -m "fix: resolve all lint errors from markdown editor refactoring"
```

---

### Task 13: Run Build and Fix All Errors

**Step 1: Run production build**

```bash
bun build 2>&1
```

**Step 2: Fix all build errors**

Common issues to expect:
- Type errors from new components
- Missing exports
- Client component boundaries (`"use client"` directives)
- Import path issues

**Step 3: Fix all build warnings**

Review warnings and fix as appropriate (e.g., deprecated APIs, unnecessary casts).

**Step 4: Verify clean build**

```bash
bun build 2>&1 | tail -5
```

Expected: Build succeeds with no errors

**Step 5: Commit**

```bash
git add -A
git commit -m "fix: resolve all build errors and warnings from markdown editor refactoring"
```

---

### Task 14: Run Tests and Fix Any Failures

**Step 1: Run the test suite**

```bash
bun test 2>&1
```

**Step 2: Fix any test failures**

If any tests fail due to the refactoring:
- Update component imports
- Fix any snapshot tests that reference old component structure
- Update any tests that mock the old textarea-based editors

**Step 3: Re-run tests to confirm clean**

```bash
bun test 2>&1
```

Expected: All tests pass

**Step 4: Commit**

```bash
git add -A
git commit -m "fix: resolve all test failures from markdown editor refactoring"
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `components/ui/markdown-editor/extensions.ts` | **NEW** — Shared TipTap extensions module with mode presets |
| `components/ui/markdown-editor/MarkdownToolbar.tsx` | **NEW** — Shared toolbar component with feature presets |
| `components/ui/markdown-editor/MarkdownEditor.tsx` | **NEW** — Shared TipTap editor wrapper with mode presets |
| `components/ui/markdown-editor/index.ts` | **NEW** — Barrel exports |
| `components/cafe-editor/StorySection.tsx` | **MODIFIED** — Replaced textarea with MarkdownEditor (medium mode) |
| `components/reviews/ReviewModal.tsx` | **MODIFIED** — Replaced textarea with MarkdownEditor (light mode) |
| `components/owner/CafeManagement.tsx` | **MODIFIED** — Owner response: MarkdownEditor (minimal), MarkdownRender for display |
| `components/reviews/ReviewItem.tsx` | **MODIFIED** — Owner response rendered with MarkdownRender (compact) |
| `components/owner/CafeEdit.tsx` | **MODIFIED** — Description: MarkdownEditor (description mode) |
| `components/cafe/CafeDetails.tsx` | **MODIFIED** — Description: MarkdownRender (compact) |
| `components/blog/editor/extensions.ts` | **MODIFIED** — Delegates to shared module |
| `components/blog/RichBlogEditor.tsx` | **MODIFIED** — Uses shared extensions |
| `app/blog/[slug]/page.tsx` | **MODIFIED** — Removed duplicate prose styling |

## Key Design Decisions

1. **TipTap for all editors** — Consistent UX across the app; reuse existing dependency
2. **Mode presets** — Each editing context gets appropriate features without overloading
3. **Backward compatibility** — Blog editor keeps its specialized toolbar; shared module is additive
4. **Markdown serialization** — All editors save Markdown strings, same as current approach
5. **Rendering consistency** — All Markdown output rendered through the shared `MarkdownRender` component
6. **Incremental rollout** — Each task can be deployed independently; no big-bang migration