import { describe, it, expect, mock } from "bun:test"

// Minimal chainable, thenable stub: db.select().from().where(),
// db.select().from().innerJoin().where() and .where().limit() all resolve to []
interface EmptyChain {
    from: () => EmptyChain
    where: () => EmptyChain
    innerJoin: () => EmptyChain
    limit: () => EmptyChain
    orderBy: () => EmptyChain
    then: (resolve: (value: unknown[]) => unknown) => unknown
}

const emptyResults: unknown[] = []

const emptyChain = {} as EmptyChain
emptyChain.from = () => emptyChain
emptyChain.where = () => emptyChain
emptyChain.innerJoin = () => emptyChain
emptyChain.limit = () => emptyChain
emptyChain.orderBy = () => emptyChain
emptyChain.then = (resolve) => resolve(emptyResults)

mock.module("@/db", () => ({
    db: {
        select: () => emptyChain,
    },
}))

import sitemap from "@/app/sitemap"

describe("sitemap", () => {
    it("registers the for-owners page", async () => {
        const entries = await sitemap()
        const forOwners = entries.find((entry) =>
            entry.url.endsWith("/for-owners")
        )
        expect(forOwners).toBeDefined()
        expect(forOwners?.changeFrequency).toBe("monthly")
        expect(forOwners?.priority).toBe(0.6)
    })

    it("keeps the existing static pages alongside it", async () => {
        const entries = await sitemap()
        const urls = entries.map((entry) => entry.url)
        expect(urls.some((url) => url.endsWith("/cafes"))).toBe(true)
        expect(urls.some((url) => url.endsWith("/roadmap"))).toBe(true)
    })
})
