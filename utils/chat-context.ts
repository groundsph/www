import type { ChatContext } from "@/utils/types/chat"

let current: ChatContext = {}
const listeners = new Set<(ctx: ChatContext) => void>()

export function setChatContext(next: ChatContext) {
    current = { ...current, ...next }
    for (const l of listeners) l(current)
}

export function getChatContext() {
    return current
}

export function subscribeChatContext(listener: (ctx: ChatContext) => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
}
