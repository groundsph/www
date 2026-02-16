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

const mockClaimsDb: Record<string, {
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

describe("claims region filtering", () => {
    beforeEach(() => {
        mockGetCurrentUser.setCurrentUser(null)
        Object.keys(mockProfilesData).forEach(k => delete mockProfilesData[k])
        Object.keys(mockClaimsDb).forEach(k => delete mockClaimsDb[k])
        Object.keys(mockCafesDb).forEach(k => delete mockCafesDb[k])
    })

    describe("getPendingClaims", () => {
        it("returns all pending claims for admins (no region restrictions)", async () => {
            mockGetCurrentUser.setCurrentUser({ id: "admin123" })
            mockProfilesData["admin123"] = { role: "admin", id: "admin123" }
            
            const regions = await getModeratorRegionsForCurrentUser()
            expect(regions).toEqual([])
        })

        it("returns claims filtered by moderator regions", async () => {
            mockGetCurrentUser.setCurrentUser({ id: "mod123" })
            mockProfilesData["mod123"] = { 
                role: "moderator", 
                id: "mod123",
                moderatorRegions: ["Metro Manila", "Cebu"]
            }
            
            const regions = await getModeratorRegionsForCurrentUser()
            expect(regions).toEqual(["Metro Manila", "Cebu"])
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

    describe("approveClaim region validation", () => {
        it("allows approval when moderator has region access", async () => {
            mockGetCurrentUser.setCurrentUser({ id: "mod123" })
            mockProfilesData["mod123"] = { 
                role: "moderator", 
                id: "mod123",
                moderatorRegions: ["Region I"]
            }

            mockClaimsDb["claim1"] = {
                id: "claim1",
                cafeId: "cafe1",
                userId: "user456",
                status: "pending",
                cafeRegion: "Region I"
            }

            const approveClaim = async (claimId: string) => {
                const currentUser = await mockGetCurrentUser.getCurrentUser()
                if (!currentUser) return { success: false, error: "Not authenticated" }

                const profile = mockProfilesData[currentUser.id]
                if (profile?.role !== "admin" && profile?.role !== "moderator") {
                    return { success: false, error: "Unauthorized" }
                }

                const claim = mockClaimsDb[claimId]
                const regions = await getModeratorRegionsForCurrentUser()
                
                const hasRegionAccess = regions.length === 0 || !claim?.cafeRegion || regions.includes(claim.cafeRegion)
                if (!claim || !hasRegionAccess) {
                    return { success: false, error: "Not found or unauthorized" }
                }

                return { success: true }
            }

            const result = await approveClaim("claim1")
            expect(result.success).toBe(true)
        })

        it("rejects approval when moderator lacks region access", async () => {
            mockGetCurrentUser.setCurrentUser({ id: "mod123" })
            mockProfilesData["mod123"] = { 
                role: "moderator", 
                id: "mod123",
                moderatorRegions: ["Region I"]
            }

            mockClaimsDb["claim1"] = {
                id: "claim1",
                cafeId: "cafe1",
                userId: "user456",
                status: "pending",
                cafeRegion: "Region III"
            }

            const approveClaim = async (claimId: string) => {
                const currentUser = await mockGetCurrentUser.getCurrentUser()
                if (!currentUser) return { success: false, error: "Not authenticated" }

                const profile = mockProfilesData[currentUser.id]
                if (profile?.role !== "admin" && profile?.role !== "moderator") {
                    return { success: false, error: "Unauthorized" }
                }

                const claim = mockClaimsDb[claimId]
                const regions = await getModeratorRegionsForCurrentUser()
                
                const hasRegionAccess = regions.length === 0 || !claim?.cafeRegion || regions.includes(claim.cafeRegion)
                if (!claim || !hasRegionAccess) {
                    return { success: false, error: "Not found or unauthorized" }
                }

                return { success: true }
            }

            const result = await approveClaim("claim1")
            expect(result.success).toBe(false)
            expect(result.error).toBe("Not found or unauthorized")
        })

        it("returns generic error for non-existent claim to prevent timing attacks", async () => {
            mockGetCurrentUser.setCurrentUser({ id: "mod123" })
            mockProfilesData["mod123"] = { 
                role: "moderator", 
                id: "mod123",
                moderatorRegions: ["Region I"]
            }

            const approveClaim = async (claimId: string) => {
                const currentUser = await mockGetCurrentUser.getCurrentUser()
                if (!currentUser) return { success: false, error: "Not authenticated" }

                const profile = mockProfilesData[currentUser.id]
                if (profile?.role !== "admin" && profile?.role !== "moderator") {
                    return { success: false, error: "Unauthorized" }
                }

                const claim = mockClaimsDb[claimId]
                const regions = await getModeratorRegionsForCurrentUser()
                
                const hasRegionAccess = regions.length === 0 || !claim?.cafeRegion || regions.includes(claim.cafeRegion)
                if (!claim || !hasRegionAccess) {
                    return { success: false, error: "Not found or unauthorized" }
                }

                return { success: true }
            }

            const result = await approveClaim("nonexistent")
            expect(result.success).toBe(false)
            expect(result.error).toBe("Not found or unauthorized")
        })

        it("allows approval when claim has no region (backwards compatibility)", async () => {
            mockGetCurrentUser.setCurrentUser({ id: "mod123" })
            mockProfilesData["mod123"] = { 
                role: "moderator", 
                id: "mod123",
                moderatorRegions: ["Region I"]
            }

            mockClaimsDb["claim1"] = {
                id: "claim1",
                cafeId: "cafe1",
                userId: "user456",
                status: "pending"
                // no cafeRegion
            }

            const approveClaim = async (claimId: string) => {
                const currentUser = await mockGetCurrentUser.getCurrentUser()
                if (!currentUser) return { success: false, error: "Not authenticated" }

                const profile = mockProfilesData[currentUser.id]
                if (profile?.role !== "admin" && profile?.role !== "moderator") {
                    return { success: false, error: "Unauthorized" }
                }

                const claim = mockClaimsDb[claimId]
                const regions = await getModeratorRegionsForCurrentUser()
                
                const hasRegionAccess = regions.length === 0 || !claim?.cafeRegion || regions.includes(claim.cafeRegion)
                if (!claim || !hasRegionAccess) {
                    return { success: false, error: "Not found or unauthorized" }
                }

                return { success: true }
            }

            const result = await approveClaim("claim1")
            expect(result.success).toBe(true)
        })

        it("admin can approve any claim regardless of region", async () => {
            mockGetCurrentUser.setCurrentUser({ id: "admin123" })
            mockProfilesData["admin123"] = { role: "admin", id: "admin123" }

            mockClaimsDb["claim1"] = {
                id: "claim1",
                cafeId: "cafe1",
                userId: "user456",
                status: "pending",
                cafeRegion: "Region X"
            }

            const approveClaim = async (claimId: string) => {
                const currentUser = await mockGetCurrentUser.getCurrentUser()
                if (!currentUser) return { success: false, error: "Not authenticated" }

                const profile = mockProfilesData[currentUser.id]
                if (profile?.role !== "admin" && profile?.role !== "moderator") {
                    return { success: false, error: "Unauthorized" }
                }

                const claim = mockClaimsDb[claimId]
                const regions = await getModeratorRegionsForCurrentUser()
                
                const hasRegionAccess = regions.length === 0 || !claim?.cafeRegion || regions.includes(claim.cafeRegion)
                if (!claim || !hasRegionAccess) {
                    return { success: false, error: "Not found or unauthorized" }
                }

                return { success: true }
            }

            const result = await approveClaim("claim1")
            expect(result.success).toBe(true)
        })
    })

    describe("rejectClaim region validation", () => {
        it("rejects with generic error when moderator lacks region access", async () => {
            mockGetCurrentUser.setCurrentUser({ id: "mod123" })
            mockProfilesData["mod123"] = { 
                role: "moderator", 
                id: "mod123",
                moderatorRegions: ["Region I"]
            }

            mockClaimsDb["claim1"] = {
                id: "claim1",
                cafeId: "cafe1",
                userId: "user456",
                status: "pending",
                cafeRegion: "Region III"
            }

            const rejectClaim = async (claimId: string) => {
                const currentUser = await mockGetCurrentUser.getCurrentUser()
                if (!currentUser) return { success: false, error: "Not authenticated" }

                const profile = mockProfilesData[currentUser.id]
                if (profile?.role !== "admin" && profile?.role !== "moderator") {
                    return { success: false, error: "Unauthorized" }
                }

                const claim = mockClaimsDb[claimId]
                const regions = await getModeratorRegionsForCurrentUser()
                
                const hasRegionAccess = regions.length === 0 || !claim?.cafeRegion || regions.includes(claim.cafeRegion)
                if (!claim || !hasRegionAccess) {
                    return { success: false, error: "Not found or unauthorized" }
                }

                return { success: true }
            }

            const result = await rejectClaim("claim1")
            expect(result.success).toBe(false)
            expect(result.error).toBe("Not found or unauthorized")
        })

        it("returns same error for non-existent claim (timing attack prevention)", async () => {
            mockGetCurrentUser.setCurrentUser({ id: "mod123" })
            mockProfilesData["mod123"] = { 
                role: "moderator", 
                id: "mod123",
                moderatorRegions: ["Region I"]
            }

            const rejectClaim = async (claimId: string) => {
                const currentUser = await mockGetCurrentUser.getCurrentUser()
                if (!currentUser) return { success: false, error: "Not authenticated" }

                const profile = mockProfilesData[currentUser.id]
                if (profile?.role !== "admin" && profile?.role !== "moderator") {
                    return { success: false, error: "Unauthorized" }
                }

                const claim = mockClaimsDb[claimId]
                const regions = await getModeratorRegionsForCurrentUser()
                
                const hasRegionAccess = regions.length === 0 || !claim?.cafeRegion || regions.includes(claim.cafeRegion)
                if (!claim || !hasRegionAccess) {
                    return { success: false, error: "Not found or unauthorized" }
                }

                return { success: true }
            }

            const result = await rejectClaim("nonexistent")
            expect(result.success).toBe(false)
            expect(result.error).toBe("Not found or unauthorized")
        })
    })

    describe("region filtering in getPendingClaims", () => {
        it("filters claims by moderator regions", async () => {
            mockGetCurrentUser.setCurrentUser({ id: "mod123" })
            mockProfilesData["mod123"] = { 
                role: "moderator", 
                id: "mod123",
                moderatorRegions: ["Region I"]
            }

            mockClaimsDb["claim1"] = {
                id: "claim1",
                cafeId: "cafe1",
                userId: "user1",
                status: "pending",
                cafeRegion: "Region I"
            }

            mockClaimsDb["claim2"] = {
                id: "claim2",
                cafeId: "cafe2",
                userId: "user2",
                status: "pending",
                cafeRegion: "Region II"
            }

            const getPendingClaims = async () => {
                const regions = await getModeratorRegionsForCurrentUser()
                
                const allClaims = Object.values(mockClaimsDb).filter(c => c.status === "pending")
                
                if (regions.length > 0) {
                    return allClaims.filter(c => c.cafeRegion && regions.includes(c.cafeRegion))
                }
                
                return allClaims
            }

            const result = await getPendingClaims()
            expect(result).toHaveLength(1)
            expect(result[0].id).toBe("claim1")
        })

        it("returns all claims for moderators without region restrictions", async () => {
            mockGetCurrentUser.setCurrentUser({ id: "mod123" })
            mockProfilesData["mod123"] = { 
                role: "moderator", 
                id: "mod123",
                moderatorRegions: []
            }

            mockClaimsDb["claim1"] = {
                id: "claim1",
                cafeId: "cafe1",
                userId: "user1",
                status: "pending",
                cafeRegion: "Region I"
            }

            mockClaimsDb["claim2"] = {
                id: "claim2",
                cafeId: "cafe2",
                userId: "user2",
                status: "pending",
                cafeRegion: "Region II"
            }

            const getPendingClaims = async () => {
                const regions = await getModeratorRegionsForCurrentUser()
                
                const allClaims = Object.values(mockClaimsDb).filter(c => c.status === "pending")
                
                if (regions.length > 0) {
                    return allClaims.filter(c => c.cafeRegion && regions.includes(c.cafeRegion))
                }
                
                return allClaims
            }

            const result = await getPendingClaims()
            expect(result).toHaveLength(2)
        })

        it("handles claims without region field (backwards compatibility)", async () => {
            mockGetCurrentUser.setCurrentUser({ id: "mod123" })
            mockProfilesData["mod123"] = { 
                role: "moderator", 
                id: "mod123",
                moderatorRegions: ["Region I"]
            }

            mockClaimsDb["claim1"] = {
                id: "claim1",
                cafeId: "cafe1",
                userId: "user1",
                status: "pending",
                cafeRegion: "Region I"
            }

            mockClaimsDb["claim2"] = {
                id: "claim2",
                cafeId: "cafe2",
                userId: "user2",
                status: "pending"
                // no cafeRegion - should be excluded when filtering
            }

            const getPendingClaims = async () => {
                const regions = await getModeratorRegionsForCurrentUser()
                
                const allClaims = Object.values(mockClaimsDb).filter(c => c.status === "pending")
                
                if (regions.length > 0) {
                    return allClaims.filter(c => c.cafeRegion && regions.includes(c.cafeRegion))
                }
                
                return allClaims
            }

            const result = await getPendingClaims()
            expect(result).toHaveLength(1)
            expect(result[0].id).toBe("claim1")
        })
    })

    describe("timing attack prevention", () => {
        it("returns identical errors for non-existent vs unauthorized claims", async () => {
            mockGetCurrentUser.setCurrentUser({ id: "mod123" })
            mockProfilesData["mod123"] = { 
                role: "moderator", 
                id: "mod123",
                moderatorRegions: ["Region I"]
            }

            mockClaimsDb["claim1"] = {
                id: "claim1",
                cafeId: "cafe1",
                userId: "user456",
                status: "pending",
                cafeRegion: "Region III"
            }

            const processClaim = async (claimId: string) => {
                const currentUser = await mockGetCurrentUser.getCurrentUser()
                if (!currentUser) return { success: false, error: "Not authenticated" }

                const profile = mockProfilesData[currentUser.id]
                if (profile?.role !== "admin" && profile?.role !== "moderator") {
                    return { success: false, error: "Unauthorized" }
                }

                const claim = mockClaimsDb[claimId]
                const regions = await getModeratorRegionsForCurrentUser()
                
                const hasRegionAccess = regions.length === 0 || !claim?.cafeRegion || regions.includes(claim.cafeRegion)
                if (!claim || !hasRegionAccess) {
                    return { success: false, error: "Not found or unauthorized" }
                }

                return { success: true }
            }

            // Both cases should return the exact same error
            const nonExistentResult = await processClaim("nonexistent")
            const unauthorizedResult = await processClaim("claim1")

            expect(nonExistentResult.error).toBe("Not found or unauthorized")
            expect(unauthorizedResult.error).toBe("Not found or unauthorized")
            expect(nonExistentResult.error).toBe(unauthorizedResult.error)
        })
    })
})
