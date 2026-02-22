import { describe, it, expect, beforeEach } from "bun:test"
import { saveChatCrawlDraft, loadChatCrawlDraft, clearChatCrawlDraft } from "@/utils/chat-crawl-draft"

// Simple localStorage mock
const mockStorage = new Map<string, string>()

const mockLocalStorage: Storage = {
    getItem: (key: string) => mockStorage.get(key) ?? null,
    setItem: (key: string, value: string) => {
        mockStorage.set(key, value)
    },
    removeItem: (key: string) => {
        mockStorage.delete(key)
    },
    clear: () => mockStorage.clear(),
    get length() {
        return mockStorage.size
    },
    key: (index: number) => {
        const keys = Array.from(mockStorage.keys())
        return keys[index] ?? null
    },
}

global.localStorage = mockLocalStorage

describe("chat crawl draft storage", () => {
    beforeEach(() => {
        mockStorage.clear()
    })

    it("round-trips draft data", () => {
        saveChatCrawlDraft({ title: "Draft", items: [], isPublic: false })
        const loaded = loadChatCrawlDraft()
        expect(loaded?.title).toBe("Draft")
        clearChatCrawlDraft()
        expect(loadChatCrawlDraft()).toBeNull()
    })

    it("returns null when no draft exists", () => {
        localStorage.clear()
        expect(loadChatCrawlDraft()).toBeNull()
    })
})
