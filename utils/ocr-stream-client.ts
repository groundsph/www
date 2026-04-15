"use client"

import type { OcrMenuItem } from "@/utils/ai/menu-ocr"

export type OcrPhase = "uploading" | "ai-processing" | "streaming" | "processing-results"

export const OCR_PHASE_CONFIG: Record<OcrPhase, { timeoutMs: number; label: string }> = {
    "uploading": { timeoutMs: 15_000, label: "Uploading image..." },
    "ai-processing": { timeoutMs: 30_000, label: "AI analyzing menu..." },
    "streaming": { timeoutMs: 120_000, label: "Extracting items..." },
    "processing-results": { timeoutMs: 10_000, label: "Processing results..." },
}

export interface OcrStreamCallbacks {
    onStatus: (message: string) => void
    onContent: (token: string) => void
    onComplete: (data: {
        items: OcrMenuItem[]
        deduplicated: OcrMenuItem[]
        duplicates: string[]
    }) => void
    onError: (error: string) => void
}

export async function streamOcrScan(
    cafeId: string,
    imageBase64: string,
    callbacks: OcrStreamCallbacks
): Promise<void> {
    const response = await fetch("/api/ocr/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cafeId, imageBase64 }),
    })

    if (!response.ok) {
        try {
            const error = await response.json()
            callbacks.onError(error.error || "Failed to scan menu")
        } catch {
            callbacks.onError("Failed to scan menu")
        }
        return
    }

    const reader = response.body?.getReader()
    if (!reader) {
        callbacks.onError("No response stream")
        return
    }

    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
            if (line.startsWith("data: ")) {
                try {
                    const chunk = JSON.parse(line.slice(6))

                    switch (chunk.type) {
                        case "status":
                            callbacks.onStatus(chunk.message)
                            break
                        case "content":
                            callbacks.onContent(chunk.token)
                            break
                        case "complete":
                            callbacks.onComplete({
                                items: chunk.items ?? [],
                                deduplicated: chunk.deduplicated ?? [],
                                duplicates: chunk.duplicates ?? [],
                            })
                            break
                        case "error":
                            callbacks.onError(chunk.error)
                            break
                    }
                } catch {
                    // Ignore parse errors for partial lines
                }
            }
        }
    }
}
