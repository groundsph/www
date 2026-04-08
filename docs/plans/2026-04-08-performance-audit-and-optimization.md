# Performance Audit & Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve website performance across list rendering, component re-renders, image loading, map rendering, reviews pagination, and scroll behavior — all without pretext (CSS line-clamp and fixed-height cards handle text layout adequately).

**Architecture:** Address the top performance bottlenecks identified in the audit: (1) no list virtualization — infinite scroll fetches but never unloads DOM nodes, (2) no `React.memo` on card components, (3) reviews load all at once, (4) images lack proper `sizes`/lazy hints, (5) map creates all marker DOM nodes upfront, (6) follow list loads all into DOM, (7) heavy components not code-split.

**Tech Stack:** Next.js 16.2.2, React 19.2.4, `@tanstack/react-virtual` (new), Tailwind CSS v4, react-leaflet, Motion

---

## Audit Summary

| Area | Current State | Issue | Impact |
|------|--------------|-------|--------|
| Cafe listing | Infinite scroll (PAGE_SIZE=10), no virtualization | All fetched items stay in DOM forever | High — grows unbounded |
| Events listing | Infinite scroll (PAGE_SIZE=12), no virtualization | Same as cafes | Medium |
| Card components | 185 `useMemo`/`useCallback` uses, 0 `React.memo` | Parent re-renders cascade to all cards | High |
| Reviews | All reviews render at once on cafe detail pages | No pagination or virtualization | High for popular cafes |
| Images | `next/image` with `unoptimized: true` | Missing `sizes` on many images; `loading="lazy"` inconsistent | Medium |
| Map markers | All marker DOM nodes created upfront | MarkerClusterGroup handles visual clustering but all DOM nodes exist | Medium |
| Follow list | Scroll-based load-more, all items in DOM | No virtualization | Low (modal context) |
| Code splitting | 7 `dynamic()` imports (all map-related) | Heavy components like SearchModal, ImageLightbox not split | Medium |

## Recommended Improvements (No pretext)

1. **List virtualization** — `@tanstack/react-virtual` for cafe and event infinite scrolls
2. **React.memo on card components** — prevent unnecessary re-renders in lists
3. **Reviews pagination** — "Load More" with PAGE_SIZE=10
4. **Image optimization audit** — ensure `sizes`, `priority`, `loading` are correct
5. **Map marker lazy rendering** — only render markers within/near viewport bounds
6. **Code splitting expansion** — dynamic import for SearchModal, ImageLightbox, MarkdownRender
7. **Follow list virtualization** — virtual-scroll the follow modal

---

## Task 1: Install @tanstack/react-virtual

**Files:**
- Modify: `package.json`

**Step 1: Install the dependency**

Run: `bun add @tanstack/react-virtual`

Expected: Package installed, `@tanstack/react-virtual` appears in `package.json` dependencies.

**Step 2: Verify installation**

Run: `bun install` (re-resolve lockfile)
Then: `bun run build` (ensure no type errors from new dependency)

Expected: Build succeeds with no errors.

**Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "perf: add @tanstack/react-virtual for list virtualization"
```

---

## Task 2: Virtualize the Cafe Listing

**Files:**
- Modify: `components/cafe/CafesPageClient.tsx` (lines ~300-450 where the cafe list is rendered)

**Context:** The cafe listing renders all fetched cafes in a vertical list. Each cafe is a card with an image, name, ratings, amenity icons, description, tags, and a CTA. The infinite scroll uses `IntersectionObserver` to load PAGE_SIZE=10 more. Currently, all items remain in the DOM.

**Step 1: Add virtualizer hook to CafesPageClient**

In `components/cafe/CafesPageClient.tsx`, add the import and create a scroll container with virtualizer:

```tsx
import { useVirtualizer } from "@tanstack/react-virtual"
```

Find the scroll container that wraps the cafe cards. It's the div with `overflow-y-auto` that contains the mapped `cafes` array. Replace the mapped list with a virtualized list:

```tsx
const parentRef = useRef<HTMLDivElement>(null)

const virtualizer = useVirtualizer({
  count: cafes.length + (hasMore ? 1 : 0), // +1 for loading sentinel
  getScrollElement: () => parentRef.current,
  estimateSize: () => 280, // estimated cafe card height in px
  overscan: 5,
})
```

Replace the cafe list rendering:

```tsx
<div
  ref={parentRef}
  className="flex-1 overflow-y-auto"
>
  <div
    style={{
      height: `${virtualizer.getTotalSize()}px`,
      width: "100%",
      position: "relative",
    }}
  >
    {virtualizer.getVirtualItems().map((virtualItem) => {
      const isLoaderRow = virtualItem.index >= cafes.length
      if (isLoaderRow) {
        return (
          <div
            key="loader"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {isLoadingMore && (
              <div className="p-4">
                {/* existing skeleton loading */}
              </div>
            )}
          </div>
        )
      }
      const cafe = cafes[virtualItem.index]
      return (
        <div
          key={cafe.id}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: `${virtualItem.size}px`,
            transform: `translateY(${virtualItem.start}px)`,
          }}
        >
          {/* existing cafe card component */}
        </div>
      )
    })}
  </div>
</div>
```

**Step 2: Remove the IntersectionObserver sentinel**

The virtualizer handles scroll-based loading. Remove the old sentinel div and replace with a check in the virtualizer's `getVirtualItems`:

```tsx
// In the effect that drives loading, check if the last virtual item is in view
const lastItem = virtualizer.getVirtualItems().at(-1)
useEffect(() => {
  if (lastItem && lastItem.index >= cafes.length - 1 && hasMore && !isLoadingMore) {
    loadMore()
  }
}, [lastItem?.index, cafes.length, hasMore, isLoadingMore, loadMore])
```

Remove the old `loadMoreRef` / `IntersectionObserver` setup.

**Step 3: Test the cafe listing**

1. Run `bun dev`
2. Navigate to `/cafes`
3. Verify:
   - Cards render correctly
   - Scrolling is smooth
   - Infinite scroll loads more when approaching bottom
   - Scroll position restoration still works (back from cafe detail)
   - No visual jumps or blank spaces

**Step 4: Verify no type errors**

Run: `bun run lint`
Expected: No errors.

**Step 5: Commit**

```bash
git add components/cafe/CafesPageClient.tsx
git commit -m "perf: virtualize cafe listing with @tanstack/react-virtual"
```

---

## Task 3: Virtualize the Events Listing

**Files:**
- Modify: `components/events/EventsPageClient.tsx` (lines ~142-170 where event list renders)

**Context:** Same pattern as cafe listing. Events use `IntersectionObserver` with PAGE_SIZE=12. The event list has two view modes: list and calendar. Virtualize only the list view.

**Step 1: Add virtualizer to list view**

```tsx
import { useVirtualizer } from "@tanstack/react-virtual"
```

Add `parentRef` and virtualizer setup, mirroring the cafe listing approach:

```tsx
const parentRef = useRef<HTMLDivElement>(null)

const virtualizer = useVirtualizer({
  count: events.length + (hasMore ? 1 : 0),
  getScrollElement: () => parentRef.current,
  estimateSize: () => 160, // estimated event card height
  overscan: 5,
})
```

**Step 2: Replace the mapped event list**

Apply the same absolute-positioned virtual item pattern from Task 2. The list view uses `viewMode === "list"` — only virtualize within that branch.

Calendar view stays untouched.

**Step 3: Replace IntersectionObserver with virtualizer-driven loading**

Same pattern: check if last virtual item index approaches `events.length`.

**Step 4: Test**

1. Run `bun dev`
2. Navigate to `/events`
3. Verify list view scrolls and loads correctly
4. Verify calendar view still works
5. Toggle between views

Run: `bun run lint`

**Step 5: Commit**

```bash
git add components/events/EventsPageClient.tsx
git commit -m "perf: virtualize events listing with @tanstack/react-virtual"
```

---

## Task 4: Add React.memo to Card Components

**Files:**
- Modify: `components/cafe/CafesPageClient.tsx` — extract `CafeCard` as a separate memoized component
- Modify: `components/events/EventCard.tsx` — wrap with `React.memo`
- Modify: `components/blog/CommunityBlogsTab.tsx` — extract and memoize blog card
- Modify: `components/reviews/ReviewItem.tsx` — wrap with `React.memo`
- Modify: `components/recent/RecentCard.tsx` — wrap with `React.memo`
- Modify: `components/collections/CollectionCard.tsx` — wrap with `React.memo`
- Modify: `components/crawls/CrawlCard.tsx` — wrap with `React.memo`

**Context:** The codebase has 185 `useMemo`/`useCallback` usages but zero `React.memo` on components. When a parent list component re-renders (e.g., loading state changes), all card children re-render unnecessarily.

**Step 1: Memoize EventCard**

In `components/events/EventCard.tsx`, wrap the export:

```tsx
const EventCard = React.memo(function EventCard({ event, ...props }: EventCardProps) {
  // existing component body
})

export default EventCard
```

Ensure props are stable (no inline objects/functions passed from parent). Check the parent `EventsPageClient.tsx` for any inline prop passing that would defeat memo.

**Step 2: Memoize ReviewItem**

In `components/reviews/ReviewItem.tsx`:

```tsx
const ReviewItem = React.memo(function ReviewItem({ review, ...props }: ReviewItemProps) {
  // existing component body
})

export default ReviewItem
```

**Step 3: Memoize RecentCard**

In `components/recent/RecentCard.tsx`:

```tsx
const RecentCard = React.memo(function RecentCard(props: RecentCardProps) {
  // existing component body
})

export default RecentCard
```

**Step 4: Memoize CollectionCard**

In `components/collections/CollectionCard.tsx`:

```tsx
const CollectionCard = React.memo(function CollectionCard(props: CollectionCardProps) {
  // existing component body
})

export default CollectionCard
```

**Step 5: Memoize CrawlCard**

In `components/crawls/CrawlCard.tsx`:

```tsx
const CrawlCard = React.memo(function CrawlCard(props: CrawlCardProps) {
  // existing component body
})

export default CrawlCard
```

**Step 6: Extract and memoize CafeCard from CafesPageClient**

The cafe card rendering is inline in `CafesPageClient.tsx` (~150 lines per card). Extract it:

Create: `components/cafe/CafeCard.tsx`

```tsx
interface CafeCardProps {
  cafe: Cafe
  onSelect: (slug: string) => void
  // ... other props
}

const CafeCard = React.memo(function CafeCard({ cafe, onSelect }: CafeCardProps) {
  // Move the card JSX from the mapped section of CafesPageClient here
})

export default CafeCard
```

**Step 7: Verify props are stable**

For each memoized component, check the parent for:
- Inline object literals: `style={{ ... }}` — OK if static
- Inline callbacks: `onClick={() => handleX(id)}` — wrap in `useCallback`
- Spread props — ensure no unnecessary re-creation

**Step 8: Test**

Run `bun dev`, verify all card-heavy pages render correctly:
- `/cafes`, `/events`, `/blog`, `/community`, cafe detail reviews

Run: `bun run lint`

**Step 9: Commit**

```bash
git add components/cafe/CafeCard.tsx components/cafe/CafesPageClient.tsx components/events/EventCard.tsx components/blog/CommunityBlogsTab.tsx components/reviews/ReviewItem.tsx components/recent/RecentCard.tsx components/collections/CollectionCard.tsx components/crawls/CrawlCard.tsx
git commit -m "perf: add React.memo to card components to reduce re-renders"
```

---

## Task 5: Implement Reviews Pagination

**Files:**
- Modify: `components/reviews/ReviewList.tsx` (or wherever reviews are rendered in cafe detail)
- Modify: `app/api/actions/reviews.ts` — add pagination params to the reviews query
- Modify: `components/cafe/CafeDetails.tsx` — pass pagination state

**Context:** Cafe detail pages render all reviews at once. Popular cafes can have 50+ reviews, each with images, markdown, likes, etc. This causes slow initial renders.

**Step 1: Add pagination to the reviews server action**

In `app/api/actions/reviews.ts`, modify the `getReviewsForCafe` action to accept `page` and `limit` params:

```ts
export async function getReviewsForCafe(cafeId: string, options?: { page?: number; limit?: number }) {
  const page = options?.page ?? 1
  const limit = options?.limit ?? 10
  const offset = (page - 1) * limit

  // existing query with .limit(limit).offset(offset)
  // also return total count for "Load More" button
}
```

**Step 2: Update ReviewList to support pagination**

In the component that renders the review list, add state:

```tsx
const [page, setPage] = useState(1)
const [hasMore, setHasMore] = useState(true)
const [allReviews, setAllReviews] = useState<Review[]>([])

const loadMore = useCallback(async () => {
  const nextPage = page + 1
  const result = await getReviewsForCafe(cafeId, { page: nextPage, limit: 10 })
  if (result.reviews.length < 10) setHasMore(false)
  setAllReviews(prev => [...prev, ...result.reviews])
  setPage(nextPage)
}, [page, cafeId])
```

**Step 3: Add "Load More" button**

After the rendered reviews, add:

```tsx
{hasMore && (
  <button
    onClick={loadMore}
    className="w-full py-3 text-sm text-text/60 hover:text-text transition-colors"
  >
    Load more reviews
  </button>
)}
```

**Step 4: Test**

1. Navigate to a cafe with many reviews (or seed test data)
2. Verify first 10 reviews load
3. Click "Load More" — next 10 appear
4. When no more reviews, button disappears
5. Verify review sorting/filtering still works

Run: `bun run lint`

**Step 5: Commit**

```bash
git add app/api/actions/reviews.ts components/reviews/ReviewList.tsx components/cafe/CafeDetails.tsx
git commit -m "perf: paginate reviews with Load More (10 per page)"
```

---

## Task 6: Audit and Fix Image Loading Attributes

**Files:**
- Modify: Multiple files (see list below)

**Context:** The codebase has `next/image` with `unoptimized: true` in next.config.ts. Images rely on Cloudflare CDN for optimization. The audit found inconsistent use of `sizes`, `priority`, and `loading="lazy"`.

**Step 1: Audit image usage**

Search for all `<Image` components and categorize:

```bash
# Find all Image components and their attributes
```

Run: `bun run lint` (to find any existing image-related warnings)

Key locations to check:
- `components/cafe/CafesPageClient.tsx` — cafe card thumbnails (below fold → should be lazy)
- `components/blog/CommunityBlogsTab.tsx` — blog card images
- `components/events/EventCard.tsx` — event card images
- `components/cafe/CafeHero.tsx` — hero image (above fold → should be priority)
- `components/reviews/ReviewItem.tsx` — review images
- `components/gallery/CafeGallery.tsx` — gallery images
- `components/landing/` — all landing page sections

**Step 2: Add `sizes` to all responsive images**

For card grids (3-col on desktop, 1-col on mobile):

```tsx
<Image
  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
  // ...
/>
```

For hero/full-width images:

```tsx
<Image
  sizes="100vw"
  // ...
/>
```

For thumbnails:

```tsx
<Image
  sizes="(max-width: 768px) 50px, 80px"
  // ...
/>
```

**Step 3: Ensure correct `priority` and `loading` usage**

- Hero images: `priority` (no `loading` — Next.js handles this)
- Above-fold content (first 3-6 cards): `priority` or no explicit `loading`
- Below-fold content: `loading="lazy"` (Next.js defaults to lazy, but be explicit)

**Step 4: Test**

1. Run `bun dev`
2. Open browser DevTools → Network → Img filter
3. Navigate to key pages
4. Verify:
   - Hero images load eagerly
   - Below-fold images lazy-load
   - `sizes` attribute appears in rendered HTML
   - No layout shift from missing dimensions

**Step 5: Commit**

```bash
git add -A
git commit -m "perf: add consistent sizes/priority/loading attributes to images"
```

---

## Task 7: Optimize Map Marker Rendering

**Files:**
- Modify: `components/map/CafeMap.tsx` (lines ~100-300 where markers are created)

**Context:** The map currently creates DOM elements for ALL cafe markers upfront. `MarkerClusterGroup` handles visual clustering (groups nearby markers into a numbered circle), but the underlying DOM nodes for every individual marker still exist.

**Step 1: Implement viewport-based marker filtering**

Add a state that tracks the current map bounds and only renders markers within or near the visible area:

```tsx
import { useMap, useMapEvents } from "react-leaflet"

function MarkerRenderer({ cafes }: { cafes: Cafe[] }) {
  const map = useMap()
  const [visibleCafes, setVisibleCafes] = useState<Cafe[]>(cafes)

  useMapEvents({
    moveend: () => {
      const bounds = map.getBounds()
      const padded = bounds.pad(0.5) // 50% padding around viewport
      setVisibleCafes(
        cafes.filter((cafe) =>
          padded.contains([cafe.latitude, cafe.longitude])
        )
      )
    },
    zoomend: () => {
      const bounds = map.getBounds()
      const padded = bounds.pad(0.5)
      setVisibleCafes(
        cafes.filter((cafe) =>
          padded.contains([cafe.latitude, cafe.longitude])
        )
      )
    },
  })

  // Initial render
  useEffect(() => {
    const bounds = map.getBounds()
    const padded = bounds.pad(0.5)
    setVisibleCafes(
      cafes.filter((cafe) =>
        padded.contains([cafe.latitude, cafe.longitude])
      )
    )
  }, [cafes, map])

  return (
    <MarkerClusterGroup>
      {visibleCafes.map((cafe) => (
        <Marker key={cafe.id} /* ... */ />
      ))}
    </MarkerClusterGroup>
  )
}
```

**Step 2: Handle the transition smoothly**

When zooming out, previously off-screen markers should appear without jarring jumps. The `MarkerClusterGroup` handles this naturally since it re-clusters on data change.

**Step 3: Test**

1. Run `bun dev`, navigate to `/cafes` or `/map`
2. Pan and zoom the map
3. Verify markers appear/disappear smoothly
4. Verify clustering still works
5. Open browser DevTools → Elements, count marker DOM nodes
6. Compare DOM node count before and after

Run: `bun run lint`

**Step 4: Commit**

```bash
git add components/map/CafeMap.tsx
git commit -m "perf: render only viewport-visible map markers"
```

---

## Task 8: Expand Code Splitting

**Files:**
- Modify: `components/layout/Navbar.tsx` — dynamic import for SearchModal
- Modify: `components/modal/ImageLightbox.tsx` — wrap with dynamic
- Create: Wherever SearchModal is imported, change to dynamic import

**Context:** Only 7 components use `next/dynamic` — all map-related. Several heavy interactive components are eagerly loaded.

**Step 1: Dynamic import SearchModal**

SearchModal is a heavy component (search, filters, API calls). Find where it's imported in Navbar or layout:

```tsx
import dynamic from "next/dynamic"

const SearchModal = dynamic(() => import("@/components/search/SearchModal"), {
  loading: () => null,
  ssr: false,
})
```

**Step 2: Dynamic import ImageLightbox**

```tsx
const ImageLightbox = dynamic(
  () => import("@/components/modal/ImageLightbox"),
  { ssr: false }
)
```

**Step 3: Dynamic import MarkdownRender (conditional)**

If `MarkdownRender` is used heavily on cafe detail pages but not needed on listing pages:

```tsx
const MarkdownRender = dynamic(
  () => import("@/components/ui/MarkdownRender"),
  { loading: () => <div className="animate-pulse h-20 bg-text/5 rounded" /> }
)
```

Note: Only do this if `MarkdownRender` is large. Check the import graph first.

**Step 4: Test**

1. Run `bun dev`
2. Open DevTools → Network → JS filter
3. Navigate to pages that use these components
4. Verify:
   - SearchModal chunk loads only when modal opens
   - ImageLightbox chunk loads only when gallery is clicked
   - No visual regression (loading states look correct)

Run: `bun run lint`

**Step 5: Commit**

```bash
git add -A
git commit -m "perf: add dynamic imports for SearchModal, ImageLightbox"
```

---

## Task 9: Virtualize the Follow List Modal

**Files:**
- Modify: `components/social/FollowListModal.tsx` (lines ~176-178 where scroll detection happens)

**Context:** The follow list modal uses manual scroll detection (`scrollHeight - scrollTop <= clientHeight * 1.5`) and loads LIMIT=20 items per batch, all into the DOM.

**Step 1: Add virtualizer to FollowListModal**

```tsx
import { useVirtualizer } from "@tanstack/react-virtual"
```

Replace the scroll container:

```tsx
const parentRef = useRef<HTMLDivElement>(null)

const virtualizer = useVirtualizer({
  count: users.length + (hasMore ? 1 : 0),
  getScrollElement: () => parentRef.current,
  estimateSize: () => 64, // estimated user row height
  overscan: 3,
})
```

**Step 2: Replace scroll-based loading with virtualizer-driven loading**

```tsx
const lastItem = virtualizer.getVirtualItems().at(-1)
useEffect(() => {
  if (lastItem && lastItem.index >= users.length - 3 && hasMore && !isLoading) {
    loadMore()
  }
}, [lastItem?.index, users.length, hasMore, isLoading, loadMore])
```

Remove the old `handleScroll` function.

**Step 3: Test**

1. Open a profile with many followers
2. Click "Followers" to open the modal
3. Scroll through the list
4. Verify more users load as you approach the bottom
5. Verify search filtering still works

Run: `bun run lint`

**Step 4: Commit**

```bash
git add components/social/FollowListModal.tsx
git commit -m "perf: virtualize follow list modal"
```

---

## Task 10: Add Performance Monitoring

**Files:**
- Create: `utils/performance.ts` — lightweight performance measurement utility
- Modify: `app/layout.tsx` — conditionally import performance monitor

**Context:** To validate the improvements and catch regressions, add lightweight performance monitoring.

**Step 1: Create performance utility**

```ts
// utils/performance.ts
export function measureRender(componentName: string) {
  if (process.env.NODE_ENV !== "development") return { start: () => {}, end: () => {} }

  return {
    start: () => performance.mark(`${componentName}-render-start`),
    end: () => {
      performance.mark(`${componentName}-render-end`)
      performance.measure(
        `${componentName}-render`,
        `${componentName}-render-start`,
        `${componentName}-render-end`
      )
    },
  }
}
```

**Step 2: Add to key components (development only)**

Use in virtualized lists to measure render time improvements:

```tsx
if (process.env.NODE_ENV === "development") {
  const mark = measureRender("CafeList")
  mark.start()
  // ... render
  mark.end()
}
```

**Step 3: Web Vitals logging**

The project already has `@vercel/analytics` — verify Web Vitals are being tracked. If not, add:

```tsx
// In app/layout.tsx
import { reportWebVitals } from "next/vitals"

export function reportWebVitals(metric: Metric) {
  console.log(metric)
}
```

**Step 4: Commit**

```bash
git add utils/performance.ts app/layout.tsx
git commit -m "perf: add lightweight performance monitoring utility"
```

---

## Task 11: Verify All Improvements

**Step 1: Run full lint**

Run: `bun run lint`
Expected: No errors.

**Step 2: Run full build**

Run: `bun build`
Expected: Build succeeds with no warnings.

**Step 3: Run tests**

Run: `bun test`
Expected: All existing tests pass.

**Step 4: Manual QA checklist**

- [ ] `/cafes` — infinite scroll works, smooth scrolling, no blank spaces
- [ ] `/cafes/[slug]` — reviews paginate with "Load More"
- [ ] `/events` — list view virtualized, calendar view unchanged
- [ ] `/blog` — blog cards render correctly
- [ ] `/map` — markers load/cluster correctly with viewport filtering
- [ ] Follow list modal — scrolls smoothly, loads more
- [ ] SearchModal — opens without delay (dynamic import)
- [ ] ImageLightbox — opens correctly (dynamic import)
- [ ] No layout shift on any page
- [ ] No visual regressions in card components

**Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "perf: final fixes and QA verification"
```

---

## Summary of Changes

| Task | Change | Impact |
|------|--------|--------|
| 1 | Install `@tanstack/react-virtual` | Foundation for Tasks 2, 3, 9 |
| 2 | Virtualize cafe listing | DOM nodes stay bounded regardless of scroll depth |
| 3 | Virtualize events listing | Same as above for events |
| 4 | `React.memo` on 7 card components | Eliminates unnecessary re-renders |
| 5 | Paginate reviews (10/page) | Cafe detail pages load faster |
| 6 | Fix image attributes | Better LCP, reduced bandwidth |
| 7 | Viewport-filtered map markers | Fewer DOM nodes on map |
| 8 | Dynamic imports for heavy modals | Smaller initial bundle |
| 9 | Virtualize follow list | Smoother scrolling in modal |
| 10 | Performance monitoring | Baseline for future optimization |
| 11 | Full verification | No regressions |
