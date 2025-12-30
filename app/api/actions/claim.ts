"use server"

import { db } from "@/db"
import { cafes, cafeClaims, profiles, user } from "@/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
import { notifyDiscordCafeClaim } from "@/app/api/actions/notify"
import { Resend } from "resend"
import ClaimApprovedEmail from "@/emails/ClaimApprovedEmail"
import ClaimRejectedEmail from "@/emails/ClaimRejectedEmail"
import { getStorageProvider, STORAGE_BUCKETS } from "@/utils/storage"

const resend = new Resend(process.env.RESEND_API_KEY)

/**
 * Get a signed URL for an ownership proof document (admin only)
 */
export async function getOwnershipProofSignedUrl(
    proofUrl: string
): Promise<{ success: boolean; url?: string; error?: string }> {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
        return { success: false, error: "Not authenticated" }
    }

    // Check admin/moderator role
    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    const role = profileResult[0]?.role
    if (!role || !["admin", "moderator"].includes(role)) {
        return { success: false, error: "Not authorized" }
    }

    // Use provider-agnostic storage to generate signed URL
    const storage = await getStorageProvider()

    // If proofUrl is a full URL, extract the path from it
    // Otherwise use it directly as a path
    let proofPath = proofUrl
    if (proofUrl.startsWith('http')) {
        const extractedPath = storage.extractPathFromUrl(proofUrl, STORAGE_BUCKETS.OWNERSHIP_PROOFS)
        if (extractedPath) {
            proofPath = extractedPath
        } else {
            console.error("[getOwnershipProofSignedUrl] Could not extract path from URL:", proofUrl)
            return { success: false, error: "Invalid proof URL format" }
        }
    }

    const result = await storage.createSignedUrl(
        STORAGE_BUCKETS.OWNERSHIP_PROOFS,
        proofPath,
        3600 // 1 hour
    )

    if (!result.success || !result.signedUrl) {
        console.error("[getOwnershipProofSignedUrl] Error:", result.error)
        return { success: false, error: "Failed to generate signed URL" }
    }

    return { success: true, url: result.signedUrl }
}

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
    const currentUser = await getCurrentUser()
    if (!currentUser) {
        return { success: false, error: "You must be logged in to claim a cafe" }
    }

    // Check if cafe exists and is not already claimed
    const cafeResult = await db
        .select({ id: cafes.id, isClaimed: cafes.isClaimed, ownerIds: cafes.ownerIds })
        .from(cafes)
        .where(eq(cafes.id, cafeId))
        .limit(1)

    const cafe = cafeResult[0]
    if (!cafe) {
        return { success: false, error: "Cafe not found" }
    }

    if (cafe.isClaimed) {
        return { success: false, error: "This cafe has already been claimed" }
    }

    // Get user profile for notification
    const profileResult = await db
        .select({ displayName: profiles.displayName, username: profiles.username })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    const userProfile = profileResult[0]

    // Check if user already has a pending claim for this cafe
    const existingResult = await db
        .select({ id: cafeClaims.id })
        .from(cafeClaims)
        .where(and(
            eq(cafeClaims.cafeId, cafeId),
            eq(cafeClaims.userId, currentUser.id),
            eq(cafeClaims.status, "pending")
        ))
        .limit(1)

    if (existingResult[0]) {
        return { success: false, error: "You already have a pending claim for this cafe" }
    }

    // Submit claim
    const [inserted] = await db.insert(cafeClaims).values({
        cafeId,
        userId: currentUser.id,
        proofText,
        proofDocumentUrl: proofDocumentUrl || null,
    }).returning()

    if (!inserted) {
        return { success: false, error: "Failed to submit claim" }
    }

    // Get cafe details for notification
    const cafeDetailsResult = await db
        .select({ name: cafes.name, slug: cafes.slug })
        .from(cafes)
        .where(eq(cafes.id, cafeId))
        .limit(1)

    const cafeDetails = cafeDetailsResult[0]

    // Send Discord notification
    if (cafeDetails) {
        notifyDiscordCafeClaim(
            { name: cafeDetails.name, slug: cafeDetails.slug },
            userProfile?.displayName || userProfile?.username || "Unknown User",
            proofText
        ).catch(err => console.error("Discord notification failed:", err))
    }

    const claim: CafeClaim = {
        id: inserted.id,
        cafe_id: inserted.cafeId,
        user_id: inserted.userId,
        status: inserted.status as "pending" | "approved" | "rejected",
        proof_text: inserted.proofText,
        proof_document_url: inserted.proofDocumentUrl,
        admin_notes: inserted.adminNotes,
        created_at: inserted.createdAt?.toISOString() ?? null,
        reviewed_at: inserted.reviewedAt?.toISOString() ?? null,
        reviewed_by: inserted.reviewedBy,
    }

    return { success: true, claim }
}

/**
 * Get claims submitted by the current user
 */
export async function getUserClaims(): Promise<CafeClaim[]> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return []

    const claimsResult = await db
        .select({
            id: cafeClaims.id,
            cafeId: cafeClaims.cafeId,
            userId: cafeClaims.userId,
            status: cafeClaims.status,
            proofText: cafeClaims.proofText,
            proofDocumentUrl: cafeClaims.proofDocumentUrl,
            adminNotes: cafeClaims.adminNotes,
            createdAt: cafeClaims.createdAt,
            reviewedAt: cafeClaims.reviewedAt,
            reviewedBy: cafeClaims.reviewedBy,
            cafeName: cafes.name,
            cafeSlug: cafes.slug,
            cafeThumbnail: cafes.thumbnail,
        })
        .from(cafeClaims)
        .leftJoin(cafes, eq(cafeClaims.cafeId, cafes.id))
        .where(eq(cafeClaims.userId, currentUser.id))
        .orderBy(desc(cafeClaims.createdAt))

    return claimsResult.map(c => ({
        id: c.id,
        cafe_id: c.cafeId,
        user_id: c.userId,
        status: c.status as "pending" | "approved" | "rejected",
        proof_text: c.proofText,
        proof_document_url: c.proofDocumentUrl,
        admin_notes: c.adminNotes,
        created_at: c.createdAt?.toISOString() ?? null,
        reviewed_at: c.reviewedAt?.toISOString() ?? null,
        reviewed_by: c.reviewedBy,
        cafe: c.cafeName ? {
            id: c.cafeId,
            name: c.cafeName,
            slug: c.cafeSlug!,
            thumbnail: c.cafeThumbnail,
        } : undefined,
    }))
}

/**
 * Check if current user has a pending claim for a specific cafe
 */
export async function getUserClaimForCafe(cafeId: string): Promise<CafeClaim | null> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return null

    const result = await db
        .select()
        .from(cafeClaims)
        .where(and(eq(cafeClaims.cafeId, cafeId), eq(cafeClaims.userId, currentUser.id)))
        .orderBy(desc(cafeClaims.createdAt))
        .limit(1)

    const claim = result[0]
    if (!claim) return null

    return {
        id: claim.id,
        cafe_id: claim.cafeId,
        user_id: claim.userId,
        status: claim.status as "pending" | "approved" | "rejected",
        proof_text: claim.proofText,
        proof_document_url: claim.proofDocumentUrl,
        admin_notes: claim.adminNotes,
        created_at: claim.createdAt?.toISOString() ?? null,
        reviewed_at: claim.reviewedAt?.toISOString() ?? null,
        reviewed_by: claim.reviewedBy,
    }
}

/**
 * Get all pending claims (admin only)
 */
export async function getPendingClaims(): Promise<CafeClaim[]> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return []

    // Check admin role
    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    const role = profileResult[0]?.role
    if (!role || !["admin", "moderator"].includes(role)) {
        return []
    }

    const claimsResult = await db
        .select({
            id: cafeClaims.id,
            cafeId: cafeClaims.cafeId,
            userId: cafeClaims.userId,
            status: cafeClaims.status,
            proofText: cafeClaims.proofText,
            proofDocumentUrl: cafeClaims.proofDocumentUrl,
            adminNotes: cafeClaims.adminNotes,
            createdAt: cafeClaims.createdAt,
            reviewedAt: cafeClaims.reviewedAt,
            reviewedBy: cafeClaims.reviewedBy,
            cafeName: cafes.name,
            cafeSlug: cafes.slug,
            cafeThumbnail: cafes.thumbnail,
            userDisplayName: profiles.displayName,
            userUsername: profiles.username,
            userAvatarUrl: profiles.avatarUrl,
        })
        .from(cafeClaims)
        .leftJoin(cafes, eq(cafeClaims.cafeId, cafes.id))
        .leftJoin(profiles, eq(cafeClaims.userId, profiles.id))
        .where(eq(cafeClaims.status, "pending"))
        .orderBy(cafeClaims.createdAt)

    return claimsResult.map(c => ({
        id: c.id,
        cafe_id: c.cafeId,
        user_id: c.userId,
        status: c.status as "pending" | "approved" | "rejected",
        proof_text: c.proofText,
        proof_document_url: c.proofDocumentUrl,
        admin_notes: c.adminNotes,
        created_at: c.createdAt?.toISOString() ?? null,
        reviewed_at: c.reviewedAt?.toISOString() ?? null,
        reviewed_by: c.reviewedBy,
        cafe: c.cafeName ? {
            id: c.cafeId,
            name: c.cafeName,
            slug: c.cafeSlug!,
            thumbnail: c.cafeThumbnail,
        } : undefined,
        user: c.userDisplayName ? {
            id: c.userId,
            display_name: c.userDisplayName,
            username: c.userUsername!,
            avatar_url: c.userAvatarUrl,
        } : undefined,
    }))
}

/**
 * Approve a claim (admin only)
 */
export async function approveClaim(
    claimId: string,
    notes?: string
): Promise<{ success: boolean; error?: string }> {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
        return { success: false, error: "Not authenticated" }
    }

    // Check admin role
    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    const role = profileResult[0]?.role
    if (!role || !["admin", "moderator"].includes(role)) {
        return { success: false, error: "Not authorized" }
    }

    // Get claim
    const claimResult = await db
        .select()
        .from(cafeClaims)
        .where(eq(cafeClaims.id, claimId))
        .limit(1)

    const claim = claimResult[0]
    if (!claim) {
        return { success: false, error: "Claim not found" }
    }

    // Update claim status
    await db.update(cafeClaims).set({
        status: "approved",
        reviewedAt: new Date(),
        reviewedBy: currentUser.id,
        adminNotes: notes || null,
    }).where(eq(cafeClaims.id, claimId))

    // Update cafe ownership
    const cafeResult = await db
        .select({ ownerIds: cafes.ownerIds })
        .from(cafes)
        .where(eq(cafes.id, claim.cafeId))
        .limit(1)

    const currentOwners = cafeResult[0]?.ownerIds || []
    if (!currentOwners.includes(claim.userId)) {
        await db.update(cafes).set({
            ownerIds: [...currentOwners, claim.userId],
            isClaimed: true,
        }).where(eq(cafes.id, claim.cafeId))
    }

    // Send email notification to claimant
    try {
        // Get claimant profile and email
        const [claimantProfile, claimantUser, cafeData] = await Promise.all([
            db.select({ displayName: profiles.displayName }).from(profiles).where(eq(profiles.id, claim.userId)).limit(1),
            db.select({ email: user.email }).from(user).where(eq(user.id, claim.userId)).limit(1),
            db.select({ name: cafes.name, slug: cafes.slug }).from(cafes).where(eq(cafes.id, claim.cafeId)).limit(1),
        ])

        const email = claimantUser[0]?.email
        const cafe = cafeData[0]

        if (email && cafe) {
            await resend.emails.send({
                from: "Grounds <noreply@grounds.ph>",
                to: email,
                subject: `Your claim for ${cafe.name} has been approved! 🎉`,
                react: ClaimApprovedEmail({
                    cafeName: cafe.name,
                    cafeSlug: cafe.slug,
                    ownerName: claimantProfile[0]?.displayName || undefined,
                }),
            })
        }
    } catch (emailErr) {
        console.error("[approveClaim] Email error:", emailErr)
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
    const currentUser = await getCurrentUser()
    if (!currentUser) {
        return { success: false, error: "Not authenticated" }
    }

    // Check admin role
    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    const role = profileResult[0]?.role
    if (!role || !["admin", "moderator"].includes(role)) {
        return { success: false, error: "Not authorized" }
    }

    // Update claim status
    await db.update(cafeClaims).set({
        status: "rejected",
        reviewedAt: new Date(),
        reviewedBy: currentUser.id,
        adminNotes: notes || null,
    }).where(eq(cafeClaims.id, claimId))

    // Send email notification to claimant
    try {
        const claimResult = await db
            .select({ userId: cafeClaims.userId, cafeId: cafeClaims.cafeId })
            .from(cafeClaims)
            .where(eq(cafeClaims.id, claimId))
            .limit(1)

        const claimData = claimResult[0]
        if (claimData) {
            const [claimantProfile, claimantUser, cafeData] = await Promise.all([
                db.select({ displayName: profiles.displayName }).from(profiles).where(eq(profiles.id, claimData.userId)).limit(1),
                db.select({ email: user.email }).from(user).where(eq(user.id, claimData.userId)).limit(1),
                db.select({ name: cafes.name }).from(cafes).where(eq(cafes.id, claimData.cafeId)).limit(1),
            ])

            const email = claimantUser[0]?.email
            const cafe = cafeData[0]

            if (email && cafe) {
                await resend.emails.send({
                    from: "Grounds <noreply@grounds.ph>",
                    to: email,
                    subject: `Update on your claim for ${cafe.name}`,
                    react: ClaimRejectedEmail({
                        cafeName: cafe.name,
                        ownerName: claimantProfile[0]?.displayName || undefined,
                        reason: notes || undefined,
                    }),
                })
            }
        }
    } catch (emailErr) {
        console.error("[rejectClaim] Email error:", emailErr)
    }

    return { success: true }
}
