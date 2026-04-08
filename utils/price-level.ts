export type PriceLevel = "budget" | "mid" | "premium" | "luxury"

const PRICE_LEVEL_RANGES: Array<{ min: number; max: number; level: PriceLevel }> = [
    { min: 0, max: 150, level: "budget" },
    { min: 150, max: 250, level: "mid" },
    { min: 250, max: 400, level: "premium" },
    { min: 400, max: Infinity, level: "luxury" },
]

const MIN_ITEMS_FOR_AUTO_CALC = 5

export function calculatePriceLevel(prices: number[]): PriceLevel | null {
    if (prices.length < MIN_ITEMS_FOR_AUTO_CALC) return null
    const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length
    for (const range of PRICE_LEVEL_RANGES) {
        if (avg >= range.min && avg < range.max) return range.level
    }
    return "luxury"
}
