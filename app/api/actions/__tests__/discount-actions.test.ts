import { describe, it, expect, beforeEach } from "bun:test"
import {
  createCampaignSchema,
  generateVouchersSchema,
  claimVoucherByCodeSchema,
  claimVoucherSchema,
  redeemVoucherSchema,
} from "@/utils/validation/discount"

// ============================================================================
// MOCKS
// ============================================================================

const mockGetCurrentUser = {
  __currentUser: null as { id: string } | null,
  getCurrentUser: async () => mockGetCurrentUser.__currentUser,
  setCurrentUser: (user: { id: string } | null) => {
    mockGetCurrentUser.__currentUser = user
  },
}

// Mock database storage
const mockCampaignsDb: Record<string, {
  id: string
  cafeId: string
  name: string
  description: string | null
  discountType: string
  discountValue: number
  freeItemName: string | null
  freeItemDescription: string | null
  maxRedemptions: number
  currentRedemptions: number
  maxPerUser: number
  minPurchaseAmount: number | null
  codePrefix: string
  startDate: Date
  endDate: Date
  status: string
  isPublic: boolean
  qrCodeEnabled: boolean
  termsAndConditions: string | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
}> = {}

const mockVouchersDb: Record<string, {
  id: string
  campaignId: string
  code: string
  userId: string | null
  status: string
  claimedAt: Date | null
  redeemedAt: Date | null
  redeemedByCafeId: string | null
  redemptionNotes: string | null
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
}> = {}

const mockCafesDb: Record<string, {
  id: string
  ownerIds: string[]
  name: string
  slug: string
  thumbnail: string | null
}> = {}

const mockProfilesDb: Record<string, {
  id: string
  name: string
}> = {}

const mockRedemptionLogsDb: Array<{
  id: string
  voucherId: string
  campaignId: string
  userId: string | null
  cafeId: string
  redeemedBy: string
  code: string
  discountType: string
  discountValue: number
  freeItemName: string | null
  redemptionMethod: string
  notes: string | null
  createdAt: Date
}> = []

// ============================================================================
// TEST HELPERS
// ============================================================================

function generateId(): string {
  return crypto.randomUUID()
}

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

async function createTestCafe(ownerId: string) {
  const id = generateId()
  const cafe = {
    id,
    ownerIds: [ownerId],
    name: `Test Cafe ${id.slice(0, 8)}`,
    slug: `test-cafe-${id.slice(0, 8)}`,
    thumbnail: null,
  }
  mockCafesDb[id] = cafe
  return cafe
}

async function createTestUser(name = "Test User") {
  const id = generateId()
  const user = { id, name }
  mockProfilesDb[id] = user
  return user
}

async function createTestCampaign(cafeId: string, createdBy: string, overrides: Partial<typeof mockCampaignsDb[string]> = {}) {
  const id = generateId()
  const now = new Date()
  const future = new Date(now.getTime() + 86400000 * 30) // 30 days from now

  const campaign = {
    id,
    cafeId,
    name: overrides.name ?? "Test Campaign",
    description: overrides.description ?? null,
    discountType: overrides.discountType ?? "percentage",
    discountValue: overrides.discountValue ?? 20,
    freeItemName: overrides.freeItemName ?? null,
    freeItemDescription: overrides.freeItemDescription ?? null,
    maxRedemptions: overrides.maxRedemptions ?? 100,
    currentRedemptions: overrides.currentRedemptions ?? 0,
    maxPerUser: overrides.maxPerUser ?? 1,
    minPurchaseAmount: overrides.minPurchaseAmount ?? null,
    codePrefix: overrides.codePrefix ?? "GROUNDS",
    startDate: overrides.startDate ?? now,
    endDate: overrides.endDate ?? future,
    status: overrides.status ?? "draft",
    isPublic: overrides.isPublic ?? true,
    qrCodeEnabled: overrides.qrCodeEnabled ?? true,
    termsAndConditions: overrides.termsAndConditions ?? null,
    createdBy,
    createdAt: now,
    updatedAt: now,
  }
  mockCampaignsDb[id] = campaign
  return campaign
}

async function createTestVoucher(campaignId: string, overrides: Partial<typeof mockVouchersDb[string]> = {}) {
  const id = generateId()
  const campaign = mockCampaignsDb[campaignId]
  const code = overrides.code ?? generateVoucherCode(campaign?.codePrefix ?? "GROUNDS")

  const voucher = {
    id,
    campaignId,
    code,
    userId: overrides.userId ?? null,
    status: overrides.status ?? "available",
    claimedAt: overrides.claimedAt ?? null,
    redeemedAt: overrides.redeemedAt ?? null,
    redeemedByCafeId: overrides.redeemedByCafeId ?? null,
    redemptionNotes: overrides.redemptionNotes ?? null,
    expiresAt: overrides.expiresAt ?? campaign?.endDate ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  mockVouchersDb[id] = voucher
  return voucher
}

// ============================================================================
// MOCKED ACTION IMPLEMENTATIONS (based on actual discount.ts)
// ============================================================================

async function checkCafeOwnership(cafeId: string, userId: string): Promise<boolean> {
  const cafe = mockCafesDb[cafeId]
  if (!cafe) return false
  return cafe.ownerIds.includes(userId)
}

async function createCampaign(
  cafeId: string,
  input: {
    name: string
    description?: string
    discountType: "percentage" | "fixed_amount" | "free_item"
    discountValue: number
    freeItemName?: string
    freeItemDescription?: string
    maxRedemptions: number
    maxPerUser?: number
    minPurchaseAmount?: number
    codePrefix?: string
    startDate: string
    endDate: string
    isPublic?: boolean
    qrCodeEnabled?: boolean
    termsAndConditions?: string
  }
): Promise<{ success: boolean; error?: string; data?: { campaign: typeof mockCampaignsDb[string] } }> {
  const currentUser = await mockGetCurrentUser.getCurrentUser()
  if (!currentUser) return { success: false, error: "Not authenticated" }

  const isOwner = await checkCafeOwnership(cafeId, currentUser.id)
  if (!isOwner) return { success: false, error: "Not authorized" }

  const validationResult = createCampaignSchema.safeParse(input)
  if (!validationResult.success) {
    return { success: false, error: "Invalid input: " + validationResult.error.message }
  }

  const data = validationResult.data
  const id = generateId()
  const now = new Date()

  const campaign = {
    id,
    cafeId,
    name: data.name,
    description: data.description ?? null,
    discountType: data.discountType,
    discountValue: data.discountValue,
    freeItemName: data.freeItemName ?? null,
    freeItemDescription: data.freeItemDescription ?? null,
    maxRedemptions: data.maxRedemptions,
    currentRedemptions: 0,
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
    createdAt: now,
    updatedAt: now,
  }

  mockCampaignsDb[id] = campaign
  return { success: true, data: { campaign } }
}

async function generateVouchers(
  input: { campaignId: string; count: number }
): Promise<{ success: boolean; error?: string; data?: { vouchers: Array<{ id: string; code: string }> } }> {
  const currentUser = await mockGetCurrentUser.getCurrentUser()
  if (!currentUser) return { success: false, error: "Not authenticated" }

  const validationResult = generateVouchersSchema.safeParse(input)
  if (!validationResult.success) {
    return { success: false, error: "Invalid input: " + validationResult.error.message }
  }

  const campaign = mockCampaignsDb[input.campaignId]
  if (!campaign) return { success: false, error: "Campaign not found" }

  const isOwner = await checkCafeOwnership(campaign.cafeId, currentUser.id)
  if (!isOwner) return { success: false, error: "Not authorized" }

  // Check capacity
  const existingVouchers = Object.values(mockVouchersDb).filter(v => v.campaignId === input.campaignId)
  if (existingVouchers.length + input.count > campaign.maxRedemptions) {
    return {
      success: false,
      error: `Can only generate ${campaign.maxRedemptions - existingVouchers.length} more vouchers (max: ${campaign.maxRedemptions})`,
    }
  }

  const vouchers: Array<{ id: string; code: string }> = []
  const codes = new Set<string>()

  for (let i = 0; i < input.count; i++) {
    let code: string
    do {
      code = generateVoucherCode(campaign.codePrefix)
    } while (codes.has(code) || Object.values(mockVouchersDb).some(v => v.code === code))
    codes.add(code)

    const id = generateId()
    mockVouchersDb[id] = {
      id,
      campaignId: campaign.id,
      code,
      userId: null,
      status: "available",
      claimedAt: null,
      redeemedAt: null,
      redeemedByCafeId: null,
      redemptionNotes: null,
      expiresAt: campaign.endDate,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    vouchers.push({ id, code })
  }

  // Activate campaign if draft
  if (campaign.status === "draft") {
    campaign.status = "active"
    campaign.updatedAt = new Date()
  }

  return { success: true, data: { vouchers } }
}

async function claimVoucherByCode(
  input: { code: string }
): Promise<{ success: boolean; error?: string; data?: { voucher: { id: string; code: string; campaignName: string } } }> {
  const currentUser = await mockGetCurrentUser.getCurrentUser()
  if (!currentUser) return { success: false, error: "Not authenticated" }

  const validationResult = claimVoucherByCodeSchema.safeParse(input)
  if (!validationResult.success) {
    return { success: false, error: "Invalid input: " + validationResult.error.message }
  }

  const voucher = Object.values(mockVouchersDb).find(
    v => v.code === input.code && v.status === "available"
  )
  if (!voucher) return { success: false, error: "Voucher not found or already claimed" }

  const campaign = mockCampaignsDb[voucher.campaignId]
  if (!campaign) return { success: false, error: "Campaign not found" }

  if (campaign.status !== "active") {
    return { success: false, error: "Campaign is not active" }
  }

  const now = new Date()
  if (now < campaign.startDate || now > campaign.endDate) {
    return { success: false, error: "Campaign is not currently active" }
  }

  // Check max per user
  if (campaign.maxPerUser) {
    const userVoucherCount = Object.values(mockVouchersDb).filter(
      v => v.campaignId === campaign.id &&
        v.userId === currentUser.id &&
        (v.status === "claimed" || v.status === "available")
    ).length

    if (userVoucherCount >= campaign.maxPerUser) {
      return { success: false, error: "You have reached the maximum vouchers for this campaign" }
    }
  }

  // Claim the voucher
  voucher.userId = currentUser.id
  voucher.status = "claimed"
  voucher.claimedAt = new Date()
  voucher.updatedAt = new Date()

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
}

async function claimVoucherFromCampaign(
  input: { campaignId: string }
): Promise<{ success: boolean; error?: string; data?: { voucher: { id: string; code: string; campaignName: string } } }> {
  const currentUser = await mockGetCurrentUser.getCurrentUser()
  if (!currentUser) return { success: false, error: "Not authenticated" }

  const validationResult = claimVoucherSchema.safeParse(input)
  if (!validationResult.success) {
    return { success: false, error: "Invalid input: " + validationResult.error.message }
  }

  const campaign = mockCampaignsDb[input.campaignId]
  if (!campaign) return { success: false, error: "Campaign not found" }

  if (campaign.status !== "active") {
    return { success: false, error: "Campaign is not active" }
  }

  const now = new Date()
  if (now < campaign.startDate || now > campaign.endDate) {
    return { success: false, error: "Campaign is not currently active" }
  }

  // Check max per user
  if (campaign.maxPerUser) {
    const userVoucherCount = Object.values(mockVouchersDb).filter(
      v => v.campaignId === campaign.id &&
        v.userId === currentUser.id &&
        (v.status === "claimed" || v.status === "available")
    ).length

    if (userVoucherCount >= campaign.maxPerUser) {
      return { success: false, error: "You have reached the maximum vouchers for this campaign" }
    }
  }

  // Find available voucher
  const availableVoucher = Object.values(mockVouchersDb).find(
    v => v.campaignId === campaign.id && v.status === "available"
  )

  if (!availableVoucher) {
    return { success: false, error: "No vouchers available for this campaign" }
  }

  // Claim it
  availableVoucher.userId = currentUser.id
  availableVoucher.status = "claimed"
  availableVoucher.claimedAt = new Date()
  availableVoucher.updatedAt = new Date()

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
}

async function redeemVoucher(
  input: { code: string; redemptionMethod: "qr_scan" | "manual_entry"; notes?: string }
): Promise<{ success: boolean; error?: string; data?: { voucher: { id: string; code: string; status: string; campaignName: string } } }> {
  const currentUser = await mockGetCurrentUser.getCurrentUser()
  if (!currentUser) return { success: false, error: "Not authenticated" }

  const validationResult = redeemVoucherSchema.safeParse(input)
  if (!validationResult.success) {
    return { success: false, error: "Invalid input: " + validationResult.error.message }
  }

  const voucher = Object.values(mockVouchersDb).find(v => v.code === input.code)
  if (!voucher) return { success: false, error: "Voucher not found" }

  if (voucher.status !== "claimed") {
    return { success: false, error: `Voucher is ${voucher.status}, cannot be redeemed` }
  }

  const campaign = mockCampaignsDb[voucher.campaignId]
  if (!campaign) return { success: false, error: "Campaign not found" }

  const isOwner = await checkCafeOwnership(campaign.cafeId, currentUser.id)
  if (!isOwner) return { success: false, error: "Not authorized to redeem vouchers for this cafe" }

  const now = new Date()
  if (now > campaign.endDate) {
    return { success: false, error: "Campaign has expired" }
  }

  // Mark as redeemed
  voucher.status = "redeemed"
  voucher.redeemedAt = new Date()
  voucher.redeemedByCafeId = campaign.cafeId
  voucher.redemptionNotes = input.notes ?? null
  voucher.updatedAt = new Date()

  // Update campaign redemption count
  campaign.currentRedemptions += 1
  campaign.updatedAt = new Date()

  // Create redemption log
  mockRedemptionLogsDb.push({
    id: generateId(),
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
    createdAt: new Date(),
  })

  return {
    success: true,
    data: {
      voucher: {
        id: voucher.id,
        code: voucher.code,
        status: "redeemed",
        campaignName: campaign.name,
      },
    },
  }
}

async function lookupVoucherByCode(
  code: string
): Promise<{ success: boolean; error?: string; data?: { voucher: { id: string; code: string; status: string; campaignName: string } } }> {
  const currentUser = await mockGetCurrentUser.getCurrentUser()
  if (!currentUser) return { success: false, error: "Not authenticated" }

  const voucher = Object.values(mockVouchersDb).find(v => v.code === code)
  if (!voucher) return { success: false, error: "Voucher not found" }

  const campaign = mockCampaignsDb[voucher.campaignId]
  if (!campaign) return { success: false, error: "Campaign not found" }

  const isOwner = await checkCafeOwnership(campaign.cafeId, currentUser.id)
  if (!isOwner) return { success: false, error: "Not authorized" }

  return {
    success: true,
    data: {
      voucher: {
        id: voucher.id,
        code: voucher.code,
        status: voucher.status,
        campaignName: campaign.name,
      },
    },
  }
}

async function cancelVoucher(
  voucherId: string
): Promise<{ success: boolean; error?: string }> {
  const currentUser = await mockGetCurrentUser.getCurrentUser()
  if (!currentUser) return { success: false, error: "Not authenticated" }

  const voucher = mockVouchersDb[voucherId]
  if (!voucher) return { success: false, error: "Voucher not found" }

  const campaign = mockCampaignsDb[voucher.campaignId]
  if (!campaign) return { success: false, error: "Campaign not found" }

  const isOwner = await checkCafeOwnership(campaign.cafeId, currentUser.id)
  if (!isOwner) return { success: false, error: "Not authorized" }

  if (voucher.status === "redeemed") {
    return { success: false, error: "Cannot cancel a redeemed voucher" }
  }

  voucher.status = "cancelled"
  voucher.updatedAt = new Date()

  return { success: true }
}

async function getUserVouchers(
  userId: string
): Promise<{ success: boolean; error?: string; data?: { vouchers: Array<typeof mockVouchersDb[string] & { campaignName: string }> } }> {
  const currentUser = await mockGetCurrentUser.getCurrentUser()
  if (!currentUser) return { success: false, error: "Not authenticated" }

  const vouchers = Object.values(mockVouchersDb)
    .filter(v => v.userId === userId && (v.status === "claimed" || v.status === "redeemed"))
    .map(v => ({
      ...v,
      campaignName: mockCampaignsDb[v.campaignId]?.name ?? "Unknown Campaign",
    }))

  return { success: true, data: { vouchers } }
}

async function getCampaignsForCafe(
  cafeId: string
): Promise<{ success: boolean; error?: string; data?: { campaigns: Array<typeof mockCampaignsDb[string]> } }> {
  const currentUser = await mockGetCurrentUser.getCurrentUser()
  if (!currentUser) return { success: false, error: "Not authenticated" }

  const isOwner = await checkCafeOwnership(cafeId, currentUser.id)
  if (!isOwner) return { success: false, error: "Not authorized" }

  const campaigns = Object.values(mockCampaignsDb).filter(c => c.cafeId === cafeId)
  return { success: true, data: { campaigns } }
}

// ============================================================================
// TESTS
// ============================================================================

describe("Discount Actions", () => {
  beforeEach(() => {
    // Reset mocks
    mockGetCurrentUser.setCurrentUser(null)
    Object.keys(mockCampaignsDb).forEach(k => delete mockCampaignsDb[k])
    Object.keys(mockVouchersDb).forEach(k => delete mockVouchersDb[k])
    Object.keys(mockCafesDb).forEach(k => delete mockCafesDb[k])
    Object.keys(mockProfilesDb).forEach(k => delete mockProfilesDb[k])
    mockRedemptionLogsDb.length = 0
  })

  // ============================================================================
  // 1. Campaign Creation Tests
  // ============================================================================
  describe("createCampaign", () => {
    it("creates a campaign successfully", async () => {
      const owner = await createTestUser("Cafe Owner")
      mockGetCurrentUser.setCurrentUser(owner)
      const cafe = await createTestCafe(owner.id)

      const now = new Date()
      const future = new Date(now.getTime() + 86400000 * 30)

      const result = await createCampaign(cafe.id, {
        name: "Summer Sale",
        description: "20% off all drinks",
        discountType: "percentage",
        discountValue: 20,
        maxRedemptions: 100,
        maxPerUser: 2,
        codePrefix: "SUMMER",
        startDate: now.toISOString(),
        endDate: future.toISOString(),
        isPublic: true,
      })

      expect(result.success).toBe(true)
      expect(result.data?.campaign).toBeDefined()
      expect(result.data?.campaign.name).toBe("Summer Sale")
      expect(result.data?.campaign.status).toBe("draft")
      expect(result.data?.campaign.cafeId).toBe(cafe.id)
      expect(result.data?.campaign.createdBy).toBe(owner.id)
    })

    it("returns error for invalid percentage value", async () => {
      const owner = await createTestUser("Cafe Owner")
      mockGetCurrentUser.setCurrentUser(owner)
      const cafe = await createTestCafe(owner.id)

      const now = new Date()
      const future = new Date(now.getTime() + 86400000 * 30)

      const result = await createCampaign(cafe.id, {
        name: "Summer Sale",
        discountType: "percentage",
        discountValue: 150, // Invalid: over 100
        maxRedemptions: 100,
        startDate: now.toISOString(),
        endDate: future.toISOString(),
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("Invalid input")
    })

    it("returns error for end date before start date", async () => {
      const owner = await createTestUser("Cafe Owner")
      mockGetCurrentUser.setCurrentUser(owner)
      const cafe = await createTestCafe(owner.id)

      const now = new Date()
      const past = new Date(now.getTime() - 86400000 * 30)

      const result = await createCampaign(cafe.id, {
        name: "Summer Sale",
        discountType: "percentage",
        discountValue: 20,
        maxRedemptions: 100,
        startDate: now.toISOString(),
        endDate: past.toISOString(), // Invalid: before start
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("Invalid input")
    })

    it("requires freeItemName for free_item discount type", async () => {
      const owner = await createTestUser("Cafe Owner")
      mockGetCurrentUser.setCurrentUser(owner)
      const cafe = await createTestCafe(owner.id)

      const now = new Date()
      const future = new Date(now.getTime() + 86400000 * 30)

      const result = await createCampaign(cafe.id, {
        name: "Free Coffee Day",
        discountType: "free_item",
        discountValue: 0,
        maxRedemptions: 50,
        startDate: now.toISOString(),
        endDate: future.toISOString(),
        // Missing freeItemName
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("Invalid input")
    })

    it("rejects empty campaign name", async () => {
      const owner = await createTestUser("Cafe Owner")
      mockGetCurrentUser.setCurrentUser(owner)
      const cafe = await createTestCafe(owner.id)

      const now = new Date()
      const future = new Date(now.getTime() + 86400000 * 30)

      const result = await createCampaign(cafe.id, {
        name: "",
        discountType: "percentage",
        discountValue: 20,
        maxRedemptions: 100,
        startDate: now.toISOString(),
        endDate: future.toISOString(),
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("Invalid input")
    })
  })

  // ============================================================================
  // 2. Generate Vouchers Tests
  // ============================================================================
  describe("generateVouchers", () => {
    it("generates vouchers for a campaign", async () => {
      const owner = await createTestUser("Cafe Owner")
      mockGetCurrentUser.setCurrentUser(owner)
      const cafe = await createTestCafe(owner.id)
      const campaign = await createTestCampaign(cafe.id, owner.id, { maxRedemptions: 10 })

      const result = await generateVouchers({
        campaignId: campaign.id,
        count: 5,
      })

      expect(result.success).toBe(true)
      expect(result.data?.vouchers).toHaveLength(5)
      expect(result.data?.vouchers[0].code).toMatch(/^GROUNDS-[A-Z0-9]{4}-[A-Z0-9]{4}$/)

      // Campaign should be activated
      expect(mockCampaignsDb[campaign.id].status).toBe("active")
    })

    it("respects campaign capacity limit", async () => {
      const owner = await createTestUser("Cafe Owner")
      mockGetCurrentUser.setCurrentUser(owner)
      const cafe = await createTestCafe(owner.id)
      const campaign = await createTestCampaign(cafe.id, owner.id, { maxRedemptions: 5 })

      // Create 3 existing vouchers
      for (let i = 0; i < 3; i++) {
        await createTestVoucher(campaign.id)
      }

      // Try to generate 5 more (would exceed limit)
      const result = await generateVouchers({
        campaignId: campaign.id,
        count: 5,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("Can only generate 2 more vouchers")
    })

    it("rejects count over 1000", async () => {
      const owner = await createTestUser("Cafe Owner")
      mockGetCurrentUser.setCurrentUser(owner)
      const cafe = await createTestCafe(owner.id)
      const campaign = await createTestCampaign(cafe.id, owner.id, { maxRedemptions: 2000 })

      const result = await generateVouchers({
        campaignId: campaign.id,
        count: 1001,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("Invalid input")
    })
  })

  // ============================================================================
  // 3. Claim Voucher by Code Tests
  // ============================================================================
  describe("claimVoucherByCode", () => {
    it("claims a voucher by code successfully", async () => {
      const owner = await createTestUser("Cafe Owner")
      const user = await createTestUser("Test User")
      mockGetCurrentUser.setCurrentUser(user)

      const cafe = await createTestCafe(owner.id)
      const campaign = await createTestCampaign(cafe.id, owner.id, {
        status: "active",
        maxPerUser: 2,
      })
      const voucher = await createTestVoucher(campaign.id)

      const result = await claimVoucherByCode({ code: voucher.code })

      expect(result.success).toBe(true)
      expect(result.data?.voucher.code).toBe(voucher.code)
      expect(mockVouchersDb[voucher.id].status).toBe("claimed")
      expect(mockVouchersDb[voucher.id].userId).toBe(user.id)
      expect(mockVouchersDb[voucher.id].claimedAt).toBeDefined()
    })

    it("rejects claiming already claimed voucher", async () => {
      const owner = await createTestUser("Cafe Owner")
      const user1 = await createTestUser("User 1")
      const user2 = await createTestUser("User 2")

      const cafe = await createTestCafe(owner.id)
      const campaign = await createTestCampaign(cafe.id, owner.id, { status: "active" })
      const voucher = await createTestVoucher(campaign.id, { status: "claimed", userId: user1.id })

      mockGetCurrentUser.setCurrentUser(user2)

      const result = await claimVoucherByCode({ code: voucher.code })

      expect(result.success).toBe(false)
      expect(result.error).toBe("Voucher not found or already claimed")
    })

    it("rejects claim when campaign is not active", async () => {
      const owner = await createTestUser("Cafe Owner")
      const user = await createTestUser("Test User")
      mockGetCurrentUser.setCurrentUser(user)

      const cafe = await createTestCafe(owner.id)
      const campaign = await createTestCampaign(cafe.id, owner.id, { status: "draft" })
      const voucher = await createTestVoucher(campaign.id)

      const result = await claimVoucherByCode({ code: voucher.code })

      expect(result.success).toBe(false)
      expect(result.error).toBe("Campaign is not active")
    })

    it("rejects claim when campaign has expired", async () => {
      const owner = await createTestUser("Cafe Owner")
      const user = await createTestUser("Test User")
      mockGetCurrentUser.setCurrentUser(user)

      const cafe = await createTestCafe(owner.id)
      const past = new Date(Date.now() - 86400000 * 2)
      const pastStart = new Date(Date.now() - 86400000 * 30)
      const campaign = await createTestCampaign(cafe.id, owner.id, {
        status: "active",
        startDate: pastStart,
        endDate: past,
      })
      const voucher = await createTestVoucher(campaign.id)

      const result = await claimVoucherByCode({ code: voucher.code })

      expect(result.success).toBe(false)
      expect(result.error).toBe("Campaign is not currently active")
    })

    it("requires authentication", async () => {
      const owner = await createTestUser("Cafe Owner")
      const cafe = await createTestCafe(owner.id)
      const campaign = await createTestCampaign(cafe.id, owner.id, { status: "active" })
      const voucher = await createTestVoucher(campaign.id)

      // Don't set current user
      const result = await claimVoucherByCode({ code: voucher.code })

      expect(result.success).toBe(false)
      expect(result.error).toBe("Not authenticated")
    })
  })

  // ============================================================================
  // 4. Claim Voucher from Campaign (QR Flow) Tests
  // ============================================================================
  describe("claimVoucherFromCampaign", () => {
    it("claims a voucher from campaign successfully", async () => {
      const owner = await createTestUser("Cafe Owner")
      const user = await createTestUser("Test User")
      mockGetCurrentUser.setCurrentUser(user)

      const cafe = await createTestCafe(owner.id)
      const campaign = await createTestCampaign(cafe.id, owner.id, {
        status: "active",
        maxPerUser: 2,
      })

      // Create available vouchers
      await createTestVoucher(campaign.id)
      await createTestVoucher(campaign.id)

      const result = await claimVoucherFromCampaign({ campaignId: campaign.id })

      expect(result.success).toBe(true)
      expect(result.data?.voucher.campaignName).toBe(campaign.name)
    })

    it("returns error when no vouchers available", async () => {
      const owner = await createTestUser("Cafe Owner")
      const user = await createTestUser("Test User")
      mockGetCurrentUser.setCurrentUser(user)

      const cafe = await createTestCafe(owner.id)
      const campaign = await createTestCampaign(cafe.id, owner.id, { status: "active" })

      // No vouchers created

      const result = await claimVoucherFromCampaign({ campaignId: campaign.id })

      expect(result.success).toBe(false)
      expect(result.error).toBe("No vouchers available for this campaign")
    })

    it("returns error for non-existent campaign", async () => {
      const user = await createTestUser("Test User")
      mockGetCurrentUser.setCurrentUser(user)

      const result = await claimVoucherFromCampaign({ campaignId: generateId() })

      expect(result.success).toBe(false)
      expect(result.error).toBe("Campaign not found")
    })
  })

  // ============================================================================
  // 5. Redeem Voucher Tests
  // ============================================================================
  describe("redeemVoucher", () => {
    it("redeems a claimed voucher successfully", async () => {
      const owner = await createTestUser("Cafe Owner")
      const user = await createTestUser("Test User")

      mockGetCurrentUser.setCurrentUser(owner)
      const cafe = await createTestCafe(owner.id)
      const campaign = await createTestCampaign(cafe.id, owner.id, { status: "active" })
      const voucher = await createTestVoucher(campaign.id, {
        status: "claimed",
        userId: user.id,
      })

      const result = await redeemVoucher({
        code: voucher.code,
        redemptionMethod: "qr_scan",
        notes: "Customer was happy!",
      })

      expect(result.success).toBe(true)
      expect(result.data?.voucher.status).toBe("redeemed")
      expect(mockVouchersDb[voucher.id].status).toBe("redeemed")
      expect(mockVouchersDb[voucher.id].redeemedAt).toBeDefined()
      expect(mockCampaignsDb[campaign.id].currentRedemptions).toBe(1)

      // Check redemption log was created
      const logs = mockRedemptionLogsDb.filter(l => l.voucherId === voucher.id)
      expect(logs).toHaveLength(1)
      expect(logs[0].redemptionMethod).toBe("qr_scan")
      expect(logs[0].notes).toBe("Customer was happy!")
    })

    it("rejects redeeming available (unclaimed) voucher", async () => {
      const owner = await createTestUser("Cafe Owner")
      mockGetCurrentUser.setCurrentUser(owner)

      const cafe = await createTestCafe(owner.id)
      const campaign = await createTestCampaign(cafe.id, owner.id, { status: "active" })
      const voucher = await createTestVoucher(campaign.id, { status: "available" })

      const result = await redeemVoucher({
        code: voucher.code,
        redemptionMethod: "manual_entry",
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe("Voucher is available, cannot be redeemed")
    })

    it("rejects redeeming already redeemed voucher", async () => {
      const owner = await createTestUser("Cafe Owner")
      const user = await createTestUser("Test User")

      mockGetCurrentUser.setCurrentUser(owner)
      const cafe = await createTestCafe(owner.id)
      const campaign = await createTestCampaign(cafe.id, owner.id, { status: "active" })
      const voucher = await createTestVoucher(campaign.id, {
        status: "redeemed",
        userId: user.id,
        redeemedAt: new Date(),
      })

      const result = await redeemVoucher({
        code: voucher.code,
        redemptionMethod: "qr_scan",
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe("Voucher is redeemed, cannot be redeemed")
    })

    it("rejects redemption by non-owner", async () => {
      const owner = await createTestUser("Cafe Owner")
      const nonOwner = await createTestUser("Not The Owner")
      const user = await createTestUser("Test User")

      const cafe = await createTestCafe(owner.id)
      const campaign = await createTestCampaign(cafe.id, owner.id, { status: "active" })
      const voucher = await createTestVoucher(campaign.id, {
        status: "claimed",
        userId: user.id,
      })

      mockGetCurrentUser.setCurrentUser(nonOwner)

      const result = await redeemVoucher({
        code: voucher.code,
        redemptionMethod: "qr_scan",
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe("Not authorized to redeem vouchers for this cafe")
    })

    it("rejects redemption when campaign has expired", async () => {
      const owner = await createTestUser("Cafe Owner")
      const user = await createTestUser("Test User")

      mockGetCurrentUser.setCurrentUser(owner)
      const cafe = await createTestCafe(owner.id)
      const past = new Date(Date.now() - 86400000 * 2)
      const pastStart = new Date(Date.now() - 86400000 * 30)
      const campaign = await createTestCampaign(cafe.id, owner.id, {
        status: "active",
        startDate: pastStart,
        endDate: past,
      })
      const voucher = await createTestVoucher(campaign.id, {
        status: "claimed",
        userId: user.id,
      })

      const result = await redeemVoucher({
        code: voucher.code,
        redemptionMethod: "qr_scan",
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe("Campaign has expired")
    })
  })

  // ============================================================================
  // 6. Max Per User Enforcement Tests
  // ============================================================================
  describe("max per user enforcement", () => {
    it("enforces maxPerUser limit when claiming by code", async () => {
      const owner = await createTestUser("Cafe Owner")
      const user = await createTestUser("Test User")
      mockGetCurrentUser.setCurrentUser(user)

      const cafe = await createTestCafe(owner.id)
      const campaign = await createTestCampaign(cafe.id, owner.id, {
        status: "active",
        maxPerUser: 2,
      })

      // User claims first voucher
      const voucher1 = await createTestVoucher(campaign.id)
      const result1 = await claimVoucherByCode({ code: voucher1.code })
      expect(result1.success).toBe(true)

      // User claims second voucher
      const voucher2 = await createTestVoucher(campaign.id)
      const result2 = await claimVoucherByCode({ code: voucher2.code })
      expect(result2.success).toBe(true)

      // User tries to claim third voucher (should fail)
      const voucher3 = await createTestVoucher(campaign.id)
      const result3 = await claimVoucherByCode({ code: voucher3.code })
      expect(result3.success).toBe(false)
      expect(result3.error).toBe("You have reached the maximum vouchers for this campaign")
    })

    it("enforces maxPerUser limit when claiming from campaign (QR flow)", async () => {
      const owner = await createTestUser("Cafe Owner")
      const user = await createTestUser("Test User")
      mockGetCurrentUser.setCurrentUser(user)

      const cafe = await createTestCafe(owner.id)
      const campaign = await createTestCampaign(cafe.id, owner.id, {
        status: "active",
        maxPerUser: 1,
      })

      // Create multiple vouchers
      await createTestVoucher(campaign.id)
      await createTestVoucher(campaign.id)

      // User claims first voucher via QR flow
      const result1 = await claimVoucherFromCampaign({ campaignId: campaign.id })
      expect(result1.success).toBe(true)

      // User tries to claim second voucher (should fail)
      const result2 = await claimVoucherFromCampaign({ campaignId: campaign.id })
      expect(result2.success).toBe(false)
      expect(result2.error).toBe("You have reached the maximum vouchers for this campaign")
    })

    it("allows different users to claim up to their individual limits", async () => {
      const owner = await createTestUser("Cafe Owner")
      const user1 = await createTestUser("User 1")
      const user2 = await createTestUser("User 2")

      const cafe = await createTestCafe(owner.id)
      const campaign = await createTestCampaign(cafe.id, owner.id, {
        status: "active",
        maxPerUser: 1,
      })

      // Create vouchers for both users
      const voucher1 = await createTestVoucher(campaign.id)
      const voucher2 = await createTestVoucher(campaign.id)

      // User 1 claims
      mockGetCurrentUser.setCurrentUser(user1)
      const result1 = await claimVoucherByCode({ code: voucher1.code })
      expect(result1.success).toBe(true)

      // User 2 claims
      mockGetCurrentUser.setCurrentUser(user2)
      const result2 = await claimVoucherByCode({ code: voucher2.code })
      expect(result2.success).toBe(true)
    })
  })

  // ============================================================================
  // 7. Campaign Capacity Enforcement Tests
  // ============================================================================
  describe("campaign capacity enforcement", () => {
    it("prevents generating vouchers beyond maxRedemptions", async () => {
      const owner = await createTestUser("Cafe Owner")
      mockGetCurrentUser.setCurrentUser(owner)

      const cafe = await createTestCafe(owner.id)
      const campaign = await createTestCampaign(cafe.id, owner.id, { maxRedemptions: 3 })

      // Generate 2 vouchers
      const result1 = await generateVouchers({ campaignId: campaign.id, count: 2 })
      expect(result1.success).toBe(true)

      // Try to generate 2 more (would exceed limit)
      const result2 = await generateVouchers({ campaignId: campaign.id, count: 2 })
      expect(result2.success).toBe(false)
      expect(result2.error).toContain("Can only generate 1 more vouchers")
    })

    it("tracks redemptions against campaign capacity", async () => {
      const owner = await createTestUser("Cafe Owner")
      const user1 = await createTestUser("User 1")
      const user2 = await createTestUser("User 2")

      mockGetCurrentUser.setCurrentUser(owner)
      const cafe = await createTestCafe(owner.id)
      const campaign = await createTestCampaign(cafe.id, owner.id, {
        status: "active",
        maxRedemptions: 5,
      })

      // Create and claim vouchers for users
      const voucher1 = await createTestVoucher(campaign.id, { status: "claimed", userId: user1.id })
      const voucher2 = await createTestVoucher(campaign.id, { status: "claimed", userId: user2.id })

      // Redeem both
      await redeemVoucher({ code: voucher1.code, redemptionMethod: "qr_scan" })
      await redeemVoucher({ code: voucher2.code, redemptionMethod: "qr_scan" })

      expect(mockCampaignsDb[campaign.id].currentRedemptions).toBe(2)
    })
  })

  // ============================================================================
  // 8. Lookup Voucher Tests
  // ============================================================================
  describe("lookupVoucherByCode", () => {
    it("looks up a voucher successfully", async () => {
      const owner = await createTestUser("Cafe Owner")
      mockGetCurrentUser.setCurrentUser(owner)

      const cafe = await createTestCafe(owner.id)
      const campaign = await createTestCampaign(cafe.id, owner.id, { status: "active" })
      const voucher = await createTestVoucher(campaign.id, { status: "claimed" })

      const result = await lookupVoucherByCode(voucher.code)

      expect(result.success).toBe(true)
      expect(result.data?.voucher.code).toBe(voucher.code)
      expect(result.data?.voucher.status).toBe("claimed")
      expect(result.data?.voucher.campaignName).toBe(campaign.name)
    })

    it("returns error for non-existent voucher", async () => {
      const owner = await createTestUser("Cafe Owner")
      mockGetCurrentUser.setCurrentUser(owner)
      await createTestCafe(owner.id)

      const result = await lookupVoucherByCode("INVALID-CODE-1234")

      expect(result.success).toBe(false)
      expect(result.error).toBe("Voucher not found")
    })

    it("returns error for non-owner", async () => {
      const owner = await createTestUser("Cafe Owner")
      const nonOwner = await createTestUser("Not The Owner")

      const cafe = await createTestCafe(owner.id)
      const campaign = await createTestCampaign(cafe.id, owner.id)
      const voucher = await createTestVoucher(campaign.id)

      mockGetCurrentUser.setCurrentUser(nonOwner)

      const result = await lookupVoucherByCode(voucher.code)

      expect(result.success).toBe(false)
      expect(result.error).toBe("Not authorized")
    })
  })

  // ============================================================================
  // 9. Cancel Voucher Tests
  // ============================================================================
  describe("cancelVoucher", () => {
    it("cancels an available voucher", async () => {
      const owner = await createTestUser("Cafe Owner")
      mockGetCurrentUser.setCurrentUser(owner)

      const cafe = await createTestCafe(owner.id)
      const campaign = await createTestCampaign(cafe.id, owner.id)
      const voucher = await createTestVoucher(campaign.id, { status: "available" })

      const result = await cancelVoucher(voucher.id)

      expect(result.success).toBe(true)
      expect(mockVouchersDb[voucher.id].status).toBe("cancelled")
    })

    it("cancels a claimed voucher", async () => {
      const owner = await createTestUser("Cafe Owner")
      const user = await createTestUser("Test User")
      mockGetCurrentUser.setCurrentUser(owner)

      const cafe = await createTestCafe(owner.id)
      const campaign = await createTestCampaign(cafe.id, owner.id)
      const voucher = await createTestVoucher(campaign.id, {
        status: "claimed",
        userId: user.id,
      })

      const result = await cancelVoucher(voucher.id)

      expect(result.success).toBe(true)
      expect(mockVouchersDb[voucher.id].status).toBe("cancelled")
    })

    it("rejects cancelling a redeemed voucher", async () => {
      const owner = await createTestUser("Cafe Owner")
      const user = await createTestUser("Test User")
      mockGetCurrentUser.setCurrentUser(owner)

      const cafe = await createTestCafe(owner.id)
      const campaign = await createTestCampaign(cafe.id, owner.id)
      const voucher = await createTestVoucher(campaign.id, {
        status: "redeemed",
        userId: user.id,
        redeemedAt: new Date(),
      })

      const result = await cancelVoucher(voucher.id)

      expect(result.success).toBe(false)
      expect(result.error).toBe("Cannot cancel a redeemed voucher")
      expect(mockVouchersDb[voucher.id].status).toBe("redeemed")
    })

    it("rejects cancellation by non-owner", async () => {
      const owner = await createTestUser("Cafe Owner")
      const nonOwner = await createTestUser("Not The Owner")

      const cafe = await createTestCafe(owner.id)
      const campaign = await createTestCampaign(cafe.id, owner.id)
      const voucher = await createTestVoucher(campaign.id)

      mockGetCurrentUser.setCurrentUser(nonOwner)

      const result = await cancelVoucher(voucher.id)

      expect(result.success).toBe(false)
      expect(result.error).toBe("Not authorized")
    })

    it("returns error for non-existent voucher", async () => {
      const owner = await createTestUser("Cafe Owner")
      mockGetCurrentUser.setCurrentUser(owner)
      await createTestCafe(owner.id)

      const result = await cancelVoucher(generateId())

      expect(result.success).toBe(false)
      expect(result.error).toBe("Voucher not found")
    })
  })

  // ============================================================================
  // 10. Auth Enforcement Tests
  // ============================================================================
  describe("auth enforcement", () => {
    it("requires authentication to create campaigns", async () => {
      const owner = await createTestUser("Cafe Owner")
      const cafe = await createTestCafe(owner.id)

      // Don't authenticate
      mockGetCurrentUser.setCurrentUser(null)

      const now = new Date()
      const future = new Date(now.getTime() + 86400000 * 30)

      const result = await createCampaign(cafe.id, {
        name: "Test Campaign",
        discountType: "percentage",
        discountValue: 20,
        maxRedemptions: 100,
        startDate: now.toISOString(),
        endDate: future.toISOString(),
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe("Not authenticated")
    })

    it("prevents non-owner from creating campaigns", async () => {
      const owner = await createTestUser("Cafe Owner")
      const nonOwner = await createTestUser("Not The Owner")
      const cafe = await createTestCafe(owner.id)

      mockGetCurrentUser.setCurrentUser(nonOwner)

      const now = new Date()
      const future = new Date(now.getTime() + 86400000 * 30)

      const result = await createCampaign(cafe.id, {
        name: "Test Campaign",
        discountType: "percentage",
        discountValue: 20,
        maxRedemptions: 100,
        startDate: now.toISOString(),
        endDate: future.toISOString(),
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe("Not authorized")
    })

    it("requires authentication to generate vouchers", async () => {
      const owner = await createTestUser("Cafe Owner")
      const cafe = await createTestCafe(owner.id)
      const campaign = await createTestCampaign(cafe.id, owner.id)

      mockGetCurrentUser.setCurrentUser(null)

      const result = await generateVouchers({ campaignId: campaign.id, count: 5 })

      expect(result.success).toBe(false)
      expect(result.error).toBe("Not authenticated")
    })

    it("prevents non-owner from generating vouchers", async () => {
      const owner = await createTestUser("Cafe Owner")
      const nonOwner = await createTestUser("Not The Owner")
      const cafe = await createTestCafe(owner.id)
      const campaign = await createTestCampaign(cafe.id, owner.id)

      mockGetCurrentUser.setCurrentUser(nonOwner)

      const result = await generateVouchers({ campaignId: campaign.id, count: 5 })

      expect(result.success).toBe(false)
      expect(result.error).toBe("Not authorized")
    })

    it("requires authentication for all owner operations", async () => {
      const owner = await createTestUser("Cafe Owner")
      const cafe = await createTestCafe(owner.id)
      const campaign = await createTestCampaign(cafe.id, owner.id)
      const voucher = await createTestVoucher(campaign.id)

      mockGetCurrentUser.setCurrentUser(null)

      // Test getCampaignsForCafe
      const campaignsResult = await getCampaignsForCafe(cafe.id)
      expect(campaignsResult.success).toBe(false)
      expect(campaignsResult.error).toBe("Not authenticated")

      // Test lookupVoucherByCode
      const lookupResult = await lookupVoucherByCode(voucher.code)
      expect(lookupResult.success).toBe(false)
      expect(lookupResult.error).toBe("Not authenticated")

      // Test cancelVoucher
      const cancelResult = await cancelVoucher(voucher.id)
      expect(cancelResult.success).toBe(false)
      expect(cancelResult.error).toBe("Not authenticated")
    })

    it("allows owners with multiple cafes to manage their campaigns", async () => {
      const owner = await createTestUser("Multi Cafe Owner")
      mockGetCurrentUser.setCurrentUser(owner)

      const cafe1 = await createTestCafe(owner.id)
      const cafe2 = await createTestCafe(owner.id)

      // Add owner to second cafe as well
      mockCafesDb[cafe2.id].ownerIds = [owner.id]

      const campaign1 = await createTestCampaign(cafe1.id, owner.id)
      const campaign2 = await createTestCampaign(cafe2.id, owner.id)

      // Owner can access campaigns for both cafes
      const result1 = await getCampaignsForCafe(cafe1.id)
      expect(result1.success).toBe(true)
      expect(result1.data?.campaigns).toHaveLength(1)
      expect(result1.data?.campaigns[0].id).toBe(campaign1.id)

      const result2 = await getCampaignsForCafe(cafe2.id)
      expect(result2.success).toBe(true)
      expect(result2.data?.campaigns).toHaveLength(1)
      expect(result2.data?.campaigns[0].id).toBe(campaign2.id)
    })
  })

  // ============================================================================
  // Additional Edge Case Tests
  // ============================================================================
  describe("edge cases", () => {
    it("handles free_item discount type correctly", async () => {
      const owner = await createTestUser("Cafe Owner")
      const user = await createTestUser("Test User")
      mockGetCurrentUser.setCurrentUser(owner)

      const cafe = await createTestCafe(owner.id)
      const now = new Date()
      const future = new Date(now.getTime() + 86400000 * 30)

      const campaignResult = await createCampaign(cafe.id, {
        name: "Free Coffee Day",
        discountType: "free_item",
        discountValue: 0,
        freeItemName: "Free Espresso",
        freeItemDescription: "Single shot espresso, any variety",
        maxRedemptions: 50,
        startDate: now.toISOString(),
        endDate: future.toISOString(),
      })

      expect(campaignResult.success).toBe(true)
      expect(campaignResult.data?.campaign.discountType).toBe("free_item")
      expect(campaignResult.data?.campaign.freeItemName).toBe("Free Espresso")
    })

    it("handles fixed_amount discount type correctly", async () => {
      const owner = await createTestUser("Cafe Owner")
      mockGetCurrentUser.setCurrentUser(owner)

      const cafe = await createTestCafe(owner.id)
      const now = new Date()
      const future = new Date(now.getTime() + 86400000 * 30)

      const campaignResult = await createCampaign(cafe.id, {
        name: "P50 Off",
        discountType: "fixed_amount",
        discountValue: 50,
        maxRedemptions: 100,
        startDate: now.toISOString(),
        endDate: future.toISOString(),
      })

      expect(campaignResult.success).toBe(true)
      expect(campaignResult.data?.campaign.discountType).toBe("fixed_amount")
      expect(campaignResult.data?.campaign.discountValue).toBe(50)
    })

    it("validates campaign dates correctly", async () => {
      const owner = await createTestUser("Cafe Owner")
      const user = await createTestUser("Test User")

      mockGetCurrentUser.setCurrentUser(owner)
      const cafe = await createTestCafe(owner.id)

      const now = new Date()
      const yesterday = new Date(now.getTime() - 86400000)
      const tomorrow = new Date(now.getTime() + 86400000)

      // Campaign starting tomorrow - not yet active
      const futureCampaign = await createTestCampaign(cafe.id, owner.id, {
        status: "active",
        startDate: tomorrow,
        endDate: new Date(now.getTime() + 86400000 * 30),
      })

      const voucher = await createTestVoucher(futureCampaign.id)

      mockGetCurrentUser.setCurrentUser(user)
      const result = await claimVoucherByCode({ code: voucher.code })

      expect(result.success).toBe(false)
      expect(result.error).toBe("Campaign is not currently active")
    })

    it("generates unique voucher codes", async () => {
      const owner = await createTestUser("Cafe Owner")
      mockGetCurrentUser.setCurrentUser(owner)

      const cafe = await createTestCafe(owner.id)
      const campaign = await createTestCampaign(cafe.id, owner.id, { maxRedemptions: 100 })

      // Generate 50 vouchers
      const result = await generateVouchers({ campaignId: campaign.id, count: 50 })
      expect(result.success).toBe(true)

      // Check all codes are unique
      const codes = result.data?.vouchers.map(v => v.code) ?? []
      const uniqueCodes = new Set(codes)
      expect(uniqueCodes.size).toBe(codes.length)
    })

    it("preserves voucher state across multiple operations", async () => {
      const owner = await createTestUser("Cafe Owner")
      const user = await createTestUser("Test User")

      mockGetCurrentUser.setCurrentUser(owner)
      const cafe = await createTestCafe(owner.id)
      const campaign = await createTestCampaign(cafe.id, owner.id, {
        status: "active",
        maxPerUser: 3,
      })

      // Generate vouchers
      await generateVouchers({ campaignId: campaign.id, count: 5 })

      // User claims a voucher
      mockGetCurrentUser.setCurrentUser(user)
      const claimResult = await claimVoucherFromCampaign({ campaignId: campaign.id })
      expect(claimResult.success).toBe(true)

      const voucherId = claimResult.data?.voucher.id
      expect(voucherId).toBeDefined()

      // Verify state in database
      const voucher = mockVouchersDb[voucherId!]
      expect(voucher.status).toBe("claimed")
      expect(voucher.userId).toBe(user.id)
      expect(voucher.claimedAt).toBeDefined()

      // Owner redeems the voucher
      mockGetCurrentUser.setCurrentUser(owner)
      const redeemResult = await redeemVoucher({
        code: voucher.code,
        redemptionMethod: "qr_scan",
      })
      expect(redeemResult.success).toBe(true)

      // Verify final state
      expect(mockVouchersDb[voucherId!].status).toBe("redeemed")
      expect(mockVouchersDb[voucherId!].redeemedAt).toBeDefined()
      expect(mockCampaignsDb[campaign.id].currentRedemptions).toBe(1)
    })
  })
})
