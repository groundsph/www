import { describe, expect, it } from "bun:test"
import { parseCrawlTimePreferences } from "@/utils/ai/parse-crawl-time"

describe("parseCrawlTimePreferences", () => {
    it("extracts day and time", () => {
        const result = parseCrawlTimePreferences("Build a crawl on Saturday at 9:30am")
        expect(result.day).toBe("sat")
        expect(result.time).toBe("09:30")
    })

    it("defaults to Saturday 9am when no day/time specified", () => {
        const result = parseCrawlTimePreferences("Build a crawl")
        expect(result.day).toBe("sat")
        expect(result.time).toBe("09:00")
    })

    it("handles PM times", () => {
        const result = parseCrawlTimePreferences("Crawl on Friday at 2pm")
        expect(result.day).toBe("fri")
        expect(result.time).toBe("14:00")
    })

    it("handles noon and midnight", () => {
        expect(parseCrawlTimePreferences("at 12pm").time).toBe("12:00")
        expect(parseCrawlTimePreferences("at 12am").time).toBe("00:00")
    })
})
