import { describe, it, expect } from "bun:test"
import { cafeCrawls, cafeCrawlItems, cafeCrawlSaves } from "@/db/schema"

describe("cafe crawls schema", () => {
    it("includes core tables", () => {
        expect(cafeCrawls).toHaveProperty("title")
        expect(cafeCrawlItems).toHaveProperty("sortOrder")
        expect(cafeCrawlSaves).toHaveProperty("userId")
    })
})
