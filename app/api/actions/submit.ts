'use server'

import { db } from "@/db"
import { cafes, profiles, cafeMenuItems } from "@/db/schema"
import { eq, and, ilike, sql } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
import { notifyDiscord } from "./notify"
import { SerializableCafeSubmission } from "@/utils/types/extra"
import { OperatingHour } from "@/utils/types/cafe"
import { logContribution } from "@/utils/contribution-logging"

function generateSlug(name: string, cityMunicipality?: string, province?: string): string {
    const slugify = (s: string): string => s
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "")

    const nameSlug = slugify(name) || "cafe"

    if (cityMunicipality && province) {
        const citySlug = slugify(cityMunicipality)
        const provSlug = slugify(province)

        let locationSlug = ""
        if (citySlug && provSlug) locationSlug = `${citySlug}-${provSlug}`
        else if (provSlug) locationSlug = provSlug

        if (locationSlug) {
            const combined = `${nameSlug}-${locationSlug}`
            return combined.length > 200 ? combined.slice(0, 200).replace(/-$/, "") : combined
        }
    }

    return nameSlug.length > 200 ? nameSlug.slice(0, 200).replace(/-$/, "") : nameSlug
}

const MAX_SLUG_ITERATIONS = 100

async function ensureUniqueSlug(baseSlug: string): Promise<string> {
    let slug = baseSlug
    let counter = 0

    while (counter < MAX_SLUG_ITERATIONS) {
        const result = await db
            .select({ id: cafes.id })
            .from(cafes)
            .where(eq(cafes.slug, slug))
            .limit(1)

        if (!result[0]) break

        counter++
        slug = `${baseSlug}-${counter}`
    }

    if (counter >= MAX_SLUG_ITERATIONS) {
        throw new Error("SLUG_EXHAUSTED")
    }

    return slug
}

export interface SubmitCafeResult {
    success: boolean
    cafeId?: string
    slug?: string
    error?: string
}

interface DuplicateCheckResult {
    isDuplicate: boolean
    existingCafes: Array<{
        id: string
        name: string
        slug: string
        isPublished: boolean
        addressDisplay: string
    }>
}

/**
 * Haversine distance in meters between two lat/lng points
 */
function haversineDistance(
    lat1: number, lng1: number,
    lat2: number, lng2: number
): number {
    const R = 6371000 // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}

async function checkDuplicateCafe(
    name: string,
    cityMunicipality: string,
    province: string,
    lat: number | null,
    lng: number | null
): Promise<DuplicateCheckResult> {
    const normalized = name.toLowerCase().trim()

    // Step 1: Name-based check (exact case-insensitive name match in same city)
    const exactMatches = await db
        .select({
            id: cafes.id,
            name: cafes.name,
            slug: cafes.slug,
            isPublished: cafes.isPublished,
            addressDisplay: cafes.addressDisplay,
        })
        .from(cafes)
        .where(
            and(
                sql`lower(${cafes.name}) = ${normalized}`,
                ilike(cafes.cityMunicipality, `%${cityMunicipality}%`)
            )
        )
        .limit(5)

    if (exactMatches.length > 0) {
        return { isDuplicate: true, existingCafes: exactMatches }
    }

    // Step 2: Proximity-based check (200m radius + name similarity)
    if (lat !== null && lng !== null) {
        const DUPLICATE_RADIUS_METERS = 200

        const nearbyCafes = await db
            .select({
                id: cafes.id,
                name: cafes.name,
                slug: cafes.slug,
                isPublished: cafes.isPublished,
                addressDisplay: cafes.addressDisplay,
                lat: cafes.lat,
                lng: cafes.lng,
            })
            .from(cafes)
            .where(
                and(
                    ilike(cafes.cityMunicipality, `%${cityMunicipality}%`),
                    ilike(cafes.province, `%${province}%`)
                )
            )
            .limit(50)

        // Calculate haversine distance for each
        const nearby = nearbyCafes.filter((cafe) => {
            if (cafe.lat === null || cafe.lng === null) return false
            const distance = haversineDistance(lat, lng, cafe.lat, cafe.lng)
            return distance <= DUPLICATE_RADIUS_METERS
        })

        // Among nearby cafes, check name similarity
        if (nearby.length > 0) {
            const similarNames = nearby.filter((cafe) => {
                const words1 = new Set(normalized.split(/\s+/))
                const words2 = new Set(cafe.name.toLowerCase().split(/\s+/))
                const intersection = [...words1].filter((w) => words2.has(w))
                return intersection.length >= Math.min(words1.size, words2.size) * 0.5
            })

            if (similarNames.length > 0) {
                return { isDuplicate: true, existingCafes: similarNames }
            }
        }
    }

    return { isDuplicate: false, existingCafes: [] }
}

/**
 * Submit a new cafe for review
 * Cafe is created with is_published: false and needs admin approval
 */
export async function submitCafe(
    formData: SerializableCafeSubmission,
    thumbnailUrl: string | null,
    galleryUrls: string[],
    menuItems: { name: string; category: string; price: number; description: string; imageUrl: string | null }[] = []
): Promise<SubmitCafeResult> {
    // Get current user
    const user = await getCurrentUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    // Validate required fields
    if (!formData.name.trim()) {
        return { success: false, error: "Cafe name is required" }
    }
    // Hidden Gems don't require full address (approximate location only)
    if (!formData.is_hidden_gem && !formData.address_display.trim()) {
        return { success: false, error: "Address is required" }
    }
    if (!formData.region || !formData.province || !formData.city_municipality) {
        return { success: false, error: "Location details are required" }
    }
    // Hidden Gems don't require lat/lng (approximate location only)
    if (!formData.is_hidden_gem && (formData.lat === null || formData.lng === null)) {
        return { success: false, error: "Please select a location on the map" }
    }
    // Thumbnail is now optional - use placeholder if not provided
    const finalThumbnail = thumbnailUrl || "placeholder"

    // Duplicate detection
    try {
        const duplicate = await checkDuplicateCafe(
            formData.name,
            formData.city_municipality,
            formData.province,
            formData.lat,
            formData.lng
        )

        if (duplicate.isDuplicate) {
            const allPending = duplicate.existingCafes.every((c) => !c.isPublished)
            const message = allPending
                ? "A cafe with a similar name and location has already been submitted and is awaiting review."
                : `This cafe may already exist on Grounds. Check: ${duplicate.existingCafes.map((c) => c.name).join(", ")}`

            return { success: false, error: message }
        }
    } catch (err) {
        // Duplicate check failure is non-fatal — log and continue
        console.error("[Submit] Duplicate check failed:", err)
    }

    try {
        // Generate unique slug
        const baseSlug = generateSlug(
            formData.name,
            formData.city_municipality,
            formData.province
        )
        const slug = await ensureUniqueSlug(baseSlug)

        // Format operating hours for DB
        const operatingHoursJson = formData.operating_hours.length > 0
            ? formData.operating_hours.map((h: OperatingHour) => ({
                day: h.day,
                open: h.open,
                close: h.close,
                is_closed: h.is_closed || false,
                is_24_hours: h.is_24_hours || false,
            }))
            : null

        // Format socials for DB
        const socialsJson = formData.socials.length > 0
            ? formData.socials
            : null

        // Insert cafe into database
        const [cafe] = await db.insert(cafes).values({
            name: formData.name.trim(),
            slug,
            description: formData.description.trim() || null,
            thumbnail: finalThumbnail,
            gallery: galleryUrls.length > 0 ? galleryUrls : null,

            // Location
            region: formData.region,
            province: formData.province,
            cityMunicipality: formData.city_municipality,
            area: formData.area.trim() || null,
            // For Hidden Gems with no address, use city/province as fallback
            addressDisplay: formData.address_display.trim() || `${formData.city_municipality}, ${formData.province}`,
            lat: formData.lat,
            lng: formData.lng,

            // Amenities
            hasWifi: formData.has_wifi,
            hasSmoking: formData.has_smoking,
            hasSockets: formData.has_sockets,

            hasParking: formData.has_parking,
            hasAircon: formData.has_aircon,
            isPetFriendly: formData.is_pet_friendly,
            hasOutdoorSeating: formData.has_outdoor_seating,
            hasIndoorSeating: formData.has_indoor_seating,
            hasRestroom: formData.has_restroom,
            hasBidet: formData.has_bidet,
            hasNonDairy: formData.has_non_dairy,
            hasDecaf: formData.has_decaf,
            milkOptions: formData.milk_options.length > 0 ? formData.milk_options : null,
            servesFood: formData.serves_food,
            isWorkFriendly: formData.is_work_friendly,

            // Details
            priceLevel: formData.price_level,
            paymentMethods: formData.payment_methods.trim() || null,
            specialty: formData.specialty.length > 0 ? formData.specialty : null,
            tags: formData.tags.length > 0 ? formData.tags : null,
            brewMethods: formData.brew_methods.length > 0 ? formData.brew_methods : null,
            roaster: formData.roaster.trim() || null,

            // Schedule
            operatingHours: operatingHoursJson,

            // Contact
            websiteUrl: formData.website_url.trim() || null,
            phone: formData.phone.trim() || null,
            email: formData.email.trim() || null,
            socials: socialsJson,

            // Meta
            contributorId: user.id,
            isPublished: false, // Requires admin approval
            isActive: true,
            isVerified: false,
            isClaimed: false,
            isHiddenGem: formData.is_hidden_gem || false,
            findingHint: formData.finding_hint?.trim() || null,
            isChain: formData.is_chain || false,
            isHalalCertified: formData.is_halal_certified,
            strawType: formData.straw_type?.trim() || null,
            strawTypeOther:
                formData.straw_type === "other" && formData.straw_type_other?.trim()
                    ? formData.straw_type_other.trim()
                    : null,
            ownerIds: null,
        }).returning({ id: cafes.id, slug: cafes.slug })

        if (!cafe) {
            return { success: false, error: "Failed to submit cafe" }
        }

        // Get submitter profile for notification
        const profileResult = await db
            .select({ displayName: profiles.displayName, username: profiles.username })
            .from(profiles)
            .where(eq(profiles.id, user.id))
            .limit(1)

        const profile = profileResult[0]
        const submitterName = profile?.displayName || profile?.username || 'Anonymous'

        // Notify Discord
        await notifyDiscord(
            formData.name,
            `${formData.city_municipality}, ${formData.province}`,
            submitterName
        )

        // Log contribution
        await logContribution(user.id, cafe.id, 'CREATE', {
            summary: `Scouted ${formData.name}`,
            source: 'cafe_submission',
            cafe_name: formData.name
        })

        // Insert menu items if any were submitted
        if (menuItems.length > 0) {
            console.log(`[Cafe Submit] Inserting ${menuItems.length} menu items...`)
            for (let i = 0; i < menuItems.length; i++) {
                const item = menuItems[i]
                try {
                    await db.insert(cafeMenuItems).values({
                        cafeId: cafe.id,
                        name: item.name,
                        category: item.category,
                        price: item.price,
                        description: item.description || null,
                        imageUrl: item.imageUrl,
                        isAvailable: true,
                        sortOrder: i,
                        lastUpdatedBy: user.id,
                    })
                } catch (err) {
                    console.error(`[Cafe Submit] Failed to insert menu item "${item.name}":`, err)
                    // Continue with other items, don't fail the whole submission
                }
            }
        }

        return {
            success: true,
            cafeId: cafe.id,
            slug: cafe.slug
        }
    } catch (error) {
        console.error("Submit cafe error:", error)
        return { success: false, error: "An unexpected error occurred" }
    }
}
