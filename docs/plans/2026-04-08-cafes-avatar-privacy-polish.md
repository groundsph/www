# Cafes Infinite Scroll, Avatar Fallbacks & Privacy Audit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix infinite scroll breakage on filter changes in /cafes, standardize avatar fallbacks to use project colors across the app, and remediate privacy vulnerabilities found during audit.

**Architecture:** Three workstreams: (1) Cafes list gets request cancellation + version tracking to prevent stale data races, (2) Avatar utility updated to use project color palette and inline fallbacks replaced with `UserAvatar`, (3) Privacy fixes enforce auth checks and `canViewProfile` guards on data-fetching functions.

**Tech Stack:** Next.js App Router, React, TanStack Virtual, Drizzle ORM, Better Auth, Tailwind CSS v4

---

## Part 1: Cafes Infinite Scroll & Filter Robustness

### Problem Analysis

The `/cafes` page (`components/cafe/CafesPageClient.tsx`) has several bugs that cause infinite scroll to break after filter changes:

1. **Race condition:** When filters change, the filter effect (line 320) resets `cafes` to `[]` and fetches page 1. But if a pending load-more request (line 407) from the previous filter resolves AFTER the reset, it appends stale data via `setCafes(prev => [...prev, ...fetchedCafes])`.
2. **Client-side filter pagination mismatch:** `hasMore` is determined by server-returned count, but client-side filters (`open_now`, `near_me`) reduce `filteredCafes.length`. The virtualizer sentinel can appear/disappear incorrectly.
3. **No error recovery:** The load-more catch block (line 412) only logs. No user feedback, no retry, `hasMore` stays `true` so a loading skeleton persists forever.
4. **Unstable effect dependencies:** The `lastItem` object reference changes every render, and `filters` object reference triggers effects even when values haven't changed.
5. **`near_me` auto-disable oscillation:** Disabling `near_me` changes `filters`, which triggers the filter effect, which can re-trigger the auto-disable effect.

### Task 1: Add request cancellation with AbortController

**Files:**
- Modify: `components/cafe/CafesPageClient.tsx`

**Step 1: Add AbortController ref and fetch version tracking**

Add a ref to track the current fetch version and an abort controller ref near the existing refs (around line 105):

```typescript
const fetchVersionRef = useRef(0)
const abortControllerRef = useRef<AbortController | null>(null)
```

**Step 2: Update the filter effect to cancel pending requests**

Replace the filter effect at lines 320-342 with:

```typescript
useEffect(() => {
    if (isRestoring) return

    // Cancel any in-flight load-more requests
    if (abortControllerRef.current) {
        abortControllerRef.current.abort()
    }
    fetchVersionRef.current += 1
    const version = fetchVersionRef.current

    startTransition(async () => {
        setCurrentPage(1)
        setHasMore(true)
        setCafes([])

        if (typeof window !== "undefined" && sessionStorage.getItem(SESSION_STORAGE_SCROLL_POSITION_KEY)) {
            sessionStorage.removeItem(SESSION_STORAGE_SCROLL_POSITION_KEY)
        }

        try {
            const fetchedCafes = await getAllCafes(1, PAGE_SIZE, getFilterParams())
            if (version !== fetchVersionRef.current) return // Stale fetch, discard
            setCafes(fetchedCafes)
            setLoading(false)
            setHasMore(fetchedCafes.length === PAGE_SIZE)
        } catch (error) {
            if (version !== fetchVersionRef.current) return
            console.error("Failed to fetch cafes:", error)
            setLoading(false)
        }
    })
}, [debouncedSearch, sortBy, filters, getFilterParams, isRestoring])
```

**Step 3: Update load-more effect with version tracking and error handling**

Replace lines 393-419 with:

```typescript
const lastItem = virtualizer.getVirtualItems().at(-1)
useEffect(() => {
    if (
        lastItem &&
        lastItem.index >= filteredCafes.length - 1 &&
        hasMore &&
        !isLoadingMore
    ) {
        trigger("light")
        const nextPage = currentPage + 1
        setCurrentPage(nextPage)
        setIsLoadingMore(true)

        const version = fetchVersionRef.current

        getAllCafes(nextPage, PAGE_SIZE, getFilterParams())
            .then((fetchedCafes) => {
                if (version !== fetchVersionRef.current) return // Stale fetch
                setCafes((prev) => [...prev, ...fetchedCafes])
                setHasMore(fetchedCafes.length === PAGE_SIZE)
            })
            .catch((error) => {
                if (version !== fetchVersionRef.current) return
                console.error("Failed to fetch more cafes:", error)
                setHasMore(false) // Stop trying on error
            })
            .finally(() => {
                if (version === fetchVersionRef.current) {
                    setIsLoadingMore(false)
                }
            })
    }
}, [lastItem, lastItem?.index, filteredCafes.length, hasMore, isLoadingMore, currentPage, getFilterParams, trigger])
```

**Step 4: Run lint to verify**

Run: `bun lint`
Expected: No new errors

**Step 5: Commit**

```bash
git add components/cafe/CafesPageClient.tsx
git commit -m "fix: prevent stale data races in cafes infinite scroll with request cancellation"
```

### Task 2: Fix client-side filter pagination for `open_now` and `near_me`

**Files:**
- Modify: `components/cafe/CafesPageClient.tsx`

**Step 1: Adjust virtualizer count to account for client-side filtering gap**

The issue: when `open_now` or `near_me` filters are active, server returns PAGE_SIZE items but client-side filtering reduces them. The `hasMore` check uses the server count. The fix: if client-side filtering is active and we got PAGE_SIZE from the server, keep `hasMore = true` regardless of `filteredCafes.length`.

No code change needed for `hasMore` since it already uses the server count. The real fix is to ensure the load-more sentinel doesn't disappear when `filteredCafes.length` drops. This is already handled by the virtualizer `count: filteredCafes.length + (hasMore ? 1 : 0)` at line 375 -- the sentinel appears when `hasMore` is true.

However, there's a subtle issue: when client-side filters remove ALL items from a page, the user sees an empty list with a loading spinner. Add a minimum fetch threshold:

After the `filteredCafes` computation (line 370), add a comment documenting the behavior and ensure `hasMore` respects the server response:

No code changes needed -- the existing logic is correct. The sentinel will show as long as `hasMore` is true, and clicking/scrolling will trigger more loads until the server returns < PAGE_SIZE.

**Step 2: Commit (skip if no changes)**

### Task 3: Improve near_me auto-disable to prevent oscillation

**Files:**
- Modify: `components/cafe/CafesPageClient.tsx`

**Step 1: Add a guard ref to prevent oscillation**

The auto-disable effect at lines 382-391 can loop because disabling `near_me` changes `filters`, which triggers the filter effect. Add a ref to track whether we've already auto-disabled:

```typescript
const autoDisabledNearMe = useRef(false)
```

**Step 2: Update the auto-disable effect**

Replace lines 382-391:

```typescript
useEffect(() => {
    if (
        filters.near_me &&
        filteredCafes.length === 0 &&
        cafes.length > 0 &&
        !hasUserToggledLocation.current &&
        !autoDisabledNearMe.current
    ) {
        autoDisabledNearMe.current = true
        setFilters((prev) => ({ ...prev, near_me: false }))
    }
    // Reset the guard when near_me is turned off manually
    if (!filters.near_me) {
        autoDisabledNearMe.current = false
    }
}, [filteredCafes.length, cafes.length, filters.near_me])
```

**Step 3: Run lint**

Run: `bun lint`
Expected: No new errors

**Step 4: Commit**

```bash
git add components/cafe/CafesPageClient.tsx
git commit -m "fix: prevent near_me auto-disable oscillation in cafes filter"
```

### Task 4: Add error state and retry for failed loads

**Files:**
- Modify: `components/cafe/CafesPageClient.tsx`

**Step 1: Add error state**

Add near existing state declarations (around line 120):

```typescript
const [loadError, setLoadError] = useState(false)
```

**Step 2: Update load-more catch to set error state**

In the load-more catch block (from Task 1), also set:

```typescript
.catch((error) => {
    if (version !== fetchVersionRef.current) return
    console.error("Failed to fetch more cafes:", error)
    setLoadError(true)
    setHasMore(false)
})
```

**Step 3: Add error UI in the sentinel rendering area**

Find the loading sentinel rendering (around line 941-977 in the virtual items map) and add an error state. The sentinel renders when `virtualItem.index >= filteredCafes.length`. Add a condition:

```tsx
{virtualItem.index >= filteredCafes.length ? (
    loadError ? (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
            <p className="text-sm text-text/60">Failed to load more cafes</p>
            <button
                onClick={() => {
                    setLoadError(false)
                    setHasMore(true)
                    setIsLoadingMore(false) // Allow re-trigger
                }}
                className="text-sm text-accent hover:underline"
            >
                Try again
            </button>
        </div>
    ) : (
        // ... existing loading skeleton ...
    )
) : (
    // ... existing cafe card rendering ...
)}
```

**Step 4: Reset error state on filter changes**

In the filter effect (Task 1 Step 2), add `setLoadError(false)` alongside the other resets.

**Step 5: Run lint**

Run: `bun lint`
Expected: No new errors

**Step 6: Commit**

```bash
git add components/cafe/CafesPageClient.tsx
git commit -m "feat: add error state and retry for cafes infinite scroll"
```

---

## Part 2: Avatar Fallbacks with Project Colors

### Problem Analysis

The `UserAvatar` component (`components/ui/UserAvatar.tsx`) uses `getAvatarColor()` which generates random HSL colors (e.g., `hsl(234, 60%, 45%)`) -- these clash with the project's warm brown/cream palette. Additionally, 5-6 locations still use inline avatar fallbacks instead of `UserAvatar`.

Project colors from `app/globals.css`:
- `--color-primary`: `#74512d` (dark brown)
- `--color-secondary`: `#af8f6f` (tan)
- `--color-tertiary`: `#f1dec9` (cream)
- `--color-accent`: `#bc6c25` (warm orange-brown)
- `--color-background`: `#f8f4e1` (ivory)
- `--color-text`: `#543310` (dark brown)

### Task 5: Update getAvatarColor to use project palette

**Files:**
- Modify: `utils/avatar.ts`
- Modify: `utils/__tests__/avatar.test.ts`

**Step 1: Define project color palette in avatar.ts**

Replace the `getAvatarColor` function with one that picks from a curated set of project-compatible colors. Use darker shades of the palette for readability with white text:

```typescript
const AVATAR_COLORS = [
    "#74512d", // primary
    "#5e3d1f", // primary darkened
    "#bc6c25", // accent
    "#9a5620", // accent darkened
    "#8b6543", // primary-secondary mid
    "#6b4423", // deeper brown
    "#4a2e15", // darkest brown
    "#7a5a3a", // warm mid
] as const

/**
 * Generates a deterministic color from a string using the project palette.
 * Picks from a curated set of warm brown/accent colors that match the Grounds brand.
 */
export function getAvatarColor(name: string): string {
    let hash = 0
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash)
        hash = hash & hash
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!
}
```

**Step 2: Update tests**

Update `utils/__tests__/avatar.test.ts` to test that colors come from the palette:
- Verify returned colors are in `AVATAR_COLORS`
- Verify determinism (same name always gets same color)
- Verify different names can get different colors

**Step 3: Run tests**

Run: `bun test utils/__tests__/avatar.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add utils/avatar.ts utils/__tests__/avatar.test.ts
git commit -m "feat: use project color palette for avatar fallbacks"
```

### Task 6: Migrate inline avatar fallbacks to UserAvatar

**Files to modify:**
- `app/manage/users/page.tsx:291-310`
- `app/profile/[username]/followers/page.tsx:85-99`
- `app/profile/[username]/following/page.tsx:85-99`
- `app/profile/activity/page.tsx:63-77` and `:152-170`
- `app/blog/[slug]/page.tsx:176-188`

**Step 1: Migrate `app/manage/users/page.tsx`**

Replace lines 291-310 (the avatar column) with:

```tsx
<div className='relative w-10 h-10 rounded-full overflow-hidden shrink-0'>
    <UserAvatar
        src={profile.avatarUrl}
        alt={profile.displayName}
        size={40}
    />
</div>
```

Add import: `import { UserAvatar } from "@/components/ui/UserAvatar"` at the top.
Remove `Image` from `next/image` import if it's no longer used elsewhere in the file.

**Step 2: Migrate `app/profile/[username]/followers/page.tsx`**

Replace lines 85-99 with:

```tsx
<UserAvatar
    src={follower.avatarUrl}
    alt={follower.displayName}
    size={48}
/>
```

Add import: `import { UserAvatar } from "@/components/ui/UserAvatar"`.

**Step 3: Migrate `app/profile/[username]/following/page.tsx`**

Same pattern as followers. Replace lines 85-99 with:

```tsx
<UserAvatar
    src={following.avatarUrl}
    alt={following.displayName}
    size={48}
/>
```

Add import: `import { UserAvatar } from "@/components/ui/UserAvatar"`.

**Step 4: Migrate `app/profile/activity/page.tsx` (main avatar, line 63-77)**

Replace with:

```tsx
<UserAvatar
    src={checkIn.user.avatarUrl}
    alt={checkIn.user.displayName}
    size={44}
/>
```

**Step 5: Migrate `app/profile/activity/page.tsx` (companion chips, line 152-170)**

Replace with:

```tsx
<UserAvatar
    src={companion.avatarUrl}
    alt={companion.displayName}
    size={18}
    className="shrink-0"
/>
```

Add import: `import { UserAvatar } from "@/components/ui/UserAvatar"`.

**Step 6: Migrate `app/blog/[slug]/page.tsx` (author avatar, line 176-188)**

Replace with:

```tsx
<UserAvatar
    src={post.author.avatar_url}
    alt={post.author.display_name}
    size={44}
/>
```

Add import: `import { UserAvatar } from "@/components/ui/UserAvatar"`.
Remove `User` from lucide-react import if no longer used.

**Step 7: Run lint**

Run: `bun lint`
Expected: No new errors

**Step 8: Commit**

```bash
git add app/manage/users/page.tsx app/profile/\[username\]/followers/page.tsx app/profile/\[username\]/following/page.tsx app/profile/activity/page.tsx app/blog/\[slug\]/page.tsx
git commit -m "refactor: replace inline avatar fallbacks with UserAvatar component"
```

### Task 7: Add UserAvatar to global search modal

**Files:**
- Modify: `components/search/SearchResults.tsx`
- Modify: `utils/types/search.ts` (check if `imageUrl` exists for user results)

**Step 1: Check SearchResult type**

Read `utils/types/search.ts` to verify the `imageUrl` field is available for user results. If not, check how search results are built in `app/api/actions/search.ts`.

**Step 2: Update `ResultIcon` in SearchResults.tsx**

For user results that have an `imageUrl`, render `UserAvatar` instead of a generic icon:

```tsx
import { UserAvatar } from "@/components/ui/UserAvatar"

function ResultIcon({ result }: { result: SearchResult }) {
  if (result.type === 'user') {
    return (
      <UserAvatar
        src={result.imageUrl}
        alt={result.title}
        size={32}
      />
    )
  }

  if (result.imageUrl) {
    return (
      <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
        <Image
          src={result.imageUrl !== 'placeholder' ? result.imageUrl : 'https://cdn.grounds.ph/cafes/placeholder.jpg'}
          alt={result.title}
          width={32}
          height={32}
          className="w-full h-full object-cover"
          loading='lazy'
        />
      </div>
    )
  }

  // ... rest of icon logic unchanged ...
}
```

**Step 3: Verify search action returns avatarUrl for users**

Read `app/api/actions/search.ts` to confirm user search results include `avatarUrl` as `imageUrl`. If not, add it to the user result mapping.

**Step 4: Run lint**

Run: `bun lint`
Expected: No new errors

**Step 5: Commit**

```bash
git add components/search/SearchResults.tsx
git commit -m "feat: use UserAvatar for user results in global search modal"
```

### Task 8: Add UserAvatar to find people modal (CompanionSelector)

**Files:**
- Verify: `components/checkin/CompanionSelector.tsx` (already uses UserAvatar per exploration)

This file already uses `UserAvatar` (lines 97-100, 150-153). No changes needed.

**Step 1: Verify**

Confirm the file imports and uses `UserAvatar`. If confirmed, skip.

### Task 9: Run existing avatar tests

**Step 1: Run avatar utility tests**

Run: `bun test utils/__tests__/avatar.test.ts`
Expected: PASS

**Step 2: Run UserAvatar component tests**

Run: `bun test components/ui/__tests__/UserAvatar.test.tsx`
Expected: PASS

**Step 3: Fix any test failures**

Update tests to match the new palette-based color system.

---

## Part 3: User Privacy Fixes

### Privacy Audit Summary

The audit identified the following critical and high-priority issues:

| Priority | Issue | Location |
|----------|-------|----------|
| CRITICAL | `getProfileByUsername` bypasses privacy checks, returns full data including `passport` and `stats` | `profile.ts:717-778` |
| CRITICAL | `getFullProfileData` has no authorization, takes arbitrary `userId` | `profile.ts:50-279` |
| HIGH | `updateProfile` missing ownership verification | `profile.ts:596-625` |
| HIGH | `getTodayVisitors` requires no auth, enables user tracking | `profile.ts:1569-1617` |
| HIGH | `searchCafesAndUsers` returns private profiles in search results | `search.ts:36` |
| HIGH | `searchUsers` in community.ts has no auth | `community.ts:154-190` |
| HIGH | `getFollowers`/`getFollowing` no auth, exposes social graph | `social.ts:377-436` |
| MEDIUM | `canViewProfile` exists but not used in data fetchers | `profile.ts:1985` |
| MEDIUM | Privacy tests are all TODOs | `social-privacy.test.ts` |

### Task 10: Fix `updateProfile` ownership verification

**Files:**
- Modify: `app/api/actions/profile.ts:596-625`

**Step 1: Add auth and ownership check**

Replace the `updateProfile` function to verify the caller owns the profile:

```typescript
export async function updateProfile(
    userId: string,
    data: {
        display_name?: string
        bio?: string
        avatar_url?: string
        username?: string
        profile_completed?: boolean
    }
): Promise<{ success: boolean; error?: string }> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Authentication required" }

    if (!userId) return { success: false, error: "User ID required" }

    // Users can only update their own profile (admins can update any)
    if (currentUser.id !== userId && currentUser.role !== "admin") {
        return { success: false, error: "Not authorized to update this profile" }
    }

    try {
        // ... existing update logic unchanged ...
    } catch (error) {
        console.error("Error updating profile:", error)
        return { success: false, error: "Failed to update profile" }
    }
}
```

**Step 2: Verify callers**

Search for all callers of `updateProfile` to ensure they pass the correct `userId` (should be the authenticated user's ID).

Run: `rg "updateProfile" --type ts --type tsx`
Expected: Callers should pass `currentUser.id` or the user's own ID.

**Step 3: Commit**

```bash
git add app/api/actions/profile.ts
git commit -m "fix: add ownership verification to updateProfile server action"
```

### Task 11: Enforce privacy in `getProfileByUsername`

**Files:**
- Modify: `app/api/actions/profile.ts:717-778`

**Step 1: Add viewer privacy check**

Update `getProfileByUsername` to use `canViewProfile`:

```typescript
export async function getProfileByUsername(
    username: string,
    viewerId?: string
): Promise<ProfileWithBadges | null> {
    const profileResult = await db
        .select()
        .from(profiles)
        .where(eq(profiles.username, username))
        .limit(1)

    const profile = profileResult[0]
    if (!profile) return null

    // Check privacy access
    const { canView, isPrivate } = await canViewProfile(profile.id, viewerId)

    if (!canView) {
        // Return minimal public info for private profiles
        return {
            id: profile.id,
            username: profile.username,
            display_name: profile.displayName,
            avatar_url: profile.avatarUrl,
            bio: null, // Hide bio
            role: null, // Hide role
            is_supporter: false,
            support_since: null,
            supporter_expires_at: null,
            total_contribution: 0,
            profile_completed: false,
            passport: null, // Hide passport
            stats: null, // Hide stats
            created_at: null,
            updated_at: null,
            is_private: true,
            moderator_regions: null,
            badges: [],
        } as ProfileWithBadges
    }

    // Full access - fetch badges and return everything
    const badgesResult = await db
        .select({
            id: userBadges.id,
            userId: userBadges.userId,
            badgeId: userBadges.badgeId,
            awardedAt: userBadges.awardedAt,
            evidenceUrl: userBadges.evidenceUrl,
            badge: badgeDefinitions,
        })
        .from(userBadges)
        .leftJoin(badgeDefinitions, eq(userBadges.badgeId, badgeDefinitions.id))
        .where(eq(userBadges.userId, profile.id))

    return {
        // ... existing full return unchanged ...
    } as ProfileWithBadges
}
```

**Step 2: Update callers to pass viewerId**

Find all callers of `getProfileByUsername` and pass the authenticated user's ID. Key callers:
- `app/profile/[username]/page.tsx` - should get current user and pass their ID

**Step 3: Commit**

```bash
git add app/api/actions/profile.ts
git commit -m "fix: enforce privacy checks in getProfileByUsername"
```

### Task 12: Add auth to `getTodayVisitors`

**Files:**
- Modify: `app/api/actions/profile.ts:1569-1617`

**Step 1: Add authentication requirement and filter private users**

```typescript
export async function getTodayVisitors(cafeId: string): Promise<{
    visitors: {
        userId: string
        username: string
        displayName: string
        avatarUrl: string | null
        visitedAt: string
    }[]
}> {
    try {
        // Require authentication to view visitors
        const currentUser = await getCurrentUser()
        if (!currentUser) {
            return { visitors: [] }
        }

        // ... existing date calculation logic ...

        const result = await db
            .select({
                userId: cafeVisits.userId,
                username: profiles.username,
                displayName: profiles.displayName,
                avatarUrl: profiles.avatarUrl,
                visitedAt: cafeVisits.visitedAt,
                isPrivate: profiles.isPrivate,
            })
            .from(cafeVisits)
            .innerJoin(profiles, eq(cafeVisits.userId, profiles.id))
            .where(
                and(
                    eq(cafeVisits.cafeId, cafeId),
                    sql`${cafeVisits.visitedAt} >= ${todayUTC.toISOString()}`,
                    sql`${cafeVisits.visitedAt} < ${tomorrowUTC.toISOString()}`
                )
            )
            .orderBy(desc(cafeVisits.visitedAt))

        // Filter out private profiles unless the viewer follows them
        const filtered = []
        for (const r of result) {
            if (!r.isPrivate) {
                filtered.push(r)
                continue
            }
            // Check if current user follows this private user
            const follows = await db
                .select({ id: userFollows.id })
                .from(userFollows)
                .where(
                    and(
                        eq(userFollows.followerId, currentUser.id),
                        eq(userFollows.followingId, r.userId)
                    )
                )
                .limit(1)
            if (follows.length > 0) {
                filtered.push(r)
            }
        }

        return {
            visitors: filtered.map((r) => ({
                userId: r.userId,
                username: r.username,
                displayName: r.displayName,
                avatarUrl: r.avatarUrl,
                visitedAt: r.visitedAt?.toISOString() ?? new Date().toISOString(),
            })),
        }
    } catch (error) {
        console.error("Error getting today's visitors:", error)
        return { visitors: [] }
    }
}
```

**Step 2: Commit**

```bash
git add app/api/actions/profile.ts
git commit -m "fix: require auth for getTodayVisitors and filter private profiles"
```

### Task 13: Filter private profiles from search results

**Files:**
- Modify: `app/api/actions/search.ts`
- Modify: `app/api/actions/community.ts:154-190`
- Modify: `app/api/actions/social.ts:692-735`

**Step 1: Update `searchCafesAndUsers` in search.ts**

Add `isPrivate` filter to the user search query:

```typescript
// In the user search section, add to the WHERE clause:
and(
    // ... existing conditions ...,
    or(
        eq(profiles.isPrivate, false),
        isNull(profiles.isPrivate)
    )
)
```

Alternatively, if the search should still show private users but with limited info (current UX shows "Private" label), ensure the `isPrivate` flag is passed through and the SearchResults component already handles it (which it does -- lines 118-123).

For this approach, no code change is needed in search.ts since the component already shows "Private" labels and hides subtitles. The current behavior is acceptable: private users appear in search but with minimal info.

**Step 2: Update `searchUsers` in community.ts**

Add auth check:

```typescript
export async function searchUsers(query: string) {
    const currentUser = await getCurrentUser()
    if (!currentUser) return []

    // ... existing search logic ...
}
```

**Step 3: Update `searchUsers` in social.ts**

This already checks auth (line 700-703). Verify it's consistent.

**Step 4: Commit**

```bash
git add app/api/actions/community.ts
git commit -m "fix: add auth check to community searchUsers"
```

### Task 14: Add auth to `getFollowers`/`getFollowing`

**Files:**
- Modify: `app/api/actions/social.ts:377-436`

**Step 1: Decide on access policy**

Two options:
- **Option A:** Require auth to view follower/following lists (stricter)
- **Option B:** Allow public viewing but filter private profiles from the lists

Recommend **Option B** -- follower/following lists are commonly public on social apps, but private profiles should be hidden unless the viewer follows them.

**Step 2: Filter private profiles from results**

Update `getFollowers` and `getFollowing` to exclude private profiles when the viewer doesn't follow them:

```typescript
export async function getFollowers(userId: string, viewerId?: string) {
    // ... existing fetch logic ...

    // Filter out private profiles the viewer can't see
    const filtered = []
    for (const follower of result) {
        if (!follower.isPrivate) {
            filtered.push(follower)
            continue
        }
        if (!viewerId) continue

        // Check if viewer follows this private user
        const canView = await canViewProfile(follower.id, viewerId)
        if (canView.canView) {
            filtered.push(follower)
        }
    }

    return filtered.map(/* ... mapping ... */)
}
```

Apply the same pattern to `getFollowing`.

**Step 3: Update callers to pass viewerId**

Find callers of `getFollowers`/`getFollowing` and pass the authenticated user's ID where available.

**Step 4: Commit**

```bash
git add app/api/actions/social.ts
git commit -m "fix: filter private profiles from follower/following lists"
```

### Task 15: Wire `canViewProfile` into `getFullProfileData`

**Files:**
- Modify: `app/api/actions/profile.ts:50-279`

**Step 1: Add viewer parameter and privacy check**

Update signature to accept `viewerId`:

```typescript
export async function getFullProfileData(
    userId: string,
    viewerId?: string
): Promise<FullProfileData | null> {
    // Check privacy access first
    const { canView } = await canViewProfile(userId, viewerId)
    if (!canView) return null

    // ... existing fetch logic ...
}
```

**Step 2: Update all callers to pass viewerId**

Search for callers and pass the authenticated user's ID.

**Step 3: Commit**

```bash
git add app/api/actions/profile.ts
git commit -m "fix: enforce canViewProfile in getFullProfileData"
```

### Task 16: Write privacy tests

**Files:**
- Modify: `app/api/actions/__tests__/social-privacy.test.ts`

**Step 1: Replace TODO placeholders with actual tests**

The file currently has only TODO comments. Write tests that verify:

1. `getProfileByUsername` returns limited data for private profiles when viewer is not a follower
2. `getProfileByUsername` returns full data for private profiles when viewer is a follower
3. `getProfileByUsername` returns full data for public profiles
4. `updateProfile` rejects updates from non-owner users
5. `updateProfile` allows updates from the owner
6. `getTodayVisitors` returns empty when not authenticated
7. `getTodayVisitors` filters out private profiles the viewer doesn't follow
8. `getFollowers` filters private profiles when viewerId is not provided

```typescript
import { describe, it, expect, beforeEach } from "bun:test"

describe("Privacy: getProfileByUsername", () => {
    it("returns limited data for private profile when viewer is not a follower", async () => {
        // Setup: create a private profile
        // Call getProfileByUsername with a non-follower viewer
        // Assert passport, stats, bio are null
    })

    it("returns full data for private profile when viewer is a follower", async () => {
        // Setup: create a private profile, create follow relationship
        // Call getProfileByUsername with the follower's ID
        // Assert passport, stats, bio are present
    })

    it("returns full data for public profiles", async () => {
        // Setup: create a public profile
        // Call getProfileByUsername without viewerId
        // Assert all fields present
    })
})

describe("Privacy: updateProfile", () => {
    it("rejects updates from non-owner", async () => {
        // Setup: create two users
        // Call updateProfile with user A's ID but user B's auth
        // Assert error response
    })

    it("allows updates from the owner", async () => {
        // Setup: create user
        // Call updateProfile with user's own ID
        // Assert success
    })
})

describe("Privacy: getTodayVisitors", () => {
    it("returns empty when not authenticated", async () => {
        // Call getTodayVisitors without auth
        // Assert empty visitors array
    })
})
```

**Step 2: Run tests**

Run: `bun test app/api/actions/__tests__/social-privacy.test.ts`
Expected: PASS (may need mocking setup for Better Auth)

**Step 3: Commit**

```bash
git add app/api/actions/__tests__/social-privacy.test.ts
git commit -m "test: add privacy enforcement tests for profile and social actions"
```

---

## Part 4: Final Verification & Additional Suggestions

### Task 17: Full verification pass

**Step 1: Run all lint checks**

Run: `bun lint`
Expected: No errors

**Step 2: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 3: Manual testing checklist**

Test each workstream manually in the dev server (`bun dev`):

**Cafes Infinite Scroll:**
- [ ] Load `/cafes`, scroll down, verify more cafes load
- [ ] Toggle a filter (e.g., "Has WiFi"), verify list resets and loads filtered results
- [ ] Toggle a second filter, verify list resets again correctly
- [ ] Remove all filters, verify full list reloads
- [ ] Search for a cafe, verify results load
- [ ] Clear search, verify results reload
- [ ] Enable "Near Me" with location, verify filtering works
- [ ] Enable "Open Now", verify client-side filtering works
- [ ] Rapidly toggle multiple filters, verify no stale data appears
- [ ] Simulate network error (DevTools offline), verify error UI shows with retry button
- [ ] Click retry button, verify it attempts to reload

**Avatar Fallbacks:**
- [ ] Visit `/cafes` -- cafe cards should show themed avatars for contributors
- [ ] Visit `/manage/users` -- user list should show `UserAvatar` with initials
- [ ] Open global search, search for a user -- should show `UserAvatar` not generic icon
- [ ] Visit a user's followers page -- should show themed avatars
- [ ] Visit a user's following page -- should show themed avatars
- [ ] Visit `/profile/activity` -- check-in avatars should use `UserAvatar`
- [ ] Visit a blog post -- author avatar should use `UserAvatar`
- [ ] Verify fallback colors match the warm brown palette (no random HSL colors)

**Privacy:**
- [ ] As unauthenticated user, try to access profile data via server actions -- should be blocked
- [ ] As user A, try to update user B's profile -- should be rejected
- [ ] Visit a private profile as a non-follower -- should see limited data
- [ ] Visit a private profile as a follower -- should see full data
- [ ] Check `/manage` route as non-admin -- should redirect to home
- [ ] Search for users in community -- should require auth
- [ ] View today's visitors -- should require auth and filter private profiles

**Step 4: Commit verification (if any fixes needed)**

---

### Additional Suggestions (Out of Scope but Recommended)

These are improvements identified during the audit that are not in scope for this plan but should be considered for future work:

1. **Enable email verification** (`lib/auth.ts:29`): `requireEmailVerification: false` is a security risk. Consider enabling it with a proper email verification flow using Resend.

2. **Add Next.js middleware for route protection**: Currently no `middleware.ts` exists. Adding one would provide defense-in-depth for `/manage/*`, `/owner/*`, `/writer/*` routes.

3. **Profile update input validation**: `updateProfile` doesn't validate `display_name`, `bio`, `username` length or content. Add Zod validation.

4. **Scroll position restoration**: `IS_SCROLL_RESTORE_ENABLED` is set to `false` in CafesPageClient. Consider enabling it with proper testing.

5. **GDPR-style data controls**: No data export or account deletion feature exists. Consider adding these for compliance.

6. **Activity privacy settings**: Check-in history is public. Consider adding an option to hide visit history.

7. **Search opt-out**: No way to exclude yourself from search results. Consider adding this privacy setting.

8. **Blocked users**: No block system exists to prevent unwanted interactions.

9. **Hardcoded admin email**: `app/api/actions/contact.ts:44` has `adrianbonpin@gmail.com` hardcoded. Move to environment variable.

10. **Owner route protection**: `/owner/` directory has no layout-level protection. Each page independently checks ownership. Add a layout with auth check.

---

## Summary of All Tasks

| Task | Scope | Files Changed |
|------|-------|---------------|
| 1 | Cafes: Request cancellation + version tracking | `CafesPageClient.tsx` |
| 2 | Cafes: Client-side filter pagination | (no changes needed) |
| 3 | Cafes: near_me auto-disable oscillation fix | `CafesPageClient.tsx` |
| 4 | Cafes: Error state + retry UI | `CafesPageClient.tsx` |
| 5 | Avatar: Project color palette | `avatar.ts`, `avatar.test.ts` |
| 6 | Avatar: Migrate 5 inline fallbacks | 5 page files |
| 7 | Avatar: Global search modal | `SearchResults.tsx` |
| 8 | Avatar: Find people modal | (already done) |
| 9 | Avatar: Run tests | (verification) |
| 10 | Privacy: updateProfile ownership | `profile.ts` |
| 11 | Privacy: getProfileByUsername enforcement | `profile.ts` |
| 12 | Privacy: getTodayVisitors auth | `profile.ts` |
| 13 | Privacy: Search auth checks | `community.ts` |
| 14 | Privacy: Followers/following filtering | `social.ts` |
| 15 | Privacy: getFullProfileData enforcement | `profile.ts` |
| 16 | Privacy: Write tests | `social-privacy.test.ts` |
| 17 | Final verification | (all) |

**Total commits: ~12-14 commits**
