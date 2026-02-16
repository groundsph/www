# Moderation, AI, Blogs, Events Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add per-region moderator scoping, switch AI to an OpenAI-compatible provider with model discovery and blog checks, open blog posting to all users with approval flow, and auto-approve events for admins/moderators/cafe owners.

**Architecture:** Introduce `profiles.moderator_regions` and a shared region-access helper so admin/moderator actions can filter and enforce region scope without duplicating logic. Add a new `blog_status` value for pending approval plus LLM review metadata, and update blog actions/UI to route non-admin/mod posts into approval. Replace Google/Groq utilities with a single OpenAI-compatible client that supports model listing, excerpt generation, and blog checks; expose a small server action API to fetch models for UI and a script for CLI discovery. Update community event submissions to auto-publish for privileged creators.

**Tech Stack:** Next.js App Router, Bun, Drizzle ORM (Postgres), Tailwind v4, motion/react, lucide-react.

---

### Task 0: Worktree + baseline

**Files:**
- None

**Step 1: Create a dedicated worktree**

Run: `git worktree add ../grounds-website-moderation-ai -b moderation-ai-blog-events`
Expected: New worktree directory created.

**Step 2: Install dependencies**

Run: `bun install`
Expected: Dependencies installed without error.

**Step 3: Commit (if repo requires initial setup changes)**

If any lockfiles or metadata changed:

```bash
git add bun.lock* package.json
git commit -m "chore: sync dependencies"
```

---

### Task 1: Add moderator regions column + schema test

**Files:**
- Create: `drizzle/migrations/0010_add-moderator-regions.sql`
- Modify: `db/schema/tables.ts`
- Modify: `utils/types/database.types.ts`
- Test: `db/schema/__tests__/profiles-schema.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

describe("profiles schema", () => {
    it("includes moderator regions column", () => {
        const source = readFileSync(join(process.cwd(), "db", "schema", "tables.ts"), "utf-8")
        expect(source).toContain('moderatorRegions: text("moderator_regions").array()')
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test db/schema/__tests__/profiles-schema.test.ts`
Expected: FAIL with missing string assertion.

**Step 3: Write minimal implementation**

Migration:

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS moderator_regions text[];
```

`db/schema/tables.ts`:

```ts
moderatorRegions: text("moderator_regions").array(),
```

`utils/types/database.types.ts` (profiles Row/Insert/Update):

```ts
moderator_regions: string[] | null
```

**Step 4: Run test to verify it passes**

Run: `bun test db/schema/__tests__/profiles-schema.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add drizzle/migrations/0010_add-moderator-regions.sql db/schema/tables.ts utils/types/database.types.ts db/schema/__tests__/profiles-schema.test.ts
git commit -m "feat: add moderator regions to profiles"
```

---

### Task 2: Region access helper

**Files:**
- Create: `utils/moderation/region-access.ts`
- Test: `utils/__tests__/region-access.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test"
import { normalizeRegions, canAccessRegion } from "@/utils/moderation/region-access"

describe("region access helpers", () => {
    it("normalizes and dedupes region list", () => {
        expect(normalizeRegions([" Region I ", "Region I", ""]) ).toEqual(["Region I"])
    })

    it("allows all when no regions set", () => {
        expect(canAccessRegion([], "Region II")).toBe(true)
        expect(canAccessRegion(null, "Region II")).toBe(true)
    })

    it("restricts when regions set", () => {
        expect(canAccessRegion(["Region I"], "Region I")).toBe(true)
        expect(canAccessRegion(["Region I"], "Region II")).toBe(false)
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/__tests__/region-access.test.ts`
Expected: FAIL with module not found.

**Step 3: Write minimal implementation**

```ts
export function normalizeRegions(regions?: string[] | null): string[] {
    if (!regions) return []
    const seen = new Set<string>()
    const result: string[] = []
    for (const region of regions) {
        const normalized = region.trim()
        if (!normalized || seen.has(normalized)) continue
        seen.add(normalized)
        result.push(normalized)
    }
    return result
}

export function canAccessRegion(
    regions: string[] | null | undefined,
    targetRegion: string | null | undefined
): boolean {
    const normalized = normalizeRegions(regions)
    if (normalized.length === 0) return true
    if (!targetRegion) return false
    return normalized.includes(targetRegion)
}
```

**Step 4: Run test to verify it passes**

Run: `bun test utils/__tests__/region-access.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add utils/moderation/region-access.ts utils/__tests__/region-access.test.ts
git commit -m "feat: add moderator region access helpers"
```

---

### Task 3: Admin API for moderator regions

**Files:**
- Modify: `app/api/actions/admin.ts`

**Step 1: Write the failing test**

Add a small unit-level helper test using the new helper for role updates:

```ts
import { describe, it, expect } from "bun:test"
import { normalizeRegions } from "@/utils/moderation/region-access"

describe("moderator regions input", () => {
    it("filters empty and trims", () => {
        expect(normalizeRegions(["", " Region I "])).toEqual(["Region I"])
    })
})
```

**Step 2: Run test to verify it passes**

Run: `bun test utils/__tests__/region-access.test.ts`
Expected: PASS (reuses previous task test file).

**Step 3: Write minimal implementation**

Add new admin-only server action:

```ts
export async function updateModeratorRegions(targetUserId: string, regions: string[]): Promise<AdminActionResult> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const profileResult = await db.select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== "admin") {
        return { success: false, error: "Only admins can update moderator regions" }
    }

    const targetResult = await db.select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, targetUserId))
        .limit(1)

    if (targetResult[0]?.role !== "moderator") {
        return { success: false, error: "Target user is not a moderator" }
    }

    const normalized = normalizeRegions(regions)
    await db.update(profiles)
        .set({ moderatorRegions: normalized.length > 0 ? normalized : null })
        .where(eq(profiles.id, targetUserId))

    return { success: true }
}
```

Extend `TeamMember` and `getAdminsAndModerators` to include `moderator_regions`:

```ts
moderator_regions: u.moderatorRegions ?? null,
```

Update `updateUserRole` to clear regions when demoting from moderator:

```ts
if (newRole !== "moderator") {
    updates.moderatorRegions = null
}
```

**Step 4: Run tests**

Run: `bun test utils/__tests__/region-access.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/api/actions/admin.ts
git commit -m "feat: add admin action for moderator regions"
```

---

### Task 4: Region scoping for cafe admin queries

**Files:**
- Modify: `app/api/actions/admin.ts`

**Step 1: Write the failing test**

Create a helper in `admin.ts` for region filtering and test it in isolation:

```ts
import { describe, it, expect } from "bun:test"
import { normalizeRegions } from "@/utils/moderation/region-access"

describe("moderator region scoping", () => {
    it("treats empty list as global", () => {
        expect(normalizeRegions(null)).toEqual([])
    })
})
```

**Step 2: Run test**

Run: `bun test utils/__tests__/region-access.test.ts`
Expected: PASS

**Step 3: Write minimal implementation**

In `admin.ts`, add a helper that returns `moderatorRegions` for current user, and apply it to cafe-related queries:

```ts
async function getModeratorRegionsForCurrentUser(): Promise<string[]> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return []

    const result = await db.select({ role: profiles.role, regions: profiles.moderatorRegions })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (result[0]?.role !== "moderator") return []
    return normalizeRegions(result[0]?.regions ?? [])
}
```

Apply in `getPendingCafes`, `getPublishedCafes`, `getPaginatedCafes`, `getCafeFilterOptions`, and the mutation actions (`approveCafe`, `rejectCafe`, `unpublishCafe`, `deleteCafe`, `updateCafe`) by enforcing:

```ts
const regions = await getModeratorRegionsForCurrentUser()
if (regions.length > 0) {
    conditions.push(inArray(cafes.region, regions))
}
```

For mutation endpoints, validate the cafe region before proceeding.

**Step 4: Run tests**

Run: `bun test utils/__tests__/region-access.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/api/actions/admin.ts
git commit -m "feat: scope cafe management to moderator regions"
```

---

### Task 5: Region scoping for suggestions and claims

**Files:**
- Modify: `app/api/actions/suggestions.ts`
- Modify: `app/api/actions/claim.ts`

**Step 1: Write the failing test**

Add a helper test for `canAccessRegion` in `utils/__tests__/region-access.test.ts` if not present.

**Step 2: Run test**

Run: `bun test utils/__tests__/region-access.test.ts`
Expected: PASS

**Step 3: Write minimal implementation**

Add a shared helper inside each file to load current moderator regions and filter by `cafes.region`:

```ts
const regions = await getModeratorRegionsForCurrentUser()
if (regions.length > 0) {
    whereConditions.push(inArray(cafes.region, regions))
}
```

Apply to:
- `getPendingSuggestions`, `approveSuggestion`, `rejectSuggestion`
- `getPendingClaims`, `approveClaim`, `rejectClaim`

For mutation endpoints, fetch the related cafe region and deny if not allowed.

**Step 4: Run tests**

Run: `bun test utils/__tests__/region-access.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/api/actions/suggestions.ts app/api/actions/claim.ts
git commit -m "feat: scope suggestions and claims by moderator region"
```

---

### Task 6: Region scoping for review moderation

**Files:**
- Modify: `app/api/actions/admin.ts`

**Step 1: Write the failing test**

Re-use `region-access.test.ts` (no new failing test needed beyond helper coverage).

**Step 2: Run test**

Run: `bun test utils/__tests__/region-access.test.ts`
Expected: PASS

**Step 3: Write minimal implementation**

Update review moderation endpoints to filter by cafe region when moderator regions are set:

- `getReportedReviews` / `getFlaggedReviews`: join `cafes` and add `inArray(cafes.region, regions)`
- `moderateReview` / `deleteReviewAsAdmin`: fetch review + cafe region, validate access before updating

**Step 4: Run tests**

Run: `bun test utils/__tests__/region-access.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/api/actions/admin.ts
git commit -m "feat: scope review moderation by moderator region"
```

---

### Task 7: Team UI for moderator region assignment

**Files:**
- Modify: `components/manage/CommunityManagement.tsx`
- Modify: `app/api/actions/admin.ts`

**Step 1: Manual check prep**

No unit tests. Plan to verify in UI after implementation.

**Step 2: Write minimal implementation**

Add region selector for moderators:

- Import `PHILIPPINES_LOCATIONS` and derive region names.
- Display a multi-select (checkbox list) for moderators in the Team tab.
- Show “All regions” when `moderator_regions` is null/empty.
- Add actions: `Save Regions` (calls `updateModeratorRegions`), `Clear` (sets empty array).

Example UI snippet:

```tsx
const regionOptions = PHILIPPINES_LOCATIONS.regions.map(r => r.name)
```

**Step 3: Manual verification**

- Log in as admin.
- Open `/manage/community` → Team tab.
- Assign regions to a moderator, save, refresh, confirm display.

**Step 4: Commit**

```bash
git add components/manage/CommunityManagement.tsx app/api/actions/admin.ts
git commit -m "feat: add moderator region assignment UI"
```

---

### Task 8: Add blog pending status + LLM review column

**Files:**
- Create: `drizzle/migrations/0011_add-blog-pending-status.sql`
- Create: `drizzle/migrations/0012_add-blog-llm-review.sql`
- Modify: `db/schema/enums.ts`
- Modify: `db/schema/tables.ts`
- Modify: `utils/types/database.types.ts`
- Modify: `utils/types/blog.ts`
- Test: `db/schema/__tests__/blog-status-enum.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

describe("blog status enum", () => {
    it("includes pending status", () => {
        const source = readFileSync(join(process.cwd(), "db", "schema", "enums.ts"), "utf-8")
        expect(source).toContain('"pending"')
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test db/schema/__tests__/blog-status-enum.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

`db/schema/enums.ts`:

```ts
export const blogStatusEnum = pgEnum("blog_status", [
    "pending",
    "draft",
    "published",
    "archived",
])
```

Migrations:

```sql
ALTER TYPE blog_status ADD VALUE IF NOT EXISTS 'pending';
```

Add LLM review column:

```sql
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS llm_review jsonb;
```

`db/schema/tables.ts`:

```ts
llmReview: jsonb("llm_review"),
```

Update `utils/types/database.types.ts` and `utils/types/blog.ts` to include `pending` and `llm_review`.

**Step 4: Run test to verify it passes**

Run: `bun test db/schema/__tests__/blog-status-enum.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add drizzle/migrations/0011_add-blog-pending-status.sql drizzle/migrations/0012_add-blog-llm-review.sql db/schema/enums.ts db/schema/tables.ts utils/types/database.types.ts utils/types/blog.ts db/schema/__tests__/blog-status-enum.test.ts
git commit -m "feat: add blog pending status and LLM review"
```

---

### Task 9: OpenAI-compatible AI client + tests

**Files:**
- Create: `utils/ai/openai-compatible.ts`
- Test: `utils/ai/__tests__/openai-compatible.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test"
import { normalizeBaseUrl, extractModelIds } from "@/utils/ai/openai-compatible"

describe("openai-compatible helpers", () => {
    it("normalizes base URL", () => {
        expect(normalizeBaseUrl("https://example.com/")).toBe("https://example.com")
    })

    it("extracts model ids from API payload", () => {
        const data = { data: [{ id: "model-a" }, { id: "model-b" }] }
        expect(extractModelIds(data)).toEqual(["model-a", "model-b"])
    })
})
```

**Step 2: Run test**

Run: `bun test utils/ai/__tests__/openai-compatible.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
export function normalizeBaseUrl(url: string): string {
    return url.replace(/\/$/, "")
}

export function extractModelIds(payload: { data?: { id: string }[] }): string[] {
    return (payload.data ?? []).map((m) => m.id)
}
```

Add API functions using `OPENAI_COMPATIBLE_BASE_URL` and `OPENAI_COMPATIBLE_API_KEY`:

```ts
export async function listModels(): Promise<string[]> { /* fetch /v1/models */ }
export async function generateExcerpt(model: string, content: string): Promise<string> { /* chat.completions */ }
export async function checkBlogPost(model: string, content: string): Promise<BlogCheckResult> { /* JSON response */ }
```

**Step 4: Run test**

Run: `bun test utils/ai/__tests__/openai-compatible.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add utils/ai/openai-compatible.ts utils/ai/__tests__/openai-compatible.test.ts
git commit -m "feat: add openai-compatible AI client"
```

---

### Task 10: AI actions + excerpt model discovery

**Files:**
- Modify: `app/api/actions/ai.ts`
- Modify: `components/blog/BlogEditor.tsx`

**Step 1: Manual check prep**

No unit tests (server actions + UI). Validate in the browser.

**Step 2: Write minimal implementation**

Replace provider-based API with model-based API:

```ts
export async function listModelsAction(): Promise<{ success: boolean; models?: string[]; error?: string }>
export async function generateExcerptAction(content: string, model: string): Promise<ActionResponse>
```

Update `BlogEditor`:

- Remove provider dropdown.
- Load models on mount via `listModelsAction`.
- Add model select; default to env `OPENAI_COMPATIBLE_EXCERPT_MODEL` when available.
- Pass selected model to `generateExcerptAction`.

**Step 3: Manual verification**

- Open blog editor.
- Confirm model dropdown loads.
- Generate excerpt using selected model.

**Step 4: Commit**

```bash
git add app/api/actions/ai.ts components/blog/BlogEditor.tsx
git commit -m "feat: switch blog excerpt AI to model-based API"
```

---

### Task 11: Blog moderation flow + LLM check

**Files:**
- Modify: `app/api/actions/blog.ts`
- Modify: `utils/types/blog.ts`

**Step 1: Write the failing test**

Add a small test to validate pending status behavior (pure function). Create `utils/blog/moderation.ts` to isolate logic.

```ts
import { describe, it, expect } from "bun:test"
import { resolveBlogStatus } from "@/utils/blog/moderation"

describe("resolveBlogStatus", () => {
    it("forces pending for non-admin publish", () => {
        expect(resolveBlogStatus("published", false)).toBe("pending")
    })
})
```

**Step 2: Run test**

Run: `bun test utils/__tests__/blog-moderation.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

`utils/blog/moderation.ts`:

```ts
import { BlogStatus } from "@/utils/types/blog"

export function resolveBlogStatus(requested: BlogStatus, isAdminOrModerator: boolean): BlogStatus {
    if (isAdminOrModerator) return requested
    return requested === "published" ? "pending" : requested
}
```

Update `createBlogPost`:

- Allow any authenticated user.
- Use `resolveBlogStatus` for `status`.
- If non-admin/mod, run `checkBlogPost` and store `llmReview`.

Update `updateBlogPost`:

- Allow authors; prevent non-admin/mod from publishing (map to pending).
- Preserve `publishedAt` only for admin/mod publish.

Add `approveBlogPost` action for admin/mod to set status to `published` and set `publishedAt`.

**Step 4: Run test**

Run: `bun test utils/__tests__/blog-moderation.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add utils/blog/moderation.ts utils/__tests__/blog-moderation.test.ts app/api/actions/blog.ts utils/types/blog.ts
git commit -m "feat: add blog approval flow and LLM checks"
```

---

### Task 12: Blog UI updates (pending + approvals)

**Files:**
- Modify: `components/writer/WriterDashboard.tsx`
- Modify: `components/manage/ContentManagement.tsx`
- Modify: `app/manage/content/page.tsx`
- Modify: `components/manage/ManageLayout.tsx`

**Step 1: Manual check prep**

No unit tests. Verify UI states in browser.

**Step 2: Write minimal implementation**

- Add `pending` to Writer filters and status badges.
- In Content Management, show pending badge and add an “Approve” button that calls `approveBlogPost`.
- Allow moderators to access `/manage/content` by removing admin-only restriction and show nav item to moderators.

**Step 3: Manual verification**

- As moderator, access `/manage/content`.
- Approve a pending post; verify status updates.
- As regular user, confirm a publish action results in pending status in dashboard.

**Step 4: Commit**

```bash
git add components/writer/WriterDashboard.tsx components/manage/ContentManagement.tsx app/manage/content/page.tsx components/manage/ManageLayout.tsx
git commit -m "feat: surface blog approvals in management UI"
```

---

### Task 13: Event auto-approval for privileged creators

**Files:**
- Modify: `app/api/actions/events.ts`
- Modify: `components/events/EventSubmissionForm.tsx`

**Step 1: Manual check prep**

No unit tests; verify in UI.

**Step 2: Write minimal implementation**

In `submitCommunityEvent`, add helper:

```ts
async function canAutoPublishCommunityEvent(userId: string): Promise<boolean> {
    if (await isAdminOrModerator()) return true
    const ownerResult = await db.select({ id: cafes.id })
        .from(cafes)
        .where(sql`${cafes.ownerIds} @> ARRAY[${userId}]::uuid[]`)
        .limit(1)
    return Boolean(ownerResult[0])
}
```

Set status to `published` if true; otherwise `pending`.

Update form copy to mention auto-approval for admins/moderators/owners.

**Step 3: Manual verification**

- Submit as regular user → pending.
- Submit as moderator/admin → published.

**Step 4: Commit**

```bash
git add app/api/actions/events.ts components/events/EventSubmissionForm.tsx
git commit -m "feat: auto-approve events for privileged creators"
```

---

### Task 14: AI scripts + README + deps cleanup

**Files:**
- Create: `scripts/list-llm-models.ts`
- Modify: `package.json`
- Modify: `README.md`
- Delete: `utils/ai/google-ai.ts`
- Delete: `utils/ai/groq.ts`

**Step 1: Manual check prep**

No unit tests. Use script output.

**Step 2: Write minimal implementation**

Script:

```ts
import { listModels } from "@/utils/ai/openai-compatible"

const models = await listModels()
console.log(models.join("\n"))
```

`package.json`:

```json
"llm:models": "bun run scripts/list-llm-models.ts"
```

Update README env vars:

- `OPENAI_COMPATIBLE_BASE_URL`
- `OPENAI_COMPATIBLE_API_KEY`
- `OPENAI_COMPATIBLE_EXCERPT_MODEL`
- `OPENAI_COMPATIBLE_BLOG_CHECK_MODEL`
- `OPENAI_COMPATIBLE_CHAT_MODEL`

Remove Google/Groq dependencies and utils.

**Step 3: Manual verification**

Run: `bun run llm:models`
Expected: list of model ids printed.

**Step 4: Commit**

```bash
git add scripts/list-llm-models.ts package.json README.md
git add -u utils/ai/google-ai.ts utils/ai/groq.ts
git commit -m "chore: document openai-compatible AI setup"
```

---

### Task 15: Final verification

**Files:**
- None

**Step 1: Run tests**

Run: `bun test`
Expected: PASS

**Step 2: Run lint**

Run: `bun lint`
Expected: PASS

**Step 3: Commit (if any fixes)**

```bash
git add .
git commit -m "fix: address test and lint issues"
```

---

Plan complete and saved to `docs/plans/2026-02-16-moderation-ai-blog-events.md`. Two execution options:

1. Subagent-Driven (this session) - I dispatch fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - Open new session with executing-plans, batch execution with checkpoints

Which approach?
