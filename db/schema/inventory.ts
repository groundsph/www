import {
    pgTable,
    pgEnum,
    uuid,
    text,
    timestamp,
    integer,
    real,
} from "drizzle-orm/pg-core"

import { cafes } from "./tables"

// ============================================================================
// INVENTORY ENUMS
// ============================================================================

export const inventoryItemStatusEnum = pgEnum("inventory_item_status", [
    "active",
    "inactive",
])

// ============================================================================
// INVENTORY TABLES
// ============================================================================

export const inventoryItems = pgTable("inventory_items", {
    id: uuid("id").primaryKey().defaultRandom(),
    cafeId: uuid("cafe_id")
        .notNull()
        .references(() => cafes.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sku: text("sku"),
    description: text("description"),
    category: text("category").notNull(),
    stock: integer("stock").notNull().default(0),
    warningThreshold: integer("warning_threshold").notNull().default(0),
    expiryDate: timestamp("expiry_date", { withTimezone: true }),
    costPrice: real("cost_price"),
    lastRestocked: timestamp("last_restocked", { withTimezone: true }),
    link: text("link"),
    status: inventoryItemStatusEnum("status").default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})

export const inventoryRestockHistory = pgTable("inventory_restock_history", {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
        .notNull()
        .references(() => inventoryItems.id, { onDelete: "cascade" }),
    date: timestamp("date", { withTimezone: true }).notNull(),
    quantity: integer("quantity").notNull(),
    unitCost: real("unit_cost"),
    totalAmount: real("total_amount"),
    invoiceNumber: text("invoice_number"),
    proofUrl: text("proof_url"),
    supplierName: text("supplier_name"),
    orderReference: text("order_reference"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})
