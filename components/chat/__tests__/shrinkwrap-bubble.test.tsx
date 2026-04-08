import { describe, it, expect, jest } from "bun:test"
import { render } from "@testing-library/react"
import ShrinkwrapBubble from "@/components/chat/ShrinkwrapBubble"

// Mock pretext module with realistic segment widths
jest.mock("@chenglou/pretext", () => ({
    prepareWithSegments: (text: string) => ({
        widths: text.split("").map((char) => (char === " " ? 5 : 8)),
        segments: text.split("").map((char, i) => ({ index: i, char })),
    }),
    walkLineRanges: (prepared: { widths: number[] }, maxWidth: number, callback: (range: {
        start: { segmentIndex: number; graphemeIndex: number }
        end: { segmentIndex: number; graphemeIndex: number }
        width: number
    }) => void) => {
        // Simple line breaking: accumulate width until maxWidth
        const charWidth = 8
        const charsPerLine = Math.floor(maxWidth / charWidth)
        let lineCount = 0
        for (let i = 0; i < prepared.widths.length; i += charsPerLine) {
            const endIndex = Math.min(i + charsPerLine, prepared.widths.length)
            const lineWidth = prepared.widths
                .slice(i, endIndex)
                .reduce((sum, w) => sum + w, 0)
            callback({
                start: { segmentIndex: i, graphemeIndex: 0 },
                end: { segmentIndex: endIndex, graphemeIndex: 0 },
                width: lineWidth,
            })
            lineCount++
        }
        return lineCount
    },
}))

describe("ShrinkwrapBubble", () => {
    it("renders children", () => {
        const { getByText } = render(
            <ShrinkwrapBubble
                text="Hello world"
                font="14px system-ui"
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
                maxWidth={300}
            >
                <div>Test content</div>
            </ShrinkwrapBubble>
        )

        expect(getByText("Test content")).toBeTruthy()
    })
})
