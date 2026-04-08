import { describe, it, expect, mock, beforeEach } from "bun:test"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

// Mock crypto.randomUUID before importing ChatWindow
Object.defineProperty(global, "crypto", {
    value: {
        randomUUID: () => "test-uuid-123",
    },
    writable: true,
})

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

// Mock fetch for streaming API
const mockFetch = mock(() =>
    Promise.resolve({
        ok: true,
        body: {
            getReader: () => ({
                read: () => Promise.resolve({ done: true, value: undefined }),
            }),
        },
    })
)

Object.defineProperty(global, "fetch", {
    value: mockFetch,
    writable: true,
})

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

// Mock hooks before importing component
mock.module("@/hooks/useUserLocation", () => ({
    useUserLocation: mockUseUserLocation,
}))

mock.module("@/hooks/useHaptics", () => ({
    useHaptics: () => ({ trigger: mock(() => {}) }),
}))

// Import ChatWindow after mocks
import ChatWindow from "@/components/chat/ChatWindow"

describe("ChatWindow location behavior", () => {
    beforeEach(() => {
        mockFetch.mockClear()
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
        expect(mockFetch).not.toHaveBeenCalled()
    })

    it("does not request location for general queries", async () => {
        render(<ChatWindow remainingMessages={10} onClose={() => {}} />)

        const input = screen.getByPlaceholderText(
            "Ask about cafes, locations, or recommendations..."
        )
        fireEvent.change(input, { target: { value: "best cafes in cebu" } })
        fireEvent.submit(input.closest("form") as HTMLFormElement)

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalled()
        })

        expect(mockRefresh).not.toHaveBeenCalled()
    })

    it("includes context in request payload", async () => {
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
            expect(mockFetch).toHaveBeenCalled()
        })

        const call = mockFetch.mock.calls[0]
        const [url, options] = call
        expect(url).toBe("/api/chat/stream")
        expect(options.method).toBe("POST")
        
        const body = JSON.parse(options.body)
        expect(body.context).toBeDefined()
        expect(body.context.recentCafes).toBeDefined()
        expect(body.context.recentToolCalls).toBeDefined()
        expect(body.context.pathname).toBeDefined()
        expect(body.context.pageTitle).toBeDefined()
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
            expect(mockFetch).toHaveBeenCalled()
        })

        const call = mockFetch.mock.calls[0]
        const [, options] = call
        const body = JSON.parse(options.body)
        expect(body.message).toContain("User location")
    })
})
