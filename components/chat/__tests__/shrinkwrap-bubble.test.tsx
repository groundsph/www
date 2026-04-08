import { describe, it, expect, jest } from "bun:test"
import { render } from "@testing-library/react"
import ShrinkwrapBubble from "@/components/chat/ShrinkwrapBubble"

// Mock pretext module
jest.mock("@chenglou/pretext", () => ({
    prepareWithSegments: jest.fn((text: string, font: string) => ({
        widths: text.split("").map(() => 10),
        segments: text.split(""),
    })),
    walkLineRanges: jest.fn((_prepared, maxWidth, callback) => {
        // Simulate 1 line for simplicity in tests
        callback({
            start: { segmentIndex: 0, graphemeIndex: 0 },
            end: { segmentIndex: 10, graphemeIndex: 0 },
            width: 100,
        })
        return 1
    }),
}))

describe("ShrinkwrapBubble", () => {
    it("renders children", () => {
        const { getByText } = render(
            <ShrinkwrapBubble
                text="Hello world"
                font="14px system-ui"
                lineHeight={20}
                maxWidth={300}
            >
                <div>Test content</div>
            </ShrinkwrapBubble>
        )

        expect(getByText("Test content")).toBeTruthy()
    })

    it("applies custom className", () => {
        const { container } = render(
            <ShrinkwrapBubble
                text="Hello world"
                font="14px system-ui"
                lineHeight={20}
                maxWidth={300}
                className="custom-class"
            >
                <div>Test content</div>
            </ShrinkwrapBubble>
        )

        expect(container.querySelector(".custom-class")).toBeTruthy()
    })

    it("renders with empty text", () => {
        const { getByText } = render(
            <ShrinkwrapBubble
                text=""
                font="14px system-ui"
                lineHeight={20}
                maxWidth={300}
            >
                <div>Test content</div>
            </ShrinkwrapBubble>
        )

        expect(getByText("Test content")).toBeTruthy()
    })

    it("renders with multiline text", () => {
        const { getByText } = render(
            <ShrinkwrapBubble
                text="Line 1\nLine 2\nLine 3"
                font="14px system-ui"
                lineHeight={20}
                maxWidth={300}
            >
                <div>Test content</div>
            </ShrinkwrapBubble>
        )

        expect(getByText("Test content")).toBeTruthy()
    })
})
