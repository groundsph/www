"use server"

import { db } from "@/db"
import { badgeDefinitions, profiles } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
import {
    awardMapUsageBadge,
    backfillBadgesForAllUsersInternal,
    checkAndAwardBadges,
} from "@/utils/badges/badge-logic"
import type { BadgeBackfillResult } from "@/utils/badges/badge-logic"

export interface BadgeDetails {
    id: string
    name: string
    description: string
    image_url: string
    category: "achievement" | "monetary" | "social"
    rarity: "common" | "rare" | "legendary"
    metadata: { icon_name?: string; icon_color?: string } | null
}

export async function getBadgeByName(
    name: string,
): Promise<BadgeDetails | null> {
    const result = await db
        .select({
            id: badgeDefinitions.id,
            name: badgeDefinitions.name,
            description: badgeDefinitions.description,
            image_url: badgeDefinitions.imageUrl,
            category: badgeDefinitions.category,
            rarity: badgeDefinitions.rarity,
            metadata: badgeDefinitions.metadata,
        })
        .from(badgeDefinitions)
        .where(eq(badgeDefinitions.name, name))
        .limit(1)

    if (!result[0]) return null

    return {
        ...result[0],
        metadata: result[0].metadata as BadgeDetails["metadata"],
    }
}

// ============================================
// Badge auto-award server actions
// ============================================

/**
 * Re-run the badge sweep for the signed-in user.
 *
 * Badge rules are evaluated on their natural triggers (check-in, review, cafe
 * approval, Ko-fi webhook). This action exists as a safety net so an account
 * that was active before a rule existed can repair itself by visiting its own
 * profile — it can only ever touch the caller's own badges.
 */
export async function checkMyBadges(): Promise<{ awardedBadges: string[]; error?: string }> {
    const user = await getCurrentUser()
    if (!user) return { awardedBadges: [], error: "Not authenticated" }

    const awardedBadges = await checkAndAwardBadges(user.id, {
        scout: true,
        reviews: true,
        geographic: true,
        supporter: true,
        visits: true,
    })

    return { awardedBadges }
}

/**
 * Award the Eye Spy badge when the user interacts with the map.
 * Should be called from a client map interaction.
 */
export async function trackMapUsage(): Promise<{
    awarded: boolean
    badgeName?: string
    error?: string
}> {
    const user = await getCurrentUser()
    if (!user) {
        return { awarded: false, error: "Not authenticated" }
    }

    return awardMapUsageBadge(user.id)
}

/**
 * Backfill badges for all existing users. Admin only.
 * Safe to re-run — only genuinely missing badges are added.
 */
export async function backfillBadgesForAllUsers(): Promise<BadgeBackfillResult> {
    const user = await getCurrentUser()
    if (!user) {
        return { success: false, usersProcessed: 0, badgesAwarded: 0, errors: ["Not authenticated"] }
    }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, user.id))
        .limit(1)

    if (profileResult[0]?.role !== "admin") {
        return {
            success: false,
            usersProcessed: 0,
            badgesAwarded: 0,
            errors: ["Unauthorized - Admin only"],
        }
    }

    return backfillBadgesForAllUsersInternal()
}
