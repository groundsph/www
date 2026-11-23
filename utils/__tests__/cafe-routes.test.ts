import { describe, it, expect, beforeEach, mock } from "bun:test"

// The cafe lookup is faked at the module boundary, as the existing action tests
// do. Every expected path below is written out literally rather than derived
// from the helper, so the test cannot agree with a wrong-shaped route.

let mockCafeLookupResult: { slug: string | null } | null = null
let mockCafeLookupError: Error | null = null
let mockCafeLookupCalls = 0

const mockRevalidatedPaths: string[] = []

mock.module("@/db", () => ({
    db: {
        query: {
            cafes: {
                findFirst: () => {
                    mockCafeLookupCalls += 1
                    if (mockCafeLookupError) return Promise.reject(mockCafeLookupError)
                    return Promise.resolve(mockCafeLookupResult)
                },
            },
        },
    },
}))

mock.module("next/cache", () => ({
    revalidatePath: (path: string) => {
        mockRevalidatedPaths.push(path)
    },
}))

const { getCafeRevalidationPaths, revalidateCafePages, revalidateCafeIndex } =
    await import("@/utils/cafe-routes")

describe("getCafeRevalidationPaths", () => {
    beforeEach(() => {
        mockCafeLookupResult = null
        mockCafeLookupError = null
        mockCafeLookupCalls = 0
        mockRevalidatedPaths.length = 0
    })

    it("turns a stored cafe id into the cafe page path and the cafe menu path", async () => {
        mockCafeLookupResult = { slug: "kape-lolo" }

        const paths = await getCafeRevalidationPaths("cafe-1")

        expect(paths).toEqual(["/cafes/kape-lolo", "/cafes/kape-lolo/menu"])
        expect(paths).toHaveLength(2)
    })

    it("never produces a /cafe/<id> shaped path", async () => {
        mockCafeLookupResult = { slug: "kape-lolo" }

        const paths = await getCafeRevalidationPaths("cafe-1")

        expect(paths.filter((path) => path.startsWith("/cafe/"))).toEqual([])
    })

    it("uses a supplied slug without looking the cafe up again", async () => {
        const paths = await getCafeRevalidationPaths("cafe-1", "brown-brew")

        expect(paths).toEqual(["/cafes/brown-brew", "/cafes/brown-brew/menu"])
        expect(mockCafeLookupCalls).toBe(0)
    })

    it("returns nothing to revalidate when no cafe matches the id", async () => {
        mockCafeLookupResult = null

        const paths = await getCafeRevalidationPaths("00000000-0000-0000-0000-000000000000")

        expect(paths).toEqual([])
    })

    it("returns nothing to revalidate when the cafe has no slug", async () => {
        mockCafeLookupResult = { slug: null }

        const paths = await getCafeRevalidationPaths("cafe-1")

        expect(paths).toEqual([])
    })

    it("raises no error when the lookup itself fails", async () => {
        mockCafeLookupError = new Error("connection refused")

        await expect(getCafeRevalidationPaths("cafe-1")).resolves.toEqual([])
    })
})

describe("revalidateCafeIndex", () => {
    beforeEach(() => {
        mockRevalidatedPaths.length = 0
    })

    it("revalidates the cafe index and nothing else", () => {
        revalidateCafeIndex()

        expect(mockRevalidatedPaths).toEqual(["/cafes"])
    })
})

describe("revalidateCafePages", () => {
    beforeEach(() => {
        mockCafeLookupResult = null
        mockCafeLookupError = null
        mockCafeLookupCalls = 0
        mockRevalidatedPaths.length = 0
    })

    it("revalidates exactly the cafe page and the cafe menu page", async () => {
        mockCafeLookupResult = { slug: "kape-lolo" }

        await revalidateCafePages("cafe-1")

        expect(mockRevalidatedPaths).toEqual(["/cafes/kape-lolo", "/cafes/kape-lolo/menu"])
    })

    it("revalidates nothing for an unknown cafe and does not throw", async () => {
        mockCafeLookupResult = null

        await expect(revalidateCafePages("missing-cafe")).resolves.toBeUndefined()
        expect(mockRevalidatedPaths).toEqual([])
    })
})
