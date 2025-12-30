/**
 * Contribution Logging Utility
 * Logs user contributions to cafes for history display
 */

import { db } from '@/db'
import { contributionLogs } from '@/db/schema'

// Matching the enum from the database
export type ContributionActionType = 'CREATE' | 'UPDATE' | 'VERIFY' | 'MEDIA' | 'SUGGEST'

export interface ContributionDetails {
    /** Human-readable summary of the contribution */
    summary?: string
    /** Source of the contribution (e.g., 'admin_edit', 'owner_edit', 'suggestion') */
    source?: string
    /** Cafe name for display purposes */
    cafe_name?: string
    /** Fields that were changed (for UPDATE actions) */
    changed_fields?: string[]
    /** Any additional metadata */
    [key: string]: unknown
}

/**
 * Log a user contribution to a cafe
 * 
 * @param userId - The user who made the contribution
 * @param cafeId - The cafe that was affected
 * @param actionType - Type of contribution (CREATE, UPDATE, VERIFY, MEDIA, SUGGEST)
 * @param details - Optional details about the contribution
 */
export async function logContribution(
    userId: string,
    cafeId: string,
    actionType: ContributionActionType,
    details?: ContributionDetails
): Promise<{ success: boolean; error?: string }> {
    try {
        await db.insert(contributionLogs).values({
            userId,
            cafeId,
            actionType,
            details: details ?? {},
        })

        return { success: true }
    } catch (err) {
        console.error('[logContribution] Unexpected error:', err)
        return { success: false, error: 'Unexpected error logging contribution' }
    }
}

/**
 * Determine which fields changed between old and new data
 * Useful for generating contribution details
 */
export function getChangedFields(
    oldData: Record<string, unknown>,
    newData: Record<string, unknown>
): string[] {
    const changedFields: string[] = []

    for (const key of Object.keys(newData)) {
        if (newData[key] !== undefined) {
            const oldValue = oldData[key]
            const newValue = newData[key]

            // Simple comparison - handles primitives and stringified objects
            if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
                changedFields.push(key)
            }
        }
    }

    return changedFields
}

/**
 * Generate a human-readable summary from changed fields
 */
export function generateChangeSummary(changedFields: string[]): string {
    if (changedFields.length === 0) return 'Updated cafe'

    const fieldLabels: Record<string, string> = {
        name: 'name',
        description: 'description',
        thumbnail: 'cover image',
        gallery: 'gallery',
        operating_hours: 'operating hours',
        address_display: 'address',
        lat: 'location',
        lng: 'location',
        has_wifi: 'WiFi availability',
        has_sockets: 'power outlets',
        has_parking: 'parking',
        has_aircon: 'air conditioning',
        is_pet_friendly: 'pet-friendliness',
        has_outdoor_seating: 'outdoor seating',
        serves_food: 'food service',
        is_work_friendly: 'work-friendliness',
        price_level: 'price level',
        has_indoor_seating: 'indoor seating',
        has_restroom: 'restroom',
        has_bidet: 'bidet',
        has_non_dairy: 'non-dairy milk',
        milk_options: 'milk options',
        specialty: 'specialties',
        tags: 'tags',
        brew_methods: 'brew methods',
        payment_methods: 'payment methods',
        roaster: 'roaster',
        website_url: 'website',
        phone: 'phone',
        email: 'email',
        socials: 'social links',
        slug: 'URL slug',
        is_verified: 'verification status',
        owner_ids: 'owners'
    }

    // Deduplicate (e.g., lat/lng both map to "location")
    const uniqueLabels = [...new Set(changedFields.map(f => fieldLabels[f] || f))]

    if (uniqueLabels.length === 1) {
        return `Updated ${uniqueLabels[0]}`
    } else if (uniqueLabels.length <= 3) {
        return `Updated ${uniqueLabels.join(', ')}`
    } else {
        return `Updated ${uniqueLabels.length} fields`
    }
}
