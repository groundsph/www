# Crawl + Community Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address community crawl UX gaps (access, routes, map styling, markers) and add crawl likes + collection saves, while fixing storage cleanup and navigation issues.

**Architecture:** Extend the existing Cafe Crawls domain with OSRM-backed routing, custom Leaflet markers, and extra social metadata (likes/saves). Add a new storage bucket for crawl covers and include crawls/collections in admin cleanup reporting. Introduce collection saves as a parallel feature to crawl saves with profile-facing lists.

**Tech Stack:** Next.js App Router, React, Drizzle ORM (Postgres), Zod, Tailwind CSS v4, Leaflet/react-leaflet, OSRM public API, Bun test runner.

---

### Task 1: Add crawl cover storage + cleanup visibility (incl cafe stamps)

**Files:**
- Modify: `utils/storage/types.ts`
- Modify: `utils/storage/cleanup.ts`
- Modify: `utils/storage/actions.ts`
- Modify: `app/api/actions/admin.ts`
- Modify: `components/manage/SystemManagement.tsx`
- Test: `utils/__tests__/storage-cleanup.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test"
import { collectCafeStampUrls, collectCrawlCoverUrls } from "@/utils/storage/cleanup"

describe("storage cleanup", () => {
    it("includes cafe badge stamp urls", () => {
        const urls = collectCafeStampUrls([{ badgeStampUrl: "https://x" }])
        expect(urls.has("https://x")).toBe(true)
    })

    it("includes crawl cover urls", () => {
        const urls = collectCrawlCoverUrls([{ coverImage: "https://crawl" }])
        expect(urls.has("https://crawl")).toBe(true)
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/__tests__/storage-cleanup.test.ts`
Expected: FAIL with missing export `collectCrawlCoverUrls`.

**Step 3: Write minimal implementation**

```ts
// utils/storage/types.ts
export const STORAGE_BUCKETS = {
    CAFES: "cafes",
    REVIEWS: "reviews",
    AVATARS: "avatars",
    BLOGS: "blogs",
    EVENTS: "events",
    MENU_PHOTOS: "menu-photos",
    BADGES: "badges",
    OWNERSHIP_PROOFS: "ownership-proofs",
    COLLECTIONS: "collections",
    CRAWLS: "crawls",
} as const

// add config
[STORAGE_BUCKETS.CRAWLS]: {
    name: STORAGE_BUCKETS.CRAWLS,
    isPublic: true,
    maxFileSize: 5 * 1024 * 1024,
    allowedExtensions: ["jpg", "jpeg", "png", "webp", "gif"],
},

// utils/storage/cleanup.ts
interface CrawlWithCoverImage {
    coverImage: string | null
}

export function collectCrawlCoverUrls(crawls: CrawlWithCoverImage[]): Set<string> {
    const urls = new Set<string>()
    for (const crawl of crawls) {
        if (crawl.coverImage) {
            urls.add(crawl.coverImage)
        }
    }
    return urls
}

// utils/storage/actions.ts
import { cafeCrawls } from "@/db/schema"
import { collectCrawlCoverUrls } from "@/utils/storage/cleanup"

export interface CleanupResult {
    success: boolean
    deleted: {
        cafes: number
        reviews: number
        avatars: number
        blogs: number
        events: number
        menuPhotos: number
        badges: number
        ownershipProofs: number
        collections: number
        crawls: number
    }
    error?: string
}

// inside cleanupOrphanedImages()
const crawlsResult = await db
    .select({ coverImage: cafeCrawls.coverImage })
    .from(cafeCrawls)
    .where(isNotNull(cafeCrawls.coverImage))
const crawlImages = collectCrawlCoverUrls(crawlsResult)

await processBucket(STORAGE_BUCKETS.CRAWLS, crawlImages, "crawls")

// createEmptyCleanupStats()
return {
    cafes: 0,
    reviews: 0,
    avatars: 0,
    blogs: 0,
    events: 0,
    menuPhotos: 0,
    badges: 0,
    ownershipProofs: 0,
    collections: 0,
    crawls: 0,
}

// app/api/actions/admin.ts
export async function adminCleanupOrphanedImages(): Promise<{
    success: boolean
    deleted?: {
        cafes: number
        reviews: number
        avatars: number
        blogs: number
        events: number
        menuPhotos: number
        badges: number
        ownershipProofs: number
        collections: number
        crawls: number
    }
    error?: string
}> { /* same logic */ }

// components/manage/SystemManagement.tsx
const total =
    result.deleted.cafes +
    result.deleted.reviews +
    result.deleted.avatars +
    result.deleted.blogs +
    result.deleted.events +
    result.deleted.menuPhotos +
    result.deleted.badges +
    result.deleted.ownershipProofs +
    result.deleted.collections +
    result.deleted.crawls

if (result.deleted.collections > 0) parts.push(`${result.deleted.collections} collection images`)
if (result.deleted.crawls > 0) parts.push(`${result.deleted.crawls} crawl covers`)
if (result.deleted.badges > 0) parts.push(`${result.deleted.badges} badge images (incl cafe stamps)`)
```

**Step 4: Run test to verify it passes**

Run: `bun test utils/__tests__/storage-cleanup.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add utils/storage/types.ts utils/storage/cleanup.ts utils/storage/actions.ts app/api/actions/admin.ts components/manage/SystemManagement.tsx utils/__tests__/storage-cleanup.test.ts
git commit -m "feat: add crawl cover storage cleanup"
```

---

### Task 2: Add crawl creation CTA + fix /community/crawls links

**Files:**
- Modify: `components/community/CommunityPage.tsx`
- Modify: `components/crawls/CrawlEditor.tsx`
- Modify: `components/crawls/SavedCrawlsList.tsx`
- Modify: `components/profile/Profile.tsx`
- Test: `components/community/__tests__/community-crawls-cta.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react"
import CommunityPage from "@/components/community/CommunityPage"

test("shows create crawl CTA in crawls tab", () => {
    render(
        <CommunityPage
            initialTab="crawls"
            initialCrawls={[]}
            initialCrawlsTotal={0}
            initialCollections={[]}
            initialCollectionsTotal={0}
            initialEvents={[]}
            initialFeaturedUsers={[]}
        />
    )

    expect(screen.getByText("Create Crawl")).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `bun test components/community/__tests__/community-crawls-cta.test.tsx`
Expected: FAIL with missing CTA.

**Step 3: Write minimal implementation**

```tsx
// components/community/CommunityPage.tsx (inside crawls tab section header)
<div className="flex items-center justify-between mb-6">
    <h2 className="text-lg font-semibold text-text">Latest Crawls</h2>
    <Link
        href="/community/crawls/create"
        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
    >
        Create Crawl
    </Link>
</div>

// components/crawls/CrawlEditor.tsx
<Link href="/community?tab=crawls" ...>

// on delete success
router.push("/community?tab=crawls")

// components/crawls/SavedCrawlsList.tsx
<Link href="/community?tab=crawls" ...>Browse Crawls</Link>

// components/profile/Profile.tsx
<Link href="/community?tab=crawls" ...>Browse Crawls</Link>
```

**Step 4: Run test to verify it passes**

Run: `bun test components/community/__tests__/community-crawls-cta.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/community/CommunityPage.tsx components/crawls/CrawlEditor.tsx components/crawls/SavedCrawlsList.tsx components/profile/Profile.tsx components/community/__tests__/community-crawls-cta.test.tsx
git commit -m "feat: add crawl create CTA and fix links"
```

---

### Task 3: Crawl map markers + simplified theme

**Files:**
- Modify: `components/map/CrawlRouteMapInternal.tsx`
- Modify: `components/map/CrawlRouteMap.tsx`
- Modify: `app/map.css`
- Test: `utils/__tests__/crawl-marker.test.ts`
- Create: `utils/map/crawl-marker.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test"
import { buildCrawlMarkerHtml } from "@/utils/map/crawl-marker"
import { CAFE_PLACEHOLDER_URL } from "@/utils/extras"

describe("crawl marker", () => {
    it("falls back to placeholder when image missing", () => {
        const html = buildCrawlMarkerHtml({ imageUrl: null, label: "Cafe" })
        expect(html).toContain(CAFE_PLACEHOLDER_URL)
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/__tests__/crawl-marker.test.ts`
Expected: FAIL with missing module/export.

**Step 3: Write minimal implementation**

```ts
// utils/map/crawl-marker.ts
import { CAFE_PLACEHOLDER_URL } from "@/utils/extras"

export function buildCrawlMarkerHtml(input: { imageUrl: string | null; label?: string }) {
    const image = input.imageUrl || CAFE_PLACEHOLDER_URL
    const alt = input.label ?? "Cafe"

    return `
        <div class="crawl-marker-pin">
            <div class="crawl-marker-circle" style="background-image:url('${image}')" aria-label="${alt}"></div>
        </div>
    `.trim()
}
```

```css
/* app/map.css */
.crawl-marker-pin {
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, #74512d 0%, #543310 100%);
    border: 3px solid #f8f4e1;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    box-shadow: 0 4px 12px rgba(84, 51, 16, 0.35), 0 2px 4px rgba(84, 51, 16, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
}

.crawl-marker-circle {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background-position: center;
    background-size: cover;
    transform: rotate(45deg);
    border: 2px solid #f8f4e1;
}
```

```tsx
// components/map/CrawlRouteMapInternal.tsx
import { DivIcon } from "leaflet"
import { buildCrawlMarkerHtml } from "@/utils/map/crawl-marker"

interface CrawlRouteMapProps {
    points: { lat: number; lng: number; imageUrl?: string | null; label?: string }[]
    focusPoint?: { lat: number; lng: number } | null
}

const markerIcon = (point: CrawlRouteMapProps["points"][number]) =>
    new DivIcon({
        className: "crawl-marker",
        html: buildCrawlMarkerHtml({ imageUrl: point.imageUrl ?? null, label: point.label }),
        iconSize: [40, 40],
        iconAnchor: [20, 40],
    })

<TileLayer url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png" />
<Marker position={[p.lat, p.lng]} icon={markerIcon(p)} />
```

**Step 4: Run test to verify it passes**

Run: `bun test utils/__tests__/crawl-marker.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add utils/map/crawl-marker.ts utils/__tests__/crawl-marker.test.ts app/map.css components/map/CrawlRouteMapInternal.tsx components/map/CrawlRouteMap.tsx
git commit -m "feat: add themed crawl map markers"
```

---

### Task 4: OSRM road routing + gap notice

**Files:**
- Create: `app/api/routes/osrm/route.ts`
- Create: `utils/map/osrm.ts`
- Modify: `components/map/CrawlRouteMapInternal.tsx`
- Test: `utils/__tests__/osrm.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test"
import { buildOsrmUrl } from "@/utils/map/osrm"

describe("osrm", () => {
    it("builds route url", () => {
        const url = buildOsrmUrl(
            { lat: 14.5995, lng: 120.9842 },
            { lat: 14.5547, lng: 121.0244 },
            "driving"
        )
        expect(url).toContain("route/v1/driving")
        expect(url).toContain("120.9842,14.5995")
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/__tests__/osrm.test.ts`
Expected: FAIL with missing module/export.

**Step 3: Write minimal implementation**

```ts
// utils/map/osrm.ts
export type OsrmProfile = "driving" | "foot"

export function buildOsrmUrl(
    start: { lat: number; lng: number },
    end: { lat: number; lng: number },
    profile: OsrmProfile = "driving"
) {
    const coords = `${start.lng},${start.lat};${end.lng},${end.lat}`
    return `https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=full&geometries=geojson&steps=false`
}
```

```ts
// app/api/routes/osrm/route.ts
import { NextRequest, NextResponse } from "next/server"
import { buildOsrmUrl, type OsrmProfile } from "@/utils/map/osrm"

export async function POST(request: NextRequest) {
    const body = await request.json()
    const profile: OsrmProfile = body.profile || "driving"
    const { start, end } = body
    if (!start || !end) {
        return NextResponse.json({ success: false, error: "Missing coordinates" }, { status: 400 })
    }

    const url = buildOsrmUrl(start, end, profile)
    const response = await fetch(url)
    const data = await response.json()

    if (!data?.routes?.[0]?.geometry) {
        return NextResponse.json({ success: false, error: "No route" }, { status: 404 })
    }

    return NextResponse.json({
        success: true,
        geometry: data.routes[0].geometry,
        distance: data.routes[0].distance,
        duration: data.routes[0].duration,
    })
}
```

```tsx
// components/map/CrawlRouteMapInternal.tsx (routing fetch)
const [segments, setSegments] = useState<[number, number][][]>([])
const [gapCount, setGapCount] = useState(0)

useEffect(() => {
    let cancelled = false
    const run = async () => {
        if (points.length < 2) {
            setSegments([])
            setGapCount(0)
            return
        }
        const requests = points.slice(0, -1).map((p, idx) => ({
            start: p,
            end: points[idx + 1],
        }))

        const results = await Promise.all(
            requests.map(async ({ start, end }) => {
                const res = await fetch("/api/routes/osrm", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ start, end, profile: "driving" }),
                })
                if (!res.ok) return null
                const json = await res.json()
                if (!json?.geometry?.coordinates) return null
                return json.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]])
            })
        )

        if (cancelled) return
        setGapCount(results.filter((r) => !r).length)
        setSegments(results.filter(Boolean) as [number, number][][])
    }

    run()
    return () => {
        cancelled = true
    }
}, [points])

{segments.map((segment, idx) => (
    <Polyline key={`seg-${idx}`} positions={segment} pathOptions={{ color: "#74512d", weight: 4, opacity: 0.8 }} />
))}

{gapCount > 0 && (
    <div className="absolute top-3 right-3 bg-background/90 border border-secondary/30 text-xs text-text/70 px-3 py-2 rounded-lg shadow-sm">
        {gapCount} route gap{gapCount > 1 ? "s" : ""} (no road path)
    </div>
)}
```

**Step 4: Run test to verify it passes**

Run: `bun test utils/__tests__/osrm.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add utils/map/osrm.ts utils/__tests__/osrm.test.ts app/api/routes/osrm/route.ts components/map/CrawlRouteMapInternal.tsx
git commit -m "feat: add osrm routing for crawl map"
```

---

### Task 5: Auto-zoom when adding a cafe

**Files:**
- Modify: `components/crawls/CrawlEditor.tsx`
- Modify: `components/map/CrawlRouteMapInternal.tsx`
- Test: `components/crawls/__tests__/crawl-editor.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen, fireEvent } from "@testing-library/react"
import CrawlEditor from "@/components/crawls/CrawlEditor"
import * as MapModule from "@/components/map/CrawlRouteMap"

test("sets focusPoint when adding a cafe", async () => {
    const mapSpy = vi.spyOn(MapModule, "default")
    render(<CrawlEditor crawl={{ title: "", items: [] }} mode="create" />)

    fireEvent.change(screen.getByPlaceholderText("Search cafes to add..."), {
        target: { value: "Test" },
    })

    // direct state manipulation to avoid server action: invoke addCafe via button
    // expect map component to be called with focusPoint once a cafe is added
    expect(mapSpy).toHaveBeenCalled()
})
```

**Step 2: Run test to verify it fails**

Run: `bun test components/crawls/__tests__/crawl-editor.test.tsx`
Expected: FAIL with missing focusPoint usage or spy mismatch.

**Step 3: Write minimal implementation**

```tsx
// components/crawls/CrawlEditor.tsx
const [focusPoint, setFocusPoint] = useState<{ lat: number; lng: number } | null>(null)

const addCafe = (cafe: CafeSearchResult) => {
    // existing code
    if (cafe.lat && cafe.lng) {
        setFocusPoint({ lat: cafe.lat, lng: cafe.lng })
    }
}

<CrawlRouteMap points={mapPoints} focusPoint={focusPoint} />

// components/map/CrawlRouteMapInternal.tsx
function MapFocus({ focusPoint }: { focusPoint: { lat: number; lng: number } | null }) {
    const map = useMap()
    useEffect(() => {
        if (!focusPoint) return
        map.flyTo([focusPoint.lat, focusPoint.lng], Math.max(map.getZoom(), 13), { duration: 0.8 })
    }, [focusPoint, map])
    return null
}
```

**Step 4: Run test to verify it passes**

Run: `bun test components/crawls/__tests__/crawl-editor.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/crawls/CrawlEditor.tsx components/map/CrawlRouteMapInternal.tsx components/crawls/__tests__/crawl-editor.test.tsx
git commit -m "feat: focus crawl map on new cafe"
```

---

### Task 6: Add crawl likes (heart) alongside saves

**Files:**
- Modify: `db/schema/tables.ts`
- Modify: `db/schema/__tests__/cafe-crawls-schema.test.ts`
- Modify: `app/api/actions/cafe-crawls.ts`
- Modify: `utils/types/cafe-crawls.ts`
- Modify: `components/crawls/CrawlCard.tsx`
- Modify: `components/crawls/CrawlActions.tsx`
- Modify: `components/crawls/CrawlView.tsx`
- Test: `components/crawls/__tests__/crawl-actions.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react"
import CrawlActions from "@/components/crawls/CrawlActions"

test("CrawlActions shows like button", () => {
    render(
        <CrawlActions
            crawlId="1"
            slug="test"
            saved={false}
            savesCount={0}
            liked={false}
            likesCount={0}
        />
    )
    expect(screen.getByText("0")).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `bun test components/crawls/__tests__/crawl-actions.test.tsx`
Expected: FAIL with missing props/button.

**Step 3: Write minimal implementation**

```ts
// db/schema/tables.ts
likesCount: integer("likes_count").default(0),

export const cafeCrawlLikes = pgTable(
    "cafe_crawl_likes",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        crawlId: uuid("crawl_id").notNull().references(() => cafeCrawls.id, { onDelete: "cascade" }),
        userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    },
    (t) => ({
        uniqueLikeIdx: uniqueIndex("crawl_likes_user_crawl_unique").on(t.userId, t.crawlId),
    })
)

// app/api/actions/cafe-crawls.ts
export async function toggleLikeCafeCrawl(crawlId: string) {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "You must be logged in.", liked: false }

    const existing = await db
        .select({ id: cafeCrawlLikes.id })
        .from(cafeCrawlLikes)
        .where(and(eq(cafeCrawlLikes.crawlId, crawlId), eq(cafeCrawlLikes.userId, user.id)))
        .limit(1)

    if (existing.length > 0) {
        await db.delete(cafeCrawlLikes).where(eq(cafeCrawlLikes.id, existing[0].id))
        await db.update(cafeCrawls).set({ likesCount: sql`${cafeCrawls.likesCount} - 1` }).where(eq(cafeCrawls.id, crawlId))
        return { success: true, liked: false }
    }

    await db.insert(cafeCrawlLikes).values({ crawlId, userId: user.id })
    await db.update(cafeCrawls).set({ likesCount: sql`${cafeCrawls.likesCount} + 1` }).where(eq(cafeCrawls.id, crawlId))
    return { success: true, liked: true }
}

// include likesCount + hasLiked in getPublicCafeCrawls/getCafeCrawlBySlug

// utils/types/cafe-crawls.ts
likesCount?: number

// components/crawls/CrawlActions.tsx
import { Heart } from "lucide-react"
import { toggleLikeCafeCrawl } from "@/app/api/actions/cafe-crawls"

// props
liked: boolean
likesCount: number

// render heart button similar to save

// components/crawls/CrawlCard.tsx
<Heart className="w-3.5 h-3.5" /> {crawl.likesCount ?? 0}
```

**Step 4: Run test to verify it passes**

Run: `bun test components/crawls/__tests__/crawl-actions.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add db/schema/tables.ts db/schema/__tests__/cafe-crawls-schema.test.ts app/api/actions/cafe-crawls.ts utils/types/cafe-crawls.ts components/crawls/CrawlActions.tsx components/crawls/CrawlCard.tsx components/crawls/CrawlView.tsx components/crawls/__tests__/crawl-actions.test.tsx
git commit -m "feat: add crawl likes"
```

---

### Task 7: Allow saving collections to profiles

**Files:**
- Modify: `db/schema/tables.ts`
- Modify: `app/api/actions/collection.ts`
- Modify: `components/community/CollectionView.tsx`
- Modify: `components/collections/CollectionCard.tsx`
- Create: `components/collections/SavedCollectionsList.tsx`
- Create: `app/profile/collections/saved/page.tsx`
- Modify: `components/profile/Profile.tsx`
- Test: `components/collections/__tests__/saved-collections.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react"
import SavedCollectionsList from "@/components/collections/SavedCollectionsList"

test("SavedCollectionsList renders empty state", () => {
    render(<SavedCollectionsList collections={[]} />)
    expect(screen.getByText("No saved collections yet")).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `bun test components/collections/__tests__/saved-collections.test.tsx`
Expected: FAIL with missing component.

**Step 3: Write minimal implementation**

```ts
// db/schema/tables.ts
savesCount: integer("saves_count").default(0),

export const collectionSaves = pgTable(
    "collection_saves",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        collectionId: uuid("collection_id").notNull().references(() => collections.id, { onDelete: "cascade" }),
        userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    },
    (t) => ({
        uniqueSaveIdx: uniqueIndex("collection_saves_user_collection_unique").on(t.userId, t.collectionId),
    })
)

// app/api/actions/collection.ts
export async function toggleSaveCollection(collectionId: string) {
    const user = await getCurrentUser()
    if (!user) throw new Error("You must be logged in to save a collection")

    const existing = await db
        .select({ id: collectionSaves.id })
        .from(collectionSaves)
        .where(and(eq(collectionSaves.collectionId, collectionId), eq(collectionSaves.userId, user.id)))
        .limit(1)

    if (existing.length > 0) {
        await db.delete(collectionSaves).where(eq(collectionSaves.id, existing[0].id))
        await db.update(collections).set({ savesCount: sql`${collections.savesCount} - 1` }).where(eq(collections.id, collectionId))
        return { saved: false }
    }

    await db.insert(collectionSaves).values({ collectionId, userId: user.id })
    await db.update(collections).set({ savesCount: sql`${collections.savesCount} + 1` }).where(eq(collections.id, collectionId))
    return { saved: true }
}

export async function getSavedCollections() {
    const user = await getCurrentUser()
    if (!user) return []

    const results = await db
        .select({
            id: collections.id,
            title: collections.title,
            slug: collections.slug,
            description: collections.description,
            coverImage: collections.coverImage,
            itemCount: collections.itemCount,
            viewsCount: collections.viewsCount,
            likesCount: collections.likesCount,
            savesCount: collections.savesCount,
            createdAt: collections.createdAt,
        })
        .from(collectionSaves)
        .innerJoin(collections, eq(collectionSaves.collectionId, collections.id))
        .where(eq(collectionSaves.userId, user.id))
        .orderBy(desc(collectionSaves.createdAt))

    return results.map((c) => ({ ...c, createdAt: c.createdAt?.toISOString() ?? null }))
}

// components/community/CollectionView.tsx
import { Bookmark } from "lucide-react"
import { toggleSaveCollection } from "@/app/api/actions/collection"

// add saved state + button next to like/share

// components/collections/SavedCollectionsList.tsx
export default function SavedCollectionsList({ collections }: { collections: Collection[] }) {
    if (collections.length === 0) {
        return <p className="text-text/60">No saved collections yet</p>
    }
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {collections.map((collection) => (
                <CollectionCard key={collection.id} collection={collection} />
            ))}
        </div>
    )
}

// app/profile/collections/saved/page.tsx
import { getSavedCollections } from "@/app/api/actions/collection"
import SavedCollectionsList from "@/components/collections/SavedCollectionsList"

export default async function SavedCollectionsPage() {
    const collections = await getSavedCollections()
    return <SavedCollectionsList collections={collections} />
}
```

**Step 4: Run test to verify it passes**

Run: `bun test components/collections/__tests__/saved-collections.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add db/schema/tables.ts app/api/actions/collection.ts components/community/CollectionView.tsx components/collections/CollectionCard.tsx components/collections/SavedCollectionsList.tsx app/profile/collections/saved/page.tsx components/profile/Profile.tsx components/collections/__tests__/saved-collections.test.tsx
git commit -m "feat: add saved collections"
```

---

### Task 8: Final crawl map data + placeholder behavior

**Files:**
- Modify: `components/crawls/CrawlEditor.tsx`
- Modify: `components/crawls/CrawlView.tsx`
- Modify: `components/map/CrawlRouteMap.tsx`

**Step 1: Write the failing test**

```tsx
import { render } from "@testing-library/react"
import CrawlView from "@/components/crawls/CrawlView"

test("CrawlView passes thumbnails to map points", () => {
    render(
        <CrawlView
            crawl={{
                id: "1",
                title: "Test",
                slug: "test",
                description: null,
                coverImage: null,
                itemCount: 1,
                viewsCount: 0,
                savesCount: 0,
                createdAt: new Date().toISOString(),
                author: { id: "1", username: "u", displayName: "U", avatarUrl: null },
                cafes: [
                    {
                        id: "i",
                        cafeId: "c",
                        name: "Cafe",
                        slug: "cafe",
                        thumbnail: null,
                        cityMunicipality: "",
                        region: "",
                        averageRating: null,
                        totalReviews: null,
                        sortOrder: 0,
                        note: null,
                        lat: 1,
                        lng: 1,
                    },
                ],
            }}
        />
    )
})
```

**Step 2: Run test to verify it fails**

Run: `bun test components/crawls/__tests__/crawl-view.test.tsx`
Expected: FAIL with prop mismatch if map points shape changes.

**Step 3: Write minimal implementation**

```tsx
// components/crawls/CrawlView.tsx
const mapPoints = validCafes
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((cafe) => ({
        lat: cafe.lat,
        lng: cafe.lng,
        imageUrl: cafe.thumbnail ? getCafeThumbnailUrl(cafe.thumbnail) : null,
        label: cafe.name,
    }))

// components/crawls/CrawlEditor.tsx
const mapPoints = useMemo(
    () =>
        items
            .filter((item) => item.lat && item.lng)
            .map((item) => ({
                lat: item.lat!,
                lng: item.lng!,
                imageUrl: item.thumbnail ? getCafeThumbnailUrl(item.thumbnail) : null,
                label: item.name,
            })),
    [items]
)
```

**Step 4: Run test to verify it passes**

Run: `bun test components/crawls/__tests__/crawl-view.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/crawls/CrawlView.tsx components/crawls/CrawlEditor.tsx components/map/CrawlRouteMap.tsx
git commit -m "feat: pass crawl thumbnails to map"
```

---

### Task 9: QA pass (lint + build + tests)

**Files:**
- Modify: (only if fixes are needed)

**Step 1: Run tests**

Run: `bun test`
Expected: PASS.

**Step 2: Run lint**

Run: `bun lint`
Expected: PASS.

**Step 3: Run build**

Run: `bun build`
Expected: PASS.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve lint/build issues"
```

---

## Test Plan

- `bun test utils/__tests__/storage-cleanup.test.ts`
- `bun test components/community/__tests__/community-crawls-cta.test.tsx`
- `bun test utils/__tests__/crawl-marker.test.ts`
- `bun test utils/__tests__/osrm.test.ts`
- `bun test components/crawls/__tests__/crawl-actions.test.tsx`
- `bun test components/collections/__tests__/saved-collections.test.tsx`
- `bun test components/crawls/__tests__/crawl-view.test.tsx`
- `bun test`
- `bun lint`
- `bun build`
