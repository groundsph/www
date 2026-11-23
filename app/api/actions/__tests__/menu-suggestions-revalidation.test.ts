import { describe, it, expect, beforeEach, mock } from "bun:test"

// The single-item approval path is exercised for its revalidation only: its
// queue rows and status behaviour are frozen and covered elsewhere. Expected
// paths are written literally.

let mockSelectResults: unknown[][] = []
let mockCafeLookupResult: { slug: string | null } | null = { slug: "kape-lolo" }
const mockRevalidatedPaths: string[] = []

mock.module("@/lib/auth", () => ({
    getCurrentUser: () => Promise.resolve({ id: "admin-1", role: "admin" }),
}))

mock.module("next/cache", () => ({
    revalidatePath: (path: string) => {
        mockRevalidatedPaths.push(path)
    },
}))

function whereResult(rows: unknown[]) {
    return Object.assign(Promise.resolve(rows), {
        orderBy: () => ({ limit: () => Promise.resolve(rows) }),
    })
}

mock.module("@/db", () => ({
    db: {
        select: () => ({
            from: () => ({
                where: () => whereResult(mockSelectResults.shift() ?? []),
            }),
        }),
        insert: () => ({ values: () => Promise.resolve(undefined) }),
        update: () => ({
            set: () => ({ where: () => Promise.resolve(undefined) }),
        }),
        query: {
            cafes: {
                findFirst: () => Promise.resolve(mockCafeLookupResult),
            },
        },
    },
}))

const { approveMenuItemSuggestion } = await import("@/app/api/actions/menu-suggestions")

describe("approveMenuItemSuggestion revalidation", () => {
    beforeEach(() => {
        mockCafeLookupResult = { slug: "kape-lolo" }
        mockSelectResults = [
            [
                {
                    id: "suggestion-1",
                    cafeId: "cafe-1",
                    userId: "user-1",
                    type: "add",
                    targetItemId: null,
                    status: "pending",
                    suggestedData: { name: "Americano", category: "Drinks", price: 120 },
                },
            ],
            [{ price: 120 }],
        ]
        mockRevalidatedPaths.length = 0
    })

    it("revalidates the cafe page, the cafe menu page and the cafe list", async () => {
        const result = await approveMenuItemSuggestion("suggestion-1")

        expect(result).toEqual({ success: true })
        expect(mockRevalidatedPaths).toEqual([
            "/cafes/kape-lolo",
            "/cafes/kape-lolo/menu",
            "/cafes",
        ])
    })
})
