import { describe, it, expect } from "bun:test"
import { selectStampImage } from "@/utils/passport/stamp"

describe("selectStampImage", () => {
    it("uses custom stamp url if provided", () => {
        const result = selectStampImage("Cafe", "https://custom.png")
        expect(result).toBe("https://custom.png")
    })

    it("returns null when no custom url", () => {
        expect(selectStampImage("Cafe", null)).toBeNull()
    })

    it("returns null when custom url is empty string", () => {
        expect(selectStampImage("Cafe", "")).toBeNull()
    })
})
