export function getCrawlSegmentStyle(index: number) {
    const palette = ["#74512d", "#4b6b8a", "#7a5f3a", "#3f7f6b"]
    const group = Math.floor(index / 2)
    const color = palette[group % palette.length]
    const isEven = index % 2 === 0

    return {
        color,
        weight: 4,
        opacity: 0.85,
        dashArray: isEven ? undefined : "6 6",
        lineCap: "round" as const,
    }
}
