import { describe, it, expect } from "bun:test"
import { mergeCafeTags } from "@/utils/blog/merge-cafe-tags"

describe("mergeCafeTags", () => {
    it("dedupes and preserves order", () => {
        const result = mergeCafeTags(["1", "2"], ["2", "3"])
        expect(result).toEqual(["1", "2", "3"])
    })
})
