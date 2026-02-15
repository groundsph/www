# Blogs + Community Rework Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand blog posts with galleries, cafe tagging, and crawl embeds while moving blogs into the Community hub with improved search and global search parity.

**Architecture:** Extend `blog_posts` with gallery images, tagged cafe IDs, and an optional crawl link. Add content link detection to surface cafes from `grounds.ph/cafes/*` links, then render a blog gallery + cafe highlights + crawl map embed. Community becomes the primary hub: a new Blogs tab reuses blog listing logic, tab hero metadata is dynamic, and Community search aggregates results across tabs. Global search adds blogs/crawls/collections/events to match Community.

**Tech Stack:** Next.js App Router, Bun, Drizzle ORM, Tailwind v4, motion/react, lucide-react.

---

### Task 1: Cafe Link Detection Helper

**Files:**
- Create: `utils/blog/link-detection.ts`
- Test: `utils/__tests__/blog-link-detection.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test"
import { extractCafeSlugsFromContent } from "@/utils/blog/link-detection"

describe("extractCafeSlugsFromContent", () => {
  it("extracts grounds.ph cafe slugs from absolute and relative links", () => {
    const content = `Visit https://grounds.ph/cafes/dennys and /cafes/sunny-roast?ref=blog`;
    const slugs = extractCafeSlugsFromContent(content)
    expect(slugs).toEqual(["dennys", "sunny-roast"])
  })

  it("dedupes slugs and ignores non-cafe links", () => {
    const content = `https://grounds.ph/cafes/alpha https://grounds.ph/blog/test /cafes/alpha`;
    const slugs = extractCafeSlugsFromContent(content)
    expect(slugs).toEqual(["alpha"])
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/__tests__/blog-link-detection.test.ts`
Expected: FAIL with “extractCafeSlugsFromContent is not a function” (or module not found).

**Step 3: Write minimal implementation**

```ts
// utils/blog/link-detection.ts
const CAFE_LINK_REGEX = /(?:https?:\/\/)?(?:www\.)?grounds\.ph\/cafes\/([a-z0-9-]+)(?:[/?#]|$)|\/cafes\/([a-z0-9-]+)(?:[/?#]|$)/gi

export function extractCafeSlugsFromContent(content: string): string[] {
  if (!content) return []
  const seen = new Set<string>()
  const results: string[] = []
  for (const match of content.matchAll(CAFE_LINK_REGEX)) {
    const slug = (match[1] || match[2] || "").toLowerCase()
    if (slug && !seen.has(slug)) {
      seen.add(slug)
      results.push(slug)
    }
  }
  return results
}
```

**Step 4: Run test to verify it passes**

Run: `bun test utils/__tests__/blog-link-detection.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add utils/blog/link-detection.ts utils/__tests__/blog-link-detection.test.ts
git commit -m "feat: add cafe link detection helper"
```

### Task 2: Blog Schema Extensions (gallery, cafe tags, crawl link)

**Files:**
- Create: `drizzle/migrations/0009_add-blog-assets.sql`
- Modify: `db/schema/tables.ts`
- Modify: `utils/types/database.types.ts`
- Modify: `utils/types/blog.ts`
- Modify: `app/api/actions/blog.ts`
- Test: `db/schema/__tests__/blog-posts-schema.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

describe("blog posts schema", () => {
  it("includes gallery, tagged cafes, and crawl link columns", () => {
    const source = readFileSync(join(process.cwd(), "db", "schema", "tables.ts"), "utf-8")
    expect(source).toContain("images: text(\"images\").array()")
    expect(source).toContain("taggedCafeIds: uuid(\"tagged_cafe_ids\").array()")
    expect(source).toContain("crawlId: uuid(\"crawl_id\")")
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test db/schema/__tests__/blog-posts-schema.test.ts`
Expected: FAIL with missing string assertions.

**Step 3: Write minimal implementation**

SQL migration snippet:

```sql
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS images text[];
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS tagged_cafe_ids uuid[];
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS crawl_id uuid REFERENCES cafe_crawls(id) ON DELETE SET NULL;
```

Schema additions in `db/schema/tables.ts`:

```ts
images: text("images").array(),
taggedCafeIds: uuid("tagged_cafe_ids").array(),
crawlId: uuid("crawl_id").references(() => cafeCrawls.id, { onDelete: "set null" }),
```

Update `utils/types/database.types.ts` blog_posts Row/Insert/Update with:

```ts
images: string[] | null
tagged_cafe_ids: string[] | null
crawl_id: string | null
```

Update `utils/types/blog.ts`:

```ts
export interface BlogPostInput {
  // ...existing
  images?: string[]
  tagged_cafe_ids?: string[]
  crawl_id?: string | null
}
```

Update `app/api/actions/blog.ts` selects and inserts/updates to include
`images`, `taggedCafeIds`, `crawlId` fields in select maps and mapBlogPost.

**Step 4: Run tests + apply migration**

Run: `bun test db/schema/__tests__/blog-posts-schema.test.ts`
Expected: PASS

Run: `bun db-push`
Expected: Migration applies with no errors.

**Step 5: Commit**

```bash
git add drizzle/migrations/0009_add-blog-assets.sql db/schema/tables.ts utils/types/database.types.ts utils/types/blog.ts app/api/actions/blog.ts db/schema/__tests__/blog-posts-schema.test.ts
git commit -m "feat: add blog gallery and tagging fields"
```

### Task 3: Storage Cleanup Includes Blog Gallery Images

**Files:**
- Modify: `utils/storage/cleanup.ts`
- Modify: `utils/storage/actions.ts`
- Test: `utils/__tests__/storage-cleanup.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test"
import { collectBlogImageUrls } from "@/utils/storage/cleanup"

describe("collectBlogImageUrls", () => {
  it("includes cover and gallery images", () => {
    const urls = collectBlogImageUrls([
      { coverImage: "https://cover" , images: ["https://a", "https://b"] },
    ])
    expect(urls.has("https://cover")).toBe(true)
    expect(urls.has("https://a")).toBe(true)
    expect(urls.has("https://b")).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/__tests__/storage-cleanup.test.ts`
Expected: FAIL with missing export.

**Step 3: Write minimal implementation**

```ts
// utils/storage/cleanup.ts
interface BlogWithImages { coverImage: string | null; images?: string[] | null }

export function collectBlogImageUrls(blogs: BlogWithImages[]): Set<string> {
  const urls = new Set<string>()
  for (const blog of blogs) {
    if (blog.coverImage) urls.add(blog.coverImage)
    blog.images?.forEach((url) => urls.add(url))
  }
  return urls
}
```

Then update `utils/storage/actions.ts` to use this helper when building `blogImages`.

**Step 4: Run test to verify it passes**

Run: `bun test utils/__tests__/storage-cleanup.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add utils/storage/cleanup.ts utils/storage/actions.ts utils/__tests__/storage-cleanup.test.ts
git commit -m "fix: include blog gallery images in storage cleanup"
```

### Task 4: Blog Editor — Multi-Image Upload + Cafe/Crawl Tagging UI

**Files:**
- Modify: `components/blog/BlogEditor.tsx`
- Create: `components/blog/BlogCafePicker.tsx`
- Create: `components/blog/BlogCrawlPicker.tsx`
- Modify: `app/api/actions/cafe.ts`
- Modify: `app/api/actions/cafe-crawls.ts`
- Test: `components/blog/__tests__/blog-editor-sections.test.tsx`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

describe("BlogEditor", () => {
  it("includes gallery, tagged cafes, and crawl link sections", () => {
    const source = readFileSync(join(process.cwd(), "components", "blog", "BlogEditor.tsx"), "utf-8")
    expect(source).toContain("Gallery Images")
    expect(source).toContain("Tagged Cafes")
    expect(source).toContain("Linked Crawl")
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test components/blog/__tests__/blog-editor-sections.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**

- Add `galleryImages`, `taggedCafeIds`, `linkedCrawlId` state to `components/blog/BlogEditor.tsx`.
- Add a multi-file input using `multiple` and use `uploadBlogImageAction` for each file (compress with `compressBlogCover` or a new `compressBlogImage`).
- Add `BlogCafePicker` for searching published cafes and storing IDs.
- Add `BlogCrawlPicker` for searching published crawls and storing an ID.
- Update `BlogPostInput` payload to include `images`, `tagged_cafe_ids`, `crawl_id`.

Cafe search action snippet:

```ts
// app/api/actions/cafe.ts
export async function searchCafesForBlog(query: string) {
  if (!query || query.length < 2) return []
  return db.select({ id: cafes.id, name: cafes.name, slug: cafes.slug, thumbnail: cafes.thumbnail })
    .from(cafes)
    .where(and(eq(cafes.isPublished, true), ilike(cafes.name, `%${query}%`)))
    .limit(10)
}
```

Crawl search action snippet:

```ts
// app/api/actions/cafe-crawls.ts
export async function searchCafeCrawls(query: string) {
  if (!query || query.length < 2) return []
  return db.select({ id: cafeCrawls.id, title: cafeCrawls.title, slug: cafeCrawls.slug, coverImage: cafeCrawls.coverImage })
    .from(cafeCrawls)
    .where(and(eq(cafeCrawls.isPublic, true), eq(cafeCrawls.status, "published"), sql`${cafeCrawls.title} ILIKE ${`%${query}%`}`))
    .limit(10)
}
```

**Step 4: Run test to verify it passes**

Run: `bun test components/blog/__tests__/blog-editor-sections.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add components/blog/BlogEditor.tsx components/blog/BlogCafePicker.tsx components/blog/BlogCrawlPicker.tsx app/api/actions/cafe.ts app/api/actions/cafe-crawls.ts components/blog/__tests__/blog-editor-sections.test.tsx
git commit -m "feat: add blog gallery and tagging controls"
```

### Task 5: Blog Post Rendering — Gallery, Tagged Cafes, Crawl Map

**Files:**
- Modify: `app/blog/[slug]/page.tsx`
- Create: `components/blog/BlogImageGallery.tsx`
- Create: `components/blog/BlogCafeHighlights.tsx`
- Create: `components/blog/BlogCrawlEmbed.tsx`
- Create: `utils/blog/merge-cafe-tags.ts`
- Create: `utils/map/crawl-map-points.ts`
- Modify: `app/api/actions/cafe.ts`
- Modify: `app/api/actions/cafe-crawls.ts`
- Test: `utils/__tests__/merge-cafe-tags.test.ts`
- Test: `utils/__tests__/crawl-map-points.test.ts`

**Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "bun:test"
import { mergeCafeTags } from "@/utils/blog/merge-cafe-tags"

describe("mergeCafeTags", () => {
  it("dedupes and preserves order", () => {
    const result = mergeCafeTags(["1", "2"], ["2", "3"])
    expect(result).toEqual(["1", "2", "3"])
  })
})
```

```ts
import { describe, it, expect } from "bun:test"
import { buildCrawlMapPoints } from "@/utils/map/crawl-map-points"

describe("buildCrawlMapPoints", () => {
  it("filters invalid items and sorts by order", () => {
    const points = buildCrawlMapPoints([
      { name: "B", slug: "b", thumbnail: null, lat: 2, lng: 2, sortOrder: 1 },
      { name: "A", slug: "a", thumbnail: null, lat: 1, lng: 1, sortOrder: 0 },
      { name: "No", slug: "no", thumbnail: null, lat: null, lng: null, sortOrder: 2 },
    ])
    expect(points.map((p) => p.label)).toEqual(["A", "B"])
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `bun test utils/__tests__/merge-cafe-tags.test.ts`
Expected: FAIL

Run: `bun test utils/__tests__/crawl-map-points.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

- Add `mergeCafeTags` helper to combine explicit `tagged_cafe_ids` and detected cafe slugs (after lookup), preserving order.
- Add `buildCrawlMapPoints` helper that mirrors the crawl mapping logic from `components/crawls/CrawlView.tsx`.
- Add server actions:
  - `getCafesByIds(ids: string[])` and `getCafesBySlugs(slugs: string[])` in `app/api/actions/cafe.ts`.
  - `getCafeCrawlById(id: string)` in `app/api/actions/cafe-crawls.ts` (return same shape as `getCafeCrawlBySlug`).
- Update `app/blog/[slug]/page.tsx` to:
  - Render `BlogImageGallery` after the header and before content.
  - Detect cafe slugs via `extractCafeSlugsFromContent` and fetch cafe data.
  - Merge detected cafes with tagged cafes, dedupe, pass to `BlogCafeHighlights`.
  - If `crawl_id` exists, fetch crawl, build points, render `BlogCrawlEmbed` with map + link.

**Step 4: Run tests to verify they pass**

Run: `bun test utils/__tests__/merge-cafe-tags.test.ts`
Expected: PASS

Run: `bun test utils/__tests__/crawl-map-points.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/blog/[slug]/page.tsx components/blog/BlogImageGallery.tsx components/blog/BlogCafeHighlights.tsx components/blog/BlogCrawlEmbed.tsx utils/blog/merge-cafe-tags.ts utils/map/crawl-map-points.ts app/api/actions/cafe.ts app/api/actions/cafe-crawls.ts utils/__tests__/merge-cafe-tags.test.ts utils/__tests__/crawl-map-points.test.ts
git commit -m "feat: render blog gallery, cafes, and crawl embed"
```

### Task 6: Community Hub Rework + /blog Integration + SEO

**Files:**
- Modify: `components/community/CommunityPage.tsx`
- Modify: `app/community/page.tsx`
- Modify: `app/blog/page.tsx`
- Modify: `utils/routes.ts`
- Create: `components/blog/CommunityBlogsTab.tsx`
- Modify: `utils/search-index.ts`
- Test: `utils/__tests__/routes-community.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test"
import { routes } from "@/utils/routes"

describe("community routes", () => {
  it("includes community dropdown items", () => {
    const community = routes.find((r) => r.title === "community")
    const children = community?.children?.map((c) => c.title) || []
    expect(children).toEqual(["blogs", "crawls", "collections", "events", "leaderboard"])
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/__tests__/routes-community.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

- Update `utils/routes.ts` community children order to: Blogs, Crawls, Collections, Events, Leaderboard.
- Add `blogs` tab to `components/community/CommunityPage.tsx` and reorder tabs.
- Add per-tab hero metadata (`tag`, `title`, `description`, `icon`) and render dynamically based on `activeTab`.
- Add `CommunityBlogsTab` that renders featured + list (reuse styles from `app/blog/page.tsx`).
- Update `app/community/page.tsx` to fetch blog data (`getFeaturedPosts`, `getPublishedBlogPosts`) and pass as props.
- Update `app/blog/page.tsx` to render the Community page with `initialTab="blogs"` and add canonical metadata:

```ts
export const metadata = {
  title: "Blog",
  alternates: { canonical: "/community?tab=blogs" },
}
```

**Step 4: Run test to verify it passes**

Run: `bun test utils/__tests__/routes-community.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add utils/routes.ts components/community/CommunityPage.tsx app/community/page.tsx app/blog/page.tsx components/blog/CommunityBlogsTab.tsx utils/search-index.ts utils/__tests__/routes-community.test.ts
git commit -m "feat: add blogs tab and community hub navigation"
```

### Task 7: Community Search — Aggregate Results Across Tabs

**Files:**
- Modify: `app/api/actions/community.ts`
- Modify: `app/api/actions/events.ts`
- Modify: `components/community/CommunityPage.tsx`
- Create: `components/community/community-search-order.ts`
- Test: `components/community/__tests__/community-search-order.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test"
import { COMMUNITY_TAB_ORDER } from "@/components/community/community-search-order"

describe("community search order", () => {
  it("matches the tab order", () => {
    expect(COMMUNITY_TAB_ORDER).toEqual(["blogs", "crawls", "collections", "events", "leaderboard"])
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test components/community/__tests__/community-search-order.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

- Add `COMMUNITY_TAB_ORDER` helper.
- Add `searchCommunityContent(query)` in `app/api/actions/community.ts` that returns `{ blogs, crawls, collections, events }` arrays.
- Add `search` filter to `EventFilters` and update `getEvents` to support `ilike` on title/description.
- Update `components/community/CommunityPage.tsx` to:
  - Call `searchCommunityContent` when `searchQuery` is non-empty.
  - Render a unified search results view with sections ordered by `COMMUNITY_TAB_ORDER`.
  - Avoid switching active tabs during search.

**Step 4: Run test to verify it passes**

Run: `bun test components/community/__tests__/community-search-order.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/api/actions/community.ts app/api/actions/events.ts components/community/CommunityPage.tsx components/community/community-search-order.ts components/community/__tests__/community-search-order.test.ts
git commit -m "feat: aggregate community search across tabs"
```

### Task 8: Global Search Parity (blogs, crawls, collections, events)

**Files:**
- Modify: `utils/types/search.ts`
- Modify: `components/search/search-utils.ts`
- Modify: `components/search/SearchResults.tsx`
- Modify: `app/api/actions/search.ts`
- Modify: `utils/search-index.ts`
- Test: `components/search/__tests__/search-utils.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test"
import { getResultIcon } from "@/components/search/search-utils"

describe("getResultIcon", () => {
  it("maps new content types", () => {
    expect(getResultIcon("blog")).toBe("FileText")
    expect(getResultIcon("crawl")).toBe("MapIcon")
    expect(getResultIcon("collection")).toBe("Layers")
    expect(getResultIcon("event")).toBe("Calendar")
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test components/search/__tests__/search-utils.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

- Expand `SearchResultType` to include `blog`, `crawl`, `collection`, `event`.
- Update `getResultIcon` and `SearchResults` group order/labels.
- Update `app/api/actions/search.ts` to query published blog posts, public crawls, public collections, and upcoming/published events; merge with existing results and apply priorities.
- Add quick actions in `utils/search-index.ts` for Community tabs if desired (e.g., `>community`, `>events`).

**Step 4: Run test to verify it passes**

Run: `bun test components/search/__tests__/search-utils.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add utils/types/search.ts components/search/search-utils.ts components/search/SearchResults.tsx app/api/actions/search.ts utils/search-index.ts components/search/__tests__/search-utils.test.ts
git commit -m "feat: expand global search to community content"
```

### Task 9: Lucide Icon Style Fixes

**Files:**
- Modify: various component files where lucide icons use `text-*/NN` opacity syntax

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

describe("icon opacity styling", () => {
  it("avoids text-primary/40 on lucide icons in CrawlCard", () => {
    const source = readFileSync(join(process.cwd(), "components", "crawls", "CrawlCard.tsx"), "utf-8")
    expect(source).not.toContain("text-primary/40")
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test components/crawls/__tests__/crawl-card-icon-opacity.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

- Replace icon class strings like `text-primary/40` with `text-primary opacity-40`.
- Focus on lucide icon components and avoid touching non-icon text styles.

Example change:

```tsx
<MapIcon className="w-12 h-12 text-primary opacity-40" />
```

**Step 4: Run test to verify it passes**

Run: `bun test components/crawls/__tests__/crawl-card-icon-opacity.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add components/crawls/CrawlCard.tsx components/crawls/__tests__/crawl-card-icon-opacity.test.ts
git commit -m "chore: normalize lucide icon opacity classes"
```

### Task 10: Full QA Pass

**Files:**
- N/A

**Step 1: Run test suite**

Run: `bun test`
Expected: PASS

**Step 2: Run lint**

Run: `bun lint`
Expected: PASS

**Step 3: Commit QA (if any fixes were needed)**

```bash
git add .
git commit -m "chore: fix lint/test fallout"
```

---

Plan complete and saved to `docs/plans/2026-02-15-blogs-community-rework.md`.
Two execution options:

1. Subagent-Driven (this session) - I dispatch fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - Open new session with executing-plans, batch execution with checkpoints

Which approach?
