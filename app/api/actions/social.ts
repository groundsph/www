"use server"

import { db } from "@/db"
import { profiles, userFollows, cafeVisits, cafes } from "@/db/schema"
import { getCurrentUser } from "@/lib/auth"
import { and, eq, desc, inArray, ilike, or, count, ne } from "drizzle-orm"


// ============================================================================
// FOLLOW SYSTEM
// ============================================================================

/**
 * Follow a user
 */
export async function followUser(targetUserId: string): Promise<{ success: boolean; error?: string }> {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "Unauthorized" }

    // Cannot follow yourself
    if (user.id === targetUserId) {
        return { success: false, error: "Cannot follow yourself" }
    }

    try {
        // Check if target user exists
        const targetUser = await db
            .select({ id: profiles.id })
            .from(profiles)
            .where(eq(profiles.id, targetUserId))
            .limit(1)

        if (!targetUser.length) {
            return { success: false, error: "User not found" }
        }

        // Check if already following
        const existingFollow = await db
            .select({ id: userFollows.id })
            .from(userFollows)
            .where(
                and(
                    eq(userFollows.followerId, user.id),
                    eq(userFollows.followingId, targetUserId)
                )
            )
            .limit(1)

        if (existingFollow.length > 0) {
            return { success: false, error: "Already following this user" }
        }

        // Create follow relationship
        await db.insert(userFollows).values({
            followerId: user.id,
            followingId: targetUserId,
        })

        return { success: true }
    } catch (error) {
        console.error("Error following user:", error)
        return { success: false, error: "Failed to follow user" }
    }
}

/**
 * Unfollow a user
 */
export async function unfollowUser(targetUserId: string): Promise<{ success: boolean; error?: string }> {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "Unauthorized" }

    try {
        await db
            .delete(userFollows)
            .where(
                and(
                    eq(userFollows.followerId, user.id),
                    eq(userFollows.followingId, targetUserId)
                )
            )

        return { success: true }
    } catch (error) {
        console.error("Error unfollowing user:", error)
        return { success: false, error: "Failed to unfollow user" }
    }
}

/**
 * Check if current user follows a specific user
 */
export async function isFollowing(targetUserId: string): Promise<boolean> {
    const user = await getCurrentUser()
    if (!user) return false

    try {
        const result = await db
            .select({ id: userFollows.id })
            .from(userFollows)
            .where(
                and(
                    eq(userFollows.followerId, user.id),
                    eq(userFollows.followingId, targetUserId)
                )
            )
            .limit(1)

        return result.length > 0
    } catch (error) {
        console.error("Error checking follow status:", error)
        return false
    }
}

/**
 * Get follower/following counts for a user
 */
export async function getFollowCounts(userId: string): Promise<{
    followers: number
    following: number
}> {
    try {
        const [followersResult, followingResult] = await Promise.all([
            db.select({ count: count() }).from(userFollows).where(eq(userFollows.followingId, userId)),
            db.select({ count: count() }).from(userFollows).where(eq(userFollows.followerId, userId)),
        ])

        return {
            followers: followersResult[0]?.count ?? 0,
            following: followingResult[0]?.count ?? 0,
        }
    } catch (error) {
        console.error("Error getting follow counts:", error)
        return { followers: 0, following: 0 }
    }
}

/**
 * Get list of followers for a user
 */
export async function getFollowers(
    userId: string,
    limit: number = 50
): Promise<{
    users: { id: string; username: string; displayName: string; avatarUrl: string | null }[]
}> {
    try {
        const result = await db
            .select({
                id: profiles.id,
                username: profiles.username,
                displayName: profiles.displayName,
                avatarUrl: profiles.avatarUrl,
            })
            .from(userFollows)
            .innerJoin(profiles, eq(userFollows.followerId, profiles.id))
            .where(eq(userFollows.followingId, userId))
            .orderBy(desc(userFollows.createdAt))
            .limit(limit)

        return { users: result }
    } catch (error) {
        console.error("Error getting followers:", error)
        return { users: [] }
    }
}

/**
 * Get list of users a user is following
 */
export async function getFollowing(
    userId: string,
    limit: number = 50
): Promise<{
    users: { id: string; username: string; displayName: string; avatarUrl: string | null }[]
}> {
    try {
        const result = await db
            .select({
                id: profiles.id,
                username: profiles.username,
                displayName: profiles.displayName,
                avatarUrl: profiles.avatarUrl,
            })
            .from(userFollows)
            .innerJoin(profiles, eq(userFollows.followingId, profiles.id))
            .where(eq(userFollows.followerId, userId))
            .orderBy(desc(userFollows.createdAt))
            .limit(limit)

        return { users: result }
    } catch (error) {
        console.error("Error getting following:", error)
        return { users: [] }
    }
}

// ============================================================================
// FOLLOWED USERS FEED
// ============================================================================

export interface FeedCheckIn {
    id: string
    userId: string
    username: string
    displayName: string
    avatarUrl: string | null
    cafeId: string
    cafeName: string
    cafeSlug: string
    cafeThumbnail: string | null
    visitedAt: string
    companions: { id: string; username: string; displayName: string; avatarUrl: string | null }[]
}

/**
 * Get check-ins from followed users (activity feed)
 */
export async function getFollowedUsersCheckIns(limit: number = 50): Promise<{
    checkIns: FeedCheckIn[]
}> {
    const user = await getCurrentUser()
    if (!user) return { checkIns: [] }

    try {
        // Get IDs of users we're following
        const followingResult = await db
            .select({ followingId: userFollows.followingId })
            .from(userFollows)
            .where(eq(userFollows.followerId, user.id))

        const followingIds = followingResult.map((f) => f.followingId)

        if (followingIds.length === 0) {
            return { checkIns: [] }
        }

        // Get recent check-ins from followed users
        const checkInsResult = await db
            .select({
                id: cafeVisits.id,
                userId: cafeVisits.userId,
                username: profiles.username,
                displayName: profiles.displayName,
                avatarUrl: profiles.avatarUrl,
                cafeId: cafeVisits.cafeId,
                cafeName: cafes.name,
                cafeSlug: cafes.slug,
                cafeThumbnail: cafes.thumbnail,
                visitedAt: cafeVisits.visitedAt,
                companions: cafeVisits.companions,
            })
            .from(cafeVisits)
            .innerJoin(profiles, eq(cafeVisits.userId, profiles.id))
            .innerJoin(cafes, eq(cafeVisits.cafeId, cafes.id))
            .where(inArray(cafeVisits.userId, followingIds))
            .orderBy(desc(cafeVisits.visitedAt))
            .limit(limit)

        // Fetch companion details for each check-in
        const allCompanionIds = new Set<string>()
        for (const checkIn of checkInsResult) {
            if (checkIn.companions) {
                for (const id of checkIn.companions) {
                    allCompanionIds.add(id)
                }
            }
        }

        const companionProfiles: Map<string, { id: string; username: string; displayName: string; avatarUrl: string | null }> = new Map()
        if (allCompanionIds.size > 0) {
            const companions = await db
                .select({
                    id: profiles.id,
                    username: profiles.username,
                    displayName: profiles.displayName,
                    avatarUrl: profiles.avatarUrl,
                })
                .from(profiles)
                .where(inArray(profiles.id, Array.from(allCompanionIds)))

            for (const c of companions) {
                companionProfiles.set(c.id, c)
            }
        }

        const checkIns: FeedCheckIn[] = checkInsResult.map((c) => ({
            id: c.id,
            userId: c.userId,
            username: c.username,
            displayName: c.displayName,
            avatarUrl: c.avatarUrl,
            cafeId: c.cafeId,
            cafeName: c.cafeName,
            cafeSlug: c.cafeSlug,
            cafeThumbnail: c.cafeThumbnail,
            visitedAt: c.visitedAt?.toISOString() ?? new Date().toISOString(),
            companions: (c.companions ?? [])
                .map((id) => companionProfiles.get(id))
                .filter((c): c is NonNullable<typeof c> => c !== undefined),
        }))

        return { checkIns }
    } catch (error) {
        console.error("Error getting followed users check-ins:", error)
        return { checkIns: [] }
    }
}

// ============================================================================
// USER SEARCH (for companion tagging)
// ============================================================================

/**
 * Search users by username or display name (for companion tagging)
 */
export async function searchUsers(
    query: string,
    limit: number = 10
): Promise<{
    users: { id: string; username: string; displayName: string; avatarUrl: string | null }[]
}> {
    const user = await getCurrentUser()
    if (!user) return { users: [] }

    if (!query || query.length < 2) {
        return { users: [] }
    }

    try {
        const searchPattern = `%${query}%`

        const result = await db
            .select({
                id: profiles.id,
                username: profiles.username,
                displayName: profiles.displayName,
                avatarUrl: profiles.avatarUrl,
            })
            .from(profiles)
            .where(
                and(
                    ne(profiles.id, user.id), // Exclude current user
                    or(
                        ilike(profiles.username, searchPattern),
                        ilike(profiles.displayName, searchPattern)
                    )
                )
            )
            .limit(limit)

        return { users: result }
    } catch (error) {
        console.error("Error searching users:", error)
        return { users: [] }
    }
}
