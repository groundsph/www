import { describe, it, expect, mock } from "bun:test"

mock.module("@/db", () => ({
    db: {
        select: () => ({
            from: () => ({
                where: () => ({
                    limit: () => Promise.resolve([{
                        id: "existing-1",
                        name: "Test Cafe Existing",
                        slug: "test-cafe-existing",
                        isPublished: true,
                        addressDisplay: "123 Ayala Ave, Makati",
                        lat: 14.5547,
                        lng: 121.0244,
                    }])
                })
            })
        }),
        insert: () => ({
            values: () => ({
                returning: () => Promise.reject(new Error("Should not reach insert")),
            }),
        }),
    },
}))

mock.module("@/lib/auth", () => ({
    getCurrentUser: () => ({ id: "user-1" }),
}))

mock.module("@/app/api/actions/notify", () => ({
    notifyDiscord: () => Promise.resolve(),
}))

mock.module("@/utils/contribution-logging", () => ({
    logContribution: () => Promise.resolve(),
}))

describe("duplicate cafe detection", () => {
    it("blocks submission when duplicate cafe exists", async () => {
        const { submitCafe } = await import("@/app/api/actions/submit")
        const result = await submitCafe(
            {
                name: "Test Cafe",
                description: "",
                region: "NCR",
                province: "Metro Manila",
                city_municipality: "Makati",
                area: "",
                address_display: "123 Ayala Ave, Makati",
                lat: 14.5547,
                lng: 121.0244,
                price_level: "mid",
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
                is_hidden_gem: false,
                finding_hint: "",
                is_chain: false,
                is_halal_certified: false,
                straw_type: "",
                straw_type_other: "",
                coffee_style: null,
                is_owner: false,
            } as any,
            null,
            [],
            []
        )

        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error).toBeDefined()
        }
    })

    it("allows submission when no duplicates found", async () => {
        // Reset mock to return empty (no duplicates)
        mock.module("@/db", () => ({
            db: {
                select: () => ({
                    from: () => ({
                        where: () => ({
                            limit: () => Promise.resolve([])
                        })
                    })
                }),
                insert: () => ({
                    values: () => ({
                        returning: () => Promise.resolve([{ id: "new-1", slug: "unique-cafe-name-makati-metro-manila" }]),
                    }),
                }),
            },
        }))

        mock.module("@/lib/auth", () => ({
            getCurrentUser: () => ({ id: "user-1" }),
        }))

        mock.module("@/app/api/actions/notify", () => ({
            notifyDiscord: () => Promise.resolve(),
        }))

        mock.module("@/utils/contribution-logging", () => ({
            logContribution: () => Promise.resolve(),
        }))

        // Need a fresh import to pick up the new mock
        const mod = await import("@/app/api/actions/submit?_nocache=" + Date.now())
        const submitCafe = mod.submitCafe

        const result = await submitCafe(
            {
                name: "Unique Cafe Name",
                description: "",
                region: "NCR",
                province: "Metro Manila",
                city_municipality: "Makati",
                area: "",
                address_display: "456 Unique St, Makati",
                lat: 14.56,
                lng: 121.03,
                price_level: "mid",
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
                is_hidden_gem: false,
                finding_hint: "",
                is_chain: false,
                is_halal_certified: false,
                straw_type: "",
                straw_type_other: "",
                coffee_style: null,
                is_owner: false,
            } as any,
            null,
            [],
            []
        )

        expect(result.success).toBe(true)
    })
})