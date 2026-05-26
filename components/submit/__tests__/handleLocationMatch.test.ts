import { describe, it, expect, mock } from "bun:test"

interface LocationMatch {
    region: string | null
    province: string | null
    city: string | null
    area: string | null
    fullAddress: string
}

interface SubmitFormData {
    region: string
    province: string
    city_municipality: string
    area: string
    address_display: string
}

/**
 * Pure-function version of handleLocationMatch.
 * Returns an object mapping field keys to their new values (or null if unchanged).
 */
function computeLocationMatchUpdates(
    match: LocationMatch,
    current: SubmitFormData
): Partial<SubmitFormData> {
    const updates: Partial<SubmitFormData> = {}

    // Only fill if empty (user hasn't manually selected from dropdown)
    if (match.region && !current.region) updates.region = match.region
    if (match.province && !current.province) updates.province = match.province
    if (match.city && !current.city_municipality) updates.city_municipality = match.city
    if (match.area && !current.area) updates.area = match.area
    if (match.fullAddress && !current.address_display.trim()) {
        updates.address_display = match.fullAddress
    }

    return updates
}

describe("computeLocationMatchUpdates", () => {
    const emptyForm: SubmitFormData = {
        region: "",
        province: "",
        city_municipality: "",
        area: "",
        address_display: "",
    }

    it("fills all empty fields when form is empty", () => {
        const match: LocationMatch = {
            region: "Region VII - Central Visayas",
            province: "Cebu",
            city: "Cebu City",
            area: "IT Park",
            fullAddress: "IT Park, Cebu City, Cebu",
        }

        const result = computeLocationMatchUpdates(match, emptyForm)

        expect(result.region).toBe("Region VII - Central Visayas")
        expect(result.province).toBe("Cebu")
        expect(result.city_municipality).toBe("Cebu City")
        expect(result.area).toBe("IT Park")
        expect(result.address_display).toBe("IT Park, Cebu City, Cebu")
    })

    it("does NOT overwrite region when user has already selected one", () => {
        const match: LocationMatch = {
            region: "Region VII - Central Visayas",
            province: "Cebu",
            city: "Cebu City",
            area: null,
            fullAddress: "Cebu City, Cebu",
        }

        const formWithRegion: SubmitFormData = {
            ...emptyForm,
            region: "Region XIII - Caraga",
        }

        const result = computeLocationMatchUpdates(match, formWithRegion)

        expect(result.region).toBeUndefined()
        expect(result.province).toBe("Cebu")
        expect(result.city_municipality).toBe("Cebu City")
    })

    it("does NOT overwrite province when user has already selected one", () => {
        const match: LocationMatch = {
            region: "Region VII - Central Visayas",
            province: "Cebu",
            city: "Cebu City",
            area: null,
            fullAddress: "Cebu City, Cebu",
        }

        const formWithProvince: SubmitFormData = {
            ...emptyForm,
            region: "Region XIII - Caraga",
            province: "Surigao del Norte",
        }

        const result = computeLocationMatchUpdates(match, formWithProvince)

        expect(result.region).toBeUndefined()
        expect(result.province).toBeUndefined()
        expect(result.city_municipality).toBe("Cebu City")
    })

    it("does NOT overwrite city when user has already selected one", () => {
        const match: LocationMatch = {
            region: "Region VII - Central Visayas",
            province: "Cebu",
            city: "Cebu City",
            area: null,
            fullAddress: "Cebu City, Cebu",
        }

        const formWithCity: SubmitFormData = {
            ...emptyForm,
            region: "Region XIII - Caraga",
            province: "Surigao del Norte",
            city_municipality: "Surigao City",
        }

        const result = computeLocationMatchUpdates(match, formWithCity)

        expect(result.region).toBeUndefined()
        expect(result.province).toBeUndefined()
        expect(result.city_municipality).toBeUndefined()
    })

    it("does NOT overwrite address_display when already filled", () => {
        const match: LocationMatch = {
            region: null,
            province: null,
            city: null,
            area: null,
            fullAddress: "Auto-detected address",
        }

        const formWithAddress: SubmitFormData = {
            ...emptyForm,
            address_display: "123 Main Street, Brgy. Example",
        }

        const result = computeLocationMatchUpdates(match, formWithAddress)

        expect(result.address_display).toBeUndefined()
    })

    it("fills address_display when empty even if no location hierarchy", () => {
        const match: LocationMatch = {
            region: null,
            province: null,
            city: null,
            area: null,
            fullAddress: "Some Road, Unknown Town",
        }

        const result = computeLocationMatchUpdates(match, emptyForm)

        expect(result.address_display).toBe("Some Road, Unknown Town")
        expect(result.region).toBeUndefined()
    })
})