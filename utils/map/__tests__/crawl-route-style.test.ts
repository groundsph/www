import { describe, it, expect } from "bun:test"
import { getCrawlSegmentStyle } from "@/utils/map/crawl-route-style"

describe("crawl route style", () => {
    it("groups pairs with same color", () => {
        const first = getCrawlSegmentStyle(0)
        const second = getCrawlSegmentStyle(1)
        const third = getCrawlSegmentStyle(2)
        expect(first.color).toBe(second.color)
        expect(first.color).not.toBe(third.color)
    })
})
