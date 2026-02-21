import { describe, it, expect } from "bun:test"
import { render } from "@testing-library/react"
import ChatMessage from "@/components/chat/ChatMessage"
import { CafeWithRatings } from "@/utils/types/extra"

describe("ChatMessage cafe cards", () => {
    it("renders cafe carousel when cafes are provided", () => {
        const cafes: Partial<CafeWithRatings>[] = [
            {
                id: "1",
                name: "Test Cafe",
                slug: "test-cafe",
                thumbnail: "/test.jpg",
                city_municipality: "Manila",
                province: "Metro Manila",
                is_halal_certified: true,
                average_rating: 4.5,
                total_reviews: 10,
            }
        ]

        const { getByText } = render(
            <ChatMessage
                message={{
                    id: "msg-1",
                    role: "assistant",
                    content: "Here are some cafes",
                    timestamp: new Date(),
                    cafes: cafes as CafeWithRatings[],
                }}
            />
        )

        expect(getByText("Test Cafe")).toBeTruthy()
        expect(getByText("Halal")).toBeTruthy()
    })

    it("does not render carousel when no cafes", () => {
        const { container } = render(
            <ChatMessage
                message={{
                    id: "msg-1",
                    role: "assistant",
                    content: "No cafes found",
                    timestamp: new Date(),
                }}
            />
        )

        expect(container.querySelector("a[href^='/cafes/']")).toBeNull()
    })
})
