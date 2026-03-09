# Avatar Fallback on Broken Image URLs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When a user's `avatarUrl` is a non-null string that resolves to a broken/invalid image (e.g. an expired Google or Discord OAuth photo URL), automatically fall back to the Grounds default avatar instead of showing a broken image.

**Architecture:** Create a single reusable `UserAvatar` client component that wraps Next.js `<Image>` with an `onError` handler. The handler catches load failures and switches to a local default avatar image (`/icon.png`, the Grounds app icon already in `public/`). This component consolidates the ~30 scattered avatar render sites into one canonical implementation. The existing `null`-check fallback (Lucide `<User>` icon or first-initial) is preserved for sites that explicitly show initials — only `<Image>` sites gain the broken-URL recovery.

**Tech Stack:** Next.js `<Image>` (with `unoptimized: true`), React `useState` + `onError`, Tailwind CSS, TypeScript strict mode.

---

## Background: What Exists Today

- **~30 components** render user avatars. Each uses the pattern:
  ```tsx
  {avatarUrl ? <Image src={avatarUrl} ... /> : <FallbackJSX />}
  ```
- **No `onError` handler exists anywhere.** If `avatarUrl` is truthy but the URL returns a 404 (common for Google/Discord OAuth photos that expire), Next.js `<Image>` shows a broken image with no recovery.
- **No default avatar image exists in `public/`.** The Grounds app icon (`/icon.png`) is present and suitable as the fallback — it is a branded square icon already used for the PWA.
- **Two avatar systems exist:** `profiles.avatarUrl` (app-managed R2 CDN) and `user.image` (OAuth provider image). Only `profiles.avatarUrl` is rendered in the UI. OAuth images from Google/Discord can expire and break.

## Key Files

| Path | Role |
|---|---|
| `components/ui/UserAvatar.tsx` | **New file** — the canonical avatar component |
| `public/icon.png` | Default avatar image (already exists — Grounds icon) |
| `components/reviews/ReviewItem.tsx:143-154` | High-visibility avatar (review authors) |
| `components/profile/Profile.tsx:647-656` | Own profile header |
| `components/profile/PublicProfile.tsx:241-250` | Public profile header |
| `components/recent/RecentReviewsSection.tsx:107-119` | Landing page recent reviews |
| `components/community/CommunityPage.tsx:716-728` | User search cards |
| `components/community/MonthlyLeaderboard.tsx:425-439` | Leaderboard entries |
| `components/community/ExpandableRankCard.tsx:76-88,123-135` | Rank cards |
| `components/community/CollectionView.tsx:191-203` | Collection author |
| `components/cafe/CafeSidebar.tsx:466-478` | Today's visitors chip |
| `components/cafe/CafeMobileContent.tsx:503-515` | Mobile visitors chip |
| `components/crawls/CrawlView.tsx:162-174` | Crawl author |
| `components/collections/CollectionCard.tsx:85-98` | Collection card author |
| `components/feed/ActivityFeedSection.tsx:134-148,265-279,345-358` | Activity feed avatars |
| `components/social/FollowListModal.tsx:320-336,404-420` | Followers/Following lists |
| `components/checkin/CompanionSelector.tsx:97-109,158-164` | Companion selection |
| `components/manage/CommunityManagement.tsx:397-414,825-837,912-924` | Admin panels |
| `components/manage/CafeEditor.tsx:841-853,897-909,948-960` | Cafe editor admin |
| `components/admin/AwardBadgeModal.tsx:381-396,524-539` | Badge award admin |
| `components/history/ContributionHistoryModal.tsx:206-222` | Contribution history |
| `components/owner/CafeManagement.tsx:1558-1580` | Owner dashboard reviews |

---

## Task 1: Create the `UserAvatar` component

**Files:**
- Create: `components/ui/UserAvatar.tsx`

**Context:**

The component must:
1. Accept `src: string | null | undefined`, `alt: string`, `size: number` (px), and an optional `className`.
2. Track an `error` state via `useState<boolean>(false)`.
3. When `src` is null/undefined OR `error` is true, render the Grounds default: an `<Image>` pointing at `/icon.png` (or a `<User>` icon — see decision note below).
4. When `src` is a valid string and no error, render `<Image src={src} onError={() => setError(true)} .../>`.
5. Be a `"use client"` component (needs `useState`).

**Decision: what to show on error?**

Two reasonable choices:
- **Option A (recommended):** Show `/icon.png` (the Grounds app icon) — consistent branding, always renders correctly since it is a local file.
- **Option B:** Show the Lucide `<User>` icon — same as the existing null fallback, simpler but less branded.

This plan uses **Option A** (local `/icon.png`). If the designer prefers Option B, swap `<Image src="/icon.png" .../>` for `<User className="..." />` in the error/null branch.

**Step 1: Create the file**

```tsx
"use client"

import Image from "next/image"
import { User } from "lucide-react"
import { useState } from "react"
import { cn } from "@/utils/cn"

interface UserAvatarProps {
    /** The user's avatar URL. If null/undefined or the URL fails to load, falls back to the default. */
    src: string | null | undefined
    /** Alt text for the image (typically the user's display name). */
    alt: string
    /** Width and height in pixels. The container is always a square. */
    size: number
    /** Extra Tailwind classes applied to the outer wrapper div. */
    className?: string
}

/**
 * Renders a user avatar with automatic fallback.
 *
 * - If `src` is null/undefined → shows fallback immediately.
 * - If `src` is a URL that fails to load (404, expired OAuth photo, etc.) → catches
 *   the error and switches to the fallback.
 * - Fallback: Grounds default icon (/icon.png).
 */
export function UserAvatar({ src, alt, size, className }: UserAvatarProps) {
    const [hasError, setHasError] = useState(false)

    const showFallback = !src || hasError

    return (
        <div
            className={cn("relative overflow-hidden rounded-full", className)}
            style={{ width: size, height: size }}
        >
            {showFallback ? (
                <Image
                    src="/icon.png"
                    alt="Default avatar"
                    fill
                    className="object-cover"
                />
            ) : (
                <Image
                    src={src}
                    alt={alt}
                    fill
                    className="object-cover"
                    onError={() => setHasError(true)}
                />
            )}
        </div>
    )
}
```

**Step 2: Verify the file was created correctly**

Open the file and confirm:
- `"use client"` directive at top
- `useState(false)` for error state
- `onError={() => setHasError(true)}` on the `<Image>`
- Fallback renders `/icon.png`

No test is written for this step because the component is purely visual/DOM-based; manual verification is sufficient here. Unit tests for the fallback logic are added in Task 2.

---

## Task 2: Write tests for `UserAvatar`

**Files:**
- Create: `components/ui/__tests__/UserAvatar.test.tsx`

**Context:**

Bun's test runner is used (`bun test`). The component needs JSDOM or similar for React rendering. Check how existing tests mock Next.js `<Image>` — look at any existing `__tests__` files for patterns.

**Step 1: Look at an existing test for reference**

Run: `ls components/**/__tests__/` or look at the file tree for existing test files. Check one test to understand the mock setup.

**Step 2: Write the test file**

```tsx
import { describe, it, expect, mock, beforeAll } from "bun:test"

// Mock next/image to a plain <img> so tests can inspect src/alt
mock.module("next/image", () => ({
    default: ({ src, alt, onError, ...rest }: any) => (
        <img src={src} alt={alt} onError={onError} {...rest} />
    ),
}))

// Mock lucide-react User icon
mock.module("lucide-react", () => ({
    User: () => <svg data-testid="user-icon" />,
}))

import { render, fireEvent } from "@testing-library/react"
import { UserAvatar } from "../UserAvatar"

describe("UserAvatar", () => {
    it("renders the provided src when valid", () => {
        const { getByAltText } = render(
            <UserAvatar src="https://cdn.grounds.ph/user/abc.jpg" alt="Jane" size={40} />
        )
        const img = getByAltText("Jane") as HTMLImageElement
        expect(img.src).toContain("cdn.grounds.ph")
    })

    it("renders /icon.png when src is null", () => {
        const { getByAltText } = render(
            <UserAvatar src={null} alt="Jane" size={40} />
        )
        const img = getByAltText("Default avatar") as HTMLImageElement
        expect(img.src).toContain("/icon.png")
    })

    it("renders /icon.png when src is undefined", () => {
        const { getByAltText } = render(
            <UserAvatar src={undefined} alt="Jane" size={40} />
        )
        const img = getByAltText("Default avatar") as HTMLImageElement
        expect(img.src).toContain("/icon.png")
    })

    it("falls back to /icon.png when the image errors", () => {
        const { getByAltText } = render(
            <UserAvatar src="https://lh3.googleusercontent.com/expired.jpg" alt="Jane" size={40} />
        )
        // Initially renders with the src
        const img = getByAltText("Jane") as HTMLImageElement
        expect(img.src).toContain("googleusercontent")

        // Simulate a load failure
        fireEvent.error(img)

        // Now it should show the fallback
        const fallback = getByAltText("Default avatar") as HTMLImageElement
        expect(fallback.src).toContain("/icon.png")
    })

    it("applies size to the wrapper div", () => {
        const { container } = render(
            <UserAvatar src={null} alt="Jane" size={64} />
        )
        const wrapper = container.firstChild as HTMLElement
        expect(wrapper.style.width).toBe("64px")
        expect(wrapper.style.height).toBe("64px")
    })
})
```

**Step 3: Run the tests**

```bash
bun test components/ui/__tests__/UserAvatar.test.tsx
```

Expected: All 5 tests PASS. If `@testing-library/react` is not installed, add it:
```bash
bun add -d @testing-library/react @testing-library/jest-dom
```

**Step 4: Commit**

```bash
git add components/ui/UserAvatar.tsx components/ui/__tests__/UserAvatar.test.tsx
git commit -m "feat: add UserAvatar component with broken-image fallback"
```

---

## Task 3: Replace avatars in high-traffic public-facing components

These are the components most likely seen by users. Prioritize them first.

**Files to modify (in order):**
1. `components/reviews/ReviewItem.tsx` (lines 143–154 and 295–309)
2. `components/recent/RecentReviewsSection.tsx` (lines 107–119)
3. `components/profile/Profile.tsx` (lines 647–656)
4. `components/profile/PublicProfile.tsx` (lines 241–250)

### ReviewItem.tsx — author avatar (lines 143–154)

**Before:**
```tsx
<div className='relative w-10 h-10 rounded-full overflow-hidden bg-text/5 border border-text/10 group-hover:border-primary/50 transition-colors'>
    {avatarUrl ? (
        <Image
            src={avatarUrl}
            alt={displayName}
            fill
            className='object-cover'
        />
    ) : (
        <div className='w-full h-full flex items-center justify-center'>
            <User className='w-5 h-5 text-text opacity-40' />
        </div>
    )}
</div>
```

**After:**
```tsx
<UserAvatar
    src={avatarUrl}
    alt={displayName}
    size={40}
    className="bg-text/5 border border-text/10 group-hover:border-primary/50 transition-colors"
/>
```

Also remove any now-unused `Image` import if `UserAvatar` is the only image usage in that file. Add the import:
```tsx
import { UserAvatar } from "@/components/ui/UserAvatar"
```

Also update the **owner response avatar** at lines 295–309 (similar pattern, size 24).

### RecentReviewsSection.tsx — lines 107–119

Same substitution; size 24.

### Profile.tsx — own profile header (lines 647–656)

Size 112. Note: this component has an upload overlay rendered over the avatar — preserve that. The `UserAvatar` replaces only the `<Image>` + null-icon block, not the overlay divs.

**Before (simplified):**
```tsx
<div className="w-28 h-28 rounded-full ... relative group ...">
    {profileData.avatar_url ? (
        <Image src={profileData.avatar_url} alt={profileData.display_name} fill className="object-cover" />
    ) : (
        <User className="w-12 h-12 text-text opacity-40" />
    )}
    {/* Upload overlay stays */}
</div>
```

**After:**
```tsx
<div className="w-28 h-28 rounded-full ... relative group ...">
    <UserAvatar src={profileData.avatar_url} alt={profileData.display_name} size={112} />
    {/* Upload overlay stays */}
</div>
```

Note: `UserAvatar` is `position: relative` with `overflow-hidden rounded-full` built-in. The outer wrapper still handles the upload overlay. You may need to set `UserAvatar`'s className to ensure it fills properly within the outer div — or let the outer div handle sizing and pass `className="w-full h-full"`. Inspect visually.

### PublicProfile.tsx — lines 241–250

Size 112. Same pattern as Profile.tsx but no upload overlay.

**Step: After each file change, verify the app compiles**

```bash
bun build 2>&1 | tail -20
```

**Step: Commit after all 4 files**

```bash
git add components/reviews/ReviewItem.tsx components/recent/RecentReviewsSection.tsx components/profile/Profile.tsx components/profile/PublicProfile.tsx
git commit -m "feat: use UserAvatar with fallback in review, profile, and recent sections"
```

---

## Task 4: Replace avatars in community and leaderboard components

**Files:**
1. `components/community/CommunityPage.tsx` (lines 716–728)
2. `components/community/MonthlyLeaderboard.tsx` (lines 425–439) — **initial-based fallback, keep it**
3. `components/community/ExpandableRankCard.tsx` (lines 76–88, 123–135)
4. `components/community/CollectionView.tsx` (lines 191–203)

**Note for MonthlyLeaderboard and similar initial-based fallbacks:**

Some components show the user's first initial as a fallback when `avatarUrl` is null. This is intentional UX. For these, the desired behavior is:

- `avatarUrl` is null → show initial (unchanged, keep existing JSX)
- `avatarUrl` is a broken URL → show default icon (new behavior via `UserAvatar`)

This means you **cannot replace the outer conditional** entirely. Instead, replace only the `<Image>` inside the truthy branch with `<UserAvatar>`:

**Before (MonthlyLeaderboard-style):**
```tsx
{avatarUrl ? (
    <Image src={avatarUrl} alt={displayName} fill className="object-cover" />
) : (
    <span className="text-lg font-bold">{displayName[0]}</span>
)}
```

**After:**
```tsx
{avatarUrl ? (
    <UserAvatar src={avatarUrl} alt={displayName} size={48} />
) : (
    <span className="text-lg font-bold">{displayName[0]}</span>
)}
```

This preserves the initial fallback for null URLs and adds broken-URL recovery for non-null URLs.

**Step: Commit after all 4 files**

```bash
git add components/community/CommunityPage.tsx components/community/MonthlyLeaderboard.tsx components/community/ExpandableRankCard.tsx components/community/CollectionView.tsx
git commit -m "feat: use UserAvatar with fallback in community and leaderboard components"
```

---

## Task 5: Replace avatars in cafe, feed, and social components

**Files:**
1. `components/cafe/CafeSidebar.tsx` (lines 466–478)
2. `components/cafe/CafeMobileContent.tsx` (lines 503–515)
3. `components/crawls/CrawlView.tsx` (lines 162–174)
4. `components/collections/CollectionCard.tsx` (lines 85–98)
5. `components/feed/ActivityFeedSection.tsx` (lines 134–148, 265–279, 345–358)
6. `components/social/FollowListModal.tsx` (lines 320–336, 404–420)
7. `components/checkin/CompanionSelector.tsx` (lines 97–109, 158–164)

Same pattern as Tasks 3 and 4. Use `UserAvatar` for the image, preserve initial-based fallbacks where they exist.

**Step: Compile check after each file**

```bash
bun build 2>&1 | grep -E "error|Error" | head -20
```

**Step: Commit after all 7 files**

```bash
git add components/cafe/CafeSidebar.tsx components/cafe/CafeMobileContent.tsx components/crawls/CrawlView.tsx components/collections/CollectionCard.tsx components/feed/ActivityFeedSection.tsx components/social/FollowListModal.tsx components/checkin/CompanionSelector.tsx
git commit -m "feat: use UserAvatar with fallback in cafe, feed, and social components"
```

---

## Task 6: Replace avatars in admin/manage components

**Files:**
1. `components/manage/CommunityManagement.tsx` (lines 397–414, 825–837, 912–924)
2. `components/manage/CafeEditor.tsx` (lines 841–853, 897–909, 948–960)
3. `components/admin/AwardBadgeModal.tsx` (lines 381–396, 524–539)
4. `components/history/ContributionHistoryModal.tsx` (lines 206–222)
5. `components/owner/CafeManagement.tsx` (lines 1558–1580)

Same pattern. Admin components tend to have initial-based fallbacks — preserve them using the pattern from Task 4.

**Step: Commit after all 5 files**

```bash
git add components/manage/CommunityManagement.tsx components/manage/CafeEditor.tsx components/admin/AwardBadgeModal.tsx components/history/ContributionHistoryModal.tsx components/owner/CafeManagement.tsx
git commit -m "feat: use UserAvatar with fallback in admin and manage components"
```

---

## Task 7: Final lint and build check

**Step 1: Run the linter**

```bash
bun lint
```

Fix any warnings (most likely unused imports from removed `<Image>` and Lucide `<User>` usages).

**Step 2: Run full build**

```bash
bun build
```

Expected: No errors.

**Step 3: Run all tests**

```bash
bun test
```

Expected: All tests pass including the new `UserAvatar.test.tsx`.

**Step 4: Commit any lint fixes**

```bash
git add -A
git commit -m "fix: remove unused imports after UserAvatar migration"
```

---

## Testing Checklist (Manual)

After implementation, verify these scenarios in the browser with `bun dev`:

1. **User with a valid CDN avatar** → avatar renders normally.
2. **User with null `avatarUrl`** → fallback renders (initial or User icon, per component).
3. **Simulate broken URL:** In browser DevTools → Network → add a block rule for `cdn.grounds.ph/*.jpg` → reload a page with avatars → should see `/icon.png` fallback instead of broken image.
4. **Profile edit page** → avatar upload still works, overlay renders correctly.
5. **Mobile responsive** → check that avatar sizes are correct on narrow screens.

---

## Notes

- `/icon.png` is 192×192px — sufficient for all avatar sizes (max used is 112px). Next.js `<Image>` with `fill` will scale it correctly.
- The `unoptimized: true` flag in `next.config.ts` means all images bypass Next.js optimization — this is fine; the fallback will still load from `public/icon.png` as a static file.
- Google OAuth image URLs (from `lh3.googleusercontent.com`) and Discord CDN URLs are not in `remotePatterns` in `next.config.ts`. This is currently not an issue because `profiles.avatarUrl` stores R2 CDN URLs — but if someone's profile was never updated after OAuth sign-up and still has the OAuth URL stored, it would fail. This plan covers that case via the `onError` handler.
- Do not add `lh3.googleusercontent.com` or `cdn.discordapp.com` to `remotePatterns` — that would allow arbitrary external images and the fallback mechanism makes it unnecessary.
