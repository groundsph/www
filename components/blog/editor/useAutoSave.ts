"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { AutoSaveState } from "./types"
import { autoSaveDraft } from "@/app/api/actions/blog"
import { BlogCategory } from "@/utils/types/blog"

interface AutoSaveConfig {
    postId?: string
    title: string
    content: string
    excerpt?: string
    coverImage?: string | null
    category: BlogCategory
    tags?: string[]
    enabled?: boolean
    onPostCreated?: (postId: string) => void
}

const LOCAL_STORAGE_PREFIX = "blog-draft-"
const LOCAL_DEBOUNCE_MS = 500
const SERVER_INTERVAL_MS = 60000

function getStorageKey(postId?: string) {
    return `${LOCAL_STORAGE_PREFIX}${postId || "new"}`
}

interface DraftData {
    title: string
    content: string
    excerpt?: string
    coverImage?: string | null
    category: BlogCategory
    tags?: string[]
    savedAt: string
}

export function useAutoSave(config: AutoSaveConfig) {
    const { postId, title, content, excerpt, coverImage, category, tags, enabled = true, onPostCreated } = config
    const [state, setState] = useState<AutoSaveState>({ status: "idle" })
    const localTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const serverIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const lastServerContentRef = useRef<string>("")
    const currentPostIdRef = useRef<string | undefined>(postId)
    const hasChangesRef = useRef(false)

    const saveToLocal = useCallback(() => {
        if (!enabled) return
        const data: DraftData = {
            title, content, excerpt, coverImage, category, tags,
            savedAt: new Date().toISOString(),
        }
        try {
            localStorage.setItem(getStorageKey(currentPostIdRef.current), JSON.stringify(data))
        } catch {
            // localStorage full or unavailable — silent fail
        }
    }, [title, content, excerpt, coverImage, category, tags, enabled])

    const saveToServer = useCallback(async () => {
        if (!enabled || !hasChangesRef.current) return
        if (content === lastServerContentRef.current) return
        if (!title.trim() && !content.trim()) return

        setState({ status: "saving" })
        try {
            const result = await autoSaveDraft({
                postId: currentPostIdRef.current,
                title, content, excerpt, coverImage, category, tags,
            })
            if (result.success) {
                lastServerContentRef.current = content
                hasChangesRef.current = false
                if (result.postId && !currentPostIdRef.current) {
                    currentPostIdRef.current = result.postId
                    onPostCreated?.(result.postId)
                }
                setState({ status: "saved", lastSaved: new Date() })
            } else {
                setState({ status: "error", error: result.error })
            }
        } catch {
            setState({ status: "error", error: "Auto-save failed" })
        }
    }, [title, content, excerpt, coverImage, category, tags, onPostCreated, enabled])

    useEffect(() => { hasChangesRef.current = true }, [title, content, excerpt, coverImage, category, tags])

    useEffect(() => {
        if (localTimeoutRef.current) clearTimeout(localTimeoutRef.current)
        localTimeoutRef.current = setTimeout(saveToLocal, LOCAL_DEBOUNCE_MS)
        return () => { if (localTimeoutRef.current) clearTimeout(localTimeoutRef.current) }
    }, [saveToLocal])

    useEffect(() => {
        if (!enabled) return
        serverIntervalRef.current = setInterval(saveToServer, SERVER_INTERVAL_MS)
        return () => { if (serverIntervalRef.current) clearInterval(serverIntervalRef.current) }
    }, [enabled, saveToServer])

    useEffect(() => { if (postId) currentPostIdRef.current = postId }, [postId])

    const clearDraft = useCallback(() => {
        try { localStorage.removeItem(getStorageKey(currentPostIdRef.current)) } catch { /* silent */ }
    }, [])

    const loadDraft = useCallback((): DraftData | null => {
        try {
            const raw = localStorage.getItem(getStorageKey(postId))
            if (!raw) return null
            return JSON.parse(raw) as DraftData
        } catch { return null }
    }, [postId])

    return { state, clearDraft, loadDraft, saveToServer }
}
