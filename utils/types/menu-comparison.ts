import type { CafeMenuItem } from "./owner"

export interface ComparableMenuItem {
	id: string
	cafeId: string
	cafeName: string
	cafeSlug: string
	name: string
	category: string
	price: number
	description: string | null
	isAvailable: boolean
	isFood: boolean
	isHot: boolean
	isCold: boolean
	calories: number | null
	isVegan: boolean
	isVegetarian: boolean
	sizeOptions: Array<{ label: string; price: number }> | null
	imageUrl: string | null
}

export interface ComparisonResult {
	items: ComparableMenuItem[]
	priceRange: { min: number; max: number } | null
	avgPrice: number | null
}

/**
 * Converts a CafeMenuItem to a ComparableMenuItem
 * Requires cafe name and slug to be provided separately
 */
export function toComparableMenuItem(
	item: CafeMenuItem,
	cafeName: string,
	cafeSlug: string
): ComparableMenuItem {
	return {
		id: item.id,
		cafeId: item.cafe_id,
		cafeName,
		cafeSlug,
		name: item.name,
		category: item.category,
		price: item.price,
		description: item.description,
		isAvailable: item.is_available,
		isFood: item.is_food,
		isHot: item.is_hot,
		isCold: item.is_cold,
		calories: item.calories,
		isVegan: item.is_vegan,
		isVegetarian: item.is_vegetarian,
		sizeOptions: item.size_options,
		imageUrl: item.image_url,
	}
}
