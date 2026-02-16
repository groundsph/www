import { describe, it, expect } from "bun:test"
import { normalizeRegions, canAccessRegion } from "@/utils/moderation/region-access"

describe("region access helpers", () => {
    it("normalizes and dedupes region list", () => {
        expect(normalizeRegions([" Region I ", "Region I", ""]) ).toEqual(["Region I"])
    })

    it("allows all when no regions set", () => {
        expect(canAccessRegion([], "Region II")).toBe(true)
        expect(canAccessRegion(null, "Region II")).toBe(true)
    })

    it("restricts when regions set", () => {
        expect(canAccessRegion(["Region I"], "Region I")).toBe(true)
        expect(canAccessRegion(["Region I"], "Region II")).toBe(false)
    })
})
