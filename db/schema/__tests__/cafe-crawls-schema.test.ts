import { describe, it, expect } from "bun:test"
import { cafeCrawls, cafeCrawlItems, cafeCrawlSaves, cafeCrawlLikes } from "@/db/schema"

describe("cafe crawls schema", () => {
    it("includes core tables", () => {
        expect(cafeCrawls).toHaveProperty("title")
        expect(cafeCrawlItems).toHaveProperty("sortOrder")
        expect(cafeCrawlSaves).toHaveProperty("userId")
    })

    it("includes likes table", () => {
        expect(cafeCrawlLikes).toHaveProperty("crawlId")
        expect(cafeCrawlLikes).toHaveProperty("userId")
    })

    it("includes likesCount column", () => {
        expect(cafeCrawls).toHaveProperty("likesCount")
    })
})
