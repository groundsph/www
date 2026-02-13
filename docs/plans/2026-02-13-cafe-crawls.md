# Cafe Crawls Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a Community-first "Cafe Crawls" feature with robust CRUD, sharing, saving, and a live route preview map that matches Grounds styling across desktop and mobile.

**Architecture:** Add a dedicated Cafe Crawls domain (schema + actions + components) parallel to Collections, expose it under `/community` as the first tab, and create a public crawl page with a blog-like layout. Use Leaflet for route visualization and Zod-validated server actions for type-safe CRUD. Persist ordered cafes via a crawl items table to keep future migrations and analytics straightforward.

**Tech Stack:** Next.js App Router, React (client/server components), Drizzle ORM (Postgres), Zod, Tailwind CSS v4, Leaflet/react-leaflet, Bun test runner.

---

### Task 1: Add Cafe Crawl schema + enums

**Files:**
- Modify: `db/schema/enums.ts`
- Modify: `db/schema/tables.ts`
- Modify: `db/schema/index.ts`
- Test: `db/schema/__tests__/cafe-crawls-schema.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test"
import { cafeCrawls, cafeCrawlItems, cafeCrawlSaves } from "@/db/schema"

describe("cafe crawls schema", () => {
    it("includes core tables", () => {
        expect(cafeCrawls).toHaveProperty("title")
        expect(cafeCrawlItems).toHaveProperty("sortOrder")
        expect(cafeCrawlSaves).toHaveProperty("userId")
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test db/schema/__tests__/cafe-crawls-schema.test.ts`
Expected: FAIL with missing exports.

**Step 3: Write minimal implementation**

```ts
// db/schema/enums.ts
export const crawlStatusEnum = pgEnum("crawl_status", [
    "draft",
    "published",
    "archived",
])

// db/schema/tables.ts
export const cafeCrawls = pgTable("cafe_crawls", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
        .notNull()
        .references(() => profiles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    coverImage: text("cover_image"),
    status: enums.crawlStatusEnum("status").default("draft"),
    isPublic: boolean("is_public").default(true),
    itemCount: integer("item_count").default(0),
    viewsCount: integer("views_count").default(0),
    savesCount: integer("saves_count").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})

export const cafeCrawlItems = pgTable("cafe_crawl_items", {
    id: uuid("id").primaryKey().defaultRandom(),
    crawlId: uuid("crawl_id")
        .notNull()
        .references(() => cafeCrawls.id, { onDelete: "cascade" }),
    cafeId: uuid("cafe_id")
        .notNull()
        .references(() => cafes.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").default(0),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

export const cafeCrawlSaves = pgTable("cafe_crawl_saves", {
    id: uuid("id").primaryKey().defaultRandom(),
    crawlId: uuid("crawl_id")
        .notNull()
        .references(() => cafeCrawls.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
        .notNull()
        .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
    uniqueSaveIdx: uniqueIndex("crawl_saves_user_crawl_unique").on(t.userId, t.crawlId),
}))

export const cafeCrawlReports = pgTable("cafe_crawl_reports", {
    id: uuid("id").primaryKey().defaultRandom(),
    crawlId: uuid("crawl_id")
        .notNull()
        .references(() => cafeCrawls.id, { onDelete: "cascade" }),
    reporterId: uuid("reporter_id")
        .notNull()
        .references(() => profiles.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    details: text("details"),
    status: text("status").default("pending"),
    adminNotes: text("admin_notes"),
    reviewedBy: uuid("reviewed_by").references(() => profiles.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// db/schema/index.ts
export * from "./tables"
```

**Step 4: Run test to verify it passes**

Run: `bun test db/schema/__tests__/cafe-crawls-schema.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add db/schema/enums.ts db/schema/tables.ts db/schema/index.ts db/schema/__tests__/cafe-crawls-schema.test.ts
git commit -m "feat: add cafe crawls schema"
```

---

### Task 2: Add Zod validation + shared types

**Files:**
- Create: `utils/validation/cafe-crawls.ts`
- Create: `utils/types/cafe-crawls.ts`
- Test: `utils/validation/__tests__/cafe-crawls.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test"
import { createCafeCrawlSchema } from "@/utils/validation/cafe-crawls"

describe("cafe crawl validation", () => {
    it("rejects empty title", () => {
        const result = createCafeCrawlSchema.safeParse({ title: "" })
        expect(result.success).toBe(false)
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/validation/__tests__/cafe-crawls.test.ts`
Expected: FAIL with missing module/export.

**Step 3: Write minimal implementation**

```ts
// utils/validation/cafe-crawls.ts
import { z } from "zod"

export const crawlItemSchema = z.object({
    cafeId: z.string().uuid(),
    note: z.string().max(200).optional(),
    sortOrder: z.number().int().min(0).optional(),
})

export const createCafeCrawlSchema = z.object({
    title: z.string().min(1, "Title is required").max(100),
    description: z.string().max(500).optional(),
    coverImage: z.string().url().optional(),
    isPublic: z.boolean().optional(),
    status: z.enum(["draft", "published", "archived"]).optional(),
    items: z.array(crawlItemSchema).optional(),
})

export const updateCafeCrawlSchema = createCafeCrawlSchema.partial()

export const reorderCafeCrawlSchema = z.object({
    items: z.array(
        z.object({
            cafeId: z.string().uuid(),
            sortOrder: z.number().int().min(0),
        })
    ),
})

export type CreateCafeCrawlInput = z.infer<typeof createCafeCrawlSchema>
export type UpdateCafeCrawlInput = z.infer<typeof updateCafeCrawlSchema>
export type ReorderCafeCrawlInput = z.infer<typeof reorderCafeCrawlSchema>
```

**Step 4: Run test to verify it passes**

Run: `bun test utils/validation/__tests__/cafe-crawls.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add utils/validation/cafe-crawls.ts utils/types/cafe-crawls.ts utils/validation/__tests__/cafe-crawls.test.ts
git commit -m "feat: add cafe crawl validation"
```

---

### Task 3: Server actions for crawl CRUD + search + saving

**Files:**
- Create: `app/api/actions/cafe-crawls.ts`
- Modify: `app/api/actions/community.ts`
- Test: `app/api/actions/__tests__/cafe-crawls.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test"
import { createCafeCrawl } from "@/app/api/actions/cafe-crawls"

describe("cafe crawls actions", () => {
    it("returns structured response", async () => {
        const result = await createCafeCrawl({ title: "Test Crawl" })
        expect(result).toHaveProperty("success")
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test app/api/actions/__tests__/cafe-crawls.test.ts`
Expected: FAIL with missing module/export.

**Step 3: Write minimal implementation**

```ts
// app/api/actions/cafe-crawls.ts
"use server"

import { db } from "@/db"
import {
    cafeCrawls,
    cafeCrawlItems,
    cafeCrawlSaves,
    cafeCrawlReports,
    cafes,
    cafeRatingStats,
    profiles,
} from "@/db/schema"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { and, eq, desc, inArray, sql } from "drizzle-orm"
import {
    createCafeCrawlSchema,
    updateCafeCrawlSchema,
    reorderCafeCrawlSchema,
} from "@/utils/validation/cafe-crawls"

export async function createCafeCrawl(input: unknown) {
    const user = (await auth.api.getSession({ headers: await headers() }))?.user
    if (!user) return { success: false, error: "You must be logged in." }

    const parsed = createCafeCrawlSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.message }
    }

    // generate slug and insert, then insert items with sortOrder
    // return { success: true, data: { id, slug } }
}

export async function getPublicCafeCrawls(page = 1, pageSize = 12) {
    // select published + public, join author, return total
}

export async function getCafeCrawlBySlug(slug: string) {
    // select crawl + items + cafe details, increment views
}

export async function updateCafeCrawl(id: string, input: unknown) {
    // verify owner, validate, update
}

export async function reorderCafeCrawl(id: string, input: unknown) {
    // update sortOrder from payload
}

export async function toggleSaveCafeCrawl(crawlId: string) {
    // insert/delete from cafeCrawlSaves, update savesCount
}

export async function reportCafeCrawl(input: { crawlId: string; reason: string; details?: string }) {
    // insert report, return success
}
```

Also add `getPublicCafeCrawls` usage to `app/api/actions/community.ts` for the Community tab initial fetch.

**Step 4: Run test to verify it passes**

Run: `bun test app/api/actions/__tests__/cafe-crawls.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add app/api/actions/cafe-crawls.ts app/api/actions/community.ts app/api/actions/__tests__/cafe-crawls.test.ts
git commit -m "feat: add cafe crawls actions"
```

---

### Task 4: Community tab + listing UI

**Files:**
- Modify: `app/community/page.tsx`
- Modify: `components/community/CommunityPage.tsx`
- Create: `components/crawls/CrawlCard.tsx`
- Create: `components/crawls/CrawlList.tsx`
- Test: `components/crawls/__tests__/crawl-card.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react"
import CrawlCard from "@/components/crawls/CrawlCard"

test("CrawlCard renders title", () => {
    render(<CrawlCard crawl={{ id: "1", title: "Manila Hop", slug: "manila-hop", itemCount: 3 }} />)
    expect(screen.getByText("Manila Hop")).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `bun test components/crawls/__tests__/crawl-card.test.tsx`
Expected: FAIL with missing component.

**Step 3: Write minimal implementation**

```tsx
// components/crawls/CrawlCard.tsx
import Link from "next/link"
import Image from "next/image"
import { Coffee, Eye, Bookmark } from "lucide-react"

export default function CrawlCard({ crawl }: { crawl: { id: string; title: string; slug: string; coverImage?: string | null; itemCount?: number; viewsCount?: number; savesCount?: number } }) {
    return (
        <Link href={`/community/crawls/${crawl.slug}`} className='group block bg-background border border-secondary/20 rounded-2xl overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all'>
            <div className='relative aspect-16/10 bg-secondary/10'>
                {crawl.coverImage ? (
                    <Image src={crawl.coverImage} alt={crawl.title} fill className='object-cover group-hover:scale-105 transition-transform duration-300' />
                ) : (
                    <div className='w-full h-full flex items-center justify-center bg-linear-to-br from-primary/20 to-accent/20'>
                        <Coffee className='w-12 h-12 text-primary/40' />
                    </div>
                )}
            </div>
            <div className='p-4'>
                <h3 className='font-serif font-semibold text-lg text-text group-hover:text-primary transition-colors line-clamp-1'>
                    {crawl.title}
                </h3>
                <div className='flex items-center gap-4 mt-3 text-sm text-text/50'>
                    <span className='flex items-center gap-1'><Coffee className='w-3.5 h-3.5' />{crawl.itemCount ?? 0}</span>
                    <span className='flex items-center gap-1'><Eye className='w-3.5 h-3.5' />{crawl.viewsCount ?? 0}</span>
                    <span className='flex items-center gap-1'><Bookmark className='w-3.5 h-3.5' />{crawl.savesCount ?? 0}</span>
                </div>
            </div>
        </Link>
    )
}
```

Update Community tab list to include `tab=crawls` and make it the first tab (default if no query param). Fetch initial crawls in `app/community/page.tsx` via `getPublicCafeCrawls`.

**Step 4: Run test to verify it passes**

Run: `bun test components/crawls/__tests__/crawl-card.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add app/community/page.tsx components/community/CommunityPage.tsx components/crawls/CrawlCard.tsx components/crawls/CrawlList.tsx components/crawls/__tests__/crawl-card.test.tsx
git commit -m "feat: add cafe crawls community tab"
```

---

### Task 5: Public crawl page (blog-like layout + map + cafe list)

**Files:**
- Create: `app/community/crawls/[slug]/page.tsx`
- Create: `components/crawls/CrawlView.tsx`
- Create: `components/map/CrawlRouteMap.tsx`
- Test: `components/crawls/__tests__/crawl-view.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react"
import CrawlView from "@/components/crawls/CrawlView"

test("CrawlView renders title", () => {
    render(<CrawlView crawl={{ title: "Laguna Loop", cafes: [] }} />)
    expect(screen.getByText("Laguna Loop")).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `bun test components/crawls/__tests__/crawl-view.test.tsx`
Expected: FAIL with missing component.

**Step 3: Write minimal implementation**

```tsx
// components/map/CrawlRouteMap.tsx
"use client"

import { MapContainer, TileLayer, Marker, Polyline } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import "@/app/map.css"

export default function CrawlRouteMap({ points }: { points: { lat: number; lng: number }[] }) {
    return (
        <MapContainer center={[12.8797, 121.774]} zoom={6} scrollWheelZoom className='h-full w-full' style={{ minHeight: "420px" }}>
            <TileLayer attribution='&copy; <a href="https://carto.com/">CARTO</a>' url='https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' />
            {points.map((p, idx) => (
                <Marker key={`${p.lat}-${p.lng}-${idx}`} position={[p.lat, p.lng]} />
            ))}
            {points.length >= 2 && (
                <Polyline positions={points.map((p) => [p.lat, p.lng])} pathOptions={{ color: "#74512d", weight: 4, opacity: 0.8 }} />
            )}
        </MapContainer>
    )
}
```

Implement `CrawlView` to mirror blog layout: title, description, poster details, date, views, report button, and a styled map block. Below the map, list cafes in the same card style as the landing page "recent reviews" section, but using crawl cafe details.

**Step 4: Run test to verify it passes**

Run: `bun test components/crawls/__tests__/crawl-view.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add app/community/crawls/[slug]/page.tsx components/crawls/CrawlView.tsx components/map/CrawlRouteMap.tsx components/crawls/__tests__/crawl-view.test.tsx
git commit -m "feat: add cafe crawl public page"
```

---

### Task 6: Crawl editor with live desktop map + mobile preview toggle

**Files:**
- Create: `app/community/crawls/create/page.tsx`
- Create: `app/community/crawls/[id]/edit/page.tsx`
- Create: `components/crawls/CrawlEditor.tsx`
- Modify: `app/api/actions/cafe-crawls.ts`
- Test: `components/crawls/__tests__/crawl-editor.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react"
import CrawlEditor from "@/components/crawls/CrawlEditor"

test("CrawlEditor shows add cafes", () => {
    render(<CrawlEditor crawl={{ title: "", items: [] }} />)
    expect(screen.getByText("Add Cafes")).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `bun test components/crawls/__tests__/crawl-editor.test.tsx`
Expected: FAIL with missing component.

**Step 3: Write minimal implementation**

```tsx
// components/crawls/CrawlEditor.tsx
"use client"

import { useState } from "react"
import CrawlRouteMap from "@/components/map/CrawlRouteMap"

export default function CrawlEditor({ crawl }: { crawl: { title: string; items: { cafeId: string }[] } }) {
    const [showMobileMap, setShowMobileMap] = useState(false)

    return (
        <div className='min-h-screen bg-background'>
            <div className='max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8'>
                <div className='lg:col-span-1'>
                    <h2 className='font-serif text-xl mb-4'>Details</h2>
                </div>
                <div className='lg:col-span-2 space-y-6'>
                    <div className='flex items-center justify-between'>
                        <h3 className='text-sm font-medium text-text'>Add Cafes</h3>
                        <button className='lg:hidden text-sm text-primary' onClick={() => setShowMobileMap((v) => !v)}>
                            {showMobileMap ? "Hide Map" : "Preview Map"}
                        </button>
                    </div>
                    <div className='hidden lg:block rounded-2xl overflow-hidden border border-secondary/20'>
                        <CrawlRouteMap points={[]} />
                    </div>
                    {showMobileMap && (
                        <div className='lg:hidden rounded-2xl overflow-hidden border border-secondary/20'>
                            <CrawlRouteMap points={[]} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
```

Wire editor to actions: add/remove cafes, reorder, update notes, and save. Use existing `searchCafesForCollection` pattern, but include lat/lng for map points via a new query helper in `app/api/actions/cafe-crawls.ts`.

**Step 4: Run test to verify it passes**

Run: `bun test components/crawls/__tests__/crawl-editor.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add app/community/crawls/create/page.tsx app/community/crawls/[id]/edit/page.tsx components/crawls/CrawlEditor.tsx components/crawls/__tests__/crawl-editor.test.tsx app/api/actions/cafe-crawls.ts
git commit -m "feat: add cafe crawl editor"
```

---

### Task 7: Sharing, saving, and reporting UI

**Files:**
- Modify: `components/crawls/CrawlView.tsx`
- Create: `components/crawls/CrawlActions.tsx`
- Create: `components/crawls/CrawlReportButton.tsx`
- Modify: `app/api/actions/cafe-crawls.ts`
- Test: `components/crawls/__tests__/crawl-actions.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react"
import CrawlActions from "@/components/crawls/CrawlActions"

test("CrawlActions shows save button", () => {
    render(<CrawlActions crawlId='1' saved={false} savesCount={0} />)
    expect(screen.getByText("Save")).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `bun test components/crawls/__tests__/crawl-actions.test.tsx`
Expected: FAIL with missing component.

**Step 3: Write minimal implementation**

```tsx
// components/crawls/CrawlActions.tsx
"use client"

import { Bookmark, Share2, Flag } from "lucide-react"

export default function CrawlActions({ crawlId, saved, savesCount }: { crawlId: string; saved: boolean; savesCount: number }) {
    return (
        <div className='flex items-center gap-3'>
            <button className='flex items-center gap-2 px-4 py-2 rounded-full border border-secondary/30 text-text/70'>
                <Bookmark className='w-4 h-4' />
                {saved ? "Saved" : "Save"} {savesCount}
            </button>
            <button className='flex items-center gap-2 px-4 py-2 rounded-full border border-secondary/30 text-text/70'>
                <Share2 className='w-4 h-4' /> Share
            </button>
            <button className='flex items-center gap-2 px-4 py-2 rounded-full border border-secondary/30 text-text/70'>
                <Flag className='w-4 h-4' /> Report
            </button>
        </div>
    )
}
```

Wire save + report to server actions, and use the same clipboard share approach as Collections. Add a report modal patterned after `components/blog/ReportButton.tsx` with a crawl-specific action.

**Step 4: Run test to verify it passes**

Run: `bun test components/crawls/__tests__/crawl-actions.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/crawls/CrawlView.tsx components/crawls/CrawlActions.tsx components/crawls/CrawlReportButton.tsx components/crawls/__tests__/crawl-actions.test.tsx app/api/actions/cafe-crawls.ts
git commit -m "feat: add cafe crawl actions"
```

---

### Task 8: Saved crawls page (profile)

**Files:**
- Create: `app/profile/crawls/page.tsx`
- Create: `components/crawls/SavedCrawlsList.tsx`
- Modify: `app/api/actions/cafe-crawls.ts`
- Test: `components/crawls/__tests__/saved-crawls.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react"
import SavedCrawlsList from "@/components/crawls/SavedCrawlsList"

test("SavedCrawlsList renders empty state", () => {
    render(<SavedCrawlsList crawls={[]} />)
    expect(screen.getByText("No saved crawls yet")).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `bun test components/crawls/__tests__/saved-crawls.test.tsx`
Expected: FAIL with missing component.

**Step 3: Write minimal implementation**

```tsx
// components/crawls/SavedCrawlsList.tsx
export default function SavedCrawlsList({ crawls }: { crawls: { id: string; title: string; slug: string }[] }) {
    if (crawls.length === 0) {
        return <p className='text-text/60'>No saved crawls yet</p>
    }
    return (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
            {crawls.map((crawl) => (
                <div key={crawl.id}>{crawl.title}</div>
            ))}
        </div>
    )
}
```

Add a `getSavedCafeCrawls` action and list the user's saved crawls in the profile page for quick access.

**Step 4: Run test to verify it passes**

Run: `bun test components/crawls/__tests__/saved-crawls.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add app/profile/crawls/page.tsx components/crawls/SavedCrawlsList.tsx components/crawls/__tests__/saved-crawls.test.tsx app/api/actions/cafe-crawls.ts
git commit -m "feat: add saved cafe crawls page"
```

---

### Task 9: Metadata + sharing hooks for crawl pages

**Files:**
- Create: `app/community/crawls/[slug]/opengraph-image.tsx`
- Modify: `app/community/crawls/[slug]/page.tsx`
- Modify: `utils/og/metadata.ts`
- Test: `utils/__tests__/crawl-og-metadata.test.ts`

**Step 1: Write the failing test**

```ts
import { buildCrawlShareMetadata } from "@/utils/og/metadata"

test("buildCrawlShareMetadata sets og image", () => {
    const meta = buildCrawlShareMetadata({
        title: "Laguna Loop",
        description: "A 5-stop route",
        ogImageUrl: "https://grounds.ph/community/crawls/laguna-loop/opengraph-image",
    })
    expect(meta.openGraph?.images?.[0]?.url).toContain("opengraph-image")
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/__tests__/crawl-og-metadata.test.ts`
Expected: FAIL with missing export.

**Step 3: Write minimal implementation**

```ts
// utils/og/metadata.ts
export function buildCrawlShareMetadata(input: { title: string; description: string; ogImageUrl: string }) {
    return buildShareMetadata(input)
}
```

Add a crawl-specific OG template that mirrors the Community palette and includes the route count and author.

**Step 4: Run test to verify it passes**

Run: `bun test utils/__tests__/crawl-og-metadata.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add app/community/crawls/[slug]/opengraph-image.tsx app/community/crawls/[slug]/page.tsx utils/og/metadata.ts utils/__tests__/crawl-og-metadata.test.ts
git commit -m "feat: add cafe crawl og metadata"
```

---

### Task 10: QA pass (lint + build + tests)

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

## Notes

- Assumption: The Community page uses `tab=crawls` as the default and the "Crawls" tab appears first (ahead of Collections). If you want Collections first, only the tab order and default tab change.
- Use the existing collections editor as a structural reference; do not reuse its schema to keep crawl routes extensible.
- Map styling should mirror `components/map/CafeMap.tsx` (theme colors, light tile layer). Use a Polyline color that matches the primary token (`#74512d`).
- For mobile, hide the map by default and toggle with a "Preview Map" button.
- All server actions should return `{ success: boolean, error?: string, data?: T }` and validate input with Zod.

---

## Test Plan

- `bun test db/schema/__tests__/cafe-crawls-schema.test.ts`
- `bun test utils/validation/__tests__/cafe-crawls.test.ts`
- `bun test app/api/actions/__tests__/cafe-crawls.test.ts`
- `bun test components/crawls/__tests__/crawl-card.test.tsx`
- `bun test components/crawls/__tests__/crawl-view.test.tsx`
- `bun test components/crawls/__tests__/crawl-editor.test.tsx`
- `bun test components/crawls/__tests__/crawl-actions.test.tsx`
- `bun test components/crawls/__tests__/saved-crawls.test.tsx`
- `bun test utils/__tests__/crawl-og-metadata.test.ts`
- `bun test`
- `bun lint`
- `bun build`
