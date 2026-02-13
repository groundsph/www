import { describe, it, expect } from "bun:test"
import { getStampFallback } from "@/utils/passport/stamp"

describe("stamp helper", () => {
    it("uses custom url when present", () => {
        expect(getStampFallback("Cafe", "https://x")).toBe("https://x")
    })

    it("returns null when no custom url", () => {
        expect(getStampFallback("Cafe", null)).toBeNull()
    })

    it("returns null when custom url is empty string", () => {
        expect(getStampFallback("Cafe", "")).toBeNull()
    })
})
