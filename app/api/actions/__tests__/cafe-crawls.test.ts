import { describe, it, expect } from "bun:test"

describe("cafe crawls actions", () => {
    it("exports createCafeCrawl function", async () => {
        const { createCafeCrawl } = await import("@/app/api/actions/cafe-crawls")
        expect(typeof createCafeCrawl).toBe("function")
    })

    it("exports getPublicCafeCrawls function", async () => {
        const { getPublicCafeCrawls } = await import("@/app/api/actions/cafe-crawls")
        expect(typeof getPublicCafeCrawls).toBe("function")
    })

    it("exports getCafeCrawlBySlug function", async () => {
        const { getCafeCrawlBySlug } = await import("@/app/api/actions/cafe-crawls")
        expect(typeof getCafeCrawlBySlug).toBe("function")
    })

    it("exports updateCafeCrawl function", async () => {
        const { updateCafeCrawl } = await import("@/app/api/actions/cafe-crawls")
        expect(typeof updateCafeCrawl).toBe("function")
    })

    it("exports reorderCafeCrawl function", async () => {
        const { reorderCafeCrawl } = await import("@/app/api/actions/cafe-crawls")
        expect(typeof reorderCafeCrawl).toBe("function")
    })

    it("exports toggleSaveCafeCrawl function", async () => {
        const { toggleSaveCafeCrawl } = await import("@/app/api/actions/cafe-crawls")
        expect(typeof toggleSaveCafeCrawl).toBe("function")
    })

    it("exports reportCafeCrawl function", async () => {
        const { reportCafeCrawl } = await import("@/app/api/actions/cafe-crawls")
        expect(typeof reportCafeCrawl).toBe("function")
    })

    it("exports getSavedCafeCrawls function", async () => {
        const { getSavedCafeCrawls } = await import("@/app/api/actions/cafe-crawls")
        expect(typeof getSavedCafeCrawls).toBe("function")
    })

    it("exports getUserCafeCrawls function", async () => {
        const { getUserCafeCrawls } = await import("@/app/api/actions/cafe-crawls")
        expect(typeof getUserCafeCrawls).toBe("function")
    })

    it("exports deleteCafeCrawl function", async () => {
        const { deleteCafeCrawl } = await import("@/app/api/actions/cafe-crawls")
        expect(typeof deleteCafeCrawl).toBe("function")
    })
})
