import { db } from "@/db"
import { featureFlags } from "@/db/schema"
import { eq } from "drizzle-orm"

const CHAT_FLAG_KEY = "chat_enabled"

export async function getChatEnabled(): Promise<boolean> {
    const envValue = process.env.CHAT_ENABLED
    if (envValue === "false" || envValue === "0") {
        return false
    }
    if (envValue === "true" || envValue === "1") {
        return true
    }

    const result = await db
        .select({ enabled: featureFlags.enabled })
        .from(featureFlags)
        .where(eq(featureFlags.key, CHAT_FLAG_KEY))
        .limit(1)

    if (result.length === 0) {
        return true
    }

    return result[0].enabled
}
