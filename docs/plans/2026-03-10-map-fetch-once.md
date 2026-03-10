# Map Page — Fetch-Once Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current bounds-triggered refetch loop with a single "fetch all published cafes once on load" strategy, eliminating the visual blinking/flicker caused by repeated `getCafesInBounds` calls on every `moveend` event.

**Architecture:** Fetch the full set of published cafes once on the server (SSR) and pass them down as props. On the client, apply filters (chains, 24/7, halal) entirely in memory — no further network calls on pan/zoom. The `BoundsHandler` / `moveend` → `getCafesInBounds` cycle is removed. Markers for cafes outside the current viewport are naturally hidden by Leaflet + `MarkerClusterGroup` without needing a bounds query.

**Tech Stack:** Next.js App Router (Server Components + Server Actions), React `useState`/`useMemo`, Drizzle ORM, Leaflet + react-leaflet, react-leaflet-cluster, Bun test runner.

---

## Root Cause

Every Leaflet `moveend` event (pan, zoom, popup open/close, programmatic centering) fires `onBoundsChange` → `handleBoundsChange` → `getCafesInBounds` (a round-trip server action) → `setCafes(newCafes)`. React re-renders all markers, causing the visible "blinking". Even `map.locate()` inside `LocationMarker` triggers `moveend` (via `setView: true`), causing an immediate refetch on first load.

Filter toggles also each make a separate server round-trip, though that is acceptable if the full set is already in memory.

---

## Files Involved

| File | Action |
|---|---|
| `app/map/page.tsx` | Modify — increase SSR fetch limit; pass full list |
| `app/api/actions/cafe.ts` | Modify — expose `getAllPublishedCafes()` helper, or reuse `getAllCafes` |
| `app/api/actions/map.ts` | Modify — keep `getCafesInBounds` for potential future use, but it will no longer be called by the wrapper |
| `components/map/CafeMapWrapper.tsx` | Major refactor — remove bounds fetching, add client-side filter logic with `useMemo` |
| `components/map/CafeMap.tsx` | Refactor — remove `onBoundsChange` prop + `BoundsHandler` component; keep `LocationMarker` (fix `setView` side-effect); remove `mapKey` force re-render hack |

---

## Task 1 — Add `getAllPublishedCafes` server action

**Why:** The current `getAllCafes` in `cafe.ts` takes `page`/`limit` pagination params and defaults to excluding chains. We need a single call that reliably fetches _all_ published, non-hidden-gem cafes — including chains (since chain filtering will now be done client-side).

**Files:**
- Modify: `app/api/actions/cafe.ts`

**Step 1: Read the current `getAllCafes` function**

Open `app/api/actions/cafe.ts` and locate `getAllCafes`. Note the column selection list and the `mapCafeToSnakeCase` helper used there.

**Step 2: Add `getAllPublishedCafes` after the existing functions**

```ts
// app/api/actions/cafe.ts  (add after existing exports)
export async function getAllPublishedCafes(): Promise<CafeWithRatings[]> {
    const results = await db
        .select({
            id: cafes.id,
            name: cafes.name,
            slug: cafes.slug,
            thumbnail: cafes.thumbnail,
            gallery: cafes.gallery,
            description: cafes.description,
            addressDisplay: cafes.addressDisplay,
            area: cafes.area,
            cityMunicipality: cafes.cityMunicipality,
            province: cafes.province,
            region: cafes.region,
            lat: cafes.lat,
            lng: cafes.lng,
            priceLevel: cafes.priceLevel,
            coffeeStyle: cafes.coffeeStyle,
            membershipTier: cafes.membershipTier,
            roaster: cafes.roaster,
            brewMethods: cafes.brewMethods,
            specialty: cafes.specialty,
            milkOptions: cafes.milkOptions,
            tags: cafes.tags,
            operatingHours: cafes.operatingHours,
            socials: cafes.socials,
            phone: cafes.phone,
            email: cafes.email,
            websiteUrl: cafes.websiteUrl,
            paymentMethods: cafes.paymentMethods,
            hasWifi: cafes.hasWifi,
            hasSmoking: cafes.hasSmoking,
            hasSockets: cafes.hasSockets,
            hasAircon: cafes.hasAircon,
            hasParking: cafes.hasParking,
            hasOutdoorSeating: cafes.hasOutdoorSeating,
            hasIndoorSeating: cafes.hasIndoorSeating,
            hasRestroom: cafes.hasRestroom,
            hasBidet: cafes.hasBidet,
            hasNonDairy: cafes.hasNonDairy,
            hasDecaf: cafes.hasDecaf,
            isPetFriendly: cafes.isPetFriendly,
            isWorkFriendly: cafes.isWorkFriendly,
            servesFood: cafes.servesFood,
            isActive: cafes.isActive,
            isPublished: cafes.isPublished,
            isVerified: cafes.isVerified,
            isClaimed: cafes.isClaimed,
            isHiddenGem: cafes.isHiddenGem,
            findingHint: cafes.findingHint,
            isChain: cafes.isChain,
            isHalalCertified: cafes.isHalalCertified,
            strawType: cafes.strawType,
            strawTypeOther: cafes.strawTypeOther,
            ownerIds: cafes.ownerIds,
            contributorId: cafes.contributorId,
            featuredUntil: cafes.featuredUntil,
            createdAt: cafes.createdAt,
            updatedAt: cafes.updatedAt,
            averageRating: cafeRatingStats.averageRating,
            totalReviews: cafeRatingStats.totalReviews,
        })
        .from(cafes)
        .leftJoin(cafeRatingStats, eq(cafes.id, cafeRatingStats.cafeId))
        .where(
            and(
                eq(cafes.isPublished, true),
                eq(cafes.isHiddenGem, false),
            )
        )
        .orderBy(desc(cafes.membershipTier), desc(cafes.createdAt))

    return results.map(mapCafeToSnakeCase) as CafeWithRatings[]
}
```

> **Note:** Include chains in the result set (`isChain` filter is omitted here). Client-side filtering will handle chain exclusion. This means we fetch once but can toggle chains without a network call.

**Step 3: Verify imports at the top of `cafe.ts`**

Make sure `desc` is imported from `drizzle-orm` and `cafeRatingStats` is imported from `@/db/schema`. Add them if missing.

**Step 4: Run the linter**

```bash
bun lint
```

Expected: no new errors related to `cafe.ts`.

---

## Task 2 — Update map page to use `getAllPublishedCafes`

**Files:**
- Modify: `app/map/page.tsx`

**Step 1: Replace `getAllCafes` call with `getAllPublishedCafes`**

```ts
// app/map/page.tsx
import { getAllPublishedCafes } from "@/app/api/actions/cafe"
import CafeMapWrapper from "@/components/map/CafeMapWrapper"
import { CafeWithRatings } from "@/utils/types/extra"

export const dynamic = "force-dynamic"

export default async function MapPage() {
    const cafes = await getAllPublishedCafes() as CafeWithRatings[]
    return (
        <main className='w-full p-6 h-[calc(100svh-3rem)] flex flex-col'>
            <CafeMapWrapper cafes={cafes} />
        </main>
    )
}
```

**Step 2: Verify the build compiles**

```bash
bun build
```

Expected: build succeeds (or only pre-existing warnings, no new errors).

---

## Task 3 — Add `getPHTime` client-compatible utility for 24/7 filter

**Context:** The existing `is_24_7` filter in `getCafesInBounds` calls `getCurrentDayKey()` which uses `getPHTime()`. Since filtering is now client-side, we need a pure utility function (no server imports) that returns the current PH day key. Confirm where `getPHTime` lives and if it can be called on the client.

**Files:**
- Read: `utils/featured.ts` (or wherever `getPHTime` is defined)

**Step 1: Check if `getPHTime` is safe to call on the client**

Read the file. If it only uses `new Date()` math (no `"use server"` directive, no DB imports), it is already safe. No change needed — just import it directly in the wrapper.

If `getPHTime` is server-only, copy only the date calculation into a new `utils/time.ts`:

```ts
// utils/time.ts  (only create if getPHTime is server-only)
export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"

export function getPHDayKey(): DayKey {
    // PH is UTC+8
    const phDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }))
    const days: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
    return days[phDate.getDay()]
}
```

---

## Task 4 — Refactor `CafeMapWrapper` to in-memory filtering

**This is the core change.** Remove all `getCafesInBounds` calls, remove `lastBoundsRef`, and replace the `handleBoundsChange` callback with a `useMemo`-derived `filteredCafes`.

**Files:**
- Modify: `components/map/CafeMapWrapper.tsx`

**Step 1: Replace the entire file content**

```tsx
"use client"

import { useHaptics } from "@/hooks/useHaptics"
import { CafeWithRatings } from "@/utils/types/extra"
import dynamic from "next/dynamic"
import { useState, useMemo } from "react"
import { Store, Clock12 } from "lucide-react"
// Import the PH day key helper (use getPHDayKey from utils/time if created, 
// otherwise import getPHTime from @/utils/featured and derive the key here)
import { getPHDayKey } from "@/utils/time"   // adjust import if getPHTime was already client-safe

const CafeMap = dynamic(() => import("@/components/map/CafeMap"), {
    ssr: false,
    loading: () => (
        <div className='w-full h-full min-h-[500px] flex items-center justify-center bg-secondary/20'>
            <p className='text-text/50 font-serif'>Loading map...</p>
        </div>
    ),
})

interface CafeMapWrapperProps {
    cafes: CafeWithRatings[]
}

export default function CafeMapWrapper({ cafes }: CafeMapWrapperProps) {
    const { trigger } = useHaptics()
    const [includeChains, setIncludeChains] = useState(false)
    const [is24_7, setIs24_7] = useState(false)
    const [isHalalCertified, setIsHalalCertified] = useState(false)

    // Derive the current PH day once per render (filters are applied client-side)
    const todayKey = useMemo(() => getPHDayKey(), [])

    // Apply all active filters purely in memory — no network calls
    const filteredCafes = useMemo(() => {
        return cafes.filter((cafe) => {
            // Chain filter: exclude chains unless toggled on
            if (!includeChains && cafe.is_chain === true) return false

            // 24/7 filter: check operating_hours for today's entry with is_24_hours === true
            if (is24_7) {
                const hours = cafe.operating_hours
                if (!Array.isArray(hours)) return false
                const todayEntry = hours.find(
                    (h: { day: string; is_24_hours?: boolean }) => h.day === todayKey
                )
                if (!todayEntry?.is_24_hours) return false
            }

            // Halal filter
            if (isHalalCertified && !cafe.is_halal_certified) return false

            return true
        })
    }, [cafes, includeChains, is24_7, isHalalCertified, todayKey])

    const toggleChains = () => {
        trigger("selection")
        setIncludeChains((prev) => !prev)
    }

    const toggle24_7 = () => {
        trigger("selection")
        setIs24_7((prev) => !prev)
    }

    const toggleHalalCertified = () => {
        trigger("selection")
        setIsHalalCertified((prev) => !prev)
    }

    return (
        <div className='relative w-full h-full'>
            <CafeMap cafes={filteredCafes} />

            {/* Filter Buttons */}
            <div className='absolute top-4 right-4 z-50 flex flex-col gap-2'>
                <button
                    onClick={toggle24_7}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium shadow-lg transition-all cursor-pointer ${
                        is24_7
                            ? "bg-text text-background"
                            : "bg-background text-text/80 hover:bg-text/5"
                    }`}
                >
                    <Clock12 className='w-4 h-4' />
                    <span className='hidden sm:inline'>24 Hours</span>
                </button>
                <button
                    onClick={toggleHalalCertified}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium shadow-lg transition-all cursor-pointer ${
                        isHalalCertified
                            ? "bg-green-500 text-white"
                            : "bg-background text-text/80 hover:bg-text/5"
                    }`}
                >
                    <span className='hidden sm:inline'>Halal Certified</span>
                </button>
                <button
                    onClick={toggleChains}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium shadow-lg transition-all cursor-pointer ${
                        includeChains
                            ? "bg-orange-500 text-white"
                            : "bg-background text-text/80 hover:bg-text/5"
                    }`}
                >
                    <Store className='w-4 h-4' />
                    <span className='hidden sm:inline'>
                        {includeChains ? "Hiding Chains" : "Show Chains"}
                    </span>
                </button>
            </div>
        </div>
    )
}
```

**Key changes from original:**
- Removed: `isLoading` state, `lastBoundsRef`, `handleBoundsChange`, `getCafesInBounds` import, three `useCallback` async fetch functions
- Added: `filteredCafes` via `useMemo`, `getPHDayKey` for 24/7 filtering
- `CafeMap` no longer receives `onBoundsChange`

**Step 2: Run the linter**

```bash
bun lint
```

Expected: no errors in `CafeMapWrapper.tsx`.

---

## Task 5 — Refactor `CafeMap` to remove `BoundsHandler` and fix `LocationMarker`

**Files:**
- Modify: `components/map/CafeMap.tsx`

**Step 1: Remove `onBoundsChange` prop and the `BoundsHandler` component**

Update the `CafeMapProps` interface:

```ts
// Before
interface CafeMapProps {
    cafes: CafeWithRatings[]
    onBoundsChange?: (bounds: {
        swLat: number
        swLng: number
        neLat: number
        neLng: number
    }) => void
}

// After
interface CafeMapProps {
    cafes: CafeWithRatings[]
}
```

**Step 2: Delete the `BoundsHandler` function component entirely** (lines 104–127 in the current file).

**Step 3: Fix `LocationMarker` — remove `setView: true`**

`setView: true` causes Leaflet to pan/zoom to the user's position, which triggers a `moveend` event. While `BoundsHandler` is removed, `setView` is still a source of map movement that can interact poorly with the initial default center. Change to locate without forcing a view change, and instead pan manually only if no user interaction has occurred:

```ts
function LocationMarker() {
    const [position, setPosition] = useState<[number, number] | null>(null)
    const map = useMap()
    const hasUserInteracted = useRef(false)

    const userIcon = useMemo(
        () =>
            new DivIcon({
                className: "user-location-marker",
                html: `<div style="
                    width: 16px;
                    height: 16px;
                    background: #4285F4;
                    border: 3px solid white;
                    border-radius: 50%;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                "></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
            }),
        []
    )

    useEffect(() => {
        // Listen for any user-initiated pan/zoom before location resolves
        const onMoveStart = () => { hasUserInteracted.current = true }
        map.on("movestart", onMoveStart)

        // Locate without forcing view — we handle centering manually
        map.locate({ setView: false, maxZoom: 14 })

        map.on("locationfound", (e) => {
            haptics?.trigger("success")
            setPosition([e.latlng.lat, e.latlng.lng])
            // Only fly to location if the user has not already moved the map
            if (!hasUserInteracted.current) {
                map.flyTo([e.latlng.lat, e.latlng.lng], 14)
            }
        })

        map.on("locationerror", () => {
            haptics?.trigger("error")
            console.log("Location access denied, using default center")
        })

        return () => {
            map.off("movestart", onMoveStart)
            map.off("locationfound")
            map.off("locationerror")
        }
    }, [map])

    return position ? (
        <Marker position={position} icon={userIcon}>
            <Popup>You are here</Popup>
        </Marker>
    ) : null
}
```

> **Note:** `flyTo` does trigger a `moveend`, but since `BoundsHandler` no longer exists, this is harmless. The important thing is that the user's interaction has priority.

**Step 4: Remove the `mapKey` force re-render hack**

The `mapKey` + `useEffect` pattern was a workaround for hydration issues. With SSR=false on the dynamic import, Leaflet only ever mounts client-side, so this is unnecessary. Remove:
- `const [mapKey, setMapKey] = useState("map-init")`
- The `useEffect` that sets `mapKey`
- The `key={mapKey}` on `<MapContainer>`

**Step 5: Remove `onBoundsChange` from `CafeMap`'s `<MapContainer>` render and `BoundsHandler` usage**

Remove the `<BoundsHandler onBoundsChange={onBoundsChange} onMapUsed={handleMapUsed} />` line from the JSX.

**Step 6: Clean up unused imports**

After the above removals, these imports may no longer be used in `CafeMap.tsx`:
- `useMapEvents` (was used only in `BoundsHandler`)

Remove any that are now unused.

**Step 7: Run lint**

```bash
bun lint
```

Expected: no errors in `CafeMap.tsx`.

---

## Task 6 — Verify build and smoke test

**Step 1: Run production build**

```bash
bun build
```

Expected: build completes with no TypeScript errors.

**Step 2: Start dev server and manually verify**

```bash
bun dev
```

Open `https://localhost:3000/map` (or the HTTPS dev URL) and verify:
- [ ] Markers appear on first load without any "blink"
- [ ] Panning the map does **not** show a loading indicator or re-render markers
- [ ] Zooming in/out does not trigger blinking
- [ ] "24 Hours" filter button toggles markers instantly (no loading state)
- [ ] "Halal Certified" filter button toggles markers instantly
- [ ] "Show Chains" button toggles chain cafes in/out instantly
- [ ] Clicking a marker opens the popup with cafe info
- [ ] "Explore" link in popup navigates to the correct cafe page
- [ ] User location blue dot appears (if location permission granted) and centers the map once without further re-renders

---

## Task 7 — Write unit tests for client-side filter logic

**Files:**
- Create: `utils/map/__tests__/client-filter.test.ts`

**Step 1: Create the test file**

The filtering logic now lives inline in `CafeMapWrapper.tsx`. Extract it to a testable pure function in `utils/map/client-filter.ts`:

```ts
// utils/map/client-filter.ts
import type { CafeWithRatings } from "@/utils/types/extra"
import type { DayKey } from "@/utils/time"

export interface FilterOptions {
    includeChains: boolean
    is24_7: boolean
    isHalalCertified: boolean
    todayKey: DayKey
}

export function filterCafes(
    cafes: CafeWithRatings[],
    options: FilterOptions
): CafeWithRatings[] {
    const { includeChains, is24_7, isHalalCertified, todayKey } = options
    return cafes.filter((cafe) => {
        if (!includeChains && cafe.is_chain === true) return false
        if (is24_7) {
            const hours = cafe.operating_hours
            if (!Array.isArray(hours)) return false
            const todayEntry = hours.find(
                (h: { day: string; is_24_hours?: boolean }) => h.day === todayKey
            )
            if (!todayEntry?.is_24_hours) return false
        }
        if (isHalalCertified && !cafe.is_halal_certified) return false
        return true
    })
}
```

Then update `CafeMapWrapper.tsx` to import and use `filterCafes` instead of the inline filter logic.

**Step 2: Write the test file**

```ts
// utils/map/__tests__/client-filter.test.ts
import { describe, it, expect } from "bun:test"
import { filterCafes } from "@/utils/map/client-filter"
import type { CafeWithRatings } from "@/utils/types/extra"

// Minimal cafe stub factory
function makeCafe(overrides: Partial<CafeWithRatings> = {}): CafeWithRatings {
    return {
        id: "test-id",
        name: "Test Cafe",
        slug: "test-cafe",
        thumbnail: null,
        gallery: null,
        description: null,
        address_display: "123 Test St",
        area: null,
        city_municipality: "Manila",
        province: "Metro Manila",
        region: "NCR",
        lat: 14.5,
        lng: 121.0,
        price_level: null,
        coffee_style: null,
        membership_tier: null,
        roaster: null,
        brew_methods: null,
        specialty: null,
        milk_options: null,
        tags: null,
        operating_hours: null,
        socials: null,
        phone: null,
        email: null,
        website_url: null,
        payment_methods: null,
        has_wifi: null,
        has_smoking: null,
        has_sockets: null,
        has_aircon: null,
        has_parking: null,
        has_outdoor_seating: null,
        has_indoor_seating: null,
        has_restroom: null,
        has_bidet: null,
        has_non_dairy: null,
        has_decaf: null,
        is_pet_friendly: null,
        is_work_friendly: null,
        serves_food: null,
        is_active: true,
        is_published: true,
        is_verified: false,
        is_claimed: false,
        is_hidden_gem: false,
        finding_hint: null,
        is_chain: null,
        is_halal_certified: false,
        straw_type: "",
        straw_type_other: "",
        owner_ids: null,
        contributor_id: null,
        featured_until: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        average_rating: null,
        total_reviews: null,
        ...overrides,
    } as unknown as CafeWithRatings
}

const baseOptions = {
    includeChains: false,
    is24_7: false,
    isHalalCertified: false,
    todayKey: "mon" as const,
}

describe("filterCafes", () => {
    describe("chain filter", () => {
        it("excludes chain cafes when includeChains is false", () => {
            const cafes = [
                makeCafe({ id: "1", is_chain: true }),
                makeCafe({ id: "2", is_chain: false }),
                makeCafe({ id: "3", is_chain: null }),
            ]
            const result = filterCafes(cafes, baseOptions)
            expect(result.map((c) => c.id)).toEqual(["2", "3"])
        })

        it("includes chain cafes when includeChains is true", () => {
            const cafes = [
                makeCafe({ id: "1", is_chain: true }),
                makeCafe({ id: "2", is_chain: false }),
            ]
            const result = filterCafes(cafes, { ...baseOptions, includeChains: true })
            expect(result).toHaveLength(2)
        })
    })

    describe("24/7 filter", () => {
        it("includes cafe with today marked as 24 hours", () => {
            const cafes = [
                makeCafe({
                    id: "1",
                    operating_hours: [{ day: "mon", is_24_hours: true }],
                }),
            ]
            const result = filterCafes(cafes, { ...baseOptions, is24_7: true })
            expect(result).toHaveLength(1)
        })

        it("excludes cafe with today NOT marked as 24 hours", () => {
            const cafes = [
                makeCafe({
                    id: "1",
                    operating_hours: [{ day: "mon", is_24_hours: false }],
                }),
            ]
            const result = filterCafes(cafes, { ...baseOptions, is24_7: true })
            expect(result).toHaveLength(0)
        })

        it("excludes cafe with no operating_hours when 24/7 filter is active", () => {
            const cafes = [makeCafe({ id: "1", operating_hours: null })]
            const result = filterCafes(cafes, { ...baseOptions, is24_7: true })
            expect(result).toHaveLength(0)
        })

        it("excludes cafe missing today's entry in operating_hours", () => {
            const cafes = [
                makeCafe({
                    id: "1",
                    operating_hours: [{ day: "tue", is_24_hours: true }],
                }),
            ]
            const result = filterCafes(cafes, {
                ...baseOptions,
                is24_7: true,
                todayKey: "mon",
            })
            expect(result).toHaveLength(0)
        })

        it("does not filter by 24/7 when is24_7 is false", () => {
            const cafes = [makeCafe({ id: "1", operating_hours: null })]
            const result = filterCafes(cafes, { ...baseOptions, is24_7: false })
            expect(result).toHaveLength(1)
        })
    })

    describe("halal filter", () => {
        it("includes only halal-certified cafes when filter is active", () => {
            const cafes = [
                makeCafe({ id: "1", is_halal_certified: true }),
                makeCafe({ id: "2", is_halal_certified: false }),
            ]
            const result = filterCafes(cafes, { ...baseOptions, isHalalCertified: true })
            expect(result.map((c) => c.id)).toEqual(["1"])
        })

        it("includes all cafes regardless of halal status when filter is off", () => {
            const cafes = [
                makeCafe({ id: "1", is_halal_certified: true }),
                makeCafe({ id: "2", is_halal_certified: false }),
            ]
            const result = filterCafes(cafes, { ...baseOptions, isHalalCertified: false })
            expect(result).toHaveLength(2)
        })
    })

    describe("combined filters", () => {
        it("applies all three filters simultaneously", () => {
            const cafes = [
                // passes all filters
                makeCafe({
                    id: "pass",
                    is_chain: false,
                    is_halal_certified: true,
                    operating_hours: [{ day: "mon", is_24_hours: true }],
                }),
                // chain — excluded
                makeCafe({
                    id: "chain",
                    is_chain: true,
                    is_halal_certified: true,
                    operating_hours: [{ day: "mon", is_24_hours: true }],
                }),
                // not halal — excluded
                makeCafe({
                    id: "not-halal",
                    is_chain: false,
                    is_halal_certified: false,
                    operating_hours: [{ day: "mon", is_24_hours: true }],
                }),
                // not 24/7 — excluded
                makeCafe({
                    id: "not-24",
                    is_chain: false,
                    is_halal_certified: true,
                    operating_hours: [{ day: "mon", is_24_hours: false }],
                }),
            ]
            const result = filterCafes(cafes, {
                includeChains: false,
                is24_7: true,
                isHalalCertified: true,
                todayKey: "mon",
            })
            expect(result.map((c) => c.id)).toEqual(["pass"])
        })
    })
})
```

**Step 3: Run the tests**

```bash
bun test utils/map/__tests__/client-filter.test.ts
```

Expected: all tests pass (green).

**Step 4: Update `CafeMapWrapper.tsx` to use the extracted `filterCafes` function**

Replace the inline `useMemo` filter body with:

```tsx
import { filterCafes } from "@/utils/map/client-filter"

// ...

const filteredCafes = useMemo(
    () => filterCafes(cafes, { includeChains, is24_7, isHalalCertified, todayKey }),
    [cafes, includeChains, is24_7, isHalalCertified, todayKey]
)
```

**Step 5: Run all tests**

```bash
bun test
```

Expected: all existing tests still pass; new filter tests pass.

---

## Task 8 — Final lint + build verification

**Step 1: Run lint across all changed files**

```bash
bun lint
```

Expected: no errors.

**Step 2: Run full build**

```bash
bun build
```

Expected: build succeeds.

**Step 3: Run all tests**

```bash
bun test
```

Expected: all tests pass.

---

## Summary of Changes

| File | Type | Description |
|---|---|---|
| `app/api/actions/cafe.ts` | Modified | Added `getAllPublishedCafes()` — fetches all published non-hidden-gem cafes including chains |
| `app/map/page.tsx` | Modified | Uses `getAllPublishedCafes` instead of `getAllCafes(1, 100)` |
| `utils/time.ts` | Created (conditional) | `getPHDayKey()` — client-safe PH time day key utility |
| `utils/map/client-filter.ts` | Created | Pure `filterCafes()` function — testable, no side effects |
| `utils/map/__tests__/client-filter.test.ts` | Created | 10 unit tests covering all filter combinations |
| `components/map/CafeMapWrapper.tsx` | Major refactor | Removed async fetching, `isLoading`, `lastBoundsRef`, `useCallback` handlers; added `useMemo` in-memory filtering |
| `components/map/CafeMap.tsx` | Refactor | Removed `BoundsHandler`, `onBoundsChange` prop, `mapKey` hack; fixed `LocationMarker` to not force `setView` |

## What This Does NOT Change

- `getCafesInBounds` in `app/api/actions/map.ts` is preserved (useful for future features like a "cafes near me" radius search)
- Marker rendering, popup content, cluster logic — all unchanged
- Badge tracking (`trackMapUsage` / `handleMapUsed`) — preserved; `BoundsHandler` is removed but `handleMapUsed` can be wired to the first `mapclick` or `movestart` event on `LocationMarker` or directly in `CafeMap` if badge tracking is still needed (decide during implementation)
- `CafeMiniMap`, `CrawlRouteMap` — not affected
