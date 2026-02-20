'use server'

import { db } from "@/db"
import { featureFlags, profiles } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
import { revalidatePath } from "next/cache"

const CHAT_FLAG_KEY = "chat_enabled"

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

    // Check if user is admin or moderator
    const result = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (result[0]?.role !== "admin" && result[0]?.role !== "moderator") {
        return { success: false, error: "Unauthorized" }
    }

    try {
        const setting = await db
            .select({ enabled: featureFlags.enabled })
            .from(featureFlags)
            .where(eq(featureFlags.key, CHAT_FLAG_KEY))
            .limit(1)

        if (setting.length > 0) {
            return { success: true, enabled: setting[0].enabled }
        }

        return { success: true, enabled: true }
    } catch (error) {
        console.error("Error fetching chat enabled flag:", error)
        return { success: false, error: "Failed to fetch setting" }
    }
}

/**
 * Set the chat enabled flag in database
 */
export async function setChatEnabled(
    enabled: boolean
): Promise<FeatureFlagResult> {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
        return { success: false, error: "Not authenticated" }
    }

    const result = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (result[0]?.role !== "admin") {
        return { success: false, error: "Only admins can change feature flags" }
    }

    try {
        await db
            .insert(featureFlags)
            .values({
                key: CHAT_FLAG_KEY,
                enabled,
                updatedAt: new Date(),
            })
            .onConflictDoUpdate({
                target: featureFlags.key,
                set: {
                    enabled,
                    updatedAt: new Date(),
                },
            })

        revalidatePath("/manage/system/settings")
        return { success: true, enabled }
    } catch (error) {
        console.error("Error setting chat enabled flag:", error)
        return { success: false, error: "Failed to update setting" }
    }
}
