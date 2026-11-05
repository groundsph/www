import { describe, it, expect, beforeEach, mock } from "bun:test"

let mockUser: { id: string } | null = { id: "user-1" }
let mockOwnerIds: string[] = ["user-1"]
let capturedSet: Record<string, unknown> | null = null
const revalidatedPaths: string[] = []

mock.module("next/headers", () => ({
    headers: () => Promise.resolve({ get: () => null }),
}))

mock.module("next/cache", () => ({
    revalidatePath: (path: string) => {
        revalidatedPaths.push(path)
    },
}))

mock.module("@/lib/auth", () => ({
    getCurrentUser: () => Promise.resolve(mockUser),
}))

// owner.ts imports ./system-logs, which imports admin.ts; admin.ts imports
// `auth` from @/lib/auth, so mocking @/lib/auth down to getCurrentUser would
// break that chain. Mocking the log sink keeps the graph small and avoids it.
mock.module("@/app/api/actions/system-logs", () => ({
    logSystemAction: () => Promise.resolve(),
}))

mock.module("@/utils/contribution-logging", () => ({
    logContribution: () => Promise.resolve(),
    getChangedFields: () => ["name"],
    generateChangeSummary: () => "Updated name",
}))

mock.module("@/db", () => ({
    db: {
        select: () => ({
            from: () => ({
                where: () => ({
                    limit: () =>
                        Promise.resolve([
                            {
                                ownerIds: mockOwnerIds,
                                name: "Test Cafe",
                                description: null,
                                addressDisplay: "1 Test St",
                                area: null,
                            },
                        ]),
                }),
            }),
        }),
        update: () => ({
            set: (values: Record<string, unknown>) => {
                capturedSet = values
                return { where: () => Promise.resolve({ rowsAffected: 1 }) }
            },
        }),
    },
    eq: () => ({}),
}))

const { updateCafeAsOwner, setCafeBadgeStamp, removeCafeBadgeStamp } =
    await import("@/app/api/actions/owner")

describe("updateCafeAsOwner — field allowlist", () => {
    beforeEach(() => {
        mockUser = { id: "user-1" }
        mockOwnerIds = ["user-1"]
        capturedSet = null
    })

    it("rejects isVerified and names the field in the error", async () => {
        const result = await updateCafeAsOwner("cafe-1", {
            isVerified: true,
        } as never)

        expect(result.success).toBe(false)
        expect(result.error).toContain("isVerified")
        expect(capturedSet).toBeNull()
    })

    it("rejects every ownership and visibility column", async () => {
        for (const key of [
            "isClaimed",
            "isPublished",
            "isActive",
            "isTest",
            "ownerIds",
        ]) {
            capturedSet = null
            const result = await updateCafeAsOwner("cafe-1", {
                [key]: true,
            } as never)
            expect(result.success).toBe(false)
            expect(capturedSet).toBeNull()
        }
    })

    it("rejects an unknown key rather than failing silently", async () => {
        const result = await updateCafeAsOwner("cafe-1", {
            arbitrary_column: "x",
        } as never)

        expect(result.success).toBe(false)
        expect(result.error).toContain("arbitrary_column")
        expect(capturedSet).toBeNull()
    })

    it("still writes allowed fields", async () => {
        const result = await updateCafeAsOwner("cafe-1", {
            name: "Renamed Cafe",
            has_wifi: true,
        } as never)

        expect(result.success).toBe(true)
        expect(capturedSet).toBeTruthy()
        expect(capturedSet?.name).toBe("Renamed Cafe")
        expect(capturedSet?.hasWifi).toBe(true)
    })

    it("rejects a non-owner before reaching the allowlist", async () => {
        mockOwnerIds = ["someone-else"]
        const result = await updateCafeAsOwner("cafe-1", {
            name: "Hijacked",
        } as never)

        expect(result.success).toBe(false)
        expect(result.error).toContain("Not authorized")
        expect(capturedSet).toBeNull()
    })

    it("rejects an unauthenticated caller", async () => {
        mockUser = null
        const result = await updateCafeAsOwner("cafe-1", {
            name: "Anonymous",
        } as never)

        expect(result.success).toBe(false)
        expect(capturedSet).toBeNull()
    })
})

describe("setCafeBadgeStamp — revalidation paths", () => {
    beforeEach(() => {
        mockUser = { id: "user-1" }
        mockOwnerIds = ["user-1"]
        revalidatedPaths.length = 0
    })

    it("revalidates the real public cafe route, not /cafe/[slug]", async () => {
        await setCafeBadgeStamp("cafe-1", "https://cdn.grounds.ph/stamp.png")

        const paths = revalidatedPaths.join(" ")
        expect(paths).not.toContain("/cafe/[slug]")
        expect(paths).toContain("/cafes/[slug]")
    })

    it("revalidates the real owner editor route, not /owner/cafe/:id", async () => {
        await setCafeBadgeStamp("cafe-1", "https://cdn.grounds.ph/stamp.png")

        const paths = revalidatedPaths.join(" ")
        expect(paths).not.toContain("/owner/cafe/")
        expect(paths).toContain("/owner/cafes/[slug]/edit")
    })

    it("removeCafeBadgeStamp revalidates the same real routes", async () => {
        await removeCafeBadgeStamp("cafe-1")

        const paths = revalidatedPaths.join(" ")
        expect(paths).not.toContain("/cafe/[slug]")
        expect(paths).toContain("/cafes/[slug]")
        expect(paths).toContain("/owner/cafes/[slug]/edit")
    })
})
