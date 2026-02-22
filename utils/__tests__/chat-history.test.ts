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

    it("flags stale history when day changes", () => {
        localStorageMock.getItem.mockReturnValue("2026-02-21")
        expect(shouldClearChatHistory(new Date(2026, 1, 22))).toBe(true)
    })

    it("saves and loads from session storage", () => {
        const messages = [{ id: "1" }]
        saveChatHistory(messages, new Date(2026, 1, 22))
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
    })
})
