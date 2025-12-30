'use server'

import { db } from "@/db"
import { cafes, cafeEditSuggestions, profiles, user } from "@/db/schema"
import { eq, desc, count as drizzleCount } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
import { sendSuggestionApprovedEmail, sendSuggestionRejectedEmail } from "@/utils/email"
import { notifyDiscordEditSuggestion } from "./notify"
import {
    EditSuggestion,
    SuggestableFields,
    SuggestedImageChanges
} from "@/utils/types/suggestions"
import { logContribution } from "@/utils/contribution-logging"

// Map snake_case suggestion fields to camelCase Drizzle columns
const fieldMapping: Record<string, string> = {
    address_display: 'addressDisplay',
    website_url: 'websiteUrl',
    has_wifi: 'hasWifi',
    has_sockets: 'hasSockets',
    has_parking: 'hasParking',
    has_aircon: 'hasAircon',
    is_pet_friendly: 'isPetFriendly',
    has_outdoor_seating: 'hasOutdoorSeating',
    has_indoor_seating: 'hasIndoorSeating',
    has_restroom: 'hasRestroom',
    has_bidet: 'hasBidet',
    has_non_dairy: 'hasNonDairy',
    milk_options: 'milkOptions',
    serves_food: 'servesFood',
    is_work_friendly: 'isWorkFriendly',
    price_level: 'priceLevel',
    coffee_style: 'coffeeStyle',
    payment_methods: 'paymentMethods',
    brew_methods: 'brewMethods',
    operating_hours: 'operatingHours',
}

function mapSuggestableFieldsToDrizzle(fields: SuggestableFields): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) {
            const drizzleKey = fieldMapping[key] || key
            result[drizzleKey] = value
        }
    }
    return result
}


// ============================================
// Result Types
// ============================================

interface ActionResult {
    success: boolean
    error?: string
}

interface SubmitSuggestionResult extends ActionResult {
    suggestionId?: string
}

// ============================================
// User Actions
// ============================================

/**
 * Submit a new edit suggestion for a cafe
 */
export async function submitEditSuggestion(
    cafeId: string,
    changes: SuggestableFields,
    imageChanges?: SuggestedImageChanges
): Promise<SubmitSuggestionResult> {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
        return { success: false, error: "Not authenticated" }
    }

    // Validate that there are actual changes
    const hasTextChanges = Object.keys(changes).length > 0
    const hasImageChanges = imageChanges && (
        (imageChanges.add_to_gallery?.length ?? 0) > 0 ||
        (imageChanges.remove_from_gallery?.length ?? 0) > 0 ||
        imageChanges.new_thumbnail
    )

    if (!hasTextChanges && !hasImageChanges) {
        return { success: false, error: "No changes provided" }
    }

    // Verify the cafe exists
    const cafeResult = await db
        .select({ id: cafes.id, name: cafes.name, slug: cafes.slug })
        .from(cafes)
        .where(eq(cafes.id, cafeId))
        .limit(1)

    const cafe = cafeResult[0]
    if (!cafe) {
        return { success: false, error: "Cafe not found" }
    }

    // Insert the suggestion
    const [suggestion] = await db.insert(cafeEditSuggestions).values({
        cafeId,
        userId: currentUser.id,
        status: 'pending',
        suggestedChanges: changes,
        suggestedImages: imageChanges || null,
    }).returning({ id: cafeEditSuggestions.id })

    if (!suggestion) {
        return { success: false, error: "Failed to submit suggestion" }
    }

    // Notify Discord
    const profileResult = await db
        .select({ displayName: profiles.displayName, username: profiles.username })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    const submitterName = profileResult[0]?.displayName || profileResult[0]?.username
    const suggestedFields = Object.keys(changes)

    await notifyDiscordEditSuggestion(
        { name: cafe.name, slug: cafe.slug },
        suggestedFields,
        submitterName
    )

    // Log contribution
    await logContribution(currentUser.id, cafeId, 'SUGGEST', {
        summary: `Suggested edits: ${suggestedFields.join(', ')}`,
        source: 'edit_suggestion',
        cafe_name: cafe.name,
        changed_fields: suggestedFields
    })

    return { success: true, suggestionId: suggestion.id }
}

/**
 * Get user's own suggestions with cafe info
 */
export async function getUserSuggestions(userId: string): Promise<EditSuggestion[]> {
    const result = await db
        .select({
            id: cafeEditSuggestions.id,
            cafeId: cafeEditSuggestions.cafeId,
            userId: cafeEditSuggestions.userId,
            status: cafeEditSuggestions.status,
            suggestedChanges: cafeEditSuggestions.suggestedChanges,
            suggestedImages: cafeEditSuggestions.suggestedImages,
            adminNotes: cafeEditSuggestions.adminNotes,
            createdAt: cafeEditSuggestions.createdAt,
            updatedAt: cafeEditSuggestions.updatedAt,
            reviewedAt: cafeEditSuggestions.reviewedAt,
            reviewedBy: cafeEditSuggestions.reviewedBy,
            cafeName: cafes.name,
            cafeSlug: cafes.slug,
            cafeThumbnail: cafes.thumbnail,
        })
        .from(cafeEditSuggestions)
        .leftJoin(cafes, eq(cafeEditSuggestions.cafeId, cafes.id))
        .where(eq(cafeEditSuggestions.userId, userId))
        .orderBy(desc(cafeEditSuggestions.createdAt))

    return result.map(row => ({
        id: row.id,
        cafe_id: row.cafeId,
        user_id: row.userId,
        status: row.status as 'pending' | 'approved' | 'rejected',
        suggested_changes: row.suggestedChanges as SuggestableFields,
        suggested_images: row.suggestedImages as SuggestedImageChanges | null,
        admin_notes: row.adminNotes,
        created_at: row.createdAt?.toISOString() ?? null,
        updated_at: row.updatedAt?.toISOString() ?? null,
        reviewed_at: row.reviewedAt?.toISOString() ?? null,
        reviewed_by: row.reviewedBy,
        cafe: row.cafeName ? {
            id: row.cafeId,
            name: row.cafeName,
            slug: row.cafeSlug!,
            thumbnail: row.cafeThumbnail ?? '',
        } : undefined,
    }))
}

// ============================================
// Admin Actions
// ============================================

async function isAdmin(): Promise<boolean> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return false

    const result = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    const role = result[0]?.role
    return role === 'admin' || role === 'moderator'
}

/**
 * Get all pending suggestions (admin only)
 */
export async function getPendingSuggestions(): Promise<EditSuggestion[]> {
    if (!await isAdmin()) return []

    const result = await db
        .select({
            id: cafeEditSuggestions.id,
            cafeId: cafeEditSuggestions.cafeId,
            userId: cafeEditSuggestions.userId,
            status: cafeEditSuggestions.status,
            suggestedChanges: cafeEditSuggestions.suggestedChanges,
            suggestedImages: cafeEditSuggestions.suggestedImages,
            adminNotes: cafeEditSuggestions.adminNotes,
            createdAt: cafeEditSuggestions.createdAt,
            updatedAt: cafeEditSuggestions.updatedAt,
            reviewedAt: cafeEditSuggestions.reviewedAt,
            reviewedBy: cafeEditSuggestions.reviewedBy,
            cafeName: cafes.name,
            cafeSlug: cafes.slug,
            cafeThumbnail: cafes.thumbnail,
            authorDisplayName: profiles.displayName,
            authorUsername: profiles.username,
            authorAvatarUrl: profiles.avatarUrl,
        })
        .from(cafeEditSuggestions)
        .leftJoin(cafes, eq(cafeEditSuggestions.cafeId, cafes.id))
        .leftJoin(profiles, eq(cafeEditSuggestions.userId, profiles.id))
        .where(eq(cafeEditSuggestions.status, 'pending'))
        .orderBy(cafeEditSuggestions.createdAt)

    return result.map(row => ({
        id: row.id,
        cafe_id: row.cafeId,
        user_id: row.userId,
        status: row.status as 'pending' | 'approved' | 'rejected',
        suggested_changes: row.suggestedChanges as SuggestableFields,
        suggested_images: row.suggestedImages as SuggestedImageChanges | null,
        admin_notes: row.adminNotes,
        created_at: row.createdAt?.toISOString() ?? null,
        updated_at: row.updatedAt?.toISOString() ?? null,
        reviewed_at: row.reviewedAt?.toISOString() ?? null,
        reviewed_by: row.reviewedBy,
        cafe: row.cafeName ? {
            id: row.cafeId,
            name: row.cafeName,
            slug: row.cafeSlug!,
            thumbnail: row.cafeThumbnail ?? '',
        } : undefined,
        author: row.authorDisplayName ? {
            id: row.userId,
            display_name: row.authorDisplayName,
            username: row.authorUsername!,
            avatar_url: row.authorAvatarUrl,
        } : undefined,
    }))
}

/**
 * Get suggestions for a specific cafe (admin only)
 */
export async function getCafeSuggestions(cafeId: string): Promise<EditSuggestion[]> {
    if (!await isAdmin()) return []

    const result = await db
        .select({
            id: cafeEditSuggestions.id,
            cafeId: cafeEditSuggestions.cafeId,
            userId: cafeEditSuggestions.userId,
            status: cafeEditSuggestions.status,
            suggestedChanges: cafeEditSuggestions.suggestedChanges,
            suggestedImages: cafeEditSuggestions.suggestedImages,
            adminNotes: cafeEditSuggestions.adminNotes,
            createdAt: cafeEditSuggestions.createdAt,
            updatedAt: cafeEditSuggestions.updatedAt,
            reviewedAt: cafeEditSuggestions.reviewedAt,
            reviewedBy: cafeEditSuggestions.reviewedBy,
            authorDisplayName: profiles.displayName,
            authorUsername: profiles.username,
            authorAvatarUrl: profiles.avatarUrl,
        })
        .from(cafeEditSuggestions)
        .leftJoin(profiles, eq(cafeEditSuggestions.userId, profiles.id))
        .where(eq(cafeEditSuggestions.cafeId, cafeId))
        .orderBy(desc(cafeEditSuggestions.createdAt))

    return result.map(row => ({
        id: row.id,
        cafe_id: row.cafeId,
        user_id: row.userId,
        status: row.status as 'pending' | 'approved' | 'rejected',
        suggested_changes: row.suggestedChanges as SuggestableFields,
        suggested_images: row.suggestedImages as SuggestedImageChanges | null,
        admin_notes: row.adminNotes,
        created_at: row.createdAt?.toISOString() ?? null,
        updated_at: row.updatedAt?.toISOString() ?? null,
        reviewed_at: row.reviewedAt?.toISOString() ?? null,
        reviewed_by: row.reviewedBy,
        author: row.authorDisplayName ? {
            id: row.userId,
            display_name: row.authorDisplayName,
            username: row.authorUsername!,
            avatar_url: row.authorAvatarUrl,
        } : undefined,
    }))
}

/**
 * Approve a suggestion and apply changes to the cafe (admin only)
 */
export async function approveSuggestion(
    suggestionId: string,
    applyChanges?: Partial<SuggestableFields>
): Promise<ActionResult> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    const role = profileResult[0]?.role
    if (role !== 'admin' && role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    // Fetch the suggestion
    const suggestionResult = await db
        .select()
        .from(cafeEditSuggestions)
        .where(eq(cafeEditSuggestions.id, suggestionId))
        .limit(1)

    const suggestion = suggestionResult[0]
    if (!suggestion) {
        return { success: false, error: "Suggestion not found" }
    }

    if (suggestion.status !== 'pending') {
        return { success: false, error: "Suggestion already processed" }
    }

    const suggestedChanges = suggestion.suggestedChanges as SuggestableFields
    const changesToApply = applyChanges || suggestedChanges

    // Apply cafe updates (map snake_case to camelCase)
    if (Object.keys(changesToApply).length > 0) {
        const drizzleUpdates = mapSuggestableFieldsToDrizzle(changesToApply)
        await db.update(cafes)
            .set(drizzleUpdates)
            .where(eq(cafes.id, suggestion.cafeId))
    }

    // Handle image changes
    const imageChanges = suggestion.suggestedImages as SuggestedImageChanges | null
    if (imageChanges) {
        const cafeResult = await db
            .select({ gallery: cafes.gallery, thumbnail: cafes.thumbnail })
            .from(cafes)
            .where(eq(cafes.id, suggestion.cafeId))
            .limit(1)

        const cafe = cafeResult[0]
        if (cafe) {
            const updates: Record<string, unknown> = {}

            if (imageChanges.new_thumbnail) {
                updates.thumbnail = imageChanges.new_thumbnail
            }

            if (imageChanges.add_to_gallery?.length || imageChanges.remove_from_gallery?.length) {
                let gallery = cafe.gallery || []

                if (imageChanges.remove_from_gallery?.length) {
                    gallery = gallery.filter((img: string) =>
                        !imageChanges.remove_from_gallery!.includes(img)
                    )
                }

                if (imageChanges.add_to_gallery?.length) {
                    gallery = [...gallery, ...imageChanges.add_to_gallery]
                }

                updates.gallery = gallery.length > 0 ? gallery : null
            }

            if (Object.keys(updates).length > 0) {
                await db.update(cafes).set(updates).where(eq(cafes.id, suggestion.cafeId))
            }
        }
    }

    // Mark suggestion as approved
    await db.update(cafeEditSuggestions).set({
        status: 'approved',
        reviewedAt: new Date(),
        reviewedBy: currentUser.id,
    }).where(eq(cafeEditSuggestions.id, suggestionId))

    // Get cafe and author info for email
    const [cafeData, authorProfile, authorUser] = await Promise.all([
        db.select({ name: cafes.name, slug: cafes.slug }).from(cafes).where(eq(cafes.id, suggestion.cafeId)).limit(1),
        db.select({ displayName: profiles.displayName, username: profiles.username }).from(profiles).where(eq(profiles.id, suggestion.userId)).limit(1),
        db.select({ email: user.email }).from(user).where(eq(user.id, suggestion.userId)).limit(1),
    ])

    const cafe = cafeData[0]
    const author = authorProfile[0]
    const email = authorUser[0]?.email

    if (cafe && author && email) {
        await sendSuggestionApprovedEmail(
            email,
            cafe.name,
            cafe.slug,
            author.displayName || author.username
        )

        // Log contribution
        await logContribution(suggestion.userId, suggestion.cafeId, 'UPDATE', {
            summary: `Suggestion approved: ${Object.keys(changesToApply).join(', ')}`,
            source: 'approved_suggestion',
            cafe_name: cafe.name,
            changed_fields: Object.keys(changesToApply)
        })
    }

    return { success: true }
}

/**
 * Reject a suggestion (admin only)
 */
export async function rejectSuggestion(
    suggestionId: string,
    adminNotes?: string
): Promise<ActionResult> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    const role = profileResult[0]?.role
    if (role !== 'admin' && role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    // Fetch the suggestion
    const suggestionResult = await db
        .select()
        .from(cafeEditSuggestions)
        .where(eq(cafeEditSuggestions.id, suggestionId))
        .limit(1)

    const suggestion = suggestionResult[0]
    if (!suggestion) {
        return { success: false, error: "Suggestion not found" }
    }

    if (suggestion.status !== 'pending') {
        return { success: false, error: "Suggestion already processed" }
    }

    // Update status
    await db.update(cafeEditSuggestions).set({
        status: 'rejected',
        adminNotes: adminNotes || null,
        reviewedAt: new Date(),
        reviewedBy: currentUser.id,
    }).where(eq(cafeEditSuggestions.id, suggestionId))

    // Send email to author
    const [cafeData, authorProfile, authorUser] = await Promise.all([
        db.select({ name: cafes.name }).from(cafes).where(eq(cafes.id, suggestion.cafeId)).limit(1),
        db.select({ displayName: profiles.displayName, username: profiles.username }).from(profiles).where(eq(profiles.id, suggestion.userId)).limit(1),
        db.select({ email: user.email }).from(user).where(eq(user.id, suggestion.userId)).limit(1),
    ])

    const cafe = cafeData[0]
    const author = authorProfile[0]
    const email = authorUser[0]?.email

    if (cafe && author && email) {
        await sendSuggestionRejectedEmail(
            email,
            cafe.name,
            author.displayName || author.username,
            adminNotes
        )
    }

    return { success: true }
}

/**
 * Get count of pending suggestions
 */
export async function getPendingSuggestionsCount(): Promise<number> {
    if (!await isAdmin()) return 0

    const result = await db
        .select({ count: drizzleCount() })
        .from(cafeEditSuggestions)
        .where(eq(cafeEditSuggestions.status, 'pending'))

    return result[0]?.count ?? 0
}
