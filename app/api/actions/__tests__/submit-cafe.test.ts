import { describe, it, expect, mock } from "bun:test"
import { submitCafe } from "@/app/api/actions/submit"
import { getUserPendingSubmissions } from "@/app/api/actions/cafe"

mock.module("@/db", () => ({
    db: {
        select: () => ({
            from: () => ({
                where: () => {
                    const p: any = Promise.resolve([])
                    p.limit = () => p
                    return p
                }
            })
        }),
        insert: () => ({
            values: (payload: Record<string, unknown>) => {
                expect(payload.isHalalCertified).toBe(true)
                expect(payload.strawType).toBe("paper")
                expect(payload.strawTypeOther).toBe(null)
                return { returning: () => Promise.resolve([{ id: "1", slug: "demo" }]) }
            },
        }),
    },
}))

mock.module("@/lib/auth", () => ({
    getCurrentUser: () => ({ id: "user-1" }),
}))

describe("submitCafe", () => {
    it("persists halal and straw fields", async () => {
        const result = await submitCafe(
            {
                name: "Demo",
                description: "",
                region: "NCR",
                province: "Metro Manila",
                city_municipality: "Manila",
                area: "",
                address_display: "123 Test Street",
                lat: 1,
                lng: 1,
                has_wifi: false,
                has_smoking: false,
                has_sockets: false,
                has_parking: false,
                has_aircon: false,
                is_pet_friendly: false,
                has_outdoor_seating: false,
                has_indoor_seating: false,
                has_restroom: false,
                has_bidet: false,
                has_non_dairy: false,
                has_decaf: false,
                milk_options: [],
                serves_food: false,
                is_work_friendly: false,
                price_level: "mid",
                coffee_style: null,
                payment_methods: "",
                specialty: [],
                tags: [],
                brew_methods: [],
                roaster: "",
                operating_hours: [],
                website_url: "",
                phone: "",
                email: "",
                socials: [],
                is_owner: false,
                is_hidden_gem: false,
                finding_hint: "",
                is_chain: false,
                is_halal_certified: true,
                straw_type: "paper",
                straw_type_other: "",
            },
            null,
            []
        )
        expect(result.success).toBe(true)
    })

    it("returns structured error on validation failure", async () => {
        const result = await submitCafe(
            { name: "" } as Record<string, unknown>, // Empty name triggers Zod validation failure
            null,
            []
        )
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error).toBeDefined()
            expect(result.error!.code).toBe("VALIDATION")
            expect(result.error!.message).toBeTruthy()
        }
    })

    it("returns structured auth error when not authenticated", async () => {
        // Re-mock auth to return null
        const { mock } = await import("bun:test")
        mock.module("@/lib/auth", () => ({
            getCurrentUser: () => null,
        }))
        mock.module("@/db", () => ({
            db: {
                select: () => ({
                    from: () => ({
                        where: () => {
                            const p: any = Promise.resolve([])
                            p.limit = () => p
                            return p
                        }
                    })
                }),
                insert: () => ({
                    values: () => ({
                        returning: () => Promise.resolve([{ id: "1", slug: "demo" }])
                    }),
                }),
            },
        }))

        const result = await submitCafe(
            {
                name: "Test Cafe",
                description: "",
                region: "NCR",
                province: "Metro Manila",
                city_municipality: "Manila",
                area: "",
                address_display: "123 Test Street",
                lat: 1,
                lng: 1,
                has_wifi: false,
                has_smoking: false,
                has_sockets: false,
                has_parking: false,
                has_aircon: false,
                is_pet_friendly: false,
                has_outdoor_seating: false,
                has_indoor_seating: false,
                has_restroom: false,
                has_bidet: false,
                has_non_dairy: false,
                has_decaf: false,
                milk_options: [],
                serves_food: false,
                is_work_friendly: false,
                price_level: "mid",
                coffee_style: null,
                payment_methods: "",
                specialty: [],
                tags: [],
                brew_methods: [],
                roaster: "",
                operating_hours: [],
                website_url: "",
                phone: "",
                email: "",
                socials: [],
                is_owner: false,
                is_hidden_gem: false,
                finding_hint: "",
                is_chain: false,
                is_halal_certified: false,
                straw_type: "",
                straw_type_other: "",
            },
            null,
            []
        )
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error).toBeDefined()
            expect(result.error!.code).toBe("AUTH")
            expect(result.error!.retryable).toBe(false)
        }
    })
})

describe("getUserPendingSubmissions", () => {
    it("returns empty array when no pending submissions exist", async () => {
        // Reset auth to authenticated user
        mock.module("@/lib/auth", () => ({
            getCurrentUser: () => ({ id: "test-user-1" }),
        }))
        mock.module("@/db", () => ({
            db: {
                select: () => ({
                    from: () => ({
                        where: () => ({
                            orderBy: () => Promise.resolve([]),
                        }),
                    }),
                }),
            },
        }))

        const result = await getUserPendingSubmissions()
        expect(Array.isArray(result)).toBe(true)
        expect(result.length).toBe(0)
    })

    it("returns empty array when not authenticated", async () => {
        mock.module("@/lib/auth", () => ({
            getCurrentUser: () => null,
        }))

        const result = await getUserPendingSubmissions()
        expect(Array.isArray(result)).toBe(true)
        expect(result.length).toBe(0)
    })
})