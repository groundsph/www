"use server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { notifyDiscordCafeClaim } from "@/app/api/actions/notify"
import { Resend } from "resend"
import ClaimApprovedEmail from "@/emails/ClaimApprovedEmail"
import ClaimRejectedEmail from "@/emails/ClaimRejectedEmail"

const resend = new Resend(process.env.RESEND_API_KEY)

export interface CafeClaim {
    id: string
    cafe_id: string
    user_id: string
    status: "pending" | "approved" | "rejected"
    proof_text: string
    proof_document_url: string | null
    admin_notes: string | null
    created_at: string | null
    reviewed_at: string | null
    reviewed_by: string | null
    cafe?: {
        id: string
        name: string
        slug: string
        thumbnail: string | null
    }
    user?: {
        id: string
        display_name: string
        username: string
        avatar_url: string | null
        email?: string
    }
}

/**
 * Submit a claim for a cafe
 */
export async function submitCafeClaim(
    cafeId: string,
    proofText: string,
    proofDocumentUrl?: string
): Promise<{ success: boolean; error?: string; claim?: CafeClaim }> {
    const db = await createClient()

    // Check auth
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
        return { success: false, error: "You must be logged in to claim a cafe" }
    }

    // Check if cafe exists and is not already claimed
    const { data: cafe, error: cafeError } = await db
        .from("cafes")
        .select("id, is_claimed, owner_ids")
        .eq("id", cafeId)
        .single()

    if (cafeError || !cafe) {
        return { success: false, error: "Cafe not found" }
    }

    if (cafe.is_claimed) {
        return { success: false, error: "This cafe has already been claimed" }
    }

    // Get user profile for notification
    const { data: userProfile } = await db
        .from("profiles")
        .select("display_name, username")
        .eq("id", user.id)
        .single()

    // Check if user already has a pending claim for this cafe
    const { data: existingClaim } = await db
        .from("cafe_claims")
        .select("id, status")
        .eq("cafe_id", cafeId)
        .eq("user_id", user.id)
        .eq("status", "pending")
        .single()

    if (existingClaim) {
        return { success: false, error: "You already have a pending claim for this cafe" }
    }

    // Submit claim
    const { data: claim, error } = await db
        .from("cafe_claims")
        .insert({
            cafe_id: cafeId,
            user_id: user.id,
            proof_text: proofText,
            proof_document_url: proofDocumentUrl || null,
        })
        .select()
        .single()

    if (error) {
        console.error("[submitCafeClaim] Error:", error)
        return { success: false, error: "Failed to submit claim" }
    }

    // Get cafe details for notification
    const { data: cafeDetails } = await db
        .from("cafes")
        .select("name, slug")
        .eq("id", cafeId)
        .single()

    // Send Discord notification (don't await, fire and forget)
    if (cafeDetails) {
        notifyDiscordCafeClaim(
            { name: cafeDetails.name, slug: cafeDetails.slug },
            userProfile?.display_name || userProfile?.username || "Unknown User",
            proofText
        ).catch(err => console.error("Discord notification failed:", err))
    }

    return { success: true, claim: claim as CafeClaim }
}

/**
 * Get claims submitted by the current user
 */
export async function getUserClaims(): Promise<CafeClaim[]> {
    const db = await createClient()

    const { data: { user } } = await db.auth.getUser()
    if (!user) return []

    const { data: claims, error } = await db
        .from("cafe_claims")
        .select(`
            *,
            cafe:cafes(id, name, slug, thumbnail)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

    if (error) {
        console.error("[getUserClaims] Error:", error)
        return []
    }

    return claims as CafeClaim[]
}

/**
 * Check if current user has a pending claim for a specific cafe
 */
export async function getUserClaimForCafe(cafeId: string): Promise<CafeClaim | null> {
    const db = await createClient()

    const { data: { user } } = await db.auth.getUser()
    if (!user) return null

    const { data: claim } = await db
        .from("cafe_claims")
        .select("*")
        .eq("cafe_id", cafeId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

    return claim as CafeClaim | null
}

/**
 * Get all pending claims (admin only)
 */
export async function getPendingClaims(): Promise<CafeClaim[]> {
    const db = await createClient()

    // Check admin
    const { data: { user } } = await db.auth.getUser()
    if (!user) return []

    const { data: profile } = await db
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

    if (!profile || !["admin", "moderator"].includes(profile.role || "")) {
        return []
    }

    const { data: claims, error } = await db
        .from("cafe_claims")
        .select(`
            *,
            cafe:cafes(id, name, slug, thumbnail),
            user:profiles!cafe_claims_user_id_fkey(id, display_name, username, avatar_url)
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: true })

    if (error) {
        console.error("[getPendingClaims] Error:", error)
        return []
    }

    return claims as CafeClaim[]
}

/**
 * Approve a claim (admin only)
 */
export async function approveClaim(
    claimId: string,
    notes?: string
): Promise<{ success: boolean; error?: string }> {
    const db = await createClient()
    const adminDb = await createAdminClient()

    // Check admin
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    const { data: profile } = await db
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

    if (!profile || !["admin", "moderator"].includes(profile.role || "")) {
        return { success: false, error: "Not authorized" }
    }

    // Get claim
    const { data: claim, error: claimError } = await adminDb
        .from("cafe_claims")
        .select("*")
        .eq("id", claimId)
        .single()

    if (claimError || !claim) {
        return { success: false, error: "Claim not found" }
    }

    // Update claim status
    const { error: updateClaimError } = await adminDb
        .from("cafe_claims")
        .update({
            status: "approved",
            reviewed_at: new Date().toISOString(),
            reviewed_by: user.id,
            admin_notes: notes || null,
        })
        .eq("id", claimId)

    if (updateClaimError) {
        console.error("[approveClaim] Update claim error:", updateClaimError)
        return { success: false, error: "Failed to update claim" }
    }

    // Update cafe ownership
    const { data: cafe } = await adminDb
        .from("cafes")
        .select("owner_ids")
        .eq("id", claim.cafe_id)
        .single()

    const currentOwners = cafe?.owner_ids || []
    if (!currentOwners.includes(claim.user_id)) {
        const { error: updateCafeError } = await adminDb
            .from("cafes")
            .update({
                owner_ids: [...currentOwners, claim.user_id],
                is_claimed: true,
            })
            .eq("id", claim.cafe_id)

        if (updateCafeError) {
            console.error("[approveClaim] Update cafe error:", updateCafeError)
            return { success: false, error: "Failed to update cafe ownership" }
        }
    }

    // Send email notification to claimant
    try {
        // Get claimant display_name from profiles
        const { data: claimantProfile } = await adminDb
            .from("profiles")
            .select("display_name")
            .eq("id", claim.user_id)
            .single()

        // Get claimant email from auth
        const { data: { user: claimantUser } } = await adminDb.auth.admin.getUserById(claim.user_id)

        const { data: cafeData } = await adminDb
            .from("cafes")
            .select("name, slug")
            .eq("id", claim.cafe_id)
            .single()

        if (claimantUser?.email && cafeData) {
            await resend.emails.send({
                from: "Grounds <noreply@grounds.ph>",
                to: claimantUser.email,
                subject: `Your claim for ${cafeData.name} has been approved! 🎉`,
                react: ClaimApprovedEmail({
                    cafeName: cafeData.name,
                    cafeSlug: cafeData.slug,
                    ownerName: claimantProfile?.display_name || undefined,
                }),
            })
        }
    } catch (emailErr) {
        console.error("[approveClaim] Email error:", emailErr)
        // Don't fail the approval if email fails
    }

    return { success: true }
}

/**
 * Reject a claim (admin only)
 */
export async function rejectClaim(
    claimId: string,
    notes?: string
): Promise<{ success: boolean; error?: string }> {
    const db = await createClient()

    // Check admin
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    const { data: profile } = await db
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

    if (!profile || !["admin", "moderator"].includes(profile.role || "")) {
        return { success: false, error: "Not authorized" }
    }

    const { error } = await db
        .from("cafe_claims")
        .update({
            status: "rejected",
            reviewed_at: new Date().toISOString(),
            reviewed_by: user.id,
            admin_notes: notes || null,
        })
        .eq("id", claimId)

    if (error) {
        console.error("[rejectClaim] Error:", error)
        return { success: false, error: "Failed to reject claim" }
    }

    // Send email notification to claimant
    try {
        // Get claim, claimant, and cafe details
        const { data: claimData } = await db
            .from("cafe_claims")
            .select("user_id, cafe_id")
            .eq("id", claimId)
            .single()

        if (claimData) {
            // Get admin client for email lookup
            const adminDb = await createAdminClient()

            // Get claimant display_name from profiles
            const { data: claimantProfile } = await adminDb
                .from("profiles")
                .select("display_name")
                .eq("id", claimData.user_id)
                .single()

            // Get claimant email from auth
            const { data: { user: claimantUser } } = await adminDb.auth.admin.getUserById(claimData.user_id)

            const { data: cafeData } = await db
                .from("cafes")
                .select("name")
                .eq("id", claimData.cafe_id)
                .single()

            if (claimantUser?.email && cafeData) {
                await resend.emails.send({
                    from: "Grounds <noreply@grounds.ph>",
                    to: claimantUser.email,
                    subject: `Update on your claim for ${cafeData.name}`,
                    react: ClaimRejectedEmail({
                        cafeName: cafeData.name,
                        ownerName: claimantProfile?.display_name || undefined,
                        reason: notes || undefined,
                    }),
                })
            }
        }
    } catch (emailErr) {
        console.error("[rejectClaim] Email error:", emailErr)
        // Don't fail the rejection if email fails
    }

    return { success: true }
}
