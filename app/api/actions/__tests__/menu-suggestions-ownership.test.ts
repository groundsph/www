import { describe, it, expect, beforeEach, mock } from "bun:test"

let mockUser: { id: string; role?: string } | null = { id: "user-1" }
let mockOwnerIds: string[] = ["user-1"]
const mockSuggestions = [
    { id: "s1", cafeId: "cafe-1", type: "add", status: "pending" },
]

mock.module("next/headers", () => ({
    headers: () => Promise.resolve({ get: () => null }),
}))

mock.module("next/cache", () => ({
    revalidatePath: () => {},
}))

mock.module("@/lib/auth", () => ({
    getCurrentUser: () => Promise.resolve(mockUser),
}))

mock.module("@/db", () => ({
    db: {
        select: () => ({
            from: () => ({
                where: () => ({
                    limit: () => Promise.resolve([{ ownerIds: mockOwnerIds }]),
                    orderBy: () => Promise.resolve(mockSuggestions),
                }),
            }),
        }),
    },
    eq: () => ({}),
    and: () => ({}),
    count: () => ({}),
}))

const { getMenuItemSuggestionsForCafe } = await import(
    "@/app/api/actions/menu-suggestions"
)

describe("getMenuItemSuggestionsForCafe — ownership gate", () => {
    beforeEach(() => {
        mockUser = { id: "user-1" }
        mockOwnerIds = ["user-1"]
    })

    it("returns suggestions to the cafe owner", async () => {
        const result = await getMenuItemSuggestionsForCafe("cafe-1")
        expect(result.length).toBe(1)
    })

    it("returns an empty list to an authenticated non-owner", async () => {
        mockOwnerIds = ["someone-else"]
        const result = await getMenuItemSuggestionsForCafe("cafe-1")
        expect(result.length).toBe(0)
    })

    it("returns an empty list when the cafe has no owners", async () => {
        mockOwnerIds = []
        const result = await getMenuItemSuggestionsForCafe("cafe-1")
        expect(result.length).toBe(0)
    })

    it("returns an empty list to an unauthenticated caller", async () => {
        mockUser = null
        const result = await getMenuItemSuggestionsForCafe("cafe-1")
        expect(result.length).toBe(0)
    })
})
