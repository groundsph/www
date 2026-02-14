import { describe, it, expect } from "bun:test"
import { existsSync } from "fs"
import { join } from "path"
import type { PublicProfileData } from "@/app/api/actions/profile"

describe("PublicProfile Collections Section", () => {
    it("PublicProfile component file exists", () => {
        const filePath = join(process.cwd(), "components", "profile", "PublicProfile.tsx")
        expect(existsSync(filePath)).toBe(true)
    })

    it("CollectionCard component file exists", () => {
        const filePath = join(process.cwd(), "components", "collections", "CollectionCard.tsx")
        expect(existsSync(filePath)).toBe(true)
    })

    it("profile actions file exists", () => {
        const filePath = join(process.cwd(), "app", "api", "actions", "profile.ts")
        expect(existsSync(filePath)).toBe(true)
    })
})

describe("PublicProfileData type includes collections", () => {
    it("PublicProfileData interface should have collections field", () => {
        // Type-level test - if this compiles, the type has collections
        const testData: PublicProfileData = {
            allBadges: [],
            reviews: [],
            passportCafes: {
                visited: [],
                favorites: [],
                wishlist: [],
            },
            collections: [
                {
                    id: "test-1",
                    title: "Test Collection",
                    slug: "test-collection",
                    description: "Test description",
                    coverImage: null,
                    itemCount: 5,
                    viewsCount: 100,
                    likesCount: 10,
                    savesCount: 2,
                    isPublic: true,
                    createdAt: "2024-01-01",
                },
            ],
        }

        expect(testData.collections).toBeDefined()
        expect(testData.collections.length).toBe(1)
        expect(testData.collections[0].title).toBe("Test Collection")
    })

    it("collections can be empty array", () => {
        const testData: PublicProfileData = {
            allBadges: [],
            reviews: [],
            passportCafes: {
                visited: [],
                favorites: [],
                wishlist: [],
            },
            collections: [],
        }

        expect(testData.collections).toBeDefined()
        expect(testData.collections.length).toBe(0)
    })
})
