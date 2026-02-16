import type { PathOptions } from "leaflet"

export function getCrawlSegmentStyle(index: number, isActive = false, isRevealed = true): PathOptions {
    const palette = ["#74512d", "#4b6b8a", "#7a5f3a", "#3f7f6b"]
    const group = Math.floor(index / 2)
    const color = palette[group % palette.length]
    const isEven = index % 2 === 0

    return {
        color,
        weight: isActive ? 6 : 4,
        opacity: isRevealed ? (isActive ? 1 : 0.85) : 0,
        dashArray: isEven ? undefined : "6 6",
        lineCap: "round" as const,
        className: `crawl-route-segment ${isActive ? "crawl-route-segment-active" : ""} ${!isRevealed ? "crawl-route-segment-hidden" : ""}`,
    }
}
