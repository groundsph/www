import { describe, it, expect, mock, beforeEach } from "bun:test"

/**
 * The app carries two role fields and they disagree in production: better-auth
 * writes `user.role`, and `profiles.role` is what the owner, edit-permission and
 * region-scoping paths read. A gate that trusts only the first treats most real
 * staff as strangers, so this resolves the question against both.
 */

interface ProfileRow {
    role: "user" | "moderator" | "admin" | null
}

let profileRows: ProfileRow[] = []
let profileLookupShouldThrow = false

mock.module("@/db", () => ({
    db: {
        select: () => ({
            from: () => ({
                where: () => ({
                    limit: async () => {
                        if (profileLookupShouldThrow) throw new Error("connection lost")
                        return profileRows
                    },
                }),
            }),
        }),
    },
}))

import { getStaffRole } from "@/utils/auth/staff-role"

beforeEach(() => {
    profileRows = []
    profileLookupShouldThrow = false
})

const caller = (role?: string | null) => ({ id: "user-1", role })

describe("getStaffRole", () => {
    it("reads admin from the auth role without a second lookup", async () => {
        const result = await getStaffRole(caller("admin"))
        expect(result).toEqual({ isAdmin: true, isModerator: true })
    })

    it("reads moderator from the auth role", async () => {
        expect(await getStaffRole(caller("moderator"))).toEqual({ isAdmin: false, isModerator: true })
    })

    it("finds an admin whose auth role says otherwise — the production case", async () => {
        profileRows = [{ role: "admin" }]

        expect(await getStaffRole(caller("user"))).toEqual({ isAdmin: true, isModerator: true })
    })

    it("finds a moderator whose auth role is 'authenticated'", async () => {
        profileRows = [{ role: "moderator" }]

        expect(await getStaffRole(caller("authenticated"))).toEqual({ isAdmin: false, isModerator: true })
    })

    it("treats a plain account as staff of nothing", async () => {
        profileRows = [{ role: "user" }]

        expect(await getStaffRole(caller("user"))).toEqual({ isAdmin: false, isModerator: false })
    })

    it("treats a caller with no profile row as staff of nothing", async () => {
        expect(await getStaffRole(caller("authenticated"))).toEqual({ isAdmin: false, isModerator: false })
    })

    it("grants nothing to a caller without a session", async () => {
        expect(await getStaffRole(null)).toEqual({ isAdmin: false, isModerator: false })
    })

    it("grants nothing when the role lookup fails", async () => {
        profileLookupShouldThrow = true

        expect(await getStaffRole(caller("user"))).toEqual({ isAdmin: false, isModerator: false })
    })
})
