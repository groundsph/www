import { db } from "@/db"
import { systemLogs, siteSettings } from "@/db/schema"
import { eq, lt } from "drizzle-orm"

export interface LogCleanupResult {
    success: boolean
    retentionDays: number
    deletedCount: number
    error?: string
}

const DEFAULT_RETENTION_DAYS = 180
const RETENTION_KEY = "log_retention_days"

/**
 * Get the log retention days setting from site_settings
 * Defaults to 180 days if not set
 */
async function getRetentionDays(): Promise<number> {
    const setting = await db
        .select({ value: siteSettings.value })
        .from(siteSettings)
        .where(eq(siteSettings.key, RETENTION_KEY))
        .limit(1)

    if (setting.length === 0) {
        return DEFAULT_RETENTION_DAYS
    }

    const days = parseInt(setting[0].value, 10)
    return isNaN(days) || days < 1 ? DEFAULT_RETENTION_DAYS : days
}

/**
 * Clean up system logs older than the retention period
 */
export async function cleanupSystemLogs(): Promise<LogCleanupResult> {
    try {
        const retentionDays = await getRetentionDays()

        // Calculate cutoff date
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

        console.log(`[Log Cleanup] Retention period: ${retentionDays} days`)
        console.log(`[Log Cleanup] Deleting logs older than: ${cutoffDate.toISOString()}`)

        // Delete old logs
        const result = await db
            .delete(systemLogs)
            .where(lt(systemLogs.createdAt, cutoffDate))
            .returning({ id: systemLogs.id })

        const deletedCount = result.length

        console.log(`[Log Cleanup] Deleted ${deletedCount} old log entries`)

        return {
            success: true,
            retentionDays,
            deletedCount,
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error("[Log Cleanup] Failed to clean up system logs:", errorMessage)

        return {
            success: false,
            retentionDays: DEFAULT_RETENTION_DAYS,
            deletedCount: 0,
            error: errorMessage,
        }
    }
}

/**
 * Initialize the log retention setting if it doesn't exist
 * This can be called during deployment or manually to set the default
 */
export async function initializeLogRetention(): Promise<void> {
    const existing = await db
        .select({ value: siteSettings.value })
        .from(siteSettings)
        .where(eq(siteSettings.key, RETENTION_KEY))
        .limit(1)

    if (existing.length === 0) {
        await db.insert(siteSettings).values({
            key: RETENTION_KEY,
            value: String(DEFAULT_RETENTION_DAYS),
            updatedAt: new Date(),
        })
        console.log(`[Log Cleanup] Initialized log retention to ${DEFAULT_RETENTION_DAYS} days`)
    }
}
