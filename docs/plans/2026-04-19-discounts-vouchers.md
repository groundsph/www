# Discounts & Vouchers Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow cafe owners to create and generate discounts/vouchers that verified (logged-in) users can claim, store in their wallet, and redeem via QR code or manual code.

**Architecture:** The system uses a campaign-based model. Owners create "discount campaigns" (e.g., "Summer 20% Off" with 100 vouchers). Each campaign generates individual vouchers with unique codes. Users claim vouchers from campaigns (or owners issue directly), vouchers go into a user wallet (profile section), and redemption happens via QR scan or manual code entry at the cafe. Three discount types are supported: percentage, fixed amount, and free item.

**Tech Stack:** Next.js App Router, Drizzle ORM (PostgreSQL), Zod, Tailwind CSS v4, motion/react, qrcode.react, lucide-react, Better Auth

---

## Overview of Entities

### Discount Campaign (Owner creates)
- Belongs to a cafe
- Has a name, description, discount type (percentage/fixed/free_item), discount value
- Has max Redemptions (total voucher pool size)
- Has start/end dates for validity
- Can be active/draft/expired
- Owner can issue vouchers individually or let users self-claim

### Discount Voucher (Individual claimable unit)
- Belongs to a campaign
- Has a unique code (e.g., `GROUNDS-ABC123`)
- Belongs to a user once claimed (null before claim)
- Has status: available → claimed → redeemed/expired
- Tracks redemption details (redeemedAt, redeemedByCafeId)

### Voucher Redemption Log
- Audit trail for each redemption
- Links voucher, user, and cafe
- Stores redemption timestamp and any notes

---

## Task Breakdown

### Task 1: Database Schema — Discount Enums

**Files:**
- Modify: `db/schema/enums.ts`

**Step 1: Add discount-related enums to `enums.ts`**

Add the following enums after the existing `mallVerificationStatusEnum`:

```ts
// Discount
export const discountTypeEnum = pgEnum("discount_type", [
    "percentage",
    "fixed_amount",
    "free_item",
])

export const discountCampaignStatusEnum = pgEnum("discount_campaign_status", [
    "draft",
    "active",
    "paused",
    "expired",
    "archived",
])

export const voucherStatusEnum = pgEnum("voucher_status", [
    "available",
    "claimed",
    "redeemed",
    "expired",
    "cancelled",
])
```

**Step 2: Verify the file compiles**

Run: `bun run db:generate --dry-run 2>&1 | head -5` (or just check there are no TS errors)

Expected: No TypeScript errors related to the enum definitions.

---

### Task 2: Database Schema — Discount Tables

**Files:**
- Create: `db/schema/discount.ts`

**Step 1: Create the discount schema file**

Create `db/schema/discount.ts` with the following content:

```ts
import {
    pgTable,
    uuid,
    text,
    timestamp,
    integer,
    real,
    boolean,
    jsonb,
    index,
} from "drizzle-orm/pg-core"

import { cafes } from "./tables"
import { profiles } from "./tables"
import {
    discountTypeEnum,
    discountCampaignStatusEnum,
    voucherStatusEnum,
} from "./enums"

// ============================================================================
// DISCOUNT CAMPAIGN TABLE
// ============================================================================

export const discountCampaigns = pgTable(
    "discount_campaigns",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        cafeId: uuid("cafe_id")
            .notNull()
            .references(() => cafes.id, { onDelete: "cascade" }),
        name: text("name").notNull(),
        description: text("description"),
        discountType: discountTypeEnum("discount_type").notNull(),
        discountValue: real("discount_value").notNull(),
        freeItemName: text("free_item_name"),
        freeItemDescription: text("free_item_description"),
        maxRedemptions: integer("max_redemptions").notNull(),
        currentRedemptions: integer("current_redemptions").default(0),
        maxPerUser: integer("max_per_user").default(1),
        minPurchaseAmount: real("min_purchase_amount"),
        codePrefix: text("code_prefix").default("GROUNDS"),
        startDate: timestamp("start_date", { withTimezone: true }).notNull(),
        endDate: timestamp("end_date", { withTimezone: true }).notNull(),
        status: discountCampaignStatusEnum("status").default("draft"),
        isPublic: boolean("is_public").default(true),
        qrCodeEnabled: boolean("qr_code_enabled").default(true),
        termsAndConditions: text("terms_and_conditions"),
        imageUrl: text("image_url"),
        createdBy: uuid("created_by")
            .notNull()
            .references(() => profiles.id, { onDelete: "cascade" }),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    },
    (table) => ({
        cafeIdIdx: index("discount_campaigns_cafe_id_idx").on(table.cafeId),
        statusIdx: index("discount_campaigns_status_idx").on(table.status),
        startDateIdx: index("discount_campaigns_start_date_idx").on(table.startDate),
    })
)

// ============================================================================
// DISCOUNT VOUCHER TABLE
// ============================================================================

export const discountVouchers = pgTable(
    "discount_vouchers",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        campaignId: uuid("campaign_id")
            .notNull()
            .references(() => discountCampaigns.id, { onDelete: "cascade" }),
        code: text("code").notNull().unique(),
        userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
        status: voucherStatusEnum("status").default("available"),
        claimedAt: timestamp("claimed_at", { withTimezone: true }),
        redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
        redeemedByCafeId: uuid("redeemed_by_cafe_id").references(() => cafes.id, { onDelete: "set null" }),
        redemptionNotes: text("redemption_notes"),
        expiresAt: timestamp("expires_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    },
    (table) => ({
        codeIdx: index("discount_vouchers_code_idx").on(table.code),
        campaignIdIdx: index("discount_vouchers_campaign_id_idx").on(table.campaignId),
        userIdIdx: index("discount_vouchers_user_id_idx").on(table.userId),
        statusIdx: index("discount_vouchers_status_idx").on(table.status),
    })
)

// ============================================================================
// VOUCHER REDEMPTION LOG TABLE
// ============================================================================

export const voucherRedemptionLogs = pgTable(
    "voucher_redemption_logs",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        voucherId: uuid("voucher_id")
            .notNull()
            .references(() => discountVouchers.id, { onDelete: "cascade" }),
        campaignId: uuid("campaign_id")
            .notNull()
            .references(() => discountCampaigns.id, { onDelete: "cascade" }),
        userId: uuid("user_id")
            .references(() => profiles.id, { onDelete: "set null" }),
        cafeId: uuid("cafe_id")
            .notNull()
            .references(() => cafes.id, { onDelete: "cascade" }),
        redeemedBy: uuid("redeemed_by")
            .notNull()
            .references(() => profiles.id, { onDelete: "set null" }),
        code: text("code").notNull(),
        discountType: discountTypeEnum("discount_type").notNull(),
        discountValue: real("discount_value").notNull(),
        freeItemName: text("free_item_name"),
        redemptionMethod: text("redemption_method").notNull(),
        notes: text("notes"),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    },
    (table) => ({
        voucherIdIdx: index("voucher_redemption_logs_voucher_id_idx").on(table.voucherId),
        campaignIdIdx: index("voucher_redemption_logs_campaign_id_idx").on(table.campaignId),
        userIdIdx: index("voucher_redemption_logs_user_id_idx").on(table.userId),
        cafeIdIdx: index("voucher_redemption_logs_cafe_id_idx").on(table.cafeId),
        createdAtIdx: index("voucher_redemption_logs_created_at_idx").on(table.createdAt),
    })
)
```

**Step 2: Export from schema index**

Modify `db/schema/index.ts` to add:

```ts
export * from "./discount"
```

**Step 3: Generate migration**

Run: `bun db:generate`

Expected: Migration files generated successfully with new tables and enums.

**Step 4: Push schema to dev database**

Run: `bun db:push`

Expected: Tables created successfully.

**Step 5: Commit**

```bash
git add db/schema/
git commit -m "feat(discounts): add discount campaign, voucher, and redemption log schema"
```

---

### Task 3: TypeScript Types & Zod Validation

**Files:**
- Create: `utils/types/discount.ts`
- Create: `utils/validation/discount.ts`
- Create: `utils/__tests__/discount-validation.test.ts`

**Step 1: Create `utils/types/discount.ts`**

```ts
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
export interface UserVoucher extends DiscountVoucher {
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
```

**Step 2: Create `utils/validation/discount.ts`**

```ts
import { z } from "zod"

export const createCampaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required").max(100, "Name too long"),
  description: z.string().max(500, "Description too long").optional(),
  discountType: z.enum(["percentage", "fixed_amount", "free_item"], {
    required_error: "Discount type is required",
  }),
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
```

**Step 3: Create test file `utils/validation/__tests__/discount-validation.test.ts`**

```ts
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
```

**Step 4: Run validation tests**

Run: `bun test utils/validation/__tests__/discount-validation.test.ts`

Expected: All tests pass.

**Step 5: Commit**

```bash
git add utils/types/discount.ts utils/validation/discount.ts utils/validation/__tests__/discount-validation.test.ts
git commit -m "feat(discounts): add TypeScript types and Zod validation schemas"
```

---

### Task 4: Server Actions — Campaign CRUD

**Files:**
- Create: `app/api/actions/discount.ts`
- Create: `app/api/actions/__tests__/discount-actions.test.ts`

**Step 1: Create the discount server actions file**

Create `app/api/actions/discount.ts` with the following content. This is a large file — implement ALL functions:

```ts
"use server"

import { db } from "@/db"
import { discountCampaigns, discountVouchers, voucherRedemptionLogs, cafes, profiles } from "@/db/schema"
import { eq, and, desc, sql, inArray, isNull, lt, gt, count } from "drizzle-orm"
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
  campaignFiltersSchema,
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
function serializeCampaign(campaign: typeof discountCampaigns.$inferSelect, cafeInfo?: { name: string; slug: string; thumbnail: string | null }): DiscountCampaign {
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
    cafeThumbnail: cafeInfo?.thumbnail,
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
): Promise<ActionResult<{ campaigns: DiscountCampaign[] }>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { success: false, error: "Not authenticated" }

  const isOwner = await checkCafeOwnership(cafeId, currentUser.id)
  if (!isOwner) return { success: false, error: "Not authorized" }

  try {
    let conditions = [eq(discountCampaigns.cafeId, cafeId)]

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

    return { success: true, data: { campaigns: serialized } }
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
export async function getCampaignVouchers(
  campaignId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<ActionResult<{ vouchers: DiscountCampaign[]; total: number }>> {
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
): Promise<ActionResult<{ logs: typeof voucherRedemptionLogs.$inferSelect[]; total: number }>> {
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
      data: { logs, total: countResult?.count ?? 0 },
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
```

**Step 2: Run typecheck on the actions file**

Run: `bun build app/api/actions/discount.ts --no-bundle 2>&1 | head -20`

Or verify imports resolve correctly. Fix any TypeScript errors.

**Step 3: Commit**

```bash
git add app/api/actions/discount.ts
git commit -m "feat(discounts): add server actions for campaign CRUD, voucher generation, claiming, and redemption"
```

---

### Task 5: Owner UI — Discount Dashboard Page

**Files:**
- Create: `app/owner/cafes/[slug]/discounts/page.tsx`
- Create: `components/owner/DiscountDashboard.tsx`
- Create: `components/owner/DiscountStatsCards.tsx`

**Step 1: Create the discounts page route**

Create `app/owner/cafes/[slug]/discounts/page.tsx`:

```tsx
import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { getCafeForOwnerManagement } from "@/app/api/actions/owner"
import { getCampaignsForCafe } from "@/app/api/actions/discount"
import DiscountDashboard from "@/components/owner/DiscountDashboard"

export const metadata: Metadata = {
  title: "Discount Management | Grounds",
  description: "Manage discount campaigns and vouchers for your cafe.",
}

export default async function DiscountsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth?redirect=/owner")
  }

  const cafe = await getCafeForOwnerManagement(slug)
  if (!cafe) {
    redirect("/owner")
  }

  const campaignsResult = await getCampaignsForCafe(cafe.id)

  return (
    <main className="min-h-screen w-full bg-background pt-6 pb-12">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <DiscountDashboard
          cafeId={cafe.id}
          cafeName={cafe.name}
          cafeSlug={slug}
          campaigns={campaignsResult.data?.campaigns ?? []}
        />
      </div>
    </main>
  )
}
```

**Step 2: Create `DiscountStatsCards.tsx`**

Create `components/owner/DiscountStatsCards.tsx` — a summary card component following the existing `StatsCards` pattern from the manage components:

```tsx
"use client"

import { motion } from "motion/react"
import { Ticket, Users, CheckCircle2, Clock } from "lucide-react"
import type { CampaignStats } from "@/utils/types/discount"

interface DiscountStatsCardsProps {
  stats: CampaignStats
  campaignCount: number
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

export default function DiscountStatsCards({ stats, campaignCount }: DiscountStatsCardsProps) {
  const cards = [
    {
      label: "Total Campaigns",
      value: campaignCount,
      icon: Ticket,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Vouchers Claimed",
      value: stats.claimedVouchers,
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: "Redeemed",
      value: stats.redeemedVouchers,
      icon: CheckCircle2,
      color: "text-green-500",
      bg: "bg-green-500/10",
    },
    {
      label: "Available",
      value: stats.availableVouchers,
      icon: Clock,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
  ]

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 lg:grid-cols-4 gap-4"
    >
      {cards.map((card) => (
        <motion.div
          key={card.label}
          variants={item}
          className="bg-card rounded-xl p-4 border border-border"
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <div>
              <p className="text-sm text-text/60">{card.label}</p>
              <p className="text-xl font-bold">{card.value}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  )
}
```

**Step 3: Create `DiscountDashboard.tsx`**

Create `components/owner/DiscountDashboard.tsx`. This is the main owner-facing component with campaign listing, create/edit modals, and voucher management. Follow the existing project patterns (motion animations, Tailwind classes, lucide icons, cn utility):

```tsx
"use client"

import { useState } from "react"
import { motion } from "motion/react"
import {
  Plus,
  Ticket,
  Search,
  Filter,
  MoreVertical,
  Edit2,
  Trash2,
  QrCode,
  Copy,
  ExternalLink,
  Clock,
  Percent,
  Gift,
  Pause,
  Play,
  CheckCircle2,
  Users,
  X,
} from "lucide-react"
import Link from "next/link"
import type { DiscountCampaign } from "@/utils/types/discount"
import DiscountStatsCards from "./DiscountStatsCards"

interface DiscountDashboardProps {
  cafeId: string
  cafeName: string
  cafeSlug: string
  campaigns: DiscountCampaign[]
}

export default function DiscountDashboard({
  cafeId,
  cafeName,
  cafeSlug,
  campaigns,
}: DiscountDashboardProps) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<DiscountCampaign | null>(null)

  const filteredCampaigns = campaigns.filter((c) => {
    const matchesSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.description?.toLowerCase().includes(search.toLowerCase()) ?? false)
    const matchesStatus = statusFilter === "all" || c.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const totalVouchers = campaigns.reduce(
    (sum, c) => sum + (c.currentRedemptions ?? 0),
    0
  )
  const activeCampaigns = campaigns.filter((c) => c.status === "active").length

  const stats = {
    totalVouchers: campaigns.reduce((sum, c) => sum + c.maxRedemptions, 0),
    claimedVouchers: totalVouchers,
    redeemedVouchers: campaigns.reduce(
      (sum, c) => sum + (c.currentRedemptions ?? 0),
      0
    ),
    availableVouchers: campaigns.reduce(
      (sum, c) => sum + c.maxRedemptions - (c.currentRedemptions ?? 0),
      0
    ),
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-green-500/10 text-green-500",
      draft: "bg-gray-500/10 text-gray-500",
      paused: "bg-amber-500/10 text-amber-500",
      expired: "bg-red-500/10 text-red-500",
      archived: "bg-gray-500/10 text-gray-400",
    }
    return styles[status] ?? "bg-gray-500/10 text-gray-500"
  }

  const getDiscountLabel = (type: string, value: number, freeItemName?: string | null) => {
    switch (type) {
      case "percentage":
        return `${value}% off`
      case "fixed_amount":
        return `₱${value} off`
      case "free_item":
        return `Free ${freeItemName ?? "item"}`
      default:
        return `${value} off`
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold">Discounts & Vouchers</h1>
          <p className="text-text/60 mt-1">
            Manage discount campaigns for {cafeName}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/owner/cafes/${cafeSlug}/discounts/create`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Campaign
          </Link>
        </div>
      </div>

      {/* Stats */}
      <DiscountStatsCards stats={stats} campaignCount={campaigns.length} />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex gap-2">
          {["all", "active", "draft", "paused", "expired"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                statusFilter === status
                  ? "bg-primary text-white"
                  : "bg-card border border-border text-text/60 hover:text-text"
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Campaign List */}
      {filteredCampaigns.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-text/5 flex items-center justify-center">
            <Ticket className="w-10 h-10 text-text opacity-30" />
          </div>
          <h2 className="text-xl font-serif font-bold mb-2">No Campaigns Yet</h2>
          <p className="text-text/60 max-w-md mx-auto mb-6">
            Create your first discount campaign to start attracting customers with vouchers and special offers.
          </p>
          <Link
            href={`/owner/cafes/${cafeSlug}/discounts/create`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Campaign
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCampaigns.map((campaign) => (
            <Link
              key={campaign.id}
              href={`/owner/cafes/${cafeSlug}/discounts/${campaign.id}`}
              className="block bg-card rounded-xl border border-border hover:border-primary/30 transition-colors p-4 sm:p-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold truncate">{campaign.name}</h3>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadge(campaign.status)}`}>
                      {campaign.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-text/60">
                    <span className="flex items-center gap-1.5">
                      {campaign.discountType === "percentage" && <Percent className="w-3.5 h-3.5" />}
                      {campaign.discountType === "fixed_amount" && <span className="text-xs font-bold">₱</span>}
                      {campaign.discountType === "free_item" && <Gift className="w-3.5 h-3.5" />}
                      {getDiscountLabel(campaign.discountType, campaign.discountValue, campaign.freeItemName)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      {campaign.currentRedemptions}/{campaign.maxRedemptions} redeemed
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(campaign.endDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-text/40" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </motion.div>
  )
}
```

**Step 4: Commit**

```bash
git add app/owner/cafes/ components/owner/DiscountDashboard.tsx components/owner/DiscountStatsCards.tsx
git commit -m "feat(discounts): add owner discount dashboard page and stats cards"
```

---

### Task 6: Owner UI — Create/Edit Campaign Forms

**Files:**
- Create: `app/owner/cafes/[slug]/discounts/create/page.tsx`
- Create: `components/owner/CreateCampaignForm.tsx`
- Create: `components/owner/GenerateVouchersModal.tsx`

**Step 1: Create the create campaign page**

Create `app/owner/cafes/[slug]/discounts/create/page.tsx`:

```tsx
import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { getCafeForOwnerManagement } from "@/app/api/actions/owner"
import CreateCampaignForm from "@/components/owner/CreateCampaignForm"

export const metadata: Metadata = {
  title: "Create Discount Campaign | Grounds",
  description: "Create a new discount campaign for your cafe.",
}

export default async function CreateCampaignPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth?redirect=/owner")
  }

  const cafe = await getCafeForOwnerManagement(slug)
  if (!cafe) {
    redirect("/owner")
  }

  return (
    <main className="min-h-screen w-full bg-background pt-6 pb-12">
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <CreateCampaignForm cafeId={cafe.id} cafeName={cafe.name} cafeSlug={slug} />
      </div>
    </main>
  )
}
```

**Step 2: Create `CreateCampaignForm.tsx`**

Create `components/owner/CreateCampaignForm.tsx`. This form handles creating and editing campaigns. Follow the project's form patterns (useActionState or useState with server actions). Include fields for:
- Name, description
- Discount type (percentage / fixed_amount / free_item) with conditional fields
- Discount value
- Free item name (shown when type = free_item)
- Max redemptions, max per user
- Min purchase amount (optional)
- Code prefix
- Start/end dates
- Public toggle, QR code enabled toggle
- Terms and conditions

Use `motion/react` for animations, `lucide-react` for icons, Tailwind for styling. Match the pattern of existing forms like `CafeEdit.tsx` or `InventoryItemModal.tsx`.

**Step 3: Create `GenerateVouchersModal.tsx`**

Create `components/owner/GenerateVouchersModal.tsx`. This modal lets the owner:
- Generate N vouchers for a campaign
- See the generated codes
- Copy codes to clipboard
- Issue a voucher to a specific user (by user ID)

**Step 4: Commit**

```bash
git add app/owner/cafes/[slug]/discounts/create/ components/owner/CreateCampaignForm.tsx components/owner/GenerateVouchersModal.tsx
git commit -m "feat(discounts): add campaign creation form and voucher generation modal"
```

---

### Task 7: Owner UI — Campaign Detail & Redeem View

**Files:**
- Create: `app/owner/cafes/[slug]/discounts/[campaignId]/page.tsx`
- Create: `components/owner/CampaignDetail.tsx`
- Create: `components/owner/VoucherRedeemPanel.tsx`
- Create: `components/owner/VoucherTable.tsx`

**Step 1: Create campaign detail page**

Create `app/owner/cafes/[slug]/discounts/[campaignId]/page.tsx`:

```tsx
import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { getCafeForOwnerManagement } from "@/app/api/actions/owner"
import { getCampaignById } from "@/app/api/actions/discount"
import CampaignDetail from "@/components/owner/CampaignDetail"

export const metadata: Metadata = {
  title: "Campaign Details | Grounds",
  description: "View and manage your discount campaign.",
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ slug: string; campaignId: string }>
}) {
  const { slug, campaignId } = await params
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth?redirect=/owner")
  }

  const cafe = await getCafeForOwnerManagement(slug)
  if (!cafe) {
    redirect("/owner")
  }

  const result = await getCampaignById(campaignId)
  if (!result.success || !result.data) {
    redirect(`/owner/cafes/${slug}/discounts`)
  }

  return (
    <main className="min-h-screen w-full bg-background pt-6 pb-12">
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <CampaignDetail
          campaign={result.data.campaign}
          stats={result.data.stats}
          cafeId={cafe.id}
          cafeName={cafe.name}
          cafeSlug={slug}
        />
      </div>
    </main>
  )
}
```

**Step 2: Create `CampaignDetail.tsx`**

This component shows:
- Campaign info header (name, status badge, discount type/value)
- Stats cards (total vouchers, claimed, redeemed, available)
- Action buttons (edit, pause/resume, archive, generate vouchers, manage QR)
- Tabs for: Vouchers list | Redemption Logs
- VoucherRedeemPanel for scanning/entering codes

**Step 3: Create `VoucherRedeemPanel.tsx`**

This component allows owners to:
- Enter a voucher code manually and click "Redeem"
- Show a QR scanner placeholder (using a text input for now, with a note about integrating camera scanner later)
- Display redemption result with success/error feedback

**Step 4: Create `VoucherTable.tsx`**

A table showing vouchers for a campaign with columns: Code, Status Badge, User (if claimed), Claimed Date, Redeemed Date. Filterable by status. Paginated.

**Step 5: Commit**

```bash
git add app/owner/cafes/[slug]/discounts/[campaignId]/ components/owner/CampaignDetail.tsx components/owner/VoucherRedeemPanel.tsx components/owner/VoucherTable.tsx
git commit -m "feat(discounts): add campaign detail page, voucher table, and redeem panel"
```

---

### Task 8: User UI — Voucher Wallet (Profile Section)

**Files:**
- Create: `app/profile/vouchers/page.tsx`
- Create: `components/profile/VoucherWallet.tsx`
- Create: `components/profile/VoucherCard.tsx`

**Step 1: Create vouchers page in profile**

Create `app/profile/vouchers/page.tsx`:

```tsx
import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { getUserVouchers } from "@/app/api/actions/discount"
import VoucherWallet from "@/components/profile/VoucherWallet"

export const metadata: Metadata = {
  title: "My Vouchers | Grounds",
  description: "View and manage your discount vouchers.",
}

export default async function VouchersPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth?redirect=/profile/vouchers")
  }

  const result = await getUserVouchers()

  return (
    <main className="min-h-screen w-full bg-background pt-6 pb-12">
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <VoucherWallet vouchers={result.data?.vouchers ?? []} />
      </div>
    </main>
  )
}
```

**Step 2: Create `VoucherWallet.tsx`**

A client component that:
- Shows claimed (active) vouchers prominently at top
- Shows redeemed vouchers in a collapsed/historic section
- Each voucher shows: campaign name, discount value/type, cafe name, cafe thumbnail, expiry date
- Tabs: "Active" (claimed) | "Used" (redeemed) | "Expired"
- Empty state for each tab
- Button to "Enter Code" that opens a modal to input a voucher code

**Step 3: Create `VoucherCard.tsx`**

Individual voucher card component that:
- Shows discount type icon/badge (percentage, fixed, free item)
- Shows campaign name, cafe name with thumbnail
- Shows the voucher code (with copy button)
- Shows validity dates
- Shows a QR code button that when clicked shows the QR code for the voucher (for cafe scanning)
- Uses `qrcode.react` for QR code display
- Animations with `motion/react`

**Step 4: Commit**

```bash
git add app/profile/vouchers/ components/profile/VoucherWallet.tsx components/profile/VoucherCard.tsx
git commit -m "feat(discounts): add user voucher wallet page and components"
```

---

### Task 9: QR Code — Cafe Display & User Scan Flow

**Files:**
- Create: `app/api/discount/claim/[campaignId]/route.ts` (API route for QR redirect)
- Create: `components/owner/CampaignQRCode.tsx`
- Update: `components/profile/VoucherCard.tsx` (add QR display)

**Step 1: Create QR redirect API route**

Create `app/api/discount/claim/[campaignId]/route.ts`. This handles when a user scans a QR code:

```ts
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params

  // Redirect to the claim page on the frontend
  // The frontend will handle auth check and voucher claiming
  return NextResponse.redirect(
    new URL(`/profile/vouchers?claim=${campaignId}`, request.url).toString()
  )
}
```

**Step 2: Create `CampaignQRCode.tsx`**

This component is used by owners to display a QR code for their campaign. When scanned, it redirects to `/api/discount/claim/[campaignId]` which then redirects to the voucher claim UI.

```tsx
"use client"

import { useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Copy, Check, Download } from "lucide-react"
import { motion } from "motion/react"

interface CampaignQRCodeProps {
  campaignId: string
  campaignName: string
  baseUrl: string
}

export default function CampaignQRCode({
  campaignId,
  campaignName,
  baseUrl,
}: CampaignQRCodeProps) {
  const [copied, setCopied] = useState(false)

  const claimUrl = `${baseUrl}/api/discount/claim/${campaignId}`

  const handleCopy = async () => {
    await navigator.clipboard.writeText(claimUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl border border-border p-6 text-center space-y-4"
    >
      <h3 className="font-bold text-lg">{campaignName}</h3>
      <p className="text-sm text-text/60">
        Scan this QR code to claim your voucher
      </p>
      <div className="flex justify-center">
        <div className="bg-white p-4 rounded-xl">
          <QRCodeSVG
            value={claimUrl}
            size={200}
            level="M"
            includeMargin={false}
          />
        </div>
      </div>
      <div className="flex gap-2 justify-center">
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-2 px-4 py-2 bg-text/10 rounded-lg text-sm font-medium hover:bg-text/20 transition-colors"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copied!" : "Copy Link"}
        </button>
      </div>
    </motion.div>
  )
}
```

**Step 3: Update `VoucherCard.tsx` to include a QR code display**

Add a toggle button on each active voucher card that shows/hides a QR code containing the voucher code. The QR content is just the voucher code string (for manual entry by cafe staff) or the voucher ID for lookups.

**Step 4: Commit**

```bash
git add app/api/discount/ components/owner/CampaignQRCode.tsx components/profile/VoucherCard.tsx
git commit -m "feat(discounts): add QR code system for campaigns and voucher display"
```

---

### Task 10: Voucher Claim Modal (Enter Code Flow)

**Files:**
- Create: `components/profile/ClaimVoucherModal.tsx`
- Update: `components/profile/VoucherWallet.tsx` (add claim button + modal)

**Step 1: Create `ClaimVoucherModal.tsx`**

A modal that allows users to enter a voucher code manually. Uses `components/modal/` pattern from the project.

```tsx
"use client"

import { useState, useActionState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { X, Ticket, Loader2 } from "lucide-react"
import { claimVoucher } from "@/app/api/actions/discount"

interface ClaimVoucherModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function ClaimVoucherModal({ isOpen, onClose, onSuccess }: ClaimVoucherModalProps) {
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const result = await claimVoucher({ code: code.trim().toUpperCase() })

    if (result.success) {
      setCode("")
      onSuccess()
      onClose()
    } else {
      setError(result.error ?? "Failed to claim voucher")
    }

    setIsSubmitting(false)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-card rounded-xl border border-border p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Claim Voucher</h2>
              <button onClick={onClose} className="p-1 hover:bg-text/10 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Voucher Code</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="GROUNDS-XXXX-XXXX"
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-mono text-center text-lg tracking-wider"
                  maxLength={20}
                />
              </div>

              {error && (
                <p className="text-sm text-red-500 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>
              )}

              <button
                type="submit"
                disabled={!code.trim() || isSubmitting}
                className="w-full py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Ticket className="w-4 h-4" />
                )}
                {isSubmitting ? "Claiming..." : "Claim Voucher"}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

**Step 2: Update `VoucherWallet.tsx` to add claim button + modal trigger**

Add a "Enter Code" button at the top that opens the ClaimVoucherModal.

**Step 3: Commit**

```bash
git add components/profile/ClaimVoucherModal.tsx components/profile/VoucherWallet.tsx
git commit -m "feat(discounts): add voucher claim modal for entering codes"
```

---

### Task 11: QR Scan Claim Flow (Frontend Route)

**Files:**
- Create: `app/profile/vouchers/claim/page.tsx`
- Create: `components/profile/ClaimVoucherPage.tsx`

**Step 1: Create the claim route page**

This page handles the redirect from QR codes via `/api/discount/claim/[campaignId]`. The user arrives at `/profile/vouchers?claim={campaignId}` where a modal auto-opens to claim from that campaign.

Create `app/profile/vouchers/claim/page.tsx`:

```tsx
import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { getPublicCampaignsForCafe } from "@/app/api/actions/discount"

export const metadata: Metadata = {
  title: "Claim Voucher | Grounds",
  description: "Claim your discount voucher.",
}

// This page is reached when user scans a QR code
// Redirect to vouchers page with claim parameter
export default async function ClaimPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth?redirect=/profile/vouchers")
  }

  // Redirect to vouchers wallet - the wallet will handle the claim parameter
  redirect("/profile/vouchers")
}
```

**Step 2: Update `VoucherWallet.tsx` to handle the `?claim=` query parameter**

When the URL has `?claim={campaignId}`, auto-open the claim flow for that specific campaign. This means:
- Read searchParams on the vouchers page
- Pass `campaignIdToClaim` as a prop
- If it exists, show a modal that calls `claimVoucherFromCampaign` with that ID

**Step 3: Commit**

```bash
git add app/profile/vouchers/claim/ components/profile/
git commit -m "feat(discounts): add QR scan claim flow with campaign-specific modal"
```

---

### Task 12: Cafe Page — Public Discount Display

**Files:**
- Create: `components/cafe/CafeDiscounts.tsx`
- Update: cafe page to show active discounts

**Step 1: Create `CafeDiscounts.tsx`**

A public-facing component shown on the cafe detail page that lists active campaigns:

```tsx
"use client"

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import { Ticket, Percent, Gift, Clock, ArrowRight } from "lucide-react"
import { getPublicCampaignsForCafe } from "@/app/api/actions/discount"
import type { DiscountCampaign } from "@/utils/types/discount"

interface CafeDiscountsProps {
  cafeId: string
  cafeSlug: string
}

export default function CafeDiscounts({ cafeId, cafeSlug }: CafeDiscountsProps) {
  const [campaigns, setCampaigns] = useState<DiscountCampaign[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPublicCampaignsForCafe(cafeId).then((result) => {
      if (result.success && result.data) {
        setCampaigns(result.data.campaigns)
      }
      setLoading(false)
    })
  }, [cafeId])

  if (loading) return null
  if (campaigns.length === 0) return null

  const getDiscountIcon = (type: string) => {
    switch (type) {
      case "percentage": return <Percent className="w-5 h-5" />
      case "fixed_amount": return <span className="text-sm font-bold">₱</span>
      case "free_item": return <Gift className="w-5 h-5" />
      default: return <Ticket className="w-5 h-5" />
    }
  }

  const getDiscountLabel = (type: string, value: number, freeItemName?: string | null) => {
    switch (type) {
      case "percentage": return `${value}% off`
      case "fixed_amount": return `₱${value} off`
      case "free_item": return `Free ${freeItemName ?? "item"}`
      default: return `${value} off`
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-serif font-bold flex items-center gap-2">
        <Ticket className="w-5 h-5 text-primary" />
        Current Discounts
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {campaigns.map((campaign) => (
          <motion.div
            key={campaign.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl border border-border p-4 hover:border-primary/30 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                {getDiscountIcon(campaign.discountType)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold truncate">{campaign.name}</h3>
                <p className="text-primary font-medium text-sm mt-0.5">
                  {getDiscountLabel(campaign.discountType, campaign.discountValue, campaign.freeItemName)}
                </p>
                {campaign.description && (
                  <p className="text-text/60 text-sm mt-1 line-clamp-2">{campaign.description}</p>
                )}
                <div className="flex items-center gap-1.5 mt-2 text-xs text-text/50">
                  <Clock className="w-3 h-3" />
                  Valid until {new Date(campaign.endDate).toLocaleDateString()}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
```

**Step 2: Integrate into the cafe detail page**

Locate the cafe detail page (likely `app/cafes/[slug]/page.tsx`) and add the `CafeDiscounts` component in a suitable section. Only show if the user is logged in.

**Step 3: Commit**

```bash
git add components/cafe/CafeDiscounts.tsx app/cafes/
git commit -m "feat(discounts): add public discount display on cafe detail page"
```

---

### Task 13: Owner Dashboard — Discounts Link

**Files:**
- Update: `components/owner/OwnerDashboard.tsx` (add discounts link to each cafe card)
- Update: `components/owner/CafeManagement.tsx` (add discounts tab/link if applicable)

**Step 1: Add "Discounts" link to owner dashboard**

In the `OwnerDashboard.tsx` component, add a link/button for "Discounts" alongside the existing links (like "Edit", "Inventory", "Reviews"). The link should go to `/owner/cafes/{slug}/discounts`.

**Step 2: Add to cafe management navigation if exists**

Search for where the cafe management tabs/links are and add a Discounts entry.

**Step 3: Commit**

```bash
git add components/owner/OwnerDashboard.tsx components/owner/CafeManagement.tsx
git commit -m "feat(discounts): add discounts link to owner dashboard and cafe management"
```

---

### Task 14: Profile Navigation — Vouchers Tab

**Files:**
- Update: Profile navigation to include Vouchers tab

**Step 1: Add Vouchers tab to profile**

Find the profile navigation component (likely in `app/profile/[username]/page.tsx` or a shared profile layout) and add a "Vouchers" tab alongside existing tabs like Collections, Visits, etc.

**Step 2: Commit**

```bash
git add app/profile/ components/profile/
git commit -m "feat(discounts): add vouchers tab to profile navigation"
```

---

### Task 15: Feature Flag for Discounts

**Files:**
- Update: `utils/feature-flags.ts` (add discount feature flag)
- Update: Discount UI components (wrap in feature flag check)

**Step 1: Add discount feature flag to `utils/feature-flags.ts`**

```ts
const DISCOUNTS_FLAG_KEY = "discounts_enabled"

export async function getDiscountsEnabled(): Promise<boolean> {
    const envValue = process.env.DISCOUNTS_ENABLED
    if (envValue === "false" || envValue === "0") return false
    if (envValue === "true" || envValue === "1") return true

    const result = await db
        .select({ enabled: featureFlags.enabled })
        .from(featureFlags)
        .where(eq(featureFlags.key, DISCOUNTS_FLAG_KEY))
        .limit(1)

    if (result.length === 0) return true
    return result[0].enabled
}
```

**Step 2: Seed the feature flag**

Create a one-time script or add to the existing seed process:

```ts
// In a migration or seed script:
await db.insert(featureFlags).values({
  key: "discounts_enabled",
  enabled: true,
}).onConflictDoNothing()
```

**Step 3: Wrap discount UI in feature flag checks**

In the server components that render discount UI, check the feature flag before rendering. If disabled, skip the discount sections.

**Step 4: Commit**

```bash
git add utils/feature-flags.ts
git commit -m "feat(discounts): add feature flag for discounts system"
```

---

### Task 16: Expire Vouchers Cron Logic

**Files:**
- Create: `app/api/cron/expire-vouchers/route.ts`

**Step 1: Create cron endpoint to expire vouchers**

This endpoint marks vouchers as expired when their campaign end date has passed. Can be called by a cron service or triggered manually:

```ts
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { discountVouchers, discountCampaigns } from "@/db/schema"
import { eq, and, lt, sql } from "drizzle-orm"

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const now = new Date()

    // Expire campaigns past their end date
    await db
      .update(discountCampaigns)
      .set({ status: "expired", updatedAt: now })
      .where(
        and(
          eq(discountCampaigns.status, "active"),
          lt(discountCampaigns.endDate, now)
        )
      )

    // Expire vouchers past their expiry
    await db
      .update(discountVouchers)
      .set({ status: "expired", updatedAt: now })
      .where(
        and(
          sql`${discountVouchers.status} IN ('available', 'claimed')`,
          lt(discountVouchers.expiresAt, now)
        )
      )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[expire-vouchers] Error:", error)
    return NextResponse.json({ error: "Failed to expire vouchers" }, { status: 500 })
  }
}
```

**Step 2: Commit**

```bash
git add app/api/cron/
git commit -m "feat(discounts): add cron endpoint to expire vouchers and campaigns"
```

---

### Task 17: Integration Tests

**Files:**
- Create: `app/api/actions/__tests__/discount-actions.test.ts`

**Step 1: Write integration tests for the discount actions**

Test the following flows:
1. Create a campaign (success + validation errors)
2. Generate vouchers for a campaign
3. Claim a voucher by code
4. Claim a voucher from a campaign (QR flow)
5. Redeem a voucher
6. Max per user enforcement
7. Campaign capacity enforcement
8. Lookup voucher by code
9. Cancel a voucher
10. Auth enforcement (non-owner cannot create campaigns)

Use `bun test` and follow the existing test patterns from `inventory-actions.test.ts`.

**Step 2: Run tests**

Run: `bun test app/api/actions/__tests__/discount-actions.test.ts`

Expected: All tests pass.

**Step 3: Commit**

```bash
git add app/api/actions/__tests__/discount-actions.test.ts
git commit -m "feat(discounts): add integration tests for discount actions"
```

---

### Task 18: Final Phase — Fix lint, build errors, and warnings

**Step 1: Run linter**

Run: `bun lint`

Fix all lint errors and warnings related to the new discount code.

**Step 2: Run build**

Run: `bun build`

Fix all build errors and type errors. Ensure all pages compile successfully.

**Step 3: Run all tests**

Run: `bun test`

Fix any test failures.

**Step 4: Fix any remaining issues**

Address any warnings, unused imports, type mismatches, or accessibility issues found during lint/build.

**Step 5: Final commit**

```bash
git add -A
git commit -m "fix(discounts): resolve all lint, build, and test errors"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Database enums for discounts |
| 2 | Database tables (campaigns, vouchers, redemption logs) |
| 3 | TypeScript types & Zod validation |
| 4 | Server actions (CRUD, generate, claim, redeem) |
| 5 | Owner dashboard page + stats cards |
| 6 | Owner create/edit campaign forms + voucher generation modal |
| 7 | Owner campaign detail + redeem panel + voucher table |
| 8 | User voucher wallet in profile |
| 9 | QR code system (campaign QR + voucher QR) |
| 10 | Voucher claim modal (manual code entry) |
| 11 | QR scan claim flow (redirect route) |
| 12 | Public discount display on cafe pages |
| 13 | Owner dashboard discounts link |
| 14 | Profile navigation vouchers tab |
| 15 | Feature flag for discounts |
| 16 | Expire vouchers cron endpoint |
| 17 | Integration tests |
| 18 | Fix all lint/build/test errors |

Total: **18 tasks**