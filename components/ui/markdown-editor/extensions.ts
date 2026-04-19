import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Image from "@tiptap/extension-image"
import Placeholder from "@tiptap/extension-placeholder"
import { Extension } from "@tiptap/core"
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

const imageExtension = Image.configure({
    HTMLAttributes: {
        class: "rounded-lg max-w-full h-auto my-4",
    },
})

export function getEditorExtensions(
    mode: EditorMode,
    placeholder?: string,
) {
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

    const extensions: any[] = [
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

    if (mode === "medium" || mode === "full") {
        extensions.push(
            Placeholder.configure({
                placeholder: placeholder || "Start writing...",
            }),
        )
    } else if (placeholder) {
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

    return extensions
}