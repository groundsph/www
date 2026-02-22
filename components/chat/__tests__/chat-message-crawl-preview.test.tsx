import { describe, it, expect, mock } from "bun:test"
import { render } from "@testing-library/react"
import ChatMessage from "@/components/chat/ChatMessage"

mock.module("next/navigation", () => ({
    useRouter: () => ({
        push: mock(),
    }),
}))

describe("ChatMessage crawl preview", () => {
    it("renders Save Crawl button", () => {
        const { getByText } = render(
            <ChatMessage
                message={{
                    id: "1",
                    role: "assistant",
                    content: "Here is your crawl",
                    timestamp: new Date(),
                    crawlDraft: {
                        title: "Custom Coffee Crawl",
                        isPublic: false,
                        items: [],
                    },
                }}
            />
        )

        expect(getByText("Save Crawl")).toBeTruthy()
    })
})
