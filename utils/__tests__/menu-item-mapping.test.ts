import { describe, it, expect } from "bun:test"
import { ocrItemToMenuItem } from "@/utils/menu-item-mapping"
import type { OcrMenuItem } from "@/utils/ai/menu-ocr"

function ocrItem(overrides: Partial<OcrMenuItem> = {}): OcrMenuItem {
    return {
        name: "  Spanish Latte  ",
        category: "Coffee",
        price: 150,
        ...overrides,
    } as OcrMenuItem
}

describe("ocrItemToMenuItem", () => {
    it("maps core fields and gives each item a fresh id", () => {
        const first = ocrItemToMenuItem(ocrItem())
        const second = ocrItemToMenuItem(ocrItem())

        expect(first.name).toBe("Spanish Latte")
        expect(first.category).toBe("Coffee")
        expect(first.price).toBe(150)
        expect(first.description).toBe("")
        expect(first.id).not.toBe(second.id)
        expect(first.sizeOptions).toEqual([])
        expect(first.imageFile).toBeNull()
    })

    it("coerces a string price from the model", () => {
        expect(ocrItemToMenuItem(ocrItem({ price: "185.5" as unknown as number })).price).toBe(185.5)
    })

    it("falls back to 0 when the price is unusable", () => {
        expect(ocrItemToMenuItem(ocrItem({ price: "₱150" as unknown as number })).price).toBe(0)
        expect(ocrItemToMenuItem(ocrItem({ price: NaN })).price).toBe(0)
    })

    it("carries type toggles, description, and calories", () => {
        const item = ocrItemToMenuItem(ocrItem({
            description: "  Oat milk  ",
            is_food: true,
            is_hot: true,
            is_vegan: true,
            calories: 220,
        }))

        expect(item.description).toBe("Oat milk")
        expect(item.isFood).toBe(true)
        expect(item.isHot).toBe(true)
        expect(item.isVegan).toBe(true)
        expect(item.isCold).toBeUndefined()
        expect(item.calories).toBe(220)
    })
})
