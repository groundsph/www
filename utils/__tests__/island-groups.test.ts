import { describe, it, expect } from "bun:test"

import {
    getIslandGroup,
    getIslandGroupsFromRegions,
    ISLAND_GROUPS,
} from "@/utils/badges/island-groups"
import { PHILIPPINES_LOCATIONS } from "@/utils/data/philippines"

describe("getIslandGroup", () => {
    it("maps every PSGC region in the location dataset", () => {
        const unmapped = PHILIPPINES_LOCATIONS.regions
            .map((region) => region.name)
            .filter((name) => getIslandGroup(name) === null)

        expect(unmapped).toEqual([])
    })

    it("classifies the canonical region labels", () => {
        expect(getIslandGroup("NCR - National Capital Region")).toBe("luzon")
        expect(getIslandGroup("Region IV-A - CALABARZON")).toBe("luzon")
        expect(getIslandGroup("Region IV-B - MIMAROPA")).toBe("luzon")
        expect(getIslandGroup("CAR - Cordillera Administrative Region")).toBe("luzon")
        expect(getIslandGroup("Region VI - Western Visayas")).toBe("visayas")
        expect(getIslandGroup("Region VII - Central Visayas")).toBe("visayas")
        expect(getIslandGroup("Region VIII - Eastern Visayas")).toBe("visayas")
        expect(getIslandGroup("Region IX - Zamboanga Peninsula")).toBe("mindanao")
        expect(getIslandGroup("Region X - Northern Mindanao")).toBe("mindanao")
        expect(getIslandGroup("Region XI - Davao Region")).toBe("mindanao")
        expect(getIslandGroup("Region XII - SOCCSKSARGEN")).toBe("mindanao")
        expect(getIslandGroup("Region XIII - Caraga")).toBe("mindanao")
        expect(getIslandGroup("BARMM - Bangsamoro")).toBe("mindanao")
    })

    it("does not clip multi-letter ordinals", () => {
        // Regression: a naive /x{1,3}/ style match read "XIII" as "X".
        expect(getIslandGroup("Region XIII - Caraga")).toBe("mindanao")
        expect(getIslandGroup("Region VIII - Eastern Visayas")).toBe("visayas")
        expect(getIslandGroup("Region VII - Central Visayas")).toBe("visayas")
    })

    it("accepts bare codes and descriptive aliases from imported/geo data", () => {
        expect(getIslandGroup("Region VII")).toBe("visayas")
        expect(getIslandGroup("region vii")).toBe("visayas")
        expect(getIslandGroup("Central Visayas")).toBe("visayas")
        expect(getIslandGroup("Metro Manila")).toBe("luzon")
        expect(getIslandGroup("Davao Region")).toBe("mindanao")
        expect(getIslandGroup("CALABARZON")).toBe("luzon")
        expect(getIslandGroup("Bangsamoro")).toBe("mindanao")
    })

    it("returns null for empty or unknown regions", () => {
        expect(getIslandGroup(null)).toBeNull()
        expect(getIslandGroup(undefined)).toBeNull()
        expect(getIslandGroup("   ")).toBeNull()
        expect(getIslandGroup("Atlantis")).toBeNull()
    })
})

describe("getIslandGroupsFromRegions", () => {
    it("dedupes and ignores unknown regions", () => {
        const groups = getIslandGroupsFromRegions([
            "Region VII - Central Visayas",
            "Region VII - Central Visayas",
            "Region XIII - Caraga",
            "Atlantis",
            null,
        ])

        expect([...groups].sort()).toEqual(["mindanao", "visayas"])
    })

    it("covers all three island groups when the traveller did", () => {
        const groups = getIslandGroupsFromRegions([
            "NCR - National Capital Region",
            "Region VII - Central Visayas",
            "Region XI - Davao Region",
        ])

        expect(groups.size).toBe(ISLAND_GROUPS.length)
    })
})
