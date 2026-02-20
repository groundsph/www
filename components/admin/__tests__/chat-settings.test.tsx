import { describe, it, expect, mock } from "bun:test"
import { render, screen, waitFor } from "@testing-library/react"
import { ChatSettings } from "@/components/admin/ChatSettings"

// Mock the server actions
mock.module("@/app/api/actions/admin/feature-flags", () => ({
    getChatEnabledFlag: () => Promise.resolve({ success: true, enabled: false }),
    setChatEnabled: () => Promise.resolve({ success: true }),
}))

describe("ChatSettings", () => {
    it("renders chat toggle", async () => {
        render(<ChatSettings />)
        const checkbox = await waitFor(() => screen.getByRole("checkbox"))
        expect(checkbox).toBeDefined()
        expect(checkbox.getAttribute("role")).toBe("checkbox")
    })
})
