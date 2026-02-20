import { render, screen } from "@testing-library/react"
import { ChatWidget } from "@/components/chat/ChatWidget"

test("renders chat button", () => {
    render(<ChatWidget />)
    const button = screen.getByRole("button")
    expect(button).toBeDefined()
    expect(button.tagName).toBe("BUTTON")
})
