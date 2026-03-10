import type { CafeWithRatings } from "@/utils/types/extra"
import type { DayKey } from "@/utils/time"

export interface FilterOptions {
	includeChains: boolean
	is24_7: boolean
	isHalalCertified: boolean
	todayKey: DayKey
}

export function filterCafes(
	cafes: CafeWithRatings[],
	options: FilterOptions
): CafeWithRatings[] {
	const { includeChains, is24_7, isHalalCertified, todayKey } = options
	return cafes.filter((cafe) => {
		if (!includeChains && cafe.is_chain === true) return false
		if (is24_7) {
			const hours = cafe.operating_hours
			if (!Array.isArray(hours)) return false
			const todayEntry = hours.find(
				(h: { day: string; is_24_hours?: boolean }) => h.day === todayKey
			)
			if (!todayEntry?.is_24_hours) return false
		}
		if (isHalalCertified && !cafe.is_halal_certified) return false
		return true
	})
}
