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
            const md = (e.storage as unknown as Record<string, unknown>).markdown as { getMarkdown: () => string } | undefined
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
            const currentContent = (editor.storage as unknown as Record<string, unknown>).markdown as { getMarkdown: () => string } | undefined
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
                const md = (editor.storage as unknown as Record<string, unknown>).markdown as { getMarkdown: () => string } | undefined
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
