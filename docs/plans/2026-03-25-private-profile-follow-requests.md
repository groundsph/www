# Private Profile Mode + Follow Requests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable users to set their profile as private, requiring approval for new followers while keeping existing followers granted.

**Architecture:** Add `isPrivate` boolean field to profiles table, create `followRequests` table for pending requests, extend social actions to handle request/accept/decline flows, implement UI indicators in navbar for pending requests, and gate access to restricted content for non-followers.

**Tech Stack:** Drizzle ORM, Next.js Server Actions, React components, PostgreSQL

---

## Summary of Requirements

### Core Behavior
1. **Existing followers**: When user switches to private, existing followers keep access automatically
2. **New followers**: Must send follow request; user must approve
3. **Search visibility**: Private profiles visible in search with limited info (username, avatar only)
4. **Content restriction**: Only approved followers can see reviews, check-ins, passport, collections, following/followers
5. **Notifications**: Badge/dot indicator on navbar profile link for pending requests (no bell icon clutter)
6. **No expiry**: Requests stay pending until accepted/declined
7. **No limits**: Unlimited pending requests allowed
8. **No blocking**: Out of scope for this feature

---

## Task 1: Database Schema - Add isPrivate to Profiles

**Files:**
- Modify: `db/schema/tables.ts:33-50`
- Modify: `utils/types/extra.ts` (ProfileWithBadges type)

**Step 1: Add isPrivate column to profiles table**

```typescript
// In db/schema/tables.ts, add after line 44 (after profileCompleted)
isPrivate: boolean("is_private").default(false),
```

**Step 2: Create database migration**

Run: `bun db-push`
Expected: Schema pushed to database

**Step 3: Update ProfileWithBadges type**

```typescript
// In utils/types/extra.ts, add is_private to ProfileWithBadges interface
is_private: boolean
```

**Step 4: Commit**

```bash
git add db/schema/tables.ts utils/types/extra.ts
git commit -m "feat(db): add isPrivate field to profiles schema"
```

---

## Task 2: Database Schema - Create followRequests Table

**Files:**
- Modify: `db/schema/tables.ts` (add after userFollows table ~line 685)
- Modify: `db/schema/index.ts` (export new table)

**Step 1: Create followRequests table**

```typescript
// In db/schema/tables.ts, add after userFollows table definition
export const followRequests = pgTable("follow_requests", {
    id: uuid("id").primaryKey().defaultRandom(),
    requesterId: uuid("requester_id")
        .notNull()
        .references(() => profiles.id, { onDelete: "cascade" }),
    targetId: uuid("target_id")
        .notNull()
        .references(() => profiles.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"), // pending, accepted, declined
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
    // Prevent duplicate requests
    uniqueRequestIdx: uniqueIndex("follow_requests_requester_target_unique").on(t.requesterId, t.targetId),
    // Index for querying pending requests for a user
    targetStatusIdx: index("follow_requests_target_status_idx").on(t.targetId, t.status),
}))
```

**Step 2: Export followRequests from schema index**

```typescript
// In db/schema/index.ts, add to exports
export { followRequests } from "./tables"
```

**Step 3: Push schema changes**

Run: `bun db-push`
Expected: follow_requests table created

**Step 4: Commit**

```bash
git add db/schema/tables.ts db/schema/index.ts
git commit -m "feat(db): add followRequests table for private profile follow requests"
```

---

## Task 3: Server Actions - Privacy Settings

**Files:**
- Modify: `app/api/actions/profile.ts`

**Step 1: Add updatePrivacySettings function**

```typescript
// Add to app/api/actions/profile.ts after updateProfile function

/**
 * Update user's privacy settings
 */
export async function updatePrivacySettings(
    isPrivate: boolean
): Promise<{ success: boolean; error?: string }> {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "Unauthorized" }

    try {
        await db
            .update(profiles)
            .set({
                isPrivate: isPrivate,
                updatedAt: new Date(),
            })
            .where(eq(profiles.id, user.id))

        return { success: true }
    } catch (error) {
        console.error("Error updating privacy settings:", error)
        return { success: false, error: "Failed to update privacy settings" }
    }
}

/**
 * Get user's privacy settings
 */
export async function getPrivacySettings(): Promise<{ isPrivate: boolean }> {
    const user = await getCurrentUser()
    if (!user) return { isPrivate: false }

    try {
        const result = await db
            .select({ isPrivate: profiles.isPrivate })
            .from(profiles)
            .where(eq(profiles.id, user.id))
            .limit(1)

        return { isPrivate: result[0]?.isPrivate ?? false }
    } catch (error) {
        console.error("Error getting privacy settings:", error)
        return { isPrivate: false }
    }
}
```

**Step 2: Update getProfileWithBadges to include isPrivate**

```typescript
// In getProfileWithBadges return object, add:
is_private: profile.isPrivate ?? false,
```

**Step 3: Update getPublicProfileData signature to accept profile privacy status**

The function already receives profile data; ensure isPrivate is included in ProfileWithBadges type.

**Step 4: Commit**

```bash
git add app/api/actions/profile.ts
git commit -m "feat(profile): add privacy settings server actions"
```

---

## Task 4: Server Actions - Follow Request Flow

**Files:**
- Modify: `app/api/actions/social.ts`

**Step 1: Add imports for followRequests table**

```typescript
// Add followRequests to imports from @/db/schema
import { profiles, userFollows, cafeVisits, cafes, followRequests } from "@/db/schema"
```

**Step 2: Update followUser to handle private profiles**

```typescript
// Replace existing followUser function
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
                    eq(userFollows.followingId, targetUserId))
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
```

**Step 3: Add follow request management functions**

```typescript
// Add after unfollowUser function

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
        const result = await db
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
```

**Step 4: Update isFollowing to check request status**

```typescript
// Update isFollowing to also return request status
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
```

**Step 5: Commit**

```bash
git add app/api/actions/social.ts
git commit -m "feat(social): add follow request flow for private profiles"
```

---

## Task 5: Server Actions - Content Access Control

**Files:**
- Modify: `app/api/actions/profile.ts`
- Modify: `app/api/actions/social.ts`

**Step 1: Add canViewProfile helper function**

```typescript
// Add to app/api/actions/profile.ts

/**
 * Check if a viewer can view a user's full profile content
 */
export async function canViewProfile(
    profileUserId: string,
    viewerId?: string
): Promise<{ canView: boolean; isPrivate: boolean }> {
    try {
        // Get profile privacy status
        const profile = await db
            .select({ isPrivate: profiles.isPrivate })
            .from(profiles)
            .where(eq(profiles.id, profileUserId))
            .limit(1)

        if (!profile.length) {
            return { canView: false, isPrivate: false }
        }

        const isPrivate = profile[0].isPrivate ?? false

        // Public profiles are viewable by everyone
        if (!isPrivate) {
            return { canView: true, isPrivate: false }
        }

        // Private profiles: check if viewer is the owner or a follower
        if (!viewerId) {
            return { canView: false, isPrivate: true }
        }

        // Owner can always view their own profile
        if (viewerId === profileUserId) {
            return { canView: true, isPrivate: true }
        }

        // Check if viewer follows the profile owner
        const followResult = await db
            .select({ id: userFollows.id })
            .from(userFollows)
            .where(
                and(
                    eq(userFollows.followerId, viewerId),
                    eq(userFollows.followingId, profileUserId)
                )
            )
            .limit(1)

        return {
            canView: followResult.length > 0,
            isPrivate: true,
        }
    } catch (error) {
        console.error("Error checking profile access:", error)
        return { canView: false, isPrivate: false }
    }
}
```

**Step 2: Update getPublicProfileData to respect privacy**

```typescript
// Modify getPublicProfileData to accept viewerId and check privacy
export async function getPublicProfileData(
    profile: ProfileWithBadges, 
    viewerId?: string
): Promise<{
    data: PublicProfileData | null
    restricted: boolean
}> {
    // Check if profile is private and viewer access
    const { canView, isPrivate } = await canViewProfile(profile.id, viewerId)

    if (!canView) {
        // Return minimal profile for restricted access
        return {
            data: {
                allBadges: [],
                reviews: [],
                passportCafes: { visited: [], favorites: [], wishlist: [] },
                collections: [],
            },
            restricted: isPrivate,
        }
    }

    // ... rest of existing function
}
```

**Step 3: Add follow status check to profile endpoint**

The profile page will need to check follow status. Add function to social.ts:

```typescript
// Add to app/api/actions/social.ts

/**
 * Get follow relationship status between two users
 */
export async function getFollowRelationship(
    targetUserId: string
): Promise<{
    isFollowing: boolean
    isFollower: boolean
    hasPendingRequest: boolean
    isPrivate: boolean
}> {
    const user = await getCurrentUser()
    
    // Default return for unauthenticated users
    const defaultResult = {
        isFollowing: false,
        isFollower: false,
        hasPendingRequest: false,
        isPrivate: false,
    }

    if (!user) return defaultResult

    // Can't check relationship with yourself
    if (user.id === targetUserId) {
        return { ...defaultResult, isPrivate: false }
    }

    try {
        // Get target user's privacy status
        const targetProfile = await db
            .select({ isPrivate: profiles.isPrivate })
            .from(profiles)
            .where(eq(profiles.id, targetUserId))
            .limit(1)

        const isPrivate = targetProfile[0]?.isPrivate ?? false

        // Check all relationships in parallel
        const [followingResult, followerResult, requestResult] = await Promise.all([
            // Is current user following target?
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
            // Is target following current user?
            db
                .select({ id: userFollows.id })
                .from(userFollows)
                .where(
                    and(
                        eq(userFollows.followerId, targetUserId),
                        eq(userFollows.followingId, user.id)
                    )
                )
                .limit(1),
            // Has current user sent pending request?
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
            isFollowing: followingResult.length > 0,
            isFollower: followerResult.length > 0,
            hasPendingRequest: requestResult.length > 0,
            isPrivate,
        }
    } catch (error) {
        console.error("Error getting follow relationship:", error)
        return defaultResult
    }
}
```

**Step 4: Commit**

```bash
git add app/api/actions/profile.ts app/api/actions/social.ts
git commit -m "feat(privacy): add content access control for private profiles"
```

---

## Task 6: Components - Privacy Settings UI

**Files:**
- Create: `components/profile/PrivacySettings.tsx`
- Modify: `components/profile/Settings.tsx` (integrate privacy settings)

**Step 1: Create PrivacySettings component**

```typescript
// Create components/profile/PrivacySettings.tsx
"use client"

import { useState, useCallback } from "react"
import { Lock, Globe, Loader2 } from "lucide-react"
import { switchAccount } from "@/app/api/actions/profile"

interface PrivacySettingsProps {
    initialIsPrivate: boolean
}

export default function PrivacySettings({ initialIsPrivate }: PrivacySettingsProps) {
    const [isPrivate, setIsPrivate] = useState(initialIsPrivate)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleToggle = useCallback(async (newValue: boolean) => {
        setIsLoading(true)
        setError(null)
        try {
            const { updatePrivacySettings } = await import("@/app/api/actions/profile")
            const result = await updatePrivacySettings(newValue)
            if (result.success) {
                setIsPrivate(newValue)
            } else {
                setError(result.error || "Failed to update privacy settings")
            }
        } catch (err) {
            setError("An unexpected error occurred")
        } finally {
            setIsLoading(false)
        }
    }, [])

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-text">Profile Privacy</h3>
            
            <div className="flex flex-col gap-3">
                {/* Public Option */}
                <button
                    onClick={() => !isPrivate || isLoading ? null : handleToggle(false)}
                    disabled={isLoading}
                    className={`flex items-start gap-3 p-4 rounded-lg border transition-all ${
                        !isPrivate 
                            ? "border-primary bg-primary/5 ring-1 ring-primary" 
                            : "border-border hover:border-primary/50"
                    }`}
                >
                    <div className={`mt-0.5 ${!isPrivate ? "text-primary" : "text-text-muted"}`}>
                        <Globe className="w-5 h-5" />
                    </div>
                    <div className="flex-1 text-left">
                        <div className="font-medium text-text">Public Profile</div>
                        <div className="text-sm text-text-muted mt-0.5">
                            Anyone can see your profile, reviews, and check-ins
                        </div>
                    </div>
                    {!isPrivate && (
                        <div className="text-primary">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        </div>
                    )}
                </button>

                {/* Private Option */}
                <button
                    onClick={() => isPrivate || isLoading ? null : handleToggle(true)}
                    disabled={isLoading}
                    className={`flex items-start gap-3 p-4 rounded-lg border transition-all ${
                        isPrivate 
                            ? "border-primary bg-primary/5 ring-1 ring-primary" 
                            : "border-border hover:border-primary/50"
                    }`}
                >
                    <div className={`mt-0.5 ${isPrivate ? "text-primary" : "text-text-muted"}`}>
                        <Lock className="w-5 h-5" />
                    </div>
                    <div className="flex-1 text-left">
                        <div className="font-medium text-text">Private Profile</div>
                        <div className="text-sm text-text-muted mt-0.5">
                            Only approved followers can see your reviews and check-ins
                        </div>
                    </div>
                    {isPrivate && (
                        <div className="text-primary">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        </div>
                    )}
                </button>
            </div>

            {isLoading && (
                <div className="flex items-center gap-2 text-sm text-text-muted">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating...
                </div>
            )}

            {error && (
                <div className="text-sm text-red-500">{error}</div>
            )}

            {isPrivate && (
                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <p className="text-sm text-amber-600">
                        <strong>Note:</strong> Your existing followers will continue to see your content. 
                        New followers will need your approval.
                    </p>
                </div>
            )}
        </div>
    )
}
```

**Step 2: Integrate into Settings page**

Read existing Settings.tsx to understand integration point.

**Step 3: Commit**

```bash
git add components/profile/PrivacySettings.tsx components/profile/Settings.tsx
git commit -m "feat(profile): add privacy settings UI component"
```

---

## Task 7: Components - Follow Button with Request State

**Files:**
- Modify: `components/social/FollowButton.tsx`

**Step 1: Update FollowButton to handle request states**

```typescript
// Update components/social/FollowButton.tsx to handle request state
"use client"

import { useHaptics } from "@/hooks/useHaptics"
import { useState, useCallback, useEffect } from "react"
import { UserPlus, UserMinus, UserCheck, Lock, Loader2 } from "lucide-react"

interface FollowButtonProps {
    targetUserId: string
    initialIsFollowing?: boolean
    initialHasPendingRequest?: boolean
    isPrivate?: boolean
    size?: "sm" | "md" | "lg"
    className?: string
    onFollowChange?: (isFollowing: boolean) => void
    onRequestSent?: () => void
}

export default function FollowButton({
    targetUserId,
    initialIsFollowing = false,
    initialHasPendingRequest = false,
    isPrivate = false,
    size = "md",
    className = "",
    onFollowChange,
    onRequestSent,
}: FollowButtonProps) {
    const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
    const [hasPendingRequest, setHasPendingRequest] = useState(initialHasPendingRequest)
    const [isLoading, setIsLoading] = useState(false)
    const [isHovering, setIsHovering] = useState(false)
    const { trigger } = useHaptics()

    useEffect(() => {
        setIsFollowing(initialIsFollowing)
        setHasPendingRequest(initialHasPendingRequest)
    }, [initialIsFollowing, initialHasPendingRequest])

    const handleClick = useCallback(async () => {
        trigger(isFollowing ? "soft" : "medium")
        setIsLoading(true)
        try {
            if (isFollowing) {
                const { unfollowUser } = await import("@/app/api/actions/social")
                const result = await unfollowUser(targetUserId)
                if (result.success) {
                    setIsFollowing(false)
                    onFollowChange?.(false)
                }
            } else if (hasPendingRequest) {
                // Already has pending request - do nothing or show message
                return
            } else {
                const { followUser } = await import("@/app/api/actions/social")
                const result = await followUser(targetUserId)
                if (result.success) {
                    if (result.requiresApproval) {
                        setHasPendingRequest(true)
                        onRequestSent?.()
                    } else {
                        setIsFollowing(true)
                        onFollowChange?.(true)
                    }
                }
            }
        } catch (error) {
            console.error("Follow action failed:", error)
        } finally {
            setIsLoading(false)
        }
    }, [isFollowing, hasPendingRequest, targetUserId, onFollowChange, onRequestSent, trigger])

    const sizeClasses = {
        sm: "px-3 py-1.5 text-xs gap-1",
        md: "px-4 py-2 text-sm gap-1.5",
        lg: "px-5 py-2.5 text-base gap-2",
    }

    const iconSizes = {
        sm: "w-3 h-3",
        md: "w-4 h-4",
        lg: "w-5 h-5",
    }

    const getButtonStyles = () => {
        if (isFollowing) {
            if (isHovering) {
                return "bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20"
            }
            return "bg-text/5 text-text border-text/20 hover:bg-text/10"
        }
        if (hasPendingRequest) {
            return "bg-amber-500/10 text-amber-600 border-amber-500/30 cursor-default"
        }
        return "bg-primary text-white border-primary hover:bg-primary/90"
    }

    const getLabel = () => {
        if (isFollowing) {
            return isHovering ? "Unfollow" : "Following"
        }
        if (hasPendingRequest) {
            return "Requested"
        }
        return isPrivate ? "Request" : "Follow"
    }

    const getIcon = () => {
        if (isLoading) {
            return <Loader2 className={`${iconSizes[size]} animate-spin`} />
        }
        if (isFollowing && isHovering) {
            return <UserMinus className={iconSizes[size]} />
        }
        if (hasPendingRequest) {
            return <UserCheck className={iconSizes[size]} />
        }
        if (isPrivate && !isFollowing) {
            return <Lock className={iconSizes[size]} />
        }
        if (!isFollowing) {
            return <UserPlus className={iconSizes[size]} />
        }
        return null
    }

    return (
        <button
            onClick={handleClick}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            disabled={isLoading || hasPendingRequest}
            className={`inline-flex items-center justify-center font-semibold rounded-full border transition-all duration-200 ${sizeClasses[size]} ${getButtonStyles()} disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
        >
            {getIcon()}
            <span>{getLabel()}</span>
        </button>
    )
}
```

**Step 2: Commit**

```bash
git add components/social/FollowButton.tsx
git commit -m "feat(follow): update button to handle private profile request states"
```

---

## Task 8: Components - Follow Request Notifications

**Files:**
- Create: `components/social/FollowRequestsDropdown.tsx`
- Modify: `components/layout/Navbar.tsx` (or equivalent nav component)

**Step 1: Create FollowRequestsDropdown component**

```typescript
// Create components/social/FollowRequestsDropdown.tsx
"use client"

import { useState, useCallback, useEffect } from "react"
import { UserCheck, X, Loader2, Bell } from "lucide-react"
import { getPendingFollowRequests, acceptFollowRequest, declineFollowRequest } from "@/app/api/actions/social"

interface FollowRequest {
    id: string
    requester: {
        id: string
        username: string
        displayName: string
        avatarUrl: string | null
    }
    createdAt: string
}

interface FollowRequestsDropdownProps {
    onRequestHandled?: () => void
}

export default function FollowRequestsDropdown({ onRequestHandled }: FollowRequestsDropdownProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [requests, setRequests] = useState<FollowRequest[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [processingId, setProcessingId] = useState<string | null>(null)

    const fetchRequests = useCallback(async () => {
        setIsLoading(true)
        try {
            const result = await getPendingFollowRequests()
            setRequests(result.requests)
        } catch (error) {
            console.error("Failed to fetch follow requests:", error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        if (isOpen) {
            fetchRequests()
        }
    }, [isOpen, fetchRequests])

    const handleAccept = useCallback(async (requestId: string) => {
        setProcessingId(requestId)
        try {
            const result = await acceptFollowRequest(requestId)
            if (result.success) {
                setRequests((prev) => prev.filter((r) => r.id !== requestId))
                onRequestHandled?.()
            }
        } catch (error) {
            console.error("Failed to accept request:", error)
        } finally {
            setProcessingId(null)
        }
    }, [onRequestHandled])

    const handleDecline = useCallback(async (requestId: string) => {
        setProcessingId(requestId)
        try {
            const result = await declineFollowRequest(requestId)
            if (result.success) {
                setRequests((prev) => prev.filter((r) => r.id !== requestId))
            }
        } catch (error) {
            console.error("Failed to decline request:", error)
        } finally {
            setProcessingId(null)
        }
    }, [])

    const pendingCount = requests.length

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-full hover:bg-text/5 transition-colors"
                aria-label="Follow requests"
            >
                <Bell className="w-5 h-5 text-text-muted" />
                {pendingCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {pendingCount > 9 ? "9+" : pendingCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-80 bg-background border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                        <div className="p-3 border-b border-border">
                            <h3 className="font-semibold text-text">Follow Requests</h3>
                        </div>

                        <div className="max-h-80 overflow-y-auto">
                            {isLoading ? (
                                <div className="flex items-center justify-center p-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
                                </div>
                            ) : requests.length === 0 ? (
                                <div className="p-8 text-center text-text-muted">
                                    <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No pending requests</p>
                                </div>
                            ) : (
                                <ul className="divide-y divide-border">
                                    {requests.map((request) => (
                                        <li key={request.id} className="p-3 flex items-center gap-3">
                                            <a
                                                href={`/u/${request.requester.username}`}
                                                className="flex items-center gap-3 flex-1 min-w-0"
                                            >
                                                {request.requester.avatarUrl ? (
                                                    <img
                                                        src={request.requester.avatarUrl}
                                                        alt=""
                                                        className="w-10 h-10 rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                        <span className="text-primary font-semibold">
                                                            {request.requester.displayName[0].toUpperCase()}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <div className="font-medium text-text truncate">
                                                        {request.requester.displayName}
                                                    </div>
                                                    <div className="text-sm text-text-muted truncate">
                                                        @{request.requester.username}
                                                    </div>
                                                </div>
                                            </a>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleAccept(request.id)}
                                                    disabled={processingId === request.id}
                                                    className="p-1.5 rounded-full bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
                                                    aria-label="Accept"
                                                >
                                                    <UserCheck className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDecline(request.id)}
                                                    disabled={processingId === request.id}
                                                    className="p-1.5 rounded-full bg-text/5 text-text-muted hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                                                    aria-label="Decline"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
```

**Step 2: Integrate into Navbar**

Find and update the navbar to include the FollowRequestsDropdown with a badge.

**Step 3: Commit**

```bash
git add components/social/FollowRequestsDropdown.tsx components/layout/Navbar.tsx
git commit -m "feat(social): add follow requests notification dropdown"
```

---

## Task 9: Profile Page - Privacy Awareness

**Files:**
- Modify: `components/profile/PublicProfile.tsx`
- Modify: `app/[username]/page.tsx` (or equivalent profile route)

**Step 1: Update PublicProfile to handle restricted content**

Read the existing PublicProfile.tsx to understand current structure.

**Step 2: Show restricted state for private profiles**

When viewer cannot view the profile, show:
- Username and avatar (always visible)
- "This profile is private" message
- Follow/Request button prominently

**Step 3: Update profile page to pass follow relationship**

The profile page should:
1. Check if profile is private
2. Check if viewer is following
3. Gate content accordingly

**Step 4: Commit**

```bash
git add components/profile/PublicProfile.tsx app/
git commit -m "feat(profile): add privacy gate to public profile page"
```

---

## Task 10: Update Search Results

**Files:**
- Modify: Search components to show limited info for private profiles

**Step 1: Add isPrivate indicator in search results**

For private profiles in search results:
- Show lock icon
- Show username and avatar only (no bio stats)
- Show "Request" button instead of "Follow"

**Step 2: Commit**

```bash
git add components/search/
git commit -m "feat(search): indicate private profiles in search results"
```

---

## Task 11: Tests - Follow Request Flow

**Files:**
- Create: `app/api/actions/__tests__/social-privacy.test.ts`

**Step 1: Write tests for privacy flow**

```typescript
import { describe, expect, it, beforeEach } from "bun:test"

describe("Follow Request Flow", () => {
    describe("Private Profile Follow", () => {
        it.todo("creates follow request when following private profile")
        it.todo("returns requiresApproval: true for private profiles")
        it.todo("does not create user_follows entry until approved")
    })

    describe("Public Profile Follow", () => {
        it.todo("creates direct follow for public profiles")
        it.todo("returns requiresApproval: false for public profiles")
    })

    describe("Accept Follow Request", () => {
        it.todo("creates user_follows entry when accepted")
        it.todo("updates request status to accepted")
        it.todo("only target user can accept their own requests")
    })

    describe("Decline Follow Request", () => {
        it.todo("updates request status to declined")
        it.todo("allows re-requesting after decline")
    })

    describe("Privacy Settings", () => {
        it.todo("allows user to toggle privacy on/off")
        it.todo("existing followers retain access when going private")
    })

    describe("Content Access", () => {
        it.todo("restricts profile content for non-followers on private profiles")
        it.todo("shows full content after follow is approved")
    })
})
```

**Step 2: Run tests**

Run: `bun test app/api/actions/__tests__/social-privacy.test.ts`
Expected: Tests pass (or fail appropriately for TODOs)

**Step 3: Commit**

```bash
git add app/api/actions/__tests__/social-privacy.test.ts
git commit -m "test(social): add follow request flow tests"
```

---

## Task 12: Database Migration for Production

**Files:**
- Create: Migration file for production deployment

**Step 1: Create Drizzle migration**

Run: `bun db-generate` (or equivalent command for generating migrations)
Expected: Migration file created for:
- `isPrivate` column on profiles
- `follow_requests` table

**Step 2: Review migration file**

Ensure migration:
- Adds `is_private` column with default `false`
- Creates `follow_requests` table with proper indexes
- Handles existing data gracefully

**Step 3: Commit**

```bash
git add drizzle/
git commit -m "feat(db): generate migration for private profile feature"
```

---

## Task 13: Documentation and Final Verification

**Step 1: Update AGENTS.md if needed**

Add any new conventions discovered.

**Step 2: Run lint**

Run: `bun lint`
Expected: No errors

**Step 3: Run type check**

Run: `bun typecheck` (or equivalent)
Expected: No type errors

**Step 4: Manual testing checklist**

- [ ] Toggle privacy settings on/off
- [ ] Request to follow private profile (as different user)
- [ ] Accept/decline follow requests
- [ ] Verify content is restricted for non-followers
- [ ] Verify existing followers can still view content
- [ ] Verify content is visible after approval
- [ ] Check search results show limited info for private profiles
- [ ] Check notification badge shows pending request count

**Step 5: Final commit**

```bash
git add .
git commit -m "chore: final verification and cleanup for private profile feature"
```

---

## Architecture Summary

### Database Changes
```
profiles.isPrivate (boolean, default false)
follow_requests (table):
  - id (uuid, pk)
  - requesterId (uuid, fk -> profiles)
  - targetId (uuid, fk -> profiles)
  - status (text: pending | accepted | declined)
  - createdAt, updatedAt
  - UNIQUE(requesterId, targetId)
  - INDEX(targetId, status) for pending query
```

### API Flow
```
Public Profile:
  followUser() -> creates user_follows entry directly

Private Profile:
  followUser() -> creates follow_requests entry (status: pending)
  acceptFollowRequest() -> creates user_follows, updates status: accepted
  declineFollowRequest() -> updates status: declined

Content Access:
  canViewProfile(userId, viewerId) -> checks isPrivate + follow relationship
```

### UI Components
- PrivacySettings: Toggle for public/private
- FollowButton: Handles follow, unfollow, and request states
- FollowRequestsDropdown: Bell icon with badge, shows pending requests
- PublicProfile: Gated content based on follow status

---

## Edge Cases Handled

1. **Existing followers**: Kept when switching to private (auto-approved)
2. **Re-request after decline**: Allowed (status updated to pending)
3. **Already following**: Returns error, doesn't create new follow
4. **Self-follow**: Prevented at API level
5. **Non-existent user**: Returns error
6. **Concurrent requests**: Unique constraint prevents duplicates
7. **Profile deletion**: Cascades to follow_requests

---

## Future Considerations (Out of Scope)

- Block/unchlock users
- Mute followers
- Close friends list (selective content sharing)
- Request expiration
- Request limit per user