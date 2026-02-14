# Profile Collections + Crawl Map Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Merge collections sections on profile pages, add crawl management to profiles, and polish cafe crawl maps with clearer markers, route legs, numbering, user location, and better map framing. Also fix crawl edit routing and reorganize the crawl editor layout.

**Architecture:** Keep collection/crawl data fetching in server actions and render with small client-state toggles. Improve crawl map legibility by enhancing marker HTML/CSS, adding ordered numbering, and styling route segments via a small, testable styling utility. Add optional user location markers in crawl maps and fit maps to route bounds when possible. Fix map tile/resize issues by invalidating Leaflet size on container changes. Ensure crawl edit routes use the canonical `/community/crawls/[slug]/edit` path.

**Tech Stack:** Next.js App Router, React, Tailwind CSS v4, Leaflet/react-leaflet, Bun test runner.

---

### Task 1: Public Profile Collections Section

**Files:**
- Modify: `app/api/actions/profile.ts`
- Modify: `components/profile/PublicProfile.tsx`
- Create: `components/profile/__tests__/public-profile-collections.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

describe("PublicProfile collections section", () => {
    it("renders a Collections section in PublicProfile", () => {
        const filePath = join(
            process.cwd(),
            "components",
            "profile",
            "PublicProfile.tsx",
        )
        const source = readFileSync(filePath, "utf-8")
        expect(source).toContain("Collections")
        expect(source).toContain("CollectionCard")
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test components/profile/__tests__/public-profile-collections.test.ts`
Expected: FAIL because Collections section is not yet present.

**Step 3: Write minimal implementation**

1) Update `app/api/actions/profile.ts` to include public collections in `PublicProfileData`:

```ts
// add import
import { collections } from "@/db/schema"

export interface PublicProfileData {
    // ...existing fields
    collections: {
        id: string
        title: string
        slug: string
        description: string | null
        coverImage: string | null
        itemCount: number | null
        isPublic: boolean | null
        viewsCount: number | null
        likesCount: number | null
        createdAt: string | null
    }[]
}

export async function getPublicProfileData(
    profile: ProfileWithBadges,
    viewerId?: string,
): Promise<PublicProfileData> {
    const [
        allBadgesResult,
        reviewsResult,
        visitedCafes,
        favoriteCafes,
        wishlistCafes,
        publicCollections,
    ] = await Promise.all([
        // ...existing promises
        db
            .select({
                id: collections.id,
                title: collections.title,
                slug: collections.slug,
                description: collections.description,
                coverImage: collections.coverImage,
                itemCount: collections.itemCount,
                isPublic: collections.isPublic,
                viewsCount: collections.viewsCount,
                likesCount: collections.likesCount,
                createdAt: collections.createdAt,
            })
            .from(collections)
            .where(and(eq(collections.userId, profile.id), eq(collections.isPublic, true)))
            .orderBy(desc(collections.createdAt)),
    ])

    return {
        // ...existing fields
        collections: publicCollections.map((c) => ({
            ...c,
            createdAt: c.createdAt?.toISOString() ?? null,
        })),
    }
}
```

2) Update `components/profile/PublicProfile.tsx` to store/render collections:

```tsx
import CollectionCard from "@/components/collections/CollectionCard"

const [collections, setCollections] = useState<PublicProfileData["collections"]>([])

useEffect(() => {
    const fetchData = async () => {
        const data = await getPublicProfileData(profile, user?.id)
        setCollections(data.collections)
        // ...existing state updates
    }
    fetchData()
}, [profile, user])

// in JSX, place after Passport section
<motion.section variants={item} className="mt-10">
    <div className="flex items-center gap-2 mb-4">
        <Layers className="w-5 h-5" />
        <h2 className="text-xl font-semibold font-serif">Collections</h2>
        <span className="ml-auto bg-primary/15 text-primary text-sm font-bold px-2.5 py-1 rounded-full">
            {collections.length}
        </span>
    </div>
    {collections.length === 0 ? (
        <div className="text-center py-10 bg-text/5 rounded-xl border border-text/10">
            <Layers className="w-12 h-12 text-text/20 mx-auto mb-3" />
            <p className="text-text/60 font-medium">
                No public collections yet
            </p>
        </div>
    ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {collections.map((collection) => (
                <CollectionCard key={collection.id} collection={collection} />
            ))}
        </div>
    )}
</motion.section>
```

**Step 4: Run test to verify it passes**

Run: `bun test components/profile/__tests__/public-profile-collections.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add app/api/actions/profile.ts components/profile/PublicProfile.tsx components/profile/__tests__/public-profile-collections.test.ts
git commit -m "feat: show public collections on profiles"
```

### Task 2: Private Profile Collections Merge

**Files:**
- Modify: `components/profile/Profile.tsx`
- Create: `components/profile/__tests__/profile-collections.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

describe("Profile collections merge", () => {
    it("renders a single Collections section in Profile", () => {
        const filePath = join(
            process.cwd(),
            "components",
            "profile",
            "Profile.tsx",
        )
        const source = readFileSync(filePath, "utf-8")
        expect(source).toContain("Collections")
        expect(source).not.toContain("Saved Collections")
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test components/profile/__tests__/profile-collections.test.ts`
Expected: FAIL because Profile still contains the Saved Collections section.

**Step 3: Write minimal implementation**

Replace the two sections in `components/profile/Profile.tsx` with a single tabbed section:

```tsx
const [activeCollectionsTab, setActiveCollectionsTab] = useState<"mine" | "saved">("mine")

// ...in JSX
<motion.section variants={item} className="mt-10">
    <div className="flex items-center gap-2 mb-4">
        <Layers className="w-5 h-5" />
        <h2 className="text-xl font-semibold font-serif">Collections</h2>
        <span className="ml-auto bg-primary/15 text-primary text-sm font-bold px-2.5 py-1 rounded-full">
            {activeCollectionsTab === "mine" ? collections.length : savedCollections.length}
        </span>
    </div>

    <div className="flex items-center gap-2 mb-4">
        <button
            onClick={() => setActiveCollectionsTab("mine")}
            className={cn(
                "px-3 py-1.5 text-sm rounded-full border transition-colors",
                activeCollectionsTab === "mine"
                    ? "bg-primary text-white border-primary"
                    : "bg-background border-text/10 text-text/60",
            )}
        >
            My Collections
        </button>
        <button
            onClick={() => setActiveCollectionsTab("saved")}
            className={cn(
                "px-3 py-1.5 text-sm rounded-full border transition-colors",
                activeCollectionsTab === "saved"
                    ? "bg-primary text-white border-primary"
                    : "bg-background border-text/10 text-text/60",
            )}
        >
            Saved Collections
        </button>
    </div>

    {activeCollectionsTab === "mine" ? (
        // reuse existing My Collections card grid + CTA
    ) : (
        // reuse existing Saved Collections card grid + CTA
    )}
</motion.section>
```

Ensure the old Saved Collections section markup is removed and the My Collections section is moved inside this new combined section.

**Step 4: Run test to verify it passes**

Run: `bun test components/profile/__tests__/profile-collections.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/profile/Profile.tsx components/profile/__tests__/profile-collections.test.ts
git commit -m "feat: merge profile collections into single section"
```

### Task 3: Crawl Marker HTML/CSS + Numbered Pins

**Files:**
- Modify: `utils/map/crawl-marker.ts`
- Modify: `app/map.css`
- Modify: `components/map/CrawlRouteMapInternal.tsx`
- Modify: `components/map/CrawlRouteMap.tsx`
- Modify: `components/crawls/CrawlEditor.tsx`
- Modify: `components/crawls/CrawlView.tsx`
- Modify: `utils/map/__tests__/crawl-marker.test.ts`
- Modify: `components/crawls/__tests__/crawl-view.test.tsx`

**Step 1: Write the failing test**

```ts
it("renders a number when index is provided", () => {
    const html = buildCrawlMarkerHtml({ imageUrl: "https://x.com/img.jpg", label: "Cafe", index: 3 })
    expect(html).toContain("crawl-marker-number")
    expect(html).toContain(">3<")
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/map/__tests__/crawl-marker.test.ts`
Expected: FAIL because index is not rendered yet.

**Step 3: Write minimal implementation**

1) Update `utils/map/crawl-marker.ts`:

```ts
export function buildCrawlMarkerHtml(input: {
    imageUrl: string | null
    label?: string
    index?: number
}) {
    const image = escapeHtml(input.imageUrl || CAFE_PLACEHOLDER_URL)
    const alt = escapeHtml(input.label ?? "Cafe")
    const number = typeof input.index === "number" ? input.index : null

    return `
        <div class="crawl-marker-pin">
            ${number !== null ? `<div class="crawl-marker-number">${number}</div>` : ""}
            <div class="crawl-marker-circle" style="background-image:url('${image}')" aria-label="${alt}"></div>
        </div>
    `.trim()
}
```

2) Update marker CSS in `app/map.css`:

```css
.crawl-marker-icon {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
}

.crawl-marker-pin {
    width: 44px;
    height: 44px;
    background: linear-gradient(135deg, #74512d 0%, #543310 100%);
    border: 3px solid #f8f4e1;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    box-shadow: 0 4px 12px rgba(84, 51, 16, 0.35), 0 2px 4px rgba(84, 51, 16, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
}

.crawl-marker-circle {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background-position: center;
    background-size: cover;
    transform: rotate(45deg);
    border: none;
}

.crawl-marker-number {
    position: absolute;
    top: -10px;
    left: 50%;
    transform: translateX(-50%) rotate(45deg);
    width: 20px;
    height: 20px;
    border-radius: 999px;
    background: #f8f4e1;
    color: #543310;
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}
```

3) Update `components/map/CrawlRouteMapInternal.tsx` and `components/map/CrawlRouteMap.tsx` props:

```ts
interface CrawlRouteMapProps {
    points: { lat: number; lng: number; imageUrl?: string | null; label?: string; index?: number }[]
    focusPoint?: { lat: number; lng: number } | null
}

const markerIcon = (point: CrawlRouteMapProps["points"][number]) =>
    new DivIcon({
        className: "crawl-marker-icon",
        html: buildCrawlMarkerHtml({
            imageUrl: point.imageUrl ?? null,
            label: point.label,
            index: point.index,
        }),
        iconSize: [44, 44],
        iconAnchor: [22, 44],
    })
```

4) Update mapPoints in `components/crawls/CrawlEditor.tsx` and `components/crawls/CrawlView.tsx`:

```ts
// CrawlEditor
const mapPoints = useMemo(
    () =>
        items
            .filter((item) => item.lat && item.lng)
            .map((item, index) => ({
                lat: item.lat!,
                lng: item.lng!,
                imageUrl: item.thumbnail ? getCafeThumbnailUrl(item.thumbnail) : null,
                label: item.name || "",
                index: index + 1,
            })),
    [items],
)
```

```ts
// CrawlView (inside mapPoints transform)
.map((cafe, index) => ({
    lat: cafe.lat,
    lng: cafe.lng,
    imageUrl: cafe.thumbnail ? getCafeThumbnailUrl(cafe.thumbnail) : null,
    label: cafe.name,
    index: index + 1,
}))
```

5) Update `components/crawls/__tests__/crawl-view.test.tsx` to assert `index` exists in mapPoints.

**Step 4: Run tests to verify they pass**

Run:

```
bun test utils/map/__tests__/crawl-marker.test.ts
bun test components/crawls/__tests__/crawl-view.test.tsx
```

Expected: PASS.

**Step 5: Commit**

```bash
git add utils/map/crawl-marker.ts app/map.css components/map/CrawlRouteMapInternal.tsx components/map/CrawlRouteMap.tsx components/crawls/CrawlEditor.tsx components/crawls/CrawlView.tsx utils/map/__tests__/crawl-marker.test.ts components/crawls/__tests__/crawl-view.test.tsx
git commit -m "feat: add numbered crawl markers and refine styles"
```

### Task 4: Differentiate Route Legs by Pair Grouping

**Files:**
- Create: `utils/map/crawl-route-style.ts`
- Create: `utils/map/__tests__/crawl-route-style.test.ts`
- Modify: `components/map/CrawlRouteMapInternal.tsx`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test"
import { getCrawlSegmentStyle } from "@/utils/map/crawl-route-style"

describe("crawl route style", () => {
    it("groups pairs with same color", () => {
        const first = getCrawlSegmentStyle(0)
        const second = getCrawlSegmentStyle(1)
        const third = getCrawlSegmentStyle(2)
        expect(first.color).toBe(second.color)
        expect(first.color).not.toBe(third.color)
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/map/__tests__/crawl-route-style.test.ts`
Expected: FAIL because the util does not exist yet.

**Step 3: Write minimal implementation**

Create `utils/map/crawl-route-style.ts`:

```ts
export function getCrawlSegmentStyle(index: number) {
    const palette = ["#74512d", "#4b6b8a", "#7a5f3a", "#3f7f6b"]
    const group = Math.floor(index / 2)
    const color = palette[group % palette.length]
    const isEven = index % 2 === 0

    return {
        color,
        weight: 4,
        opacity: 0.85,
        dashArray: isEven ? undefined : "6 6",
        lineCap: "round" as const,
    }
}
```

Use the helper in `components/map/CrawlRouteMapInternal.tsx`:

```tsx
import { getCrawlSegmentStyle } from "@/utils/map/crawl-route-style"

{segments.map((segment, idx) => (
    <Polyline
        key={`seg-${idx}`}
        positions={segment}
        pathOptions={getCrawlSegmentStyle(idx)}
    />
))}
```

**Step 4: Run test to verify it passes**

Run: `bun test utils/map/__tests__/crawl-route-style.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add utils/map/crawl-route-style.ts utils/map/__tests__/crawl-route-style.test.ts components/map/CrawlRouteMapInternal.tsx
git commit -m "feat: style crawl routes by paired segments"
```

### Task 5: Fix Crawl Map Tile/Resize Loading

**Files:**
- Create: `utils/map/leaflet.ts`
- Create: `utils/map/__tests__/leaflet.test.ts`
- Modify: `components/map/CrawlRouteMapInternal.tsx`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test"
import { invalidateMapSize } from "@/utils/map/leaflet"

describe("leaflet utils", () => {
    it("calls invalidateSize on map", () => {
        let called = false
        const map = {
            invalidateSize: () => {
                called = true
            },
        }
        invalidateMapSize(map)
        expect(called).toBe(true)
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/map/__tests__/leaflet.test.ts`
Expected: FAIL because the util does not exist yet.

**Step 3: Write minimal implementation**

Create `utils/map/leaflet.ts`:

```ts
export function invalidateMapSize(map: { invalidateSize: (options?: { animate?: boolean }) => void }) {
    map.invalidateSize({ animate: false })
}
```

Add a resize handler to `components/map/CrawlRouteMapInternal.tsx`:

```tsx
import { useRef } from "react"
import { invalidateMapSize } from "@/utils/map/leaflet"

function MapResizeHandler() {
    const map = useMap()
    const observerRef = useRef<ResizeObserver | null>(null)

    useEffect(() => {
        invalidateMapSize(map)
        const container = map.getContainer()
        observerRef.current = new ResizeObserver(() => invalidateMapSize(map))
        observerRef.current.observe(container)

        const handle = () => invalidateMapSize(map)
        window.addEventListener("orientationchange", handle)

        return () => {
            observerRef.current?.disconnect()
            window.removeEventListener("orientationchange", handle)
        }
    }, [map])

    return null
}
```

Place `<MapResizeHandler />` inside the `MapContainer` so tiles reflow when partially visible.

**Step 4: Run test to verify it passes**

Run: `bun test utils/map/__tests__/leaflet.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add utils/map/leaflet.ts utils/map/__tests__/leaflet.test.ts components/map/CrawlRouteMapInternal.tsx
git commit -m "fix: invalidate crawl map size on resize"
```

### Task 6: Crawl Editor Desktop Layout Reorder

**Files:**
- Modify: `components/crawls/CrawlEditor.tsx`
- Modify: `components/crawls/__tests__/crawl-editor.test.tsx`

**Step 1: Write the failing test**

```ts
it("orders sections: cover/title/desc, route, add cafes, list", () => {
    const filePath = join(process.cwd(), "components", "crawls", "CrawlEditor.tsx")
    const source = readFileSync(filePath, "utf-8")
    const coverIndex = source.indexOf("Cover Image")
    const routeIndex = source.indexOf("Route Preview")
    const addIndex = source.indexOf("Add Cafes")
    const listIndex = source.indexOf("Cafes (")
    expect(coverIndex).toBeGreaterThan(-1)
    expect(routeIndex).toBeGreaterThan(coverIndex)
    expect(addIndex).toBeGreaterThan(routeIndex)
    expect(listIndex).toBeGreaterThan(addIndex)
})
```

**Step 2: Run test to verify it fails**

Run: `bun test components/crawls/__tests__/crawl-editor.test.tsx`
Expected: FAIL because the old layout order is still in the file.

**Step 3: Write minimal implementation**

Rework the layout in `components/crawls/CrawlEditor.tsx` (desktop-focused, mobile stacks naturally):

```tsx
<div className="max-w-6xl w-full mx-auto px-6 py-8">
    <div className="space-y-8">
        {/* Top row: Cover + Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
                {/* Cover Image block */}
            </div>
            <div className="lg:col-span-2 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-end gap-4">
                    <div className="flex-1">
                        {/* Title label + input */}
                    </div>
                    <div className="lg:pb-1">
                        {/* Public/Private toggle */}
                    </div>
                </div>
                <div>
                    {/* Description textarea */}
                </div>
            </div>
        </div>

        {/* Route Preview */}
        <div>
            {/* existing Route Preview block */}
        </div>

        {/* Add Cafes */}
        <div>
            {/* existing Add Cafes search block */}
        </div>

        {/* Cafes List */}
        <div>
            {/* existing cafes list block */}
        </div>
    </div>
</div>
```

**Step 4: Run test to verify it passes**

Run: `bun test components/crawls/__tests__/crawl-editor.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/crawls/CrawlEditor.tsx components/crawls/__tests__/crawl-editor.test.tsx
git commit -m "feat: reorder crawl editor desktop layout"
```

### Task 7: Show User Location on Crawl View + Profile Location Card

**Files:**
- Modify: `components/map/CrawlRouteMap.tsx`
- Modify: `components/map/CrawlRouteMapInternal.tsx`
- Modify: `components/crawls/CrawlView.tsx`
- Create: `components/profile/ProfileLocationMap.tsx`
- Modify: `components/profile/Profile.tsx`
- Create: `components/profile/__tests__/profile-location.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

describe("Profile location map", () => {
    it("adds a ProfileLocationMap section", () => {
        const filePath = join(process.cwd(), "components", "profile", "Profile.tsx")
        const source = readFileSync(filePath, "utf-8")
        expect(source).toContain("ProfileLocationMap")
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test components/profile/__tests__/profile-location.test.ts`
Expected: FAIL because the ProfileLocationMap does not exist yet.

**Step 3: Write minimal implementation**

1) Add `showUserLocation?: boolean` to `CrawlRouteMap` props and thread it through `CrawlRouteMapInternal`.

2) Add a `UserLocationMarker` component inside `CrawlRouteMapInternal` (similar to `CafeMap`), guarded by `showUserLocation`. Use `map.locate`, `locationfound`, and a `DivIcon` with a small blue dot.

3) Pass `showUserLocation` from `components/crawls/CrawlView.tsx` to enable live location on public crawl view maps.

4) Create `components/profile/ProfileLocationMap.tsx`:

```tsx
"use client"

import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet"
import { DivIcon } from "leaflet"
import "leaflet/dist/leaflet.css"
import "@/app/map.css"
import { useEffect, useState } from "react"

function LocationMarker() {
    const [position, setPosition] = useState<[number, number] | null>(null)
    const map = useMap()

    useEffect(() => {
        map.locate({ setView: true, maxZoom: 14 })
        map.on("locationfound", (e) => setPosition([e.latlng.lat, e.latlng.lng]))
    }, [map])

    if (!position) return null
    return (
        <Marker
            position={position}
            icon={
                new DivIcon({
                    className: "user-location-marker",
                    html: `<div style="width: 14px; height: 14px; background: #4285F4; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>`,
                    iconSize: [14, 14],
                    iconAnchor: [7, 7],
                })
            }
        />
    )
}

export default function ProfileLocationMap() {
    return (
        <div className="rounded-2xl overflow-hidden border border-secondary/20">
            <MapContainer center={[12.8797, 121.774]} zoom={6} scrollWheelZoom className="h-[240px] w-full">
                <TileLayer
                    attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
                />
                <LocationMarker />
            </MapContainer>
        </div>
    )
}
```

5) Insert a “Your Location” card in `components/profile/Profile.tsx` (private profile only), e.g. below the Passport section:

```tsx
<motion.section variants={item} className="mt-10">
    <div className="flex items-center gap-2 mb-4">
        <MapPin className="w-5 h-5" />
        <h2 className="text-xl font-semibold font-serif">Your Location</h2>
    </div>
    <ProfileLocationMap />
</motion.section>
```

**Step 4: Run test to verify it passes**

Run: `bun test components/profile/__tests__/profile-location.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/map/CrawlRouteMap.tsx components/map/CrawlRouteMapInternal.tsx components/crawls/CrawlView.tsx components/profile/ProfileLocationMap.tsx components/profile/Profile.tsx components/profile/__tests__/profile-location.test.ts
git commit -m "feat: add user location to crawl and profile maps"
```

### Task 8: Add My Crawls to Profile (plus Saved Crawls tab)

**Files:**
- Modify: `components/profile/Profile.tsx`
- Modify: `app/profile/crawls/page.tsx`
- Create: `app/profile/crawls/saved/page.tsx`
- Create: `components/crawls/UserCrawlsList.tsx`
- Modify: `components/crawls/SavedCrawlsList.tsx`
- Create: `components/crawls/__tests__/user-crawls-list.test.tsx`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

describe("Profile crawls section", () => {
    it("shows a Crawls section with My and Saved tabs", () => {
        const filePath = join(process.cwd(), "components", "profile", "Profile.tsx")
        const source = readFileSync(filePath, "utf-8")
        expect(source).toContain("Crawls")
        expect(source).toContain("My Crawls")
        expect(source).toContain("Saved Crawls")
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test components/crawls/__tests__/user-crawls-list.test.tsx`
Expected: FAIL because the new section and component do not exist yet.

**Step 3: Write minimal implementation**

1) In `components/profile/Profile.tsx`, add crawls state and fetch:

```ts
import { getUserCafeCrawls } from "@/app/api/actions/cafe-crawls"

const [userCrawls, setUserCrawls] = useState<any[]>([])
const [activeCrawlsTab, setActiveCrawlsTab] = useState<"mine" | "saved">("mine")

useEffect(() => {
    const fetchUserCrawls = async () => {
        if (!user) return
        const data = await getUserCafeCrawls(user.id)
        setUserCrawls(data)
    }
    fetchUserCrawls()
}, [user])
```

2) Add a new Crawls section similar to Collections:

```tsx
<motion.section variants={item} className="mt-10">
    <div className="flex items-center gap-2 mb-4">
        <MapPin className="w-5 h-5" />
        <h2 className="text-xl font-semibold font-serif">Crawls</h2>
        <span className="ml-auto bg-primary/15 text-primary text-sm font-bold px-2.5 py-1 rounded-full">
            {activeCrawlsTab === "mine" ? userCrawls.length : savedCrawls.length}
        </span>
    </div>
    <div className="flex items-center gap-2 mb-4">
        <button ...>My Crawls</button>
        <button ...>Saved Crawls</button>
    </div>
    {activeCrawlsTab === "mine" ? (
        // render user crawls preview + CTA
    ) : (
        // render saved crawls preview + CTA
    )}
</motion.section>
```

3) Create `components/crawls/UserCrawlsList.tsx` (mirrors SavedCrawlsList but uses “My Crawls” header and routes to edit):

```tsx
// render list of crawls, each card linking to `/community/crawls/${crawl.slug}`
// CTA button: “Manage Crawls” -> `/profile/crawls`
```

4) Change `app/profile/crawls/page.tsx` to use `getUserCafeCrawls` and `UserCrawlsList` (rename metadata to “My Crawls”).

5) Create `app/profile/crawls/saved/page.tsx` to render `SavedCrawlsList` using `getSavedCafeCrawls`.

6) Update `components/crawls/SavedCrawlsList.tsx` back link and CTA paths to `/profile/crawls/saved` and “Browse Crawls”.

**Step 4: Run test to verify it passes**

Run: `bun test components/crawls/__tests__/user-crawls-list.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/profile/Profile.tsx app/profile/crawls/page.tsx app/profile/crawls/saved/page.tsx components/crawls/UserCrawlsList.tsx components/crawls/SavedCrawlsList.tsx components/crawls/__tests__/user-crawls-list.test.tsx
git commit -m "feat: add my crawls management to profile"
```

### Task 9: Fix Crawl Edit Route Link

**Files:**
- Modify: `components/crawls/CrawlView.tsx`
- Create: `components/crawls/__tests__/crawl-edit-link.test.tsx`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

describe("Crawl edit link", () => {
    it("uses the community edit route", () => {
        const filePath = join(process.cwd(), "components", "crawls", "CrawlView.tsx")
        const source = readFileSync(filePath, "utf-8")
        expect(source).toContain("/community/crawls/")
        expect(source).toContain("/edit")
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test components/crawls/__tests__/crawl-edit-link.test.tsx`
Expected: FAIL because edit link currently points to `/profile/crawls/...`.

**Step 3: Write minimal implementation**

Update the edit link in `components/crawls/CrawlView.tsx`:

```tsx
<Link href={`/community/crawls/${crawl.slug}/edit`} ...>
```

**Step 4: Run test to verify it passes**

Run: `bun test components/crawls/__tests__/crawl-edit-link.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/crawls/CrawlView.tsx components/crawls/__tests__/crawl-edit-link.test.tsx
git commit -m "fix: route crawl edit link to community path"
```

### Task 10: Fit Crawl Map to Route Bounds

**Files:**
- Modify: `components/map/CrawlRouteMapInternal.tsx`
- Create: `components/map/__tests__/crawl-route-bounds.test.tsx`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

describe("CrawlRouteMap bounds", () => {
    it("includes fitBounds logic", () => {
        const filePath = join(process.cwd(), "components", "map", "CrawlRouteMapInternal.tsx")
        const source = readFileSync(filePath, "utf-8")
        expect(source).toContain("fitBounds")
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test components/map/__tests__/crawl-route-bounds.test.tsx`
Expected: FAIL because fitBounds is not referenced yet.

**Step 3: Write minimal implementation**

Add a `MapBounds` component to `CrawlRouteMapInternal.tsx`:

```tsx
function MapBounds({ points }: { points: { lat: number; lng: number }[] }) {
    const map = useMap()

    useEffect(() => {
        if (points.length === 0) return
        if (points.length === 1) {
            map.setView([points[0].lat, points[0].lng], Math.max(map.getZoom(), 13))
            return
        }

        const bounds = points.map((p) => [p.lat, p.lng]) as [number, number][]
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 })
    }, [points, map])

    return null
}
```

Use `<MapBounds points={points} />` inside `MapContainer` and keep `MapFocus` for explicit focus overrides.

**Step 4: Run test to verify it passes**

Run: `bun test components/map/__tests__/crawl-route-bounds.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/map/CrawlRouteMapInternal.tsx components/map/__tests__/crawl-route-bounds.test.tsx
git commit -m "feat: fit crawl map to route bounds"
```

---

## Notes & Suggestions

- Route leg clarity: paired segment colors + dashed alternates should make legs distinct without extra UI. If still unclear, add a small legend overlay or show hover tooltips per segment.
- If map tile issues persist, use @systematic-debugging to validate container sizing, CSS overflow, and dynamic import timing.

---

## Verification

- `bun test utils/map/__tests__/crawl-marker.test.ts`
- `bun test utils/map/__tests__/crawl-route-style.test.ts`
- `bun test utils/map/__tests__/leaflet.test.ts`
- `bun test components/crawls/__tests__/crawl-view.test.tsx`
- `bun test components/crawls/__tests__/crawl-editor.test.tsx`
- `bun test components/profile/__tests__/public-profile-collections.test.ts`
- `bun test components/profile/__tests__/profile-collections.test.ts`
- `bun test components/profile/__tests__/profile-location.test.ts`
- `bun test components/crawls/__tests__/user-crawls-list.test.tsx`
- `bun test components/crawls/__tests__/crawl-edit-link.test.tsx`
- `bun test components/map/__tests__/crawl-route-bounds.test.tsx`
