
# Community Blog Submissions + Crawl UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable normal users to submit limited community blog posts, surface personal blogs in profiles, improve AI excerpt handling and approvals, and add micro-animations + map timeline motion to cafe crawls.

**Architecture:** Add a dedicated community blog editor and server actions that enforce restricted fields and pending status for normal users, while preserving writer/admin flows. Extend profile and manage UIs for blog tracking and safer approvals. Enhance crawl UI and map animations via motion/react and Leaflet CSS/JS timeline state.

**Tech Stack:** Next.js App Router, React, motion/react, Tailwind v4, Drizzle ORM, Bun tests.

---

> Note: User requested **no worktree**. Execute directly in the current workspace.

### Task 1: Define community blog submission policy (testable)

**Files:**
- Create: `utils/blog/community-posting.ts`
- Test: `utils/__tests__/blog-community-posting.test.ts`
- Modify: `app/api/actions/blog.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test"
import { canSubmitCommunityBlog } from "@/utils/blog/community-posting"

describe("canSubmitCommunityBlog", () => {
    it("allows regular users to submit community posts without a cafe", () => {
        const result = canSubmitCommunityBlog({
            role: "user",
            category: "community",
            hasCafeOwnership: false,
        })
        expect(result.allowed).toBe(true)
        expect(result.requiresCafe).toBe(false)
    })

    it("blocks regular users from non-community categories", () => {
        const result = canSubmitCommunityBlog({
            role: "user",
            category: "guides",
            hasCafeOwnership: false,
        })
        expect(result.allowed).toBe(false)
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/__tests__/blog-community-posting.test.ts`
Expected: FAIL with module not found.

**Step 3: Write minimal implementation**

```ts
import type { BlogCategory } from "@/utils/types/blog"

export function canSubmitCommunityBlog(input: {
    role: "user" | "writer" | "admin" | "moderator" | string | null
    category: BlogCategory
    hasCafeOwnership: boolean
}) {
    if (input.role === "admin" || input.role === "moderator") {
        return { allowed: true, requiresCafe: false }
    }

    if (input.role === "writer") {
        return { allowed: true, requiresCafe: false }
    }

    if (input.role === "user" && input.category === "community") {
        return { allowed: true, requiresCafe: false }
    }

    if (input.hasCafeOwnership) {
        return { allowed: true, requiresCafe: true }
    }

    return { allowed: false, requiresCafe: true }
}
```

Update `createBlogPost` in `app/api/actions/blog.ts` to:

- Fetch profile role once for non-admin/mod users.
- Use `canSubmitCommunityBlog` to decide whether to require `cafe_id`.
- If role is `user`, **force** `category: "community"` and **force** `status: "pending"` (via `resolveBlogStatus`).
- Keep writer/admin/mod logic unchanged.

**Step 4: Run test to verify it passes**

Run: `bun test utils/__tests__/blog-community-posting.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add utils/blog/community-posting.ts utils/__tests__/blog-community-posting.test.ts app/api/actions/blog.ts
git commit -m "feat: allow community blog submissions for normal users"
```

---

### Task 2: Add community blog submission action + user blog listing action

**Files:**
- Modify: `app/api/actions/blog.ts`
- Test: `app/api/actions/__tests__/blog-actions.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test"

describe("blog actions exports", () => {
    it("exports createCommunityBlogPost", async () => {
        const mod = await import("@/app/api/actions/blog")
        expect(typeof mod.createCommunityBlogPost).toBe("function")
    })

    it("exports getUserBlogPosts", async () => {
        const mod = await import("@/app/api/actions/blog")
        expect(typeof mod.getUserBlogPosts).toBe("function")
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test app/api/actions/__tests__/blog-actions.test.ts`
Expected: FAIL with missing exports.

**Step 3: Write minimal implementation**

Add to `app/api/actions/blog.ts`:

```ts
export async function createCommunityBlogPost(input: {
    title: string
    excerpt?: string
    content: string
    cover_image?: string | null
}): Promise<BlogActionResult> {
    return createBlogPost({
        title: input.title,
        excerpt: input.excerpt,
        content: input.content,
        cover_image: input.cover_image,
        category: "community",
        status: "pending",
        tags: [],
        featured: false,
        images: [],
        tagged_cafe_ids: [],
        crawl_id: null,
        cafe_id: null,
    })
}

export async function getUserBlogPosts(params: { page?: number; pageSize?: number } = {}): Promise<PaginatedBlogResult> {
    const userId = await getCurrentUserId()
    if (!userId) return { posts: [], total: 0, page: 1, pageSize: 20, hasMore: false }

    const { page = 1, pageSize = 20 } = params
    const offset = (page - 1) * pageSize

    const [postsResult, countResult] = await Promise.all([
        db.select({
            id: blogPosts.id, title: blogPosts.title, slug: blogPosts.slug, excerpt: blogPosts.excerpt,
            content: blogPosts.content, coverImage: blogPosts.coverImage, authorId: blogPosts.authorId,
            cafeId: blogPosts.cafeId, category: blogPosts.category, status: blogPosts.status,
            tags: blogPosts.tags, images: blogPosts.images, taggedCafeIds: blogPosts.taggedCafeIds, crawlId: blogPosts.crawlId, featured: blogPosts.featured, viewsCount: blogPosts.viewsCount,
            publishedAt: blogPosts.publishedAt, createdAt: blogPosts.createdAt, updatedAt: blogPosts.updatedAt,
        })
            .from(blogPosts)
            .where(eq(blogPosts.authorId, userId))
            .orderBy(desc(blogPosts.createdAt))
            .limit(pageSize)
            .offset(offset),
        db.select({ count: count() }).from(blogPosts).where(eq(blogPosts.authorId, userId)),
    ])

    if (postsResult.length === 0) {
        return { posts: [], total: countResult[0]?.count ?? 0, page, pageSize, hasMore: false }
    }

    const authorResult = await db.select({ id: profiles.id, displayName: profiles.displayName, avatarUrl: profiles.avatarUrl, username: profiles.username })
        .from(profiles).where(eq(profiles.id, userId)).limit(1)

    const total = countResult[0]?.count ?? 0
    return {
        posts: postsResult.map(p => mapBlogPost(p, authorResult[0], null)),
        total,
        page,
        pageSize,
        hasMore: offset + pageSize < total,
    }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test app/api/actions/__tests__/blog-actions.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add app/api/actions/blog.ts app/api/actions/__tests__/blog-actions.test.ts
git commit -m "feat: add community blog submit and user blog list actions"
```

---

### Task 3: Build limited community blog editor UI

**Files:**
- Create: `components/blog/CommunityBlogEditor.tsx`
- Modify: `components/layout/NotificationProvider.tsx` (only if new usage needs types)

**Step 1: Manual check prep**

No unit tests. Validate in the browser.

**Step 2: Write minimal implementation**

Create a simplified editor component with fields:
- Title (required)
- Cover image (optional)
- Excerpt (optional) with AI generation + model select
- Content (required)

Key behaviors:
- Use `useNotification().addNotification` for **all AI excerpt errors** and model load errors.
- Guardrails for AI excerpt:
  - Disable if content length < 50.
  - Disable if no model selected.
  - Cooldown (e.g., 20s) after a generate request.
  - Limit max content length used for excerpt (e.g., first 6,000 chars) with a warning notification.
- Load models with retry (3 attempts, backoff 0.5s/1s/2s) and a manual “Retry” button when it fails.

Use `createCommunityBlogPost` on submit, and show success notification + redirect to `/profile/blogs`.

**Step 3: Manual verification**

- Load `/blog/new` and verify model list loads.
- Force model list error (temporarily break env) and confirm retry button and notification.
- Click “Generate with AI” without content -> notification error.
- Submit a valid post -> success and redirect.

**Step 4: Commit**

```bash
git add components/blog/CommunityBlogEditor.tsx
git commit -m "feat: add limited community blog editor"
```

---

### Task 4: Add dedicated normal-user blog submission page

**Files:**
- Create: `app/blog/new/page.tsx`

**Step 1: Manual check prep**

No unit tests. Validate in the browser.

**Step 2: Write minimal implementation**

Create a page that:
- Guards with `auth.api.getSession` (redirect to `/auth/sign-in?callbackUrl=/blog/new`).
- Renders `CommunityBlogEditor` inside a styled container with a back link to `/blog`.

**Step 3: Manual verification**

- Logged out -> redirected to sign-in.
- Logged in -> editor renders.

**Step 4: Commit**

```bash
git add app/blog/new/page.tsx
git commit -m "feat: add community blog submission page"
```

---

### Task 5: Add profile “Blogs” section + private listing page

**Files:**
- Modify: `components/profile/Profile.tsx`
- Create: `components/blog/UserBlogsList.tsx`
- Create: `app/profile/blogs/page.tsx`

**Step 1: Manual check prep**

No unit tests. Validate in the browser.

**Step 2: Write minimal implementation**

`Profile.tsx`:
- Fetch `getUserBlogPosts({ pageSize: 3 })` in a new effect.
- Add a “Blogs” section (similar to Crawls/Collections) with:
  - Cards showing title, status badge, updated date.
  - CTA: “Manage Blogs” linking to `/profile/blogs`.
  - CTA: “Write Blog” linking to `/blog/new`.

`UserBlogsList.tsx`:
- Render the full list with status chips and edit/view actions.
- Use `addNotification` for error handling on deletes (if included).

`app/profile/blogs/page.tsx`:
- Fetch `getUserBlogPosts()` and pass to `UserBlogsList`.

**Step 3: Manual verification**

- Profile shows Blogs section and counts.
- `/profile/blogs` lists posts and CTAs.

**Step 4: Commit**

```bash
git add components/profile/Profile.tsx components/blog/UserBlogsList.tsx app/profile/blogs/page.tsx
git commit -m "feat: surface user blogs in profile"
```

---

### Task 6: Add approval confirmation dialog in Content Management

**Files:**
- Modify: `components/manage/ContentManagement.tsx`

**Step 1: Manual check prep**

No unit tests. Validate in the browser.

**Step 2: Write minimal implementation**

- Add local modal state (`approvalPost`, `showApproveConfirm`).
- Replace direct approve button with a “Confirm approve” modal.
- On confirm, call `handleApproveBlogPost`.

**Step 3: Manual verification**

- Clicking Approve opens modal.
- Confirm triggers approval and updates status.

**Step 4: Commit**

```bash
git add components/manage/ContentManagement.tsx
git commit -m "feat: confirm blog approvals in content management"
```

---

### Task 7: Add retry logic + guardrails to BlogEditor AI excerpt flow

**Files:**
- Modify: `components/blog/BlogEditor.tsx`

**Step 1: Manual check prep**

No unit tests. Validate in the browser.

**Step 2: Write minimal implementation**

- Add `useNotification` and replace excerpt-related `setError` calls with `addNotification`.
- Implement `loadModelsWithRetry` (max 3 tries, exponential backoff) and expose a “Retry” UI.
- Guardrails:
  - Disable generate button if content length < 50.
  - Cooldown after generate (e.g., 20s) with countdown label.
  - Use `content.slice(0, 6000)` for excerpt generation to avoid huge payloads.

**Step 3: Manual verification**

- Model loading retries on failure.
- Generate button disabled when content too short.
- Cooldown prevents rapid re-trigger.

**Step 4: Commit**

```bash
git add components/blog/BlogEditor.tsx
git commit -m "feat: harden blog excerpt AI flow"
```

---

### Task 8: Add tests for canAutoPublishCommunityEvent

**Files:**
- Modify: `app/api/actions/events.ts`
- Create: `app/api/actions/__tests__/events.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test"
import { canAutoPublishCommunityEventForTest } from "@/app/api/actions/events"

describe("canAutoPublishCommunityEvent", () => {
    it("allows admin/moderator", async () => {
        const result = await canAutoPublishCommunityEventForTest({
            isAdminOrModerator: async () => true,
            isOwner: async () => false,
            userId: "u1",
        })
        expect(result).toBe(true)
    })

    it("allows cafe owner", async () => {
        const result = await canAutoPublishCommunityEventForTest({
            isAdminOrModerator: async () => false,
            isOwner: async () => true,
            userId: "u1",
        })
        expect(result).toBe(true)
    })

    it("blocks regular user", async () => {
        const result = await canAutoPublishCommunityEventForTest({
            isAdminOrModerator: async () => false,
            isOwner: async () => false,
            userId: "u1",
        })
        expect(result).toBe(false)
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test app/api/actions/__tests__/events.test.ts`
Expected: FAIL with missing export.

**Step 3: Write minimal implementation**

In `events.ts`, expose a test-only wrapper that accepts dependency overrides:

```ts
export async function canAutoPublishCommunityEventForTest(input: {
    userId: string
    isAdminOrModerator: () => Promise<boolean>
    isOwner: (userId: string) => Promise<boolean>
}) {
    if (await input.isAdminOrModerator()) return true
    return Boolean(await input.isOwner(input.userId))
}
```

Update internal `canAutoPublishCommunityEvent` to call this helper with real deps.

**Step 4: Run test to verify it passes**

Run: `bun test app/api/actions/__tests__/events.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add app/api/actions/events.ts app/api/actions/__tests__/events.test.ts
git commit -m "test: cover community event auto-publish checks"
```

---

### Task 9: Crawl create/view micro-animations + intro transitions

**Files:**
- Modify: `components/crawls/CrawlEditor.tsx`
- Modify: `components/crawls/CrawlView.tsx`

**Step 1: Manual check prep**

No unit tests. Validate in the browser.

**Step 2: Write minimal implementation**

- Wrap key sections with `motion.div` for fade/slide intro.
- Add staggered list item animation for cafe list in `CrawlView`.
- Add subtle hover motion for cards and CTAs.

**Step 3: Manual verification**

- Page load transitions feel smooth on create/edit and view pages.

**Step 4: Commit**

```bash
git add components/crawls/CrawlEditor.tsx components/crawls/CrawlView.tsx
git commit -m "feat: add crawl editor/view micro-animations"
```

---

### Task 10: Crawl map + marker timeline animation

**Files:**
- Modify: `components/map/CrawlRouteMap.tsx`
- Modify: `components/map/CrawlRouteMapInternal.tsx`
- Modify: `utils/map/crawl-route-style.ts`
- Modify: `utils/map/crawl-marker.ts`
- Modify: `app/map.css`
- Test: `components/map/__tests__/crawl-route-animations.test.tsx`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

describe("CrawlRouteMap animations", () => {
    it("adds timeline classes to map markers", () => {
        const filePath = join(process.cwd(), "components", "map", "CrawlRouteMapInternal.tsx")
        const source = readFileSync(filePath, "utf-8")
        expect(source).toContain("crawl-marker-active")
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test components/map/__tests__/crawl-route-animations.test.tsx`
Expected: FAIL.

**Step 3: Write minimal implementation**

- Add props to `CrawlRouteMap`:

```ts
animateTimeline?: boolean
timelineDelayMs?: number
```

- In `CrawlRouteMapInternal`:
  - Maintain `activePointIndex` and `activeSegmentIndex` with `setInterval`.
  - Use a sequence: cafe_1 highlight -> segment_1 draw -> cafe_2 highlight -> segment_2 draw -> repeat.
  - Optionally update `focusPoint` to active cafe for gentle map pan.

- In `crawl-route-style.ts`, allow a className or active state:

```ts
export function getCrawlSegmentStyle(index: number, isActive = false): PathOptions {
    return { ...existing, className: `crawl-route-segment ${isActive ? "is-active" : ""}` }
}
```

- In `crawl-marker.ts`, accept `isActive` and append `crawl-marker-active` class.

- In `app/map.css`, add keyframes:
  - `crawl-route-draw` for SVG stroke-dashoffset.
  - `crawl-marker-pulse` for active cafe.
  - Optional “trail” glow on active segment.

**Step 4: Run test to verify it passes**

Run: `bun test components/map/__tests__/crawl-route-animations.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/map/CrawlRouteMap.tsx components/map/CrawlRouteMapInternal.tsx utils/map/crawl-route-style.ts utils/map/crawl-marker.ts app/map.css components/map/__tests__/crawl-route-animations.test.tsx
git commit -m "feat: animate crawl map timeline"
```

---

### Task 11: Wire timeline animation into crawl pages

**Files:**
- Modify: `components/crawls/CrawlEditor.tsx`
- Modify: `components/crawls/CrawlView.tsx`

**Step 1: Manual check prep**

No unit tests. Validate in the browser.

**Step 2: Write minimal implementation**

- Pass `animateTimeline` and `timelineDelayMs` to `CrawlRouteMap` on both create/edit and view pages.

**Step 3: Manual verification**

- Map highlights cafes in order and draws segments between them.

**Step 4: Commit**

```bash
git add components/crawls/CrawlEditor.tsx components/crawls/CrawlView.tsx
git commit -m "feat: enable crawl map timeline on pages"
```

---

### Task 12 (Optional): Optimistic approve update in Content Management

**Files:**
- Modify: `components/manage/ContentManagement.tsx`

**Step 1: Manual check prep**

No unit tests. Validate in the browser.

**Step 2: Write minimal implementation**

- Optimistically set post status to `published` before request.
- If request fails, rollback and show notification.

**Step 3: Manual verification**

- Approval feels instant and rolls back on failure.

**Step 4: Commit**

```bash
git add components/manage/ContentManagement.tsx
git commit -m "feat: optimistic approve updates in content management"
```

---

Plan complete and saved to `docs/plans/2026-02-16-community-blog-submissions-crawl-ux.md`. Two execution options:

1. Subagent-Driven (this session) - I dispatch fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - Open new session with executing-plans, batch execution with checkpoints

Which approach?
