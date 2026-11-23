import { describe, it, expect, beforeEach, mock } from "bun:test"
import { cafes, profiles } from "@/db/schema"

/**
 * Seam S5, the permission half: who may edit a Cafe, and through which surface.
 *
 * The caller is always supplied — the point of the test is who may do what — and
 * the database is faked at the module boundary. The owner list comes from the
 * Cafe row (`cafes.ownerIds`), never from anything the caller asserts about
 * themselves.
 */

interface Caller {
    id: string
}

let mockCaller: Caller | null = null
/** The caller's profile row. */
let mockProfile: { role: string | null; regions: string[] | null } = {
    role: "user",
    regions: null,
}
/** The Cafe row: its region and its stored owner list. */
let mockCafe: { region: string | null; ownerIds: string[] } = {
    region: "Cebu",
    ownerIds: [],
}

mock.module("@/lib/auth", () => ({
    getCurrentUser: () => Promise.resolve(mockCaller),
}))

mock.module("@/db", () => ({
    db: {
        select: () => ({
            from: (table: unknown) => ({
                where: () => ({
                    limit: () => {
                        if (table === profiles) {
                            return Promise.resolve([
                                { role: mockProfile.role, regions: mockProfile.regions },
                            ])
                        }
                        if (table === cafes) {
                            return Promise.resolve([
                                { region: mockCafe.region, ownerIds: mockCafe.ownerIds },
                            ])
                        }
                        // A table this lookup has no business reading.
                        return Promise.resolve([])
                    },
                }),
            }),
        }),
    },
}))

const { getCafeEditPermission } = await import("@/app/api/actions/cafe-edit-permission")

const CAFE_ID = "cafe-kape-lolo"

beforeEach(() => {
    mockCaller = null
    mockProfile = { role: "user", regions: null }
    mockCafe = { region: "Cebu", ownerIds: [] }
})

describe("getCafeEditPermission — owner", () => {
    it("lets the Cafe's owner edit, with the owner role", async () => {
        mockCaller = { id: "user-owner" }
        mockProfile = { role: "user", regions: null }
        mockCafe = { region: "Cebu", ownerIds: ["user-owner"] }

        expect(await getCafeEditPermission(CAFE_ID)).toEqual({
            canEdit: true,
            role: "owner",
        })
    })

    it("recognises an owner stored alongside a co-owner", async () => {
        mockCaller = { id: "user-co-owner" }
        mockCafe = { region: "Cebu", ownerIds: ["user-owner", "user-co-owner"] }

        expect(await getCafeEditPermission(CAFE_ID)).toEqual({
            canEdit: true,
            role: "owner",
        })
    })
})

describe("getCafeEditPermission — staff keep what they had", () => {
    it("lets an admin edit with the admin role, owner or not", async () => {
        mockCaller = { id: "user-admin" }
        mockProfile = { role: "admin", regions: null }
        mockCafe = { region: "Cebu", ownerIds: [] }

        expect(await getCafeEditPermission(CAFE_ID)).toEqual({
            canEdit: true,
            role: "admin",
        })
    })

    it("keeps an admin an admin even where they own the Cafe", async () => {
        mockCaller = { id: "user-admin" }
        mockProfile = { role: "admin", regions: null }
        mockCafe = { region: "Cebu", ownerIds: ["user-admin"] }

        expect(await getCafeEditPermission(CAFE_ID)).toEqual({
            canEdit: true,
            role: "admin",
        })
    })

    it("lets an unrestricted moderator edit with the moderator role", async () => {
        mockCaller = { id: "user-mod" }
        mockProfile = { role: "moderator", regions: [] }
        mockCafe = { region: "Cebu", ownerIds: [] }

        expect(await getCafeEditPermission(CAFE_ID)).toEqual({
            canEdit: true,
            role: "moderator",
        })
    })

    it("lets a moderator edit inside one of their regions", async () => {
        mockCaller = { id: "user-mod" }
        mockProfile = { role: "moderator", regions: ["Cebu", "Bohol"] }
        mockCafe = { region: "Cebu", ownerIds: [] }

        expect(await getCafeEditPermission(CAFE_ID)).toEqual({
            canEdit: true,
            role: "moderator",
        })
    })
})

describe("getCafeEditPermission — nobody else", () => {
    it("refuses a moderator outside their regions", async () => {
        mockCaller = { id: "user-mod" }
        mockProfile = { role: "moderator", regions: ["Manila"] }
        mockCafe = { region: "Cebu", ownerIds: [] }

        const permission = await getCafeEditPermission(CAFE_ID)

        expect(permission.canEdit).toBe(false)
    })

    it("keeps region scoping even when the out-of-region moderator owns the Cafe", async () => {
        mockCaller = { id: "user-mod" }
        mockProfile = { role: "moderator", regions: ["Manila"] }
        mockCafe = { region: "Cebu", ownerIds: ["user-mod"] }

        const permission = await getCafeEditPermission(CAFE_ID)

        expect(permission.canEdit).toBe(false)
        expect(permission.role).not.toBe("owner")
    })

    it("refuses another Cafe's owner", async () => {
        mockCaller = { id: "user-other-owner" }
        mockProfile = { role: "user", regions: null }
        mockCafe = { region: "Cebu", ownerIds: ["user-owner"] }

        expect(await getCafeEditPermission(CAFE_ID)).toEqual({
            canEdit: false,
            role: null,
        })
    })

    it("refuses a signed-in visitor with no claim on the Cafe", async () => {
        mockCaller = { id: "user-regular" }
        mockProfile = { role: "user", regions: null }
        mockCafe = { region: "Cebu", ownerIds: ["user-owner"] }

        expect(await getCafeEditPermission(CAFE_ID)).toEqual({
            canEdit: false,
            role: null,
        })
    })

    it("refuses a visitor without a session, whatever the Cafe says", async () => {
        mockCaller = null
        mockCafe = { region: "Cebu", ownerIds: ["user-owner"] }

        expect(await getCafeEditPermission(CAFE_ID)).toEqual({
            canEdit: false,
            role: null,
        })
    })
})
