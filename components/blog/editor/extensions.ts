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

export function getEditorExtensions(placeholder?: string) {
    return [
        StarterKit.configure({
            codeBlock: false,
            link: false,
        }),
        Link.configure({
            openOnClick: false,
            HTMLAttributes: {
                class: "text-primary underline cursor-pointer",
            },
        }),
        Image.configure({
            HTMLAttributes: {
                class: "rounded-lg max-w-full h-auto my-4",
            },
        }),
        Placeholder.configure({
            placeholder: placeholder || "Start writing your post... Type / for commands",
        }),
        TaskList,
        TaskItem.configure({
            nested: true,
        }),
        CodeBlockLowlight.configure({
            lowlight,
        }),
        Table.configure({
            resizable: true,
        }),
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
        Markdown.configure({
            html: false,
            transformCopiedText: true,
            transformPastedText: true,
        }),
    ]
}
