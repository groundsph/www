"use server"

import { db } from "@/db"
import { systemLogs, profiles } from "@/db/schema"
import { desc, eq, and, gte, lte, or, ilike, sql } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
import { isAdmin } from "./admin"

export interface SystemLog {
    id: string
    userId: string
    user: {
        username: string | null
        displayName: string | null
        avatarUrl: string | null
    } | null
    action: string
    entityType: string
    entityId: string
    beforeValue: Record<string, unknown> | null
    afterValue: Record<string, unknown> | null
    userAgent: string | null
    metadata: Record<string, unknown> | null
    createdAt: Date | null
}

export interface SystemLogFilters {
    action?: string
    entityType?: string
    userId?: string
    startDate?: Date
    endDate?: Date
    search?: string
}

/**
 * Log a system action
 * Call this from any management action to record the change
 */
export async function logSystemAction(
    action: string,
    entityType: string,
    entityId: string,
    beforeValue: unknown = null,
    afterValue: unknown = null,
    metadata: unknown = null
): Promise<void> {
    const user = await getCurrentUser()
    if (!user) return

    // Get user agent from headers (passed via metadata in client components)
    const userAgent = typeof metadata === "object" && metadata !== null && "userAgent" in metadata
        ? (metadata as { userAgent?: string }).userAgent
        : null

    // Truncate large fields to prevent bloat
    const truncatedBefore = truncateLargeFields(beforeValue)
    const truncatedAfter = truncateLargeFields(afterValue)

    await db.insert(systemLogs).values({
        userId: user.id,
        action,
        entityType,
        entityId,
        beforeValue: truncatedBefore,
        afterValue: truncatedAfter,
        userAgent,
        metadata,
    })
}

/**
 * Truncate large text fields and remove sensitive data
 */
function truncateLargeFields(value: unknown, maxLength = 1000): unknown {
    if (value === null || value === undefined) return null
    if (typeof value === "string") {
        return value.length > maxLength ? value.substring(0, maxLength) + "..." : value
    }
    if (typeof value !== "object") return value

    const truncated: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        // Skip sensitive fields
        if (["password", "token", "secret", "apiKey"].includes(key)) {
            truncated[key] = "[REDACTED]"
            continue
        }
        // Recursively truncate nested objects
        truncated[key] = truncateLargeFields(val, maxLength)
    }
    return truncated
}

/**
 * Get system logs with optional filters
 * Admin only
 */
export async function getSystemLogs(
    filters: SystemLogFilters = {},
    page = 1,
    pageSize = 50
): Promise<{ logs: SystemLog[]; total: number }> {
    const hasAccess = await isAdmin()
    if (!hasAccess) {
        return { logs: [], total: 0 }
    }

    const conditions = []

    if (filters.action) {
        conditions.push(eq(systemLogs.action, filters.action))
    }
    if (filters.entityType) {
        conditions.push(eq(systemLogs.entityType, filters.entityType))
    }
    if (filters.userId) {
        conditions.push(eq(systemLogs.userId, filters.userId))
    }
    if (filters.startDate) {
        conditions.push(gte(systemLogs.createdAt, filters.startDate))
    }
    if (filters.endDate) {
        conditions.push(lte(systemLogs.createdAt, filters.endDate))
    }
    if (filters.search) {
        // Search in entity_id or metadata
        conditions.push(
            or(
                ilike(sql`${systemLogs.entityId}`, `%${filters.search}%`),
                ilike(sql`${systemLogs.metadata}::text`, `%${filters.search}%`)
            )
        )
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // Get total count
    const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(systemLogs)
        .where(whereClause)

    const total = countResult[0]?.count ?? 0

    // Get logs with user info
    const logsResult = await db
        .select({
            id: systemLogs.id,
            userId: systemLogs.userId,
            action: systemLogs.action,
            entityType: systemLogs.entityType,
            entityId: systemLogs.entityId,
            beforeValue: systemLogs.beforeValue,
            afterValue: systemLogs.afterValue,
            userAgent: systemLogs.userAgent,
            metadata: systemLogs.metadata,
            createdAt: systemLogs.createdAt,
            user: {
                username: profiles.username,
                displayName: profiles.displayName,
                avatarUrl: profiles.avatarUrl,
            },
        })
        .from(systemLogs)
        .leftJoin(profiles, eq(systemLogs.userId, profiles.id))
        .where(whereClause)
        .orderBy(desc(systemLogs.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize)

    // Cast jsonb fields to the correct type
    const logs: SystemLog[] = logsResult.map(log => ({
        ...log,
        beforeValue: log.beforeValue as Record<string, unknown> | null,
        afterValue: log.afterValue as Record<string, unknown> | null,
        metadata: log.metadata as Record<string, unknown> | null,
    }))

    return { logs, total }
}

/**
 * Get log statistics for analytics
 * Admin only
 */
export async function getSystemLogStats(days = 30): Promise<{
    totalLogs: number
    logsByAction: { action: string; count: number }[]
    logsByEntityType: { entityType: string; count: number }[]
    logsByUser: { userId: string; username: string | null; count: number }[]
    dailyTrend: { date: string; count: number }[]
}> {
    const hasAccess = await isAdmin()
    if (!hasAccess) {
        return {
            totalLogs: 0,
            logsByAction: [],
            logsByEntityType: [],
            logsByUser: [],
            dailyTrend: [],
        }
    }

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Total count
    const totalResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(systemLogs)
        .where(gte(systemLogs.createdAt, startDate))

    // By action
    const byAction = await db
        .select({
            action: systemLogs.action,
            count: sql<number>`count(*)::int`,
        })
        .from(systemLogs)
        .where(gte(systemLogs.createdAt, startDate))
        .groupBy(systemLogs.action)

    // By entity type
    const byEntityType = await db
        .select({
            entityType: systemLogs.entityType,
            count: sql<number>`count(*)::int`,
        })
        .from(systemLogs)
        .where(gte(systemLogs.createdAt, startDate))
        .groupBy(systemLogs.entityType)

    // By user
    const byUser = await db
        .select({
            userId: systemLogs.userId,
            username: profiles.username,
            count: sql<number>`count(*)::int`,
        })
        .from(systemLogs)
        .leftJoin(profiles, eq(systemLogs.userId, profiles.id))
        .where(gte(systemLogs.createdAt, startDate))
        .groupBy(systemLogs.userId, profiles.username)
        .orderBy(sql`count(*)::int DESC`)
        .limit(10)

    // Daily trend
    const daily = await db
        .select({
            date: sql<string>`DATE(created_at)`,
            count: sql<number>`count(*)::int`,
        })
        .from(systemLogs)
        .where(gte(systemLogs.createdAt, startDate))
        .groupBy(sql`DATE(created_at)`)
        .orderBy(sql`DATE(created_at)`)

    return {
        totalLogs: totalResult[0]?.count ?? 0,
        logsByAction: byAction,
        logsByEntityType: byEntityType,
        logsByUser: byUser,
        dailyTrend: daily.map(d => ({
            date: d.date,
            count: d.count,
        })),
    }
}

/**
 * Export system logs as CSV
 * Admin only
 */
export async function exportSystemLogsCSV(
    filters: SystemLogFilters = {}
): Promise<string> {
    const hasAccess = await isAdmin()
    if (!hasAccess) {
        return ""
    }

    const { logs } = await getSystemLogs(filters, 1, 10000)

    // CSV headers
    const headers = [
        "ID",
        "Timestamp",
        "User",
        "Action",
        "Entity Type",
        "Entity ID",
        "Before",
        "After",
        "User Agent",
    ]

    // CSV rows
    const rows = logs.map(log => [
        log.id,
        log.createdAt?.toISOString() ?? "",
        log.user?.username || "unknown",
        log.action,
        log.entityType,
        log.entityId,
        log.beforeValue ? JSON.stringify(log.beforeValue) : "",
        log.afterValue ? JSON.stringify(log.afterValue) : "",
        log.userAgent || "",
    ])

    // Escape fields with commas/quotes
    const escapeField = (field: string) => {
        if (field.includes(",") || field.includes("\"") || field.includes("\n")) {
            return `"${field.replace(/"/g, "\"")}"`
        }
        return field
    }

    const csv = [
        headers.join(","),
        ...rows.map(row => row.map(escapeField).join(",")),
    ].join("\n")

    return csv
}
