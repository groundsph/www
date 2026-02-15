# Cafe Crawl Mobile Map + SEO Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent NaN LatLng runtime errors in crawl maps (especially mobile) and improve sitemap + SEO metadata coverage for public pages.

**Architecture:** Add a small coordinate validation utility used by crawl map data builders and Leaflet map components to skip invalid lat/lng. Expand sitemap generation with public crawls and consistent metadata helpers (canonical URLs, OG/Twitter images, and noindex for non-public routes).

**Tech Stack:** Next.js App Router, React/TypeScript, Leaflet/react-leaflet, Drizzle ORM, Bun test runner.

---

### Task 1: Coordinate validation helper

**Files:**
- Create: `utils/map/coords.ts`
- Test: `utils/map/__tests__/coords.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "bun:test"
import { isValidLatLng, normalizeLatLng } from "@/utils/map/coords"

describe("coords", () => {
    it("accepts valid lat/lng (including 0)", () => {
        expect(isValidLatLng({ lat: 14.5995, lng: 120.9842 })).toBe(true)
        expect(isValidLatLng({ lat: 0, lng: 0 })).toBe(true)
    })

    it("rejects NaN, null, and undefined", () => {
        expect(isValidLatLng({ lat: Number.NaN, lng: 120 })).toBe(false)
        expect(isValidLatLng({ lat: 14, lng: Number.NaN })).toBe(false)
        expect(isValidLatLng({ lat: null, lng: 120 } as never)).toBe(false)
        expect(isValidLatLng({ lat: undefined, lng: undefined } as never)).toBe(false)
    })

    it("rejects out-of-range values", () => {
        expect(isValidLatLng({ lat: 91, lng: 120 })).toBe(false)
        expect(isValidLatLng({ lat: 14, lng: 181 })).toBe(false)
    })

    it("normalizes numeric strings", () => {
        expect(normalizeLatLng({ lat: "14.5995", lng: "120.9842" })).toEqual({
            lat: 14.5995,
            lng: 120.9842,
        })
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/map/__tests__/coords.test.ts`

Expected: FAIL with missing module or undefined export.

**Step 3: Write minimal implementation**

```ts
export interface LatLng {
    lat: number
    lng: number
}

function toFiniteNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) return parsed
    }
    return null
}

function isInRange(lat: number, lng: number) {
    return Math.abs(lat) <= 90 && Math.abs(lng) <= 180
}

export function normalizeLatLng(
    point: { lat: unknown; lng: unknown } | null | undefined
): LatLng | null {
    if (!point) return null
    const lat = toFiniteNumber(point.lat)
    const lng = toFiniteNumber(point.lng)
    if (lat === null || lng === null) return null
    if (!isInRange(lat, lng)) return null
    return { lat, lng }
}

export function isValidLatLng(
    point: { lat: unknown; lng: unknown } | null | undefined
): point is LatLng {
    return normalizeLatLng(point) !== null
}
```

**Step 4: Run test to verify it passes**

Run: `bun test utils/map/__tests__/coords.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add utils/map/coords.ts utils/map/__tests__/coords.test.ts
git commit -m "feat: add latlng validation helpers"
```

---

### Task 2: Use validation in crawl map data and Leaflet components

**Files:**
- Modify: `utils/map/crawl-map-points.ts`
- Modify: `components/map/CrawlRouteMapInternal.tsx`
- Modify: `components/crawls/CrawlEditor.tsx`
- Test: `utils/map/__tests__/crawl-map-points.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "bun:test"
import { buildCrawlMapPoints } from "@/utils/map/crawl-map-points"

describe("buildCrawlMapPoints", () => {
    it("filters invalid lat/lng and preserves sort order", () => {
        const points = buildCrawlMapPoints([
            {
                name: "Valid",
                slug: "valid",
                thumbnail: null,
                lat: 14.5,
                lng: 120.9,
                sortOrder: 1,
            },
            {
                name: "Invalid",
                slug: "invalid",
                thumbnail: null,
                lat: Number.NaN,
                lng: 120.9,
                sortOrder: 0,
            },
            {
                name: "String",
                slug: "string",
                thumbnail: null,
                lat: "14.6",
                lng: "121.0",
                sortOrder: 2,
            } as never,
        ])

        expect(points.length).toBe(2)
        expect(points[0].label).toBe("Valid")
        expect(points[1].label).toBe("String")
        expect(points[0].index).toBe(1)
        expect(points[1].index).toBe(2)
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/map/__tests__/crawl-map-points.test.ts`

Expected: FAIL because invalid points are not filtered or helper is missing.

**Step 3: Write minimal implementation**

- Update `utils/map/crawl-map-points.ts` to normalize coordinates:

```ts
import { normalizeLatLng } from "@/utils/map/coords"

export function buildCrawlMapPoints(items: CrawlMapItem[]): MapPoint[] {
    return items
        .map((item) => ({ item, coords: normalizeLatLng(item) }))
        .filter((entry): entry is { item: CrawlMapItem; coords: { lat: number; lng: number } } =>
            entry.coords !== null
        )
        .sort((a, b) => a.item.sortOrder - b.item.sortOrder)
        .map(({ item, coords }, index) => ({
            lat: coords.lat,
            lng: coords.lng,
            imageUrl: item.thumbnail,
            label: item.name,
            index: index + 1,
            cafeSlug: item.slug,
        }))
}
```

- Update `components/map/CrawlRouteMapInternal.tsx` to guard against invalid focus/points:
  - Normalize `focusPoint` before `flyTo`.
  - Build `normalizedPoints` from `points` using `normalizeLatLng` and use it for markers, bounds, and route segments.
  - Fallback center: valid focusPoint -> first valid point -> Philippines default.

```ts
import { normalizeLatLng } from "@/utils/map/coords"

function MapFocus({ focusPoint }: { focusPoint: { lat: number; lng: number } | null }) {
    const map = useMap()
    useEffect(() => {
        const normalized = normalizeLatLng(focusPoint)
        if (!normalized) return
        map.flyTo([normalized.lat, normalized.lng], Math.max(map.getZoom(), 13), { duration: 0.8 })
    }, [focusPoint, map])
    return null
}

// Inside CrawlRouteMap
const normalizedPoints = useMemo(
    () =>
        points
            .map((point) => ({ point, coords: normalizeLatLng(point) }))
            .filter((entry): entry is { point: CrawlRouteMapProps["points"][number]; coords: { lat: number; lng: number } } =>
                entry.coords !== null
            )
            .map(({ point, coords }) => ({ ...point, lat: coords.lat, lng: coords.lng })),
    [points]
)

const normalizedFocus = normalizeLatLng(focusPoint ?? null)
const defaultCenter: [number, number] = normalizedFocus
    ? [normalizedFocus.lat, normalizedFocus.lng]
    : normalizedPoints[0]
      ? [normalizedPoints[0].lat, normalizedPoints[0].lng]
      : [12.8797, 121.774]
```

- Update `components/crawls/CrawlEditor.tsx` to use `normalizeLatLng` for map points and focus:

```ts
import { normalizeLatLng } from "@/utils/map/coords"

const mapPoints = useMemo(
    () =>
        items
            .map((item) => ({ item, coords: normalizeLatLng(item) }))
            .filter((entry): entry is { item: CrawlItem; coords: { lat: number; lng: number } } =>
                entry.coords !== null
            )
            .map(({ item, coords }, index) => ({
                lat: coords.lat,
                lng: coords.lng,
                imageUrl: item.thumbnail ? getCafeThumbnailUrl(item.thumbnail) : null,
                label: item.name || "",
                index: index + 1,
                cafeSlug: item.slug,
            })),
    [items]
)

// When adding a cafe
const normalized = normalizeLatLng({ lat: cafe.lat, lng: cafe.lng })
if (normalized) {
    setFocusPoint(normalized)
}
```

**Step 4: Run test to verify it passes**

Run: `bun test utils/map/__tests__/crawl-map-points.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add utils/map/crawl-map-points.ts components/map/CrawlRouteMapInternal.tsx components/crawls/CrawlEditor.tsx utils/map/__tests__/crawl-map-points.test.ts
git commit -m "fix: guard crawl map latlng inputs"
```

---

### Task 3: Shared metadata helper for canonical/OG/Twitter

**Files:**
- Create: `utils/seo/metadata.ts`
- Test: `utils/seo/__tests__/metadata.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "bun:test"
import { buildPageMetadata } from "@/utils/seo/metadata"

describe("buildPageMetadata", () => {
    it("builds canonical and OG/Twitter metadata", () => {
        const meta = buildPageMetadata({
            title: "Test",
            description: "Desc",
            urlPath: "/community/crawls/test",
            ogImagePath: "/community/crawls/test/opengraph-image",
        })

        expect(meta.alternates?.canonical).toBe("https://grounds.ph/community/crawls/test")
        expect(meta.openGraph?.url).toBe("https://grounds.ph/community/crawls/test")
        expect(meta.twitter?.images?.[0]).toBe(
            "https://grounds.ph/community/crawls/test/opengraph-image"
        )
    })

    it("supports noindex", () => {
        const meta = buildPageMetadata({
            title: "Hidden",
            description: "Hidden",
            urlPath: "/community/crawls/create",
            index: false,
        })
        expect(meta.robots).toEqual({ index: false, follow: false })
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/seo/__tests__/metadata.test.ts`

Expected: FAIL with missing module or undefined export.

**Step 3: Write minimal implementation**

```ts
import type { Metadata } from "next"

interface BuildPageMetadataInput {
    title: string
    description: string
    urlPath: string
    ogImagePath?: string
    index?: boolean
}

function getBaseUrl(): string {
    return process.env.NEXT_PUBLIC_SITE_URL ?? "https://grounds.ph"
}

export function buildPageMetadata(input: BuildPageMetadataInput): Metadata {
    const baseUrl = getBaseUrl()
    const canonicalUrl = new URL(input.urlPath, baseUrl).toString()
    const imageUrl = input.ogImagePath
        ? new URL(input.ogImagePath, baseUrl).toString()
        : undefined

    return {
        title: input.title,
        description: input.description,
        alternates: {
            canonical: canonicalUrl,
        },
        openGraph: {
            title: input.title,
            description: input.description,
            url: canonicalUrl,
            type: "website",
            images: imageUrl
                ? [{ url: imageUrl, width: 1200, height: 630, alt: input.title }]
                : undefined,
        },
        twitter: {
            card: "summary_large_image",
            title: input.title,
            description: input.description,
            images: imageUrl ? [imageUrl] : undefined,
        },
        robots: input.index === false ? { index: false, follow: false } : undefined,
    }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test utils/seo/__tests__/metadata.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add utils/seo/metadata.ts utils/seo/__tests__/metadata.test.ts
git commit -m "feat: add shared page metadata builder"
```

---

### Task 4: Apply metadata helper + add noindex for non-public routes

**Files:**
- Modify: `app/community/crawls/[slug]/page.tsx`
- Modify: `app/community/[slug]/page.tsx`
- Modify: `app/profile/[username]/page.tsx`
- Modify: `app/blog/[slug]/page.tsx`
- Modify: `app/community/crawls/create/page.tsx`
- Modify: `app/community/crawls/[slug]/edit/page.tsx`
- Modify: `utils/og/metadata.ts`

**Step 1: Write the failing test**

- Extend `utils/seo/__tests__/metadata.test.ts` with a case for fallback OG image.

```ts
it("omits images when ogImagePath is not provided", () => {
    const meta = buildPageMetadata({
        title: "No Image",
        description: "No Image",
        urlPath: "/blog/test",
    })
    expect(meta.openGraph?.images).toBeUndefined()
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/seo/__tests__/metadata.test.ts`

Expected: FAIL until helper is updated or tested.

**Step 3: Write minimal implementation**

- Update `utils/og/metadata.ts` to optionally include canonical URL and use the shared builder for crawls:

```ts
import { buildPageMetadata } from "@/utils/seo/metadata"

interface BuildShareMetadataInput {
    title: string
    description: string
    ogImageUrl: string
    urlPath?: string
}

export function buildShareMetadata(input: BuildShareMetadataInput): Metadata {
    if (input.urlPath) {
        return buildPageMetadata({
            title: input.title,
            description: input.description,
            urlPath: input.urlPath,
            ogImagePath: input.ogImageUrl,
        })
    }

    return {
        title: input.title,
        description: input.description,
        openGraph: {
            title: input.title,
            description: input.description,
            images: [
                {
                    url: input.ogImageUrl,
                    width: 1200,
                    height: 630,
                    alt: input.title,
                },
            ],
        },
        twitter: {
            card: "summary_large_image",
            title: input.title,
            description: input.description,
            images: [input.ogImageUrl],
        },
    }
}
```

- Update `app/community/crawls/[slug]/page.tsx` to pass canonical path:

```ts
return buildCrawlShareMetadata({
    title: crawl.title,
    description: crawl.description ?? `A cafe crawl with ${crawl.itemCount ?? 0} cafes`,
    ogImageUrl: `/community/crawls/${crawl.slug}/opengraph-image`,
    urlPath: `/community/crawls/${crawl.slug}`,
})
```

- Update collection/profile/blog metadata with `buildPageMetadata` and OG image routes:

```ts
import { buildPageMetadata } from "@/utils/seo/metadata"

// collection page
return buildPageMetadata({
    title: `${collection.title} | Cafe Collection`,
    description: collection.description || `A curated collection of ${collection.itemCount} cafes by ${collection.author.displayName}`,
    urlPath: `/community/${collection.slug}`,
    ogImagePath: `/community/${collection.slug}/opengraph-image`,
})

// profile page
return buildPageMetadata({
    title: `${profile.display_name} (@${profile.username})`,
    description: profile.bio || `Check out ${profile.display_name}'s coffee profile on Grounds.`,
    urlPath: `/profile/${profile.username}`,
    ogImagePath: `/profile/${profile.username}/opengraph-image`,
})

// blog page (fallback to site OG when no cover image)
const ogImagePath = post.cover_image ? post.cover_image : "/og-image.jpg"
return buildPageMetadata({
    title: post.title,
    description: post.excerpt || post.content.substring(0, 160),
    urlPath: `/blog/${post.slug}`,
    ogImagePath,
})
```

- Add `noindex` metadata for create/edit pages:

```ts
import type { Metadata } from "next"

export const metadata: Metadata = {
    robots: { index: false, follow: false },
}
```

**Step 4: Run test to verify it passes**

Run: `bun test utils/seo/__tests__/metadata.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add app/community/crawls/[slug]/page.tsx app/community/[slug]/page.tsx app/profile/[username]/page.tsx app/blog/[slug]/page.tsx app/community/crawls/create/page.tsx app/community/crawls/[slug]/edit/page.tsx utils/og/metadata.ts utils/seo/metadata.ts
git commit -m "feat: standardize dynamic page metadata"
```

---

### Task 5: Expand sitemap and robots configuration

**Files:**
- Create: `utils/seo/sitemap.ts`
- Test: `utils/seo/__tests__/sitemap.test.ts`
- Modify: `app/sitemap.ts`
- Modify: `app/robots.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "bun:test"
import { buildSitemapEntries } from "@/utils/seo/sitemap"

describe("buildSitemapEntries", () => {
    it("includes crawls and collections", () => {
        const entries = buildSitemapEntries({
            baseUrl: "https://grounds.ph",
            staticPages: ["/", "/cafes"],
            cafes: [],
            blogs: [],
            menus: [],
            collections: [{ slug: "cozy" }],
            crawls: [{ slug: "weekend" }],
            profiles: [],
        })

        const urls = entries.map((e) => e.url)
        expect(urls).toContain("https://grounds.ph/community/cozy")
        expect(urls).toContain("https://grounds.ph/community/crawls/weekend")
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/seo/__tests__/sitemap.test.ts`

Expected: FAIL with missing module or undefined export.

**Step 3: Write minimal implementation**

```ts
import type { MetadataRoute } from "next"

interface SitemapInput {
    baseUrl: string
    staticPages: string[]
    cafes: { slug: string; updatedAt?: Date | null; createdAt?: Date | null }[]
    blogs: { slug: string; updatedAt?: Date | null; publishedAt?: Date | null }[]
    menus: { slug: string; updatedAt?: Date | null }[]
    collections: { slug: string; updatedAt?: Date | null }[]
    crawls: { slug: string; updatedAt?: Date | null; createdAt?: Date | null }[]
    profiles?: { username: string; updatedAt?: Date | null }[]
}

function withBase(baseUrl: string, path: string) {
    return new URL(path, baseUrl).toString()
}

export function buildSitemapEntries(input: SitemapInput): MetadataRoute.Sitemap {
    const staticEntries: MetadataRoute.Sitemap = input.staticPages.map((path) => ({
        url: withBase(input.baseUrl, path),
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: path === "/" ? 1 : 0.8,
    }))

    const cafeEntries: MetadataRoute.Sitemap = input.cafes.map((cafe) => ({
        url: withBase(input.baseUrl, `/cafes/${cafe.slug}`),
        lastModified: cafe.updatedAt || cafe.createdAt || new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
    }))

    const blogEntries: MetadataRoute.Sitemap = input.blogs.map((post) => ({
        url: withBase(input.baseUrl, `/blog/${post.slug}`),
        lastModified: post.updatedAt || post.publishedAt || new Date(),
        changeFrequency: "weekly",
        priority: 0.7,
    }))

    const menuEntries: MetadataRoute.Sitemap = input.menus.map((cafe) => ({
        url: withBase(input.baseUrl, `/cafes/${cafe.slug}/menu`),
        lastModified: cafe.updatedAt || new Date(),
        changeFrequency: "weekly",
        priority: 0.7,
    }))

    const collectionEntries: MetadataRoute.Sitemap = input.collections.map((collection) => ({
        url: withBase(input.baseUrl, `/community/${collection.slug}`),
        lastModified: collection.updatedAt || new Date(),
        changeFrequency: "weekly",
        priority: 0.6,
    }))

    const crawlEntries: MetadataRoute.Sitemap = input.crawls.map((crawl) => ({
        url: withBase(input.baseUrl, `/community/crawls/${crawl.slug}`),
        lastModified: crawl.updatedAt || crawl.createdAt || new Date(),
        changeFrequency: "weekly",
        priority: 0.6,
    }))

    const profileEntries: MetadataRoute.Sitemap = (input.profiles ?? []).map((profile) => ({
        url: withBase(input.baseUrl, `/profile/${profile.username}`),
        lastModified: profile.updatedAt || new Date(),
        changeFrequency: "weekly",
        priority: 0.4,
    }))

    return [
        ...staticEntries,
        ...cafeEntries,
        ...blogEntries,
        ...menuEntries,
        ...collectionEntries,
        ...crawlEntries,
        ...profileEntries,
    ]
}
```

- Update `app/sitemap.ts` to use the helper and add crawls/profile queries:
  - Query `cafeCrawls` where `isPublic = true` and `status = "published"`.
  - Confirm crawl route path (`/community/crawls/[slug]` vs `/crawls/[slug]`) and use canonical route consistently in sitemap + metadata.
  - If `profiles` has a privacy flag, only include public profiles; otherwise omit profile entries (document decision in code).

```ts
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://grounds.ph"
return buildSitemapEntries({
    baseUrl,
    staticPages: ["/", "/cafes", "/blog", "/map", "/community", "/submit", "/donate", "/contact", "/roadmap", "/legal", "/legal/privacy", "/legal/terms", "/legal/content-policy"],
    cafes: cafeResults,
    blogs: blogResults,
    menus: menuCafeResults,
    collections: collectionResults,
    crawls: crawlResults,
    profiles: profileResults,
})
```

- Update `app/robots.ts` to use the same base URL and explicitly disallow crawl create/edit paths:

```ts
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://grounds.ph"

disallow: ["/api/", "/manage/", "/owner/", "/auth/", "/community/crawls/create", "/community/crawls/*/edit"],
sitemap: `${baseUrl}/sitemap.xml`,
```

**Step 4: Run test to verify it passes**

Run: `bun test utils/seo/__tests__/sitemap.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add utils/seo/sitemap.ts utils/seo/__tests__/sitemap.test.ts app/sitemap.ts app/robots.ts
git commit -m "feat: expand sitemap for crawls and seo"
```

---

## Verification Checklist

- `bun test utils/map/__tests__/coords.test.ts`
- `bun test utils/map/__tests__/crawl-map-points.test.ts`
- `bun test utils/seo/__tests__/metadata.test.ts`
- `bun test utils/seo/__tests__/sitemap.test.ts`
- Spot-check `/community/crawls/create` and `/community/crawls/[slug]/edit` pages for `noindex`.
- Load crawl editor on mobile and confirm no `Invalid LatLng` runtime error.

---

## Notes / Decisions to Confirm

- Confirm canonical crawl route (`/community/crawls/[slug]` vs `/crawls/[slug]`) and align sitemap + metadata + in-app links.
- Decide whether public profiles should be in sitemap (only include if there is a clear `isPublic`/visibility flag).
