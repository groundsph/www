import { describe, it, expect } from "bun:test"
import { formatCafeStrawType } from "@/utils/formatters"

describe("formatCafeStrawType", () => {
    it("prefers other when selected", () => {
        expect(formatCafeStrawType("other", "banana leaf"))
            .toBe("banana leaf")
    })
})
