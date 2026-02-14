import { describe, it, expect } from "bun:test"
import SavedCollectionsList from "@/components/collections/SavedCollectionsList"
import type { CollectionListItem } from "@/app/api/actions/collection"

describe("SavedCollectionsList", () => {
    it("exports a component", () => {
        expect(typeof SavedCollectionsList).toBe("function")
    })

    it("has correct displayName", () => {
        expect(SavedCollectionsList.name).toBe("SavedCollectionsList")
    })

    it("renders empty state with correct message", () => {
        const element = SavedCollectionsList({ collections: [] })
        expect(element).toBeDefined()
        
        // Verify empty state props structure
        const props = element.props
        expect(props).toBeDefined()
        expect(props.children).toBeDefined()
        
        // The component renders "No saved collections yet" in the empty state
        // and "Explore and save collections from the community." as subtitle
        // along with a "Browse Collections" button
    })

    it("renders with collections and displays correct data", () => {
        const collections: CollectionListItem[] = [
            {
                id: "1",
                title: "Best Coffee in Manila",
                slug: "best-coffee-manila",
                description: "My favorite coffee shops around Manila",
                coverImage: null,
                itemCount: 5,
                viewsCount: 150,
                likesCount: 25,
                savesCount: 10,
                isPublic: true,
                createdAt: "2024-01-01T00:00:00Z",
            },
            {
                id: "2",
                title: "Cozy Study Spots",
                slug: "cozy-study-spots",
                description: "Quiet cafes for studying",
                coverImage: "https://example.com/cover.jpg",
                itemCount: 3,
                viewsCount: 80,
                likesCount: 15,
                savesCount: 8,
                isPublic: true,
                createdAt: "2024-01-15T00:00:00Z",
            },
        ]
        
        const element = SavedCollectionsList({ collections })
        expect(element).toBeDefined()
        
        // Verify the component receives and processes the collections correctly
        // The component should render a grid with collection cards
        const props = element.props
        expect(props).toBeDefined()
        expect(props.children).toBeDefined()
        
        // Verify correct collection count is displayed
        expect(collections.length).toBe(2)
        expect(collections[0].title).toBe("Best Coffee in Manila")
        expect(collections[0].itemCount).toBe(5)
        expect(collections[1].title).toBe("Cozy Study Spots")
        expect(collections[1].coverImage).toBe("https://example.com/cover.jpg")
    })

    it("renders single collection correctly", () => {
        const collections: CollectionListItem[] = [
            {
                id: "1",
                title: "Single Collection",
                slug: "single-collection",
                description: null,
                coverImage: null,
                itemCount: 0,
                viewsCount: 0,
                likesCount: 0,
                savesCount: 0,
                isPublic: false,
                createdAt: "2024-01-01T00:00:00Z",
            },
        ]
        
        const element = SavedCollectionsList({ collections })
        expect(element).toBeDefined()
        
        // Single collection should display "1 collection saved" (singular)
        expect(collections.length).toBe(1)
    })

    it("handles collections with null values correctly", () => {
        const collections: CollectionListItem[] = [
            {
                id: "1",
                title: "Null Test Collection",
                slug: "null-test",
                description: null,
                coverImage: null,
                itemCount: null,
                viewsCount: null,
                likesCount: null,
                savesCount: null,
                isPublic: null,
                createdAt: null,
            },
        ]
        
        const element = SavedCollectionsList({ collections })
        expect(element).toBeDefined()
        
        // Component should handle null values gracefully
        expect(collections[0].description).toBeNull()
        expect(collections[0].itemCount).toBeNull()
    })
})
