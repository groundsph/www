/**
 * Fields a cafe owner is allowed to write through `updateCafeAsOwner`.
 *
 * This is an ALLOWLIST, not a blocklist: anything absent is rejected. It lives
 * outside `app/api/actions/owner.ts` because that module is `'use server'`,
 * and Next.js requires every export of such a module to be an async function.
 *
 * The list is exactly the shape of `updateCafeAsOwner`'s `updates` parameter.
 */
export const OWNER_EDITABLE_FIELDS = [
    "name",
    "description",
    "address_display",
    "area",
    "region",
    "province",
    "city_municipality",
    "lat",
    "lng",
    "has_wifi",
    "has_smoking",
    "has_sockets",
    "has_parking",
    "has_aircon",
    "is_pet_friendly",
    "has_outdoor_seating",
    "has_indoor_seating",
    "has_restroom",
    "has_bidet",
    "has_non_dairy",
    "milk_options",
    "serves_food",
    "is_work_friendly",
    "price_level",
    "payment_methods",
    "specialty",
    "tags",
    "brew_methods",
    "roaster",
    "operating_hours",
    "website_url",
    "phone",
    "email",
    "socials",
    "is_hidden_gem",
    "finding_hint",
    "thumbnail",
    "gallery",
    "badge_stamp_url",
    "is_halal_certified",
    "straw_type",
    "straw_type_other",
] as const

export type OwnerEditableField = (typeof OWNER_EDITABLE_FIELDS)[number]

/**
 * Columns no owner edit may ever reach. The allowlist already excludes these;
 * stating them separately keeps the intent reviewable, and the test asserts
 * the two lists never overlap.
 */
export const PROTECTED_CAFE_COLUMNS = [
    "id",
    "slug",
    "ownerIds",
    "isClaimed",
    "isVerified",
    "isPublished",
    "isActive",
    "isTest",
    "createdAt",
    "updatedAt",
] as const

const OWNER_EDITABLE_FIELD_SET: ReadonlySet<string> = new Set(
    OWNER_EDITABLE_FIELDS
)

export function isOwnerEditableField(key: string): boolean {
    return OWNER_EDITABLE_FIELD_SET.has(key)
}
