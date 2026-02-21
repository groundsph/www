import { z } from "zod"

export const cafeQuerySchema = z.object({
    // Location filters
    city: z.string().optional(),
    province: z.string().optional(),
    region: z.string().optional(),
    area: z.string().optional(),
    nearLatLng: z
        .object({
            lat: z.number(),
            lng: z.number(),
        })
        .optional(),
    radiusKm: z.number().max(50).optional(),

    // Pagination
    limit: z.number().int().max(50).optional(),
    offset: z.number().int().optional(),

    // Sorting
    sortBy: z.enum(["rating", "distance", "recent", "reviews"]).optional(),

    // Amenities
    hasWifi: z.boolean().optional(),
    hasSockets: z.boolean().optional(),
    hasAircon: z.boolean().optional(),
    isPetFriendly: z.boolean().optional(),
    isWorkFriendly: z.boolean().optional(),
    servesFood: z.boolean().optional(),
    hasOutdoorSeating: z.boolean().optional(),

    // Pricing
    priceLevel: z.enum(["low", "medium", "high"]).optional(),
    coffeeStyle: z.enum(["classic", "artisan"]).optional(),
    membershipTier: z.enum(["free", "basic", "premium"]).optional(),

    // Status
    isPublished: z.boolean().optional(),
    isHiddenGem: z.boolean().optional(),
    isChain: z.boolean().optional(),
    isHalalCertified: z.boolean().optional().describe("Filter for Halal certified cafes"),

    // Tags
    tags: z.array(z.string()).optional(),
    brewMethods: z.array(z.string()).optional(),
    specialty: z.array(z.string()).optional(),
    milkOptions: z.array(z.string()).optional(),
})

export type CafeQueryInput = z.infer<typeof cafeQuerySchema>
