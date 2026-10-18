"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { MAX_CAFE_GALLERY } from "@/utils/validation/cafe-images"

export interface CafeImagesPatch {
    thumbnail?: string | null
    gallery?: string[]
}

export interface CafeImagesSaveState {
    dirty: boolean
    saving: boolean
    lastSavedAt: Date | null
    error: string | null
}

interface ActionResult {
    success: boolean
    error?: string
}

interface UseCafeImagesOptions {
    cafeId: string
    initial: { thumbnail: string | null; gallery: string[] }
    save: (patch: CafeImagesPatch) => Promise<ActionResult>
    /** Deletes the stored object. Only ever called after a successful save. */
    removeFile: (url: string) => Promise<ActionResult>
    debounceMs?: number
    maxGallery?: number
}

/**
 * Owns cafe image state and persistence.
 *
 * Two rules matter here:
 *   1. Persist first, delete the storage object second. The old code deleted
 *      first, so a failed save lost the file and left a dangling URL.
 *   2. One save in flight at a time. Changes made while saving are merged and
 *      re-sent, so rapid edits cannot race each other.
 */
export function useCafeImages(options: UseCafeImagesOptions) {
    const { cafeId, initial, save, removeFile, debounceMs = 600, maxGallery = MAX_CAFE_GALLERY } = options

    const [thumbnail, setThumbnail] = useState<string | null>(initial.thumbnail)
    const [gallery, setGallery] = useState<string[]>(initial.gallery)
    const [saveState, setSaveState] = useState<CafeImagesSaveState>({
        dirty: false,
        saving: false,
        lastSavedAt: null,
        error: null,
    })

    const pendingRef = useRef<CafeImagesPatch>({})
    /**
     * Bumped whenever new pending work is scheduled. A failed save restores its
     * patch into `pendingRef` without bumping this, so it cannot re-trigger
     * itself in a loop — only genuinely new changes do.
     */
    const revisionRef = useRef(0)
    /** Covers replaced by a successful save; their files are deleted afterwards. */
    const replacedCoversRef = useRef<string[]>([])
    /** Mirrors `thumbnail` so callers can compare against the previous value. */
    const thumbnailRef = useRef<string | null>(initial.thumbnail)
    thumbnailRef.current = thumbnail
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const inFlightRef = useRef(false)

    const flush = useCallback(async () => {
        if (inFlightRef.current) return
        const patch = pendingRef.current
        if (!hasPending(patch)) return

        const revisionAtStart = revisionRef.current
        pendingRef.current = {}
        inFlightRef.current = true
        setSaveState((state) => ({ ...state, saving: true, error: null }))

        try {
            const result = await save(patch)
            if (result.success) {
                setSaveState({
                    dirty: hasPending(pendingRef.current),
                    saving: false,
                    lastSavedAt: new Date(),
                    error: null,
                })

                // The database no longer references the replaced covers, so the
                // bytes may go now. A failure here only leaks a file, which the
                // orphaned-image sweep already covers.
                const replaced = replacedCoversRef.current
                replacedCoversRef.current = []
                for (const url of replaced) {
                    const deletion = await removeFile(url)
                    if (!deletion.success) {
                        console.warn("Replaced cafe cover still in storage:", url, deletion.error)
                    }
                }
            } else {
                pendingRef.current = { ...patch, ...pendingRef.current }
                setSaveState((state) => ({
                    ...state,
                    saving: false,
                    dirty: true,
                    error: result.error ?? "Failed to save images",
                }))
            }
        } catch (error) {
            pendingRef.current = { ...patch, ...pendingRef.current }
            setSaveState((state) => ({
                ...state,
                saving: false,
                dirty: true,
                error: error instanceof Error ? error.message : "Failed to save images",
            }))
        } finally {
            inFlightRef.current = false
            // Re-send only if something new was scheduled while we were saving.
            if (revisionRef.current !== revisionAtStart) void flush()
        }
    }, [removeFile, save])

    const schedule = useCallback((patch: CafeImagesPatch) => {
        pendingRef.current = { ...pendingRef.current, ...patch }
        revisionRef.current += 1
        setSaveState((state) => ({ ...state, dirty: true, error: null }))
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => { void flush() }, debounceMs)
    }, [debounceMs, flush])

    useEffect(() => () => {
        if (timerRef.current) clearTimeout(timerRef.current)
    }, [])

    /** Set or clear the cover. `null` clears it. */
    const setCoverImage = useCallback((url: string | null) => {
        const previous = thumbnailRef.current
        if (previous && previous !== url) {
            replacedCoversRef.current.push(previous)
        }
        setThumbnail(url)
        schedule({ thumbnail: url })
    }, [schedule])

    const appendGallery = useCallback((urls: string[]) => {
        if (urls.length === 0) return
        const next = [...gallery, ...urls].slice(0, maxGallery)
        setGallery(next)
        schedule({ gallery: next })
    }, [gallery, maxGallery, schedule])

    const replaceGallery = useCallback((urls: string[]) => {
        const next = urls.slice(0, maxGallery)
        setGallery(next)
        schedule({ gallery: next })
    }, [maxGallery, schedule])

    const moveGallery = useCallback((from: number, to: number) => {
        if (from === to || from < 0 || to < 0 || from >= gallery.length || to >= gallery.length) return
        const next = [...gallery]
        const [moved] = next.splice(from, 1)
        next.splice(to, 0, moved)
        setGallery(next)
        schedule({ gallery: next })
    }, [gallery, schedule])

    const removeGalleryAt = useCallback(async (index: number) => {
        const removed = gallery[index]
        if (!removed) return

        const next = gallery.filter((_, i) => i !== index)
        setGallery(next)
        setSaveState((state) => ({ ...state, dirty: true, saving: true, error: null }))

        const result = await save({ gallery: next })
        if (!result.success) {
            setGallery(gallery)
            setSaveState((state) => ({
                ...state,
                saving: false,
                dirty: true,
                error: result.error ?? "Failed to save images",
            }))
            return
        }

        setSaveState({ dirty: false, saving: false, lastSavedAt: new Date(), error: null })

        // Only now is it safe to drop the bytes: nothing references them any more.
        const deletion = await removeFile(removed)
        if (!deletion.success) {
            console.warn("Cafe image removed from the database but not from storage:", removed, deletion.error)
        }
    }, [gallery, removeFile, save])

    const clearThumbnail = useCallback(async () => {
        const previous = thumbnail
        setThumbnail(null)
        setSaveState((state) => ({ ...state, dirty: true, saving: true, error: null }))

        const result = await save({ thumbnail: null })
        if (!result.success) {
            setThumbnail(previous)
            setSaveState((state) => ({
                ...state,
                saving: false,
                dirty: true,
                error: result.error ?? "Failed to save images",
            }))
            return
        }

        setSaveState({ dirty: false, saving: false, lastSavedAt: new Date(), error: null })

        if (previous) {
            const deletion = await removeFile(previous)
            if (!deletion.success) {
                console.warn("Cafe cover removed from the database but not from storage:", previous, deletion.error)
            }
        }
    }, [removeFile, save, thumbnail])

    const retrySave = useCallback(() => { void flush() }, [flush])

    return {
        cafeId,
        thumbnail,
        gallery,
        setCoverImage,
        appendGallery,
        replaceGallery,
        moveGallery,
        removeGalleryAt,
        clearThumbnail,
        saveState,
        retrySave,
    }
}

function hasPending(patch: CafeImagesPatch): boolean {
    return patch.thumbnail !== undefined || patch.gallery !== undefined
}
