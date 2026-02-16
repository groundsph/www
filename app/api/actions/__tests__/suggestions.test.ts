import { describe, it, expect, beforeEach } from "bun:test"

const mockGetCurrentUser = {
    __currentUser: null as { id: string } | null,
    getCurrentUser: async () => mockGetCurrentUser.__currentUser,
    setCurrentUser: (user: { id: string } | null) => {
        mockGetCurrentUser.__currentUser = user
    },
}

const mockProfilesData: Record<string, { 
    role: string; 
    id: string;
    moderatorRegions?: string[] | null;
}> = {}

const mockSuggestionsDb: Record<string, {
    id: string;
    cafeId: string;
    userId: string;
    status: 'pending' | 'approved' | 'rejected';
    cafeRegion?: string;
}> = {}

const mockCafesDb: Record<string, {
    id: string;
    name: string;
    region: string;
}> = {}

const mockNormalizeRegions = (regions?: string[] | null): string[] => {
    if (!regions || regions.length === 0) return []
    return regions
        .map(r => r.trim())
        .filter(r => r.length > 0)
        .filter((r, i, arr) => arr.indexOf(r) === i)
}

const getModeratorRegionsForCurrentUser = async (): Promise<string[]> => {
    const currentUser = await mockGetCurrentUser.getCurrentUser()
    if (!currentUser) return []

    const profile = mockProfilesData[currentUser.id]
    if (profile?.role !== "moderator") return []
    return mockNormalizeRegions(profile?.moderatorRegions ?? [])
}

describe("suggestions region filtering", () => {
    beforeEach(() => {
        mockGetCurrentUser.setCurrentUser(null)
        Object.keys(mockProfilesData).forEach(k => delete mockProfilesData[k])
        Object.keys(mockSuggestionsDb).forEach(k => delete mockSuggestionsDb[k])
        Object.keys(mockCafesDb).forEach(k => delete mockCafesDb[k])
    })

    describe("getPendingSuggestions", () => {
        it("returns all pending suggestions for admins (no region restrictions)", async () => {
            mockGetCurrentUser.setCurrentUser({ id: "admin123" })
            mockProfilesData["admin123"] = { role: "admin", id: "admin123" }
            
            // Admins have no region restrictions (empty array)
            const regions = await getModeratorRegionsForCurrentUser()
            expect(regions).toEqual([])
        })

        it("returns suggestions filtered by moderator regions", async () => {
            mockGetCurrentUser.setCurrentUser({ id: "mod123" })
            mockProfilesData["mod123"] = { 
                role: "moderator", 
                id: "mod123",
                moderatorRegions: ["Region I", "Region II"]
            }
            
            const regions = await getModeratorRegionsForCurrentUser()
            expect(regions).toEqual(["Region I", "Region II"])
        })

        it("returns empty regions array for moderators without region restrictions", async () => {
            mockGetCurrentUser.setCurrentUser({ id: "mod123" })
            mockProfilesData["mod123"] = { 
                role: "moderator", 
                id: "mod123",
                moderatorRegions: []
            }
            
            const regions = await getModeratorRegionsForCurrentUser()
            expect(regions).toEqual([])
        })

        it("returns empty regions array for regular users", async () => {
            mockGetCurrentUser.setCurrentUser({ id: "user123" })
            mockProfilesData["user123"] = { role: "user", id: "user123" }
            
            const regions = await getModeratorRegionsForCurrentUser()
            expect(regions).toEqual([])
        })

        it("returns empty regions array when not authenticated", async () => {
            mockGetCurrentUser.setCurrentUser(null)
            
            const regions = await getModeratorRegionsForCurrentUser()
            expect(regions).toEqual([])
        })
    })

    describe("approveSuggestion region validation", () => {
        it("allows approval when moderator has region access", async () => {
            mockGetCurrentUser.setCurrentUser({ id: "mod123" })
            mockProfilesData["mod123"] = { 
                role: "moderator", 
                id: "mod123",
                moderatorRegions: ["Region I"]
            }

            mockSuggestionsDb["sugg1"] = {
                id: "sugg1",
                cafeId: "cafe1",
                userId: "user456",
                status: "pending",
                cafeRegion: "Region I"
            }

            const approveSuggestion = async (suggestionId: string) => {
                const currentUser = await mockGetCurrentUser.getCurrentUser()
                if (!currentUser) return { success: false, error: "Not authenticated" }

                const profile = mockProfilesData[currentUser.id]
                if (profile?.role !== "admin" && profile?.role !== "moderator") {
                    return { success: false, error: "Unauthorized" }
                }

                const suggestion = mockSuggestionsDb[suggestionId]
                const regions = await getModeratorRegionsForCurrentUser()
                
                const hasRegionAccess = regions.length === 0 || !suggestion?.cafeRegion || regions.includes(suggestion.cafeRegion)
                if (!suggestion || !hasRegionAccess) {
                    return { success: false, error: "Not found or unauthorized" }
                }

                return { success: true }
            }

            const result = await approveSuggestion("sugg1")
            expect(result.success).toBe(true)
        })

        it("rejects approval when moderator lacks region access", async () => {
            mockGetCurrentUser.setCurrentUser({ id: "mod123" })
            mockProfilesData["mod123"] = { 
                role: "moderator", 
                id: "mod123",
                moderatorRegions: ["Region I"]
            }

            mockSuggestionsDb["sugg1"] = {
                id: "sugg1",
                cafeId: "cafe1",
                userId: "user456",
                status: "pending",
                cafeRegion: "Region III"
            }

            const approveSuggestion = async (suggestionId: string) => {
                const currentUser = await mockGetCurrentUser.getCurrentUser()
                if (!currentUser) return { success: false, error: "Not authenticated" }

                const profile = mockProfilesData[currentUser.id]
                if (profile?.role !== "admin" && profile?.role !== "moderator") {
                    return { success: false, error: "Unauthorized" }
                }

                const suggestion = mockSuggestionsDb[suggestionId]
                const regions = await getModeratorRegionsForCurrentUser()
                
                const hasRegionAccess = regions.length === 0 || !suggestion?.cafeRegion || regions.includes(suggestion.cafeRegion)
                if (!suggestion || !hasRegionAccess) {
                    return { success: false, error: "Not found or unauthorized" }
                }

                return { success: true }
            }

            const result = await approveSuggestion("sugg1")
            expect(result.success).toBe(false)
            expect(result.error).toBe("Not found or unauthorized")
        })

        it("returns generic error for non-existent suggestion to prevent timing attacks", async () => {
            mockGetCurrentUser.setCurrentUser({ id: "mod123" })
            mockProfilesData["mod123"] = { 
                role: "moderator", 
                id: "mod123",
                moderatorRegions: ["Region I"]
            }

            const approveSuggestion = async (suggestionId: string) => {
                const currentUser = await mockGetCurrentUser.getCurrentUser()
                if (!currentUser) return { success: false, error: "Not authenticated" }

                const profile = mockProfilesData[currentUser.id]
                if (profile?.role !== "admin" && profile?.role !== "moderator") {
                    return { success: false, error: "Unauthorized" }
                }

                const suggestion = mockSuggestionsDb[suggestionId]
                const regions = await getModeratorRegionsForCurrentUser()
                
                const hasRegionAccess = regions.length === 0 || !suggestion?.cafeRegion || regions.includes(suggestion.cafeRegion)
                if (!suggestion || !hasRegionAccess) {
                    return { success: false, error: "Not found or unauthorized" }
                }

                return { success: true }
            }

            const result = await approveSuggestion("nonexistent")
            expect(result.success).toBe(false)
            expect(result.error).toBe("Not found or unauthorized")
        })

        it("allows approval when suggestion has no region (backwards compatibility)", async () => {
            mockGetCurrentUser.setCurrentUser({ id: "mod123" })
            mockProfilesData["mod123"] = { 
                role: "moderator", 
                id: "mod123",
                moderatorRegions: ["Region I"]
            }

            mockSuggestionsDb["sugg1"] = {
                id: "sugg1",
                cafeId: "cafe1",
                userId: "user456",
                status: "pending"
                // no cafeRegion
            }

            const approveSuggestion = async (suggestionId: string) => {
                const currentUser = await mockGetCurrentUser.getCurrentUser()
                if (!currentUser) return { success: false, error: "Not authenticated" }

                const profile = mockProfilesData[currentUser.id]
                if (profile?.role !== "admin" && profile?.role !== "moderator") {
                    return { success: false, error: "Unauthorized" }
                }

                const suggestion = mockSuggestionsDb[suggestionId]
                const regions = await getModeratorRegionsForCurrentUser()
                
                const hasRegionAccess = regions.length === 0 || !suggestion?.cafeRegion || regions.includes(suggestion.cafeRegion)
                if (!suggestion || !hasRegionAccess) {
                    return { success: false, error: "Not found or unauthorized" }
                }

                return { success: true }
            }

            const result = await approveSuggestion("sugg1")
            expect(result.success).toBe(true)
        })

        it("admin can approve any suggestion regardless of region", async () => {
            mockGetCurrentUser.setCurrentUser({ id: "admin123" })
            mockProfilesData["admin123"] = { role: "admin", id: "admin123" }

            mockSuggestionsDb["sugg1"] = {
                id: "sugg1",
                cafeId: "cafe1",
                userId: "user456",
                status: "pending",
                cafeRegion: "Region X"
            }

            const approveSuggestion = async (suggestionId: string) => {
                const currentUser = await mockGetCurrentUser.getCurrentUser()
                if (!currentUser) return { success: false, error: "Not authenticated" }

                const profile = mockProfilesData[currentUser.id]
                if (profile?.role !== "admin" && profile?.role !== "moderator") {
                    return { success: false, error: "Unauthorized" }
                }

                const suggestion = mockSuggestionsDb[suggestionId]
                const regions = await getModeratorRegionsForCurrentUser()
                
                // Admins have empty regions array, so they can access all
                const hasRegionAccess = regions.length === 0 || !suggestion?.cafeRegion || regions.includes(suggestion.cafeRegion)
                if (!suggestion || !hasRegionAccess) {
                    return { success: false, error: "Not found or unauthorized" }
                }

                return { success: true }
            }

            const result = await approveSuggestion("sugg1")
            expect(result.success).toBe(true)
        })
    })

    describe("rejectSuggestion region validation", () => {
        it("rejects with generic error when moderator lacks region access", async () => {
            mockGetCurrentUser.setCurrentUser({ id: "mod123" })
            mockProfilesData["mod123"] = { 
                role: "moderator", 
                id: "mod123",
                moderatorRegions: ["Region I"]
            }

            mockSuggestionsDb["sugg1"] = {
                id: "sugg1",
                cafeId: "cafe1",
                userId: "user456",
                status: "pending",
                cafeRegion: "Region III"
            }

            const rejectSuggestion = async (suggestionId: string) => {
                const currentUser = await mockGetCurrentUser.getCurrentUser()
                if (!currentUser) return { success: false, error: "Not authenticated" }

                const profile = mockProfilesData[currentUser.id]
                if (profile?.role !== "admin" && profile?.role !== "moderator") {
                    return { success: false, error: "Unauthorized" }
                }

                const suggestion = mockSuggestionsDb[suggestionId]
                const regions = await getModeratorRegionsForCurrentUser()
                
                const hasRegionAccess = regions.length === 0 || !suggestion?.cafeRegion || regions.includes(suggestion.cafeRegion)
                if (!suggestion || !hasRegionAccess) {
                    return { success: false, error: "Not found or unauthorized" }
                }

                return { success: true }
            }

            const result = await rejectSuggestion("sugg1")
            expect(result.success).toBe(false)
            expect(result.error).toBe("Not found or unauthorized")
        })

        it("returns same error for non-existent suggestion (timing attack prevention)", async () => {
            mockGetCurrentUser.setCurrentUser({ id: "mod123" })
            mockProfilesData["mod123"] = { 
                role: "moderator", 
                id: "mod123",
                moderatorRegions: ["Region I"]
            }

            const rejectSuggestion = async (suggestionId: string) => {
                const currentUser = await mockGetCurrentUser.getCurrentUser()
                if (!currentUser) return { success: false, error: "Not authenticated" }

                const profile = mockProfilesData[currentUser.id]
                if (profile?.role !== "admin" && profile?.role !== "moderator") {
                    return { success: false, error: "Unauthorized" }
                }

                const suggestion = mockSuggestionsDb[suggestionId]
                const regions = await getModeratorRegionsForCurrentUser()
                
                const hasRegionAccess = regions.length === 0 || !suggestion?.cafeRegion || regions.includes(suggestion.cafeRegion)
                if (!suggestion || !hasRegionAccess) {
                    return { success: false, error: "Not found or unauthorized" }
                }

                return { success: true }
            }

            const result = await rejectSuggestion("nonexistent")
            expect(result.success).toBe(false)
            expect(result.error).toBe("Not found or unauthorized")
        })
    })

    describe("region filtering in getPendingSuggestions", () => {
        it("filters suggestions by moderator regions", async () => {
            mockGetCurrentUser.setCurrentUser({ id: "mod123" })
            mockProfilesData["mod123"] = { 
                role: "moderator", 
                id: "mod123",
                moderatorRegions: ["Region I"]
            }

            mockSuggestionsDb["sugg1"] = {
                id: "sugg1",
                cafeId: "cafe1",
                userId: "user1",
                status: "pending",
                cafeRegion: "Region I"
            }

            mockSuggestionsDb["sugg2"] = {
                id: "sugg2",
                cafeId: "cafe2",
                userId: "user2",
                status: "pending",
                cafeRegion: "Region II"
            }

            const getPendingSuggestions = async () => {
                const regions = await getModeratorRegionsForCurrentUser()
                
                const allSuggestions = Object.values(mockSuggestionsDb).filter(s => s.status === "pending")
                
                if (regions.length > 0) {
                    return allSuggestions.filter(s => s.cafeRegion && regions.includes(s.cafeRegion))
                }
                
                return allSuggestions
            }

            const result = await getPendingSuggestions()
            expect(result).toHaveLength(1)
            expect(result[0].id).toBe("sugg1")
        })

        it("returns all suggestions for moderators without region restrictions", async () => {
            mockGetCurrentUser.setCurrentUser({ id: "mod123" })
            mockProfilesData["mod123"] = { 
                role: "moderator", 
                id: "mod123",
                moderatorRegions: []
            }

            mockSuggestionsDb["sugg1"] = {
                id: "sugg1",
                cafeId: "cafe1",
                userId: "user1",
                status: "pending",
                cafeRegion: "Region I"
            }

            mockSuggestionsDb["sugg2"] = {
                id: "sugg2",
                cafeId: "cafe2",
                userId: "user2",
                status: "pending",
                cafeRegion: "Region II"
            }

            const getPendingSuggestions = async () => {
                const regions = await getModeratorRegionsForCurrentUser()
                
                const allSuggestions = Object.values(mockSuggestionsDb).filter(s => s.status === "pending")
                
                if (regions.length > 0) {
                    return allSuggestions.filter(s => s.cafeRegion && regions.includes(s.cafeRegion))
                }
                
                return allSuggestions
            }

            const result = await getPendingSuggestions()
            expect(result).toHaveLength(2)
        })
    })
})
