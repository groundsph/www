"use client"

/**
 * Slash Command Extension for TipTap editor.
 *
 * NOTE: This extension is currently disconnected and not integrated into the
 * blog editor. It requires additional work to implement the suggestion UI and
 * filtering logic before it can be used. The blog editor currently uses a
 * toolbar-based approach for inserting content blocks.
 *
 * TODO: Implement slash command suggestion UI or remove this extension.
 */

import { useState, useEffect, useRef, useCallback } from "react"
import {
    Heading1,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    ListChecks,
    Quote,
    CodeSquare,
    Minus,
    Image as ImageIcon,
    Link as LinkIcon,
    Youtube,
} from "lucide-react"
import { Table2 } from "lucide-react"
import { Editor, Range, Extension } from "@tiptap/core"
import Suggestion from "@tiptap/suggestion"

interface CommandItemProps {
    editor: Editor
    range: Range
}

interface CommandItem {
    title: string
    description: string
    icon: React.ReactNode
    command: (props: CommandItemProps) => void
}

interface SlashCommandListProps {
    items: CommandItem[]
    command: (item: CommandItem) => void
}

export default function SlashCommandList({
    items,
    command,
}: SlashCommandListProps) {
    const [selectedIndex, setSelectedIndex] = useState(0)
    const containerRef = useRef<HTMLDivElement>(null)

    const selectItem = useCallback(
        (index: number) => {
            const item = items[index]
            if (item) command(item)
        },
        [items, command]
    )

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedIndex(0)
    }, [items])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowUp") {
                e.preventDefault()
                setSelectedIndex((prev) => (prev + items.length - 1) % items.length)
            } else if (e.key === "ArrowDown") {
                e.preventDefault()
                setSelectedIndex((prev) => (prev + 1) % items.length)
            } else if (e.key === "Enter") {
                e.preventDefault()
                selectItem(selectedIndex)
            } else if (e.key === "Escape") {
                e.preventDefault()
            }
        }
        document.addEventListener("keydown", handleKeyDown)
        return () => document.removeEventListener("keydown", handleKeyDown)
    }, [items, selectedIndex, selectItem])

    useEffect(() => {
        const container = containerRef.current
        if (!container) return
        const selected = container.querySelector(`[data-index="${selectedIndex}"]`)
        if (selected) selected.scrollIntoView({ block: "nearest" })
    }, [selectedIndex])

    return (
        <div
            ref={containerRef}
            className="bg-background border border-text/10 rounded-xl shadow-lg overflow-hidden max-h-[300px] overflow-y-auto w-72"
        >
            <div className="p-2">
                <p className="text-xs text-text/40 px-2 py-1 font-medium uppercase tracking-wider">
                    Commands
                </p>
                {items.length === 0 ? (
                    <p className="text-sm text-text/50 px-2 py-3">
                        No commands found
                    </p>
                ) : (
                    items.map((item, index) => (
                        <button
                            key={item.title}
                            data-index={index}
                            onClick={() => selectItem(index)}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                                index === selectedIndex
                                    ? "bg-primary/10 text-primary"
                                    : "text-text/70 hover:bg-text/5"
                            }`}
                        >
                            <div className="w-8 h-8 rounded-lg bg-text/5 flex items-center justify-center shrink-0">
                                {item.icon}
                            </div>
                            <div>
                                <p className="text-sm font-medium">{item.title}</p>
                                <p className="text-xs text-text/50">
                                    {item.description}
                                </p>
                            </div>
                        </button>
                    ))
                )}
            </div>
        </div>
    )
}

export function getSlashCommands(): CommandItem[] {
    return [
        {
            title: "Heading 1",
            description: "Large section heading",
            icon: <Heading1 className="w-4 h-4" />,
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run()
            },
        },
        {
            title: "Heading 2",
            description: "Medium section heading",
            icon: <Heading2 className="w-4 h-4" />,
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run()
            },
        },
        {
            title: "Heading 3",
            description: "Small section heading",
            icon: <Heading3 className="w-4 h-4" />,
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run()
            },
        },
        {
            title: "Bullet List",
            description: "Unordered list of items",
            icon: <List className="w-4 h-4" />,
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).toggleBulletList().run()
            },
        },
        {
            title: "Ordered List",
            description: "Numbered list of items",
            icon: <ListOrdered className="w-4 h-4" />,
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).toggleOrderedList().run()
            },
        },
        {
            title: "Task List",
            description: "Checklist with checkboxes",
            icon: <ListChecks className="w-4 h-4" />,
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).toggleTaskList().run()
            },
        },
        {
            title: "Blockquote",
            description: "Quote or callout block",
            icon: <Quote className="w-4 h-4" />,
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).toggleBlockquote().run()
            },
        },
        {
            title: "Code Block",
            description: "Code with syntax highlighting",
            icon: <CodeSquare className="w-4 h-4" />,
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
            },
        },
        {
            title: "Divider",
            description: "Horizontal rule separator",
            icon: <Minus className="w-4 h-4" />,
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).setHorizontalRule().run()
            },
        },
        {
            title: "Image",
            description: "Upload an inline image",
            icon: <ImageIcon className="w-4 h-4" />,
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).run()
                window.dispatchEvent(
                    new CustomEvent("editor:image-upload", { detail: { file: null } })
                )
            },
        },
        {
            title: "Table",
            description: "Insert a 3x3 table",
            icon: <Table2 className="w-4 h-4" />,
            command: ({ editor, range }) => {
                editor.chain()
                    .focus()
                    .deleteRange(range)
                    .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                    .run()
            },
        },
        {
            title: "Link",
            description: "Insert a hyperlink",
            icon: <LinkIcon className="w-4 h-4" />,
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).run()
                const url = window.prompt("Enter URL:")
                if (url) editor.chain().focus().setLink({ href: url }).run()
            },
        },
        {
            title: "YouTube",
            description: "Embed a YouTube video",
            icon: <Youtube className="w-4 h-4" />,
            command: ({ editor, range }) => {
                const url = window.prompt("Enter YouTube URL:")
                if (url)
                    editor.chain().focus().deleteRange(range).setYoutubeVideo({ src: url }).run()
            },
        },
    ]
}

export const SlashCommandExtension = Extension.create({
    name: "slashCommand",
    addOptions() {
        return {
            suggestion: {
                char: "/",
                startOfLine: false,
                command: ({ editor, range, props }: { editor: Editor; range: Range; props: CommandItem }) => {
                    props.command({ editor, range })
                },
            },
        }
    },
    addProseMirrorPlugins() {
        return [
            Suggestion({
                editor: this.editor,
                ...this.options.suggestion,
            }),
        ]
    },
})
