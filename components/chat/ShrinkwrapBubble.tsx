"use client"

import { useLayoutEffect, useState, ReactNode } from "react"
import { prepareWithSegments, walkLineRanges } from "@chenglou/pretext"

interface ShrinkwrapBubbleProps {
    text: string
    font: string
    maxWidth: number
    minWidth?: number
    paddingX?: number
    children: ReactNode
    className?: string
}

function measureShrinkwrapWidth(
    text: string,
    font: string,
    maxWidth: number,
    minWidth: number,
    paddingX: number
): number {
    if (!text.trim()) return maxWidth

    const prepared = prepareWithSegments(text, font, { whiteSpace: "pre-wrap" })

    let maxLines = 0
    walkLineRanges(prepared, maxWidth, () => { maxLines++ })

    if (maxLines <= 1) {
        let naturalWidth = 0
        walkLineRanges(prepared, maxWidth, (range) => {
            for (let i = range.start.segmentIndex; i < range.end.segmentIndex; i++) {
                naturalWidth += prepared.widths[i]
            }
        })
        return Math.max(Math.min(Math.ceil(naturalWidth) + paddingX, maxWidth), minWidth)
    }

    let low = minWidth
    let high = maxWidth

    while (low < high - 1) {
        const mid = Math.floor((low + high) / 2)
        let lines = 0
        walkLineRanges(prepared, mid, () => { lines++ })

        if (lines <= maxLines) {
            high = mid
        } else {
            low = mid
        }
    }

    return high
}

export default function ShrinkwrapBubble({
    text,
    font,
    maxWidth,
    minWidth = 40,
    paddingX = 32,
    children,
    className,
}: ShrinkwrapBubbleProps) {
    const [calculatedMaxWidth, setCalculatedMaxWidth] = useState(maxWidth)

    useLayoutEffect(() => {
        if (!text) return

        const width = measureShrinkwrapWidth(text, font, maxWidth, minWidth, paddingX)
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Layout measurement required before paint
        setCalculatedMaxWidth(width)
    }, [text, font, maxWidth, minWidth, paddingX])

    return (
        <div
            className={className}
            style={{ maxWidth: calculatedMaxWidth, width: "fit-content" }}
        >
            {children}
        </div>
    )
}