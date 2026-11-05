import { describe, it, expect } from "bun:test"
import {
    OWNER_EDITABLE_FIELDS,
    PROTECTED_CAFE_COLUMNS,
    isOwnerEditableField,
} from "@/utils/owner/owner-editable-fields"

describe("owner-editable-fields", () => {
    it("allows exactly the 42 fields in updateCafeAsOwner's signature", () => {
        expect(OWNER_EDITABLE_FIELDS.length).toBe(42)
    })

    it("includes identity-mapped fields (no snake_case alias)", () => {
        const keys = [
            "name", "description", "area", "region", "province",
            "lat", "lng", "specialty", "tags", "roaster",
            "phone", "email", "socials", "thumbnail", "gallery",
        ]
        for (const key of keys) {
            expect(OWNER_EDITABLE_FIELDS).toContain(key as never)
        }
    })

    it("includes snake_case fields that fieldMap translates", () => {
        const keys = [
            "address_display", "has_wifi", "payment_methods",
            "operating_hours", "city_municipality", "badge_stamp_url",
            "straw_type_other", "is_halal_certified",
        ]
        for (const key of keys) {
            expect(OWNER_EDITABLE_FIELDS).toContain(key as never)
        }
    })

    it("never contains a protected column", () => {
        for (const column of PROTECTED_CAFE_COLUMNS) {
            expect(OWNER_EDITABLE_FIELDS).not.toContain(column as never)
        }
    })

    it("lists the columns that grant ownership or visibility", () => {
        const columns = ["ownerIds", "isClaimed", "isVerified", "isPublished"]
        for (const column of columns) {
            expect(PROTECTED_CAFE_COLUMNS).toContain(column as never)
        }
    })

    it("isOwnerEditableField accepts allowed keys and rejects everything else", () => {
        expect(isOwnerEditableField("name")).toBe(true)
        expect(isOwnerEditableField("has_wifi")).toBe(true)
        expect(isOwnerEditableField("isVerified")).toBe(false)
        expect(isOwnerEditableField("ownerIds")).toBe(false)
        expect(isOwnerEditableField("is_published")).toBe(false)
        expect(isOwnerEditableField("__proto__")).toBe(false)
        expect(isOwnerEditableField("constructor")).toBe(false)
    })
})
