import { describe, expect, it, beforeEach } from "bun:test"

// Mock data stores
const mockDb = {
    menuItemSuggestions: [] as Array<{
        id: string
        cafeId: string
        userId: string
        type: "add" | "edit" | "remove"
        targetItemId: string | null
        suggestedData: Record<string, unknown>
        status: "pending" | "approved" | "rejected"
        adminNotes?: string | null
        reviewedBy?: string | null
        reviewedAt?: Date | null
        createdAt: Date
        updatedAt: Date
    }>,
    cafeMenuItems: [] as Array<{
        id: string
        cafeId: string
        name: string
        description: string | null
        category: string
        price: number
        imageUrl: string | null
        isAvailable: boolean
        isSignature: boolean
        isFood: boolean
        isHot: boolean
        isCold: boolean
        calories: number | null
        isVegan: boolean
        isVegetarian: boolean
        sizeOptions: Array<{ label: string; price: number }> | null
        lastUpdatedBy: string | null
        communitySubmitted: boolean
        createdAt: Date
        updatedAt: Date
    }>,
}

const mockGetCurrentUser = {
    __currentUser: null as { id: string; role: string } | null,
    getCurrentUser: async () => mockGetCurrentUser.__currentUser,
    setCurrentUser: (user: { id: string; role: string } | null) => {
        mockGetCurrentUser.__currentUser = user
    },
}

// Mock implementation of submitMenuItemSuggestion
async function submitMenuItemSuggestion(
    cafeId: string,
    type: "add" | "edit" | "remove",
    data: {
        name?: string
        description?: string
        category?: string
        price?: number
        imageUrl?: string
        [key: string]: unknown
    },
    targetItemId?: string
) {
    const user = await mockGetCurrentUser.getCurrentUser()
    if (!user) return { error: "Authentication required" }

    if (type === "add") {
        if (!data.name?.trim() || !data.category || data.price === undefined) {
            return { error: "Name, category, and price are required" }
        }
        // Strip imageUrl from community submissions
        const { imageUrl, ...safeData } = data
        data = safeData
    }

    if ((type === "edit" || type === "remove") && !targetItemId) {
        return { error: "Target item ID is required for edit/remove suggestions" }
    }

    const suggestion = {
        id: `sugg-${Date.now()}`,
        cafeId,
        userId: user.id,
        type,
        targetItemId: targetItemId || null,
        suggestedData: data,
        status: "pending" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
    }

    mockDb.menuItemSuggestions.push(suggestion)

    return { success: true, suggestionId: suggestion.id }
}

// Mock implementation of getMenuItemSuggestionsForCafe
async function getMenuItemSuggestionsForCafe(cafeId: string) {
    const user = await mockGetCurrentUser.getCurrentUser()
    if (!user) return []

    return mockDb.menuItemSuggestions
        .filter((s) => s.cafeId === cafeId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}

// Mock implementation of getPendingMenuItemSuggestions
async function getPendingMenuItemSuggestions() {
    const user = await mockGetCurrentUser.getCurrentUser()
    if (!user || (user.role !== "admin" && user.role !== "moderator")) {
        return []
    }

    return mockDb.menuItemSuggestions
        .filter((s) => s.status === "pending")
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}

// Mock implementation of approveMenuItemSuggestion
async function approveMenuItemSuggestion(suggestionId: string) {
    const user = await mockGetCurrentUser.getCurrentUser()
    if (!user || (user.role !== "admin" && user.role !== "moderator")) {
        return { error: "Unauthorized" }
    }

    const suggestion = mockDb.menuItemSuggestions.find((s) => s.id === suggestionId)
    if (!suggestion) return { error: "Suggestion not found" }
    if (suggestion.status !== "pending") return { error: "Already processed" }

    const data = suggestion.suggestedData as {
        name: string
        description?: string
        category: string
        price: number
        is_food?: boolean
        is_hot?: boolean
        is_cold?: boolean
        calories?: number | null
        is_vegan?: boolean
        is_vegetarian?: boolean
        size_options?: Array<{ label: string; price: number }> | null
    }

    if (suggestion.type === "add") {
        mockDb.cafeMenuItems.push({
            id: `item-${Date.now()}`,
            cafeId: suggestion.cafeId,
            name: data.name,
            description: data.description || null,
            category: data.category,
            price: data.price,
            imageUrl: null,
            isAvailable: true,
            isSignature: false,
            isFood: data.is_food || false,
            isHot: data.is_hot || false,
            isCold: data.is_cold || false,
            calories: data.calories || null,
            isVegan: data.is_vegan || false,
            isVegetarian: data.is_vegetarian || false,
            sizeOptions: data.size_options || null,
            communitySubmitted: true,
            lastUpdatedBy: suggestion.userId,
            createdAt: new Date(),
            updatedAt: new Date(),
        })
    } else if (suggestion.type === "edit" && suggestion.targetItemId) {
        const item = mockDb.cafeMenuItems.find((i) => i.id === suggestion.targetItemId)
        if (item) {
            item.name = data.name
            item.description = data.description || null
            item.category = data.category
            item.price = data.price
            item.isFood = data.is_food ?? item.isFood
            item.isHot = data.is_hot ?? item.isHot
            item.isCold = data.is_cold ?? item.isCold
            item.calories = data.calories ?? item.calories
            item.isVegan = data.is_vegan ?? item.isVegan
            item.isVegetarian = data.is_vegetarian ?? item.isVegetarian
            item.sizeOptions = data.size_options ?? item.sizeOptions
            item.lastUpdatedBy = suggestion.userId
            item.updatedAt = new Date()
        }
    } else if (suggestion.type === "remove" && suggestion.targetItemId) {
        const item = mockDb.cafeMenuItems.find((i) => i.id === suggestion.targetItemId)
        if (item) {
            item.isAvailable = false
            item.lastUpdatedBy = suggestion.userId
            item.updatedAt = new Date()
        }
    }

    suggestion.status = "approved"
    suggestion.reviewedBy = user.id
    suggestion.reviewedAt = new Date()

    return { success: true }
}

// Mock implementation of rejectMenuItemSuggestion
async function rejectMenuItemSuggestion(suggestionId: string, adminNotes?: string) {
    const user = await mockGetCurrentUser.getCurrentUser()
    if (!user || (user.role !== "admin" && user.role !== "moderator")) {
        return { error: "Unauthorized" }
    }

    const suggestion = mockDb.menuItemSuggestions.find((s) => s.id === suggestionId)
    if (!suggestion) return { error: "Suggestion not found" }

    suggestion.status = "rejected"
    suggestion.adminNotes = adminNotes || null
    suggestion.reviewedBy = user.id
    suggestion.reviewedAt = new Date()

    return { success: true }
}

describe("submitMenuItemSuggestion", () => {
    beforeEach(() => {
        mockGetCurrentUser.setCurrentUser(null)
        mockDb.menuItemSuggestions = []
        mockDb.cafeMenuItems = []
    })

    it("rejects unauthenticated users", async () => {
        mockGetCurrentUser.setCurrentUser(null)

        const result = await submitMenuItemSuggestion("cafe-1", "add", {
            name: "Espresso",
            category: "Coffee",
            price: 120,
        })

        expect(result).toEqual({ error: "Authentication required" })
    })

    it("validates required fields for 'add' type", async () => {
        mockGetCurrentUser.setCurrentUser({ id: "user-1", role: "user" })

        // Missing name
        const result1 = await submitMenuItemSuggestion("cafe-1", "add", {
            category: "Coffee",
            price: 120,
        })
        expect(result1).toEqual({ error: "Name, category, and price are required" })

        // Missing category
        const result2 = await submitMenuItemSuggestion("cafe-1", "add", {
            name: "Espresso",
            price: 120,
        })
        expect(result2).toEqual({ error: "Name, category, and price are required" })

        // Missing price
        const result3 = await submitMenuItemSuggestion("cafe-1", "add", {
            name: "Espresso",
            category: "Coffee",
        })
        expect(result3).toEqual({ error: "Name, category, and price are required" })

        // Empty name
        const result4 = await submitMenuItemSuggestion("cafe-1", "add", {
            name: "   ",
            category: "Coffee",
            price: 120,
        })
        expect(result4).toEqual({ error: "Name, category, and price are required" })
    })

    it("prevents community users from setting imageUrl", async () => {
        mockGetCurrentUser.setCurrentUser({ id: "user-1", role: "user" })

        const result = await submitMenuItemSuggestion("cafe-1", "add", {
            name: "Espresso",
            category: "Coffee",
            price: 120,
            imageUrl: "https://example.com/image.jpg",
        })

        expect(result.success).toBe(true)

        const suggestion = mockDb.menuItemSuggestions.find((s) => s.id === result.suggestionId)
        expect(suggestion).toBeDefined()
        expect(suggestion!.suggestedData.imageUrl).toBeUndefined()
    })

    it("creates pending suggestion for valid 'add' submission", async () => {
        mockGetCurrentUser.setCurrentUser({ id: "user-1", role: "user" })

        const result = await submitMenuItemSuggestion("cafe-1", "add", {
            name: "Espresso",
            description: "Strong coffee",
            category: "Coffee",
            price: 120,
            is_food: false,
            is_hot: true,
            is_cold: false,
        })

        expect(result.success).toBe(true)
        expect(result.suggestionId).toBeDefined()

        const suggestion = mockDb.menuItemSuggestions.find((s) => s.id === result.suggestionId)
        expect(suggestion).toBeDefined()
        expect(suggestion!.cafeId).toBe("cafe-1")
        expect(suggestion!.userId).toBe("user-1")
        expect(suggestion!.type).toBe("add")
        expect(suggestion!.status).toBe("pending")
        expect(suggestion!.suggestedData.name).toBe("Espresso")
        expect(suggestion!.suggestedData.price).toBe(120)
    })

    it("validates targetItemId for 'edit' type", async () => {
        mockGetCurrentUser.setCurrentUser({ id: "user-1", role: "user" })

        const result = await submitMenuItemSuggestion(
            "cafe-1",
            "edit",
            { name: "Updated Name", category: "Coffee", price: 150 },
            undefined
        )

        expect(result).toEqual({ error: "Target item ID is required for edit/remove suggestions" })
    })

    it("validates targetItemId for 'remove' type", async () => {
        mockGetCurrentUser.setCurrentUser({ id: "user-1", role: "user" })

        const result = await submitMenuItemSuggestion(
            "cafe-1",
            "remove",
            {},
            undefined
        )

        expect(result).toEqual({ error: "Target item ID is required for edit/remove suggestions" })
    })

    it("allows edit submission with targetItemId", async () => {
        mockGetCurrentUser.setCurrentUser({ id: "user-1", role: "user" })

        const result = await submitMenuItemSuggestion(
            "cafe-1",
            "edit",
            { name: "Updated Name", category: "Coffee", price: 150 },
            "item-1"
        )

        expect(result.success).toBe(true)

        const suggestion = mockDb.menuItemSuggestions.find((s) => s.id === result.suggestionId)
        expect(suggestion).toBeDefined()
        expect(suggestion!.type).toBe("edit")
        expect(suggestion!.targetItemId).toBe("item-1")
    })

    it("allows remove submission with targetItemId", async () => {
        mockGetCurrentUser.setCurrentUser({ id: "user-1", role: "user" })

        const result = await submitMenuItemSuggestion(
            "cafe-1",
            "remove",
            {},
            "item-1"
        )

        expect(result.success).toBe(true)

        const suggestion = mockDb.menuItemSuggestions.find((s) => s.id === result.suggestionId)
        expect(suggestion).toBeDefined()
        expect(suggestion!.type).toBe("remove")
        expect(suggestion!.targetItemId).toBe("item-1")
    })
})

describe("getMenuItemSuggestionsForCafe", () => {
    beforeEach(() => {
        mockGetCurrentUser.setCurrentUser(null)
        mockDb.menuItemSuggestions = []
    })

    it("returns empty array for unauthenticated users", async () => {
        mockGetCurrentUser.setCurrentUser(null)

        const result = await getMenuItemSuggestionsForCafe("cafe-1")

        expect(result).toEqual([])
    })

    it("returns suggestions for the specified cafe", async () => {
        mockGetCurrentUser.setCurrentUser({ id: "user-1", role: "user" })

        mockDb.menuItemSuggestions.push(
            {
                id: "sugg-1",
                cafeId: "cafe-1",
                userId: "user-1",
                type: "add",
                targetItemId: null,
                suggestedData: { name: "Item 1", category: "Coffee", price: 100 },
                status: "pending",
                createdAt: new Date("2024-01-01"),
                updatedAt: new Date("2024-01-01"),
            },
            {
                id: "sugg-2",
                cafeId: "cafe-2",
                userId: "user-1",
                type: "add",
                targetItemId: null,
                suggestedData: { name: "Item 2", category: "Tea", price: 80 },
                status: "pending",
                createdAt: new Date("2024-01-02"),
                updatedAt: new Date("2024-01-02"),
            },
            {
                id: "sugg-3",
                cafeId: "cafe-1",
                userId: "user-2",
                type: "edit",
                targetItemId: "item-1",
                suggestedData: { name: "Updated Item", category: "Coffee", price: 120 },
                status: "pending",
                createdAt: new Date("2024-01-03"),
                updatedAt: new Date("2024-01-03"),
            }
        )

        const result = await getMenuItemSuggestionsForCafe("cafe-1")

        expect(result).toHaveLength(2)
        expect(result.map((s) => s.id)).toContain("sugg-1")
        expect(result.map((s) => s.id)).toContain("sugg-3")
        expect(result.map((s) => s.id)).not.toContain("sugg-2")
    })
})

describe("getPendingMenuItemSuggestions", () => {
    beforeEach(() => {
        mockGetCurrentUser.setCurrentUser(null)
        mockDb.menuItemSuggestions = []
    })

    it("returns empty array for unauthenticated users", async () => {
        mockGetCurrentUser.setCurrentUser(null)

        const result = await getPendingMenuItemSuggestions()

        expect(result).toEqual([])
    })

    it("returns empty array for regular users", async () => {
        mockGetCurrentUser.setCurrentUser({ id: "user-1", role: "user" })

        const result = await getPendingMenuItemSuggestions()

        expect(result).toEqual([])
    })

    it("returns pending suggestions for admins", async () => {
        mockGetCurrentUser.setCurrentUser({ id: "admin-1", role: "admin" })

        mockDb.menuItemSuggestions.push(
            {
                id: "sugg-1",
                cafeId: "cafe-1",
                userId: "user-1",
                type: "add",
                targetItemId: null,
                suggestedData: { name: "Item 1", category: "Coffee", price: 100 },
                status: "pending",
                createdAt: new Date("2024-01-01"),
                updatedAt: new Date("2024-01-01"),
            },
            {
                id: "sugg-2",
                cafeId: "cafe-2",
                userId: "user-2",
                type: "add",
                targetItemId: null,
                suggestedData: { name: "Item 2", category: "Tea", price: 80 },
                status: "approved",
                createdAt: new Date("2024-01-02"),
                updatedAt: new Date("2024-01-02"),
            }
        )

        const result = await getPendingMenuItemSuggestions()

        expect(result).toHaveLength(1)
        expect(result[0].id).toBe("sugg-1")
    })

    it("returns pending suggestions for moderators", async () => {
        mockGetCurrentUser.setCurrentUser({ id: "mod-1", role: "moderator" })

        mockDb.menuItemSuggestions.push(
            {
                id: "sugg-1",
                cafeId: "cafe-1",
                userId: "user-1",
                type: "add",
                targetItemId: null,
                suggestedData: { name: "Item 1", category: "Coffee", price: 100 },
                status: "pending",
                createdAt: new Date("2024-01-01"),
                updatedAt: new Date("2024-01-01"),
            },
            {
                id: "sugg-2",
                cafeId: "cafe-2",
                userId: "user-2",
                type: "add",
                targetItemId: null,
                suggestedData: { name: "Item 2", category: "Tea", price: 80 },
                status: "pending",
                createdAt: new Date("2024-01-02"),
                updatedAt: new Date("2024-01-02"),
            }
        )

        const result = await getPendingMenuItemSuggestions()

        expect(result).toHaveLength(2)
    })
})

describe("approveMenuItemSuggestion", () => {
    beforeEach(() => {
        mockGetCurrentUser.setCurrentUser(null)
        mockDb.menuItemSuggestions = []
        mockDb.cafeMenuItems = []
    })

    it("rejects unauthenticated users", async () => {
        mockGetCurrentUser.setCurrentUser(null)

        const result = await approveMenuItemSuggestion("sugg-1")

        expect(result).toEqual({ error: "Unauthorized" })
    })

    it("rejects regular users", async () => {
        mockGetCurrentUser.setCurrentUser({ id: "user-1", role: "user" })

        const result = await approveMenuItemSuggestion("sugg-1")

        expect(result).toEqual({ error: "Unauthorized" })
    })

    it("returns error for non-existent suggestion", async () => {
        mockGetCurrentUser.setCurrentUser({ id: "admin-1", role: "admin" })

        const result = await approveMenuItemSuggestion("non-existent")

        expect(result).toEqual({ error: "Suggestion not found" })
    })

    it("returns error for already processed suggestion", async () => {
        mockGetCurrentUser.setCurrentUser({ id: "admin-1", role: "admin" })

        mockDb.menuItemSuggestions.push({
            id: "sugg-1",
            cafeId: "cafe-1",
            userId: "user-1",
            type: "add",
            targetItemId: null,
            suggestedData: { name: "Item 1", category: "Coffee", price: 100 },
            status: "approved",
            createdAt: new Date(),
            updatedAt: new Date(),
        })

        const result = await approveMenuItemSuggestion("sugg-1")

        expect(result).toEqual({ error: "Already processed" })
    })

    it("creates menu item for 'add' type suggestion", async () => {
        mockGetCurrentUser.setCurrentUser({ id: "admin-1", role: "admin" })

        mockDb.menuItemSuggestions.push({
            id: "sugg-1",
            cafeId: "cafe-1",
            userId: "user-1",
            type: "add",
            targetItemId: null,
            suggestedData: {
                name: "Espresso",
                description: "Strong coffee shot",
                category: "Coffee",
                price: 120,
                is_food: false,
                is_hot: true,
                is_cold: false,
                calories: null,
                is_vegan: true,
                is_vegetarian: true,
                size_options: [{ label: "Single", price: 120 }],
            },
            status: "pending",
            createdAt: new Date(),
            updatedAt: new Date(),
        })

        const result = await approveMenuItemSuggestion("sugg-1")

        expect(result).toEqual({ success: true })

        const suggestion = mockDb.menuItemSuggestions.find((s) => s.id === "sugg-1")
        expect(suggestion!.status).toBe("approved")
        expect(suggestion!.reviewedBy).toBe("admin-1")
        expect(suggestion!.reviewedAt).toBeDefined()

        expect(mockDb.cafeMenuItems).toHaveLength(1)
        const item = mockDb.cafeMenuItems[0]
        expect(item.name).toBe("Espresso")
        expect(item.category).toBe("Coffee")
        expect(item.price).toBe(120)
        expect(item.communitySubmitted).toBe(true)
        expect(item.lastUpdatedBy).toBe("user-1")
    })

    it("updates menu item for 'edit' type suggestion", async () => {
        mockGetCurrentUser.setCurrentUser({ id: "admin-1", role: "admin" })

        mockDb.cafeMenuItems.push({
            id: "item-1",
            cafeId: "cafe-1",
            name: "Old Name",
            description: "Old description",
            category: "Old Category",
            price: 100,
            imageUrl: null,
            isAvailable: true,
            isSignature: false,
            isFood: false,
            isHot: false,
            isCold: false,
            calories: null,
            isVegan: false,
            isVegetarian: false,
            sizeOptions: null,
            lastUpdatedBy: null,
            communitySubmitted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        })

        mockDb.menuItemSuggestions.push({
            id: "sugg-1",
            cafeId: "cafe-1",
            userId: "user-1",
            type: "edit",
            targetItemId: "item-1",
            suggestedData: {
                name: "New Name",
                description: "New description",
                category: "New Category",
                price: 150,
                is_food: true,
                is_hot: true,
                is_cold: false,
            },
            status: "pending",
            createdAt: new Date(),
            updatedAt: new Date(),
        })

        const result = await approveMenuItemSuggestion("sugg-1")

        expect(result).toEqual({ success: true })

        const item = mockDb.cafeMenuItems.find((i) => i.id === "item-1")
        expect(item!.name).toBe("New Name")
        expect(item!.description).toBe("New description")
        expect(item!.category).toBe("New Category")
        expect(item!.price).toBe(150)
        expect(item!.isFood).toBe(true)
        expect(item!.isHot).toBe(true)
        expect(item!.lastUpdatedBy).toBe("user-1")
    })

    it("marks menu item as unavailable for 'remove' type suggestion", async () => {
        mockGetCurrentUser.setCurrentUser({ id: "admin-1", role: "admin" })

        mockDb.cafeMenuItems.push({
            id: "item-1",
            cafeId: "cafe-1",
            name: "Item to Remove",
            description: null,
            category: "Coffee",
            price: 100,
            imageUrl: null,
            isAvailable: true,
            isSignature: false,
            isFood: false,
            isHot: false,
            isCold: false,
            calories: null,
            isVegan: false,
            isVegetarian: false,
            sizeOptions: null,
            lastUpdatedBy: null,
            communitySubmitted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        })

        mockDb.menuItemSuggestions.push({
            id: "sugg-1",
            cafeId: "cafe-1",
            userId: "user-1",
            type: "remove",
            targetItemId: "item-1",
            suggestedData: {},
            status: "pending",
            createdAt: new Date(),
            updatedAt: new Date(),
        })

        const result = await approveMenuItemSuggestion("sugg-1")

        expect(result).toEqual({ success: true })

        const item = mockDb.cafeMenuItems.find((i) => i.id === "item-1")
        expect(item!.isAvailable).toBe(false)
        expect(item!.lastUpdatedBy).toBe("user-1")
    })

    it("allows moderators to approve suggestions", async () => {
        mockGetCurrentUser.setCurrentUser({ id: "mod-1", role: "moderator" })

        mockDb.menuItemSuggestions.push({
            id: "sugg-1",
            cafeId: "cafe-1",
            userId: "user-1",
            type: "add",
            targetItemId: null,
            suggestedData: { name: "Item 1", category: "Coffee", price: 100 },
            status: "pending",
            createdAt: new Date(),
            updatedAt: new Date(),
        })

        const result = await approveMenuItemSuggestion("sugg-1")

        expect(result).toEqual({ success: true })
    })
})

describe("rejectMenuItemSuggestion", () => {
    beforeEach(() => {
        mockGetCurrentUser.setCurrentUser(null)
        mockDb.menuItemSuggestions = []
    })

    it("rejects unauthenticated users", async () => {
        mockGetCurrentUser.setCurrentUser(null)

        const result = await rejectMenuItemSuggestion("sugg-1")

        expect(result).toEqual({ error: "Unauthorized" })
    })

    it("rejects regular users", async () => {
        mockGetCurrentUser.setCurrentUser({ id: "user-1", role: "user" })

        const result = await rejectMenuItemSuggestion("sugg-1")

        expect(result).toEqual({ error: "Unauthorized" })
    })

    it("rejects suggestion with optional admin notes", async () => {
        mockGetCurrentUser.setCurrentUser({ id: "admin-1", role: "admin" })

        mockDb.menuItemSuggestions.push({
            id: "sugg-1",
            cafeId: "cafe-1",
            userId: "user-1",
            type: "add",
            targetItemId: null,
            suggestedData: { name: "Item 1", category: "Coffee", price: 100 },
            status: "pending",
            createdAt: new Date(),
            updatedAt: new Date(),
        })

        const result = await rejectMenuItemSuggestion("sugg-1", "Price is incorrect")

        expect(result).toEqual({ success: true })

        const suggestion = mockDb.menuItemSuggestions.find((s) => s.id === "sugg-1")
        expect(suggestion!.status).toBe("rejected")
        expect(suggestion!.adminNotes).toBe("Price is incorrect")
        expect(suggestion!.reviewedBy).toBe("admin-1")
        expect(suggestion!.reviewedAt).toBeDefined()
    })

    it("rejects suggestion without admin notes", async () => {
        mockGetCurrentUser.setCurrentUser({ id: "admin-1", role: "admin" })

        mockDb.menuItemSuggestions.push({
            id: "sugg-1",
            cafeId: "cafe-1",
            userId: "user-1",
            type: "add",
            targetItemId: null,
            suggestedData: { name: "Item 1", category: "Coffee", price: 100 },
            status: "pending",
            createdAt: new Date(),
            updatedAt: new Date(),
        })

        const result = await rejectMenuItemSuggestion("sugg-1")

        expect(result).toEqual({ success: true })

        const suggestion = mockDb.menuItemSuggestions.find((s) => s.id === "sugg-1")
        expect(suggestion!.status).toBe("rejected")
        expect(suggestion!.adminNotes).toBeNull()
    })

    it("allows moderators to reject suggestions", async () => {
        mockGetCurrentUser.setCurrentUser({ id: "mod-1", role: "moderator" })

        mockDb.menuItemSuggestions.push({
            id: "sugg-1",
            cafeId: "cafe-1",
            userId: "user-1",
            type: "add",
            targetItemId: null,
            suggestedData: { name: "Item 1", category: "Coffee", price: 100 },
            status: "pending",
            createdAt: new Date(),
            updatedAt: new Date(),
        })

        const result = await rejectMenuItemSuggestion("sugg-1")

        expect(result).toEqual({ success: true })
    })
})
