import { describe, it, expect } from "bun:test"

import {
    BADGE_NAMES,
    getGeographicBadgesForGroups,
    ISLAND_GROUP_THRESHOLDS,
} from "@/utils/badges/badge-catalog"
import type { IslandGroup } from "@/utils/badges/island-groups"

describe("getGeographicBadgesForGroups", () => {
    it("awards nothing for a single island group", () => {
        expect(getGeographicBadgesForGroups(["visayas"] satisfies IslandGroup[])).toEqual([])
        expect(getGeographicBadgesForGroups([])).toEqual([])
    })

    it("awards Island Hopper for two island groups", () => {
        expect(
            getGeographicBadgesForGroups(["visayas", "mindanao"] satisfies IslandGroup[]),
        ).toEqual([BADGE_NAMES.ISLAND_HOPPER])
    })

    it("awards both geographic badges for all three island groups", () => {
        expect(
            getGeographicBadgesForGroups([
                "luzon",
                "visayas",
                "mindanao",
            ] satisfies IslandGroup[]),
        ).toEqual([BADGE_NAMES.ISLAND_HOPPER, BADGE_NAMES.KAPE_NG_PAMBANSA])
    })

    it("ignores duplicate island groups", () => {
        expect(
            getGeographicBadgesForGroups([
                "visayas",
                "visayas",
                "visayas",
            ] satisfies IslandGroup[]),
        ).toEqual([])
    })

    it("uses two and three as the unlock thresholds", () => {
        expect(ISLAND_GROUP_THRESHOLDS.map((t) => t.groups)).toEqual([2, 3])
    })
})
