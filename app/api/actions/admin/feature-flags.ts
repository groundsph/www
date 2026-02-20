'use server'

import { db } from "@/db"
import { siteSettings } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export interface FeatureFlagResult {
    success: boolean
    enabled?: boolean
    error?: string
}

/**
 * Get the chat enabled flag from database
 * Falls back to environment variable if no DB setting exists
 */
export async function getChatEnabledFlag(): Promise<FeatureFlagResult> {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
        return { success: false, error: "Not authenticated" }
    }

    // Check if user is admin
    const { profiles } = await import("@/db/schema")
    const result = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (result[0]?.role !== 'admin' && result[0]?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    try {
        // Get from database
        const setting = await db
            .select({ value: siteSettings.value })
            .from(siteSettings)
            .where(eq(siteSettings.key, 'chat_enabled'))
            .limit(1)

        if (setting.length > 0) {
            return { success: true, enabled: setting[0].value === 'true' }
        }

        // Fallback to environment variable
        const envValue = process.env.ENABLE_CHAT !== 'false'
        return { success: true, enabled: envValue }
    } catch (error) {
        console.error("Error fetching chat enabled flag:", error)
        return { success: false, error: "Failed to fetch setting" }
    }
}

/**
 * Set the chat enabled flag in database
 */
export async function setChatEnabled(enabled: boolean): Promise<FeatureFlagResult> {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
        return { success: false, error: "Not authenticated" }
    }

    // Check if user is admin
    const { profiles } = await import("@/db/schema")
    const result = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (result[0]?.role !== 'admin') {
        return { success: false, error: "Only admins can change feature flags" }
    }

    try {
        // Upsert the setting
        await db.insert(siteSettings)
            .values({
                key: 'chat_enabled',
                value: enabled.toString(),
            })
            .onConflictDoUpdate({
                target: siteSettings.key,
                set: {
                    value: enabled.toString(),
                    updatedAt: new Date(),
                },
            })

        revalidatePath('/admin/settings/chat')
        return { success: true, enabled }
    } catch (error) {
        console.error("Error setting chat enabled flag:", error)
        return { success: false, error: "Failed to update setting" }
    }
}
