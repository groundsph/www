"use client"

import { Editor } from "@tiptap/react"
import {
    Bold, Italic, Strikethrough, Code,
    List, ListOrdered, ListChecks, Quote, CodeSquare, LinkIcon,
    ImageIcon, Minus, HelpCircle, ChevronDown,
    Table2, Heading1, Heading2, Heading3, Type, Eye,
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

interface RenderFeatureParams {
    feature: ToolbarFeature
    iconSize: string
    editor: Editor
    currentHeading: HeadingLevel
    showHeadingDropdown: boolean
    setShowHeadingDropdown: (show: boolean) => void
    setShowShortcutHelp: (show: boolean) => void
    onImageUpload?: () => void
    isPreviewing: boolean
    onPreviewToggle?: () => void
}

function renderFeature({
    feature,
    iconSize,
    editor,
    currentHeading,
    showHeadingDropdown,
    setShowHeadingDropdown,
    setShowShortcutHelp,
    onImageUpload,
    isPreviewing,
    onPreviewToggle,
}: RenderFeatureParams) {
    const setLink = () => {
        const previousUrl = editor.getAttributes("link").href as string
        const url = window.prompt("URL", previousUrl)
        if (url === null) return
        if (url === "") {
            editor.chain().focus().extendMarkRange("link").unsetLink().run()
            return
        }
        editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
    }

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
                    <Eye className={iconSize} />
                </ToolbarButton>
            )
        default:
            return null
    }
}

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

    const hasDividerBefore = (feature: ToolbarFeature, index: number) => {
        if (index === 0) return false
        const prevFeature = features[index - 1]
        const dividersAfter: ToolbarFeature[] = ["inlineCode", "taskList", "codeBlock", "image"]
        return dividersAfter.includes(prevFeature)
    }

    const iconSize = features.includes("preview") ? "w-3.5 h-3.5" : "w-4 h-4"

    return (
        <>
            <div className={`flex items-center gap-0.5 flex-wrap px-2 py-1.5 border-b border-text/10 bg-tertiary/10 ${className}`}>
                {features.map((feature, i) => {
                    if (hasDividerBefore(feature, i)) {
                        return [<ToolbarDivider key={`div-${i}`} />, renderFeature({
                            feature,
                            iconSize,
                            editor,
                            currentHeading,
                            showHeadingDropdown,
                            setShowHeadingDropdown,
                            setShowShortcutHelp,
                            onImageUpload,
                            isPreviewing,
                            onPreviewToggle,
                        })]
                    }
                    return renderFeature({
                        feature,
                        iconSize,
                        editor,
                        currentHeading,
                        showHeadingDropdown,
                        setShowHeadingDropdown,
                        setShowShortcutHelp,
                        onImageUpload,
                        isPreviewing,
                        onPreviewToggle,
                    })
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
}
