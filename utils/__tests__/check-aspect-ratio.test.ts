import { describe, it, expect } from "bun:test"
import { checkAspectRatio } from "@/utils/hooks/cafe-form"

describe("checkAspectRatio", () => {
    it("should be a function", () => {
        expect(typeof checkAspectRatio).toBe("function")
    })

    it("should return a promise", () => {
        const mockFile = new File([""], "test.jpg", { type: "image/jpeg" })
        const result = checkAspectRatio(mockFile)
        expect(result).toBeInstanceOf(Promise)
    })
})
