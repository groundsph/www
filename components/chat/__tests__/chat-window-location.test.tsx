import { describe, it, expect, mock, beforeEach } from "bun:test"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import ChatWindow from "@/components/chat/ChatWindow"

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
    })

    it("requests location on near-me query", async () => {
        render(<ChatWindow remainingMessages={10} onClose={() => {}} />)

        const input = screen.getByPlaceholderText(
            "Ask about cafes, locations, or recommendations..."
        )
        fireEvent.change(input, { target: { value: "cafes near me" } })
        fireEvent.submit(input.closest("form") as HTMLFormElement)

        await waitFor(() => {
            expect(mockRefresh).toHaveBeenCalled()
        })
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
})
