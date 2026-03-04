# Web Haptics Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate the `web-haptics` library across all major user-facing features of the Grounds website, providing sensible, context-appropriate haptic feedback on mobile devices.

**Architecture:** A single shared `useHaptics` wrapper hook centralises the `useWebHaptics` React hook so all components import one abstraction. Haptics fire on meaningful interactions only — state-changing actions, confirmations, navigation decisions, and errors — never on passive renders or scrolling. The library gracefully degrades on unsupported devices via its built-in `isSupported` flag.

**Tech Stack:** `web-haptics` (npm: `web-haptics`), React hook `useWebHaptics` from `web-haptics/react`, `defaultPatterns` for named presets, Next.js App Router client components (`"use client"`), Bun as package manager.

---

## Pattern Reference (no import required — bundled in the hook)

| Pattern name | Feel | When to use |
|---|---|---|
| `"selection"` | Very light tick (8ms, 0.3) | Tab switch, filter toggle, option pick |
| `"light"` | Soft tap (15ms, 0.4) | Minor UI interaction, scroll snap |
| `"medium"` | Standard tap (25ms, 0.7) | Button press (default), open modal |
| `"heavy"` | Strong press (35ms, 1.0) | Destructive confirm, hard toggle |
| `"rigid"` | Sharp click (10ms, 1.0) | Instant confirmation, checkbox |
| `"soft"` | Muted thud (40ms, 0.5) | Close / dismiss |
| `"success"` | Double-bump (two medium pulses) | Save, check-in, submit success |
| `"warning"` | Two tapering bumps | Rate limit hit, form validation fail |
| `"error"` | Triple strong pulse | Network error, auth failure |
| `"nudge"` | Long + short (80+50ms) | Swipe reminder, empty state prompt |
| `"buzz"` | 1 s continuous | (avoid — too long) |

---

## Task 1: Install Package and Create Shared Hook

**Files:**
- Modify: `package.json` (via `bun add`)
- Create: `hooks/useHaptics.ts`

**Step 1: Install the package**

```bash
bun add web-haptics
```

Expected: `web-haptics` added to `dependencies` in `package.json`.

**Step 2: Create the shared hook**

Create `hooks/useHaptics.ts`:

```typescript
"use client"

import { useWebHaptics } from "web-haptics/react"
import type { defaultPatterns } from "web-haptics"

// Named preset type derived from the library
export type HapticPattern = keyof typeof defaultPatterns | "light" | "medium" | "heavy" | "rigid" | "soft" | "selection" | "nudge" | "success" | "warning" | "error"

/**
 * Thin wrapper around useWebHaptics.
 * Use this instead of importing from web-haptics directly.
 * Resolves to a no-op on unsupported devices automatically.
 */
export function useHaptics() {
    const { trigger, cancel, isSupported } = useWebHaptics()
    return { trigger, cancel, isSupported }
}
```

**Step 3: Verify TypeScript compiles**

```bash
bun build --no-minify 2>&1 | grep -E "error|Error" | head -20
```

Expected: no TypeScript errors referencing `hooks/useHaptics.ts`.

**Step 4: Commit**

```bash
git add hooks/useHaptics.ts package.json bun.lock
git commit -m "feat(haptics): install web-haptics and create shared useHaptics hook"
```

---

## Task 2: Landing Page Haptics

**Rationale:** The landing page is often the first touch point on mobile. Light interactions reward browsing without being intrusive.

**Files:**
- Modify: `components/landing/LandingHero.tsx`
- Modify: `components/checkin/HeroLocationCheckIn.tsx`
- Modify: `components/map/RandomCafeButton.tsx`
- Modify: `components/recent/RecentlyAddedSection.tsx` (if it has interactive buttons)

**Interaction map:**

| Element | Event | Pattern | Reasoning |
|---|---|---|---|
| "Nearby cafe" CTA link tap | `onClick` | `"light"` | Navigation intent, subtle confirmation |
| Featured cafe card tap | `onClick` | `"light"` | Card press feels physical |
| RandomCafeButton press | `onClick` | `"medium"` | Standard action button |
| Check-in button press | `onClick` | `"medium"` | Opening modal |
| Check-in success | after successful check-in | `"success"` | Rewarding action |
| Check-in error | on failure | `"error"` | Clear failure signal |

**Step 1: Add haptics to `LandingHero.tsx`**

At the top of the file, add the import after existing imports:
```typescript
import { useHaptics } from "@/hooks/useHaptics"
```

Inside the `LandingHero` component body (after the `useLandingLocation` call):
```typescript
const { trigger } = useHaptics()
```

For the featured cafe card link (`<MotionLink>` or `<Link>`), add `onClick`:
```tsx
onClick={() => trigger("light")}
```

For the nearby cafe CTA link, add the same `onClick={() => trigger("light")}`.

**Step 2: Add haptics to `RandomCafeButton.tsx`**

Read the file first to find the button's `onClick` handler, then add:
```typescript
import { useHaptics } from "@/hooks/useHaptics"
// inside component:
const { trigger } = useHaptics()
// on the button onClick:
onClick={() => { trigger("medium"); /* existing handler */ }}
```

**Step 3: Add haptics to `HeroLocationCheckIn.tsx`**

This component has a check-in button. Add haptic on button press and on result:
```typescript
import { useHaptics } from "@/hooks/useHaptics"
// inside component:
const { trigger } = useHaptics()

// On check-in button click (open modal or start check-in):
trigger("medium")

// On successful check-in callback/state:
trigger("success")

// On check-in error:
trigger("error")
```

**Step 4: Verify the dev server renders without errors**

```bash
bun dev 2>&1 | head -30
```

Expected: No runtime errors.

**Step 5: Commit**

```bash
git add components/landing/LandingHero.tsx components/checkin/HeroLocationCheckIn.tsx components/map/RandomCafeButton.tsx
git commit -m "feat(haptics): add landing page and check-in haptic feedback"
```

---

## Task 3: Cafes Page (Listing) Haptics

**Rationale:** The cafes listing is filter-heavy — selection haptics on each filter toggle make the UI feel tactile and confirm each choice.

**Files:**
- Modify: `components/cafe/CafesPageClient.tsx`

**Interaction map:**

| Element | Event | Pattern | Reasoning |
|---|---|---|---|
| Amenity filter toggle | `onClick` | `"selection"` | Micro-tick per toggle |
| Price / region / vibe filter | `onClick` | `"selection"` | Same — filter selection |
| "Sort" option pick | `onChange` / `onClick` | `"selection"` | Choosing a sort |
| Search input focus | `onFocus` | `"light"` | Subtle UI entry |
| "Clear filters" button | `onClick` | `"soft"` | Soft dismiss/reset |
| "Load more" / infinite scroll trigger | on intersection | `"light"` | Content loaded |
| Filter panel open/close | `onClick` | `"medium"` / `"soft"` | Open vs close distinction |
| Cafe card tap | `onClick` on card link | `"light"` | Navigation |

**Step 1: Read the file to understand filter and button locations**

Read `components/cafe/CafesPageClient.tsx` to identify exact handler names.

**Step 2: Add `useHaptics` import and hook call**

```typescript
import { useHaptics } from "@/hooks/useHaptics"
// inside component:
const { trigger } = useHaptics()
```

**Step 3: Add haptic to filter toggles**

For each amenity toggle checkbox/button `onClick` handler (likely a `toggleFilter` or `setFilters` call):
```typescript
const handleFilterToggle = (key: string, value: string) => {
    trigger("selection")
    // existing filter logic
}
```

**Step 4: Add haptic to sort change**

```typescript
const handleSortChange = (value: string) => {
    trigger("selection")
    // existing sort logic
}
```

**Step 5: Add haptic to filter panel open/close**

```typescript
const toggleFilterPanel = () => {
    trigger(isFilterOpen ? "soft" : "medium")
    setIsFilterOpen(prev => !prev)
}
```

**Step 6: Add haptic to "Clear filters"**

```typescript
const clearFilters = () => {
    trigger("soft")
    // existing clear logic
}
```

**Step 7: Add haptic to infinite scroll trigger**

In the `IntersectionObserver` callback that triggers loading more cafes:
```typescript
if (isIntersecting && hasMore && !isLoading) {
    trigger("light")
    loadMore()
}
```

**Step 8: Add haptic to cafe card navigation**

Each `motion.a` cafe card: `onClick={() => trigger("light")}`.

**Step 9: Commit**

```bash
git add components/cafe/CafesPageClient.tsx
git commit -m "feat(haptics): add cafes listing page filter and navigation haptics"
```

---

## Task 4: Cafe Details Haptics

**Rationale:** Cafe details has the richest interaction surface — tabs, reviews, sidebars, modals. Haptics reinforce each intentional action.

**Files:**
- Modify: `components/cafe/CafeDetails.tsx`
- Modify: `components/cafe/CafeTabs.tsx`
- Modify: `components/reviews/StarRating.tsx`
- Modify: `components/reviews/ReviewModal.tsx`

**Interaction map:**

| Element | Event | Pattern | Reasoning |
|---|---|---|---|
| Tab switch (About/Details/Reviews/Menu) | `onClick` | `"selection"` | Tab navigation |
| "Write a Review" button | `onClick` | `"medium"` | Opening modal |
| Star rating selection (each star) | `onPointerDown` or `onClick` | `"rigid"` | Sharp physical star tap |
| Review submit success | after server action returns | `"success"` | Confirm saved |
| Review submit error | on failure | `"error"` | Clear failure |
| Like / save cafe (heart/bookmark) | `onClick` | `"medium"` / toggle → `"rigid"` | Toggle confirmation |
| Like → unlike | `onClick` | `"soft"` | Undoing an action |
| "Check in" button | `onClick` | `"medium"` | Modal open |
| "Add to collection" button | `onClick` | `"medium"` | Modal open |
| Lightbox open (image tap) | `onClick` | `"light"` | Gentle open |
| Lightbox close / dismiss | `onClick` | `"soft"` | Dismiss |
| "Claim cafe" button | `onClick` | `"medium"` | Significant action |
| "Report cafe" button | `onClick` | `"light"` | Minor — reporting shouldn't feel punchy |
| Copy share link | `onClick` | `"rigid"` | Sharp "copied" confirmation |

**Step 1: Add `useHaptics` to `CafeTabs.tsx`**

```typescript
import { useHaptics } from "@/hooks/useHaptics"
// inside component:
const { trigger } = useHaptics()
// on each tab button onClick:
onClick={() => { trigger("selection"); setActiveTab(tab) }}
```

**Step 2: Add haptics to `StarRating.tsx`**

Each individual star should pulse on pointer contact:
```typescript
import { useHaptics } from "@/hooks/useHaptics"
const { trigger } = useHaptics()
// on star onPointerDown (or onClick if simpler):
onPointerDown={() => trigger("rigid")}
```

Note: Use `onPointerDown` for immediacy — it fires before `onClick`.

**Step 3: Add haptics to `ReviewModal.tsx`**

```typescript
import { useHaptics } from "@/hooks/useHaptics"
const { trigger } = useHaptics()

// On modal open (already triggered from CafeDetails — skip, or add here if modal manages its own open state)

// On submit button click:
const handleSubmit = async () => {
    // existing validation
    trigger("medium") // indicate submission starting
    const result = await submitReview(...)
    if (result.success) {
        trigger("success")
    } else {
        trigger("error")
    }
}
```

**Step 4: Add haptics to `CafeDetails.tsx` for like/save/check-in/collection**

Read `CafeDetails.tsx` and `useCafeActions` hook. The hook provides `handleLike`, `handleSave`, etc. Add haptic calls inside each handler.

For like toggle:
```typescript
const handleLikeWithHaptic = async () => {
    trigger(liked ? "soft" : "medium")
    await handleLike()
}
```

For save toggle:
```typescript
const handleSaveWithHaptic = async () => {
    trigger(saved ? "soft" : "rigid")
    await handleSave()
}
```

For check-in button (opens modal):
```typescript
onClick={() => { trigger("medium"); openCheckInModal() }}
```

For copy share link:
```typescript
const handleCopy = () => {
    navigator.clipboard.writeText(url)
    trigger("rigid")
    setCopied(true)
}
```

**Step 5: Commit**

```bash
git add components/cafe/CafeDetails.tsx components/cafe/CafeTabs.tsx components/reviews/StarRating.tsx components/reviews/ReviewModal.tsx
git commit -m "feat(haptics): add cafe details, tabs, star rating, and review modal haptics"
```

---

## Task 5: Map Page Haptics

**Rationale:** Map interactions are inherently physical. Tapping a marker, finding your location, and navigating to a cafe detail all benefit from confirmatory haptics.

**Files:**
- Modify: `components/map/CafeMap.tsx`
- Modify: `components/map/RandomCafeButton.tsx` (already done in Task 2 — skip if committed)

**Important constraint:** Leaflet event handlers run in a non-React context. The haptics must be triggered via a ref-stored function or a globally accessible singleton. Use the vanilla `WebHaptics` class for map marker clicks.

**Interaction map:**

| Element | Event | Pattern | Reasoning |
|---|---|---|---|
| Marker tap (open popup) | Leaflet `click` event | `"light"` | Selecting a point |
| "Get my location" GPS button | `onClick` | `"medium"` | Initiating geolocation |
| GPS success (location found) | on `geolocation.getCurrentPosition` success | `"success"` | Location acquired |
| GPS error | on `geolocation.getCurrentPosition` error | `"error"` | Clear failure |
| Popup "View cafe" link tap | `onClick` | `"light"` | Navigation |
| Cluster tap (expand) | Leaflet cluster `click` | `"light"` | Cluster expand |

**Step 1: Add vanilla WebHaptics instance to `CafeMap.tsx`**

Since Leaflet event handlers are outside React lifecycle, create a module-level singleton:

```typescript
import { WebHaptics } from "web-haptics"

// Module-level singleton — safe to instantiate outside component
const haptics = typeof window !== "undefined" ? new WebHaptics() : null
```

**Step 2: Trigger on marker click**

Inside the Leaflet marker creation or event binding (wherever `eventHandlers={{ click: ... }}` is set in react-leaflet):
```typescript
eventHandlers={{
    click: () => {
        haptics?.trigger("light")
        // existing popup logic
    }
}}
```

**Step 3: Trigger on GPS button**

```typescript
const handleLocate = () => {
    haptics?.trigger("medium")
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            haptics?.trigger("success")
            setUserLocation([pos.coords.latitude, pos.coords.longitude])
        },
        () => {
            haptics?.trigger("error")
        }
    )
}
```

**Step 4: Trigger on "View cafe" popup link**

In the popup JSX, add `onClick` to the link:
```tsx
<a href={`/cafes/${cafe.slug}`} onClick={() => haptics?.trigger("light")}>
    View Cafe
</a>
```

**Step 5: Commit**

```bash
git add components/map/CafeMap.tsx
git commit -m "feat(haptics): add interactive map marker, GPS, and popup haptics"
```

---

## Task 6: Submit a Cafe Haptics

**Rationale:** Form submissions are high-effort interactions. Haptic confirmation at each step boundary and on final submit makes the multi-step form feel responsive.

**Files:**
- Modify: `components/submit/CafeSubmissionForm.tsx`
- Modify: `components/submit/AmenityToggles.tsx`
- Modify: `components/submit/LocationPickerInner.tsx`

**Interaction map:**

| Element | Event | Pattern | Reasoning |
|---|---|---|---|
| "Next step" button | `onClick` | `"medium"` | Step advance |
| "Previous step" button | `onClick` | `"soft"` | Step back / dismiss |
| Amenity toggle on | `onClick` (toggle to checked) | `"rigid"` | Checkbox-style sharp click |
| Amenity toggle off | `onClick` (toggle to unchecked) | `"selection"` | Lighter deselect |
| Map pin placement | Leaflet `click` on map | `"medium"` | Placing a marker |
| Form validation error | on failed validation | `"warning"` | Two-bump warning |
| Final submit press | `onClick` on submit button | `"medium"` | Starting submission |
| Submission success | after server action returns success | `"success"` | Celebratory |
| Submission error | after server action returns error | `"error"` | Clear failure |

**Step 1: Add `useHaptics` to `CafeSubmissionForm.tsx`**

```typescript
import { useHaptics } from "@/hooks/useHaptics"
const { trigger } = useHaptics()
```

**Step 2: Wrap step navigation handlers**

```typescript
const goToNextStep = () => {
    const isValid = validateCurrentStep()
    if (!isValid) {
        trigger("warning")
        return
    }
    trigger("medium")
    setCurrentStep(prev => prev + 1)
}

const goToPrevStep = () => {
    trigger("soft")
    setCurrentStep(prev => prev - 1)
}
```

**Step 3: Wrap final submit handler**

```typescript
const handleSubmit = async () => {
    trigger("medium")
    const result = await submitCafe(formData)
    if (result.success) {
        trigger("success")
        // redirect or show success state
    } else {
        trigger("error")
        setError(result.error)
    }
}
```

**Step 4: Add haptics to `AmenityToggles.tsx`**

```typescript
import { useHaptics } from "@/hooks/useHaptics"
const { trigger } = useHaptics()

const handleToggle = (amenity: string, isCurrentlyOn: boolean) => {
    trigger(isCurrentlyOn ? "selection" : "rigid")
    onToggle(amenity)
}
```

**Step 5: Add map pin placement haptic to `LocationPickerInner.tsx`**

This is a Leaflet component — use the vanilla singleton pattern (same as Task 5):
```typescript
import { WebHaptics } from "web-haptics"
const haptics = typeof window !== "undefined" ? new WebHaptics() : null

// In the Leaflet map click handler:
useMapEvents({
    click: (e) => {
        haptics?.trigger("medium")
        onLocationSelect(e.latlng)
    }
})
```

**Step 6: Commit**

```bash
git add components/submit/CafeSubmissionForm.tsx components/submit/AmenityToggles.tsx components/submit/LocationPickerInner.tsx
git commit -m "feat(haptics): add submit-a-cafe form step navigation and field haptics"
```

---

## Task 7: Public and Private Profile Haptics

**Rationale:** Profile pages have follow/unfollow, badge viewing, passport stamps, and avatar actions. Each should feel physically responsive.

**Files:**
- Modify: `components/social/FollowButton.tsx`
- Modify: `components/profile/Profile.tsx`
- Modify: `components/profile/PublicProfile.tsx`
- Modify: `components/profile/Passport.tsx`

**Interaction map:**

| Element | Event | Pattern | Reasoning |
|---|---|---|---|
| Follow button press | `onClick` (not yet following) | `"medium"` | Initiating a follow |
| Unfollow button press | `onClick` (currently following) | `"soft"` | Gentle unfollow |
| Avatar upload click | `onClick` | `"light"` | Opening picker |
| Bio save/edit confirm | `onClick` save button | `"success"` | Confirm saved bio |
| Passport stamp tap (cafe stamp) | `onClick` | `"rigid"` | Sharp stamp feel |
| Badge card tap | `onClick` | `"light"` | Viewing a badge |
| "Add to wishlist" on passport | `onClick` | `"medium"` | Adding to list |
| Tab switch (passport / activity / etc.) | `onClick` | `"selection"` | Tab navigation |
| Share profile link copy | `onClick` | `"rigid"` | Copied confirmation |
| Settings save | `onClick` submit | `"success"` | Confirm saved settings |

**Step 1: Add haptics to `FollowButton.tsx`**

```typescript
import { useHaptics } from "@/hooks/useHaptics"

// Inside component:
const { trigger } = useHaptics()

const handleClick = useCallback(async () => {
    trigger(isFollowing ? "soft" : "medium")
    // existing follow/unfollow logic unchanged
    setIsLoading(true)
    ...
}, [isFollowing, targetUserId, onFollowChange, trigger])
```

**Step 2: Add haptics to `Passport.tsx`**

Each visited cafe stamp card should fire on tap:
```typescript
import { useHaptics } from "@/hooks/useHaptics"
const { trigger } = useHaptics()

// On passport stamp card onClick:
onClick={() => trigger("rigid")}

// On "add to wishlist" button:
onClick={() => { trigger("medium"); handleAddWishlist(cafeId) }}
```

**Step 3: Add haptics to profile tab switches in `Profile.tsx` and `PublicProfile.tsx`**

Find each tab button and add:
```typescript
import { useHaptics } from "@/hooks/useHaptics"
const { trigger } = useHaptics()

// On tab button onClick:
onClick={() => { trigger("selection"); setActiveTab(tab) }}
```

**Step 4: Add haptics for bio edit/save in `Profile.tsx`**

```typescript
// On "Edit" bio button:
onClick={() => { trigger("light"); setIsEditingBio(true) }}

// On "Save" bio button (after async save):
const handleSaveBio = async () => {
    trigger("medium")
    const result = await saveBio(bio)
    if (result.success) trigger("success")
    else trigger("error")
}
```

**Step 5: Commit**

```bash
git add components/social/FollowButton.tsx components/profile/Profile.tsx components/profile/PublicProfile.tsx components/profile/Passport.tsx
git commit -m "feat(haptics): add follow, passport, and profile tab haptic feedback"
```

---

## Task 8: Chat Interface Haptics

**Rationale:** Chat is a high-frequency interaction surface. Opening, sending messages, and receiving errors all benefit from precise haptic signals.

**Files:**
- Modify: `components/chat/ChatWidget.tsx`
- Modify: `components/chat/ChatWindow.tsx`
- Modify: `components/chat/ChatCafeCarousel.tsx`

**Interaction map:**

| Element | Event | Pattern | Reasoning |
|---|---|---|---|
| Chat bubble button open | `onClick` (open) | `"medium"` | Opening a modal-style panel |
| Chat bubble button close | `onClick` (close) | `"soft"` | Dismissing |
| Send message button | `onClick` | `"rigid"` | Sharp send confirmation |
| Message sent (network ack) | after SSE stream begins | `"light"` | Stream started |
| Rate limit hit | when rate limit error shown | `"warning"` | Two-bump warning |
| Network / stream error | on SSE error | `"error"` | Clear failure |
| Cafe card in carousel tap | `onClick` | `"light"` | Card navigation |
| "Create crawl" from AI draft | `onClick` | `"medium"` | Significant action |
| Suggestion chip tap | `onClick` | `"selection"` | Quick pick |

**Step 1: Add haptics to `ChatWidget.tsx`**

```typescript
import { useHaptics } from "@/hooks/useHaptics"
const { trigger } = useHaptics()

// On chat bubble button onClick:
const handleToggle = () => {
    trigger(isOpen ? "soft" : "medium")
    setIsOpen(prev => !prev)
}
```

**Step 2: Add haptics to `ChatWindow.tsx`**

```typescript
import { useHaptics } from "@/hooks/useHaptics"
const { trigger } = useHaptics()

// On send button click:
const handleSend = async () => {
    if (!message.trim()) return
    trigger("rigid")
    // existing send logic
    const stream = await fetch("/api/chat/stream", ...)
    // On stream read success (first chunk):
    // trigger("light") — inside the stream reading loop on first chunk
}

// On rate limit error:
useEffect(() => {
    if (isRateLimited) trigger("warning")
}, [isRateLimited])

// On stream error:
// trigger("error") inside the catch block of the stream reader
```

**Step 3: Add haptics to `ChatCafeCarousel.tsx`**

```typescript
import { useHaptics } from "@/hooks/useHaptics"
const { trigger } = useHaptics()

// On each cafe card link onClick:
onClick={() => trigger("light")}
```

**Step 4: Add haptic to suggestion chip taps (if present in `ChatWindow.tsx`)**

```typescript
// On suggestion chip onClick:
onClick={() => { trigger("selection"); setSuggestion(chip) }}
```

**Step 5: Commit**

```bash
git add components/chat/ChatWidget.tsx components/chat/ChatWindow.tsx components/chat/ChatCafeCarousel.tsx
git commit -m "feat(haptics): add chat open/close, send, and error haptic feedback"
```

---

## Task 9: Cafe Crawls Haptics

**Rationale:** Crawls are a community feature with saves, likes, creation, and editing. These are intentional actions that deserve satisfying feedback.

**Files:**
- Modify: `components/crawls/CrawlActions.tsx`
- Modify: `components/crawls/CrawlEditor.tsx`
- Modify: `components/crawls/CrawlView.tsx`
- Modify: `components/crawls/CrawlCard.tsx`

**Interaction map:**

| Element | Event | Pattern | Reasoning |
|---|---|---|---|
| Save crawl (bookmark) | `onClick` toggle to saved | `"medium"` | Saving an item |
| Unsave crawl | `onClick` toggle to unsaved | `"soft"` | Undoing |
| Like crawl (heart) | `onClick` toggle to liked | `"medium"` | Liking |
| Unlike crawl | `onClick` toggle to unliked | `"soft"` | Undoing |
| Share / copy link | `onClick` | `"rigid"` | Sharp copy confirmation |
| "Add cafe" to crawl (in editor) | `onClick` | `"rigid"` | Discrete add action |
| "Remove cafe" from crawl (in editor) | `onClick` | `"soft"` | Soft remove |
| Crawl editor publish / save | `onClick` submit | `"success"` | Confirm published |
| Crawl editor validation error | on failed validation | `"warning"` | Warning signal |
| Crawl editor network error | on failed save | `"error"` | Error signal |
| Crawl card tap (navigate to detail) | `onClick` | `"light"` | Card navigation |
| Cafe stop in CrawlView tap | `onClick` | `"light"` | Viewing a stop |

**Step 1: Add haptics to `CrawlActions.tsx`**

Read the file to identify existing `handleSave`, `handleLike`, and `handleShare` functions. Then:

```typescript
import { useHaptics } from "@/hooks/useHaptics"
const { trigger } = useHaptics()

const handleSave = async () => {
    if (!user || isSaving) return
    trigger(saved ? "soft" : "medium")
    setIsSaving(true)
    try {
        const result = await toggleSaveCafeCrawl(crawlId)
        if (result.success) {
            setSaved(result.saved)
            setSavesCount(prev => result.saved ? prev + 1 : prev - 1)
        }
    } catch (error) {
        console.error("Failed to toggle save:", error)
    } finally {
        setIsSaving(false)
    }
}

const handleLike = async () => {
    if (!user || isLiking) return
    trigger(liked ? "soft" : "medium")
    setIsLiking(true)
    // existing like logic
}

// On share/copy:
const handleShare = () => {
    navigator.clipboard.writeText(`${window.location.origin}/community/crawls/${slug}`)
    trigger("rigid")
    setCopied(true)
}
```

**Step 2: Add haptics to `CrawlEditor.tsx`**

Read file to find form submission and cafe add/remove handlers:

```typescript
import { useHaptics } from "@/hooks/useHaptics"
const { trigger } = useHaptics()

// Add cafe to crawl:
const handleAddCafe = (cafe) => {
    trigger("rigid")
    setSelectedCafes(prev => [...prev, cafe])
}

// Remove cafe from crawl:
const handleRemoveCafe = (cafeId) => {
    trigger("soft")
    setSelectedCafes(prev => prev.filter(c => c.id !== cafeId))
}

// On save/publish:
const handlePublish = async () => {
    const isValid = validateForm()
    if (!isValid) {
        trigger("warning")
        return
    }
    trigger("medium")
    const result = await saveCrawl(formData)
    if (result.success) {
        trigger("success")
        router.push(`/community/crawls/${result.slug}`)
    } else {
        trigger("error")
        setError(result.error)
    }
}
```

**Step 3: Add haptics to `CrawlCard.tsx`**

```typescript
import { useHaptics } from "@/hooks/useHaptics"
const { trigger } = useHaptics()

// On card click / navigate:
onClick={() => trigger("light")}
```

**Step 4: Add haptics to cafe stops in `CrawlView.tsx`**

```typescript
import { useHaptics } from "@/hooks/useHaptics"
const { trigger } = useHaptics()

// On each cafe stop card link tap:
onClick={() => trigger("light")}
```

**Step 5: Commit**

```bash
git add components/crawls/CrawlActions.tsx components/crawls/CrawlEditor.tsx components/crawls/CrawlView.tsx components/crawls/CrawlCard.tsx
git commit -m "feat(haptics): add crawl save, like, share, editor, and navigation haptics"
```

---

## Task 10: Global Polish — Navbar, Modals, and Search

**Rationale:** Navigation, search, and modals are cross-cutting. Consistent haptics here tie the whole experience together.

**Files:**
- Modify: `components/layout/Navbar.tsx`
- Modify: `components/search/SearchModal.tsx`
- Modify: `components/search/SearchTrigger.tsx`
- Modify: `components/modal/ImageLightbox.tsx`
- Modify: `components/modal/ClaimCafeModal.tsx`
- Modify: `components/modal/ReportCafeModal.tsx`

**Interaction map:**

| Element | Event | Pattern | Reasoning |
|---|---|---|---|
| Navbar hamburger / mobile menu open | `onClick` | `"medium"` | Opening nav panel |
| Navbar hamburger / mobile menu close | `onClick` | `"soft"` | Closing |
| Navbar nav link tap | `onClick` | `"light"` | Navigation |
| Search trigger button | `onClick` | `"medium"` | Opening search |
| Search result tap | `onClick` | `"light"` | Navigation |
| Search close | `onClick` / Escape | `"soft"` | Dismiss |
| Lightbox next/prev image | `onClick` | `"selection"` | Tick per swipe |
| Lightbox close | `onClick` | `"soft"` | Dismiss |
| Claim cafe submit | `onClick` | `"medium"` + on success `"success"` | Significant action |
| Report submit | `onClick` | `"medium"` + on success `"success"` | Action confirmation |

**Step 1: Read `Navbar.tsx` and identify mobile menu toggle and nav link handlers**

Add:
```typescript
import { useHaptics } from "@/hooks/useHaptics"
const { trigger } = useHaptics()

// Mobile menu toggle:
const toggleMenu = () => {
    trigger(isMenuOpen ? "soft" : "medium")
    setIsMenuOpen(prev => !prev)
}

// Each nav link onClick:
onClick={() => trigger("light")}
```

**Step 2: Read `SearchTrigger.tsx` and `SearchModal.tsx`**

`SearchTrigger`:
```typescript
import { useHaptics } from "@/hooks/useHaptics"
const { trigger } = useHaptics()
onClick={() => { trigger("medium"); openSearch() }}
```

`SearchModal` close:
```typescript
import { useHaptics } from "@/hooks/useHaptics"
const { trigger } = useHaptics()
const handleClose = () => { trigger("soft"); onClose() }

// Each result tap:
onClick={() => trigger("light")}
```

**Step 3: Add haptics to `ImageLightbox.tsx`**

```typescript
import { useHaptics } from "@/hooks/useHaptics"
const { trigger } = useHaptics()

// Next / Prev:
const goNext = () => { trigger("selection"); setIndex(i => i + 1) }
const goPrev = () => { trigger("selection"); setIndex(i => i - 1) }

// Close:
const handleClose = () => { trigger("soft"); onClose() }
```

**Step 4: Add haptics to `ClaimCafeModal.tsx` and `ReportCafeModal.tsx`**

Both follow the same pattern:
```typescript
import { useHaptics } from "@/hooks/useHaptics"
const { trigger } = useHaptics()

// On submit:
const handleSubmit = async () => {
    trigger("medium")
    const result = await submitAction(...)
    if (result.success) trigger("success")
    else trigger("error")
}
```

**Step 5: Commit**

```bash
git add components/layout/Navbar.tsx components/search/SearchModal.tsx components/search/SearchTrigger.tsx components/modal/ImageLightbox.tsx components/modal/ClaimCafeModal.tsx components/modal/ReportCafeModal.tsx
git commit -m "feat(haptics): add navbar, search, lightbox, and modal haptic feedback"
```

---

## Task 11: Additional Improvements and Edge Cases

**Rationale:** Several interactions across the codebase deserve haptic attention that fall outside the primary feature areas.

**Files:**
- Modify: `components/checkin/GroupCheckInModal.tsx`
- Modify: `components/collections/AddToCollectionModal.tsx`
- Modify: `components/badges/BadgeCard.tsx`
- Modify: `components/cafe/CafeSidebar.tsx` (copy coordinates, social links)

**Interaction map:**

| Element | Event | Pattern | Reasoning |
|---|---|---|---|
| Group check-in: select companion | `onClick` | `"selection"` | Tick per person added |
| Group check-in: confirm | `onClick` | `"medium"` + on success `"success"` | Confirm action |
| Add to collection: select collection | `onClick` | `"selection"` | Choosing from list |
| Add to collection: confirm | `onClick` | `"success"` | Saved confirmation |
| Badge card tap (earned badge) | `onClick` | `"rigid"` | Satisfying stamp-like feedback |
| Sidebar: copy address/coordinates | `onClick` | `"rigid"` | Sharp copy feedback |
| Sidebar: social link tap | `onClick` | `"light"` | External link navigation |

**Step 1: Add haptics to `GroupCheckInModal.tsx`**

Read file, then:
```typescript
import { useHaptics } from "@/hooks/useHaptics"
const { trigger } = useHaptics()

// Select companion:
const handleSelectCompanion = (id: string) => {
    trigger("selection")
    toggleCompanion(id)
}

// Confirm check-in:
const handleConfirm = async () => {
    trigger("medium")
    const result = await confirmGroupCheckIn(...)
    if (result.success) trigger("success")
    else trigger("error")
}
```

**Step 2: Add haptics to `AddToCollectionModal.tsx`**

```typescript
import { useHaptics } from "@/hooks/useHaptics"
const { trigger } = useHaptics()

// Select collection:
onClick={() => { trigger("selection"); selectCollection(id) }}

// Confirm add:
const handleAdd = async () => {
    trigger("medium")
    const result = await addToCollection(...)
    if (result.success) trigger("success")
    else trigger("error")
}
```

**Step 3: Add haptics to `BadgeCard.tsx`**

```typescript
import { useHaptics } from "@/hooks/useHaptics"
const { trigger } = useHaptics()

// On card click (if interactive):
onClick={() => trigger("rigid")}
```

**Step 4: Add haptics to `CafeSidebar.tsx` copy and social link actions**

Find the copy button for the address or map coordinates (likely a clipboard copy):
```typescript
import { useHaptics } from "@/hooks/useHaptics"
const { trigger } = useHaptics()

const handleCopyAddress = () => {
    navigator.clipboard.writeText(address)
    trigger("rigid")
    setCopied(true)
}

// Social link onClick:
onClick={() => trigger("light")}
```

**Step 5: Commit**

```bash
git add components/checkin/GroupCheckInModal.tsx components/collections/AddToCollectionModal.tsx components/badges/BadgeCard.tsx components/cafe/CafeSidebar.tsx
git commit -m "feat(haptics): add check-in, collections, badges, and sidebar haptic feedback"
```

---

## Task 12: Final Verification and Cleanup

**Step 1: Run lint**

```bash
bun lint
```

Expected: 0 errors. Fix any ESLint errors before continuing.

**Step 2: Run all tests**

```bash
bun test
```

Expected: All existing tests pass. The haptics calls are side-effects that do not affect test output since `navigator.vibrate` is not mocked — tests will simply not trigger vibration.

If any tests fail related to missing `web-haptics` in test environment, add a mock in the relevant `__tests__` setup:
```typescript
// At top of failing test file:
vi.mock("web-haptics/react", () => ({
    useWebHaptics: () => ({
        trigger: vi.fn(),
        cancel: vi.fn(),
        isSupported: false,
    })
}))
```

**Step 3: Build check**

```bash
bun build 2>&1 | tail -20
```

Expected: Successful build with no errors.

**Step 4: Manual smoke test on mobile (or browser DevTools mobile emulation)**

Open DevTools → Device Toolbar → set to a mobile device. Verify:
- [ ] Cafe card tap on `/cafes` fires a haptic (check DevTools console if debug mode is on)
- [ ] Tab switch on cafe details fires a tick
- [ ] Star rating tap fires a rigid pulse
- [ ] Follow button fires medium/soft depending on state
- [ ] Chat open fires medium, close fires soft
- [ ] Crawl save fires medium, unsave fires soft

To enable debug mode during testing, pass `{ debug: true }` to the `useWebHaptics` call in `useHaptics.ts` temporarily:
```typescript
const { trigger, cancel, isSupported } = useWebHaptics({ debug: true })
```
This shows a visual indicator in the corner and plays audio for each haptic. Remove `debug: true` before final commit.

**Step 5: Remove debug mode if it was added**

```typescript
// hooks/useHaptics.ts — ensure debug is not set
const { trigger, cancel, isSupported } = useWebHaptics()
```

**Step 6: Final commit**

```bash
git add hooks/useHaptics.ts
git commit -m "feat(haptics): complete web haptics integration across all major features"
```

---

## Haptics Design Decisions and Rationale

### What was NOT haptic-ified (intentionally)

| Element | Reason |
|---|---|
| Passive scrolling | Would be overwhelming and distracting |
| Map pan/zoom | Continuous gesture — haptic would fire non-stop |
| Hover states | Desktop-only; haptics are mobile-first |
| Loading states (spinners, skeletons) | No user action triggered them |
| Toast/notification appearance | Passive feedback; notifications handle their own urgency |
| Admin/manage pages | Power users on desktop; haptics less relevant |

### Pattern choice principles

1. **`"selection"` for toggles and picks** — the lightest perceptible tick that confirms "I registered your tap" without feel of consequence.
2. **`"light"` for navigation** — slightly stronger than selection, acknowledges the navigation intent.
3. **`"medium"` for opening modals and primary actions** — standard "button pressed" feel.
4. **`"rigid"` for copy, add, checkbox-style confirms** — sharp physicality mirrors the discrete, binary nature of the action.
5. **`"soft"` for close and undo** — gentler feel mirrors the reversing/relaxing nature of the action.
6. **`"success"` after async confirm** — fired after the server action resolves, not before, so it truly signals completion.
7. **`"warning"` for validation and rate limit** — two-bump pattern mirrors "wait, not quite right".
8. **`"error"` for hard failures** — triple pulse is unmistakably different from success.

### SSR / Leaflet compatibility

Leaflet components cannot use React hooks (they run outside the React tree). Those components use the vanilla `new WebHaptics()` singleton with a `typeof window !== "undefined"` guard to prevent SSR errors.

All other components use the `useHaptics()` React hook which handles lifecycle cleanup automatically.
