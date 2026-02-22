const CHAT_HISTORY_KEY = "chat-history"
const CHAT_HISTORY_DAY_KEY = "chat-history-day"

export function getLocalDayKey(date = new Date()): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
}

export function shouldClearChatHistory(date = new Date()): boolean {
    if (typeof window === "undefined") return false
    const current = getLocalDayKey(date)
    const stored = localStorage.getItem(CHAT_HISTORY_DAY_KEY)
    return stored !== null && stored !== current
}

export function saveChatHistory<T>(messages: T[], date = new Date()): void {
    if (typeof window === "undefined") return
    localStorage.setItem(CHAT_HISTORY_DAY_KEY, getLocalDayKey(date))
    sessionStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages))
}

export function loadChatHistory<T>(): T[] {
    if (typeof window === "undefined") return []
    const raw = sessionStorage.getItem(CHAT_HISTORY_KEY)
    if (!raw) return []
    try {
        return JSON.parse(raw) as T[]
    } catch {
        return []
    }
}

export function clearChatHistory(date = new Date()): void {
    if (typeof window === "undefined") return
    sessionStorage.removeItem(CHAT_HISTORY_KEY)
    localStorage.removeItem(CHAT_HISTORY_KEY)
    localStorage.setItem(CHAT_HISTORY_DAY_KEY, getLocalDayKey(date))
}

export function migrateLegacyChatHistory(): void {
    if (typeof window === "undefined") return
    const legacy = localStorage.getItem(CHAT_HISTORY_KEY)
    if (!legacy) return
    sessionStorage.setItem(CHAT_HISTORY_KEY, legacy)
    localStorage.removeItem(CHAT_HISTORY_KEY)
}
