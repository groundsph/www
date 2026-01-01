"use server"

import { db } from "@/db"
import { collections, profiles } from "@/db/schema"
import { eq, desc, or, sql, inArray } from "drizzle-orm"

// =============================================================================
// PUBLIC COLLECTIONS
// =============================================================================

interface PublicCollection {
    id: string
    title: string
    slug: string
    description: string | null
    coverImage: string | null
    itemCount: number
    viewsCount: number
    likesCount: number
    createdAt: string
    author: {
        id: string
        username: string
        displayName: string
        avatarUrl: string | null
    }
}

/**
 * Get public collections for the community feed
 */
export async function getPublicCollections(
    page: number = 1,
    pageSize: number = 12,
    sortBy: "recent" | "popular" = "recent"
): Promise<{ collections: PublicCollection[]; total: number }> {
    const offset = (page - 1) * pageSize

    const orderBy = sortBy === "popular"
        ? desc(collections.likesCount)
        : desc(collections.createdAt)

    const results = await db
        .select({
            id: collections.id,
            title: collections.title,
            slug: collections.slug,
            description: collections.description,
            coverImage: collections.coverImage,
            itemCount: collections.itemCount,
            viewsCount: collections.viewsCount,
            likesCount: collections.likesCount,
            createdAt: collections.createdAt,
            userId: collections.userId,
        })
        .from(collections)
        .where(eq(collections.isPublic, true))
        .orderBy(orderBy)
        .limit(pageSize)
        .offset(offset)

    // Get total count
    const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(collections)
        .where(eq(collections.isPublic, true))

    const total = countResult[0]?.count ?? 0

    if (results.length === 0) {
        return { collections: [], total }
    }

    // Fetch authors
    const userIds = [...new Set(results.map(c => c.userId))]
    const authors = await db
        .select({
            id: profiles.id,
            username: profiles.username,
            displayName: profiles.displayName,
            avatarUrl: profiles.avatarUrl,
        })
        .from(profiles)
        .where(inArray(profiles.id, userIds))

    const authorMap = new Map(authors.map(a => [a.id, a]))

    return {
        collections: results.map(c => ({
            id: c.id,
            title: c.title,
            slug: c.slug,
            description: c.description,
            coverImage: c.coverImage,
            itemCount: c.itemCount ?? 0,
            viewsCount: c.viewsCount ?? 0,
            likesCount: c.likesCount ?? 0,
            createdAt: c.createdAt?.toISOString() ?? new Date().toISOString(),
            author: authorMap.get(c.userId) ?? {
                id: c.userId,
                username: "unknown",
                displayName: "Unknown User",
                avatarUrl: null,
            },
        })),
        total,
    }
}

// =============================================================================
// USER SEARCH
// =============================================================================

interface UserSearchResult {
    id: string
    username: string
    displayName: string
    avatarUrl: string | null
    bio: string | null
    isSupporter: boolean
}

/**
 * Search users by username or display name
 */
export async function searchUsers(
    query: string,
    limit: number = 20
): Promise<UserSearchResult[]> {
    if (!query || query.length < 2) {
        return []
    }

    const searchPattern = `%${query.toLowerCase()}%`

    const results = await db
        .select({
            id: profiles.id,
            username: profiles.username,
            displayName: profiles.displayName,
            avatarUrl: profiles.avatarUrl,
            bio: profiles.bio,
            isSupporter: profiles.isSupporter,
        })
        .from(profiles)
        .where(
            or(
                sql`lower(${profiles.username}) LIKE ${searchPattern}`,
                sql`lower(${profiles.displayName}) LIKE ${searchPattern}`
            )
        )
        .limit(limit)

    return results.map(u => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        bio: u.bio,
        isSupporter: u.isSupporter ?? false,
    }))
}

/**
 * Get featured/active users for the community page
 */
export async function getFeaturedUsers(limit: number = 8): Promise<UserSearchResult[]> {
    // Get users with highest contribution or supporters
    const results = await db
        .select({
            id: profiles.id,
            username: profiles.username,
            displayName: profiles.displayName,
            avatarUrl: profiles.avatarUrl,
            bio: profiles.bio,
            isSupporter: profiles.isSupporter,
        })
        .from(profiles)
        .where(eq(profiles.profileCompleted, true))
        .orderBy(desc(profiles.totalContribution))
        .limit(limit)

    return results.map(u => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        bio: u.bio,
        isSupporter: u.isSupporter ?? false,
    }))
}
