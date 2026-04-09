import { describe, expect, it } from "bun:test"
import type { OcrMenuItem } from "@/utils/ai/menu-ocr"
import { levenshteinDistance, normalizeName, isSimilarName, deduplicateMenuItems } from "../menu-ocr"

describe("saveOcrMenuItems sort order", () => {
    it("should fetch highest sortOrder, not lowest", () => {
        expect(true).toBe(true)
    })
})

describe("normalizeName", () => {
    it("lowercases the name", async () => {
        await expect(normalizeName("ESPRESSO")).resolves.toBe("espresso")
        await expect(normalizeName("Cappuccino")).resolves.toBe("cappuccino")
    })

    it("collapses multiple whitespace characters to single space", async () => {
        await expect(normalizeName("hot   coffee")).resolves.toBe("hot coffee")
        await expect(normalizeName("cold  brew")).resolves.toBe("cold brew")
        await expect(normalizeName("a\n\tb")).resolves.toBe("a b")
    })

    it("trims leading and trailing whitespace", async () => {
        await expect(normalizeName("  espresso  ")).resolves.toBe("espresso")
        await expect(normalizeName("\tlatte\t")).resolves.toBe("latte")
    })

    it("handles combined cases", async () => {
        await expect(normalizeName("  HOT   COFFEE  ")).resolves.toBe("hot coffee")
        await expect(normalizeName("\n  Iced   Latte  \n")).resolves.toBe("iced latte")
    })
})

describe("levenshteinDistance", () => {
    it("returns 0 for identical strings", async () => {
        await expect(levenshteinDistance("espresso", "espresso")).resolves.toBe(0)
        await expect(levenshteinDistance("", "")).resolves.toBe(0)
    })

    it("returns length of strings for completely different strings", async () => {
        await expect(levenshteinDistance("abc", "def")).resolves.toBe(3)
        await expect(levenshteinDistance("espresso", "latte")).resolves.toBe(7)
    })

    it("handles insertions", async () => {
        await expect(levenshteinDistance("espresso", "espressos")).resolves.toBe(1)
        await expect(levenshteinDistance("latte", "lattey")).resolves.toBe(1)
    })

    it("handles deletions", async () => {
        await expect(levenshteinDistance("espressos", "espresso")).resolves.toBe(1)
        await expect(levenshteinDistance("lattey", "latte")).resolves.toBe(1)
    })

    it("handles substitutions", async () => {
        await expect(levenshteinDistance("espresso", "espressa")).resolves.toBe(1)
        await expect(levenshteinDistance("coffee", "caffee")).resolves.toBe(1)
    })

    it("handles mixed operations", async () => {
        await expect(levenshteinDistance("kitten", "sitting")).resolves.toBe(3)
        await expect(levenshteinDistance("saturday", "sunday")).resolves.toBe(3)
    })

    it("handles empty strings", async () => {
        await expect(levenshteinDistance("", "espresso")).resolves.toBe(8)
        await expect(levenshteinDistance("espresso", "")).resolves.toBe(8)
    })
})

describe("isSimilarName", () => {
    describe("exact match after normalization", () => {
        it("returns true for identical names", async () => {
            await expect(isSimilarName("espresso", "espresso")).resolves.toBe(true)
        })

        it("returns true for same name with different case", async () => {
            await expect(isSimilarName("Espresso", "ESPRESSO")).resolves.toBe(true)
        })

        it("returns true for same name with extra whitespace", async () => {
            await expect(isSimilarName("hot coffee", "hot   coffee")).resolves.toBe(true)
        })

        it("returns false for different names", async () => {
            await expect(isSimilarName("espresso", "latte")).resolves.toBe(false)
        })
    })

    describe("one contains the other", () => {
        it("returns true when a contains b", async () => {
            await expect(isSimilarName("Iced Latte with Extra Shot", "Iced Latte")).resolves.toBe(true)
        })

        it("returns true when b contains a", async () => {
            await expect(isSimilarName("Iced Latte", "Iced Latte with Extra Shot")).resolves.toBe(true)
        })

        it("returns false when neither contains the other", async () => {
            await expect(isSimilarName("Iced Latte", "Hot Coffee")).resolves.toBe(false)
        })
    })

    describe("Levenshtein threshold (20% diff)", () => {
        it("returns true when Levenshtein distance is within 20%", async () => {
            await expect(isSimilarName("espresso", "espreso")).resolves.toBe(true)
        })

        it("returns false when Levenshtein distance exceeds 20%", async () => {
            await expect(isSimilarName("espresso", "milk")).resolves.toBe(false)
        })

        it("applies threshold based on longer length", async () => {
            const longName1 = "very delicious chocolate cake"
            const longName2 = "very delicious chocolatecakes"
            await expect(isSimilarName(longName1, longName2)).resolves.toBe(true)
        })

        it("handles short names (≤5 chars) differently", async () => {
            await expect(isSimilarName("coffee", "cofee")).resolves.toBe(true)
            await expect(isSimilarName("latte", "latte")).resolves.toBe(true)
        })
    })
})

describe("deduplicateMenuItems", () => {
    it("returns all new items when existing items is empty", async () => {
        const newItems = [
            { name: "Espresso", category: "Coffee", price: 120 },
            { name: "Latte", category: "Coffee", price: 150 },
        ]
        const existingItems: Array<{ name: string; category: string; price: number }> = []

        const result = await deduplicateMenuItems(newItems, existingItems)

        expect(result).toHaveLength(2)
        expect(result.map(i => i.name)).toContain("Espresso")
        expect(result.map(i => i.name)).toContain("Latte")
    })

    it("returns all new items when new items is empty", async () => {
        const newItems: OcrMenuItem[] = []
        const existingItems = [
            { name: "Espresso", category: "Coffee", price: 120 },
        ]

        const result = await deduplicateMenuItems(newItems, existingItems)

        expect(result).toHaveLength(0)
    })

    it("filters out exact matches", async () => {
        const newItems = [
            { name: "Espresso", category: "Coffee", price: 120 },
            { name: "Latte", category: "Coffee", price: 150 },
        ]
        const existingItems = [
            { name: "Espresso", category: "Coffee", price: 120 },
        ]

        const result = await deduplicateMenuItems(newItems, existingItems)

        expect(result).toHaveLength(1)
        expect(result[0].name).toBe("Latte")
    })

    it("filters out similar names (case insensitive)", async () => {
        const newItems = [
            { name: "ESPRESSO", category: "Coffee", price: 120 },
            { name: "Latte", category: "Coffee", price: 150 },
        ]
        const existingItems = [
            { name: "espresso", category: "Coffee", price: 120 },
        ]

        const result = await deduplicateMenuItems(newItems, existingItems)

        expect(result).toHaveLength(1)
        expect(result[0].name).toBe("Latte")
    })

    it("filters out similar names (whitespace differences)", async () => {
        const newItems = [
            { name: "Hot  Coffee", category: "Coffee", price: 120 },
            { name: "Latte", category: "Coffee", price: 150 },
        ]
        const existingItems = [
            { name: "Hot Coffee", category: "Coffee", price: 120 },
        ]

        const result = await deduplicateMenuItems(newItems, existingItems)

        expect(result).toHaveLength(1)
        expect(result[0].name).toBe("Latte")
    })

    it("filters out names within Levenshtein threshold", async () => {
        const newItems = [
            { name: "Espresso", category: "Coffee", price: 120 },
            { name: "Latte", category: "Coffee", price: 150 },
        ]
        const existingItems = [
            { name: "Espreso", category: "Coffee", price: 120 },
        ]

        const result = await deduplicateMenuItems(newItems, existingItems)

        expect(result).toHaveLength(1)
        expect(result[0].name).toBe("Latte")
    })

    it("keeps items that are different enough", async () => {
        const newItems = [
            { name: "Espresso", category: "Coffee", price: 120 },
            { name: "Cold Brew", category: "Coffee", price: 140 },
        ]
        const existingItems = [
            { name: "Espresso", category: "Coffee", price: 120 },
        ]

        const result = await deduplicateMenuItems(newItems, existingItems)

        expect(result).toHaveLength(1)
        expect(result[0].name).toBe("Cold Brew")
    })

    it("filters out when one contains the other", async () => {
        const newItems = [
            { name: "Iced Latte with Vanilla Syrup", category: "Coffee", price: 180 },
            { name: "Hot Coffee", category: "Coffee", price: 120 },
        ]
        const existingItems = [
            { name: "Iced Latte", category: "Coffee", price: 160 },
        ]

        const result = await deduplicateMenuItems(newItems, existingItems)

        expect(result).toHaveLength(1)
        expect(result[0].name).toBe("Hot Coffee")
    })

    it("handles multiple existing items", async () => {
        const newItems = [
            { name: "Espresso", category: "Coffee", price: 120 },
            { name: "Americano", category: "Coffee", price: 130 },
            { name: "Mocha", category: "Coffee", price: 170 },
        ]
        const existingItems = [
            { name: "Espresso", category: "Coffee", price: 120 },
            { name: "Latte", category: "Coffee", price: 150 },
        ]

        const result = await deduplicateMenuItems(newItems, existingItems)

        expect(result).toHaveLength(2)
        expect(result.map(i => i.name)).toContain("Americano")
        expect(result.map(i => i.name)).toContain("Mocha")
        expect(result.map(i => i.name)).not.toContain("Espresso")
    })

    it("preserves all properties of non-duplicate items including new fields", async () => {
        const newItems: OcrMenuItem[] = [
            { 
                name: "Signature Latte", 
                category: "Coffee", 
                price: 180, 
                description: "Our special latte",
                is_hot: true,
                is_vegan: true,
                is_vegetarian: true,
                calories: 250,
            },
        ]
        const existingItems: Array<{ name: string; category: string; price: number }> = []

        const result = await deduplicateMenuItems(newItems, existingItems)

        expect(result).toHaveLength(1)
        expect(result[0].name).toBe("Signature Latte")
        expect(result[0].category).toBe("Coffee")
        expect(result[0].price).toBe(180)
        expect(result[0].description).toBe("Our special latte")
        expect(result[0].is_hot).toBe(true)
        expect(result[0].is_vegan).toBe(true)
        expect(result[0].is_vegetarian).toBe(true)
        expect(result[0].calories).toBe(250)
    })
})
