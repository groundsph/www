import { describe, it, expect } from "bun:test"
import { validateFile, STORAGE_BUCKETS } from "@/utils/storage"

describe("badge stamps", () => {
    it("rejects non-png", () => {
        const file = new File(["fake"], "stamp.jpg", { type: "image/jpeg" })
        const result = validateFile(file, STORAGE_BUCKETS.BADGES)
        expect(result.valid).toBe(false)
    })
})
