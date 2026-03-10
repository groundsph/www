import { describe, it, expect } from "bun:test"
import { filterCafes } from "@/utils/map/client-filter"
import type { CafeWithRatings } from "@/utils/types/extra"

// Minimal cafe stub factory
function makeCafe(overrides: Partial<CafeWithRatings> = {}): CafeWithRatings {
	return {
		id: "test-id",
		name: "Test Cafe",
		slug: "test-cafe",
		thumbnail: null,
		gallery: null,
		description: null,
		address_display: "123 Test St",
		area: null,
		city_municipality: "Manila",
		province: "Metro Manila",
		region: "NCR",
		lat: 14.5,
		lng: 121.0,
		price_level: null,
		coffee_style: null,
		membership_tier: null,
		roaster: null,
		brew_methods: null,
		specialty: null,
		milk_options: null,
		tags: null,
		operating_hours: null,
		socials: null,
		phone: null,
		email: null,
		website_url: null,
		payment_methods: null,
		has_wifi: null,
		has_smoking: null,
		has_sockets: null,
		has_aircon: null,
		has_parking: null,
		has_outdoor_seating: null,
		has_indoor_seating: null,
		has_restroom: null,
		has_bidet: null,
		has_non_dairy: null,
		has_decaf: null,
		is_pet_friendly: null,
		is_work_friendly: null,
		serves_food: null,
		is_active: true,
		is_published: true,
		is_verified: false,
		is_claimed: false,
		is_hidden_gem: false,
		finding_hint: null,
		is_chain: null,
		is_halal_certified: false,
		straw_type: "",
		straw_type_other: "",
		owner_ids: null,
		contributor_id: null,
		featured_until: null,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		average_rating: null,
		total_reviews: null,
		...overrides,
	} as unknown as CafeWithRatings
}

const baseOptions = {
	includeChains: false,
	is24_7: false,
	isHalalCertified: false,
	todayKey: "mon" as const,
}

describe("filterCafes", () => {
	describe("chain filter", () => {
		it("excludes chain cafes when includeChains is false", () => {
			const cafes = [
				makeCafe({ id: "1", is_chain: true }),
				makeCafe({ id: "2", is_chain: false }),
				makeCafe({ id: "3", is_chain: null }),
			]
			const result = filterCafes(cafes, baseOptions)
			expect(result.map((c) => c.id)).toEqual(["2", "3"])
		})

		it("includes chain cafes when includeChains is true", () => {
			const cafes = [
				makeCafe({ id: "1", is_chain: true }),
				makeCafe({ id: "2", is_chain: false }),
			]
			const result = filterCafes(cafes, { ...baseOptions, includeChains: true })
			expect(result).toHaveLength(2)
		})
	})

	describe("24/7 filter", () => {
		it("includes cafe with today marked as 24 hours", () => {
			const cafes = [
				makeCafe({
					id: "1",
					operating_hours: [{ day: "mon", is_24_hours: true }],
				}),
			]
			const result = filterCafes(cafes, { ...baseOptions, is24_7: true })
			expect(result).toHaveLength(1)
		})

		it("excludes cafe with today NOT marked as 24 hours", () => {
			const cafes = [
				makeCafe({
					id: "1",
					operating_hours: [{ day: "mon", is_24_hours: false }],
				}),
			]
			const result = filterCafes(cafes, { ...baseOptions, is24_7: true })
			expect(result).toHaveLength(0)
		})

		it("excludes cafe with no operating_hours when 24/7 filter is active", () => {
			const cafes = [makeCafe({ id: "1", operating_hours: null })]
			const result = filterCafes(cafes, { ...baseOptions, is24_7: true })
			expect(result).toHaveLength(0)
		})

		it("excludes cafe missing today's entry in operating_hours", () => {
			const cafes = [
				makeCafe({
					id: "1",
					operating_hours: [{ day: "tue", is_24_hours: true }],
				}),
			]
			const result = filterCafes(cafes, {
				...baseOptions,
				is24_7: true,
				todayKey: "mon",
			})
			expect(result).toHaveLength(0)
		})

		it("does not filter by 24/7 when is24_7 is false", () => {
			const cafes = [makeCafe({ id: "1", operating_hours: null })]
			const result = filterCafes(cafes, { ...baseOptions, is24_7: false })
			expect(result).toHaveLength(1)
		})
	})

	describe("halal filter", () => {
		it("includes only halal-certified cafes when filter is active", () => {
			const cafes = [
				makeCafe({ id: "1", is_halal_certified: true }),
				makeCafe({ id: "2", is_halal_certified: false }),
			]
			const result = filterCafes(cafes, { ...baseOptions, isHalalCertified: true })
			expect(result.map((c) => c.id)).toEqual(["1"])
		})

		it("includes all cafes regardless of halal status when filter is off", () => {
			const cafes = [
				makeCafe({ id: "1", is_halal_certified: true }),
				makeCafe({ id: "2", is_halal_certified: false }),
			]
			const result = filterCafes(cafes, { ...baseOptions, isHalalCertified: false })
			expect(result).toHaveLength(2)
		})
	})

	describe("combined filters", () => {
		it("applies all three filters simultaneously", () => {
			const cafes = [
				// passes all filters
				makeCafe({
					id: "pass",
					is_chain: false,
					is_halal_certified: true,
					operating_hours: [{ day: "mon", is_24_hours: true }],
				}),
				// chain — excluded
				makeCafe({
					id: "chain",
					is_chain: true,
					is_halal_certified: true,
					operating_hours: [{ day: "mon", is_24_hours: true }],
				}),
				// not halal — excluded
				makeCafe({
					id: "not-halal",
					is_chain: false,
					is_halal_certified: false,
					operating_hours: [{ day: "mon", is_24_hours: true }],
				}),
				// not 24/7 — excluded
				makeCafe({
					id: "not-24",
					is_chain: false,
					is_halal_certified: true,
					operating_hours: [{ day: "mon", is_24_hours: false }],
				}),
			]
			const result = filterCafes(cafes, {
				includeChains: false,
				is24_7: true,
				isHalalCertified: true,
				todayKey: "mon",
			})
			expect(result.map((c) => c.id)).toEqual(["pass"])
		})
	})
})
