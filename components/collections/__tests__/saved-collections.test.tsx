import { describe, it, expect } from "bun:test"
import SavedCollectionsList from "@/components/collections/SavedCollectionsList"
import type { CollectionListItem } from "@/app/api/actions/collection"

describe("SavedCollectionsList", () => {
    it("exports a component", () => {
        expect(typeof SavedCollectionsList).toBe("function")
    })

    it("renders empty state", () => {
        const element = SavedCollectionsList({ collections: [] })
        expect(element).toBeDefined()
    })

    it("renders with collections", () => {
        const collections: CollectionListItem[] = [
            {
                id: "1",
                title: "Collection 1",
                slug: "collection-1",
                description: "Test description",
                coverImage: null,
                itemCount: 3,
                viewsCount: 100,
                likesCount: 10,
                savesCount: 5,
                isPublic: true,
                createdAt: "2024-01-01T00:00:00Z",
            },
        ]
        const element = SavedCollectionsList({ collections })
        expect(element).toBeDefined()
    })

    it("has correct displayName", () => {
        expect(SavedCollectionsList.name).toBe("SavedCollectionsList")
    })
})
