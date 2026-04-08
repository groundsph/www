import { pgTable, uuid, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core"
import { profiles } from "./tables"

export const chatConversations = pgTable("chat_conversations", {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: text("session_id").notNull(),
    userId: uuid("user_id").references(() => profiles.id),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    metadata: jsonb("metadata"),
})

export const chatMessages = pgTable("chat_messages", {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
        .notNull()
        .references(() => chatConversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // 'user' | 'assistant' | 'tool'
    content: text("content"),
    toolCalls: jsonb("tool_calls"), // array of tool call data
    toolCallId: text("tool_call_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

export const chatFeedback = pgTable("chat_feedback", {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
        .notNull()
        .references(() => chatMessages.id, { onDelete: "cascade" }),
    sessionId: text("session_id").notNull(),
    userId: uuid("user_id").references(() => profiles.id),
    rating: integer("rating").notNull(), // 1 = thumbs up, -1 = thumbs down
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})
