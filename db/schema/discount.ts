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
