"use client"

import { useCallback } from "react"
import { Editor } from "@tiptap/react"

interface MarkdownStorage {
    getMarkdown: () => string
}

/**
 * Extracts Markdown content from a TipTap editor instance.
 * Uses the tiptap-markdown extension's storage.
 */
export function useEditorContent(editor: Editor | null) {
    const getMarkdown = useCallback((): string => {
        if (!editor) return ""
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const md = (editor.storage as any).markdown as MarkdownStorage | undefined
        if (md?.getMarkdown) return md.getMarkdown()
        return editor.getText()
    }, [editor])

    const isEmpty = useCallback((): boolean => {
        if (!editor) return true
        return editor.isEmpty
    }, [editor])

    return { getMarkdown, isEmpty }
}
