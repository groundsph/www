"use server"

import { db } from "@/db"
import { discountCampaigns, discountVouchers, voucherRedemptionLogs, cafes, profiles } from "@/db/schema"
import { eq, and, desc, sql, inArray, lt, gt } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import {
  createCampaignSchema,
  updateCampaignSchema,
  generateVouchersSchema,
  claimVoucherSchema,
  claimVoucherByCodeSchema,
  redeemVoucherSchema,
  issueVoucherToUserSchema,
  type CreateCampaignInput,
  type UpdateCampaignInput,
  type GenerateVouchersInput,
  type ClaimVoucherInput,
  type ClaimVoucherByCodeInput,
  type RedeemVoucherInput,
  type IssueVoucherToUserInput,
  type CampaignFiltersInput,
} from "@/utils/validation/discount"
import type {
  DiscountCampaign,
  CampaignStats,
  UserVoucher,
  RedeemableVoucher,
  VoucherRedemptionLog,
} from "@/utils/types/discount"

// Helper: Check if user owns the cafe
async function checkCafeOwnership(cafeId: string, userId: string): Promise<boolean> {
  const result = await db
    .select({ ownerIds: cafes.ownerIds })
    .from(cafes)
    .where(eq(cafes.id, cafeId))
    .limit(1)

  if (result.length === 0) return false
  return result[0]?.ownerIds?.includes(userId) ?? false
}

// Helper: Generate unique voucher code
function generateVoucherCode(prefix: string = "GROUNDS"): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  const segmentLength = 4
  const segments: string[] = []

  for (let s = 0; s < 2; s++) {
    let segment = ""
    for (let i = 0; i < segmentLength; i++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    segments.push(segment)
  }

  return `${prefix}-${segments.join("-")}`
}

// Helper: Serialize campaign for client
function serializeCampaign(campaign: typeof discountCampaigns.$inferSelect, cafeInfo?: { name: string; slug: string; thumbnail: string | null | undefined }): DiscountCampaign {
  return {
    id: campaign.id,
    cafeId: campaign.cafeId,
    name: campaign.name,
    description: campaign.description,
    discountType: campaign.discountType as "percentage" | "fixed_amount" | "free_item",
    discountValue: campaign.discountValue,
    freeItemName: campaign.freeItemName,
    freeItemDescription: campaign.freeItemDescription,
    maxRedemptions: campaign.maxRedemptions,
    currentRedemptions: campaign.currentRedemptions ?? 0,
    maxPerUser: campaign.maxPerUser,
    minPurchaseAmount: campaign.minPurchaseAmount,
    codePrefix: campaign.codePrefix ?? "GROUNDS",
    startDate: campaign.startDate?.toISOString() ?? "",
    endDate: campaign.endDate?.toISOString() ?? "",
    status: campaign.status as DiscountCampaign["status"],
    isPublic: campaign.isPublic ?? true,
    qrCodeEnabled: campaign.qrCodeEnabled ?? true,
    termsAndConditions: campaign.termsAndConditions,
    imageUrl: campaign.imageUrl,
    createdBy: campaign.createdBy,
    createdAt: campaign.createdAt?.toISOString() ?? "",
    updatedAt: campaign.updatedAt?.toISOString() ?? "",
    cafeName: cafeInfo?.name,
    cafeSlug: cafeInfo?.slug,
    cafeThumbnail: cafeInfo?.thumbnail ?? undefined,
  }
}

interface ActionResult<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

// ============================================================================
// CAMPAIGN CRUD
// ============================================================================

/**
 * Get all campaigns for a cafe (owner view)
 */
export async function getCampaignsForCafe(
  cafeId: string,
  filters?: CampaignFiltersInput
): Promise<ActionResult<{ campaigns: DiscountCampaign[]; stats: CampaignStats }>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { success: false, error: "Not authenticated" }

  const isOwner = await checkCafeOwnership(cafeId, currentUser.id)
  if (!isOwner) return { success: false, error: "Not authorized" }

  try {
    const conditions = [eq(discountCampaigns.cafeId, cafeId)]

    if (filters?.status) {
      conditions.push(eq(discountCampaigns.status, filters.status))
    }

    const campaigns = await db
      .select()
      .from(discountCampaigns)
      .where(and(...conditions))
      .orderBy(desc(discountCampaigns.createdAt))

    let filteredCampaigns = campaigns

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase()
      filteredCampaigns = filteredCampaigns.filter(
        (c) =>
          c.name.toLowerCase().includes(searchLower) ||
          (c.description?.toLowerCase().includes(searchLower) ?? false)
      )
    }

    const serialized: DiscountCampaign[] = filteredCampaigns.map((c) =>
      serializeCampaign(c)
    )

    // Aggregate voucher stats across all campaigns
    const campaignIds = filteredCampaigns.map((c) => c.id)
    let stats: CampaignStats = {
      totalVouchers: 0,
      claimedVouchers: 0,
      redeemedVouchers: 0,
      availableVouchers: 0,
      expiredVouchers: 0,
    }

    if (campaignIds.length > 0) {
      const [statsResult] = await db
        .select({
          total: sql<number>`count(*)::int`,
          claimed: sql<number>`count(*) filter (where ${discountVouchers.status} = 'claimed')::int`,
          redeemed: sql<number>`count(*) filter (where ${discountVouchers.status} = 'redeemed')::int`,
          available: sql<number>`count(*) filter (where ${discountVouchers.status} = 'available')::int`,
          expired: sql<number>`count(*) filter (where ${discountVouchers.status} = 'expired')::int`,
        })
        .from(discountVouchers)
        .where(inArray(discountVouchers.campaignId, campaignIds))

      stats = {
        totalVouchers: statsResult?.total ?? 0,
        claimedVouchers: statsResult?.claimed ?? 0,
        redeemedVouchers: statsResult?.redeemed ?? 0,
        availableVouchers: statsResult?.available ?? 0,
        expiredVouchers: statsResult?.expired ?? 0,
      }
    }

    return { success: true, data: { campaigns: serialized, stats } }
  } catch (error) {
    console.error("[getCampaignsForCafe] Error:", error)
    return { success: false, error: "Failed to fetch campaigns" }
  }
}

/**
 * Get a single campaign by ID (owner view)
 */
export async function getCampaignById(
  campaignId: string
): Promise<ActionResult<{ campaign: DiscountCampaign; stats: CampaignStats }>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { success: false, error: "Not authenticated" }

  try {
    const [campaign] = await db
      .select()
      .from(discountCampaigns)
      .where(eq(discountCampaigns.id, campaignId))
      .limit(1)

    if (!campaign) return { success: false, error: "Campaign not found" }

    const isOwner = await checkCafeOwnership(campaign.cafeId, currentUser.id)
    if (!isOwner) return { success: false, error: "Not authorized" }

    // Get stats
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(discountVouchers)
      .where(eq(discountVouchers.campaignId, campaignId))

    const [claimedResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(discountVouchers)
      .where(and(eq(discountVouchers.campaignId, campaignId), eq(discountVouchers.status, "claimed")))

    const [redeemedResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(discountVouchers)
      .where(and(eq(discountVouchers.campaignId, campaignId), eq(discountVouchers.status, "redeemed")))

    const [availableResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(discountVouchers)
      .where(and(eq(discountVouchers.campaignId, campaignId), eq(discountVouchers.status, "available")))

    const [expiredResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(discountVouchers)
      .where(and(eq(discountVouchers.campaignId, campaignId), eq(discountVouchers.status, "expired")))

    const stats: CampaignStats = {
      totalVouchers: totalResult?.count ?? 0,
      claimedVouchers: claimedResult?.count ?? 0,
      redeemedVouchers: redeemedResult?.count ?? 0,
      availableVouchers: availableResult?.count ?? 0,
      expiredVouchers: expiredResult?.count ?? 0,
    }

    // Get cafe info
    const [cafeInfo] = await db
      .select({ name: cafes.name, slug: cafes.slug, thumbnail: cafes.thumbnail })
      .from(cafes)
      .where(eq(cafes.id, campaign.cafeId))
      .limit(1)

    const serialized = serializeCampaign(campaign, cafeInfo ? { name: cafeInfo.name, slug: cafeInfo.slug, thumbnail: cafeInfo.thumbnail } : undefined)

    return { success: true, data: { campaign: serialized, stats } }
  } catch (error) {
    console.error("[getCampaignById] Error:", error)
    return { success: false, error: "Failed to fetch campaign" }
  }
}

/**
 * Create a new discount campaign
 */
export async function createCampaign(
  cafeId: string,
  input: CreateCampaignInput
): Promise<ActionResult<{ campaign: DiscountCampaign }>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { success: false, error: "Not authenticated" }

  const isOwner = await checkCafeOwnership(cafeId, currentUser.id)
  if (!isOwner) return { success: false, error: "Not authorized" }

  const validationResult = createCampaignSchema.safeParse(input)
  if (!validationResult.success) {
    return { success: false, error: "Invalid input: " + validationResult.error.message }
  }

  const data = validationResult.data

  try {
    const [campaign] = await db
      .insert(discountCampaigns)
      .values({
        cafeId,
        name: data.name,
        description: data.description ?? null,
        discountType: data.discountType,
        discountValue: data.discountValue,
        freeItemName: data.freeItemName ?? null,
        freeItemDescription: data.freeItemDescription ?? null,
        maxRedemptions: data.maxRedemptions,
        maxPerUser: data.maxPerUser ?? 1,
        minPurchaseAmount: data.minPurchaseAmount ?? null,
        codePrefix: data.codePrefix ?? "GROUNDS",
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        status: "draft",
        isPublic: data.isPublic ?? true,
        qrCodeEnabled: data.qrCodeEnabled ?? true,
        termsAndConditions: data.termsAndConditions ?? null,
        createdBy: currentUser.id,
      })
      .returning()

    revalidatePath(`/owner/cafes/${cafeId}/discounts`)

    return { success: true, data: { campaign: serializeCampaign(campaign!) } }
  } catch (error) {
    console.error("[createCampaign] Error:", error)
    return { success: false, error: "Failed to create campaign" }
  }
}

/**
 * Update a campaign
 */
export async function updateCampaign(
  campaignId: string,
  input: UpdateCampaignInput
): Promise<ActionResult<{ campaign: DiscountCampaign }>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { success: false, error: "Not authenticated" }

  const validationResult = updateCampaignSchema.safeParse(input)
  if (!validationResult.success) {
    return { success: false, error: "Invalid input: " + validationResult.error.message }
  }

  try {
    const [existingCampaign] = await db
      .select()
      .from(discountCampaigns)
      .where(eq(discountCampaigns.id, campaignId))
      .limit(1)

    if (!existingCampaign) return { success: false, error: "Campaign not found" }

    const isOwner = await checkCafeOwnership(existingCampaign.cafeId, currentUser.id)
    if (!isOwner) return { success: false, error: "Not authorized" }

    const updateData: Partial<typeof discountCampaigns.$inferInsert> = {
      updatedAt: new Date(),
    }

    const data = validationResult.data
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.discountValue !== undefined) updateData.discountValue = data.discountValue
    if (data.freeItemName !== undefined) updateData.freeItemName = data.freeItemName
    if (data.freeItemDescription !== undefined) updateData.freeItemDescription = data.freeItemDescription
    if (data.maxRedemptions !== undefined) updateData.maxRedemptions = data.maxRedemptions
    if (data.maxPerUser !== undefined) updateData.maxPerUser = data.maxPerUser
    if (data.minPurchaseAmount !== undefined) updateData.minPurchaseAmount = data.minPurchaseAmount
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate)
    if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate)
    if (data.status !== undefined) updateData.status = data.status
    if (data.isPublic !== undefined) updateData.isPublic = data.isPublic
    if (data.qrCodeEnabled !== undefined) updateData.qrCodeEnabled = data.qrCodeEnabled
    if (data.termsAndConditions !== undefined) updateData.termsAndConditions = data.termsAndConditions
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl

    const [campaign] = await db
      .update(discountCampaigns)
      .set(updateData)
      .where(eq(discountCampaigns.id, campaignId))
      .returning()

    revalidatePath(`/owner/cafes/${existingCampaign.cafeId}/discounts`)

    return { success: true, data: { campaign: serializeCampaign(campaign!) } }
  } catch (error) {
    console.error("[updateCampaign] Error:", error)
    return { success: false, error: "Failed to update campaign" }
  }
}

/**
 * Delete a campaign (archive it)
 */
export async function deleteCampaign(
  campaignId: string
): Promise<ActionResult<void>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { success: false, error: "Not authenticated" }

  try {
    const [campaign] = await db
      .select()
      .from(discountCampaigns)
      .where(eq(discountCampaigns.id, campaignId))
      .limit(1)

    if (!campaign) return { success: false, error: "Campaign not found" }

    const isOwner = await checkCafeOwnership(campaign.cafeId, currentUser.id)
    if (!isOwner) return { success: false, error: "Not authorized" }

    // Cancel all available vouchers
    await db
      .update(discountVouchers)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(
          eq(discountVouchers.campaignId, campaignId),
          eq(discountVouchers.status, "available")
        )
      )

    // Archive the campaign
    await db
      .update(discountCampaigns)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(discountCampaigns.id, campaignId))

    revalidatePath(`/owner/cafes/${campaign.cafeId}/discounts`)

    return { success: true }
  } catch (error) {
    console.error("[deleteCampaign] Error:", error)
    return { success: false, error: "Failed to delete campaign" }
  }
}

// ============================================================================
// VOUCHER GENERATION
// ============================================================================

/**
 * Generate vouchers for a campaign
 */
export async function generateVouchers(
  input: GenerateVouchersInput
): Promise<ActionResult<{ vouchers: { id: string; code: string }[] }>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { success: false, error: "Not authenticated" }

  const validationResult = generateVouchersSchema.safeParse(input)
  if (!validationResult.success) {
    return { success: false, error: "Invalid input: " + validationResult.error.message }
  }

  try {
    const [campaign] = await db
      .select()
      .from(discountCampaigns)
      .where(eq(discountCampaigns.id, input.campaignId))
      .limit(1)

    if (!campaign) return { success: false, error: "Campaign not found" }

    const isOwner = await checkCafeOwnership(campaign.cafeId, currentUser.id)
    if (!isOwner) return { success: false, error: "Not authorized" }

    // Check total vouchers doesn't exceed maxRedemptions
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(discountVouchers)
      .where(eq(discountVouchers.campaignId, input.campaignId))

    const existingCount = totalResult?.count ?? 0
    if (existingCount + input.count > campaign.maxRedemptions) {
      return { success: false, error: `Can only generate ${campaign.maxRedemptions - existingCount} more vouchers (max: ${campaign.maxRedemptions})` }
    }

    // Generate voucher codes
    const voucherValues = []
    const codes = new Set<string>()

    for (let i = 0; i < input.count; i++) {
      let code: string
      do {
        code = generateVoucherCode(campaign.codePrefix ?? "GROUNDS")
      } while (codes.has(code))
      codes.add(code)

      voucherValues.push({
        campaignId: campaign.id,
        code,
        status: "available" as const,
        expiresAt: campaign.endDate,
      })
    }

    const inserted = await db
      .insert(discountVouchers)
      .values(voucherValues)
      .returning({ id: discountVouchers.id, code: discountVouchers.code })

    // If campaign is draft, activate it
    if (campaign.status === "draft") {
      await db
        .update(discountCampaigns)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(discountCampaigns.id, campaign.id))
    }

    revalidatePath(`/owner/cafes/${campaign.cafeId}/discounts`)

    return {
      success: true,
      data: { vouchers: inserted.map((v) => ({ id: v.id, code: v.code })) },
    }
  } catch (error) {
    console.error("[generateVouchers] Error:", error)
    return { success: false, error: "Failed to generate vouchers" }
  }
}

/**
 * Issue a voucher directly to a specific user
 */
export async function issueVoucherToUser(
  input: IssueVoucherToUserInput
): Promise<ActionResult<{ voucher: { id: string; code: string } }>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { success: false, error: "Not authenticated" }

  const validationResult = issueVoucherToUserSchema.safeParse(input)
  if (!validationResult.success) {
    return { success: false, error: "Invalid input: " + validationResult.error.message }
  }

  try {
    const [campaign] = await db
      .select()
      .from(discountCampaigns)
      .where(eq(discountCampaigns.id, input.campaignId))
      .limit(1)

    if (!campaign) return { success: false, error: "Campaign not found" }

    const isOwner = await checkCafeOwnership(campaign.cafeId, currentUser.id)
    if (!isOwner) return { success: false, error: "Not authorized" }

    // Check that target user exists
    const [targetUser] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.id, input.userId))
      .limit(1)

    if (!targetUser) return { success: false, error: "Target user not found" }

    // Check max per user
    const [userVoucherCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(discountVouchers)
      .where(
        and(
          eq(discountVouchers.campaignId, input.campaignId),
          eq(discountVouchers.userId, input.userId),
          sql`${discountVouchers.status} IN ('claimed', 'available')`
        )
      )

    if (campaign.maxPerUser && (userVoucherCount?.count ?? 0) >= campaign.maxPerUser) {
      return { success: false, error: "User has reached the maximum vouchers for this campaign" }
    }

    // Check total capacity
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(discountVouchers)
      .where(eq(discountVouchers.campaignId, input.campaignId))

    if ((totalResult?.count ?? 0) >= campaign.maxRedemptions) {
      return { success: false, error: "Campaign has reached maximum redemptions" }
    }

    const code = generateVoucherCode(campaign.codePrefix ?? "GROUNDS")

    const [voucher] = await db
      .insert(discountVouchers)
      .values({
        campaignId: campaign.id,
        code,
        userId: input.userId,
        status: "claimed",
        claimedAt: new Date(),
        expiresAt: campaign.endDate,
      })
      .returning({ id: discountVouchers.id, code: discountVouchers.code })

    revalidatePath(`/owner/cafes/${campaign.cafeId}/discounts`)

    return { success: true, data: { voucher: { id: voucher!.id, code: voucher!.code } } }
  } catch (error) {
    console.error("[issueVoucherToUser] Error:", error)
    return { success: false, error: "Failed to issue voucher" }
  }
}

// ============================================================================
// VOUCHER CLAIMING (User)
// ============================================================================

/**
 * Get public campaigns for a cafe (user view)
 */
export async function getPublicCampaignsForCafe(
  cafeId: string
): Promise<ActionResult<{ campaigns: DiscountCampaign[] }>> {
  try {
    const now = new Date()

    const campaigns = await db
      .select()
      .from(discountCampaigns)
      .where(
        and(
          eq(discountCampaigns.cafeId, cafeId),
          eq(discountCampaigns.isPublic, true),
          eq(discountCampaigns.status, "active"),
          lt(discountCampaigns.startDate, now),
          gt(discountCampaigns.endDate, now)
        )
      )
      .orderBy(desc(discountCampaigns.createdAt))

    const serialized = campaigns.map((c) => serializeCampaign(c))

    return { success: true, data: { campaigns: serialized } }
  } catch (error) {
    console.error("[getPublicCampaignsForCafe] Error:", error)
    return { success: false, error: "Failed to fetch campaigns" }
  }
}

/**
 * Claim a voucher from a campaign (user self-claim)
 */
export async function claimVoucher(
  input: ClaimVoucherByCodeInput
): Promise<ActionResult<{ voucher: { id: string; code: string; campaignName: string } }>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { success: false, error: "Not authenticated" }

  const validationResult = claimVoucherByCodeSchema.safeParse(input)
  if (!validationResult.success) {
    return { success: false, error: "Invalid input: " + validationResult.error.message }
  }

  try {
    // Find available voucher with this code
    const [voucher] = await db
      .select()
      .from(discountVouchers)
      .where(and(eq(discountVouchers.code, input.code), eq(discountVouchers.status, "available")))
      .limit(1)

    if (!voucher) return { success: false, error: "Voucher not found or already claimed" }

    // Get the campaign
    const [campaign] = await db
      .select()
      .from(discountCampaigns)
      .where(eq(discountCampaigns.id, voucher.campaignId))
      .limit(1)

    if (!campaign) return { success: false, error: "Campaign not found" }

    // Check campaign is active
    if (campaign.status !== "active") {
      return { success: false, error: "Campaign is not active" }
    }

    const now = new Date()
    if (now < campaign.startDate || now > campaign.endDate) {
      return { success: false, error: "Campaign is not currently active" }
    }

    // Check max per user
    if (campaign.maxPerUser) {
      const [userVoucherCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(discountVouchers)
        .where(
          and(
            eq(discountVouchers.campaignId, campaign.id),
            eq(discountVouchers.userId, currentUser.id),
            sql`${discountVouchers.status} IN ('claimed', 'available')`
          )
        )

      if ((userVoucherCount?.count ?? 0) >= campaign.maxPerUser) {
        return { success: false, error: "You have reached the maximum vouchers for this campaign" }
      }
    }

    // Claim the voucher
    await db
      .update(discountVouchers)
      .set({
        userId: currentUser.id,
        status: "claimed",
        claimedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(discountVouchers.id, voucher.id))

    revalidatePath("/profile/vouchers")

    return {
      success: true,
      data: {
        voucher: {
          id: voucher.id,
          code: voucher.code,
          campaignName: campaign.name,
        },
      },
    }
  } catch (error) {
    console.error("[claimVoucher] Error:", error)
    return { success: false, error: "Failed to claim voucher" }
  }
}

/**
 * Claim a voucher from a campaign by campaign ID (for QR flow)
 */
export async function claimVoucherFromCampaign(
  input: ClaimVoucherInput
): Promise<ActionResult<{ voucher: { id: string; code: string; campaignName: string } }>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { success: false, error: "Not authenticated" }

  const validationResult = claimVoucherSchema.safeParse(input)
  if (!validationResult.success) {
    return { success: false, error: "Invalid input: " + validationResult.error.message }
  }

  try {
    const [campaign] = await db
      .select()
      .from(discountCampaigns)
      .where(eq(discountCampaigns.id, input.campaignId))
      .limit(1)

    if (!campaign) return { success: false, error: "Campaign not found" }

    // Check campaign is active
    if (campaign.status !== "active") {
      return { success: false, error: "Campaign is not active" }
    }

    const now = new Date()
    if (now < campaign.startDate || now > campaign.endDate) {
      return { success: false, error: "Campaign is not currently active" }
    }

    // Check max per user
    if (campaign.maxPerUser) {
      const [userVoucherCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(discountVouchers)
        .where(
          and(
            eq(discountVouchers.campaignId, campaign.id),
            eq(discountVouchers.userId, currentUser.id),
            sql`${discountVouchers.status} IN ('claimed', 'available')`
          )
        )

      if ((userVoucherCount?.count ?? 0) >= campaign.maxPerUser) {
        return { success: false, error: "You have reached the maximum vouchers for this campaign" }
      }
    }

    // Find an available voucher
    const [availableVoucher] = await db
      .select()
      .from(discountVouchers)
      .where(
        and(
          eq(discountVouchers.campaignId, campaign.id),
          eq(discountVouchers.status, "available")
        )
      )
      .limit(1)

    if (!availableVoucher) {
      return { success: false, error: "No vouchers available for this campaign" }
    }

    // Claim it
    await db
      .update(discountVouchers)
      .set({
        userId: currentUser.id,
        status: "claimed",
        claimedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(discountVouchers.id, availableVoucher.id))

    revalidatePath("/profile/vouchers")

    return {
      success: true,
      data: {
        voucher: {
          id: availableVoucher.id,
          code: availableVoucher.code,
          campaignName: campaign.name,
        },
      },
    }
  } catch (error) {
    console.error("[claimVoucherFromCampaign] Error:", error)
    return { success: false, error: "Failed to claim voucher" }
  }
}

// ============================================================================
// VOUCHER REDEMPTION (Owner)
// ============================================================================

/**
 * Redeem a voucher (owner action)
 */
export async function redeemVoucher(
  input: RedeemVoucherInput
): Promise<ActionResult<{ voucher: RedeemableVoucher }>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { success: false, error: "Not authenticated" }

  const validationResult = redeemVoucherSchema.safeParse(input)
  if (!validationResult.success) {
    return { success: false, error: "Invalid input: " + validationResult.error.message }
  }

  try {
    // Find the voucher by code
    const [voucher] = await db
      .select()
      .from(discountVouchers)
      .where(eq(discountVouchers.code, input.code))
      .limit(1)

    if (!voucher) return { success: false, error: "Voucher not found" }
    if (voucher.status !== "claimed") {
      return { success: false, error: `Voucher is ${voucher.status}, cannot be redeemed` }
    }

    // Get the campaign
    const [campaign] = await db
      .select()
      .from(discountCampaigns)
      .where(eq(discountCampaigns.id, voucher.campaignId))
      .limit(1)

    if (!campaign) return { success: false, error: "Campaign not found" }

    // Verify current user owns the cafe
    const isOwner = await checkCafeOwnership(campaign.cafeId, currentUser.id)
    if (!isOwner) return { success: false, error: "Not authorized to redeem vouchers for this cafe" }

    // Check campaign dates
    const now = new Date()
    if (now > campaign.endDate) {
      return { success: false, error: "Campaign has expired" }
    }

    // Mark voucher as redeemed
    await db
      .update(discountVouchers)
      .set({
        status: "redeemed",
        redeemedAt: new Date(),
        redeemedByCafeId: campaign.cafeId,
        redemptionNotes: input.notes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(discountVouchers.id, voucher.id))

    // Update campaign redemption count
    await db
      .update(discountCampaigns)
      .set({
        currentRedemptions: sql`${discountCampaigns.currentRedemptions} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(discountCampaigns.id, campaign.id))

    // Create redemption log
    await db.insert(voucherRedemptionLogs).values({
      voucherId: voucher.id,
      campaignId: campaign.id,
      userId: voucher.userId,
      cafeId: campaign.cafeId,
      redeemedBy: currentUser.id,
      code: voucher.code,
      discountType: campaign.discountType,
      discountValue: campaign.discountValue,
      freeItemName: campaign.freeItemName,
      redemptionMethod: input.redemptionMethod,
      notes: input.notes ?? null,
    })

    // Get cafe info for response
    const [cafeInfo] = await db
      .select({ name: cafes.name, slug: cafes.slug, thumbnail: cafes.thumbnail })
      .from(cafes)
      .where(eq(cafes.id, campaign.cafeId))
      .limit(1)

    const result: RedeemableVoucher = {
      id: voucher.id,
      code: voucher.code,
      discountType: campaign.discountType as "percentage" | "fixed_amount" | "free_item",
      discountValue: campaign.discountValue,
      freeItemName: campaign.freeItemName,
      campaignName: campaign.name,
      cafeName: cafeInfo?.name ?? "",
      startDate: campaign.startDate?.toISOString() ?? "",
      endDate: campaign.endDate?.toISOString() ?? "",
      status: "redeemed",
      description: campaign.description,
      termsAndConditions: campaign.termsAndConditions,
      imageUrl: campaign.imageUrl,
    }

    revalidatePath(`/owner/cafes/${campaign.cafeId}/discounts`)

    return { success: true, data: { voucher: result } }
  } catch (error) {
    console.error("[redeemVoucher] Error:", error)
    return { success: false, error: "Failed to redeem voucher" }
  }
}

// ============================================================================
// USER WALLET
// ============================================================================

/**
 * Get all vouchers for the current user (wallet)
 */
export async function getUserVouchers(): Promise<ActionResult<{ vouchers: UserVoucher[] }>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { success: false, error: "Not authenticated" }

  try {
    const vouchers = await db
      .select({
        id: discountVouchers.id,
        campaignId: discountVouchers.campaignId,
        code: discountVouchers.code,
        userId: discountVouchers.userId,
        status: discountVouchers.status,
        claimedAt: discountVouchers.claimedAt,
        redeemedAt: discountVouchers.redeemedAt,
        redeemedByCafeId: discountVouchers.redeemedByCafeId,
        redemptionNotes: discountVouchers.redemptionNotes,
        expiresAt: discountVouchers.expiresAt,
        createdAt: discountVouchers.createdAt,
        updatedAt: discountVouchers.updatedAt,
        campaignName: discountCampaigns.name,
        discountType: discountCampaigns.discountType,
        discountValue: discountCampaigns.discountValue,
        freeItemName: discountCampaigns.freeItemName,
        cafeName: cafes.name,
        cafeSlug: cafes.slug,
        cafeThumbnail: cafes.thumbnail,
        startDate: discountCampaigns.startDate,
        endDate: discountCampaigns.endDate,
        campaignDescription: discountCampaigns.description,
        campaignTerms: discountCampaigns.termsAndConditions,
        campaignImageUrl: discountCampaigns.imageUrl,
      })
      .from(discountVouchers)
      .innerJoin(discountCampaigns, eq(discountVouchers.campaignId, discountCampaigns.id))
      .innerJoin(cafes, eq(discountCampaigns.cafeId, cafes.id))
      .where(
        and(
          eq(discountVouchers.userId, currentUser.id),
          sql`${discountVouchers.status} IN ('claimed', 'redeemed')`
        )
      )
      .orderBy(desc(discountVouchers.claimedAt))

    const serialized: UserVoucher[] = vouchers.map((v) => ({
      id: v.id,
      campaignId: v.campaignId,
      code: v.code,
      userId: v.userId,
      status: v.status as "claimed" | "redeemed",
      claimedAt: v.claimedAt?.toISOString() ?? null,
      redeemedAt: v.redeemedAt?.toISOString() ?? null,
      redeemedByCafeId: v.redeemedByCafeId,
      redemptionNotes: v.redemptionNotes,
      expiresAt: v.expiresAt?.toISOString() ?? null,
      createdAt: v.createdAt?.toISOString() ?? "",
      updatedAt: v.updatedAt?.toISOString() ?? "",
      campaign: {
        name: v.campaignName,
        discountType: v.discountType as "percentage" | "fixed_amount" | "free_item",
        discountValue: v.discountValue,
        freeItemName: v.freeItemName,
        cafeName: v.cafeName,
        cafeSlug: v.cafeSlug,
        cafeThumbnail: v.cafeThumbnail,
        startDate: v.startDate?.toISOString() ?? "",
        endDate: v.endDate?.toISOString() ?? "",
        termsAndConditions: v.campaignTerms,
        imageUrl: v.campaignImageUrl,
      },
    }))

    return { success: true, data: { vouchers: serialized } }
  } catch (error) {
    console.error("[getUserVouchers] Error:", error)
    return { success: false, error: "Failed to fetch vouchers" }
  }
}

/**
 * Get vouchers for a specific campaign (owner view)
 */
interface CampaignVoucher {
  id: string
  campaignId: string
  code: string
  userId: string | null
  status: string
  claimedAt: string | null
  redeemedAt: string | null
  redeemedByCafeId: string | null
  redemptionNotes: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

export async function getCampaignVouchers(
  campaignId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<ActionResult<{ vouchers: CampaignVoucher[]; total: number }>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { success: false, error: "Not authenticated" }

  try {
    const [campaign] = await db
      .select()
      .from(discountCampaigns)
      .where(eq(discountCampaigns.id, campaignId))
      .limit(1)

    if (!campaign) return { success: false, error: "Campaign not found" }

    const isOwner = await checkCafeOwnership(campaign.cafeId, currentUser.id)
    if (!isOwner) return { success: false, error: "Not authorized" }

    const offset = (page - 1) * pageSize

    const vouchers = await db
      .select()
      .from(discountVouchers)
      .where(eq(discountVouchers.campaignId, campaignId))
      .orderBy(desc(discountVouchers.createdAt))
      .limit(pageSize)
      .offset(offset)

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(discountVouchers)
      .where(eq(discountVouchers.campaignId, campaignId))

    return {
      success: true,
      data: {
        vouchers: vouchers.map((v) => ({
          ...v,
          status: v.status as string,
          claimedAt: v.claimedAt?.toISOString() ?? null,
          redeemedAt: v.redeemedAt?.toISOString() ?? null,
          expiresAt: v.expiresAt?.toISOString() ?? null,
          createdAt: v.createdAt?.toISOString() ?? "",
          updatedAt: v.updatedAt?.toISOString() ?? "",
        })),
        total: countResult?.count ?? 0,
      },
    }
  } catch (error) {
    console.error("[getCampaignVouchers] Error:", error)
    return { success: false, error: "Failed to fetch vouchers" }
  }
}

/**
 * Look up a voucher by code (for owner scanning/entering)
 */
export async function lookupVoucherByCode(
  code: string
): Promise<ActionResult<{ voucher: RedeemableVoucher }>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { success: false, error: "Not authenticated" }

  try {
    const [voucher] = await db
      .select()
      .from(discountVouchers)
      .where(eq(discountVouchers.code, code))
      .limit(1)

    if (!voucher) return { success: false, error: "Voucher not found" }

    const [campaign] = await db
      .select()
      .from(discountCampaigns)
      .where(eq(discountCampaigns.id, voucher.campaignId))
      .limit(1)

    if (!campaign) return { success: false, error: "Campaign not found" }

    // Verify current user owns the cafe
    const isOwner = await checkCafeOwnership(campaign.cafeId, currentUser.id)
    if (!isOwner) return { success: false, error: "Not authorized" }

    const [cafeInfo] = await db
      .select({ name: cafes.name, slug: cafes.slug, thumbnail: cafes.thumbnail })
      .from(cafes)
      .where(eq(cafes.id, campaign.cafeId))
      .limit(1)

    const result: RedeemableVoucher = {
      id: voucher.id,
      code: voucher.code,
      discountType: campaign.discountType as "percentage" | "fixed_amount" | "free_item",
      discountValue: campaign.discountValue,
      freeItemName: campaign.freeItemName,
      campaignName: campaign.name,
      cafeName: cafeInfo?.name ?? "",
      startDate: campaign.startDate?.toISOString() ?? "",
      endDate: campaign.endDate?.toISOString() ?? "",
      status: voucher.status as string,
      description: campaign.description,
      termsAndConditions: campaign.termsAndConditions,
      imageUrl: campaign.imageUrl,
    }

    return { success: true, data: { voucher: result } }
  } catch (error) {
    console.error("[lookupVoucherByCode] Error:", error)
    return { success: false, error: "Failed to look up voucher" }
  }
}

/**
 * Cancel a voucher (owner action)
 */
export async function cancelVoucher(
  voucherId: string
): Promise<ActionResult<void>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { success: false, error: "Not authenticated" }

  try {
    const [voucher] = await db
      .select()
      .from(discountVouchers)
      .where(eq(discountVouchers.id, voucherId))
      .limit(1)

    if (!voucher) return { success: false, error: "Voucher not found" }

    const [campaign] = await db
      .select()
      .from(discountCampaigns)
      .where(eq(discountCampaigns.id, voucher.campaignId))
      .limit(1)

    if (!campaign) return { success: false, error: "Campaign not found" }

    const isOwner = await checkCafeOwnership(campaign.cafeId, currentUser.id)
    if (!isOwner) return { success: false, error: "Not authorized" }

    if (voucher.status === "redeemed") {
      return { success: false, error: "Cannot cancel a redeemed voucher" }
    }

    await db
      .update(discountVouchers)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(discountVouchers.id, voucherId))

    revalidatePath(`/owner/cafes/${campaign.cafeId}/discounts`)

    return { success: true }
  } catch (error) {
    console.error("[cancelVoucher] Error:", error)
    return { success: false, error: "Failed to cancel voucher" }
  }
}

/**
 * Get redemption logs for a campaign (owner view)
 */
export async function getRedemptionLogs(
  campaignId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<ActionResult<{ logs: VoucherRedemptionLog[]; total: number }>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { success: false, error: "Not authenticated" }

  try {
    const [campaign] = await db
      .select()
      .from(discountCampaigns)
      .where(eq(discountCampaigns.id, campaignId))
      .limit(1)

    if (!campaign) return { success: false, error: "Campaign not found" }

    const isOwner = await checkCafeOwnership(campaign.cafeId, currentUser.id)
    if (!isOwner) return { success: false, error: "Not authorized" }

    const offset = (page - 1) * pageSize

    const logs = await db
      .select()
      .from(voucherRedemptionLogs)
      .where(eq(voucherRedemptionLogs.campaignId, campaignId))
      .orderBy(desc(voucherRedemptionLogs.createdAt))
      .limit(pageSize)
      .offset(offset)

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(voucherRedemptionLogs)
      .where(eq(voucherRedemptionLogs.campaignId, campaignId))

    return {
      success: true,
      data: {
        logs: logs.map((log) => ({
          ...log,
          createdAt: log.createdAt ? log.createdAt.toISOString() : "",
        })),
        total: countResult?.count ?? 0,
      },
    }
  } catch (error) {
    console.error("[getRedemptionLogs] Error:", error)
    return { success: false, error: "Failed to fetch redemption logs" }
  }
}

/**
 * Get all campaigns for owner dashboard (across all owned cafes)
 */
export async function getOwnerCampaigns(): Promise<ActionResult<{ campaigns: DiscountCampaign[] }>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { success: false, error: "Not authenticated" }

  try {
    // Get all cafes owned by user
    const ownedCafes = await db
      .select({ id: cafes.id })
      .from(cafes)
      .where(sql`${cafes.ownerIds} @> ARRAY[${currentUser.id}]::uuid[]`)

    if (ownedCafes.length === 0) return { success: true, data: { campaigns: [] } }

    const cafeIds = ownedCafes.map((c) => c.id)

    const campaigns = await db
      .select({
        id: discountCampaigns.id,
        cafeId: discountCampaigns.cafeId,
        name: discountCampaigns.name,
        description: discountCampaigns.description,
        discountType: discountCampaigns.discountType,
        discountValue: discountCampaigns.discountValue,
        freeItemName: discountCampaigns.freeItemName,
        freeItemDescription: discountCampaigns.freeItemDescription,
        maxRedemptions: discountCampaigns.maxRedemptions,
        currentRedemptions: discountCampaigns.currentRedemptions,
        maxPerUser: discountCampaigns.maxPerUser,
        minPurchaseAmount: discountCampaigns.minPurchaseAmount,
        codePrefix: discountCampaigns.codePrefix,
        startDate: discountCampaigns.startDate,
        endDate: discountCampaigns.endDate,
        status: discountCampaigns.status,
        isPublic: discountCampaigns.isPublic,
        qrCodeEnabled: discountCampaigns.qrCodeEnabled,
        termsAndConditions: discountCampaigns.termsAndConditions,
        imageUrl: discountCampaigns.imageUrl,
        createdBy: discountCampaigns.createdBy,
        createdAt: discountCampaigns.createdAt,
        updatedAt: discountCampaigns.updatedAt,
        cafeName: cafes.name,
        cafeSlug: cafes.slug,
        cafeThumbnail: cafes.thumbnail,
      })
      .from(discountCampaigns)
      .innerJoin(cafes, eq(discountCampaigns.cafeId, cafes.id))
      .where(inArray(discountCampaigns.cafeId, cafeIds))
      .orderBy(desc(discountCampaigns.createdAt))

    const serialized: DiscountCampaign[] = campaigns.map((c) => ({
      id: c.id,
      cafeId: c.cafeId,
      name: c.name,
      description: c.description,
      discountType: c.discountType as "percentage" | "fixed_amount" | "free_item",
      discountValue: c.discountValue,
      freeItemName: c.freeItemName,
      freeItemDescription: c.freeItemDescription,
      maxRedemptions: c.maxRedemptions,
      currentRedemptions: c.currentRedemptions ?? 0,
      maxPerUser: c.maxPerUser,
      minPurchaseAmount: c.minPurchaseAmount,
      codePrefix: c.codePrefix ?? "GROUNDS",
      startDate: c.startDate?.toISOString() ?? "",
      endDate: c.endDate?.toISOString() ?? "",
      status: c.status as DiscountCampaign["status"],
      isPublic: c.isPublic ?? true,
      qrCodeEnabled: c.qrCodeEnabled ?? true,
      termsAndConditions: c.termsAndConditions,
      imageUrl: c.imageUrl,
      createdBy: c.createdBy,
      createdAt: c.createdAt?.toISOString() ?? "",
      updatedAt: c.updatedAt?.toISOString() ?? "",
      cafeName: c.cafeName,
      cafeSlug: c.cafeSlug,
      cafeThumbnail: c.cafeThumbnail,
    }))

    return { success: true, data: { campaigns: serialized } }
  } catch (error) {
    console.error("[getOwnerCampaigns] Error:", error)
    return { success: false, error: "Failed to fetch campaigns" }
  }
}
