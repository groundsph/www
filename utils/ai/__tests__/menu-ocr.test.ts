import { describe, it, expect } from "bun:test"
import { parseOcrMenuItems } from "@/utils/ai/menu-ocr"

describe("parseOcrMenuItems", () => {
    it("parses valid JSON array", () => {
        const raw = JSON.stringify([
            { name: "Espresso", category: "Coffee", price: 3.5, is_food: false, is_hot: true },
            { name: "Croissant", category: "Pastries", price: 4.0, is_food: true, is_cold: false },
        ])
        const items = parseOcrMenuItems(raw)
        expect(items).toHaveLength(2)
        expect(items[0].name).toBe("Espresso")
        expect(items[0].price).toBe(3.5)
        expect(items[1].name).toBe("Croissant")
        expect(items[1].price).toBe(4.0)
    })

    it("returns empty array for invalid JSON", () => {
        const raw = "this is not json { invalid"
        const items = parseOcrMenuItems(raw)
        expect(items).toHaveLength(0)
    })

    it("filters items missing required fields", () => {
        const raw = JSON.stringify([
            { name: "Espresso", category: "Coffee", price: 3.5, is_food: false },
            { name: "", category: "Tea", price: 2.5, is_food: false },
            { name: "Muffin", category: "Pastries", price: 3.5, is_food: true },
            { name: "Water", category: "Drinks" },
        ])
        const items = parseOcrMenuItems(raw)
        expect(items).toHaveLength(2)
        expect(items[0].name).toBe("Espresso")
        expect(items[1].name).toBe("Muffin")
    })

    it("normalizes string price to number", () => {
        const raw = JSON.stringify([
            { name: "Espresso", category: "Coffee", price: "3.50", is_food: false, is_hot: true },
            { name: "Americano", category: "Coffee", price: 4, is_food: false, is_hot: true },
        ])
        const items = parseOcrMenuItems(raw)
        expect(items).toHaveLength(2)
        expect(typeof items[0].price).toBe("number")
        expect(items[0].price).toBe(3.5)
        expect(typeof items[1].price).toBe("number")
        expect(items[1].price).toBe(4)
    })

    it("handles markdown code block wrapper", () => {
        const raw = `
Here's the menu I extracted:

\`\`\`json
[
  { "name": "Latte", "category": "Coffee", "price": 4.5, "is_food": false, "is_hot": true },
  { "name": "Sandwich", "category": "Food", "price": 8.0, "is_food": true, "is_cold": false }
]
\`\`\`

Let me know if you need anything else!
        `
        const items = parseOcrMenuItems(raw)
        expect(items).toHaveLength(2)
        expect(items[0].name).toBe("Latte")
        expect(items[1].name).toBe("Sandwich")
    })
})
