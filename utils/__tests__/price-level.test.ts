import { describe, expect, it } from "bun:test"
import { calculatePriceLevel } from "@/utils/price-level"

describe("calculatePriceLevel", () => {
    it("returns budget for avg price < 150", () => {
        expect(calculatePriceLevel([100, 120, 80, 140, 100])).toBe("budget")
    })
    it("returns mid for avg price 150-250", () => {
        expect(calculatePriceLevel([150, 180, 200, 220, 180])).toBe("mid")
    })
    it("returns premium for avg price 250-400", () => {
        expect(calculatePriceLevel([250, 300, 350, 280, 300])).toBe("premium")
    })
    it("returns luxury for avg price > 400", () => {
        expect(calculatePriceLevel([400, 500, 450, 600, 550])).toBe("luxury")
    })
    it("returns null for fewer than 5 items", () => {
        expect(calculatePriceLevel([100, 200, 300, 400])).toBeNull()
    })
    it("handles empty array", () => {
        expect(calculatePriceLevel([])).toBeNull()
    })
})
