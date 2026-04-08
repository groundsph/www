import { describe, expect, it } from "bun:test"
import { buildComparison, filterByDietary, filterByTemperature, getUniqueCategories, groupByCafe } from "@/utils/menu-comparison"
import type { ComparableMenuItem } from "@/utils/types/menu-comparison"

function createMockItem(overrides: Partial<ComparableMenuItem> = {}): ComparableMenuItem {
	return {
		id: "test-id",
		cafeId: "cafe-id",
		cafeName: "Test Cafe",
		cafeSlug: "test-cafe",
		name: "Test Item",
		category: "Coffee",
		price: 100,
		description: null,
		isAvailable: true,
		isFood: false,
		isHot: true,
		isCold: false,
		calories: null,
		isVegan: false,
		isVegetarian: false,
		sizeOptions: null,
		imageUrl: null,
		...overrides,
	}
}

describe("buildComparison", () => {
	it("returns empty result for no items", () => {
		const result = buildComparison([])
		expect(result.priceRange).toBeNull()
		expect(result.avgPrice).toBeNull()
		expect(result.items).toEqual([])
	})

	it("calculates price range and average for single item", () => {
		const items = [createMockItem({ price: 150 })]
		const result = buildComparison(items)
		expect(result.priceRange).toEqual({ min: 150, max: 150 })
		expect(result.avgPrice).toBe(150)
	})

	it("calculates price range and average for multiple items", () => {
		const items = [
			createMockItem({ id: "1", price: 100 }),
			createMockItem({ id: "2", price: 200 }),
			createMockItem({ id: "3", price: 300 }),
		]
		const result = buildComparison(items)
		expect(result.priceRange).toEqual({ min: 100, max: 300 })
		expect(result.avgPrice).toBe(200)
	})

	it("handles items with same price", () => {
		const items = [
			createMockItem({ id: "1", price: 150 }),
			createMockItem({ id: "2", price: 150 }),
			createMockItem({ id: "3", price: 150 }),
		]
		const result = buildComparison(items)
		expect(result.priceRange).toEqual({ min: 150, max: 150 })
		expect(result.avgPrice).toBe(150)
	})

	it("rounds average price to integer", () => {
		const items = [
			createMockItem({ id: "1", price: 100 }),
			createMockItem({ id: "2", price: 101 }),
		]
		const result = buildComparison(items)
		expect(result.avgPrice).toBe(101) // (100 + 101) / 2 = 100.5, rounds to 101
	})
})

describe("filterByDietary", () => {
	const items = [
		createMockItem({ id: "1", name: "Regular Coffee", isVegan: false, isVegetarian: false }),
		createMockItem({ id: "2", name: "Vegan Smoothie", isVegan: true, isVegetarian: true }),
		createMockItem({ id: "3", name: "Vegetarian Sandwich", isVegan: false, isVegetarian: true }),
		createMockItem({ id: "4", name: "Vegan Salad", isVegan: true, isVegetarian: true }),
	]

	it("filters by vegan option", () => {
		const result = filterByDietary(items, { vegan: true })
		expect(result).toHaveLength(2)
		expect(result.map((i) => i.name)).toContain("Vegan Smoothie")
		expect(result.map((i) => i.name)).toContain("Vegan Salad")
	})

	it("filters by vegetarian option", () => {
		const result = filterByDietary(items, { vegetarian: true })
		expect(result).toHaveLength(3)
		expect(result.map((i) => i.name)).toContain("Vegan Smoothie")
		expect(result.map((i) => i.name)).toContain("Vegetarian Sandwich")
		expect(result.map((i) => i.name)).toContain("Vegan Salad")
	})

	it("returns all items when no filters applied", () => {
		const result = filterByDietary(items, {})
		expect(result).toHaveLength(4)
	})

	it("returns empty array when no items match", () => {
		const result = filterByDietary(items, { vegan: true, vegetarian: true })
		expect(result).toHaveLength(2)
		result.forEach((item) => {
			expect(item.isVegan).toBe(true)
			expect(item.isVegetarian).toBe(true)
		})
	})
})

describe("filterByTemperature", () => {
	const items = [
		createMockItem({ id: "1", name: "Hot Coffee", isHot: true, isCold: false }),
		createMockItem({ id: "2", name: "Iced Coffee", isHot: false, isCold: true }),
		createMockItem({ id: "3", name: "Frappuccino", isHot: false, isCold: true }),
		createMockItem({ id: "4", name: "Hot Chocolate", isHot: true, isCold: false }),
	]

	it("filters by hot items", () => {
		const result = filterByTemperature(items, { hot: true })
		expect(result).toHaveLength(2)
		expect(result.map((i) => i.name)).toContain("Hot Coffee")
		expect(result.map((i) => i.name)).toContain("Hot Chocolate")
	})

	it("filters by cold items", () => {
		const result = filterByTemperature(items, { cold: true })
		expect(result).toHaveLength(2)
		expect(result.map((i) => i.name)).toContain("Iced Coffee")
		expect(result.map((i) => i.name)).toContain("Frappuccino")
	})

	it("returns all items when no filters applied", () => {
		const result = filterByTemperature(items, {})
		expect(result).toHaveLength(4)
	})
})

describe("getUniqueCategories", () => {
	it("returns empty array for empty input", () => {
		const result = getUniqueCategories([])
		expect(result).toEqual([])
	})

	it("returns unique categories from items", () => {
		const items = [
			createMockItem({ id: "1", category: "Coffee" }),
			createMockItem({ id: "2", category: "Tea" }),
			createMockItem({ id: "3", category: "Coffee" }),
			createMockItem({ id: "4", category: "Pastries" }),
		]
		const result = getUniqueCategories(items)
		expect(result).toHaveLength(3)
		expect(result).toContain("Coffee")
		expect(result).toContain("Tea")
		expect(result).toContain("Pastries")
	})

	it("preserves single category", () => {
		const items = [
			createMockItem({ id: "1", category: "Coffee" }),
			createMockItem({ id: "2", category: "Coffee" }),
		]
		const result = getUniqueCategories(items)
		expect(result).toEqual(["Coffee"])
	})
})

describe("groupByCafe", () => {
	it("returns empty object for empty input", () => {
		const result = groupByCafe([])
		expect(result).toEqual({})
	})

	it("groups items by cafe ID", () => {
		const items = [
			createMockItem({ id: "1", cafeId: "cafe-a", cafeName: "Cafe A" }),
			createMockItem({ id: "2", cafeId: "cafe-b", cafeName: "Cafe B" }),
			createMockItem({ id: "3", cafeId: "cafe-a", cafeName: "Cafe A" }),
		]
		const result = groupByCafe(items)
		expect(Object.keys(result)).toHaveLength(2)
		expect(result["cafe-a"]).toHaveLength(2)
		expect(result["cafe-b"]).toHaveLength(1)
	})

	it("preserves cafe association", () => {
		const items = [
			createMockItem({ id: "1", cafeId: "cafe-a", cafeName: "Cafe A" }),
		]
		const result = groupByCafe(items)
		expect(result["cafe-a"][0].cafeName).toBe("Cafe A")
		expect(result["cafe-a"][0].cafeId).toBe("cafe-a")
	})
})
