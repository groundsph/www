import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test"
import { fireEvent, render, screen } from "@testing-library/react"
import ChatWindow from "@/components/chat/ChatWindow"

const localStorageMock = {
    getItem: mock(() => null),
    setItem: mock(() => {}),
    removeItem: mock(() => {}),
}

const sessionStorageMock = {
    getItem: mock(() => JSON.stringify([{ id: "1", role: "assistant", content: "hi", timestamp: new Date().toISOString() }])),
    setItem: mock(() => {}),
    removeItem: mock(() => {}),
}

Object.defineProperty(global, "localStorage", { value: localStorageMock, writable: true })
Object.defineProperty(global, "sessionStorage", { value: sessionStorageMock, writable: true })

mock.module("@/app/api/actions/chat", () => ({
    sendChatMessage: mock(() => Promise.resolve({ success: true, message: "ok", remaining: 9 })),
}))

mock.module("@/hooks/useUserLocation", () => ({
    useUserLocation: mock(() => ({
        location: { city: null, region: null, lat: null, lng: null },
        loading: false,
        error: null,
        permissionState: "unknown",
        isEstimate: false,
        source: null,
        refresh: mock(() => {}),
    })),
}))

describe("ChatWindow history clearing", () => {
    const originalNodeEnv = process.env.NODE_ENV

    beforeEach(() => {
        localStorageMock.getItem.mockClear()
        localStorageMock.setItem.mockClear()
        localStorageMock.removeItem.mockClear()
        sessionStorageMock.getItem.mockClear()
        sessionStorageMock.setItem.mockClear()
        sessionStorageMock.removeItem.mockClear()
    })

    afterEach(() => {
        process.env.NODE_ENV = originalNodeEnv
    })

    it("shows dev clear button and clears messages", () => {
        process.env.NODE_ENV = "development"
        render(<ChatWindow remainingMessages={10} onClose={() => {}} />)

        expect(screen.getByText("Clear history")).toBeTruthy()
        fireEvent.click(screen.getByText("Clear history"))

        expect(sessionStorageMock.removeItem).toHaveBeenCalledWith("chat-history")
        expect(screen.getByText("Ask me anything about cafes!")).toBeTruthy()
    })
})
