/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, mock, beforeEach } from "bun:test"

const whereArgs: any[] = []

function selectChain() {
    const chain: any = {
        from: () => chain,
        where: (condition: unknown) => {
            whereArgs.push(condition)
            return chain
        },
        orderBy: () => chain,
        limit: () => Promise.resolve([]),
        then: (resolve: (value: unknown[]) => unknown) => Promise.resolve([]).then(resolve),
    }
    return chain
}

mock.module("@/db", () => ({
    db: {
        select: () => selectChain(),
        insert: () => ({
            values: () => ({ returning: () => Promise.resolve([{ id: "cafe-1", slug: "demo" }]) }),
        }),
    },
}))

mock.module("@/lib/auth", () => ({
    getCurrentUser: () => ({ id: "user-1" }),
}))

import { submitCafe } from "@/app/api/actions/submit"

/** Flatten a drizzle SQL tree into readable text (columns, operators, params). */
function flattenSql(node: any, depth = 0): string {
    if (node == null || depth > 8) return ""
    if (typeof node === "string") return node
    if (typeof node === "number") return String(node)
    if (Array.isArray(node)) return node.map((child) => flattenSql(child, depth + 1)).join("")
    if (node instanceof String) return node.valueOf()
    if (node.queryChunks) return flattenSql(node.queryChunks, depth + 1)
    if (typeof node.name === "string") return node.name
    return ""
}

function submission(overrides: Record<string, unknown> = {}) {
    return {
        name: "Demo Cafe",
        description: "",
        region: "NCR",
        province: "Metro Manila",
        city_municipality: "Makati",
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
        ...overrides,
    }
}

beforeEach(() => {
    whereArgs.length = 0
})

describe("submitCafe duplicate detection", () => {
    it("scopes the name check to both city and province", async () => {
        await submitCafe(submission(), null, [])

        expect(whereArgs.length).toBeGreaterThan(0)
        const nameCheck = flattenSql(whereArgs[0])

        // PH has same-named municipalities in different provinces, so the
        // province must be part of the duplicate lookup.
        expect(nameCheck).toContain("city_municipality")
        expect(nameCheck).toContain("province")
        expect(nameCheck).toContain("%Makati%")
        expect(nameCheck).toContain("%Metro Manila%")
    })

    it("escapes LIKE wildcards so a place name cannot widen the match", async () => {
        await submitCafe(submission({ city_municipality: "50% Off_ Makati" }), null, [])

        const nameCheck = flattenSql(whereArgs[0])
        expect(nameCheck).toContain("50\\% Off\\_ Makati")
    })
})
