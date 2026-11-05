/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, mock, beforeEach } from "bun:test"
import { cafes, cafeMenuItems } from "@/db/schema"

interface InsertCall {
    table: unknown
    payload: Record<string, any>
}

const inserts: InsertCall[] = []
let failMenuInsert = false

function selectChain(rows: unknown[] = []) {
    const chain: any = {
        from: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: () => Promise.resolve(rows),
        then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
    }
    return chain
}

mock.module("@/db", () => ({
    db: {
        select: () => selectChain([]),
        insert: (table: any) => ({
            values: (payload: Record<string, any>) => {
                inserts.push({ table, payload })
                if (table === cafeMenuItems && failMenuInsert) {
                    return Promise.reject(new Error("menu insert boom"))
                }
                return { returning: () => Promise.resolve([{ id: "cafe-1", slug: "demo" }]) }
            },
        }),
    },
}))

mock.module("@/lib/auth", () => ({
    getCurrentUser: () => ({ id: "user-1" }),
}))

import { submitCafe } from "@/app/api/actions/submit"

function submission(overrides: Record<string, unknown> = {}) {
    return {
        name: "Demo Cafe",
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
        ...overrides,
    }
}

function menuItem(overrides: Record<string, unknown> = {}) {
    return {
        name: "Spanish Latte",
        category: "Coffee",
        price: 150,
        description: "Oat milk",
        imageUrl: null,
        isSignature: true,
        isFood: false,
        isHot: true,
        isCold: false,
        isVegan: true,
        isVegetarian: true,
        calories: 220,
        sizeOptions: [{ label: "Large", price: 180 }],
        ...overrides,
    }
}

beforeEach(() => {
    inserts.length = 0
    failMenuInsert = false
})

describe("submitCafe persistence", () => {
    it("saves the submitter's coffee style", async () => {
        const result = await submitCafe(submission({ coffee_style: "artisan" }), null, [])
        expect(result.success).toBe(true)

        const cafeInsert = inserts.find((call) => call.table === cafes)
        expect(cafeInsert?.payload.coffeeStyle).toBe("artisan")
    })

    it("keeps every menu item attribute collected in the form", async () => {
        const result = await submitCafe(submission(), null, [], [menuItem()])
        expect(result.success).toBe(true)

        const menuInsert = inserts.find((call) => call.table === cafeMenuItems)
        expect(menuInsert?.payload).toMatchObject({
            cafeId: "cafe-1",
            name: "Spanish Latte",
            category: "Coffee",
            price: 150,
            description: "Oat milk",
            isSignature: true,
            isHot: true,
            isCold: false,
            isVegan: true,
            isVegetarian: true,
            calories: 220,
            sizeOptions: [{ label: "Large", price: 180 }],
            sortOrder: 0,
        })
    })

    it("reports a menu item that could not be saved instead of dropping it silently", async () => {
        failMenuInsert = true

        const result = await submitCafe(submission(), null, [], [menuItem({ name: "Cortado" })])
        expect(result.success).toBe(true)
        expect(result.warnings?.length).toBe(1)
        expect(result.warnings?.[0]).toContain("Cortado")
    })

    it("omits warnings when every menu item saves", async () => {
        const result = await submitCafe(submission(), null, [], [menuItem()])
        expect(result.warnings).toBeUndefined()
    })
})
