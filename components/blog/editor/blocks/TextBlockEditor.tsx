"use client"

import { useEffect, useMemo, useRef } from "react"
import { useEditor, EditorContent, type Editor } from "@tiptap/react"
import { getEditorExtensions } from "@/components/ui/markdown-editor/extensions"
import EditorToolbar from "../EditorToolbar"
import TableFloatingToolbar from "../TableFloatingToolbar"

interface TextBlockEditorProps {
    value: string
    onChange: (markdown: string) => void
    uploadImage: (file: File) => Promise<string | null>
    placeholder?: string
    autoFocus?: boolean
}

function readMarkdown(editor: Editor): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const storage = (editor.storage as any).markdown as
        | { getMarkdown?: () => string }
        | undefined
    if (storage?.getMarkdown) return storage.getMarkdown()
    return editor.getText()
}

/**
 * A single rich-text block. Text blocks are independent TipTap instances so
 * they can be edited, reordered and deleted apart from media blocks.
 */
export default function TextBlockEditor({
    value,
    onChange,
    uploadImage,
    placeholder,
    autoFocus,
}: TextBlockEditorProps) {
    const onChangeRef = useRef(onChange)
    onChangeRef.current = onChange
    const uploadImageRef = useRef(uploadImage)
    uploadImageRef.current = uploadImage
    const editorRef = useRef<Editor | null>(null)

    const extensions = useMemo(
        () =>
            getEditorExtensions(
                "full",
                placeholder || "Start writing... Type / for commands"
            ),
        [placeholder]
    )

    const insertImage = async (file: File) => {
        const url = await uploadImageRef.current(file)
        if (url) editorRef.current?.chain().focus().setImage({ src: url }).run()
    }

    const editor = useEditor({
        extensions,
        content: value || "",
        immediatelyRender: false,
        editorProps: {
            attributes: {
                class: "prose prose-lg prose-stone max-w-none outline-none",
            },
            handleDrop: (_view, event, _slice, moved) => {
                if (!moved && event.dataTransfer?.files?.length) {
                    const file = event.dataTransfer.files[0]
                    if (file.type.startsWith("image/")) {
                        event.preventDefault()
                        void insertImage(file)
                        return true
                    }
                }
                return false
            },
            handlePaste: (_view, event) => {
                const items = event.clipboardData?.items
                if (!items) return false
                for (const item of Array.from(items)) {
                    if (item.type.startsWith("image/")) {
                        event.preventDefault()
                        const file = item.getAsFile()
                        if (file) void insertImage(file)
                        return true
                    }
                }
                return false
            },
        },
        onUpdate: ({ editor }) => {
            onChangeRef.current(readMarkdown(editor))
        },
    })

    editorRef.current = editor

    useEffect(() => {
        if (editor && autoFocus) {
            // Delay a tick so the newly inserted block is mounted first.
            const id = window.setTimeout(() => editor.commands.focus("end"), 0)
            return () => window.clearTimeout(id)
        }
    }, [editor, autoFocus])

    const handleToolbarImageUpload = () => {
        const input = document.createElement("input")
        input.type = "file"
        input.accept = "image/*"
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (file) void insertImage(file)
        }
        input.click()
    }

    // The shared slash-command menu requests an image upload via a global event.
    // Only the focused text block should respond.
    useEffect(() => {
        if (!editor) return
        const handler = () => {
            if (!editor.isFocused) return
            handleToolbarImageUpload()
        }
        window.addEventListener("editor:image-upload", handler)
        return () => window.removeEventListener("editor:image-upload", handler)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editor])

    return (
        <div className="overflow-hidden rounded-xl border border-text/15 bg-background transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
            <EditorToolbar editor={editor} onImageUpload={handleToolbarImageUpload} />
            <TableFloatingToolbar editor={editor} />
            <EditorContent
                editor={editor}
                className="min-h-[140px] p-4 md:p-6"
            />
        </div>
    )
}
