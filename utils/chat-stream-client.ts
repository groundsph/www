"use client"

import type { ChatStreamChunk } from "@/utils/types/chat"

interface StreamContext {
    recentCafes: unknown[]
    recentToolCalls: { toolName: string; params: unknown; result: unknown }[]
    pathname: string
    pageTitle: string
}

export async function sendChatMessageStream(
    message: string,
    onChunk: (chunk: ChatStreamChunk) => void,
    context: StreamContext,
    history?: { role: "user" | "assistant"; content: string }[]
): Promise<void> {
    const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, context, history }),
    })

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to send message")
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error("No response body")

    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
            if (!line.startsWith("data: ")) continue

            // Only swallow JSON parse failures for malformed lines. Errors
            // thrown by onChunk (e.g. an `{type:"error"}` chunk) must
            // propagate so the caller can surface them — otherwise provider
            // errors like a 403 get discarded and the chat renders an empty
            // response.
            let chunk: ChatStreamChunk
            try {
                chunk = JSON.parse(line.slice(6))
            } catch {
                continue
            }
            onChunk(chunk)
        }
    }
}
