import { describe, it, expect, mock, afterEach, beforeEach } from "bun:test"
import { render, screen, waitFor, cleanup } from "@testing-library/react"
import { emitChatEvent, clearChatListeners } from "@/utils/chat-events"
import { ChatWidget } from "@/components/chat/ChatWidget"

mock.module("@/components/chat/ChatWindow", () => ({
    default: () => <div>ChatWindow</div>,
}))

describe("ChatWidget", () => {
    beforeEach(() => {
        clearChatListeners()
    })

    afterEach(() => {
        cleanup()
        clearChatListeners()
    })

    it("opens when chat open event is emitted", async () => {
        render(<ChatWidget />)
        emitChatEvent({ type: "open", message: "hello" })

        await waitFor(() => {
            expect(screen.getByText("ChatWindow")).toBeDefined()
        })
    })
})
