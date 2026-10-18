"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { ImagePurpose } from "@/utils/image-processing"
import { MAX_CAFE_GALLERY } from "@/utils/validation/cafe-images"

export type UploadStatus = "queued" | "compressing" | "uploading" | "done" | "error"

export interface UploadItem {
    id: string
    fileName: string
    /** Object URL for the local preview; revoked when the item is dismissed. */
    previewUrl: string
    status: UploadStatus
    /** 0-100, meaningful while uploading. */
    progress: number
    error?: string
    /** The stored public URL once the upload succeeds. */
    url?: string
}

export interface UploadResult {
    success: boolean
    url?: string
    error?: string
}

interface UseImageUploadQueueOptions {
    purpose: ImagePurpose
    cafeId?: string
    /** Files uploaded at the same time. */
    concurrency?: number
    /** How many items this queue may hold at once. */
    maxFiles?: number
    compress?: (purpose: ImagePurpose, file: File) => Promise<File>
    upload?: (file: File, onProgress: (progress: number) => void) => Promise<UploadResult>
    onComplete?: (result: { id: string; fileName: string; url: string }) => void
    onReject?: (fileName: string, reason: string) => void
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]
const MAX_FILE_BYTES = 5 * 1024 * 1024

async function defaultCompress(purpose: ImagePurpose, file: File): Promise<File> {
    const { compressImageFor } = await import("@/utils/image-processing")
    return compressImageFor(purpose, file)
}

/**
 * Per-file upload queue: compress, upload with progress, and keep failures
 * retryable. Rendering is the caller's job — this hook only owns file state.
 */
export function useImageUploadQueue(options: UseImageUploadQueueOptions) {
    const {
        purpose,
        cafeId,
        concurrency = 3,
        maxFiles = MAX_CAFE_GALLERY,
        onComplete,
        onReject,
        compress: injectedCompress,
        upload: injectedUpload,
    } = options

    const [items, setItems] = useState<UploadItem[]>([])
    const itemsRef = useRef<UploadItem[]>([])
    itemsRef.current = items

    const runningRef = useRef(0)
    const queueRef = useRef<string[]>([])
    const filesRef = useRef(new Map<string, File>())
    const counterRef = useRef(0)

    const compress = useCallback(
        async (file: File) => (injectedCompress ?? defaultCompress)(purpose, file),
        [injectedCompress, purpose]
    )

    const upload = useCallback(
        async (file: File, onProgress: (progress: number) => void) => {
            if (injectedUpload) return injectedUpload(file, onProgress)
            const { uploadWithProgress } = await import("@/utils/storage/client")
            return uploadWithProgress({ file, bucket: "cafes", cafeId, onProgress })
        },
        [injectedUpload, cafeId]
    )

    const patch = useCallback((id: string, changes: Partial<UploadItem>) => {
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...changes } : item)))
    }, [])

    const runOne = useCallback(async (id: string) => {
        const file = filesRef.current.get(id)
        if (!file) return

        patch(id, { status: "compressing", progress: 0 })

        try {
            const compressed = await compress(file)
            patch(id, { status: "uploading" })

            const result = await upload(compressed, (progress) => patch(id, { progress }))

            if (result.success && result.url) {
                patch(id, { status: "done", progress: 100, url: result.url })
                onComplete?.({ id, fileName: file.name, url: result.url })
            } else {
                patch(id, { status: "error", error: result.error ?? "Upload failed" })
            }
        } catch (error) {
            patch(id, {
                status: "error",
                error: error instanceof Error ? error.message : "Upload failed",
            })
        }
    }, [compress, upload, patch, onComplete])

    const pump = useCallback(() => {
        while (runningRef.current < concurrency && queueRef.current.length > 0) {
            const id = queueRef.current.shift()
            if (!id) break
            runningRef.current += 1
            void runOne(id).finally(() => {
                runningRef.current -= 1
                pump()
            })
        }
    }, [concurrency, runOne])

    const enqueue = useCallback((files: File[]) => {
        const accepted: UploadItem[] = []

        for (const file of files) {
            if (filesRef.current.size >= maxFiles) {
                onReject?.(file.name, `You can have at most ${maxFiles} images`)
                continue
            }
            if (!ACCEPTED_TYPES.includes(file.type)) {
                onReject?.(file.name, `${file.name} is not a supported image`)
                continue
            }
            if (file.size > MAX_FILE_BYTES) {
                onReject?.(file.name, `${file.name} is larger than 5MB`)
                continue
            }

            counterRef.current += 1
            const id = `upload-${counterRef.current}`
            filesRef.current.set(id, file)
            accepted.push({
                id,
                fileName: file.name,
                previewUrl: URL.createObjectURL(file),
                status: "queued",
                progress: 0,
            })
            queueRef.current.push(id)
        }

        if (accepted.length === 0) return
        setItems((prev) => [...prev, ...accepted])
        pump()
    }, [maxFiles, onReject, pump])

    const retry = useCallback((id: string) => {
        if (!filesRef.current.has(id)) return
        patch(id, { status: "queued", progress: 0, error: undefined })
        queueRef.current.push(id)
        pump()
    }, [patch, pump])

    const dismiss = useCallback((id: string) => {
        const item = itemsRef.current.find((entry) => entry.id === id)
        if (item) URL.revokeObjectURL(item.previewUrl)
        filesRef.current.delete(id)
        queueRef.current = queueRef.current.filter((queued) => queued !== id)
        setItems((prev) => prev.filter((entry) => entry.id !== id))
    }, [])

    const clearCompleted = useCallback(() => {
        setItems((prev) => {
            for (const item of prev) {
                if (item.status === "done") URL.revokeObjectURL(item.previewUrl)
            }
            return prev.filter((item) => item.status !== "done")
        })
    }, [])

    // Release object URLs when the component goes away
    useEffect(() => () => {
        for (const item of itemsRef.current) URL.revokeObjectURL(item.previewUrl)
    }, [])

    return {
        items,
        enqueue,
        retry,
        dismiss,
        clearCompleted,
        isBusy: items.some((item) =>
            item.status === "queued" || item.status === "compressing" || item.status === "uploading"
        ),
    }
}
