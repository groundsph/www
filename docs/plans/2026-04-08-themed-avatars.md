# Themed Avatar Placeholders Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the generic `/icon.png` fallback with deterministic, initials-based themed avatars for users without a profile picture.

**Architecture:** Add a `getInitials()` and `getAvatarColor()` utility, update `UserAvatar` to render an initials circle when no image is available, and remove all 5 inline fallback patterns that bypass `UserAvatar`. Single source of truth, zero DB changes.

**Tech Stack:** React, TypeScript, Tailwind CSS v4, Bun test runner

## Current State Analysis

- **`UserAvatar`** (`components/ui/UserAvatar.tsx`) falls back to `/icon.png` when no avatar URL
- **5 components** bypass `UserAvatar` with inline initials fallbacks (inconsistent styling)
- Avatars rendered in **21+ component files**, ~65 call sites total
- Two DB image fields: `profiles.avatarUrl` (app) and `user.image` (Better Auth)

## Approach

1. Create `utils/avatar.ts` with `getInitials()` and `getAvatarColor()` utility functions
2. Update `UserAvatar` to render a themed initials circle as fallback instead of `/icon.png`
3. Remove all 5 inline fallback patterns, replacing with direct `UserAvatar` calls
4. Update tests to reflect new fallback behavior

## Color Generation Strategy

- Hash the user's `displayName` (or `alt` prop) to produce a deterministic HSL color
- Use a curated hue range (avoid muddy/neon extremes): hues 0-360 mapped from hash
- Fixed saturation (60%) and lightness (45%) for readability with white text
- No DB changes needed — purely computed client-side

---

### Task 1: Create avatar utility functions

**Files:**
- Create: `utils/avatar.ts`
- Test: `utils/__tests__/avatar.test.ts`

**Step 1: Write the failing test**

```ts
// utils/__tests__/avatar.test.ts
import { describe, it, expect } from "bun:test"
import { getInitials, getAvatarColor } from "@/utils/avatar"

describe("getInitials", () => {
    it("returns first letter for single-word names", () => {
        expect(getInitials("Adrian")).toBe("A")
    })

    it("returns first letters of first and last word", () => {
        expect(getInitials("Adrian Bonpin")).toBe("AB")
    })

    it("returns first letters of first and last word for three+ words", () => {
        expect(getInitials("Mary Jane Watson")).toBe("MW")
    })

    it("returns '?' for empty string", () => {
        expect(getInitials("")).toBe("?")
    })

    it("handles single character", () => {
        expect(getInitials("A")).toBe("A")
    })

    it("trims whitespace", () => {
        expect(getInitials("  Adrian   Bonpin  ")).toBe("AB")
    })
})

describe("getAvatarColor", () => {
    it("returns a valid HSL string", () => {
        const color = getAvatarColor("Adrian Bonpin")
        expect(color).toMatch(/^hsl\(\d+,\s*\d+%,\s*\d+%\)$/)
    })

    it("returns consistent color for same input", () => {
        const color1 = getAvatarColor("Adrian Bonpin")
        const color2 = getAvatarColor("Adrian Bonpin")
        expect(color1).toBe(color2)
    })

    it("returns different colors for different inputs", () => {
        const color1 = getAvatarColor("Adrian")
        const color2 = getAvatarColor("Bonpin")
        expect(color1).not.toBe(color2)
    })

    it("handles empty string", () => {
        const color = getAvatarColor("")
        expect(color).toMatch(/^hsl\(\d+,\s*\d+%,\s*\d+%\)$/)
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/__tests__/avatar.test.ts`
Expected: FAIL with "Cannot find module '@/utils/avatar'"

**Step 3: Write minimal implementation**

```ts
// utils/avatar.ts
/**
 * Extracts initials from a display name.
 * - Single word: first letter
 * - Multiple words: first letter of first and last word
 * - Empty: "?"
 */
export function getInitials(name: string): string {
    const trimmed = name.trim()
    if (!trimmed) return "?"

    const words = trimmed.split(/\s+/).filter(Boolean)
    if (words.length === 1) return words[0][0]!.toUpperCase()

    return (words[0]![0]! + words[words.length - 1]![0]!).toUpperCase()
}

/**
 * Generates a deterministic HSL color from a string.
 * Uses a simple hash to pick a hue, with fixed saturation and lightness
 * for consistent readability with white text.
 */
export function getAvatarColor(name: string): string {
    let hash = 0
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash)
        hash = hash & hash // Convert to 32-bit int
    }

    const hue = Math.abs(hash) % 360
    const saturation = 60
    const lightness = 45

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}
```

**Step 4: Run test to verify it passes**

Run: `bun test utils/__tests__/avatar.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add utils/avatar.ts utils/__tests__/avatar.test.ts
git commit -m "feat: add avatar utility functions for themed placeholders"
```

---

### Task 2: Update UserAvatar to render themed initials fallback

**Files:**
- Modify: `components/ui/UserAvatar.tsx`
- Modify: `components/ui/__tests__/UserAvatar.test.tsx`

**Step 1: Update UserAvatar component**

Replace the `/icon.png` fallback with an initials-based themed circle. The component needs a new optional `fallbackName` prop (defaults to `alt`) so the initials and color can be derived.

```tsx
// components/ui/UserAvatar.tsx
"use client"

import Image from "next/image"
import { useState } from "react"
import { cn } from "@/utils/cn"
import { getInitials, getAvatarColor } from "@/utils/avatar"

interface UserAvatarProps {
    /** The user's avatar URL. If null/undefined or the URL fails to load, falls back to themed initials. */
    src: string | null | undefined
    /** Alt text for the image (typically the user's display name). Also used for initials/color if fallbackName not set. */
    alt: string
    /** Width and height in pixels. The container is always a square. */
    size: number
    /** Extra Tailwind classes applied to the outer wrapper div. */
    className?: string
    /** Override the name used for initials and color generation. Defaults to `alt`. */
    fallbackName?: string
}

/**
 * Renders a user avatar with automatic themed fallback.
 *
 * - If `src` is a valid URL → shows the image.
 * - If `src` is null/undefined or fails to load → shows initials-based placeholder
 *   with a deterministic background color derived from the user's name.
 */
export function UserAvatar({ src, alt, size, className, fallbackName }: UserAvatarProps) {
    const [hasError, setHasError] = useState(false)

    const showFallback = !src || hasError
    const name = fallbackName ?? alt
    const initials = getInitials(name)
    const bgColor = getAvatarColor(name)

    return (
        <div
            className={cn("relative overflow-hidden rounded-full", className)}
            style={{ width: size, height: size }}
        >
            {showFallback ? (
                <div
                    className="flex items-center justify-center w-full h-full select-none"
                    style={{ backgroundColor: bgColor }}
                    aria-label={alt}
                    role="img"
                >
                    <span
                        className="font-semibold text-white leading-none"
                        style={{ fontSize: Math.max(size * 0.4, 12) }}
                    >
                        {initials}
                    </span>
                </div>
            ) : (
                <Image
                    src={src}
                    alt={alt}
                    fill
                    sizes={`${size}px`}
                    className="object-cover"
                    loading='lazy'
                    onError={() => setHasError(true)}
                />
            )}
        </div>
    )
}
```

**Step 2: Update tests to reflect new fallback behavior**

The existing tests check for `/icon.png` as the fallback. Update them to verify the initials-based fallback instead.

```tsx
// components/ui/__tests__/UserAvatar.test.tsx
import { describe, it, expect, mock } from "bun:test"
import { render, fireEvent } from "@testing-library/react"

interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src: string
    alt: string
    fill?: boolean
    sizes?: string
    priority?: boolean
    onError?: () => void
}

mock.module("next/image", () => ({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    default: ({ src, alt, onError, fill, sizes, priority, ...rest }: ImageProps) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} onError={onError} {...rest} />
    ),
}))

import { UserAvatar } from "../UserAvatar"

describe("UserAvatar", () => {
    it("renders the provided src when valid", () => {
        const { container } = render(
            <UserAvatar src="/avatar.jpg" alt="User avatar" size={48} />
        )
        const img = container.querySelector("img")
        expect(img).toBeTruthy()
        expect(img?.getAttribute("src")).toBe("/avatar.jpg")
        expect(img?.getAttribute("alt")).toBe("User avatar")
    })

    it("renders initials fallback when src is null", () => {
        const { container } = render(
            <UserAvatar src={null} alt="Adrian Bonpin" size={48} />
        )
        // Should render a div with initials, not an image
        const fallbackDiv = container.querySelector("[role='img']")
        expect(fallbackDiv).toBeTruthy()
        expect(fallbackDiv?.getAttribute("aria-label")).toBe("Adrian Bonpin")
        // Should contain initials text
        const span = fallbackDiv?.querySelector("span")
        expect(span?.textContent).toBe("AB")
    })

    it("renders initials fallback when src is undefined", () => {
        const { container } = render(
            <UserAvatar src={undefined} alt="Jane Doe" size={48} />
        )
        const fallbackDiv = container.querySelector("[role='img']")
        expect(fallbackDiv).toBeTruthy()
        const span = fallbackDiv?.querySelector("span")
        expect(span?.textContent).toBe("JD")
    })

    it("falls back to initials when the image errors (onError fires)", () => {
        const { container } = render(
            <UserAvatar src="/avatar.jpg" alt="Test User" size={48} />
        )
        const img = container.querySelector("img")
        expect(img).toBeTruthy()
        expect(img?.getAttribute("src")).toBe("/avatar.jpg")

        // Simulate error
        fireEvent.error(img!)

        // After error, should show initials fallback
        const fallbackDiv = container.querySelector("[role='img']")
        expect(fallbackDiv).toBeTruthy()
        const span = fallbackDiv?.querySelector("span")
        expect(span?.textContent).toBe("TU")
    })

    it("applies size to the wrapper div", () => {
        const { container } = render(
            <UserAvatar src="/avatar.jpg" alt="User avatar" size={64} />
        )
        const wrapper = container.firstChild as HTMLElement
        expect(wrapper).toBeTruthy()
        expect(wrapper.style.width).toBe("64px")
        expect(wrapper.style.height).toBe("64px")
    })

    it("uses fallbackName for initials when provided", () => {
        const { container } = render(
            <UserAvatar src={null} alt="Display Name" size={48} fallbackName="Override Name" />
        )
        const fallbackDiv = container.querySelector("[role='img']")
        const span = fallbackDiv?.querySelector("span")
        expect(span?.textContent).toBe("ON")
    })

    it("applies a deterministic background color", () => {
        const { container: c1 } = render(
            <UserAvatar src={null} alt="Adrian" size={48} />
        )
        const { container: c2 } = render(
            <UserAvatar src={null} alt="Adrian" size={48} />
        )
        const div1 = c1.querySelector("[role='img']") as HTMLElement
        const div2 = c2.querySelector("[role='img']") as HTMLElement
        expect(div1.style.backgroundColor).toBeTruthy()
        expect(div1.style.backgroundColor).toBe(div2.style.backgroundColor)
    })
})
```

**Step 3: Run tests to verify they pass**

Run: `bun test components/ui/__tests__/UserAvatar.test.ts`
Expected: PASS

**Step 4: Run full lint check**

Run: `bun lint`
Expected: PASS (no new lint errors)

**Step 5: Commit**

```bash
git add components/ui/UserAvatar.tsx components/ui/__tests__/UserAvatar.test.tsx
git commit -m "feat: replace generic fallback with themed initials avatars"
```

---

### Task 3: Consolidate inline fallbacks — FollowListModal

**Files:**
- Modify: `components/social/FollowListModal.tsx:320-333` (search results)
- Modify: `components/social/FollowListModal.tsx:439-452` (follow list)

Replace the conditional `avatarUrl ? <UserAvatar> : <initials div>` pattern with direct `<UserAvatar>` calls. The updated `UserAvatar` now handles the initials fallback internally.

**Step 1: Replace search results inline fallback (line 320-333)**

Before:
```tsx
{user.avatarUrl ? (
    <UserAvatar
        src={user.avatarUrl}
        alt={user.displayName}
        size={40}
        className='rounded-full bg-text/10 overflow-hidden relative'
    />
) : (
    <div className='w-10 h-10 rounded-full bg-text/10 overflow-hidden relative flex items-center justify-center'>
        <span className='text-xs font-bold opacity-40'>
            {user.displayName.charAt(0)}
        </span>
    </div>
)}
```

After:
```tsx
<UserAvatar
    src={user.avatarUrl}
    alt={user.displayName}
    size={40}
/>
```

**Step 2: Replace follow list inline fallback (line 439-452)**

Same pattern replacement — remove the conditional, use `<UserAvatar>` directly.

**Step 3: Run lint**

Run: `bun lint`
Expected: PASS

**Step 4: Commit**

```bash
git add components/social/FollowListModal.tsx
git commit -m "refactor: consolidate FollowListModal avatar fallbacks into UserAvatar"
```

---

### Task 4: Consolidate inline fallbacks — ActivityFeedSection

**Files:**
- Modify: `components/feed/ActivityFeedSection.tsx:135-148` (visitor avatars)
- Modify: `components/feed/ActivityFeedSection.tsx:265-277` (check-in avatars)
- Modify: `components/feed/ActivityFeedSection.tsx:343-353` (companion avatars)

**Step 1: Replace visitor avatar fallback (line 135-148)**

Before:
```tsx
{visitor.avatarUrl ? (
    <UserAvatar
        src={visitor.avatarUrl}
        alt={visitor.displayName}
        size={28}
        className='border-2 border-background'
    />
) : (
    <div className='w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center border-2 border-background'>
        <span className='text-primary font-bold text-sm'>
            {visitor.displayName.charAt(0)}
        </span>
    </div>
)}
```

After:
```tsx
<UserAvatar
    src={visitor.avatarUrl}
    alt={visitor.displayName}
    size={28}
    className='border-2 border-background'
/>
```

**Step 2: Replace remaining two inline fallbacks in the same file (lines 265-277, 343-353)**

Same pattern — remove the conditional, use `<UserAvatar>` directly.

**Step 3: Run lint**

Run: `bun lint`
Expected: PASS

**Step 4: Commit**

```bash
git add components/feed/ActivityFeedSection.tsx
git commit -m "refactor: consolidate ActivityFeedSection avatar fallbacks into UserAvatar"
```

---

### Task 5: Consolidate inline fallbacks — CollectionCard

**Files:**
- Modify: `components/collections/CollectionCard.tsx:88-100`

**Step 1: Replace inline fallback (line 88-100)**

Before:
```tsx
{author.avatarUrl ? (
    <UserAvatar
        src={author.avatarUrl}
        alt={author.displayName}
        size={20}
    />
) : (
    <div className='w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center'>
        <span className='text-xs text-primary font-medium'>
            {author.displayName.charAt(0).toUpperCase()}
        </span>
    </div>
)}
```

After:
```tsx
<UserAvatar
    src={author.avatarUrl}
    alt={author.displayName}
    size={20}
/>
```

**Step 2: Run lint**

Run: `bun lint`
Expected: PASS

**Step 3: Commit**

```bash
git add components/collections/CollectionCard.tsx
git commit -m "refactor: consolidate CollectionCard avatar fallback into UserAvatar"
```

---

### Task 6: Consolidate inline fallbacks — ExpandableRankCard

**Files:**
- Modify: `components/community/ExpandableRankCard.tsx:76-82` (primary entry)
- Modify: `components/community/ExpandableRankCard.tsx:117-123` (secondary entries)

**Step 1: Replace primary entry inline fallback (line 76-82)**

Before:
```tsx
{entries[0].avatarUrl ? (
    <UserAvatar src={entries[0].avatarUrl} alt={entries[0].displayName} size={56} className="border-2 border-white/50" />
) : (
    <div className="w-14 h-14 rounded-full bg-white/30 flex items-center justify-center text-white font-bold text-xl border-2 border-white/50">
        {entries[0].displayName.charAt(0)}
    </div>
)}
```

After:
```tsx
<UserAvatar src={entries[0].avatarUrl} alt={entries[0].displayName} size={56} className="border-2 border-white/50" />
```

**Step 2: Replace secondary entries inline fallback (line 117-123)**

Same pattern replacement.

**Step 3: Run lint**

Run: `bun lint`
Expected: PASS

**Step 4: Commit**

```bash
git add components/community/ExpandableRankCard.tsx
git commit -m "refactor: consolidate ExpandableRankCard avatar fallbacks into UserAvatar"
```

---

### Task 7: Consolidate inline fallbacks — MonthlyLeaderboard

**Files:**
- Modify: `components/community/MonthlyLeaderboard.tsx:425-433`

**Step 1: Replace inline fallback (line 425-433)**

Before:
```tsx
{entry.avatarUrl ? (
    <UserAvatar src={entry.avatarUrl} alt={entry.displayName} size={48} />
) : (
    <div className='w-full h-full flex items-center justify-center text-text/40 font-bold'>
        {entry.displayName.charAt(0).toUpperCase()}
    </div>
)}
```

After:
```tsx
<UserAvatar src={entry.avatarUrl} alt={entry.displayName} size={48} />
```

Also remove the outer `<div className='w-12 h-12 rounded-full overflow-hidden bg-secondary/20 shrink-0'>` wrapper since `UserAvatar` handles its own sizing and rounding.

**Step 2: Run lint**

Run: `bun lint`
Expected: PASS

**Step 3: Commit**

```bash
git add components/community/MonthlyLeaderboard.tsx
git commit -m "refactor: consolidate MonthlyLeaderboard avatar fallback into UserAvatar"
```

---

### Task 8: Final verification and cleanup

**Step 1: Run all tests**

Run: `bun test`
Expected: PASS

**Step 2: Run lint**

Run: `bun lint`
Expected: PASS

**Step 3: Verify no remaining inline avatar fallbacks**

Run a search for the old pattern to ensure completeness:
- Search for `avatarUrl ?` across all `.tsx` files
- Search for `displayName.charAt(0)` near avatar contexts
- Confirm zero remaining inline fallback patterns

**Step 4: Manual visual check**

Start the dev server with `bun dev` and verify:
- Own profile page (`/profile`) — initials avatar when no photo set
- Public profile page (`/profile/[username]`) — same
- Community page — user grid shows initials
- Leaderboard pages — rank cards show initials
- Cafe page sidebar/mobile — today's visitors show initials
- Activity feed — visitor/companion avatars show initials
- Review cards — author avatars show initials
- Follow list modal — follower avatars show initials
- Collections — author avatars show initials
- Search/companion selector — user avatars show initials
- All avatars with valid photos continue to display images correctly

**Step 5: Final commit (if any cleanup needed)**

```bash
git add -A
git commit -m "chore: final cleanup for themed avatar implementation"
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `utils/avatar.ts` | **NEW** — `getInitials()` and `getAvatarColor()` utilities |
| `utils/__tests__/avatar.test.ts` | **NEW** — tests for avatar utilities |
| `components/ui/UserAvatar.tsx` | **MODIFY** — themed initials fallback replaces `/icon.png` |
| `components/ui/__tests__/UserAvatar.test.tsx` | **MODIFY** — tests updated for new fallback |
| `components/social/FollowListModal.tsx` | **MODIFY** — remove 2 inline fallback blocks |
| `components/feed/ActivityFeedSection.tsx` | **MODIFY** — remove 3 inline fallback blocks |
| `components/collections/CollectionCard.tsx` | **MODIFY** — remove 1 inline fallback block |
| `components/community/ExpandableRankCard.tsx` | **MODIFY** — remove 2 inline fallback blocks |
| `components/community/MonthlyLeaderboard.tsx` | **MODIFY** — remove 1 inline fallback block |

## Additional Suggestions

1. **Accessibility:** The themed avatar uses `role="img"` and `aria-label` so screen readers announce the user's name, not the initials text.

2. **Future enhancement:** Consider adding `fallbackName` prop to select components that have access to `username` (not just `displayName`) for more unique colors when two users share similar display names.

3. **Dark mode:** The current approach uses white text on a saturated background. If dark mode is added later, the lightness value (45%) should be tested for contrast.

4. **Performance:** `getInitials` and `getAvatarColor` are pure functions with no side effects — they run synchronously on every render. If avatar lists grow very large (100+), consider memoization with `useMemo`, but for current usage this is unnecessary.
