import { describe, it, expect } from "bun:test"
import { isBadgeStampFileValid } from "@/utils/validation/badge-stamp"

describe("badge stamp validation", () => {
    it("rejects non-png", () => {
        const file = new File([""], "x.jpg", { type: "image/jpeg" })
        expect(isBadgeStampFileValid(file).valid).toBe(false)
    })

    it("accepts png files", () => {
        const file = new File([""], "x.png", { type: "image/png" })
        expect(isBadgeStampFileValid(file).valid).toBe(true)
    })

    it("rejects files over 500KB", () => {
        const largeFile = new File(["x".repeat(600 * 1024)], "large.png", { type: "image/png" })
        expect(isBadgeStampFileValid(largeFile).valid).toBe(false)
    })

    it("accepts files under 500KB", () => {
        const smallFile = new File(["x".repeat(100 * 1024)], "small.png", { type: "image/png" })
        expect(isBadgeStampFileValid(smallFile).valid).toBe(true)
    })

    it("returns error message for non-png", () => {
        const file = new File([""], "x.jpg", { type: "image/jpeg" })
        expect(isBadgeStampFileValid(file).error).toBe("Only PNG files are allowed")
    })

    it("returns error message for oversized file", () => {
        const largeFile = new File(["x".repeat(600 * 1024)], "large.png", { type: "image/png" })
        expect(isBadgeStampFileValid(largeFile).error).toBe("File size must be less than 500KB")
    })
})
