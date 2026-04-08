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

    it("parses items with is_vegan, is_vegetarian, and calories fields", () => {
        const raw = JSON.stringify([
            {
                name: "Veggie Wrap",
                category: "Food",
                price: 180,
                description: "Fresh vegetable wrap",
                is_food: true,
                is_hot: false,
                is_cold: true,
                is_vegan: true,
                is_vegetarian: true,
                calories: 350,
            },
        ])
        const items = parseOcrMenuItems(raw)
        expect(items).toHaveLength(1)
        expect(items[0].name).toBe("Veggie Wrap")
        expect(items[0].is_vegan).toBe(true)
        expect(items[0].is_vegetarian).toBe(true)
        expect(items[0].calories).toBe(350)
    })

    it("handles missing optional fields gracefully", () => {
        const raw = JSON.stringify([
            {
                name: "Black Coffee",
                category: "Coffee",
                price: 120,
            },
        ])
        const items = parseOcrMenuItems(raw)
        expect(items).toHaveLength(1)
        expect(items[0].is_vegan).toBeUndefined()
        expect(items[0].calories).toBeUndefined()
    })

    it("parses calories as string and converts to number", () => {
        const raw = JSON.stringify([
            {
                name: "Latte",
                category: "Coffee",
                price: 150,
                calories: "200",
            },
        ])
        const items = parseOcrMenuItems(raw)
        expect(items).toHaveLength(1)
        expect(items[0].calories).toBe(200)
    })

    it("rejects negative calories", () => {
        const raw = JSON.stringify([
            {
                name: "Bad Item",
                category: "Other",
                price: 100,
                calories: -50,
            },
        ])
        const items = parseOcrMenuItems(raw)
        expect(items).toHaveLength(0)
    })
})
