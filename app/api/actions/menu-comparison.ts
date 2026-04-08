"use server"

import { searchMenuItemsForComparison } from "@/utils/menu-comparison"
import type { ComparableMenuItem } from "@/utils/types/menu-comparison"

export async function searchMenuItemsAction(
	query: string,
	limit: number = 10
): Promise<ComparableMenuItem[]> {
	if (!query || query.trim().length < 2) {
		return []
	}
	return searchMenuItemsForComparison(query, limit)
}
