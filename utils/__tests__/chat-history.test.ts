import { beforeEach, describe, expect, it, mock } from "bun:test"
import {
    clearChatHistory,
    getLocalDayKey,
    loadChatHistory,
    migrateLegacyChatHistory,
    saveChatHistory,
    shouldClearChatHistory,
} from "@/utils/chat-history"

const localStorageMock = {
    getItem: mock(() => null),
    setItem: mock(() => {}),
    removeItem: mock(() => {}),
}

const sessionStorageMock = {
    getItem: mock(() => null),
    setItem: mock(() => {}),
    removeItem: mock(() => {}),
}

Object.defineProperty(global, "localStorage", { value: localStorageMock, writable: true })
Object.defineProperty(global, "sessionStorage", { value: sessionStorageMock, writable: true })

describe("chat history storage", () => {
    beforeEach(() => {
        localStorageMock.getItem.mockClear()
        localStorageMock.setItem.mockClear()
        localStorageMock.removeItem.mockClear()
        sessionStorageMock.getItem.mockClear()
        sessionStorageMock.setItem.mockClear()
        sessionStorageMock.removeItem.mockClear()
    })

    it("builds a stable local day key", () => {
        const date = new Date(2026, 1, 22)
        expect(getLocalDayKey(date)).toBe("2026-02-22")
    })

    it("pads single-digit month and day", () => {
        expect(getLocalDayKey(new Date(2026, 0, 5))).toBe("2026-01-05")
        expect(getLocalDayKey(new Date(2026, 11, 31))).toBe("2026-12-31")
    })

    it("flags stale history when day changes", () => {
        localStorageMock.getItem.mockReturnValue("2026-02-21")
        expect(shouldClearChatHistory(new Date(2026, 1, 22))).toBe(true)
    })

    it("saves and loads from session storage", () => {
        const messages = [{ id: "1" }]
        saveChatHistory(messages, new Date(2026, 1, 22))
        expect(sessionStorageMock.setItem).toHaveBeenCalledWith("chat-history", JSON.stringify(messages))
        expect(localStorageMock.setItem).toHaveBeenCalledWith("chat-history-day", "2026-02-22")
        sessionStorageMock.getItem.mockReturnValue(JSON.stringify(messages))
        expect(loadChatHistory()).toEqual(messages)
    })

    it("migrates legacy local storage history once", () => {
        localStorageMock.getItem.mockImplementation((key: string) =>
            key === "chat-history" ? JSON.stringify([{ id: "legacy" }]) : "2026-02-22"
        )
        migrateLegacyChatHistory()
        expect(sessionStorageMock.setItem).toHaveBeenCalled()
        expect(localStorageMock.removeItem).toHaveBeenCalledWith("chat-history")
    })

    it("clears history across storage", () => {
        clearChatHistory(new Date(2026, 1, 22))
        expect(sessionStorageMock.removeItem).toHaveBeenCalledWith("chat-history")
        expect(localStorageMock.removeItem).toHaveBeenCalledWith("chat-history")
        expect(localStorageMock.setItem).toHaveBeenCalledWith("chat-history-day", "2026-02-22")
    })

    it("handles corrupted JSON gracefully", () => {
        sessionStorageMock.getItem.mockReturnValue("{invalid}")
        expect(loadChatHistory()).toEqual([])
    })

    it("returns empty when no history exists", () => {
        sessionStorageMock.getItem.mockReturnValue(null)
        expect(loadChatHistory()).toEqual([])
    })

    it("does not migrate when no legacy history exists", () => {
        localStorageMock.getItem.mockReturnValue(null)
        migrateLegacyChatHistory()
        expect(sessionStorageMock.setItem).not.toHaveBeenCalled()
    })

    it("returns false when no day key stored", () => {
        localStorageMock.getItem.mockReturnValue(null)
        expect(shouldClearChatHistory(new Date(2026, 1, 22))).toBe(false)
    })

    it("returns false when day key matches current day", () => {
        localStorageMock.getItem.mockReturnValue("2026-02-22")
        expect(shouldClearChatHistory(new Date(2026, 1, 22))).toBe(false)
    })
})
