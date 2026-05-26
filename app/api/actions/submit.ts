'use server'

import { db } from "@/db"
import { cafes, profiles, cafeMenuItems } from "@/db/schema"
import { eq, and, ilike, sql } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
import { notifyDiscord, notifyDiscordCritical } from "./notify"
import { SerializableCafeSubmission } from "@/utils/types/extra"
import { logContribution } from "@/utils/contribution-logging"
import { cafeSubmissionSchema, CafeSubmissionError, SubmitError } from "@/utils/validation/cafe-submission"
import { generateSlug, MAX_SLUG_ITERATIONS } from "@/utils/slug"



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
    error?: SubmitError
}

interface DuplicateCheckResult {
    isDuplicate: boolean
    existingCafes: Array<{
        id: string
        name: string
        slug: string
        isPublished: boolean | null
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
    // 1. Auth check
    const user = await getCurrentUser()
    if (!user) {
        return { success: false, error: CafeSubmissionError.auth() }
    }

    // 2. Zod validation
    const validation = cafeSubmissionSchema.safeParse(formData)
    if (!validation.success) {
        return {
            success: false,
            error: CafeSubmissionError.fromZod(validation.error),
        }
    }

    const validData = validation.data

    // 3. Duplicate detection
    try {
        const duplicate = await checkDuplicateCafe(
            validData.name,
            validData.city_municipality,
            validData.province,
            validData.lat,
            validData.lng
        )

        if (duplicate.isDuplicate) {
            const allPending = duplicate.existingCafes.every((c) => !c.isPublished)
            const message = allPending
                ? "A cafe with a similar name and location has already been submitted and is awaiting review."
                : `This cafe may already exist on Grounds. Check: ${duplicate.existingCafes.map((c) => c.name).join(", ")}`

            return { success: false, error: CafeSubmissionError.duplicate(message) }
        }
    } catch (err) {
        // Duplicate check failure is non-fatal — log and continue
        console.error("[Submit] Duplicate check failed:", err)
    }

    // 4. Slug generation
    let slug: string
    try {
        const baseSlug = generateSlug(
            validData.name,
            validData.city_municipality,
            validData.province
        )
        slug = await ensureUniqueSlug(baseSlug)
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        console.error("[Submit] Slug generation failed:", err)

        // Critical webhook (fire-and-forget)
        notifyDiscordCritical(
            "Slug Generation Failed",
            `Could not generate unique slug for cafe "${validData.name}". Error: ${errorMessage}`,
            {
                cafeName: validData.name,
                submitterId: user.id,
                errorMessage,
                errorStack: err instanceof Error ? err.stack : undefined,
                failedStep: "slug_generation",
            }
        ).catch(() => {})

        return { success: false, error: CafeSubmissionError.db() }
    }

    // 5. DB insert
    const finalThumbnail = thumbnailUrl || "placeholder"

    try {
        const operatingHoursJson = validData.operating_hours.length > 0
            ? validData.operating_hours
            : null
        const socialsJson = validData.socials.length > 0 ? validData.socials : null

        const [cafe] = await db.insert(cafes).values({
            name: validData.name.trim(),
            slug,
            description: validData.description?.trim() || null,
            thumbnail: finalThumbnail,
            gallery: galleryUrls.length > 0 ? galleryUrls : null,

            // Location
            region: validData.region,
            province: validData.province,
            cityMunicipality: validData.city_municipality,
            area: validData.area?.trim() || null,
            addressDisplay: validData.address_display || `${validData.city_municipality}, ${validData.province}`,
            lat: validData.lat,
            lng: validData.lng,

            // Amenities
            hasWifi: validData.has_wifi,
            hasSmoking: validData.has_smoking,
            hasSockets: validData.has_sockets,
            hasParking: validData.has_parking,
            hasAircon: validData.has_aircon,
            isPetFriendly: validData.is_pet_friendly,
            hasOutdoorSeating: validData.has_outdoor_seating,
            hasIndoorSeating: validData.has_indoor_seating,
            hasRestroom: validData.has_restroom,
            hasBidet: validData.has_bidet,
            hasNonDairy: validData.has_non_dairy,
            hasDecaf: validData.has_decaf,
            milkOptions: validData.milk_options.length > 0 ? validData.milk_options : null,
            servesFood: validData.serves_food,
            isWorkFriendly: validData.is_work_friendly,

            // Details
            priceLevel: validData.price_level,
            paymentMethods: validData.payment_methods?.trim() || null,
            specialty: validData.specialty.length > 0 ? validData.specialty : null,
            tags: validData.tags.length > 0 ? validData.tags : null,
            brewMethods: validData.brew_methods.length > 0 ? validData.brew_methods : null,
            roaster: validData.roaster?.trim() || null,

            // Schedule
            operatingHours: operatingHoursJson,

            // Contact
            websiteUrl: validData.website_url || null,
            phone: validData.phone?.trim() || null,
            email: validData.email?.trim() || null,
            socials: socialsJson,

            // Meta
            contributorId: user.id,
            isPublished: false, // Requires admin approval
            isActive: true,
            isVerified: false,
            isClaimed: false,
            isHiddenGem: validData.is_hidden_gem || false,
            findingHint: validData.finding_hint?.trim() || null,
            isChain: validData.is_chain || false,
            isHalalCertified: validData.is_halal_certified,
            strawType: validData.straw_type || null,
            strawTypeOther: validData.straw_type === "other" && validData.straw_type_other
                ? validData.straw_type_other : null,
            ownerIds: null,
        }).returning({ id: cafes.id, slug: cafes.slug })

        if (!cafe) {
            throw new Error("Insert returned no cafe")
        }

        // Post-submit hooks (fire-and-forget)
        // Get submitter profile for notification
        const profileResult = await db
            .select({ displayName: profiles.displayName, username: profiles.username })
            .from(profiles)
            .where(eq(profiles.id, user.id))
            .limit(1)

        const profile = profileResult[0]
        const submitterName = profile?.displayName || profile?.username || "Anonymous"

        notifyDiscord(validData.name, `${validData.city_municipality}, ${validData.province}`, submitterName)
            .catch((err) => console.error("[Submit] Discord notify failed:", err))

        logContribution(user.id, cafe.id, "CREATE", {
            summary: `Scouted ${validData.name}`,
            source: "cafe_submission",
            cafe_name: validData.name,
        }).catch((err) => console.error("[Submit] Contribution log failed:", err))

        // Insert menu items if any were submitted
        if (menuItems.length > 0) {
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
                    console.error(`[Submit] Menu item "${item.name}" insert failed:`, err)
                }
            }
        }

        return { success: true, cafeId: cafe.id, slug: cafe.slug }

    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        console.error("[Submit] DB insert failed:", err)

        // Critical webhook (fire-and-forget)
        notifyDiscordCritical(
            "Cafe Submission DB Insert Failed",
            `Database insert failed for cafe "${validData.name}". The user's submission was lost.`,
            {
                cafeName: validData.name,
                submitterId: user.id,
                errorMessage,
                errorStack: err instanceof Error ? err.stack : undefined,
                failedStep: "db_insert",
            }
        ).catch(() => {})

        return { success: false, error: CafeSubmissionError.db() }
    }
}