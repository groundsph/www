'use server'

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { notifyDiscord } from "./notify"
import { SerializableCafeSubmission } from "@/utils/types/extra"
import { OperatingHour } from "@/utils/types/cafe"
import { SupabaseClient } from "@supabase/supabase-js"
import { Database } from "@/utils/types/database.types"
import { logContribution } from "@/utils/contribution-logging"

// Generate a URL-friendly slug from cafe name
function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .trim()
}

// Make slug unique by appending random suffix if needed
async function ensureUniqueSlug(db: SupabaseClient<Database>, baseSlug: string): Promise<string> {
    let slug = baseSlug
    let counter = 0

    while (true) {
        const { data } = await db
            .from('cafes')
            .select('id')
            .eq('slug', slug)
            .single()

        if (!data) break // Slug is unique

        counter++
        slug = `${baseSlug}-${counter}`
    }

    return slug
}

export interface SubmitCafeResult {
    success: boolean
    cafeId?: string
    slug?: string
    error?: string
}

/**
 * Submit a new cafe for review
 * Cafe is created with is_published: false and needs admin approval
 */
export async function submitCafe(
    formData: SerializableCafeSubmission,
    thumbnailUrl: string | null,
    galleryUrls: string[]
): Promise<SubmitCafeResult> {
    const db = await createClient()

    // Get current user
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    // Validate required fields
    if (!formData.name.trim()) {
        return { success: false, error: "Cafe name is required" }
    }
    if (!formData.address_display.trim()) {
        return { success: false, error: "Address is required" }
    }
    if (!formData.region || !formData.province || !formData.city_municipality) {
        return { success: false, error: "Location details are required" }
    }
    if (formData.lat === null || formData.lng === null) {
        return { success: false, error: "Please select a location on the map" }
    }
    // Thumbnail is now optional - use placeholder if not provided
    const finalThumbnail = thumbnailUrl || "placeholder"

    try {
        // Generate unique slug
        const baseSlug = generateSlug(formData.name)
        const slug = await ensureUniqueSlug(db, baseSlug)

        // Format operating hours for DB (ensure it's valid JSON)
        const operatingHoursJson = formData.operating_hours.length > 0
            ? formData.operating_hours.map((h: OperatingHour) => ({
                day: h.day,
                open: h.open,
                close: h.close,
                is_closed: h.is_closed || false
            }))
            : null

        // Format socials for DB
        const socialsJson = formData.socials.length > 0
            ? formData.socials
            : null

        // Insert cafe into database
        const { data: cafe, error: insertError } = await db
            .from('cafes')
            .insert({
                name: formData.name.trim(),
                slug,
                description: formData.description.trim() || null,
                thumbnail: finalThumbnail,
                gallery: galleryUrls.length > 0 ? galleryUrls : null,

                // Location
                region: formData.region,
                province: formData.province,
                city_municipality: formData.city_municipality,
                area: formData.area.trim() || null,
                address_display: formData.address_display.trim(),
                lat: formData.lat,
                lng: formData.lng,

                // Amenities
                has_wifi: formData.has_wifi,
                has_sockets: formData.has_sockets,
                has_parking: formData.has_parking,
                has_aircon: formData.has_aircon,
                is_pet_friendly: formData.is_pet_friendly,
                has_outdoor_seating: formData.has_outdoor_seating,
                has_indoor_seating: formData.has_indoor_seating,
                has_restroom: formData.has_restroom,
                has_bidet: formData.has_bidet,
                has_non_dairy: formData.has_non_dairy,
                milk_options: formData.milk_options.length > 0 ? formData.milk_options : null,
                serves_food: formData.serves_food,
                is_work_friendly: formData.is_work_friendly,

                // Details
                price_level: formData.price_level,
                payment_methods: formData.payment_methods.trim() || null,
                specialty: formData.specialty.length > 0 ? formData.specialty : null,
                tags: formData.tags.length > 0 ? formData.tags : null,
                brew_methods: formData.brew_methods.length > 0 ? formData.brew_methods : null,
                roaster: formData.roaster.trim() || null,

                // Schedule
                operating_hours: operatingHoursJson,

                // Contact
                website_url: formData.website_url.trim() || null,
                phone: formData.phone.trim() || null,
                email: formData.email.trim() || null,
                socials: socialsJson,

                // Meta
                contributor_id: user.id,
                is_published: false, // Requires admin approval
                is_active: true,
                is_verified: false,
                is_claimed: false, // Set to false; ownership is handled via claim approval
                owner_ids: null, // Set via claim approval process
            })
            .select('id, slug')
            .single()

        if (insertError) {
            console.error("Cafe insert error:", insertError)
            return { success: false, error: "Failed to submit cafe" }
        }

        // Get submitter profile for notification
        const { data: profile } = await db
            .from('profiles')
            .select('display_name, username')
            .eq('id', user.id)
            .single()

        const submitterName = profile?.display_name || profile?.username || 'Anonymous'

        // Notify Discord
        await notifyDiscord(
            formData.name,
            `${formData.city_municipality}, ${formData.province}`,
            submitterName
        )

        // Log contribution
        const adminDb = await createAdminClient()
        await logContribution(adminDb, user.id, cafe.id, 'CREATE', {
            summary: `Scouted ${formData.name}`,
            source: 'cafe_submission',
            cafe_name: formData.name
        })

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
