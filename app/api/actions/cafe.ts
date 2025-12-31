"use server"

import { db } from "@/db"
import { cafes, cafeRatingStats, cafeStories, profiles, reviews, reviewInteractions, ownerReviewResponses, featuredSchedules } from "@/db/schema"
import { eq, and, desc, gte, lte, ne, isNull, ilike, count, sql, inArray } from "drizzle-orm"
import { getDayOfYear } from "@/utils/featured"
import { CafeFilters, CafeWithRatings } from "@/utils/types/extra"

// Helper to map Drizzle result to snake_case CafeWithRatings
function mapCafeToSnakeCase(c: {
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
    lat: number
    lng: number
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
    createdAt: Date | null
    updatedAt: Date | null
    averageRating?: number | null
    totalReviews?: number | null
}, story?: { content: string } | null, contributor?: { id: string; username: string; displayName: string; avatarUrl: string | null } | null): CafeWithRatings {
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
        operating_hours: c.operatingHours,
        socials: c.socials,
        phone: c.phone,
        email: c.email,
        website_url: c.websiteUrl,
        payment_methods: c.paymentMethods,
        has_wifi: c.hasWifi,
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
        created_at: c.createdAt?.toISOString() ?? null,
        updated_at: c.updatedAt?.toISOString() ?? null,
        average_rating: c.averageRating ?? null,
        total_reviews: c.totalReviews ?? null,
        story: story ? { content: story.content } : null,
        contributor: contributor ? {
            id: contributor.id,
            username: contributor.username,
            display_name: contributor.displayName,
            avatar_url: contributor.avatarUrl,
        } : null,
    } as unknown as CafeWithRatings
}

export async function getCafeBySlug(slug: string) {
    // Get cafe with rating stats
    const cafeResult = await db
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
            createdAt: cafes.createdAt,
            updatedAt: cafes.updatedAt,
            averageRating: cafeRatingStats.averageRating,
            totalReviews: cafeRatingStats.totalReviews,
            gallery: cafes.gallery,
        })
        .from(cafes)
        .leftJoin(cafeRatingStats, eq(cafes.id, cafeRatingStats.cafeId))
        .where(eq(cafes.slug, slug))
        .limit(1)

    const cafe = cafeResult[0]
    if (!cafe) return null

    // Get story and contributor in parallel
    const [storyResult, contributorResult] = await Promise.all([
        db.select({ content: cafeStories.content })
            .from(cafeStories)
            .where(eq(cafeStories.cafeId, cafe.id))
            .limit(1),
        cafe.contributorId
            ? db.select({
                id: profiles.id,
                username: profiles.username,
                displayName: profiles.displayName,
                avatarUrl: profiles.avatarUrl,
            })
                .from(profiles)
                .where(eq(profiles.id, cafe.contributorId))
                .limit(1)
            : Promise.resolve([]),
    ])

    const result = mapCafeToSnakeCase(cafe, storyResult[0], contributorResult[0])
        // Add gallery
        ; (result as CafeWithRatings & { gallery: string[] | null }).gallery = cafe.gallery
    return result
}

export async function getDailyFeatured() {
    const now = new Date()

    // 1. Priority: Manual Schedule
    const scheduledResult = await db
        .select({
            cafeId: featuredSchedules.cafeId,
        })
        .from(featuredSchedules)
        .where(
            and(
                eq(featuredSchedules.slotType, "hero"),
                eq(featuredSchedules.isActive, true),
                lte(featuredSchedules.startDate, now),
                gte(featuredSchedules.endDate, now)
            )
        )
        .orderBy(desc(featuredSchedules.priority))
        .limit(1)

    if (scheduledResult[0]?.cafeId) {
        const cafeResult = await db
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
                createdAt: cafes.createdAt,
                updatedAt: cafes.updatedAt,
                averageRating: cafeRatingStats.averageRating,
                totalReviews: cafeRatingStats.totalReviews,
            })
            .from(cafes)
            .leftJoin(cafeRatingStats, eq(cafes.id, cafeRatingStats.cafeId))
            .where(eq(cafes.id, scheduledResult[0].cafeId))
            .limit(1)

        if (cafeResult[0]) {
            return mapCafeToSnakeCase(cafeResult[0])
        }
    }

    // 2. Fallback: Algorithmic Selection
    const cafesResult = await db
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
            createdAt: cafes.createdAt,
            updatedAt: cafes.updatedAt,
            averageRating: cafeRatingStats.averageRating,
            totalReviews: cafeRatingStats.totalReviews,
        })
        .from(cafes)
        .leftJoin(cafeRatingStats, eq(cafes.id, cafeRatingStats.cafeId))
        .where(and(eq(cafes.isPublished, true), ne(cafes.thumbnail, "placeholder")))
        .orderBy(desc(cafeRatingStats.averageRating))
        .limit(10)

    if (!cafesResult.length) return null

    const dayOfYear = getDayOfYear(new Date())
    const selected = cafesResult[dayOfYear % cafesResult.length]

    return mapCafeToSnakeCase(selected)
}

/**
 * Get featured cafe based on user's location
 */
export async function getLocationFeatured(city?: string, region?: string): Promise<CafeWithRatings | null> {
    if (!city && !region) return null

    const now = new Date()
    const dayOfYear = getDayOfYear(new Date())

    // Check schedules in order: city, region, global
    const scheduleConditions = []
    if (city) {
        scheduleConditions.push(ilike(featuredSchedules.regionContext, city))
    }
    if (region) {
        scheduleConditions.push(ilike(featuredSchedules.regionContext, `%${region}%`))
    }
    scheduleConditions.push(isNull(featuredSchedules.regionContext))

    for (const condition of scheduleConditions) {
        const scheduledResult = await db
            .select({ cafeId: featuredSchedules.cafeId })
            .from(featuredSchedules)
            .where(
                and(
                    eq(featuredSchedules.slotType, "hero"),
                    eq(featuredSchedules.isActive, true),
                    condition,
                    lte(featuredSchedules.startDate, now),
                    gte(featuredSchedules.endDate, now)
                )
            )
            .orderBy(desc(featuredSchedules.priority))
            .limit(1)

        if (scheduledResult[0]?.cafeId) {
            const cafeResult = await db
                .select({
                    id: cafes.id, name: cafes.name, slug: cafes.slug, thumbnail: cafes.thumbnail,
                    description: cafes.description, addressDisplay: cafes.addressDisplay, area: cafes.area,
                    cityMunicipality: cafes.cityMunicipality, province: cafes.province, region: cafes.region,
                    lat: cafes.lat, lng: cafes.lng, priceLevel: cafes.priceLevel, coffeeStyle: cafes.coffeeStyle,
                    membershipTier: cafes.membershipTier, roaster: cafes.roaster, brewMethods: cafes.brewMethods,
                    specialty: cafes.specialty, milkOptions: cafes.milkOptions, tags: cafes.tags,
                    operatingHours: cafes.operatingHours, socials: cafes.socials, phone: cafes.phone,
                    email: cafes.email, websiteUrl: cafes.websiteUrl, paymentMethods: cafes.paymentMethods,
                    hasWifi: cafes.hasWifi, hasSockets: cafes.hasSockets, hasAircon: cafes.hasAircon,
                    hasParking: cafes.hasParking, hasOutdoorSeating: cafes.hasOutdoorSeating,
                    hasIndoorSeating: cafes.hasIndoorSeating, hasRestroom: cafes.hasRestroom,
                    hasBidet: cafes.hasBidet, hasNonDairy: cafes.hasNonDairy, hasDecaf: cafes.hasDecaf, isPetFriendly: cafes.isPetFriendly,
                    isWorkFriendly: cafes.isWorkFriendly, servesFood: cafes.servesFood, isActive: cafes.isActive,
                    isPublished: cafes.isPublished, isVerified: cafes.isVerified, isClaimed: cafes.isClaimed,
                    ownerIds: cafes.ownerIds, contributorId: cafes.contributorId, featuredUntil: cafes.featuredUntil,
                    createdAt: cafes.createdAt, updatedAt: cafes.updatedAt,
                    averageRating: cafeRatingStats.averageRating, totalReviews: cafeRatingStats.totalReviews,
                })
                .from(cafes)
                .leftJoin(cafeRatingStats, eq(cafes.id, cafeRatingStats.cafeId))
                .where(eq(cafes.id, scheduledResult[0].cafeId))
                .limit(1)

            if (cafeResult[0]) return mapCafeToSnakeCase(cafeResult[0])
        }
    }

    // Algorithmic fallback
    if (city) {
        const cityCafes = await db
            .select({
                id: cafes.id, name: cafes.name, slug: cafes.slug, thumbnail: cafes.thumbnail,
                description: cafes.description, addressDisplay: cafes.addressDisplay, area: cafes.area,
                cityMunicipality: cafes.cityMunicipality, province: cafes.province, region: cafes.region,
                lat: cafes.lat, lng: cafes.lng, priceLevel: cafes.priceLevel, coffeeStyle: cafes.coffeeStyle,
                membershipTier: cafes.membershipTier, roaster: cafes.roaster, brewMethods: cafes.brewMethods,
                specialty: cafes.specialty, milkOptions: cafes.milkOptions, tags: cafes.tags,
                operatingHours: cafes.operatingHours, socials: cafes.socials, phone: cafes.phone,
                email: cafes.email, websiteUrl: cafes.websiteUrl, paymentMethods: cafes.paymentMethods,
                hasWifi: cafes.hasWifi, hasSockets: cafes.hasSockets, hasAircon: cafes.hasAircon,
                hasParking: cafes.hasParking, hasOutdoorSeating: cafes.hasOutdoorSeating,
                hasIndoorSeating: cafes.hasIndoorSeating, hasRestroom: cafes.hasRestroom,
                hasBidet: cafes.hasBidet, hasNonDairy: cafes.hasNonDairy, hasDecaf: cafes.hasDecaf, isPetFriendly: cafes.isPetFriendly,
                isWorkFriendly: cafes.isWorkFriendly, servesFood: cafes.servesFood, isActive: cafes.isActive,
                isPublished: cafes.isPublished, isVerified: cafes.isVerified, isClaimed: cafes.isClaimed,
                ownerIds: cafes.ownerIds, contributorId: cafes.contributorId, featuredUntil: cafes.featuredUntil,
                createdAt: cafes.createdAt, updatedAt: cafes.updatedAt,
                averageRating: cafeRatingStats.averageRating, totalReviews: cafeRatingStats.totalReviews,
            })
            .from(cafes)
            .leftJoin(cafeRatingStats, eq(cafes.id, cafeRatingStats.cafeId))
            .where(and(eq(cafes.isPublished, true), ne(cafes.thumbnail, "placeholder"), ilike(cafes.cityMunicipality, `%${city}%`)))
            .orderBy(desc(cafeRatingStats.averageRating))
            .limit(10)

        if (cityCafes.length) {
            return mapCafeToSnakeCase(cityCafes[dayOfYear % cityCafes.length])
        }
    }

    if (region) {
        const regionCafes = await db
            .select({
                id: cafes.id, name: cafes.name, slug: cafes.slug, thumbnail: cafes.thumbnail,
                description: cafes.description, addressDisplay: cafes.addressDisplay, area: cafes.area,
                cityMunicipality: cafes.cityMunicipality, province: cafes.province, region: cafes.region,
                lat: cafes.lat, lng: cafes.lng, priceLevel: cafes.priceLevel, coffeeStyle: cafes.coffeeStyle,
                membershipTier: cafes.membershipTier, roaster: cafes.roaster, brewMethods: cafes.brewMethods,
                specialty: cafes.specialty, milkOptions: cafes.milkOptions, tags: cafes.tags,
                operatingHours: cafes.operatingHours, socials: cafes.socials, phone: cafes.phone,
                email: cafes.email, websiteUrl: cafes.websiteUrl, paymentMethods: cafes.paymentMethods,
                hasWifi: cafes.hasWifi, hasSockets: cafes.hasSockets, hasAircon: cafes.hasAircon,
                hasParking: cafes.hasParking, hasOutdoorSeating: cafes.hasOutdoorSeating,
                hasIndoorSeating: cafes.hasIndoorSeating, hasRestroom: cafes.hasRestroom,
                hasBidet: cafes.hasBidet, hasNonDairy: cafes.hasNonDairy, hasDecaf: cafes.hasDecaf, isPetFriendly: cafes.isPetFriendly,
                isWorkFriendly: cafes.isWorkFriendly, servesFood: cafes.servesFood, isActive: cafes.isActive,
                isPublished: cafes.isPublished, isVerified: cafes.isVerified, isClaimed: cafes.isClaimed,
                ownerIds: cafes.ownerIds, contributorId: cafes.contributorId, featuredUntil: cafes.featuredUntil,
                createdAt: cafes.createdAt, updatedAt: cafes.updatedAt,
                averageRating: cafeRatingStats.averageRating, totalReviews: cafeRatingStats.totalReviews,
            })
            .from(cafes)
            .leftJoin(cafeRatingStats, eq(cafes.id, cafeRatingStats.cafeId))
            .where(and(eq(cafes.isPublished, true), ne(cafes.thumbnail, "placeholder"), ilike(cafes.region, `%${region}%`)))
            .orderBy(desc(cafeRatingStats.averageRating))
            .limit(10)

        if (regionCafes.length) {
            return mapCafeToSnakeCase(regionCafes[dayOfYear % regionCafes.length])
        }
    }

    return null
}

export async function getAllCafes(
    page: number = 1,
    limit: number = 12,
    filters: CafeFilters = {}
) {
    const offset = (page - 1) * limit

    // Use RPC for Full-Text Search if query exists
    if (filters.search) {
        const searchResults = await db.execute(sql`SELECT * FROM search_cafes(${filters.search})`)
        const rows = searchResults.rows as { id: string; name: string; slug: string; thumbnail: string; city_municipality: string; region: string; address_display: string; price_level: string }[]
        return rows.slice(offset, offset + limit).map(c => ({
            ...c,
            average_rating: null,
            total_reviews: null,
        })) as CafeWithRatings[]
    }

    // Build query conditions
    const conditions = [eq(cafes.isPublished, true)]
    if (filters.has_wifi) conditions.push(eq(cafes.hasWifi, true))
    if (filters.has_sockets) conditions.push(eq(cafes.hasSockets, true))
    if (filters.has_parking) conditions.push(eq(cafes.hasParking, true))
    if (filters.has_aircon) conditions.push(eq(cafes.hasAircon, true))
    if (filters.is_pet_friendly) conditions.push(eq(cafes.isPetFriendly, true))
    if (filters.has_outdoor_seating) conditions.push(eq(cafes.hasOutdoorSeating, true))
    if (filters.has_indoor_seating) conditions.push(eq(cafes.hasIndoorSeating, true))
    if (filters.has_restroom) conditions.push(eq(cafes.hasRestroom, true))
    if (filters.has_bidet) conditions.push(eq(cafes.hasBidet, true))
    if (filters.has_non_dairy) conditions.push(eq(cafes.hasNonDairy, true))
    if (filters.has_decaf) conditions.push(eq(cafes.hasDecaf, true))
    if (filters.is_work_friendly) conditions.push(eq(cafes.isWorkFriendly, true))
    if (filters.price_level) conditions.push(eq(cafes.priceLevel, filters.price_level))
    if (filters.coffee_style) conditions.push(eq(cafes.coffeeStyle, filters.coffee_style))
    if (filters.region) conditions.push(eq(cafes.region, filters.region))
    if (filters.tags && filters.tags.length > 0) {
        // Match cafes that have any of the specified tags using PostgreSQL array overlap
        conditions.push(sql`${cafes.tags} && ARRAY[${sql.join(filters.tags.map(t => sql`${t}`), sql`, `)}]::text[]`)
    }

    // Determine ordering
    let orderBy
    switch (filters.sortBy) {
        case "rating":
            orderBy = [desc(cafes.membershipTier), desc(cafeRatingStats.averageRating)]
            break
        case "reviews":
            orderBy = [desc(cafes.membershipTier), desc(cafeRatingStats.totalReviews)]
            break
        default:
            orderBy = [desc(cafes.membershipTier), desc(cafes.createdAt)]
    }

    const cafesResult = await db
        .select({
            id: cafes.id, name: cafes.name, slug: cafes.slug, thumbnail: cafes.thumbnail,
            description: cafes.description, addressDisplay: cafes.addressDisplay, area: cafes.area,
            cityMunicipality: cafes.cityMunicipality, province: cafes.province, region: cafes.region,
            lat: cafes.lat, lng: cafes.lng, priceLevel: cafes.priceLevel, coffeeStyle: cafes.coffeeStyle,
            membershipTier: cafes.membershipTier, roaster: cafes.roaster, brewMethods: cafes.brewMethods,
            specialty: cafes.specialty, milkOptions: cafes.milkOptions, tags: cafes.tags,
            operatingHours: cafes.operatingHours, socials: cafes.socials, phone: cafes.phone,
            email: cafes.email, websiteUrl: cafes.websiteUrl, paymentMethods: cafes.paymentMethods,
            hasWifi: cafes.hasWifi, hasSockets: cafes.hasSockets, hasAircon: cafes.hasAircon,
            hasParking: cafes.hasParking, hasOutdoorSeating: cafes.hasOutdoorSeating,
            hasIndoorSeating: cafes.hasIndoorSeating, hasRestroom: cafes.hasRestroom,
            hasBidet: cafes.hasBidet, hasNonDairy: cafes.hasNonDairy, hasDecaf: cafes.hasDecaf, isPetFriendly: cafes.isPetFriendly,
            isWorkFriendly: cafes.isWorkFriendly, servesFood: cafes.servesFood, isActive: cafes.isActive,
            isPublished: cafes.isPublished, isVerified: cafes.isVerified, isClaimed: cafes.isClaimed,
            ownerIds: cafes.ownerIds, contributorId: cafes.contributorId, featuredUntil: cafes.featuredUntil,
            createdAt: cafes.createdAt, updatedAt: cafes.updatedAt,
            averageRating: cafeRatingStats.averageRating, totalReviews: cafeRatingStats.totalReviews,
        })
        .from(cafes)
        .leftJoin(cafeRatingStats, eq(cafes.id, cafeRatingStats.cafeId))
        .where(and(...conditions))
        .orderBy(...orderBy)
        .limit(limit)
        .offset(offset)

    return cafesResult.map(c => mapCafeToSnakeCase(c))
}

/**
 * Get reviews for a specific cafe
 */
export async function getReviewsByCafeId(cafeId: string) {
    const reviewsResult = await db
        .select({
            id: reviews.id,
            rating: reviews.rating,
            comment: reviews.comment,
            createdAt: reviews.createdAt,
            userId: reviews.userId,
            images: reviews.images,
            likesCount: reviews.likesCount,
            isEdited: reviews.isEdited,
            isPinnedByOwner: reviews.isPinnedByOwner,
            pinnedAt: reviews.pinnedAt,
            authorDisplayName: profiles.displayName,
            authorUsername: profiles.username,
            authorAvatarUrl: profiles.avatarUrl,
        })
        .from(reviews)
        .leftJoin(profiles, eq(reviews.userId, profiles.id))
        .where(and(eq(reviews.cafeId, cafeId), eq(reviews.status, "published")))
        .orderBy(desc(reviews.isPinnedByOwner), desc(reviews.createdAt))

    // Get interactions and owner responses for these reviews
    const reviewIds = reviewsResult.map(r => r.id)
    if (reviewIds.length === 0) return []

    const [interactionsResult, responsesResult] = await Promise.all([
        db.select({ reviewId: reviewInteractions.reviewId, userId: reviewInteractions.userId, interactionType: reviewInteractions.interactionType })
            .from(reviewInteractions)
            .where(inArray(reviewInteractions.reviewId, reviewIds)),
        db.select({
            reviewId: ownerReviewResponses.reviewId,
            id: ownerReviewResponses.id,
            response: ownerReviewResponses.response,
            createdAt: ownerReviewResponses.createdAt,
            updatedAt: ownerReviewResponses.updatedAt,
            ownerId: ownerReviewResponses.ownerId,
            ownerDisplayName: profiles.displayName,
            ownerAvatarUrl: profiles.avatarUrl,
        })
            .from(ownerReviewResponses)
            .leftJoin(profiles, eq(ownerReviewResponses.ownerId, profiles.id))
            .where(inArray(ownerReviewResponses.reviewId, reviewIds)),
    ])

    const interactionsMap = new Map<string, { user_id: string; interaction_type: string }[]>()
    for (const i of interactionsResult) {
        if (!interactionsMap.has(i.reviewId)) interactionsMap.set(i.reviewId, [])
        interactionsMap.get(i.reviewId)!.push({ user_id: i.userId, interaction_type: i.interactionType })
    }

    const responsesMap = new Map<string, { id: string; response_text: string; created_at: string | null; updated_at: string | null; owner: { display_name: string; avatar_url: string | null } }>()
    for (const r of responsesResult) {
        responsesMap.set(r.reviewId, {
            id: r.id,
            response_text: r.response,
            created_at: r.createdAt?.toISOString() ?? null,
            updated_at: r.updatedAt?.toISOString() ?? null,
            owner: { display_name: r.ownerDisplayName ?? "", avatar_url: r.ownerAvatarUrl },
        })
    }

    return reviewsResult.map(r => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        created_at: r.createdAt?.toISOString() ?? null,
        user_id: r.userId,
        images: r.images,
        likes_count: r.likesCount ?? 0,
        is_edited: r.isEdited ?? false,
        is_pinned_by_owner: r.isPinnedByOwner ?? false,
        pinned_at: r.pinnedAt?.toISOString() ?? null,
        review_interactions: interactionsMap.get(r.id) || [],
        author: { display_name: r.authorDisplayName ?? "", username: r.authorUsername ?? "", avatar_url: r.authorAvatarUrl },
        owner_response: responsesMap.get(r.id) || null,
    }))
}

/**
 * Get the count of published cafes
 */
export async function getPublishedCafeCount(): Promise<number> {
    const result = await db.select({ count: count() }).from(cafes).where(eq(cafes.isPublished, true))
    return result[0]?.count ?? 0
}

/**
 * Simple search for cafe name existence check during submission
 */
export async function searchCafesSimple(query: string) {
    if (!query || query.length < 3) return []

    const result = await db
        .select({
            id: cafes.id,
            name: cafes.name,
            slug: cafes.slug,
            address_display: cafes.addressDisplay,
            thumbnail: cafes.thumbnail,
            is_published: cafes.isPublished,
        })
        .from(cafes)
        .where(ilike(cafes.name, `%${query}%`))
        .limit(5)

    return result
}