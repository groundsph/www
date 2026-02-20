import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core"

export const featureFlags = pgTable("feature_flags", {
    key: text("key").primaryKey(),
    enabled: boolean("enabled").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
})
