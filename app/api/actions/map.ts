"use server"

import { db } from "@/db"
import { cafes, cafeRatingStats } from "@/db/schema"
import { eq, and, gte, lte } from "drizzle-orm"
import { CafeWithRatings } from "@/utils/types/extra"

export interface MapBounds {
    swLat: number
    swLng: number
    neLat: number
    neLng: number
}

export async function getCafesInBounds(bounds: MapBounds): Promise<CafeWithRatings[]> {
    const results = await db
        .select({
            // Cafe fields
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
            // Rating stats
            averageRating: cafeRatingStats.averageRating,
            totalReviews: cafeRatingStats.totalReviews,
        })
        .from(cafes)
        .leftJoin(cafeRatingStats, eq(cafes.id, cafeRatingStats.cafeId))
        .where(
            and(
                eq(cafes.isPublished, true),
                gte(cafes.lat, bounds.swLat),
                lte(cafes.lat, bounds.neLat),
                gte(cafes.lng, bounds.swLng),
                lte(cafes.lng, bounds.neLng)
            )
        )
        .limit(200)

    // Map to snake_case for compatibility with existing types
    return results.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        thumbnail: r.thumbnail,
        description: r.description,
        address_display: r.addressDisplay,
        area: r.area,
        city_municipality: r.cityMunicipality,
        province: r.province,
        region: r.region,
        lat: r.lat,
        lng: r.lng,
        price_level: r.priceLevel,
        coffee_style: r.coffeeStyle,
        membership_tier: r.membershipTier,
        roaster: r.roaster,
        brew_methods: r.brewMethods,
        specialty: r.specialty,
        milk_options: r.milkOptions,
        tags: r.tags,
        operating_hours: r.operatingHours,
        socials: r.socials,
        phone: r.phone,
        email: r.email,
        website_url: r.websiteUrl,
        payment_methods: r.paymentMethods,
        has_wifi: r.hasWifi,
        has_sockets: r.hasSockets,
        has_aircon: r.hasAircon,
        has_parking: r.hasParking,
        has_outdoor_seating: r.hasOutdoorSeating,
        has_indoor_seating: r.hasIndoorSeating,
        has_restroom: r.hasRestroom,
        has_bidet: r.hasBidet,
        has_non_dairy: r.hasNonDairy,
        is_pet_friendly: r.isPetFriendly,
        is_work_friendly: r.isWorkFriendly,
        serves_food: r.servesFood,
        is_active: r.isActive,
        is_published: r.isPublished,
        is_verified: r.isVerified,
        is_claimed: r.isClaimed,
        owner_ids: r.ownerIds,
        contributor_id: r.contributorId,
        featured_until: r.featuredUntil,
        created_at: r.createdAt,
        updated_at: r.updatedAt,
        average_rating: r.averageRating ?? null,
        total_reviews: r.totalReviews ?? null,
    })) as CafeWithRatings[]
}
