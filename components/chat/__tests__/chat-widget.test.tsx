import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { render, screen, cleanup } from "@testing-library/react"
import { ChatWidget } from "@/components/chat/ChatWidget"
import { clearChatListeners } from "@/utils/chat-events"

describe("ChatWidget original tests", () => {
    beforeEach(() => {
        clearChatListeners()
    })

    afterEach(() => {
        cleanup()
        clearChatListeners()
    })

    it("renders chat button", () => {
        render(<ChatWidget />)
        const button = screen.getByRole("button")
        expect(button).toBeDefined()
        expect(button.tagName).toBe("BUTTON")
    })

    it("does not render when disabled", () => {
        render(<ChatWidget isEnabled={false} />)
        expect(screen.queryByRole("button")).toBeNull()
    })
})
