"use server"

import { db } from "@/db"
import { profiles, userFollows, cafeVisits, cafes, followRequests } from "@/db/schema"
import { getCurrentUser } from "@/lib/auth"
import { and, eq, desc, inArray, ilike, or, count, ne } from "drizzle-orm"


// ============================================================================
// FOLLOW SYSTEM
// ============================================================================

/**
 * Follow a user (or send request if private)
 */
export async function followUser(targetUserId: string): Promise<{
    success: boolean
    requiresApproval?: boolean
    error?: string
}> {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "Unauthorized" }

    if (user.id === targetUserId) {
        return { success: false, error: "Cannot follow yourself" }
    }

    try {
        // Check if target user exists and get privacy status
        const targetUser = await db
            .select({ id: profiles.id, isPrivate: profiles.isPrivate })
            .from(profiles)
            .where(eq(profiles.id, targetUserId))
            .limit(1)

        if (!targetUser.length) {
            return { success: false, error: "User not found" }
        }

        const isPrivate = targetUser[0].isPrivate ?? false

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

        // Check for existing request
        const existingRequest = await db
            .select({ id: followRequests.id, status: followRequests.status })
            .from(followRequests)
            .where(
                and(
                    eq(followRequests.requesterId, user.id),
                    eq(followRequests.targetId, targetUserId)
                )
            )
            .limit(1)

        if (existingRequest.length > 0) {
            if (existingRequest[0].status === "pending") {
                return { success: false, error: "Follow request already pending" }
            }
            if (existingRequest[0].status === "declined") {
                // Re-send after decline - update status to pending
                await db
                    .update(followRequests)
                    .set({ status: "pending", updatedAt: new Date() })
                    .where(eq(followRequests.id, existingRequest[0].id))
                return { success: true, requiresApproval: true }
            }
        }

        if (isPrivate) {
            // Create follow request
            await db.insert(followRequests).values({
                requesterId: user.id,
                targetId: targetUserId,
                status: "pending",
            })
            return { success: true, requiresApproval: true }
        } else {
            // Direct follow
            await db.insert(userFollows).values({
                followerId: user.id,
                followingId: targetUserId,
            })
            return { success: true, requiresApproval: false }
        }
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
 * Get pending follow requests for current user
 */
export async function getPendingFollowRequests(): Promise<{
    requests: {
        id: string
        requester: { id: string; username: string; displayName: string; avatarUrl: string | null }
        createdAt: string
    }[]
    error?: string
}> {
    const user = await getCurrentUser()
    if (!user) return { requests: [], error: "Unauthorized" }

    try {
        const requests = await db
            .select({
                id: followRequests.id,
                requesterId: followRequests.requesterId,
                createdAt: followRequests.createdAt,
                requesterUsername: profiles.username,
                requesterDisplayName: profiles.displayName,
                requesterAvatarUrl: profiles.avatarUrl,
            })
            .from(followRequests)
            .innerJoin(profiles, eq(followRequests.requesterId, profiles.id))
            .where(
                and(
                    eq(followRequests.targetId, user.id),
                    eq(followRequests.status, "pending")
                )
            )
            .orderBy(desc(followRequests.createdAt))

        return {
            requests: requests.map((r) => ({
                id: r.id,
                requester: {
                    id: r.requesterId,
                    username: r.requesterUsername,
                    displayName: r.requesterDisplayName,
                    avatarUrl: r.requesterAvatarUrl,
                },
                createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
            })),
        }
    } catch (error) {
        console.error("Error getting follow requests:", error)
        return { requests: [], error: "Failed to get follow requests" }
    }
}

/**
 * Get count of pending follow requests
 */
export async function getPendingFollowRequestCount(): Promise<{ count: number }> {
    const user = await getCurrentUser()
    if (!user) return { count: 0 }

    try {
        const result = await db
            .select({ count: count() })
            .from(followRequests)
            .where(
                and(
                    eq(followRequests.targetId, user.id),
                    eq(followRequests.status, "pending")
                )
            )

        return { count: result[0]?.count ?? 0 }
    } catch (error) {
        console.error("Error getting follow request count:", error)
        return { count: 0 }
    }
}

/**
 * Accept a follow request
 */
export async function acceptFollowRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "Unauthorized" }

    try {
        // Get the request
        const request = await db
            .select()
            .from(followRequests)
            .where(
                and(
                    eq(followRequests.id, requestId),
                    eq(followRequests.targetId, user.id),
                    eq(followRequests.status, "pending")
                )
            )
            .limit(1)

        if (!request.length) {
            return { success: false, error: "Request not found" }
        }

        const requesterId = request[0].requesterId

        // Create follow relationship and update request status atomically
        await Promise.all([
            db.insert(userFollows).values({
                followerId: requesterId,
                followingId: user.id,
            }),
            db
                .update(followRequests)
                .set({ status: "accepted", updatedAt: new Date() })
                .where(eq(followRequests.id, requestId)),
        ])

        return { success: true }
    } catch (error) {
        console.error("Error accepting follow request:", error)
        return { success: false, error: "Failed to accept request" }
    }
}

/**
 * Decline a follow request
 */
export async function declineFollowRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "Unauthorized" }

    try {
        await db
            .update(followRequests)
            .set({ status: "declined", updatedAt: new Date() })
            .where(
                and(
                    eq(followRequests.id, requestId),
                    eq(followRequests.targetId, user.id),
                    eq(followRequests.status, "pending")
                )
            )

        return { success: true }
    } catch (error) {
        console.error("Error declining follow request:", error)
        return { success: false, error: "Failed to decline request" }
    }
}

/**
 * Check if current user has a pending follow request to target user
 */
export async function hasPendingFollowRequest(targetUserId: string): Promise<boolean> {
    const user = await getCurrentUser()
    if (!user) return false

    try {
        const result = await db
            .select({ id: followRequests.id })
            .from(followRequests)
            .where(
                and(
                    eq(followRequests.requesterId, user.id),
                    eq(followRequests.targetId, targetUserId),
                    eq(followRequests.status, "pending")
                )
            )
            .limit(1)

        return result.length > 0
    } catch (error) {
        console.error("Error checking follow request status:", error)
        return false
    }
}

/**
 * Check if current user follows a specific user and if there's a pending request
 */
export async function isFollowing(targetUserId: string): Promise<{
    isFollowing: boolean
    hasPendingRequest: boolean
}> {
    const user = await getCurrentUser()
    if (!user) return { isFollowing: false, hasPendingRequest: false }

    try {
        const [followResult, requestResult] = await Promise.all([
            db
                .select({ id: userFollows.id })
                .from(userFollows)
                .where(
                    and(
                        eq(userFollows.followerId, user.id),
                        eq(userFollows.followingId, targetUserId)
                    )
                )
                .limit(1),
            db
                .select({ id: followRequests.id })
                .from(followRequests)
                .where(
                    and(
                        eq(followRequests.requesterId, user.id),
                        eq(followRequests.targetId, targetUserId),
                        eq(followRequests.status, "pending")
                    )
                )
                .limit(1),
        ])

        return {
            isFollowing: followResult.length > 0,
            hasPendingRequest: requestResult.length > 0,
        }
    } catch (error) {
        console.error("Error checking follow status:", error)
        return { isFollowing: false, hasPendingRequest: false }
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
    limit: number = 50,
    offset: number = 0
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
            .offset(offset)

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
    limit: number = 50,
    offset: number = 0
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
            .offset(offset)

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
// GROUPED LANDING FEED (by cafe)
// ============================================================================

export interface GroupedCafeFeed {
    cafeId: string
    cafeName: string
    cafeSlug: string
    cafeThumbnail: string | null
    latestVisitedAt: string
    visitors: { id: string; username: string; displayName: string; avatarUrl: string | null }[]
    visitorCount: number
}

/**
 * Group check-ins by cafe for the landing feed
 */
export async function groupCheckInsByCafe(checkIns: FeedCheckIn[]): Promise<GroupedCafeFeed[]> {
    const cafeMap = new Map<string, GroupedCafeFeed>()

    for (const checkIn of checkIns) {
        const existing = cafeMap.get(checkIn.cafeId)

        if (!existing) {
            cafeMap.set(checkIn.cafeId, {
                cafeId: checkIn.cafeId,
                cafeName: checkIn.cafeName,
                cafeSlug: checkIn.cafeSlug,
                cafeThumbnail: checkIn.cafeThumbnail,
                latestVisitedAt: checkIn.visitedAt,
                visitors: [{
                    id: checkIn.userId,
                    username: checkIn.username,
                    displayName: checkIn.displayName,
                    avatarUrl: checkIn.avatarUrl,
                }],
                visitorCount: 1,
            })
        } else {
            // Update latest visited at if this check-in is more recent
            if (new Date(checkIn.visitedAt) > new Date(existing.latestVisitedAt)) {
                existing.latestVisitedAt = checkIn.visitedAt
            }

            // Add visitor if not already in the list
            const visitorExists = existing.visitors.some(v => v.id === checkIn.userId)
            if (!visitorExists) {
                existing.visitors.push({
                    id: checkIn.userId,
                    username: checkIn.username,
                    displayName: checkIn.displayName,
                    avatarUrl: checkIn.avatarUrl,
                })
                existing.visitorCount = existing.visitors.length
            }
        }
    }

    // Convert to array and sort by latestVisitedAt descending
    const grouped = Array.from(cafeMap.values())
    grouped.sort((a, b) => new Date(b.latestVisitedAt).getTime() - new Date(a.latestVisitedAt).getTime())

    return grouped
}

/**
 * Get landing feed grouped by cafe
 */
export async function getLandingFeedGroupedByCafe(limit: number = 10): Promise<{
    groupedCheckIns: GroupedCafeFeed[]
}> {
    const user = await getCurrentUser()
    if (!user) return { groupedCheckIns: [] }

    try {
        // Get IDs of users we're following
        const followingResult = await db
            .select({ followingId: userFollows.followingId })
            .from(userFollows)
            .where(eq(userFollows.followerId, user.id))

        const followingIds = followingResult.map((f) => f.followingId)

        if (followingIds.length === 0) {
            return { groupedCheckIns: [] }
        }

        // Get recent check-ins from followed users (fetch more to allow for grouping)
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
            .limit(50) // Fetch more to allow for grouping

        // Convert to FeedCheckIn format
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
            companions: [], // Companions not needed for landing feed
        }))

        // Group by cafe
        const grouped = await groupCheckInsByCafe(checkIns)

        // Return top N cafes
        return { groupedCheckIns: grouped.slice(0, limit) }
    } catch (error) {
        console.error("Error getting landing feed grouped by cafe:", error)
        return { groupedCheckIns: [] }
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
    error?: string
}> {
    try {
        const user = await getCurrentUser()

        if (!user) {
            return { users: [], error: "Authentication required" }
        }

        if (!query || query.length < 2) {
            return { users: [] }
        }

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
        return { users: [], error: `Error searching users: ${error}` }
    }
}
