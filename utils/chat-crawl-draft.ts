import type { ChatCrawlDraft } from "@/utils/types/chat"

const CHAT_CRAWL_DRAFT_KEY = "chat-crawl-draft"

export function saveChatCrawlDraft(draft: ChatCrawlDraft) {
    if (typeof window === "undefined") return
    localStorage.setItem(CHAT_CRAWL_DRAFT_KEY, JSON.stringify(draft))
}

export function loadChatCrawlDraft(): ChatCrawlDraft | null {
    if (typeof window === "undefined") return null
    const raw = localStorage.getItem(CHAT_CRAWL_DRAFT_KEY)
    if (!raw) return null
    try {
        return JSON.parse(raw) as ChatCrawlDraft
    } catch {
        return null
    }
}

export function clearChatCrawlDraft() {
    if (typeof window === "undefined") return
    localStorage.removeItem(CHAT_CRAWL_DRAFT_KEY)
}
