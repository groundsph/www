"use client"

import { useState, useCallback } from "react"
import { Editor } from "@tiptap/react"
import {
    Bold, Italic, Strikethrough, Code,
    List, ListOrdered, ListChecks, Quote, CodeSquare, LinkIcon,
    ImageIcon, Minus, HelpCircle, ChevronDown,
    Table2, Rows3, Columns3, Trash2,
} from "lucide-react"
import ShortcutHelpModal from "./ShortcutHelpModal"

interface EditorToolbarProps {
    editor: Editor | null
    onImageUpload: () => void
}

type HeadingLevel = 1 | 2 | 3 | 0

const ToolbarButton = ({
    onClick,
    isActive,
    title,
    children,
}: {
    onClick: () => void
    isActive?: boolean
    title: string
    children: React.ReactNode
}) => (
    <button
        type="button"
        onClick={onClick}
        title={title}
        className={`p-1.5 rounded-lg transition-colors ${
            isActive
                ? "bg-primary/10 text-primary"
                : "text-text/60 hover:bg-text/5 hover:text-text"
        }`}
    >
        {children}
    </button>
)

export default function EditorToolbar({ editor, onImageUpload }: EditorToolbarProps) {
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

    const headingLabel = currentHeading === 0 ? "Paragraph" : `Heading ${currentHeading}`

    return (
        <>
            <div className="flex items-center gap-0.5 flex-wrap px-3 py-2 border-b border-text/10 bg-tertiary/10">
                {/* Heading Dropdown */}
                <div className="relative mr-1">
                    <button
                        type="button"
                        onClick={() => setShowHeadingDropdown(!showHeadingDropdown)}
                        className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm text-text/70 hover:bg-text/5 transition-colors"
                    >
                        <span className="min-w-[80px] text-left">{headingLabel}</span>
                        <ChevronDown className="w-3 h-3" />
                    </button>
                    {showHeadingDropdown && (
                        <div className="absolute top-full left-0 mt-1 bg-background border border-text/10 rounded-xl shadow-lg z-20 overflow-hidden min-w-[140px]">
                            {([0, 1, 2, 3] as HeadingLevel[]).map((level) => (
                                <button
                                    key={level}
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
                                        currentHeading === level ? "bg-primary/5 text-primary font-medium" : "text-text/70"
                                    }`}
                                >
                                    {level === 0 ? "Paragraph" : `Heading ${level}`}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="w-px h-5 bg-text/10 mx-1" />

                {/* Text Formatting */}
                <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive("bold")} title="Bold (Ctrl+B)">
                    <Bold className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive("italic")} title="Italic (Ctrl+I)">
                    <Italic className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive("strike")} title="Strikethrough (Ctrl+Shift+X)">
                    <Strikethrough className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive("code")} title="Inline Code (Ctrl+E)">
                    <Code className="w-4 h-4" />
                </ToolbarButton>

                <div className="w-px h-5 bg-text/10 mx-1" />

                {/* Lists */}
                <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive("bulletList")} title="Bullet List">
                    <List className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive("orderedList")} title="Ordered List">
                    <ListOrdered className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} isActive={editor.isActive("taskList")} title="Task List">
                    <ListChecks className="w-4 h-4" />
                </ToolbarButton>

                <div className="w-px h-5 bg-text/10 mx-1" />

                {/* Block Elements */}
                <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive("blockquote")} title="Blockquote">
                    <Quote className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive("codeBlock")} title="Code Block">
                    <CodeSquare className="w-4 h-4" />
                </ToolbarButton>

                <div className="w-px h-5 bg-text/10 mx-1" />

                {/* Insert */}
                <ToolbarButton onClick={setLink} isActive={editor.isActive("link")} title="Link (Ctrl+K)">
                    <LinkIcon className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton onClick={onImageUpload} title="Insert Image">
                    <ImageIcon className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule">
                    <Minus className="w-4 h-4" />
                </ToolbarButton>

                {/* Table Controls (shown when inside a table) */}
                {editor.isActive("table") && (
                    <>
                        <div className="w-px h-5 bg-text/10 mx-1" />
                        <ToolbarButton onClick={() => editor.chain().focus().addRowBefore().run()} title="Add Row Before">
                            <Rows3 className="w-4 h-4 rotate-180" />
                        </ToolbarButton>
                        <ToolbarButton onClick={() => editor.chain().focus().addRowAfter().run()} title="Add Row After">
                            <Rows3 className="w-4 h-4" />
                        </ToolbarButton>
                        <ToolbarButton onClick={() => editor.chain().focus().addColumnBefore().run()} title="Add Column Before">
                            <Columns3 className="w-4 h-4 rotate-180" />
                        </ToolbarButton>
                        <ToolbarButton onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add Column After">
                            <Columns3 className="w-4 h-4" />
                        </ToolbarButton>
                        <div className="w-px h-5 bg-text/10 mx-1" />
                        <ToolbarButton onClick={() => editor.chain().focus().deleteRow().run()} title="Delete Row">
                            <Trash2 className="w-4 h-4 rotate-180" />
                        </ToolbarButton>
                        <ToolbarButton onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete Column">
                            <Trash2 className="w-4 h-4 rotate-90" />
                        </ToolbarButton>
                        <ToolbarButton onClick={() => editor.chain().focus().deleteTable().run()} title="Delete Table">
                            <Table2 className="w-4 h-4" />
                        </ToolbarButton>
                    </>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Help */}
                <ToolbarButton onClick={() => setShowShortcutHelp(true)} title="Keyboard Shortcuts">
                    <HelpCircle className="w-4 h-4" />
                </ToolbarButton>
            </div>

            <ShortcutHelpModal isOpen={showShortcutHelp} onClose={() => setShowShortcutHelp(false)} />
        </>
    )
}
