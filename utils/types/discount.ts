import { z } from "zod"

// Discount Campaign Types
export const discountCampaignSchema = z.object({
  id: z.string(),
  cafeId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  discountType: z.enum(["percentage", "fixed_amount", "free_item"]),
  discountValue: z.number(),
  freeItemName: z.string().nullable(),
  freeItemDescription: z.string().nullable(),
  maxRedemptions: z.number(),
  currentRedemptions: z.number(),
  maxPerUser: z.number().nullable(),
  minPurchaseAmount: z.number().nullable(),
  codePrefix: z.string().nullable(),
  startDate: z.string(),
  endDate: z.string(),
  status: z.enum(["draft", "active", "paused", "expired", "archived"]),
  isPublic: z.boolean(),
  qrCodeEnabled: z.boolean(),
  termsAndConditions: z.string().nullable(),
  imageUrl: z.string().nullable(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  cafeName: z.string().optional(),
  cafeSlug: z.string().optional(),
  cafeThumbnail: z.string().optional(),
})

export const discountVoucherSchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  code: z.string(),
  userId: z.string().nullable(),
  status: z.enum(["available", "claimed", "redeemed", "expired", "cancelled"]),
  claimedAt: z.string().nullable(),
  redeemedAt: z.string().nullable(),
  redeemedByCafeId: z.string().nullable(),
  redemptionNotes: z.string().nullable(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  campaign: z.optional(z.lazy(() => discountCampaignSchema)),
})

export const voucherRedemptionLogSchema = z.object({
  id: z.string(),
  voucherId: z.string(),
  campaignId: z.string(),
  userId: z.string().nullable(),
  cafeId: z.string(),
  redeemedBy: z.string().nullable(),
  code: z.string(),
  discountType: z.enum(["percentage", "fixed_amount", "free_item"]),
  discountValue: z.number(),
  freeItemName: z.string().nullable(),
  redemptionMethod: z.string(),
  notes: z.string().nullable(),
  createdAt: z.string(),
})

export type DiscountCampaign = z.infer<typeof discountCampaignSchema>
export type DiscountVoucher = z.infer<typeof discountVoucherSchema>
export type VoucherRedemptionLog = z.infer<typeof voucherRedemptionLogSchema>

// Stats type for campaign dashboard
export interface CampaignStats {
  totalVouchers: number
  claimedVouchers: number
  redeemedVouchers: number
  availableVouchers: number
  expiredVouchers: number
}

// User wallet voucher (includes campaign info for display)
export interface UserVoucher extends Omit<DiscountVoucher, "campaign"> {
  campaign: {
    name: string
    discountType: "percentage" | "fixed_amount" | "free_item"
    discountValue: number
    freeItemName: string | null
    cafeName: string
    cafeSlug: string
    cafeThumbnail: string | null
    startDate: string
    endDate: string
    termsAndConditions: string | null
    imageUrl: string | null
  }
}

// Redeemable voucher display for QR code
export interface RedeemableVoucher {
  id: string
  code: string
  discountType: "percentage" | "fixed_amount" | "free_item"
  discountValue: number
  freeItemName: string | null
  campaignName: string
  cafeName: string
  startDate: string
  endDate: string
  status: string
  description: string | null
  termsAndConditions: string | null
  imageUrl: string | null
}
