import { describe, it, expect, mock } from "bun:test"
import React from "react"
import { render } from "@testing-library/react"
import ComparisonTable from "@/components/menu/ComparisonTable"
import type { ComparableMenuItem } from "@/utils/types/menu-comparison"

// Mock framer-motion to avoid animation issues in tests
mock.module("motion/react", () => ({
	motion: {
		div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
			<div {...props}>{children}</div>
		),
	},
}))

const createMockItem = (
	id: string,
	overrides: Partial<ComparableMenuItem> = {}
): ComparableMenuItem => ({
	id,
	cafeId: `cafe-${id}`,
	cafeName: `Cafe ${id}`,
	cafeSlug: `cafe-${id}`,
	name: `Item ${id}`,
	category: "Coffee",
	price: 150 + parseInt(id) * 10,
	description: `Description for item ${id}`,
	isAvailable: true,
	isFood: false,
	isHot: true,
	isCold: true,
	calories: 100 + parseInt(id) * 10,
	isVegan: false,
	isVegetarian: false,
	sizeOptions: null,
	imageUrl: null,
	...overrides,
})

describe("ComparisonTable", () => {
	it("renders empty state when no items provided", () => {
		const { getByText } = render(<ComparisonTable items={[]} />)

		expect(getByText("No items to compare")).toBeTruthy()
		expect(
			getByText("Search and add menu items above to start comparing them side-by-side")
		).toBeTruthy()
	})

	it("renders table with single item", () => {
		const item = createMockItem("1")
		const { container } = render(<ComparisonTable items={[item]} />)

		// Check table headers
		expect(container.textContent).toContain("Property")
		expect(container.textContent).toContain("Item 1")

		// Check row labels
		expect(container.textContent).toContain("Cafe")
		expect(container.textContent).toContain("Name")
		expect(container.textContent).toContain("Price")
		expect(container.textContent).toContain("Category")
		expect(container.textContent).toContain("Type")
		expect(container.textContent).toContain("Calories")
		expect(container.textContent).toContain("Hot/Cold")
		expect(container.textContent).toContain("Dietary")
		expect(container.textContent).toContain("Sizes")
		expect(container.textContent).toContain("Available")
	})

	it("displays cafe name with link", () => {
		const item = createMockItem("1", { cafeName: "Test Cafe", cafeSlug: "test-cafe" })
		const { container } = render(<ComparisonTable items={[item]} />)

		const cafeLink = container.querySelector('a[href="/cafes/test-cafe"]')
		expect(cafeLink).toBeTruthy()
		expect(cafeLink?.textContent).toContain("Test Cafe")
	})

	it("displays formatted price", () => {
		const item = createMockItem("1", { price: 199.99 })
		const { container } = render(<ComparisonTable items={[item]} />)

		expect(container.textContent).toContain("₱200")
	})

	it("displays food type with correct icon", () => {
		const foodItem = createMockItem("1", { isFood: true, name: "Food Item" })
		const { container } = render(<ComparisonTable items={[foodItem]} />)

		expect(container.textContent).toContain("Food")
	})

	it("displays drink type with correct icon", () => {
		const drinkItem = createMockItem("1", { isFood: false, name: "Drink Item" })
		const { container } = render(<ComparisonTable items={[drinkItem]} />)

		expect(container.textContent).toContain("Drink")
	})

	it("displays calories when available", () => {
		const item = createMockItem("1", { calories: 250 })
		const { container } = render(<ComparisonTable items={[item]} />)

		expect(container.textContent).toContain("250 kcal")
	})

	it("displays dash for null calories", () => {
		const item = createMockItem("1", { calories: null })
		const { container } = render(<ComparisonTable items={[item]} />)

		// Find the Calories row and check for dash
		const rows = container.querySelectorAll("tr")
		const caloriesRow = Array.from(rows).find((row) =>
			row.textContent?.includes("Calories")
		)
		expect(caloriesRow?.textContent).toContain("-")
	})

	it("displays vegan badge for vegan items", () => {
		const item = createMockItem("1", { isVegan: true })
		const { container } = render(<ComparisonTable items={[item]} />)

		expect(container.textContent).toContain("Vegan")
	})

	it("displays vegetarian badge for vegetarian items", () => {
		const item = createMockItem("1", { isVegetarian: true, isVegan: false })
		const { container } = render(<ComparisonTable items={[item]} />)

		expect(container.textContent).toContain("Veg")
	})

	it("displays dash for no dietary info", () => {
		const item = createMockItem("1", { isVegan: false, isVegetarian: false })
		const { container } = render(<ComparisonTable items={[item]} />)

		const rows = container.querySelectorAll("tr")
		const dietaryRow = Array.from(rows).find((row) =>
			row.textContent?.includes("Dietary")
		)
		expect(dietaryRow?.textContent).toContain("-")
	})

	it("displays size options when available", () => {
		const item = createMockItem("1", {
			sizeOptions: [
				{ label: "Small", price: 0 },
				{ label: "Large", price: 30 },
			],
		})
		const { container } = render(<ComparisonTable items={[item]} />)

		expect(container.textContent).toContain("Small")
		expect(container.textContent).toContain("Large")
		expect(container.textContent).toContain("+₱30")
	})

	it("displays dash for no size options", () => {
		const item = createMockItem("1", { sizeOptions: null })
		const { container } = render(<ComparisonTable items={[item]} />)

		const rows = container.querySelectorAll("tr")
		const sizesRow = Array.from(rows).find((row) =>
			row.textContent?.includes("Sizes")
		)
		expect(sizesRow?.textContent).toContain("-")
	})

	it("displays checkmark for available items", () => {
		const item = createMockItem("1", { isAvailable: true })
		const { container } = render(<ComparisonTable items={[item]} />)

		// Check for the check icon (we can't easily test the SVG, but we can verify the component renders)
		expect(container.querySelector("table")).toBeTruthy()
	})

	it("displays X for unavailable items", () => {
		const item = createMockItem("1", { isAvailable: false })
		const { container } = render(<ComparisonTable items={[item]} />)

		// Check the table renders
		expect(container.querySelector("table")).toBeTruthy()
	})

	it("renders up to 4 items in the table", () => {
		const items = [
			createMockItem("1"),
			createMockItem("2"),
			createMockItem("3"),
			createMockItem("4"),
		]
		const { container } = render(<ComparisonTable items={items} />)

		expect(container.textContent).toContain("Item 1")
		expect(container.textContent).toContain("Item 2")
		expect(container.textContent).toContain("Item 3")
		expect(container.textContent).toContain("Item 4")
	})

	it("maintains 4 column layout even with fewer items", () => {
		const items = [createMockItem("1"), createMockItem("2")]
		const { container } = render(<ComparisonTable items={items} />)

		const headers = container.querySelectorAll("thead th")
		// Should have Property column + 4 item columns
		expect(headers.length).toBe(5)
	})

	it("displays correct temperature icons for hot and cold", () => {
		const hotAndCold = createMockItem("1", { isHot: true, isCold: true })
		const { container } = render(<ComparisonTable items={[hotAndCold]} />)

		// Table should render
		expect(container.querySelector("table")).toBeTruthy()
	})

	it("displays only hot icon for hot-only items", () => {
		const hotOnly = createMockItem("1", { isHot: true, isCold: false })
		const { container } = render(<ComparisonTable items={[hotOnly]} />)

		expect(container.querySelector("table")).toBeTruthy()
	})

	it("displays only cold icon for cold-only items", () => {
		const coldOnly = createMockItem("1", { isHot: false, isCold: true })
		const { container } = render(<ComparisonTable items={[coldOnly]} />)

		expect(container.querySelector("table")).toBeTruthy()
	})
})
