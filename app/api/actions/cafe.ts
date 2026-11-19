"use server"

import { toStoredThumbnail } from "@/utils/extras"
import { db } from "@/db"
import { PLACEHOLDER_THUMBNAIL } from "@/utils/extras"
import { getCurrentUser } from "@/lib/auth"
import { cafes, cafeRatingStats, cafeStories, profiles, reviews, reviewInteractions, ownerReviewResponses, featuredSchedules } from "@/db/schema"
import { eq, and, or, desc, gte, lte, ne, isNull, ilike, count, sql, inArray, SQL } from "drizzle-orm"
import { getManilaDayOfYear, getManilaWeekdayKey } from "@/utils/date/leaderboard-months"
import { CafeFilters, CafeWithRatings } from "@/utils/types/extra"
import { omitTestCafes, publicCafeConditions } from "@/utils/filters"
import { parsePaymentMethodFilter } from "@/utils/payment-methods"

/** The Manila weekday a filter applies to. */
function getCurrentDayKey(): "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun" {
    return getManilaWeekdayKey()
}

// Helper to check if a cafe is open 24 hours on a specific day
function isCafe24hForDay(operatingHours: unknown, dayKey: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"): boolean {
    if (!operatingHours || !Array.isArray(operatingHours)) {
        return false
    }
    const dayHours = operatingHours.find((hour) => hour && typeof hour === "object" && (hour as { day?: string }).day === dayKey)
    return dayHours !== undefined && (dayHours as { is_24_hours?: boolean }).is_24_hours === true
}

// Helper to map Drizzle result to snake_case CafeWithRatings
function mapCafeToSnakeCase(c: {
    id: string
    name: string
    slug: string
    thumbnail: string | null
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
    isHiddenGem?: boolean | null
    findingHint?: string | null
    isChain?: boolean | null
    strawType?: string | null
    strawTypeOther?: string | null
    isHalalCertified?: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
    averageRating?: number | null
    totalReviews?: number | null
}, story?: { content: string } | null, contributor?: { id: string; username: string; displayName: string; avatarUrl: string | null } | null): CafeWithRatings {
    return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        thumbnail: toStoredThumbnail(c.thumbnail),
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
        is_halal_certified: c.isHalalCertified ?? false,
        straw_type: c.strawType ?? '',
        straw_type_other: c.strawTypeOther ?? '',
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

export async function getCafeBySlug(slug: string, options: { includeTest?: boolean; includeUnpublished?: boolean } = {}) {
    const { includeTest = false, includeUnpublished = false } = options

    const conditions: (SQL<unknown> | undefined)[] = [
        eq(cafes.slug, slug),
        ...publicCafeConditions({ includeDrafts: includeUnpublished, includeTest }),
    ]

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
            gallery: cafes.gallery,
        })
        .from(cafes)
        .leftJoin(cafeRatingStats, eq(cafes.id, cafeRatingStats.cafeId))
        .where(and(...conditions))
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
    // The schedule window is stored as timestamptz, so it is compared against the
    // real instant. It used to be compared against a Manila-shifted `Date`, which
    // made a slot start eight hours early on a UTC server.
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
                createdAt: cafes.createdAt,
                updatedAt: cafes.updatedAt,
                averageRating: cafeRatingStats.averageRating,
                totalReviews: cafeRatingStats.totalReviews,
            })
            .from(cafes)
            .leftJoin(cafeRatingStats, eq(cafes.id, cafeRatingStats.cafeId))
            .where(and(
                eq(cafes.id, scheduledResult[0].cafeId),
                or(eq(cafes.isChain, false), isNull(cafes.isChain)),
                // A scheduled slot is admin-created; the cafe it points at still
                // has to be a catalogue cafe. This branch used to render whatever
                // the schedule named on the landing hero.
                ...publicCafeConditions()
            ))
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
            createdAt: cafes.createdAt,
            updatedAt: cafes.updatedAt,
            averageRating: cafeRatingStats.averageRating,
            totalReviews: cafeRatingStats.totalReviews,
        })
        .from(cafes)
        .leftJoin(cafeRatingStats, eq(cafes.id, cafeRatingStats.cafeId))
        .where(and(eq(cafes.isHiddenGem, false), eq(cafes.isChain, false), ne(cafes.thumbnail, "placeholder"), ...publicCafeConditions()))
        .orderBy(desc(cafeRatingStats.averageRating))
        .limit(10)

    if (!cafesResult.length) return null

    const dayOfYear = getManilaDayOfYear()
    const selected = cafesResult[dayOfYear % cafesResult.length]

    return mapCafeToSnakeCase(selected)
}

/**
 * Get featured cafe based on user's location
 */
export async function getLocationFeatured(city?: string, region?: string): Promise<CafeWithRatings | null> {
    if (!city && !region) return null

    const now = new Date()
    const dayOfYear = getManilaDayOfYear()

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
                    roaster: cafes.roaster, brewMethods: cafes.brewMethods,
                    specialty: cafes.specialty, milkOptions: cafes.milkOptions, tags: cafes.tags,
                    operatingHours: cafes.operatingHours, socials: cafes.socials, phone: cafes.phone,
                    email: cafes.email, websiteUrl: cafes.websiteUrl, paymentMethods: cafes.paymentMethods,
                    hasWifi: cafes.hasWifi, hasSmoking: cafes.hasSmoking, hasSockets: cafes.hasSockets, hasAircon: cafes.hasAircon,
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
                .where(and(
                eq(cafes.id, scheduledResult[0].cafeId),
                or(eq(cafes.isChain, false), isNull(cafes.isChain)),
                // A scheduled slot is admin-created; the cafe it points at still
                // has to be a catalogue cafe. This branch used to render whatever
                // the schedule named on the landing hero.
                ...publicCafeConditions()
            ))
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
                roaster: cafes.roaster, brewMethods: cafes.brewMethods,
                specialty: cafes.specialty, milkOptions: cafes.milkOptions, tags: cafes.tags,
                operatingHours: cafes.operatingHours, socials: cafes.socials, phone: cafes.phone,
                email: cafes.email, websiteUrl: cafes.websiteUrl, paymentMethods: cafes.paymentMethods,
                hasWifi: cafes.hasWifi, hasSmoking: cafes.hasSmoking, hasSockets: cafes.hasSockets, hasAircon: cafes.hasAircon,
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
            .where(and(eq(cafes.isHiddenGem, false), eq(cafes.isChain, false), ne(cafes.thumbnail, "placeholder"), ilike(cafes.cityMunicipality, `%${city}%`), ...publicCafeConditions()))
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
                roaster: cafes.roaster, brewMethods: cafes.brewMethods,
                specialty: cafes.specialty, milkOptions: cafes.milkOptions, tags: cafes.tags,
                operatingHours: cafes.operatingHours, socials: cafes.socials, phone: cafes.phone,
                email: cafes.email, websiteUrl: cafes.websiteUrl, paymentMethods: cafes.paymentMethods,
                hasWifi: cafes.hasWifi, hasSmoking: cafes.hasSmoking, hasSockets: cafes.hasSockets, hasAircon: cafes.hasAircon,
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
            .where(and(eq(cafes.isHiddenGem, false), eq(cafes.isChain, false), ne(cafes.thumbnail, "placeholder"), ilike(cafes.region, `%${region}%`), ...publicCafeConditions()))
            .orderBy(desc(cafeRatingStats.averageRating))
            .limit(10)

        if (regionCafes.length) {
            return mapCafeToSnakeCase(regionCafes[dayOfYear % regionCafes.length])
        }
    }

    return null
}

/**
 * The column set a cafe card needs. Shared by the search path and its ILIKE
 * fallback so the two cannot drift — they used to select different columns, and
 * one of them hand-mapped the result while the other used `mapCafeToSnakeCase`.
 */
const cafeListColumns = {
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
} as const

export async function getAllCafes(
    page: number = 1,
    limit: number = 12,
    filters: CafeFilters = {}
) {
    const offset = (page - 1) * limit

    // Full-text search, built here rather than through the `search_cafes`
    // Postgres function. That function was `select * from cafes where
    // search_vector @@ ... and is_published = true`: it could not carry the
    // public visibility rules, it returned every column including `is_test`, and
    // it never joined the rating stats, so search results always showed a null
    // rating. Building the query here puts `publicCafeConditions()` in the same
    // `where`, selects named columns, and joins the stats.
    if (filters.search) {
        const term = filters.search
        const tsQuery = sql`plainto_tsquery('english', ${term})`

        const fullTextResults = await db
            .select(cafeListColumns)
            .from(cafes)
            .leftJoin(cafeRatingStats, eq(cafes.id, cafeRatingStats.cafeId))
            .where(
                and(
                    sql`${cafes.searchVector} @@ ${tsQuery}`,
                    filters.isHalalCertified ? eq(cafes.isHalalCertified, true) : undefined,
                    ...publicCafeConditions()
                )
            )
            .orderBy(sql`ts_rank(${cafes.searchVector}, ${tsQuery}) DESC`)
            .limit(limit)
            .offset(offset)

        type CafeListRow = Parameters<typeof mapCafeToSnakeCase>[0]

        const applyPostFilters = (cafes_: CafeListRow[]) => {
            let result = cafes_
            if (filters.is_24_7) {
                const currentDay = getCurrentDayKey()
                result = result.filter(cafe =>
                    isCafe24hForDay(cafe.operatingHours, currentDay)
                )
            }
            if (filters.isHalalCertified) {
                result = result.filter(cafe => cafe.isHalalCertified === true)
            }
            return result.map(cafe => mapCafeToSnakeCase(cafe))
        }

        if (fullTextResults.length > 0) {
            return applyPostFilters(fullTextResults)
        }

        // If full-text search returns no results, fallback to ILIKE search on name
        const ilikeTerm = `%${filters.search}%`

        const fallbackResults = await db
            .select(cafeListColumns)
            .from(cafes)
            .leftJoin(cafeRatingStats, eq(cafes.id, cafeRatingStats.cafeId))
            .where(and(ilike(cafes.name, ilikeTerm), ...publicCafeConditions()))
            .orderBy(desc(cafes.createdAt))
            .limit(limit)
            .offset(offset)

        return applyPostFilters(fallbackResults)
    }

    // Build query conditions
    const conditions = publicCafeConditions()

    // Payment methods live in a comma-separated text column, so match whole
    // tokens rather than substrings — a LIKE '%card%' would also hit unrelated
    // custom values an owner typed in. Several selected methods mean "takes any
    // of these", matching the existing vibes filter.
    const paymentMethods = parsePaymentMethodFilter(filters.payment_methods)
    if (paymentMethods.length > 0) {
        const tokenConditions = paymentMethods.map(
            (method) =>
                sql`string_to_array(coalesce(${cafes.paymentMethods}, ''), ', ') @> ARRAY[${method}]::text[]`
        )
        const anyPaymentMethod = or(...tokenConditions)
        if (anyPaymentMethod) conditions.push(anyPaymentMethod)
    }

    if (filters.has_wifi) conditions.push(eq(cafes.hasWifi, true))
    if (filters.has_smoking) conditions.push(eq(cafes.hasSmoking, true))

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
    // near_me filter - filter by city, province, or region
    if (filters.near_me) {
        const locationConditions: ReturnType<typeof sql>[] = []
        if (filters.near_me.city) {
            locationConditions.push(sql`${cafes.cityMunicipality} ILIKE ${'%' + filters.near_me.city + '%'}`)
            locationConditions.push(sql`${cafes.province} ILIKE ${'%' + filters.near_me.city + '%'}`)
        }
        if (filters.near_me.province) {
            locationConditions.push(sql`${cafes.province} ILIKE ${'%' + filters.near_me.province + '%'}`)
            locationConditions.push(sql`${cafes.region} ILIKE ${'%' + filters.near_me.province + '%'}`)
        }
        if (filters.near_me.region) {
            locationConditions.push(sql`${cafes.region} ILIKE ${'%' + filters.near_me.region + '%'}`)
        }
        if (locationConditions.length > 0) {
            conditions.push(or(...locationConditions) as unknown as typeof conditions[number])
        }
    }
    if (filters.tags && filters.tags.length > 0) {
        // Match cafes that have any of the specified tags using PostgreSQL array overlap
        conditions.push(sql`${cafes.tags} && ARRAY[${sql.join(filters.tags.map(t => sql`${t}`), sql`, `)}]::text[]`)
    }
    if (filters.exclude_hidden_gems) conditions.push(eq(cafes.isHiddenGem, false))
    if (filters.is_24_7) {
        const currentDay = getCurrentDayKey()
        conditions.push(sql`EXISTS (
            SELECT 1 FROM jsonb_array_elements(${cafes.operatingHours}) elem
            WHERE elem->>'day' = ${currentDay} AND elem->>'is_24_hours' = 'true'
        )`)
    }
    if (filters.isHalalCertified) {
        conditions.push(eq(cafes.isHalalCertified, true))
    }
    // Exclude chains by default unless include_chains is true
    // Treat NULL as non-chain (include cafes where is_chain is false OR null)
    if (!filters.include_chains) {
        conditions.push(or(eq(cafes.isChain, false), isNull(cafes.isChain))!)
    }

    // Determine ordering
    let orderBy
    switch (filters.sortBy) {
        case "rating":
            orderBy = [desc(cafeRatingStats.averageRating)]
            break
        case "reviews":
            orderBy = [desc(cafeRatingStats.totalReviews)]
            break
        default:
            orderBy = [desc(cafes.createdAt)]
    }

    const cafesResult = await db
        .select({
            id: cafes.id, name: cafes.name, slug: cafes.slug, thumbnail: cafes.thumbnail,
            description: cafes.description, addressDisplay: cafes.addressDisplay, area: cafes.area,
            cityMunicipality: cafes.cityMunicipality, province: cafes.province, region: cafes.region,
            lat: cafes.lat, lng: cafes.lng, priceLevel: cafes.priceLevel, coffeeStyle: cafes.coffeeStyle,
            roaster: cafes.roaster, brewMethods: cafes.brewMethods,
            specialty: cafes.specialty, milkOptions: cafes.milkOptions, tags: cafes.tags,
            operatingHours: cafes.operatingHours, socials: cafes.socials, phone: cafes.phone,
            email: cafes.email, websiteUrl: cafes.websiteUrl, paymentMethods: cafes.paymentMethods,
            hasWifi: cafes.hasWifi, hasSmoking: cafes.hasSmoking, hasSockets: cafes.hasSockets, hasAircon: cafes.hasAircon,
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
 * Get paginated reviews for a specific cafe
 */
export async function getReviewsByCafeIdPaginated(
    cafeId: string,
    page: number = 1,
    limit: number = 10
) {
    const offset = (page - 1) * limit

    // Get total count
    const [{ count: total }] = await db
        .select({ count: count() })
        .from(reviews)
        .where(and(eq(reviews.cafeId, cafeId), eq(reviews.status, "published")))

    // Get paginated reviews
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
        .limit(limit)
        .offset(offset)

    // Get interactions and owner responses for these reviews
    const reviewIds = reviewsResult.map(r => r.id)
    if (reviewIds.length === 0) {
        return {
            reviews: [],
            total,
            hasMore: false,
        }
    }

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

    const reviewsWithDetails = reviewsResult.map(r => ({
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

    return {
        reviews: reviewsWithDetails,
        total,
        hasMore: offset + reviewsResult.length < total,
    }
}

/**
 * Get the count of published cafes
 */
export async function getPublishedCafeCount(): Promise<number> {
    const result = await db.select({ count: count() }).from(cafes).where(and(...publicCafeConditions()))
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
        .where(and(ilike(cafes.name, `%${query}%`), ...omitTestCafes([])))
        .limit(5)

    return result
}

/**
 * Search cafes for blog tagging - returns published cafes only
 */
export async function searchCafesForBlog(query: string) {
    if (!query || query.length < 2) return []

    return db.select({
        id: cafes.id,
        name: cafes.name,
        slug: cafes.slug,
        thumbnail: sql<string>`coalesce(${cafes.thumbnail}, ${PLACEHOLDER_THUMBNAIL})`,
    })
        .from(cafes)
        .where(and(eq(cafes.isPublished, true), ilike(cafes.name, `%${query}%`), ...omitTestCafes([])))
        .limit(10)
}

/**
 * Get multiple cafes by their IDs
 */
export async function getCafesByIds(ids: string[]) {
    if (!ids.length) return []

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
        .where(and(eq(cafes.isPublished, true), inArray(cafes.id, ids), ...omitTestCafes([])))

    return results.map(c => mapCafeToSnakeCase(c))
}

/**
 * Get multiple cafes by their slugs
 */
export async function getCafesBySlugs(slugs: string[]) {
    if (!slugs.length) return []

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
        .where(and(eq(cafes.isPublished, true), inArray(cafes.slug, slugs), ...omitTestCafes([])))

    return results.map(c => mapCafeToSnakeCase(c))
}

/**
 * Get all published cafes (non-hidden gems), including chains.
 * Used for client-side filtering on the map page.
 */
export async function getAllPublishedCafes(): Promise<CafeWithRatings[]> {
    const results = await db
        .select({
            id: cafes.id,
            name: cafes.name,
            slug: cafes.slug,
            thumbnail: cafes.thumbnail,
            gallery: cafes.gallery,
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
            isHiddenGem: cafes.isHiddenGem,
            findingHint: cafes.findingHint,
            isChain: cafes.isChain,
            isHalalCertified: cafes.isHalalCertified,
            strawType: cafes.strawType,
            strawTypeOther: cafes.strawTypeOther,
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
        .where(
            and(
                eq(cafes.isHiddenGem, false),
                ...publicCafeConditions(),
            )
        )
        .orderBy(desc(cafes.createdAt))

    return results.map(c => mapCafeToSnakeCase(c)) as CafeWithRatings[]
}

/**
 * Get pending (unpublished) submissions for the current user
 */
export async function getUserPendingSubmissions(): Promise<Array<{
    id: string
    name: string
    slug: string
    thumbnail: string | null
    created_at: string | null
    city_municipality: string
    province: string
}>> {
    const user = await getCurrentUser()
    if (!user) return []

    const results = await db
        .select({
            id: cafes.id,
            name: cafes.name,
            slug: cafes.slug,
            thumbnail: cafes.thumbnail,
            created_at: cafes.createdAt,
            city_municipality: cafes.cityMunicipality,
            province: cafes.province,
        })
        .from(cafes)
        .where(
            and(
                eq(cafes.contributorId, user.id),
                eq(cafes.isPublished, false),
            )
        )
        .orderBy(desc(cafes.createdAt))

    return results.map(r => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        thumbnail: r.thumbnail,
        created_at: r.created_at?.toISOString() ?? null,
        city_municipality: r.city_municipality,
        province: r.province,
    }))
}
