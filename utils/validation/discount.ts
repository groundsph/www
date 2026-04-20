import { z } from "zod"

export const createCampaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required").max(100, "Name too long"),
  description: z.string().max(500, "Description too long").optional(),
  discountType: z.enum(["percentage", "fixed_amount", "free_item"]),
  discountValue: z.number().min(0, "Value must be 0 or greater"),
  freeItemName: z.string().min(1, "Item name is required").max(100).optional(),
  freeItemDescription: z.string().max(300).optional(),
  maxRedemptions: z.number().int().min(1, "Must have at least 1 redemption"),
  maxPerUser: z.number().int().min(1).default(1),
  minPurchaseAmount: z.number().min(0).optional(),
  codePrefix: z.string().min(2).max(20).default("GROUNDS"),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  isPublic: z.boolean().default(true),
  qrCodeEnabled: z.boolean().default(true),
  termsAndConditions: z.string().max(1000).optional(),
}).refine(
  (data) => {
    const start = new Date(data.startDate)
    const end = new Date(data.endDate)
    return end > start
  },
  { message: "End date must be after start date", path: ["endDate"] }
).refine(
  (data) => {
    if (data.discountType === "percentage") {
      return data.discountValue > 0 && data.discountValue <= 100
    }
    return data.discountValue >= 0
  },
  { message: "Percentage must be between 1 and 100", path: ["discountValue"] }
).refine(
  (data) => {
    if (data.discountType === "free_item") {
      return !!data.freeItemName
    }
    return true
  },
  { message: "Free item name is required for free item discounts", path: ["freeItemName"] }
)

export const updateCampaignSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  discountValue: z.number().min(0).optional(),
  freeItemName: z.string().min(1).max(100).optional(),
  freeItemDescription: z.string().max(300).optional(),
  maxRedemptions: z.number().int().min(1).optional(),
  maxPerUser: z.number().int().min(1).optional(),
  minPurchaseAmount: z.number().min(0).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.enum(["draft", "active", "paused", "archived"]).optional(),
  isPublic: z.boolean().optional(),
  qrCodeEnabled: z.boolean().optional(),
  termsAndConditions: z.string().max(1000).optional(),
  imageUrl: z.string().url().optional(),
})

export const generateVouchersSchema = z.object({
  campaignId: z.string().uuid(),
  count: z.number().int().min(1).max(1000, "Max 1000 vouchers at a time"),
})

export const claimVoucherSchema = z.object({
  campaignId: z.string().uuid(),
})

export const claimVoucherByCodeSchema = z.object({
  code: z.string().min(1, "Code is required"),
})

export const redeemVoucherSchema = z.object({
  code: z.string().min(1, "Code is required"),
  redemptionMethod: z.enum(["qr_scan", "manual_entry"]),
  notes: z.string().max(500).optional(),
})

export const issueVoucherToUserSchema = z.object({
  campaignId: z.string().uuid(),
  userId: z.string().uuid(),
})

export const campaignFiltersSchema = z.object({
  status: z.enum(["draft", "active", "paused", "expired", "archived"]).optional(),
  search: z.string().optional(),
})

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>
export type GenerateVouchersInput = z.infer<typeof generateVouchersSchema>
export type ClaimVoucherInput = z.infer<typeof claimVoucherSchema>
export type ClaimVoucherByCodeInput = z.infer<typeof claimVoucherByCodeSchema>
export type RedeemVoucherInput = z.infer<typeof redeemVoucherSchema>
export type IssueVoucherToUserInput = z.infer<typeof issueVoucherToUserSchema>
export type CampaignFiltersInput = z.infer<typeof campaignFiltersSchema>
