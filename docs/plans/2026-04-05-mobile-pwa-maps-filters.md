# Mobile Polish: PWA Install, Map Z-Index, Search & Filters

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Fix mobile UI issues (map z-index bleed-through, search centering), add a PWA install experience with step-by-step tutorial for iOS/Android, audit all filters for correctness, and establish a systematic z-index scale across the app.

**Architecture:** Introduce a centralized z-index token system via CSS custom properties in `globals.css`. Fix map markers (z-index 1000 !important) to stay below app UI. Create a reusable `PWAInstallBanner` component that detects standalone mode and prompts mobile users. Build a `/install` page with platform-specific instructions. Audit and fix all filter toggles on both the map page and cafes listing page. Bump version to `2026.14.0`.

**Tech Stack:** Next.js App Router, Tailwind CSS v4, motion/react (Framer Motion), Leaflet, TypeScript, Bun.

---

## Files Inventory

| File | Action | Purpose |
|---|---|---|
| `app/globals.css` | Create/Modify | Add z-index CSS custom properties |
| `app/map.css` | Modify | Fix map marker z-index values (1000 !important → proper values) |
| `app/map/page.tsx` | Modify | Fix responsive padding, add overflow-hidden |
| `app/install/page.tsx` | **Create** | New PWA install tutorial page |
| `app/layout.tsx` | Modify | Add apple-mobile-web-app meta tags |
| `app/manifest.ts` | Modify | Add 512x512 icon, ensure proper PWA config |
| `components/map/CafeMap.tsx` | Modify | Apply z-index token |
| `components/map/CafeMapWrapper.tsx` | Modify | Apply z-index token, add tooltip for icon-only mobile buttons |
| `components/search/SearchModal.tsx` | Modify | Fix mobile vertical centering, apply z-index token |
| `components/layout/Navbar.tsx` | Modify | Apply z-index token, add explicit z-index to mobile menu, add FollowRequestsDropdown to mobile |
| `components/chat/ChatWidget.tsx` | Modify | Apply z-index token |
| `components/modal/ClaimCafeModal.tsx` | Modify | Apply z-index token |
| `components/modal/ImageLightbox.tsx` | Modify | Apply z-index token |
| `components/modal/ReportCafeModal.tsx` | Modify | Apply z-index token |
| `components/layout/LayoutWrapper.tsx` | Modify | Include PWAInstallBanner |
| `components/pwa/PWAInstallBanner.tsx` | **Create** | Dismissible mobile banner prompting install |
| `components/pwa/index.ts` | **Create** | Barrel export |
| `components/cafe/CafesPageClient.tsx` | Modify | Fix filter audit issues |
| `utils/hooks/usePWAInstall.ts` | **Create** | Hook for detecting standalone mode and install eligibility |
| `package.json` | Modify | Bump version to 2026.14.0 |

---

## Z-Index Scale (to be implemented in Task 1)

| Token | Value | Usage |
|---|---|---|
| `--z-map` | `10` | Map container, map controls |
| `--z-map-marker` | `20` | Map markers, tooltips |
| `--z-navbar` | `40` | Navbar, sticky headers |
| `--z-overlay` | `50` | Modals, search modal, lightbox |
| `--z-chat` | `55` | Chat widget (above modals) |
| `--z-progress` | `9999` | Navigation progress bar |

---

## Task 1: Establish Z-Index Scale & Fix Map Bleed-Through

**Why:** Map markers at `z-index: 1000 !important` render above all application UI (navbar, modals, search). On mobile, when a modal opens over the map page, markers visually punch through. Additionally, all application components compete at `z-50` with no hierarchy. The follow requests notification dropdown (`FollowRequestsDropdown`) is also missing from the mobile menu entirely. This task establishes a proper z-index system, fixes the bleed-through, and adds notifications to mobile.

**Files:**
- Modify: `app/globals.css` (or create if using Tailwind v4 CSS-first config)
- Modify: `app/map.css`
- Modify: `app/map/page.tsx`
- Modify: `components/map/CafeMap.tsx`
- Modify: `components/map/CafeMapWrapper.tsx`
- Modify: `components/search/SearchModal.tsx`
- Modify: `components/layout/Navbar.tsx`
- Modify: `components/chat/ChatWidget.tsx`
- Modify: `components/modal/ClaimCafeModal.tsx`
- Modify: `components/modal/ImageLightbox.tsx`
- Modify: `components/modal/ReportCafeModal.tsx`
- Modify: `components/cafe/CafesPageClient.tsx`

- [ ] **Step 1: Read `app/globals.css` to understand current custom properties**

Open `app/globals.css` and read the full file to find where Tailwind v4 theme customizations live.

- [ ] **Step 2: Add z-index CSS custom properties to `app/globals.css`**

Add the following token definitions in the `@theme` block (Tailwind v4 convention):

```css
@theme {
  /* Z-Index Scale */
  --z-map: 10;
  --z-map-marker: 20;
  --z-navbar: 40;
  --z-overlay: 50;
  --z-chat: 55;
  --z-progress: 9999;
}
```

- [ ] **Step 3: Fix map marker z-index in `app/map.css`**

Change `.cafe-marker-premium` from `z-index: 1000 !important` to `z-index: var(--z-map-marker) !important` (line 107).

Change `.crawl-marker-active` from `z-index: 1000 !important` to `z-index: var(--z-map-marker) !important` (line 254).

Change `.crawl-marker-tooltip` from `z-index: 100` to `z-index: var(--z-map-marker)` (line 182).

- [ ] **Step 4: Fix map page responsive padding in `app/map/page.tsx`**

Change `p-6` to `p-2 sm:p-4 md:p-6` and add `overflow-hidden` to the `<main>` element:

```tsx
<main className='w-full p-2 sm:p-4 md:p-6 h-[calc(100svh-3rem)] flex flex-col overflow-hidden'>
```

- [ ] **Step 5: Update `CafeMap.tsx` z-index**

Line 215: Change `className='h-full w-full z-10'` to `className='h-full w-full' style={{ zIndex: 'var(--z-map)' }}` (or keep as Tailwind class if tokens are available).

Since Tailwind v4 `@theme` tokens generate utilities, we can use `z-[var(--z-map)]`:

```tsx
className='h-full w-full z-[var(--z-map)]'
```

- [ ] **Step 6: Update `CafeMapWrapper.tsx` z-index**

Line 59: Change `z-50` to `z-[var(--z-overlay)]` on the filter buttons container:

```tsx
<div className='absolute top-4 right-4 z-[var(--z-overlay)] flex flex-col gap-2'>
```

Also add a tooltip to each icon-only mobile button for discoverability. Each filter button should have a `title` attribute (native tooltip) matching the label:

```tsx
<Button title="24 Hours" ...>
<Button title="Halal Certified" ...>
<Button title="Show Chains" ...>
```

- [ ] **Step 7: Update `SearchModal.tsx` z-index**

Lines 94, 101: Change both `z-50` to `z-[var(--z-overlay)]`:

```tsx
className="fixed inset-0 bg-text/20 z-[var(--z-overlay)] backdrop-blur-sm"
className="fixed ... z-[var(--z-overlay)] px-4"
```

- [ ] **Step 8: Update `Navbar.tsx` z-index**

Line 71: Change `z-50` to `z-[var(--z-navbar)]` on `<nav>`.
Line 77: Change `z-50` to `z-[var(--z-navbar)]` on the logo/nav container.
Line 324: Change `z-50` to `z-[var(--z-navbar)]` on the mobile search+toggle div.
Line 379 (mobile menu): Add explicit `z-[var(--z-navbar)]` to the mobile menu `motion.div`:

```tsx
className='md:hidden absolute inset-0 bg-background pt-4 pb-10 px-6 flex flex-col h-max top-full left-0 right-0 z-[var(--z-navbar)]'
```

- [ ] **Step 9: Update `ChatWidget.tsx` z-index**

Line 61: Change `z-50` to `z-[var(--z-chat)]`:

```tsx
className='fixed bottom-4 right-4 z-[var(--z-chat)] flex flex-col items-end'
```

- [ ] **Step 10: Update modal components z-index**

`ClaimCafeModal.tsx` line 136: Change `z-50` to `z-[var(--z-overlay)]` on backdrop.
`ClaimCafeModal.tsx` line 144: Change `z-50` to `z-[var(--z-overlay)]` on content.
`ImageLightbox.tsx` line 87: Change `z-50` to `z-[var(--z-overlay)]`.
`ReportCafeModal.tsx` line 67: Change `z-50` to `z-[var(--z-overlay)]`.

- [ ] **Step 11: Update `CafesPageClient.tsx` z-index**

Line 557: Change `z-50` to `z-[var(--z-overlay)]` on the restore notice toast.

- [ ] **Step 11b: Add FollowRequestsDropdown to mobile menu**

The `FollowRequestsDropdown` (bell icon for follow request notifications) currently only renders in the desktop auth section (`hidden md:flex` on line 318). It is completely absent from the mobile menu (lines 371-557). Add it to the mobile menu so logged-in users can access notifications on mobile.

In `Navbar.tsx`, locate the mobile menu section (around line 482 where `{user && (` renders the profile link). Add the `FollowRequestsDropdown` before or after the profile link:

```tsx
{user && (
    <motion.li
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 + routes.length * 0.1 }}
    >
        <FollowRequestsDropdown className='text-3xl' />
    </motion.li>
)}
```

Note: The `FollowRequestsDropdown` currently renders as a popover-style dropdown. On mobile, this may need adjustment — either it should render inline within the mobile menu, or it should close the mobile menu and open as a separate overlay. Check the component's `className` prop to see if it supports mobile styling. If not, wrap it in a `Link` to a dedicated `/notifications` page, or render a simplified mobile variant.

Also update the `FollowRequestsDropdown` import if needed (it's already imported on line 19).

- [ ] **Step 12: Run lint to verify**

Run: `bun lint`
Expected: No errors.

- [ ] **Step 13: Manual verification**

Open the map page on mobile (or using browser dev tools). Open the search modal and verify map markers do NOT bleed through the modal backdrop. Open the mobile navbar and verify the same. Verify the chat widget appears above modals. Verify the bell/notification icon appears in the mobile menu for logged-in users.

- [ ] **Step 14: Commit**

```bash
git add app/globals.css app/map.css app/map/page.tsx components/map/CafeMap.tsx components/map/CafeMapWrapper.tsx components/search/SearchModal.tsx components/layout/Navbar.tsx components/chat/ChatWidget.tsx components/modal/ClaimCafeModal.tsx components/modal/ImageLightbox.tsx components/modal/ReportCafeModal.tsx components/cafe/CafesPageClient.tsx
git commit -m "fix: establish z-index scale and fix map marker bleed-through on mobile"
```

---

## Task 2: Fix Search Modal Mobile Centering

**Why:** The search modal uses `top-[20%]` which is a static vertical offset. On mobile, especially with the on-screen keyboard, this can feel off-center or get pushed off-screen. The modal should adapt its vertical position on mobile to feel properly centered.

**Files:**
- Modify: `components/search/SearchModal.tsx`

- [ ] **Step 1: Read `components/search/SearchModal.tsx` fully**

Read the complete component to understand the current positioning, animation, and layout structure.

- [ ] **Step 2: Fix mobile vertical positioning**

Change the modal container from a static `top-[20%]` to a responsive approach:

```tsx
// Current (line ~101):
className="fixed left-1/2 top-[20%] -translate-x-1/2 w-full max-w-xl z-[var(--z-overlay)] px-4"

// New:
className="fixed left-1/2 top-[15%] sm:top-[20%] -translate-x-1/2 w-full max-w-xl z-[var(--z-overlay)] px-4"
```

The `top-[15%]` on mobile gives more vertical space for results below, accounting for smaller viewports and the keyboard. On `sm:` and above, revert to the original `20%`.

- [ ] **Step 3: Add max-height constraint for mobile**

Ensure the modal does not overflow on small screens. Check the results container (line ~113) and verify it has `max-h-[60vh]`. If it has `max-h-[60vh]`, increase the mobile constraint to use more of the available space:

```tsx
// Current:
className="... max-h-[60vh] ..."

// New:
className="... max-h-[50vh] sm:max-h-[60vh] ..."
```

This ensures the modal leaves breathing room at the bottom on mobile where the keyboard may appear.

- [ ] **Step 4: Add safe area padding for mobile**

Add `pb-[env(safe-area-inset-bottom)]` to the modal's outer container to account for home indicator on iOS devices:

```tsx
className="fixed left-1/2 top-[15%] sm:top-[20%] -translate-x-1/2 w-full max-w-xl z-[var(--z-overlay)] px-4 pb-[env(safe-area-inset-bottom)]"
```

- [ ] **Step 5: Run lint**

Run: `bun lint`
Expected: No errors.

- [ ] **Step 6: Manual verification**

Open the search modal on mobile viewport (375px width, 667px height). Verify:
- Modal is visually centered/well-positioned vertically
- Results list does not overflow the viewport
- Keyboard hints are visible or properly hidden on mobile
- Modal does not extend below the visible area

- [ ] **Step 7: Commit**

```bash
git add components/search/SearchModal.tsx
git commit -m "fix: improve search modal mobile positioning and viewport handling"
```

---

## Task 3: PWA Install Banner & Detection Hook

**Why:** The site has a PWA manifest but no install prompt or detection logic. Mobile users don't know they can add the app to their home screen. This task creates a hook to detect whether the user is on mobile, not already in standalone mode, and eligible for install — plus a dismissible banner that prompts them with a link to the tutorial page.

**Files:**
- Create: `utils/hooks/usePWAInstall.ts`
- Create: `components/pwa/PWAInstallBanner.tsx`
- Create: `components/pwa/index.ts`
- Modify: `components/layout/LayoutWrapper.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create `utils/hooks/usePWAInstall.ts`**

```ts
"use client"

import { useState, useEffect, useCallback } from "react"

interface PWAInstallState {
    isStandalone: boolean
    isMobile: boolean
    canInstall: boolean
    dismissed: boolean
    dismiss: () => void
}

const DISMISS_KEY = "pwa-install-dismissed"

export function usePWAInstall(): PWAInstallState {
    const [isStandalone, setIsStandalone] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const [dismissed, setDismissed] = useState(true)

    useEffect(() => {
        const mq = window.matchMedia("(display-mode: standalone)")
        setIsStandalone(mq.matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true)

        const ua = navigator.userAgent.toLowerCase()
        setIsMobile(/android|iphone|ipad|ipod/.test(ua))

        const stored = localStorage.getItem(DISMISS_KEY)
        setDismissed(stored === "true")
    }, [])

    const dismiss = useCallback(() => {
        localStorage.setItem(DISMISS_KEY, "true")
        setDismissed(true)
    }, [])

    return {
        isStandalone,
        isMobile,
        canInstall: isMobile && !isStandalone && !dismissed,
        dismissed,
        dismiss,
    }
}
```

- [ ] **Step 2: Create `components/pwa/PWAInstallBanner.tsx`**

```tsx
"use client"

import Link from "next/link"
import { motion, AnimatePresence } from "motion/react"
import { Download, X } from "lucide-react"
import { usePWAInstall } from "@/utils/hooks/usePWAInstall"

export function PWAInstallBanner() {
    const { canInstall, dismiss } = usePWAInstall()

    return (
        <AnimatePresence>
            {canInstall && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className='fixed bottom-0 left-0 right-0 z-[var(--z-overlay)] bg-primary text-white px-4 py-3 flex items-center gap-3 safe-area-bottom'
                    style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
                >
                    <Download className='h-5 w-5 shrink-0' />
                    <div className='flex-1 min-w-0'>
                        <p className='text-sm font-medium'>Install Grounds</p>
                        <p className='text-xs opacity-80'>Add to your home screen for the best experience</p>
                    </div>
                    <Link
                        href='/install'
                        className='text-sm font-medium underline underline-offset-2 shrink-0'
                        onClick={dismiss}
                    >
                        How?
                    </Link>
                    <button
                        onClick={dismiss}
                        className='p-1 hover:bg-white/20 rounded-full shrink-0'
                        aria-label='Dismiss install prompt'
                    >
                        <X className='h-4 w-4' />
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
```

- [ ] **Step 3: Create `components/pwa/index.ts`**

```ts
export { PWAInstallBanner } from "./PWAInstallBanner"
```

- [ ] **Step 4: Add `PWAInstallBanner` to `LayoutWrapper.tsx`**

Import and render the banner after the `ChatWidget`:

```tsx
import { PWAInstallBanner } from "@/components/pwa"

// In the return JSX, after ChatWidget:
{!hideChat && <ChatWidget isEnabled={isChatEnabled} />}
<PWAInstallBanner />
```

- [ ] **Step 5: Add Apple mobile web app meta tags to `app/layout.tsx`**

In the `<head>` section (or metadata export), add:

```tsx
// In the metadata export:
export const metadata: Metadata = {
    // ... existing metadata
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "Grounds",
    },
    formatDetection: {
        telephone: false,
    },
}
```

Also ensure these existing viewport settings include `viewport-fit=cover` for safe area support:

```tsx
export const viewport: Viewport = {
    // ... existing viewport config
    viewportFit: "cover",
}
```

- [ ] **Step 6: Verify manifest includes required icons**

Read `app/manifest.ts` and verify it includes at least a 192x192 and 512x512 icon. If 512x512 is missing, add it. Check if `public/android-icon-512x512.png` exists — if not, note it as a TODO or use the existing 192x192 as a fallback entry.

- [ ] **Step 7: Run lint**

Run: `bun lint`
Expected: No errors.

- [ ] **Step 8: Manual verification**

Open the site on a mobile device (or simulate mobile in dev tools). Ensure:
- The banner does NOT appear when already in standalone mode
- The banner does NOT appear on desktop
- The "How?" link navigates to `/install`
- Dismissing the banner persists across page navigations (localStorage)
- The banner reappears after clearing localStorage

- [ ] **Step 9: Commit**

```bash
git add utils/hooks/usePWAInstall.ts components/pwa/PWAInstallBanner.tsx components/pwa/index.ts components/layout/LayoutWrapper.tsx app/layout.tsx
git commit -m "feat: add PWA install banner with mobile detection and dismiss"
```

---

## Task 4: PWA Install Tutorial Page

**Why:** The install banner links to `/install` — this page provides step-by-step instructions for adding Grounds to the home screen on iOS (Safari) and Android (Chrome). Each platform gets its own tabbed section with numbered steps and simple inline SVG icons representing the UI elements users need to tap (share button, "Add to Home Screen", three-dot menu, "Install app").

**Files:**
- Create: `app/install/page.tsx`
- Create: `components/pwa/InstallTutorial.tsx` (client component for platform tab switching)

- [ ] **Step 1: Create the page metadata and layout in `app/install/page.tsx`**

```tsx
import { Metadata } from "next"
import { InstallTutorial } from "@/components/pwa/InstallTutorial"

export const metadata: Metadata = {
    title: "Install Grounds App",
    description: "Add Grounds to your home screen for quick access to the Philippines' best cafes.",
}

export default function InstallPage() {
    return (
        <main className='min-h-screen bg-background'>
            <div className='max-w-lg mx-auto px-4 py-12'>
                <h1 className='text-3xl font-bold mb-2'>Install Grounds</h1>
                <p className='text-text/60 mb-8'>
                    Add Grounds to your home screen for a native app experience — fast loading, offline access, and no browser UI.
                </p>
                <InstallTutorial />
            </div>
        </main>
    )
}
```

- [ ] **Step 2: Create `components/pwa/InstallTutorial.tsx`**

This is a `"use client"` component with a platform toggle (iOS / Android) and step-by-step instructions for each.

```tsx
"use client"

import { useState } from "react"
import { motion } from "motion/react"
import { Apple, Smartphone } from "lucide-react"
import { cn } from "@/utils/cn"

type Platform = "ios" | "android"

const iosSteps = [
    {
        number: 1,
        title: "Open in Safari",
        description: "Make sure you're viewing this page in Safari. PWA installation only works from Safari on iOS.",
    },
    {
        number: 2,
        title: "Tap the Share button",
        description: "Tap the share icon (square with an arrow pointing up) at the bottom of the screen.",
    },
    {
        number: 3,
        title: 'Scroll and tap "Add to Home Screen"',
        description: "Scroll down in the share menu and tap \"Add to Home Screen\".",
    },
    {
        number: 4,
        title: "Confirm",
        description: "Tap \"Add\" in the top-right corner. Grounds will appear on your home screen.",
    },
]

const androidSteps = [
    {
        number: 1,
        title: "Open in Chrome",
        description: "Make sure you're viewing this page in Chrome (or another supported browser) on your Android device.",
    },
    {
        number: 2,
        title: "Tap the menu",
        description: "Tap the three-dot menu icon in the top-right corner of the browser.",
    },
    {
        number: 3,
        title: 'Tap "Install app" or "Add to Home Screen"',
        description: "Look for \"Install app\" or \"Add to Home Screen\" in the menu and tap it.",
    },
    {
        number: 4,
        title: "Confirm",
        description: "Tap \"Install\" in the prompt. Grounds will be added to your home screen and app drawer.",
    },
]

export function InstallTutorial() {
    const [platform, setPlatform] = useState<Platform>("ios")
    const steps = platform === "ios" ? iosSteps : androidSteps

    return (
        <div>
            {/* Platform Toggle */}
            <div className='flex gap-2 mb-8'>
                <button
                    onClick={() => setPlatform("ios")}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors",
                        platform === "ios"
                            ? "bg-primary text-white"
                            : "bg-surface text-text/60 hover:bg-surface-hover"
                    )}
                >
                    <Apple className='h-4 w-4' />
                    iPhone / iPad
                </button>
                <button
                    onClick={() => setPlatform("android")}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors",
                        platform === "android"
                            ? "bg-primary text-white"
                            : "bg-surface text-text/60 hover:bg-surface-hover"
                    )}
                >
                    <Smartphone className='h-4 w-4' />
                    Android
                </button>
            </div>

            {/* Steps */}
            <motion.ol
                key={platform}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className='space-y-6'
            >
                {steps.map((step) => (
                    <li key={step.number} className='flex gap-4'>
                        <div className='shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold'>
                            {step.number}
                        </div>
                        <div>
                            <h2 className='font-semibold mb-1'>{step.title}</h2>
                            <p className='text-sm text-text/60'>{step.description}</p>
                        </div>
                    </li>
                ))}
            </motion.ol>

            {/* Note */}
            <div className='mt-10 p-4 rounded-xl bg-surface text-sm text-text/60'>
                <p className='font-medium text-text mb-1'>Already installed?</p>
                <p>
                    If you already have Grounds on your home screen, you can safely close this page.
                    Open the app from your home screen for the best experience.
                </p>
            </div>
        </div>
    )
}
```

- [ ] **Step 3: Verify the `cn` utility import works**

Confirm `@/utils/cn` exists (it does — per AGENTS.md). Verify the import resolves.

- [ ] **Step 4: Verify `lucide-react` icons are available**

Check `package.json` for `lucide-react` dependency. The existing codebase uses `lucide-react` (e.g., `X`, `Download` in the banner task). Confirm `Apple` and `Smartphone` icons exist in lucide-react — if not, use alternative icons like `MonitorSmartphone` or `TabletSmartphone`.

- [ ] **Step 5: Run lint**

Run: `bun lint`
Expected: No errors.

- [ ] **Step 6: Manual verification**

- Navigate to `/install` on desktop — verify page renders with iOS tab selected by default
- Click "Android" tab — verify steps animate and update
- Navigate to `/install` on mobile — verify page is responsive and readable
- Verify the banner's "How?" link correctly navigates to this page

- [ ] **Step 7: Commit**

```bash
git add app/install/page.tsx components/pwa/InstallTutorial.tsx
git commit -m "feat: add /install page with iOS and Android PWA tutorial steps"
```

---

## Task 5: Filter Audit, Fixes, and Version Bump

**Why:** The site has two filter systems — map page filters (3 toggles: 24h, halal, chains) and cafes listing page filters (15+ toggles, price, style, region, tags, sort). We need to verify every filter correctly queries the database, displays the right UI state, and works on mobile. We also need to bump the app version.

**Audit Scope:**

| Filter | Location | Type | Audit Check |
|---|---|---|---|
| 24 Hours | Map + Cafes page | Toggle | Verifies `operating_hours` / `is_24_7` field |
| Halal Certified | Map + Cafes page | Toggle | Verifies `is_halal_certified` field |
| Show Chains | Map + Cafes page | Toggle | Verifies `is_chain` field — note: map uses `!includeChains` logic (hides chains by default), cafes page uses `include_chains` |
| WiFi | Cafes page | Toggle | Verifies `has_wifi` field |
| Smoking | Cafes page | Toggle | Verifies `has_smoking` field |
| Sockets | Cafes page | Toggle | Verifies `has_sockets` field |
| Parking | Cafes page | Toggle | Verifies `has_parking` field |
| AC | Cafes page | Toggle | Verifies `has_aircon` field |
| Pet Friendly | Cafes page | Toggle | Verifies `is_pet_friendly` field |
| Outdoor Seating | Cafes page | Toggle | Verifies `has_outdoor_seating` field |
| Indoor Seating | Cafes page | Toggle | Verifies `has_indoor_seating` field |
| Restroom | Cafes page | Toggle | Verifies `has_restroom` field |
| Bidet | Cafes page | Toggle | Verifies `has_bidet` field |
| Non-Dairy | Cafes page | Toggle | Verifies `has_non_dairy` field |
| Decaf | Cafes page | Toggle | Verifies `has_decaf` field |
| Work Friendly | Cafes page | Toggle | Verifies `is_work_friendly` field |
| Open Now | Cafes page | Toggle | Verifies current time vs operating hours |
| Price Level | Cafes page | Radio (3) | Verifies `price_level` field |
| Coffee Style | Cafes page | Radio (3) | Verifies `coffee_style` field |
| Region | Cafes page | Dropdown | Verifies `region` field |
| Vibe Tags | Cafes page | Chip toggles | Verifies `tags` array field |
| Near Me | Cafes page | Toggle | Uses geolocation + distance sort |
| Sort | Cafes page | Dropdown | Sorts by rating, reviews, or recommended |

**Files:**
- Read: `app/api/actions/cafe.ts` (server-side filter query logic)
- Read: `app/api/actions/map.ts` (map bounds query with filters)
- Read: `utils/map/client-filter.ts` (client-side map filter)
- Read: `components/cafe/CafesPageClient.tsx` (cafes page filter UI and state)
- Read: `components/map/CafeMapWrapper.tsx` (map filter UI and state)
- Read: `db/schema/` (verify field names match filter expectations)
- Modify: `package.json` (version bump)

- [ ] **Step 1: Audit server-side filter query in `app/api/actions/cafe.ts`**

Read the `getCafes` or `searchCafes` server action that the cafes page calls with filter params. Verify:
- Every filter param from `buildFilterParams` is handled in the query
- Boolean filters use `eq(field, true)` correctly
- `price_level`, `coffee_style`, `region` are matched with `eq()`
- `tags` filter uses array containment (`= ANY(...)`, `@>`, or equivalent Drizzle syntax)
- `open_now` filter computes current time against `operating_hours`
- `near_me` uses a distance calculation or bounding box
- `sortBy` options map to correct `ORDER BY` clauses
- Missing filters are not applied (undefined params are skipped)

Document any mismatches between the UI filter names and the DB column names.

- [ ] **Step 2: Audit map client-side filter in `utils/map/client-filter.ts`**

Verify the three map filters work correctly:
- `includeChains`: When `false`, filters out cafes where `is_chain === true`. Confirm the data shape includes `is_chain`.
- `is24_7`: Reads `operating_hours` array, checks `is_24_hours` on today's entry. Confirm `todayKey` format matches `operating_hours[].day` values.
- `isHalalCertified`: Checks `is_halal_certified`. Confirm the field exists on the cafe type.

- [ ] **Step 3: Audit map filter state in `CafeMapWrapper.tsx`**

Verify:
- Default state: chains hidden (`includeChains: false`), 24h off, halal off
- Toggle behavior correctly inverts or sets the filter state
- `filteredCafes` useMemo depends on all three filter states + `cafes` prop
- `todayKey` is computed correctly via `useMemo` or `useState`

- [ ] **Step 4: Audit cafes page filter state in `CafesPageClient.tsx`**

Verify:
- `INITIAL_FILTERS` matches the server action's expected params
- `buildFilterParams` correctly maps UI state to API params (note: `is24_7` uses `|| undefined`, `is_halal_certified` maps to `isHalalCertified` — camelCase discrepancy)
- Filter count badge correctly counts active filters
- "Clear all" resets all filters to initial state
- Each filter toggle triggers a new server fetch via `startTransition`
- `open_now` filter has a time-based check that works correctly across time zones

- [ ] **Step 5: Check DB schema alignment**

Read `db/schema/` cafe schema. Verify every filter field referenced in the UI exists in the schema:
- `has_wifi`, `has_smoking`, `has_sockets`, `has_parking`, `has_aircon`
- `is_pet_friendly`, `has_outdoor_seating`, `has_indoor_seating`
- `has_restroom`, `has_bidet`, `has_non_dairy`, `has_decaf`
- `is_work_friendly`, `is_24_7`, `is_halal_certified`, `is_chain`
- `price_level`, `coffee_style`, `region`, `tags`, `operating_hours`
- `lat`, `lng` (for near me distance calc)

If any field is missing from the schema, note it as a bug.

- [ ] **Step 6: Fix any identified issues**

Based on Steps 1-5, fix any mismatches found:
- If a filter param name doesn't match between UI and server, fix the mapping
- If a DB field is missing, add a migration
- If `open_now` logic is incorrect, fix the time comparison
- If `near_me` doesn't properly handle permission denial, add fallback UI

- [ ] **Step 7: Mobile filter UX audit**

On mobile viewport, verify:
- Filter button shows icon-only with `title` tooltip (fixed in Task 1)
- Cafes page filter panel wraps correctly and does not cause horizontal scroll
- Region dropdown is usable on mobile (not cut off)
- Vibe tag chips wrap within the container
- Active filter count badge is visible and accurate

- [ ] **Step 8: Bump version in `package.json`**

Change line 3 of `package.json` from:
```json
"version": "2026.13.1"
```
to:
```json
"version": "2026.14.0"
```

This is a feature release (minor bump) since we're adding the PWA install experience and fixing mobile issues.

- [ ] **Step 9: Run lint**

Run: `bun lint`
Expected: No errors.

- [ ] **Step 10: Run tests**

Run: `bun test`
Expected: All tests pass. If any filter-related tests exist, verify they still pass after any fixes.

- [ ] **Step 11: Final build verification**

Run: `bun build`
Expected: Build succeeds with no errors.

- [ ] **Step 12: Commit**

```bash
git add package.json
git commit -m "chore: bump version to 2026.14.0"
```

If filter fixes were applied, commit them separately first:

```bash
git add <fixed files>
git commit -m "fix: correct filter parameter mapping and schema alignment"
```

---

## Summary

| Task | What | Files Changed |
|---|---|---|
| 1 | Z-index scale + map bleed-through fix | 12 files |
| 2 | Search modal mobile centering | 1 file |
| 3 | PWA install banner + hook | 5 files (3 new) |
| 4 | PWA install tutorial page | 2 files (new) |
| 5 | Filter audit + fixes + version bump | 1+ files |

**Total new files:** 5 (`usePWAInstall.ts`, `PWAInstallBanner.tsx`, `pwa/index.ts`, `install/page.tsx`, `InstallTutorial.tsx`)
**Total modified files:** ~14
**Version:** `2026.13.1` → `2026.14.0`

## Additional Suggestions

1. **Service Worker (future):** Consider adding a service worker with Workbox for offline caching of the map tiles and cafe data. The manifest exists but without a SW, there's no offline support.

2. **Expired announcement banner:** The `AnnouncementBanner` has an `expiresAt` date of `2026-02-28` which is already past. Check if the banner should be updated or removed.

3. **Z-index CSS custom properties:** After this plan, all new components should use `z-[var(--z-*)]` tokens instead of arbitrary `z-50` values. Consider adding a lint rule or PR template note.

4. **Map filter icons on mobile:** With only icon buttons (labels hidden), consider adding a subtle visual indicator for active filters (e.g., a colored dot or filled state) so users know which filters are engaged.

5. **PWA icon sizes:** The manifest currently lacks a 512x512 icon which is recommended for Android splash screens. Consider generating one from the existing `icon.png`.
