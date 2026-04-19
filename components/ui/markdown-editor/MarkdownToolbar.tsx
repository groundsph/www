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

    const e = editor

    const currentHeading: HeadingLevel = e.isActive("heading", { level: 1 })
        ? 1
        : e.isActive("heading", { level: 2 })
            ? 2
            : e.isActive("heading", { level: 3 })
                ? 3
                : 0

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
                                                e.chain().focus().setParagraph().run()
                                            } else {
                                                e.chain().focus().toggleHeading({ level }).run()
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
                        onClick={() => e.chain().focus().toggleBold().run()}
                        isActive={e.isActive("bold")}
                        title="Bold (Ctrl+B)"
                    >
                        <Bold className={iconSize} />
                    </ToolbarButton>
                )
            case "italic":
                return (
                    <ToolbarButton
                        key="italic"
                        onClick={() => e.chain().focus().toggleItalic().run()}
                        isActive={e.isActive("italic")}
                        title="Italic (Ctrl+I)"
                    >
                        <Italic className={iconSize} />
                    </ToolbarButton>
                )
            case "strikethrough":
                return (
                    <ToolbarButton
                        key="strikethrough"
                        onClick={() => e.chain().focus().toggleStrike().run()}
                        isActive={e.isActive("strike")}
                        title="Strikethrough"
                    >
                        <Strikethrough className={iconSize} />
                    </ToolbarButton>
                )
            case "inlineCode":
                return (
                    <ToolbarButton
                        key="inlineCode"
                        onClick={() => e.chain().focus().toggleCode().run()}
                        isActive={e.isActive("code")}
                        title="Inline Code (Ctrl+E)"
                    >
                        <Code className={iconSize} />
                    </ToolbarButton>
                )
            case "bulletList":
                return (
                    <ToolbarButton
                        key="bulletList"
                        onClick={() => e.chain().focus().toggleBulletList().run()}
                        isActive={e.isActive("bulletList")}
                        title="Bullet List"
                    >
                        <List className={iconSize} />
                    </ToolbarButton>
                )
            case "orderedList":
                return (
                    <ToolbarButton
                        key="orderedList"
                        onClick={() => e.chain().focus().toggleOrderedList().run()}
                        isActive={e.isActive("orderedList")}
                        title="Ordered List"
                    >
                        <ListOrdered className={iconSize} />
                    </ToolbarButton>
                )
            case "taskList":
                return (
                    <ToolbarButton
                        key="taskList"
                        onClick={() => e.chain().focus().toggleTaskList().run()}
                        isActive={e.isActive("taskList")}
                        title="Task List"
                    >
                        <ListChecks className={iconSize} />
                    </ToolbarButton>
                )
            case "blockquote":
                return (
                    <ToolbarButton
                        key="blockquote"
                        onClick={() => e.chain().focus().toggleBlockquote().run()}
                        isActive={e.isActive("blockquote")}
                        title="Blockquote"
                    >
                        <Quote className={iconSize} />
                    </ToolbarButton>
                )
            case "codeBlock":
                return (
                    <ToolbarButton
                        key="codeBlock"
                        onClick={() => e.chain().focus().toggleCodeBlock().run()}
                        isActive={e.isActive("codeBlock")}
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
                        isActive={e.isActive("link")}
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
                        onClick={() => e.chain().focus().setHorizontalRule().run()}
                        title="Horizontal Rule"
                    >
                        <Minus className={iconSize} />
                    </ToolbarButton>
                )
            case "table":
                return (
                    <ToolbarButton
                        key="table"
                        onClick={() => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
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
