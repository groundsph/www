"use client"

import { useLayoutEffect, useState, ReactNode } from "react"
import { prepareWithSegments, walkLineRanges } from "@chenglou/pretext"

interface ShrinkwrapBubbleProps {
    text: string
    font: string
    maxWidth: number
    minWidth?: number
    children: ReactNode
    className?: string
}

function measureShrinkwrapWidth(
    text: string,
    font: string,
    maxWidth: number,
    minWidth: number
): number {
    if (!text.trim()) return maxWidth

    const prepared = prepareWithSegments(text, font, { whiteSpace: "pre-wrap" })

    // Count lines at maxWidth
    let maxLines = 0
    walkLineRanges(prepared, maxWidth, () => { maxLines++ })
    if (maxLines <= 1) {
        // Single line: measure natural width + small padding
        const naturalWidth = Math.ceil(
            // Walk segments to get total width for single line
            (() => {
                let w = 0
                walkLineRanges(prepared, maxWidth, (range) => {
                    for (let i = range.start.segmentIndex; i < range.end.segmentIndex; i++) {
                        w += prepared.widths[i]
                    }
                })
                return w
            })()
        )
        return Math.min(naturalWidth + 1, maxWidth)
    }

    // Binary search for tightest width that keeps same line count
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
    minWidth = 80,
    children,
    className,
}: ShrinkwrapBubbleProps) {
    const [calculatedMaxWidth, setCalculatedMaxWidth] = useState(maxWidth)

    useLayoutEffect(() => {
        if (!text) return

        const width = measureShrinkwrapWidth(text, font, maxWidth, minWidth)
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Layout measurement required before paint
        setCalculatedMaxWidth(width)
    }, [text, font, maxWidth, minWidth])

    return (
        <div
            className={className}
            style={{ maxWidth: calculatedMaxWidth, width: "fit-content" }}
        >
            {children}
        </div>
    )
}
