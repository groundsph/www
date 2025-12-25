'use server'

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { sendSuggestionApprovedEmail, sendSuggestionRejectedEmail } from "@/utils/email"
import {
    EditSuggestion,
    SuggestableFields,
    SuggestedImageChanges
} from "@/utils/types/suggestions"

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
 * Any authenticated user can submit suggestions
 */
export async function submitEditSuggestion(
    cafeId: string,
    changes: SuggestableFields,
    imageChanges?: SuggestedImageChanges
): Promise<SubmitSuggestionResult> {
    const db = await createClient()

    // Verify user is authenticated
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
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
    const { data: cafe, error: cafeError } = await db
        .from('cafes')
        .select('id')
        .eq('id', cafeId)
        .single()

    if (cafeError || !cafe) {
        return { success: false, error: "Cafe not found" }
    }

    // Insert the suggestion
    const { data: suggestion, error: insertError } = await db
        .from('cafe_edit_suggestions')
        .insert({
            cafe_id: cafeId,
            user_id: user.id,
            status: 'pending',
            suggested_changes: changes,
            suggested_images: imageChanges || null,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Using type assertion due to Supabase type generation timing issue
        } as any)
        .select('id')
        .single()

    if (insertError) {
        console.error("Error inserting suggestion:", insertError)
        return { success: false, error: "Failed to submit suggestion" }
    }

    return { success: true, suggestionId: suggestion.id }
}

/**
 * Get user's own suggestions with cafe info
 */
export async function getUserSuggestions(userId: string): Promise<EditSuggestion[]> {
    const db = await createClient()

    const { data, error } = await db
        .from('cafe_edit_suggestions')
        .select(`
            *,
            cafe:cafes(id, name, slug, thumbnail)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error("Error fetching user suggestions:", error)
        return []
    }

    return data.map(row => ({
        ...row,
        suggested_changes: row.suggested_changes as SuggestableFields,
        suggested_images: row.suggested_images as SuggestedImageChanges | null,
        status: row.status as 'pending' | 'approved' | 'rejected',
        cafe: row.cafe as EditSuggestion['cafe'],
    }))
}

// ============================================
// Admin Actions
// ============================================

/**
 * Check if current user is admin/moderator
 */
async function isAdmin(): Promise<boolean> {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()

    if (!user) return false

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    return profile?.role === 'admin' || profile?.role === 'moderator'
}

/**
 * Get all pending suggestions (admin only)
 */
export async function getPendingSuggestions(): Promise<EditSuggestion[]> {
    const db = await createClient()

    // Verify admin access
    if (!await isAdmin()) {
        console.error("Unauthorized access to getPendingSuggestions")
        return []
    }

    const { data, error } = await db
        .from('cafe_edit_suggestions')
        .select(`
            *,
            cafe:cafes(id, name, slug, thumbnail),
            author:profiles!cafe_edit_suggestions_user_id_fkey(
                id, username, display_name, avatar_url
            )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })

    if (error) {
        console.error("Error fetching pending suggestions:", error)
        return []
    }

    return data.map(row => ({
        ...row,
        suggested_changes: row.suggested_changes as SuggestableFields,
        suggested_images: row.suggested_images as SuggestedImageChanges | null,
        status: row.status as 'pending' | 'approved' | 'rejected',
        cafe: row.cafe as EditSuggestion['cafe'],
        author: row.author as EditSuggestion['author'],
    }))
}

/**
 * Get suggestions for a specific cafe (admin only)
 */
export async function getCafeSuggestions(cafeId: string): Promise<EditSuggestion[]> {
    const db = await createClient()

    // Verify admin access
    if (!await isAdmin()) {
        console.error("Unauthorized access to getCafeSuggestions")
        return []
    }

    const { data, error } = await db
        .from('cafe_edit_suggestions')
        .select(`
            *,
            author:profiles!cafe_edit_suggestions_user_id_fkey(
                id, username, display_name, avatar_url
            )
        `)
        .eq('cafe_id', cafeId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error("Error fetching cafe suggestions:", error)
        return []
    }

    return data.map(row => ({
        ...row,
        suggested_changes: row.suggested_changes as SuggestableFields,
        suggested_images: row.suggested_images as SuggestedImageChanges | null,
        status: row.status as 'pending' | 'approved' | 'rejected',
        author: row.author as EditSuggestion['author'],
    }))
}

/**
 * Approve a suggestion and apply changes to the cafe (admin only)
 * @param suggestionId - ID of the suggestion to approve
 * @param applyChanges - Optional subset of changes to apply (if not provided, all changes are applied)
 */
export async function approveSuggestion(
    suggestionId: string,
    applyChanges?: Partial<SuggestableFields>
): Promise<ActionResult> {
    const db = await createClient()

    // Verify admin access
    const { data: { user } } = await db.auth.getUser()
    if (!user) return { success: false, error: "Not authenticated" }

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    // Fetch the suggestion with cafe and author data
    const { data: suggestion, error: fetchError } = await db
        .from('cafe_edit_suggestions')
        .select(`
            *,
            cafe:cafes(id, name, slug),
            author:profiles!cafe_edit_suggestions_user_id_fkey(
                id, display_name, username
            )
        `)
        .eq('id', suggestionId)
        .single()

    if (fetchError || !suggestion) {
        return { success: false, error: "Suggestion not found" }
    }

    if (suggestion.status !== 'pending') {
        return { success: false, error: "Suggestion already processed" }
    }

    const suggestedChanges = suggestion.suggested_changes as SuggestableFields
    const changesToApply = applyChanges || suggestedChanges

    // Use admin client to apply changes
    const adminDb = await createAdminClient()

    // Apply cafe updates
    if (Object.keys(changesToApply).length > 0) {
        const { error: updateError } = await adminDb
            .from('cafes')
            .update(changesToApply as Record<string, unknown>)
            .eq('id', suggestion.cafe_id)

        if (updateError) {
            console.error("Error applying suggestion changes:", updateError)
            return { success: false, error: "Failed to apply changes" }
        }
    }

    // Handle image changes if any
    const imageChanges = suggestion.suggested_images as SuggestedImageChanges | null
    if (imageChanges) {
        // Fetch current cafe data
        const { data: cafe } = await adminDb
            .from('cafes')
            .select('gallery, thumbnail')
            .eq('id', suggestion.cafe_id)
            .single()

        if (cafe) {
            const updates: Record<string, unknown> = {}

            // Handle new thumbnail
            if (imageChanges.new_thumbnail) {
                updates.thumbnail = imageChanges.new_thumbnail
            }

            // Handle gallery changes
            if (imageChanges.add_to_gallery?.length || imageChanges.remove_from_gallery?.length) {
                let gallery = cafe.gallery || []

                // Remove images
                if (imageChanges.remove_from_gallery?.length) {
                    gallery = gallery.filter((img: string) =>
                        !imageChanges.remove_from_gallery!.includes(img)
                    )
                }

                // Add new images
                if (imageChanges.add_to_gallery?.length) {
                    gallery = [...gallery, ...imageChanges.add_to_gallery]
                }

                updates.gallery = gallery.length > 0 ? gallery : null
            }

            if (Object.keys(updates).length > 0) {
                await adminDb
                    .from('cafes')
                    .update(updates)
                    .eq('id', suggestion.cafe_id)
            }
        }
    }

    // Mark suggestion as approved
    const { error: statusError } = await adminDb
        .from('cafe_edit_suggestions')
        .update({
            status: 'approved',
            reviewed_at: new Date().toISOString(),
            reviewed_by: user.id,
        })
        .eq('id', suggestionId)

    if (statusError) {
        console.error("Error updating suggestion status:", statusError)
        // Changes were applied, but status update failed - non-critical
    }

    // Send email notification to the suggestion author
    const cafeData = suggestion.cafe as { id: string; name: string; slug: string } | null
    const authorData = suggestion.author as { id: string; display_name: string; username: string } | null

    if (cafeData && authorData) {
        // Get author's email
        const { data: authUser } = await adminDb.auth.admin.getUserById(authorData.id)
        if (authUser?.user?.email) {
            await sendSuggestionApprovedEmail(
                authUser.user.email,
                cafeData.name,
                cafeData.slug,
                authorData.display_name || authorData.username
            )
        }
    }

    return { success: true }
}

/**
 * Reject a suggestion (admin only)
 * @param suggestionId - ID of the suggestion to reject
 * @param adminNotes - Optional reason for rejection
 */
export async function rejectSuggestion(
    suggestionId: string,
    adminNotes?: string
): Promise<ActionResult> {
    const db = await createClient()

    // Verify admin access
    const { data: { user } } = await db.auth.getUser()
    if (!user) return { success: false, error: "Not authenticated" }

    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    // Fetch the suggestion with cafe and author data
    const { data: suggestion, error: fetchError } = await db
        .from('cafe_edit_suggestions')
        .select(`
            *,
            cafe:cafes(id, name, slug),
            author:profiles!cafe_edit_suggestions_user_id_fkey(
                id, display_name, username
            )
        `)
        .eq('id', suggestionId)
        .single()

    if (fetchError || !suggestion) {
        return { success: false, error: "Suggestion not found" }
    }

    if (suggestion.status !== 'pending') {
        return { success: false, error: "Suggestion already processed" }
    }

    // Use admin client to update
    const adminDb = await createAdminClient()

    const { error: updateError } = await adminDb
        .from('cafe_edit_suggestions')
        .update({
            status: 'rejected',
            admin_notes: adminNotes || null,
            reviewed_at: new Date().toISOString(),
            reviewed_by: user.id,
        })
        .eq('id', suggestionId)

    if (updateError) {
        console.error("Error rejecting suggestion:", updateError)
        return { success: false, error: "Failed to reject suggestion" }
    }

    // Send email notification to the suggestion author
    const cafeData = suggestion.cafe as { id: string; name: string; slug: string } | null
    const authorData = suggestion.author as { id: string; display_name: string; username: string } | null

    if (cafeData && authorData) {
        // Get author's email
        const { data: authUser } = await adminDb.auth.admin.getUserById(authorData.id)
        if (authUser?.user?.email) {
            await sendSuggestionRejectedEmail(
                authUser.user.email,
                cafeData.name,
                authorData.display_name || authorData.username,
                adminNotes
            )
        }
    }

    return { success: true }
}

/**
 * Get count of pending suggestions (for admin dashboard stats)
 */
export async function getPendingSuggestionsCount(): Promise<number> {
    const db = await createClient()

    if (!await isAdmin()) {
        return 0
    }

    const { count, error } = await db
        .from('cafe_edit_suggestions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

    if (error) {
        console.error("Error counting pending suggestions:", error)
        return 0
    }

    return count || 0
}
