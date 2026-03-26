"use server"

import { db } from "@/db"
import { mallCafeVerifications, cafes, profiles } from "@/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
import { getUserRole } from "./admin"
import { logSystemAction } from "./system-logs"

export interface MallCafeVerification {
    id: string
    cafeId: string
    submittedBy: string
    verificationType: "owner" | "contributor"
    proofDocumentUrl: string | null
    contractStartDate: Date | null
    contractEndDate: Date | null
    linkedBranchId: string | null
    notes: string | null
    status: "pending" | "verified" | "rejected"
    reviewedBy: string | null
    reviewedAt: Date | null
    adminNotes: string | null
    createdAt: Date
    updatedAt: Date
    cafe?: {
        id: string
        name: string
        slug: string
        thumbnail: string | null
        addressDisplay: string | null
        cityMunicipality: string | null
        province: string | null
        isMallCafe: boolean | null
        mallVerificationStatus: "pending" | "verified" | "rejected" | null
    } | null
    submittedByUser?: {
        id: string
        username: string | null
        displayName: string | null
        avatarUrl: string | null
    } | null
    linkedBranch?: {
        id: string
        name: string
        slug: string
    } | null
}

export interface SubmitMallCafeVerificationInput {
    cafeId: string
    verificationType: "owner" | "contributor"
    proofDocumentUrl?: string | null
    contractStartDate?: Date | null
    contractEndDate?: Date | null
    linkedBranchId?: string | null
    notes?: string | null
}

/**
 * Submit mall cafe verification request
 */
export async function submitMallCafeVerification(
    input: SubmitMallCafeVerificationInput
): Promise<{ success: boolean; error?: string; verificationId?: string }> {
    const user = await getCurrentUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    try {
        // Check if cafe exists
        const [cafe] = await db
            .select({
                id: cafes.id,
                name: cafes.name,
                isMallCafe: cafes.isMallCafe,
            })
            .from(cafes)
            .where(eq(cafes.id, input.cafeId))
            .limit(1)

        if (!cafe) {
            return { success: false, error: "Cafe not found" }
        }

        // Check if there's already a pending verification
        const [existingVerification] = await db
            .select({ id: mallCafeVerifications.id })
            .from(mallCafeVerifications)
            .where(
                and(
                    eq(mallCafeVerifications.cafeId, input.cafeId),
                    eq(mallCafeVerifications.status, "pending")
                )
            )
            .limit(1)

        if (existingVerification) {
            return { success: false, error: "A pending verification already exists for this cafe" }
        }

        // Create verification request
        const [verification] = await db
            .insert(mallCafeVerifications)
            .values({
                cafeId: input.cafeId,
                submittedBy: user.id,
                verificationType: input.verificationType,
                proofDocumentUrl: input.proofDocumentUrl || null,
                contractStartDate: input.contractStartDate || null,
                contractEndDate: input.contractEndDate || null,
                linkedBranchId: input.linkedBranchId || null,
                notes: input.notes || null,
                status: "pending",
            })
            .returning({ id: mallCafeVerifications.id })

        // Update cafe to mark as mall cafe
        await db
            .update(cafes)
            .set({
                isMallCafe: true,
                mallVerificationStatus: "pending",
            })
            .where(eq(cafes.id, input.cafeId))

        return {
            success: true,
            verificationId: verification.id,
        }
    } catch (error) {
        console.error("Error submitting mall cafe verification:", error)
        return { success: false, error: "Failed to submit verification" }
    }
}

/**
 * Get pending mall cafe verifications (admin only)
 */
export async function getPendingMallVerifications(): Promise<{
    success: boolean
    error?: string
    verifications?: MallCafeVerification[]
}> {
    const user = await getCurrentUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    const role = await getUserRole()
    if (role !== "admin" && role !== "moderator") {
        return { success: false, error: "Not authorized" }
    }

    try {
        const results = await db
            .select({
                verification: mallCafeVerifications,
                cafe: {
                    id: cafes.id,
                    name: cafes.name,
                    slug: cafes.slug,
                    thumbnail: cafes.thumbnail,
                    addressDisplay: cafes.addressDisplay,
                    cityMunicipality: cafes.cityMunicipality,
                    province: cafes.province,
                    isMallCafe: cafes.isMallCafe,
                    mallVerificationStatus: cafes.mallVerificationStatus,
                },
                submittedByUser: {
                    id: profiles.id,
                    username: profiles.username,
                    displayName: profiles.displayName,
                    avatarUrl: profiles.avatarUrl,
                },
            })
            .from(mallCafeVerifications)
            .leftJoin(cafes, eq(mallCafeVerifications.cafeId, cafes.id))
            .leftJoin(profiles, eq(mallCafeVerifications.submittedBy, profiles.id))
            .where(eq(mallCafeVerifications.status, "pending"))
            .orderBy(desc(mallCafeVerifications.createdAt))

        const verifications: MallCafeVerification[] = results.map((r) => ({
            id: r.verification.id,
            cafeId: r.verification.cafeId,
            submittedBy: r.verification.submittedBy,
            verificationType: r.verification.verificationType as "owner" | "contributor",
            proofDocumentUrl: r.verification.proofDocumentUrl,
            contractStartDate: r.verification.contractStartDate,
            contractEndDate: r.verification.contractEndDate,
            linkedBranchId: r.verification.linkedBranchId,
            notes: r.verification.notes,
            status: (r.verification.status || "pending") as "pending" | "verified" | "rejected",
            reviewedBy: r.verification.reviewedBy,
            reviewedAt: r.verification.reviewedAt,
            adminNotes: r.verification.adminNotes,
            createdAt: r.verification.createdAt || new Date(),
            updatedAt: r.verification.updatedAt || new Date(),
            cafe: r.cafe,
            submittedByUser: r.submittedByUser,
        }))

        return { success: true, verifications }
    } catch (error) {
        console.error("Error fetching mall verifications:", error)
        return { success: false, error: "Failed to fetch verifications" }
    }
}

/**
 * Approve mall cafe verification (admin only)
 */
export async function approveMallCafeVerification(
    verificationId: string,
    adminNotes?: string
): Promise<{ success: boolean; error?: string }> {
    const user = await getCurrentUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    const role = await getUserRole()
    if (role !== "admin" && role !== "moderator") {
        return { success: false, error: "Not authorized" }
    }

    try {
        // Get verification details
        const [verification] = await db
            .select({
                id: mallCafeVerifications.id,
                cafeId: mallCafeVerifications.cafeId,
                verificationType: mallCafeVerifications.verificationType,
                linkedBranchId: mallCafeVerifications.linkedBranchId,
            })
            .from(mallCafeVerifications)
            .where(eq(mallCafeVerifications.id, verificationId))
            .limit(1)

        if (!verification) {
            return { success: false, error: "Verification not found" }
        }

        // Update verification status
        await db
            .update(mallCafeVerifications)
            .set({
                status: "verified",
                reviewedBy: user.id,
                reviewedAt: new Date(),
                adminNotes: adminNotes || null,
            })
            .where(eq(mallCafeVerifications.id, verificationId))

        // Update cafe status
        await db
            .update(cafes)
            .set({
                mallVerificationStatus: "verified",
            })
            .where(eq(cafes.id, verification.cafeId))

        // Log the action
        await logSystemAction(
            "approve",
            "mall_cafe_verification",
            verificationId,
            { status: "pending" },
            { status: "verified", adminNotes },
            { verificationType: verification.verificationType }
        )

        return { success: true }
    } catch (error) {
        console.error("Error approving mall verification:", error)
        return { success: false, error: "Failed to approve verification" }
    }
}

/**
 * Reject mall cafe verification (admin only)
 */
export async function rejectMallCafeVerification(
    verificationId: string,
    adminNotes?: string
): Promise<{ success: boolean; error?: string }> {
    const user = await getCurrentUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    const role = await getUserRole()
    if (role !== "admin" && role !== "moderator") {
        return { success: false, error: "Not authorized" }
    }

    try {
        // Get verification details
        const [verification] = await db
            .select({
                id: mallCafeVerifications.id,
                cafeId: mallCafeVerifications.cafeId,
                verificationType: mallCafeVerifications.verificationType,
            })
            .from(mallCafeVerifications)
            .where(eq(mallCafeVerifications.id, verificationId))
            .limit(1)

        if (!verification) {
            return { success: false, error: "Verification not found" }
        }

        // Update verification status
        await db
            .update(mallCafeVerifications)
            .set({
                status: "rejected",
                reviewedBy: user.id,
                reviewedAt: new Date(),
                adminNotes: adminNotes || null,
            })
            .where(eq(mallCafeVerifications.id, verificationId))

        // Update cafe status
        await db
            .update(cafes)
            .set({
                mallVerificationStatus: "rejected",
            })
            .where(eq(cafes.id, verification.cafeId))

        // Log the action
        await logSystemAction(
            "reject",
            "mall_cafe_verification",
            verificationId,
            { status: "pending" },
            { status: "rejected", adminNotes },
            { verificationType: verification.verificationType }
        )

        return { success: true }
    } catch (error) {
        console.error("Error rejecting mall verification:", error)
        return { success: false, error: "Failed to reject verification" }
    }
}

/**
 * Get verification document signed URL
 */
export async function getMallVerificationProofUrl(
    documentUrl: string
): Promise<{ success: boolean; url?: string; error?: string }> {
    const user = await getCurrentUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    const role = await getUserRole()
    if (role !== "admin" && role !== "moderator") {
        return { success: false, error: "Not authorized" }
    }

    try {
        // Import storage utility
        const { getOwnershipProofSignedUrl } = await import("./claim")
        return await getOwnershipProofSignedUrl(documentUrl)
    } catch (error) {
        console.error("Error getting proof URL:", error)
        return { success: false, error: "Failed to get document URL" }
    }
}

/**
 * Search for existing branch cafes (for contributor linking)
 */
export async function searchBranchCafes(
    query: string
): Promise<{ success: boolean; cafes?: { id: string; name: string; slug: string; addressDisplay: string | null }[]; error?: string }> {
    const user = await getCurrentUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    try {
        const results = await db
            .select({
                id: cafes.id,
                name: cafes.name,
                slug: cafes.slug,
                addressDisplay: cafes.addressDisplay,
            })
            .from(cafes)
            .where(
                and(
                    eq(cafes.isPublished, true),
                    eq(cafes.isMallCafe, false) // Only non-mall cafes can be linked branches
                )
            )
            .limit(20)

        // Filter by query locally
        const filtered = results.filter(
            (c) =>
                c.name.toLowerCase().includes(query.toLowerCase()) ||
                (c.addressDisplay?.toLowerCase() || "").includes(query.toLowerCase())
        )

        return { success: true, cafes: filtered.slice(0, 10) }
    } catch (error) {
        console.error("Error searching branch cafes:", error)
        return { success: false, error: "Failed to search cafes" }
    }
}

/**
 * Get mall cafe verification by cafe ID
 * Returns the latest verification for a specific cafe
 */
export async function getMallVerificationByCafeId(
    cafeId: string
): Promise<{
    success: boolean
    error?: string
    verification?: MallCafeVerification | null
}> {
    const user = await getCurrentUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    try {
        // Check if user has access to this cafe's verification
        const [cafe] = await db
            .select({
                id: cafes.id,
                ownerIds: cafes.ownerIds,
                contributorId: cafes.contributorId,
            })
            .from(cafes)
            .where(eq(cafes.id, cafeId))
            .limit(1)

        if (!cafe) {
            return { success: false, error: "Cafe not found" }
        }

        const role = await getUserRole()
        const isAdminOrModerator = role === "admin" || role === "moderator"
        const isOwner = cafe.ownerIds?.includes(user.id)
        const isContributor = cafe.contributorId === user.id

        if (!isAdminOrModerator && !isOwner && !isContributor) {
            return { success: false, error: "Not authorized" }
        }

        // Get the latest verification for this cafe
        const results = await db
            .select({
                verification: mallCafeVerifications,
                cafe: {
                    id: cafes.id,
                    name: cafes.name,
                    slug: cafes.slug,
                    thumbnail: cafes.thumbnail,
                    addressDisplay: cafes.addressDisplay,
                    cityMunicipality: cafes.cityMunicipality,
                    province: cafes.province,
                    isMallCafe: cafes.isMallCafe,
                    mallVerificationStatus: cafes.mallVerificationStatus,
                },
                submittedByUser: {
                    id: profiles.id,
                    username: profiles.username,
                    displayName: profiles.displayName,
                    avatarUrl: profiles.avatarUrl,
                },
            })
            .from(mallCafeVerifications)
            .leftJoin(cafes, eq(mallCafeVerifications.cafeId, cafes.id))
            .leftJoin(profiles, eq(mallCafeVerifications.submittedBy, profiles.id))
            .where(eq(mallCafeVerifications.cafeId, cafeId))
            .orderBy(desc(mallCafeVerifications.createdAt))
            .limit(1)

        if (!results.length) {
            return { success: true, verification: null }
        }

        const result = results[0]

        // Fetch linked branch if exists
        let linkedBranch = null
        if (result.verification.linkedBranchId) {
            const [branch] = await db
                .select({
                    id: cafes.id,
                    name: cafes.name,
                    slug: cafes.slug,
                })
                .from(cafes)
                .where(eq(cafes.id, result.verification.linkedBranchId))
                .limit(1)
            linkedBranch = branch || null
        }

        const verification: MallCafeVerification = {
            id: result.verification.id,
            cafeId: result.verification.cafeId,
            submittedBy: result.verification.submittedBy,
            verificationType: result.verification.verificationType as "owner" | "contributor",
            proofDocumentUrl: result.verification.proofDocumentUrl,
            contractStartDate: result.verification.contractStartDate,
            contractEndDate: result.verification.contractEndDate,
            linkedBranchId: result.verification.linkedBranchId,
            notes: result.verification.notes,
            status: (result.verification.status || "pending") as "pending" | "verified" | "rejected",
            reviewedBy: result.verification.reviewedBy,
            reviewedAt: result.verification.reviewedAt,
            adminNotes: result.verification.adminNotes,
            createdAt: result.verification.createdAt || new Date(),
            updatedAt: result.verification.updatedAt || new Date(),
            cafe: result.cafe,
            submittedByUser: result.submittedByUser,
            linkedBranch,
        }

        return { success: true, verification }
    } catch (error) {
        console.error("Error fetching mall verification by cafe ID:", error)
        return { success: false, error: "Failed to fetch verification" }
    }
}
