import { db } from "@/db"
import { cafes, cafeRatingStats } from "@/db/schema"
import { eq, and, desc, sql, count, isNotNull } from "drizzle-orm"
import { haversineKm, GeoPoint } from "./cafe-geo"
import { CafeWithRatings } from "@/utils/types/extra"

export interface CityCount {
    city: string
    province: string
    count: number
}

export interface CafeComparison {
    cafeA: CafeWithRatings | null
    cafeB: CafeWithRatings | null
}

export interface NearbyCafe extends CafeWithRatings {
    distanceKm: number
}

/**
 * List all cities with cafe counts, ordered by count descending
 */
export async function listCitiesWithCounts(): Promise<CityCount[]> {
    const results = await db
        .select({
            city: cafes.cityMunicipality,
            province: cafes.province,
            count: count(),
        })
        .from(cafes)
        .where(eq(cafes.isPublished, true))
        .groupBy(cafes.cityMunicipality, cafes.province)
        .orderBy(desc(count()))

    return results.map((r) => ({
        city: r.city,
        province: r.province,
        count: Number(r.count),
    }))
}

/**
 * Get a single cafe by its slug
 */
export async function getCafeBySlug(slug: string): Promise<CafeWithRatings | null> {
    const result = await db
        .select({
            id: cafes.id,
            name: cafes.name,
            slug: cafes.slug,
            thumbnail: cafes.thumbnail,
            description: cafes.description,
            addressDisplay: cafes.addressDisplay,
            area: cafes.area,
            cityMunicipality: cafes.cityMunicipality,
            province: cafes.province,
            region: cafes.region,
            lat: cafes.lat,
            lng: cafes.lng,
            priceLevel: cafes.priceLevel,
            coffeeStyle: cafes.coffeeStyle,
            membershipTier: cafes.membershipTier,
            roaster: cafes.roaster,
            brewMethods: cafes.brewMethods,
            specialty: cafes.specialty,
            milkOptions: cafes.milkOptions,
            tags: cafes.tags,
            operatingHours: cafes.operatingHours,
            socials: cafes.socials,
            phone: cafes.phone,
            email: cafes.email,
            websiteUrl: cafes.websiteUrl,
            paymentMethods: cafes.paymentMethods,
            hasWifi: cafes.hasWifi,
            hasSmoking: cafes.hasSmoking,
            hasSockets: cafes.hasSockets,
            hasAircon: cafes.hasAircon,
            hasParking: cafes.hasParking,
            hasOutdoorSeating: cafes.hasOutdoorSeating,
            hasIndoorSeating: cafes.hasIndoorSeating,
            hasRestroom: cafes.hasRestroom,
            hasBidet: cafes.hasBidet,
            hasNonDairy: cafes.hasNonDairy,
            hasDecaf: cafes.hasDecaf,
            isPetFriendly: cafes.isPetFriendly,
            isWorkFriendly: cafes.isWorkFriendly,
            servesFood: cafes.servesFood,
            isActive: cafes.isActive,
            isPublished: cafes.isPublished,
            isVerified: cafes.isVerified,
            isClaimed: cafes.isClaimed,
            ownerIds: cafes.ownerIds,
            contributorId: cafes.contributorId,
            featuredUntil: cafes.featuredUntil,
            isHiddenGem: cafes.isHiddenGem,
            findingHint: cafes.findingHint,
            isChain: cafes.isChain,
            isHalalCertified: cafes.isHalalCertified,
            strawType: cafes.strawType,
            strawTypeOther: cafes.strawTypeOther,
            createdAt: cafes.createdAt,
            updatedAt: cafes.updatedAt,
            averageRating: cafeRatingStats.averageRating,
            totalReviews: cafeRatingStats.totalReviews,
        })
        .from(cafes)
        .leftJoin(cafeRatingStats, eq(cafes.id, cafeRatingStats.cafeId))
        .where(eq(cafes.slug, slug))
        .limit(1)

    if (!result[0]) return null

    return mapToCafeWithRatings(result[0])
}

/**
 * Compare two cafes by their slugs
 */
export async function compareCafes(slugA: string, slugB: string): Promise<CafeComparison> {
    const [cafeA, cafeB] = await Promise.all([
        getCafeBySlug(slugA),
        getCafeBySlug(slugB),
    ])

    return { cafeA, cafeB }
}

/**
 * Get cafes near a location within a radius
 */
export async function getNearbyCafes(
    latLng: GeoPoint,
    radiusKm: number
): Promise<NearbyCafe[]> {
    // Fetch cafes with coordinates
    const results = await db
        .select({
            id: cafes.id,
            name: cafes.name,
            slug: cafes.slug,
            thumbnail: cafes.thumbnail,
            description: cafes.description,
            addressDisplay: cafes.addressDisplay,
            area: cafes.area,
            cityMunicipality: cafes.cityMunicipality,
            province: cafes.province,
            region: cafes.region,
            lat: cafes.lat,
            lng: cafes.lng,
            priceLevel: cafes.priceLevel,
            coffeeStyle: cafes.coffeeStyle,
            membershipTier: cafes.membershipTier,
            roaster: cafes.roaster,
            brewMethods: cafes.brewMethods,
            specialty: cafes.specialty,
            milkOptions: cafes.milkOptions,
            tags: cafes.tags,
            operatingHours: cafes.operatingHours,
            socials: cafes.socials,
            phone: cafes.phone,
            email: cafes.email,
            websiteUrl: cafes.websiteUrl,
            paymentMethods: cafes.paymentMethods,
            hasWifi: cafes.hasWifi,
            hasSmoking: cafes.hasSmoking,
            hasSockets: cafes.hasSockets,
            hasAircon: cafes.hasAircon,
            hasParking: cafes.hasParking,
            hasOutdoorSeating: cafes.hasOutdoorSeating,
            hasIndoorSeating: cafes.hasIndoorSeating,
            hasRestroom: cafes.hasRestroom,
            hasBidet: cafes.hasBidet,
            hasNonDairy: cafes.hasNonDairy,
            hasDecaf: cafes.hasDecaf,
            isPetFriendly: cafes.isPetFriendly,
            isWorkFriendly: cafes.isWorkFriendly,
            servesFood: cafes.servesFood,
            isActive: cafes.isActive,
            isPublished: cafes.isPublished,
            isVerified: cafes.isVerified,
            isClaimed: cafes.isClaimed,
            ownerIds: cafes.ownerIds,
            contributorId: cafes.contributorId,
            featuredUntil: cafes.featuredUntil,
            isHiddenGem: cafes.isHiddenGem,
            findingHint: cafes.findingHint,
            isChain: cafes.isChain,
            isHalalCertified: cafes.isHalalCertified,
            strawType: cafes.strawType,
            strawTypeOther: cafes.strawTypeOther,
            createdAt: cafes.createdAt,
            updatedAt: cafes.updatedAt,
            averageRating: cafeRatingStats.averageRating,
            totalReviews: cafeRatingStats.totalReviews,
        })
        .from(cafes)
        .leftJoin(cafeRatingStats, eq(cafes.id, cafeRatingStats.cafeId))
        .where(
            and(
                eq(cafes.isPublished, true),
                isNotNull(cafes.lat),
                isNotNull(cafes.lng)
            )
        )

    // Filter by distance and calculate distances
    const nearby = results
        .map((r) => ({
            ...mapToCafeWithRatings(r),
            distanceKm: haversineKm({ lat: r.lat!, lng: r.lng! }, latLng),
        }))
        .filter((cafe) => cafe.distanceKm <= radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm)

    return nearby
}

/**
 * Get top rated cafes in a city
 */
export async function getTopRatedCafes(
    city: string,
    limit: number = 10
): Promise<CafeWithRatings[]> {
    const results = await db
        .select({
            id: cafes.id,
            name: cafes.name,
            slug: cafes.slug,
            thumbnail: cafes.thumbnail,
            description: cafes.description,
            addressDisplay: cafes.addressDisplay,
            area: cafes.area,
            cityMunicipality: cafes.cityMunicipality,
            province: cafes.province,
            region: cafes.region,
            lat: cafes.lat,
            lng: cafes.lng,
            priceLevel: cafes.priceLevel,
            coffeeStyle: cafes.coffeeStyle,
            membershipTier: cafes.membershipTier,
            roaster: cafes.roaster,
            brewMethods: cafes.brewMethods,
            specialty: cafes.specialty,
            milkOptions: cafes.milkOptions,
            tags: cafes.tags,
            operatingHours: cafes.operatingHours,
            socials: cafes.socials,
            phone: cafes.phone,
            email: cafes.email,
            websiteUrl: cafes.websiteUrl,
            paymentMethods: cafes.paymentMethods,
            hasWifi: cafes.hasWifi,
            hasSmoking: cafes.hasSmoking,
            hasSockets: cafes.hasSockets,
            hasAircon: cafes.hasAircon,
            hasParking: cafes.hasParking,
            hasOutdoorSeating: cafes.hasOutdoorSeating,
            hasIndoorSeating: cafes.hasIndoorSeating,
            hasRestroom: cafes.hasRestroom,
            hasBidet: cafes.hasBidet,
            hasNonDairy: cafes.hasNonDairy,
            hasDecaf: cafes.hasDecaf,
            isPetFriendly: cafes.isPetFriendly,
            isWorkFriendly: cafes.isWorkFriendly,
            servesFood: cafes.servesFood,
            isActive: cafes.isActive,
            isPublished: cafes.isPublished,
            isVerified: cafes.isVerified,
            isClaimed: cafes.isClaimed,
            ownerIds: cafes.ownerIds,
            contributorId: cafes.contributorId,
            featuredUntil: cafes.featuredUntil,
            isHiddenGem: cafes.isHiddenGem,
            findingHint: cafes.findingHint,
            isChain: cafes.isChain,
            createdAt: cafes.createdAt,
            updatedAt: cafes.updatedAt,
            averageRating: cafeRatingStats.averageRating,
            totalReviews: cafeRatingStats.totalReviews,
        })
        .from(cafes)
        .leftJoin(cafeRatingStats, eq(cafes.id, cafeRatingStats.cafeId))
        .where(
            and(
                eq(cafes.isPublished, true),
                sql`LOWER(${cafes.cityMunicipality}) = LOWER(${city})`
            )
        )
        .orderBy(desc(cafeRatingStats.averageRating))
        .limit(limit)

    return results.map(mapToCafeWithRatings)
}

// Helper function to map database result to CafeWithRatings
function mapToCafeWithRatings(c: {
    id: string
    name: string
    slug: string
    thumbnail: string
    description: string | null
    addressDisplay: string
    area: string | null
    cityMunicipality: string
    province: string
    region: string
    lat: number | null
    lng: number | null
    priceLevel: string | null
    coffeeStyle: string | null
    membershipTier: string | null
    roaster: string | null
    brewMethods: string[] | null
    specialty: string[] | null
    milkOptions: string[] | null
    tags: string[] | null
    operatingHours: unknown
    socials: unknown
    phone: string | null
    email: string | null
    websiteUrl: string | null
    paymentMethods: string | null
    hasWifi: boolean | null
    hasSmoking: boolean | null
    hasSockets: boolean | null
    hasAircon: boolean | null
    hasParking: boolean | null
    hasOutdoorSeating: boolean | null
    hasIndoorSeating: boolean | null
    hasRestroom: boolean | null
    hasBidet: boolean | null
    hasNonDairy: boolean | null
    hasDecaf: boolean | null
    isPetFriendly: boolean | null
    isWorkFriendly: boolean | null
    servesFood: boolean | null
    isActive: boolean | null
    isPublished: boolean | null
    isVerified: boolean | null
    isClaimed: boolean | null
    ownerIds: string[] | null
    contributorId: string | null
    featuredUntil: Date | null
    isHiddenGem: boolean | null
    findingHint: string | null
    isChain: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
    averageRating: number | null
    totalReviews: number | null
}): CafeWithRatings {
    return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        thumbnail: c.thumbnail,
        description: c.description,
        address_display: c.addressDisplay,
        area: c.area,
        city_municipality: c.cityMunicipality,
        province: c.province,
        region: c.region,
        lat: c.lat,
        lng: c.lng,
        price_level: c.priceLevel,
        coffee_style: c.coffeeStyle,
        membership_tier: c.membershipTier,
        roaster: c.roaster,
        brew_methods: c.brewMethods,
        specialty: c.specialty,
        milk_options: c.milkOptions,
        tags: c.tags,
        operating_hours: c.operatingHours as { day: string; open: string; close: string; is_24_hours: boolean }[] | null,
        socials: c.socials as { platform: string; url: string }[] | null,
        phone: c.phone,
        email: c.email,
        website_url: c.websiteUrl,
        payment_methods: c.paymentMethods,
        has_wifi: c.hasWifi,
        has_smoking: c.hasSmoking,
        has_sockets: c.hasSockets,
        has_aircon: c.hasAircon,
        has_parking: c.hasParking,
        has_outdoor_seating: c.hasOutdoorSeating,
        has_indoor_seating: c.hasIndoorSeating,
        has_restroom: c.hasRestroom,
        has_bidet: c.hasBidet,
        has_non_dairy: c.hasNonDairy,
        has_decaf: c.hasDecaf,
        is_pet_friendly: c.isPetFriendly,
        is_work_friendly: c.isWorkFriendly,
        serves_food: c.servesFood,
        is_active: c.isActive,
        is_published: c.isPublished,
        is_verified: c.isVerified,
        is_claimed: c.isClaimed,
        owner_ids: c.ownerIds,
        contributor_id: c.contributorId,
        featured_until: c.featuredUntil?.toISOString() ?? null,
        is_hidden_gem: c.isHiddenGem ?? false,
        finding_hint: c.findingHint ?? null,
        is_chain: c.isChain ?? false,
        created_at: c.createdAt?.toISOString() ?? null,
        updated_at: c.updatedAt?.toISOString() ?? null,
        average_rating: c.averageRating ?? null,
        total_reviews: c.totalReviews ?? null,
    } as CafeWithRatings
}
