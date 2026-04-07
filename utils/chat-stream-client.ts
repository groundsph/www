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
    context: StreamContext
): Promise<void> {
    const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, context }),
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
            if (line.startsWith("data: ")) {
                try {
                    const chunk = JSON.parse(line.slice(6))
                    onChunk(chunk)
                } catch {
                    // Ignore parse errors
                }
            }
        }
    }
}
