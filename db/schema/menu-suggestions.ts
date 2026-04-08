import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core"
import { profiles, cafes } from "./tables"

export const menuItemSuggestions = pgTable("menu_item_suggestions", {
    id: uuid("id").primaryKey().defaultRandom(),
    cafeId: uuid("cafe_id")
        .notNull()
        .references(() => cafes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
        .notNull()
        .references(() => profiles.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // 'add' | 'edit' | 'remove'
    targetItemId: uuid("target_item_id"), // for edit/remove, references cafeMenuItems.id
    suggestedData: jsonb("suggested_data").notNull(), // the proposed menu item data
    status: text("status").default("pending"), // 'pending' | 'approved' | 'rejected'
    adminNotes: text("admin_notes"),
    reviewedBy: uuid("reviewed_by").references(() => profiles.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})
