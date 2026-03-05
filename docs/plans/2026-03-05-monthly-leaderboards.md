# Monthly Leaderboards Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a dual monthly leaderboard system (Top Scouts + Top Cafes) with composite scoring, hybrid live/snapshot data, and a Dokploy-triggered snapshot cron.

**Architecture:** Add a new monthly snapshot table, compute live leaderboards for the current month, and read snapshots for past months. User leaderboard scores are composite from visits + reviews + quality signals; cafe leaderboard scores combine visits, reviews, ratings, likes, and page views. UI exposes a toggle between user and cafe leaderboards under the existing Community tab.

**Tech Stack:** Next.js App Router + Server Actions, Drizzle ORM (Postgres), Bun test runner, Tailwind CSS, motion/react.

---

## Task 0: Prep Worktree and Baseline

**Files:**
- None

**Step 1: Create a dedicated worktree**

Run: `git worktree add ../grounds-website-leaderboards`

Expected: new worktree directory created.

**Step 2: Install dependencies (if needed)**

Run: `bun install`

Expected: packages installed, no errors.

**Step 3: Confirm current leaderboard tests pass**

Run: `bun test utils/__tests__/leaderboard-ranking.test.ts`

Expected: PASS.

**Step 4: Commit prep marker**

```bash
git status
```

Expected: clean working tree.

---

## Task 1: Make `applyTieRanking` Support Custom Score Keys

**Files:**
- Modify: `utils/leaderboard.ts`
- Modify: `utils/__tests__/leaderboard-ranking.test.ts`

**Step 1: Write failing tests for scoreKey**

Add to `utils/__tests__/leaderboard-ranking.test.ts`:

```ts
it("supports custom score keys", () => {
  const input = [
    { userId: "a", score: 12 },
    { userId: "b", score: 12 },
    { userId: "c", score: 6 },
  ]
  const result = applyTieRanking(input, { scoreKey: "score" })
  expect(result.map((r) => r.rank)).toEqual([1, 1, 2])
})

it("defaults to visitCount when scoreKey not provided", () => {
  const input = [
    { userId: "a", visitCount: 5 },
    { userId: "b", visitCount: 4 },
  ]
  const result = applyTieRanking(input)
  expect(result.map((r) => r.rank)).toEqual([1, 2])
})
```

**Step 2: Run tests to verify failure**

Run: `bun test utils/__tests__/leaderboard-ranking.test.ts`

Expected: FAIL (applyTieRanking signature doesn’t accept options).

**Step 3: Implement scoreKey support**

Update `utils/leaderboard.ts`:

```ts
export function applyTieRanking<T extends LeaderboardEntry>(
  entries: T[],
  options?: { scoreKey?: keyof T }
): (T & { rank: number })[] {
  if (entries.length === 0) return []

  const scoreKey = (options?.scoreKey ?? "visitCount") as keyof T
  const result: (T & { rank: number })[] = []
  let currentRank = 1

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const prev = entries[i - 1]

    if (i > 0 && entry[scoreKey] !== prev[scoreKey]) {
      currentRank++
    }

    result.push({ ...entry, rank: currentRank })
  }

  return result
}
```

**Step 4: Run tests to verify pass**

Run: `bun test utils/__tests__/leaderboard-ranking.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add utils/leaderboard.ts utils/__tests__/leaderboard-ranking.test.ts
git commit -m "feat: allow tie ranking by custom score key"
```

---

## Task 2: Add Leaderboard Types

**Files:**
- Create: `utils/types/leaderboard.ts`

**Step 1: Create type definitions**

```ts
export interface UserLeaderboardEntry {
  rank: number
  userId: string
  username: string
  displayName: string
  avatarUrl: string | null
  visitCount: number
  score: number
}

export interface CafeLeaderboardEntry {
  rank: number
  cafeId: string
  name: string
  slug: string
  thumbnail: string
  region: string
  score: number
  visitCount: number
  reviewCount: number
  avgRating: number | null
}

export interface LeaderboardSnapshotRow {
  yearMonth: string
  type: "user" | "cafe"
  entityId: string
  rank: number
  score: number
  breakdown: Record<string, unknown> | null
  region: string | null
}
```

**Step 2: No tests needed (types only)**

**Step 3: Commit**

```bash
git add utils/types/leaderboard.ts
git commit -m "chore: add leaderboard types"
```

---

## Task 3: Add Monthly Snapshot Table

**Files:**
- Modify: `db/schema/tables.ts`
- Modify: `db/schema/index.ts`

**Step 1: Add table definition**

```ts
export const monthlyLeaderboardSnapshots = pgTable(
  "monthly_leaderboard_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    yearMonth: text("year_month").notNull(),
    type: text("type").notNull(),
    entityId: uuid("entity_id").notNull(),
    rank: integer("rank").notNull(),
    score: real("score").notNull(),
    breakdown: jsonb("breakdown"),
    region: text("region"),
    snapshotAt: timestamp("snapshot_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    uniqueEntry: uniqueIndex("mls_unique_entry_idx").on(
      t.yearMonth,
      t.type,
      t.entityId,
      t.region
    ),
  })
)
```

**Step 2: Re-export from schema index**

Add to `db/schema/index.ts`:

```ts
export * from "./tables"
```

(Keep the existing exports; no change required if already exporting all tables.)

**Step 3: Run migration**

Run: `bun db-push`

Expected: Drizzle applies new table without errors.

**Step 4: Commit**

```bash
git add db/schema/tables.ts db/schema/index.ts
git commit -m "feat: add monthly leaderboard snapshot table"
```

---

## Task 4: Update User Monthly Leaderboard Scoring

**Files:**
- Modify: `app/api/actions/profile.ts`
- Modify: `utils/types/leaderboard.ts` (if needed for exports)

**Step 1: Write a focused test for ranking by score**

Add to `utils/__tests__/leaderboard-ranking.test.ts`:

```ts
it("ranks by score when provided", () => {
  const input = [
    { userId: "a", score: 20 },
    { userId: "b", score: 10 },
    { userId: "c", score: 10 },
  ]
  const result = applyTieRanking(input, { scoreKey: "score" })
  expect(result.map((r) => r.rank)).toEqual([1, 2, 2])
})
```

**Step 2: Run test to verify it fails if not already passing**

Run: `bun test utils/__tests__/leaderboard-ranking.test.ts`

Expected: PASS (if Task 1 already done); otherwise FAIL.

**Step 3: Implement composite score query**

In `app/api/actions/profile.ts`, refactor `getMonthlyLeaderboard`:

- Compute these per-user stats for the month:
  - `uniqueVisits = count(distinct cafeVisits.cafeId)`
  - `reviewCount = count(reviews.id)` (published only)
  - `likesReceived = sum(reviews.likesCount)`
  - `photoCount = sum(array_length(reviews.images, 1))`
  - `verifiedCount = count(*) filter (where reviews.isVerifiedVisit = true)`
  - `regionDiversity = count(distinct cafes.region)`

- Composite score formula:

```ts
const score =
  uniqueVisits * 3 +
  reviewCount * 5 +
  likesReceived * 1 +
  photoCount * 2 +
  verifiedCount * 2 +
  regionDiversity * 1
```

- Use `applyTieRanking(results, { scoreKey: "score" })`.

- Preserve `visitCount` in returned rows for UI display.

- Add snapshot read for past months:
  - If selected month is not current month, query `monthly_leaderboard_snapshots` where `type = "user"` and `region` matches.
  - If snapshot exists, return sorted by `rank` and skip live aggregation.

**Step 4: Run tests**

Run: `bun test utils/__tests__/leaderboard-ranking.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add app/api/actions/profile.ts utils/__tests__/leaderboard-ranking.test.ts
git commit -m "feat: compute monthly user leaderboard by composite score"
```

---

## Task 5: Add Cafe Monthly Leaderboard Action

**Files:**
- Create: `app/api/actions/leaderboard.ts`
- Modify: `app/api/actions/profile.ts` (if reusing helpers)

**Step 1: Write the server action**

Create `app/api/actions/leaderboard.ts` with `getCafeMonthlyLeaderboard(region?, limit?, yearMonth?)`:

**Cafe signals (per month):**
- `visitCount = count(cafeVisits.id)`
- `uniqueVisitors = count(distinct cafeVisits.userId)`
- `reviewCount = count(reviews.id)` (published only)
- `avgRating = avg(reviews.rating)` (published only)
- `likesCount = sum(reviews.likesCount)`
- `pageViews = count(distinct cafePageViews.visitorId)`

**Cafe score formula:**

```ts
const score =
  visitCount * 3 +
  uniqueVisitors * 2 +
  reviewCount * 5 +
  (avgRating ?? 0) * 10 +
  likesCount * 1 +
  pageViews * 0.5
```

Include `cafes.isPublished = true` in all queries. Apply optional region filter using `cafes.region`.

**Step 2: Add snapshot support for past months**

When yearMonth is not current month, read from `monthly_leaderboard_snapshots` with `type = "cafe"`.

**Step 3: Run tests (none required)**

**Step 4: Commit**

```bash
git add app/api/actions/leaderboard.ts
git commit -m "feat: add monthly cafe leaderboard action"
```

---

## Task 6: Snapshot Cron Route (Dokploy Curl Trigger)

**Files:**
- Create: `app/api/cron/leaderboard-snapshots/route.ts`

**Step 1: Add cron route**

Implement `GET` handler modeled after `app/api/cron/hidden-gems/route.ts`:

- Validate `Authorization: Bearer <CRON_SECRET>`
- Compute previous month (PH time)
- If snapshot already exists for `yearMonth` (user or cafe), return early
- Generate snapshots for:
  - Global (region = null)
  - All PH regions (same list as UI)
- Insert rows into `monthly_leaderboard_snapshots`
- Return JSON summary

**Step 2: Document cron usage**

Add a short comment block with example curl:

```bash
curl -X GET https://your-domain.com/api/cron/leaderboard-snapshots \
  -H "Authorization: Bearer $CRON_SECRET"
```

**Step 3: Commit**

```bash
git add app/api/cron/leaderboard-snapshots/route.ts
git commit -m "feat: add leaderboard snapshot cron route"
```

---

## Task 7: UI — Add Cafe Leaderboard Component

**Files:**
- Create: `components/community/CafeMonthlyLeaderboard.tsx`

**Step 1: Create component**

Structure mirrors `MonthlyLeaderboard.tsx` but uses cafe data and renders cafe cards:

```tsx
interface CafeEntry {
  rank: number
  cafeId: string
  name: string
  slug: string
  thumbnail: string
  region: string
  score: number
  visitCount: number
  reviewCount: number
  avgRating: number | null
}
```

- Top 3 podium cards with cafe image + name + score
- Rank 4+ list with name, region, visits, rating

**Step 2: Commit**

```bash
git add components/community/CafeMonthlyLeaderboard.tsx
git commit -m "feat: add cafe leaderboard UI"
```

---

## Task 8: UI — Integrate Toggle in Monthly Leaderboard

**Files:**
- Modify: `components/community/MonthlyLeaderboard.tsx`
- Modify: `components/community/ExpandableRankCard.tsx` (show score)

**Step 1: Add leaderboard mode toggle**

Add local state:

```ts
type LeaderboardMode = "users" | "cafes"
const [mode, setMode] = useState<LeaderboardMode>("users")
```

Render two buttons: “Top Scouts” and “Top Cafes”.

**Step 2: Fetch based on mode**

```ts
if (mode === "users") {
  const result = await getMonthlyLeaderboard(selectedRegion, 20, selectedMonth)
  setUserLeaderboard(result.leaderboard)
  setUserRank(result.userRank)
} else {
  const result = await getCafeMonthlyLeaderboard(selectedRegion, 20, selectedMonth)
  setCafeLeaderboard(result.leaderboard)
}
```

**Step 3: Update user cards to show score + visits**

In `ExpandableRankCard.tsx` and list rows, show:

```tsx
<p className="text-white font-bold text-2xl">{entry.score}</p>
<p className="text-white/70 text-sm">points</p>
<p className="text-white/60 text-xs">{entry.visitCount} visits</p>
```

**Step 4: Render cafe leaderboard**

In `MonthlyLeaderboard.tsx`, render `<CafeMonthlyLeaderboard ... />` when mode is "cafes".

**Step 5: Commit**

```bash
git add components/community/MonthlyLeaderboard.tsx components/community/ExpandableRankCard.tsx
git commit -m "feat: add leaderboard toggle and show scores"
```

---

## Task 9: Wire New Action into Community Page

**Files:**
- Modify: `components/community/CommunityPage.tsx`

**Step 1: Update leaderboard description**

Replace hero text to mention Top Scouts + Top Cafes if needed.

**Step 2: Commit**

```bash
git add components/community/CommunityPage.tsx
git commit -m "chore: update leaderboard hero copy"
```

---

## Task 10: Manual Verification

**Step 1: Run unit tests**

Run: `bun test utils/__tests__/leaderboard-ranking.test.ts`

Expected: PASS.

**Step 2: Run lint (optional)**

Run: `bun lint`

Expected: PASS.

**Step 3: Smoke test in dev**

Run: `bun dev`

Verify:
- Leaderboard tab loads
- Toggle switches between Top Scouts and Top Cafes
- Region and month filters work for both
- Score values appear correctly

---

## Execution Notes

- Use the Dokploy cron to hit `/api/cron/leaderboard-snapshots` daily.
- The cron route is idempotent; it should snapshot the previous month only once.
- Keep leaderboard snapshots limited to a fixed size (e.g. top 100) to control table growth.

---

Plan complete and saved to `docs/plans/2026-03-05-monthly-leaderboards.md`.

Two execution options:

1. Subagent-Driven (this session) - I dispatch a fresh subagent per task, review between tasks
2. Parallel Session (separate) - Open a new session with executing-plans and run the plan

Which approach?
