import { db } from "@/db"
import { cafeMenuItems, cafes } from "@/db/schema/tables"
import { eq, ilike, and, sql } from "drizzle-orm"
import type { ComparableMenuItem, ComparisonResult } from "./types/menu-comparison"

/**
 * Search for menu items across all cafes for comparison
 * Joins with cafes table to get cafe name and slug
 */
export async function searchMenuItemsForComparison(
	query: string,
	limit: number = 20
): Promise<ComparableMenuItem[]> {
	const searchPattern = `%${query}%`

	const results = await db
		.select({
			item: cafeMenuItems,
			cafeName: cafes.name,
			cafeSlug: cafes.slug,
		})
		.from(cafeMenuItems)
		.innerJoin(cafes, eq(cafeMenuItems.cafeId, cafes.id))
		.where(
			and(
				ilike(cafeMenuItems.name, searchPattern),
				eq(cafeMenuItems.isAvailable, true)
			)
		)
		.limit(limit)

	return results.map(({ item, cafeName, cafeSlug }) =>
		mapToComparableMenuItem(item, cafeName, cafeSlug)
	)
}

/**
 * Get all menu items for a specific cafe by slug
 * Optional category filter
 */
export async function getMenuItemsByCafeSlug(
	slug: string,
	category?: string
): Promise<ComparableMenuItem[]> {
	// Build the where condition based on whether category is provided
	const whereCondition = category
		? and(
				eq(cafes.slug, slug),
				eq(cafeMenuItems.category, category)
			)
		: eq(cafes.slug, slug)

	const results = await db
		.select({
			item: cafeMenuItems,
			cafeName: cafes.name,
			cafeSlug: cafes.slug,
		})
		.from(cafeMenuItems)
		.innerJoin(cafes, eq(cafeMenuItems.cafeId, cafes.id))
		.where(whereCondition)

	return results.map(({ item, cafeName, cafeSlug }) =>
		mapToComparableMenuItem(item, cafeName, cafeSlug)
	)
}

/**
 * Build a comparison result from a list of menu items
 * Calculates price range and average
 */
export function buildComparison(items: ComparableMenuItem[]): ComparisonResult {
	if (items.length === 0) {
		return {
			items: [],
			priceRange: null,
			avgPrice: null,
		}
	}

	const prices = items.map((item) => item.price)
	const min = Math.min(...prices)
	const max = Math.max(...prices)
	const avg = prices.reduce((sum, price) => sum + price, 0) / prices.length

	return {
		items,
		priceRange: { min, max },
		avgPrice: Math.round(avg),
	}
}

/**
 * Filter items by dietary preferences
 */
export function filterByDietary(
	items: ComparableMenuItem[],
	options: {
		vegan?: boolean
		vegetarian?: boolean
	}
): ComparableMenuItem[] {
	return items.filter((item) => {
		if (options.vegan && !item.isVegan) return false
		if (options.vegetarian && !item.isVegetarian) return false
		return true
	})
}

/**
 * Filter items by temperature preference
 */
export function filterByTemperature(
	items: ComparableMenuItem[],
	options: {
		hot?: boolean
		cold?: boolean
	}
): ComparableMenuItem[] {
	return items.filter((item) => {
		if (options.hot && !item.isHot) return false
		if (options.cold && !item.isCold) return false
		return true
	})
}

/**
 * Get unique categories from a list of items
 */
export function getUniqueCategories(items: ComparableMenuItem[]): string[] {
	return Array.from(new Set(items.map((item) => item.category)))
}

/**
 * Group items by cafe
 */
export function groupByCafe(
	items: ComparableMenuItem[]
): Record<string, ComparableMenuItem[]> {
	return items.reduce((acc, item) => {
		if (!acc[item.cafeId]) {
			acc[item.cafeId] = []
		}
		acc[item.cafeId].push(item)
		return acc
	}, {} as Record<string, ComparableMenuItem[]>)
}

// Helper function to map database result to ComparableMenuItem
function mapToComparableMenuItem(
	item: typeof cafeMenuItems.$inferSelect,
	cafeName: string,
	cafeSlug: string
): ComparableMenuItem {
	return {
		id: item.id,
		cafeId: item.cafeId,
		cafeName,
		cafeSlug,
		name: item.name,
		category: item.category,
		price: item.price,
		description: item.description ?? null,
		isAvailable: item.isAvailable ?? true,
		isFood: item.isFood ?? false,
		isHot: item.isHot ?? false,
		isCold: item.isCold ?? false,
		calories: item.calories ?? null,
		isVegan: item.isVegan ?? false,
		isVegetarian: item.isVegetarian ?? false,
		sizeOptions: item.sizeOptions ?? null,
		imageUrl: item.imageUrl ?? null,
	}
}
