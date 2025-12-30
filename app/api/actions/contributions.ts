"use server"

import { db } from "@/db"
import { contributionLogs, profiles, cafes } from "@/db/schema"
import { eq, desc } from "drizzle-orm"
import { Database } from "@/utils/types/database.types"

type ContributionLog = Database["public"]["Tables"]["contribution_logs"]["Row"]

export interface ContributionLogWithAuthor extends ContributionLog {
    author: {
        id: string
        username: string
        display_name: string
        avatar_url: string | null
    }
}

export interface ContributionLogWithCafe extends ContributionLog {
    cafe: {
        id: string
        name: string
        slug: string
        thumbnail: string
    }
}

/**
 * Get contribution logs for a specific cafe
 * Public endpoint - anyone can view
 */
export async function getCafeContributions(
    cafeId: string,
    limit: number = 20
): Promise<ContributionLogWithAuthor[]> {
    const results = await db
        .select({
            id: contributionLogs.id,
            userId: contributionLogs.userId,
            cafeId: contributionLogs.cafeId,
            actionType: contributionLogs.actionType,
            details: contributionLogs.details,
            createdAt: contributionLogs.createdAt,
            // Author fields
            authorId: profiles.id,
            authorUsername: profiles.username,
            authorDisplayName: profiles.displayName,
            authorAvatarUrl: profiles.avatarUrl,
        })
        .from(contributionLogs)
        .leftJoin(profiles, eq(contributionLogs.userId, profiles.id))
        .where(eq(contributionLogs.cafeId, cafeId))
        .orderBy(desc(contributionLogs.createdAt))
        .limit(limit)

    return results.map((r) => ({
        id: r.id,
        user_id: r.userId,
        cafe_id: r.cafeId,
        action_type: r.actionType,
        details: r.details,
        created_at: r.createdAt?.toISOString() ?? null,
        author: {
            id: r.authorId ?? "",
            username: r.authorUsername ?? "",
            display_name: r.authorDisplayName ?? "",
            avatar_url: r.authorAvatarUrl,
        },
    })) as ContributionLogWithAuthor[]
}

/**
 * Get contribution logs for a specific user
 * Public endpoint - anyone can view
 */
export async function getUserContributions(
    userId: string,
    limit: number = 50
): Promise<ContributionLogWithCafe[]> {
    const results = await db
        .select({
            id: contributionLogs.id,
            logUserId: contributionLogs.userId,
            cafeId: contributionLogs.cafeId,
            actionType: contributionLogs.actionType,
            details: contributionLogs.details,
            createdAt: contributionLogs.createdAt,
            // Cafe fields
            cafeTableId: cafes.id,
            cafeName: cafes.name,
            cafeSlug: cafes.slug,
            cafeThumbnail: cafes.thumbnail,
        })
        .from(contributionLogs)
        .leftJoin(cafes, eq(contributionLogs.cafeId, cafes.id))
        .where(eq(contributionLogs.userId, userId))
        .orderBy(desc(contributionLogs.createdAt))
        .limit(limit)

    return results.map((r) => ({
        id: r.id,
        user_id: r.logUserId,
        cafe_id: r.cafeId,
        action_type: r.actionType,
        details: r.details,
        created_at: r.createdAt?.toISOString() ?? null,
        cafe: {
            id: r.cafeTableId ?? "",
            name: r.cafeName ?? "",
            slug: r.cafeSlug ?? "",
            thumbnail: r.cafeThumbnail ?? "",
        },
    })) as ContributionLogWithCafe[]
}
