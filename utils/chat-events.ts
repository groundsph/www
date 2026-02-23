export type ChatEvent = "close"

const listeners = new Set<(event: ChatEvent) => void>()

export function subscribeChatEvents(listener: (event: ChatEvent) => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

export function emitChatEvent(event: ChatEvent) {
    for (const listener of listeners) listener(event)
}
