import { describe, it, expect } from "bun:test"
import {
  createCampaignSchema,
  updateCampaignSchema,
  generateVouchersSchema,
  claimVoucherSchema,
  redeemVoucherSchema,
  issueVoucherToUserSchema,
} from "../discount"

describe("createCampaignSchema", () => {
  const validBase = {
    name: "Summer Sale",
    discountType: "percentage" as const,
    discountValue: 20,
    maxRedemptions: 100,
    codePrefix: "GROUNDS",
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 86400000 * 30).toISOString(),
  }

  it("validates a valid percentage campaign", () => {
    const result = createCampaignSchema.safeParse(validBase)
    expect(result.success).toBe(true)
  })

  it("validates a valid fixed_amount campaign", () => {
    const result = createCampaignSchema.safeParse({
      ...validBase,
      discountType: "fixed_amount",
      discountValue: 50,
    })
    expect(result.success).toBe(true)
  })

  it("validates a valid free_item campaign", () => {
    const result = createCampaignSchema.safeParse({
      ...validBase,
      discountType: "free_item",
      discountValue: 0,
      freeItemName: "Free Coffee",
    })
    expect(result.success).toBe(true)
  })

  it("rejects percentage over 100", () => {
    const result = createCampaignSchema.safeParse({
      ...validBase,
      discountValue: 150,
    })
    expect(result.success).toBe(false)
  })

  it("rejects free_item without freeItemName", () => {
    const result = createCampaignSchema.safeParse({
      ...validBase,
      discountType: "free_item",
      discountValue: 0,
    })
    expect(result.success).toBe(false)
  })

  it("rejects end date before start date", () => {
    const result = createCampaignSchema.safeParse({
      ...validBase,
      startDate: new Date(Date.now() + 86400000 * 30).toISOString(),
      endDate: new Date().toISOString(),
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty name", () => {
    const result = createCampaignSchema.safeParse({
      ...validBase,
      name: "",
    })
    expect(result.success).toBe(false)
  })

  it("rejects maxRedemptions less than 1", () => {
    const result = createCampaignSchema.safeParse({
      ...validBase,
      maxRedemptions: 0,
    })
    expect(result.success).toBe(false)
  })
})

describe("generateVouchersSchema", () => {
  it("validates valid input", () => {
    const result = generateVouchersSchema.safeParse({
      campaignId: crypto.randomUUID(),
      count: 10,
    })
    expect(result.success).toBe(true)
  })

  it("rejects count over 1000", () => {
    const result = generateVouchersSchema.safeParse({
      campaignId: crypto.randomUUID(),
      count: 1001,
    })
    expect(result.success).toBe(false)
  })
})

describe("redeemVoucherSchema", () => {
  it("validates qr_scan method", () => {
    const result = redeemVoucherSchema.safeParse({
      code: "GROUNDS-ABC123",
      redemptionMethod: "qr_scan",
    })
    expect(result.success).toBe(true)
  })

  it("validates manual_entry method", () => {
    const result = redeemVoucherSchema.safeParse({
      code: "GROUNDS-ABC123",
      redemptionMethod: "manual_entry",
    })
    expect(result.success).toBe(true)
  })
})
