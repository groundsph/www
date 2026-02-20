import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core"

export const chatRateLimits = pgTable("chat_rate_limits", {
    sessionId: text("session_id").primaryKey(),
    usedCount: integer("used_count").notNull().default(0),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})
