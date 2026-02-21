import { db } from "@/db"
import { cafes, cafeRatingStats } from "@/db/schema"
import { eq, and, or, desc, ilike, sql, isNull } from "drizzle-orm"
import { CafeQueryInput } from "@/utils/ai/tools/cafe-query"
import {
    sortByDistance,
    filterByDistance,
    type GeoPoint,
} from "@/utils/ai/tools/cafe-geo"

export interface CafeResult {
    id: string
    name: string
    slug: string
    lat: number | null
    lng: number | null
    cityMunicipality: string
    province: string
    rating: number | null
}

export interface CafeQueryResult {
    cafes: CafeResult[]
    total: number
    metadata: {
        filters: CafeQueryInput
        executedAt: string
        hasMore: boolean
    }
}

export interface CafeQueryError {
    success: false
    error: string
}

/**
 * Run a deterministic cafe query based on validated parameters
 * Returns structured data for AI response generation
 */
export async function runCafeQuery(
    params: CafeQueryInput
): Promise<CafeQueryResult | CafeQueryError> {
    try {
        const limit = params.limit ?? 10
        const offset = params.offset ?? 0

        // Build where conditions
        const conditions = buildConditions(params)

        // Query cafes with rating stats - apply ordering inline
        let query = db
            .select({
                id: cafes.id,
                name: cafes.name,
                slug: cafes.slug,
                lat: cafes.lat,
                lng: cafes.lng,
                cityMunicipality: cafes.cityMunicipality,
                province: cafes.province,
                rating: cafeRatingStats.averageRating,
            })
            .from(cafes)
            .leftJoin(cafeRatingStats, eq(cafes.id, cafeRatingStats.cafeId))
            .where(and(...conditions))

        // Apply ordering based on sortBy parameter
        switch (params.sortBy) {
            case "rating":
                query = query.orderBy(
                    desc(cafes.membershipTier),
                    desc(cafeRatingStats.averageRating)
                ) as typeof query
                break
            case "reviews":
                query = query.orderBy(
                    desc(cafes.membershipTier),
                    desc(cafeRatingStats.totalReviews)
                ) as typeof query
                break
            case "recent":
                query = query.orderBy(desc(cafes.createdAt)) as typeof query
                break
            default:
                // Default: by membership tier then created
                query = query.orderBy(
                    desc(cafes.membershipTier),
                    desc(cafes.createdAt)
                ) as typeof query
        }

        // Execute query
        let results = await query

        // Post-process geo filters (distance filtering)
        if (params.nearLatLng && params.radiusKm) {
            const center: GeoPoint = {
                lat: params.nearLatLng.lat,
                lng: params.nearLatLng.lng,
            }
            results = filterByDistance(results, center, params.radiusKm)
        }

        // Sort by distance if requested
        if (params.sortBy === "distance" && params.nearLatLng) {
            const center: GeoPoint = {
                lat: params.nearLatLng.lat,
                lng: params.nearLatLng.lng,
            }
            results = sortByDistance(results, center)
        }

        // Apply pagination after geo processing
        const total = results.length
        const paginatedResults = results.slice(offset, offset + limit)

        return {
            cafes: paginatedResults,
            total,
            metadata: {
                filters: params,
                executedAt: new Date().toISOString(),
                hasMore: offset + limit < total,
            },
        }
    } catch (error) {
        console.error("Cafe query error:", error)
        return {
            success: false,
            error: "Failed to query cafes",
        }
    }
}

function buildConditions(params: CafeQueryInput) {
    const conditions: ReturnType<typeof eq>[] = []

    // Default to published cafes only
    conditions.push(eq(cafes.isPublished, true))

    // Location filters
    if (params.city) {
        conditions.push(ilike(cafes.cityMunicipality, `%${params.city}%`))
    }

    if (params.province) {
        conditions.push(ilike(cafes.province, `%${params.province}%`))
    }

    if (params.region) {
        conditions.push(ilike(cafes.region, `%${params.region}%`))
    }

    if (params.area) {
        conditions.push(ilike(cafes.area, `%${params.area}%`))
    }

    // Amenities
    if (params.hasWifi !== undefined) {
        conditions.push(eq(cafes.hasWifi, params.hasWifi))
    }

    if (params.hasSockets !== undefined) {
        conditions.push(eq(cafes.hasSockets, params.hasSockets))
    }

    if (params.hasAircon !== undefined) {
        conditions.push(eq(cafes.hasAircon, params.hasAircon))
    }

    if (params.isPetFriendly !== undefined) {
        conditions.push(eq(cafes.isPetFriendly, params.isPetFriendly))
    }

    if (params.isWorkFriendly !== undefined) {
        conditions.push(eq(cafes.isWorkFriendly, params.isWorkFriendly))
    }

    if (params.servesFood !== undefined) {
        conditions.push(eq(cafes.servesFood, params.servesFood))
    }

    if (params.hasOutdoorSeating !== undefined) {
        conditions.push(eq(cafes.hasOutdoorSeating, params.hasOutdoorSeating))
    }

    // Pricing
    if (params.priceLevel) {
        conditions.push(eq(cafes.priceLevel, params.priceLevel))
    }

    if (params.coffeeStyle) {
        conditions.push(eq(cafes.coffeeStyle, params.coffeeStyle))
    }

    if (params.membershipTier) {
        conditions.push(eq(cafes.membershipTier, params.membershipTier))
    }

    // Status
    if (params.isHiddenGem !== undefined) {
        conditions.push(eq(cafes.isHiddenGem, params.isHiddenGem))
    }

    if (params.isChain !== undefined) {
        conditions.push(eq(cafes.isChain, params.isChain))
    }

    if (params.isHalalCertified !== undefined) {
        conditions.push(eq(cafes.isHalalCertified, params.isHalalCertified))
    }

    // Tags (array overlap)
    if (params.tags && params.tags.length > 0) {
        conditions.push(
            sql`${cafes.tags} && ARRAY[${sql.join(params.tags.map((t) => sql`${t}`), sql`, `)}]::text[]`
        )
    }

    if (params.brewMethods && params.brewMethods.length > 0) {
        conditions.push(
            sql`${cafes.brewMethods} && ARRAY[${sql.join(params.brewMethods.map((t) => sql`${t}`), sql`, `)}]::text[]`
        )
    }

    if (params.specialty && params.specialty.length > 0) {
        conditions.push(
            sql`${cafes.specialty} && ARRAY[${sql.join(params.specialty.map((t) => sql`${t}`), sql`, `)}]::text[]`
        )
    }

    if (params.milkOptions && params.milkOptions.length > 0) {
        conditions.push(
            sql`${cafes.milkOptions} && ARRAY[${sql.join(params.milkOptions.map((t) => sql`${t}`), sql`, `)}]::text[]`
        )
    }

    // Exclude chains by default unless explicitly requested
    if (params.isChain === undefined) {
        conditions.push(or(eq(cafes.isChain, false), isNull(cafes.isChain))!)
    }

    return conditions
}
