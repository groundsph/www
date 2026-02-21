import { describe, it, expect } from "bun:test"
import { render } from "@testing-library/react"
import ChatMessage from "@/components/chat/ChatMessage"

describe("ChatMessage cafe cards", () => {
    it("renders a snapping carousel", () => {
        const { container, getByText } = render(
            <ChatMessage
                message={{
                    id: "msg-1",
                    role: "assistant",
                    content: "Here are cafes",
                    timestamp: new Date(),
                    cafes: [
                        {
                            id: "1",
                            slug: "demo",
                            title: "Demo Cafe",
                            coverImageUrl: null,
                            filters: ["WiFi"],
                            flags: ["Halal"],
                            custom: "Near you",
                        },
                    ],
                }}
            />
        )

        expect(getByText("Demo Cafe")).toBeTruthy()
        expect(container.querySelector(".snap-x")).toBeTruthy()
    })
})
