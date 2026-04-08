import { describe, it, expect } from "bun:test"
import { getInitials, getAvatarColor } from "@/utils/avatar"

describe("getInitials", () => {
    it("returns first letter for single-word names", () => {
        expect(getInitials("Adrian")).toBe("A")
    })

    it("returns first letters of first and last word", () => {
        expect(getInitials("Adrian Bonpin")).toBe("AB")
    })

    it("returns first letters of first and last word for three+ words", () => {
        expect(getInitials("Mary Jane Watson")).toBe("MW")
    })

    it("returns '?' for empty string", () => {
        expect(getInitials("")).toBe("?")
    })

    it("handles single character", () => {
        expect(getInitials("A")).toBe("A")
    })

    it("trims whitespace", () => {
        expect(getInitials("  Adrian   Bonpin  ")).toBe("AB")
    })
})

describe("getAvatarColor", () => {
    it("returns a valid HSL string", () => {
        const color = getAvatarColor("Adrian Bonpin")
        expect(color).toMatch(/^hsl\(\d+,\s*\d+%,\s*\d+%\)$/)
    })

    it("returns consistent color for same input", () => {
        const color1 = getAvatarColor("Adrian Bonpin")
        const color2 = getAvatarColor("Adrian Bonpin")
        expect(color1).toBe(color2)
    })

    it("returns different colors for different inputs", () => {
        const color1 = getAvatarColor("Adrian")
        const color2 = getAvatarColor("Bonpin")
        expect(color1).not.toBe(color2)
    })

    it("handles empty string", () => {
        const color = getAvatarColor("")
        expect(color).toMatch(/^hsl\(\d+,\s*\d+%,\s*\d+%\)$/)
    })
})
