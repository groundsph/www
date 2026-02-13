/**
 * Maps owner-provided cafe updates from snake_case API format to camelCase for Drizzle.
 */
export function mapOwnerCafeUpdates(
    updates: Record<string, unknown>
): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    // Field mapping from snake_case to camelCase
    const fieldMap: Record<string, string> = {
        badge_stamp_url: "badgeStampUrl",
    }

    for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
            const drizzleKey = fieldMap[key] || key
            result[drizzleKey] = value
        }
    }

    return result
}
