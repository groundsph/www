import { describe, it, expect } from "bun:test"
import { formatCafeStrawType } from "@/utils/formatters"

describe("formatCafeStrawType", () => {
    it("prefers other when selected", () => {
        expect(formatCafeStrawType("other", "banana leaf"))
            .toBe("banana leaf")
    })
    
    it("returns null for empty type", () => {
        expect(formatCafeStrawType(null, null)).toBeNull()
        expect(formatCafeStrawType("", null)).toBeNull()
    })
    
    it("formats straw type with spaces", () => {
        expect(formatCafeStrawType("metal", null)).toBe("metal")
        expect(formatCafeStrawType("paper_straws", null)).toBe("paper straws")
    })
})
