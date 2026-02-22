import { describe, it, expect, mock, beforeEach } from "bun:test"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import ChatWindow from "@/components/chat/ChatWindow"

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

Object.defineProperty(global, "localStorage", {
    value: localStorageMock,
    writable: true,
})

Object.defineProperty(global, "sessionStorage", {
    value: sessionStorageMock,
    writable: true,
})

const mockSendChatMessage = mock(() =>
    Promise.resolve({ success: true, message: "ok", remaining: 9 })
)

mock.module("@/app/api/actions/chat", () => ({
    sendChatMessage: mockSendChatMessage,
}))

const mockRefresh = mock(() => {})
const mockUseUserLocation = mock(() => ({
    location: { city: null, region: null, lat: null, lng: null },
    loading: false,
    error: null,
    permissionState: "unknown",
    isEstimate: false,
    source: null,
    refresh: mockRefresh,
}))

mock.module("@/hooks/useUserLocation", () => ({
    useUserLocation: mockUseUserLocation,
}))

describe("ChatWindow location behavior", () => {
    beforeEach(() => {
        mockSendChatMessage.mockClear()
        mockRefresh.mockClear()
        // Reset mock to default state
        mockUseUserLocation.mockReturnValue({
            location: { city: null, region: null, lat: null, lng: null },
            loading: false,
            error: null,
            permissionState: "unknown",
            isEstimate: false,
            source: null,
            refresh: mockRefresh,
        })
    })

    it("queues message when location is loading for near-me query", async () => {
        mockUseUserLocation.mockReturnValue({
            location: { city: null, region: null, lat: null, lng: null },
            loading: true,
            error: null,
            permissionState: "unknown",
            isEstimate: false,
            source: null,
            refresh: mockRefresh,
        })

        render(<ChatWindow remainingMessages={10} onClose={() => {}} />)

        const input = screen.getByPlaceholderText(
            "Ask about cafes, locations, or recommendations..."
        )
        fireEvent.change(input, { target: { value: "cafes near me" } })
        fireEvent.submit(input.closest("form") as HTMLFormElement)

        await waitFor(() => {
            expect(mockRefresh).toHaveBeenCalled()
        })
        // Message should not be sent yet while location is loading
        expect(mockSendChatMessage).not.toHaveBeenCalled()
    })

    it("does not request location for general queries", async () => {
        render(<ChatWindow remainingMessages={10} onClose={() => {}} />)

        const input = screen.getByPlaceholderText(
            "Ask about cafes, locations, or recommendations..."
        )
        fireEvent.change(input, { target: { value: "best cafes in cebu" } })
        fireEvent.submit(input.closest("form") as HTMLFormElement)

        await waitFor(() => {
            expect(mockSendChatMessage).toHaveBeenCalled()
        })

        expect(mockRefresh).not.toHaveBeenCalled()
    })

    it("includes location hint when available", async () => {
        mockUseUserLocation.mockReturnValue({
            location: { city: "Cebu City", region: "Central Visayas", lat: 10.3157, lng: 123.8854 },
            loading: false,
            error: null,
            permissionState: "granted",
            isEstimate: false,
            source: "gps",
            refresh: mockRefresh,
        })

        render(<ChatWindow remainingMessages={10} onClose={() => {}} />)
        const input = screen.getByPlaceholderText(
            "Ask about cafes, locations, or recommendations..."
        )
        fireEvent.change(input, { target: { value: "cafes near me" } })
        fireEvent.submit(input.closest("form") as HTMLFormElement)

        await waitFor(() => {
            expect(mockSendChatMessage).toHaveBeenCalled()
        })

        const call = mockSendChatMessage.mock.calls[0][0]
        expect(call.message).toContain("User location")
    })
})
