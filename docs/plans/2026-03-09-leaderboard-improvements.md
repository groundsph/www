# Leaderboard Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix duplicate filter UI in the cafe leaderboard, placeholder image bugs, add nationwide ranking to cafe leaderboard, improve landing page leaderboard display, overhaul the admin backfill tool with month-aware management, and consolidate daily cron jobs into a single route.

**Architecture:** Fix shared state issue between MonthlyLeaderboard and CafeMonthlyLeaderboard by lifting region state fully to the parent; fix image handling by always calling getCafeThumbnailUrl; add avgRating to the snapshot schema and backfill logic so landing page can show ratings; merge existing separate cron routes into one unified daily cron; replace the manual backfill UI with a month-list view that shows missing snapshots.

**Tech Stack:** Next.js App Router, TypeScript, Drizzle ORM, Postgres, Tailwind CSS v4, Bun, React Server Components, react-query-style client hooks.

---

## Task 1: Create a shared PH_REGIONS constant

Right now `PH_REGIONS` is copy-pasted in four files. Create a single source of truth.

**Files:**
- Create: `utils/ph-regions.ts`
- Modify: `app/api/cron/leaderboard-snapshots/route.ts`
- Modify: `app/api/actions/admin.ts`
- Modify: `components/community/MonthlyLeaderboard.tsx`
- Modify: `components/community/CafeMonthlyLeaderboard.tsx`

**Step 1: Create the shared constant**

Create `utils/ph-regions.ts`:
```ts
export const PH_REGIONS = [
  "NCR",
  "Region I",
  "Region II",
  "Region III",
  "Region IV-A",
  "Region IV-B",
  "Region V",
  "Region VI",
  "Region VII",
  "Region VIII",
  "Region IX",
  "Region X",
  "Region XI",
  "Region XII",
  "Region XIII",
  "BARMM",
] as const

export type PhRegion = (typeof PH_REGIONS)[number]
```

**Step 2: Replace imports in all four files**

In each of the four files, remove the inline `const PH_REGIONS = [...]` array and replace with:
```ts
import { PH_REGIONS } from "@/utils/ph-regions"
```

**Step 3: Run lint to verify no type errors**

Run: `bun lint`
Expected: No errors related to PH_REGIONS.

**Step 4: Commit**

```bash
git add utils/ph-regions.ts app/api/cron/leaderboard-snapshots/route.ts app/api/actions/admin.ts components/community/MonthlyLeaderboard.tsx components/community/CafeMonthlyLeaderboard.tsx
git commit -m "refactor: extract PH_REGIONS to shared constant"
```

---

## Task 2: Fix placeholder image handling in leaderboard components

`CafeMonthlyLeaderboard.tsx` and `CafeLeaderboardSection.tsx` pass raw `thumbnail` strings directly to `<Image src>`. The sentinel value `"placeholder"` is a truthy string so the fallback `|| url` never triggers, causing broken images. Fix by always calling `getCafeThumbnailUrl()`.

**Files:**
- Modify: `components/community/CafeMonthlyLeaderboard.tsx`
- Modify: `components/landing/CafeLeaderboardSection.tsx`

**Step 1: Fix CafeMonthlyLeaderboard.tsx**

Find all occurrences of `entry.thumbnail` used directly as an image `src`. Also check the top-3 podium cards.

Replace every direct use of `entry.thumbnail` (or any cafe `thumbnail` field) in `<Image src>` with:
```tsx
import { getCafeThumbnailUrl } from "@/utils/extras"

// before:
<Image src={entry.thumbnail} ... />

// after:
<Image src={getCafeThumbnailUrl(entry.thumbnail)} ... />
```

For any place that has a conditional `entry.thumbnail ? <Image ...> : <div>fallback</div>`, simplify to always render `<Image>` since `getCafeThumbnailUrl` always returns a valid URL:
```tsx
<Image src={getCafeThumbnailUrl(entry.thumbnail)} ... />
```

**Step 2: Fix CafeLeaderboardSection.tsx**

Replace:
```tsx
src={firstPlace.thumbnail || "https://cdn.grounds.ph/cafes/placeholder.jpg"}
```
With:
```tsx
import { getCafeThumbnailUrl } from "@/utils/extras"

src={getCafeThumbnailUrl(firstPlace.thumbnail || "placeholder")}
```

Do the same for 2nd and 3rd place cards in that file.

Also remove the local `LandingCafeEntry` interface and instead import `CafeLeaderboardEntry` from `@/utils/types/leaderboard` for the props type (or keep the local interface but fix the `thumbnail` handling at least).

**Step 3: Run build to verify no image-related errors**

Run: `bun build`
Expected: Build completes without errors.

**Step 4: Commit**

```bash
git add components/community/CafeMonthlyLeaderboard.tsx components/landing/CafeLeaderboardSection.tsx
git commit -m "fix: use getCafeThumbnailUrl in leaderboard image components"
```

---

## Task 3: Fix duplicate region filter — lift region state to parent

`MonthlyLeaderboard.tsx` shows a region filter UI that it also passes to `CafeMonthlyLeaderboard`. But `CafeMonthlyLeaderboard` has its own internal region state, so the parent's filter has no real effect on the cafe view once the child mounts. Fix by removing the internal region state and dropdown from `CafeMonthlyLeaderboard` and fully controlling it from the parent.

**Files:**
- Modify: `components/community/CafeMonthlyLeaderboard.tsx`
- Modify: `components/community/MonthlyLeaderboard.tsx`

**Step 1: Update CafeMonthlyLeaderboard props**

Change the component signature from:
```tsx
interface Props {
    region?: string | null
    yearMonth?: string
}
```
To:
```tsx
interface Props {
    region: string | null       // now required, fully controlled by parent
    yearMonth: string           // now required
    onRegionChange?: never      // no region change from inside; parent handles it
}
```

**Step 2: Remove internal region state from CafeMonthlyLeaderboard**

Delete:
```tsx
const [selectedRegion, setSelectedRegion] = useState<string | null>(region ?? null)
```

And the entire internal `<div>` block that renders the Nationwide / Select Region dropdown filter (roughly lines 247–309). The `region` prop is now directly used for data fetching.

Update the `useEffect` to depend on `region` and `yearMonth` props directly:
```tsx
useEffect(() => {
    if (!yearMonth) return
    fetchLeaderboard(region, yearMonth)
}, [region, yearMonth])
```

**Step 3: Verify MonthlyLeaderboard passes region correctly**

In `MonthlyLeaderboard.tsx`, confirm `<CafeMonthlyLeaderboard>` is called with:
```tsx
<CafeMonthlyLeaderboard
    region={selectedRegion}
    yearMonth={selectedMonth}
/>
```

The parent's single region filter and month selector now control both the user and cafe leaderboard views.

**Step 4: Lint check**

Run: `bun lint`
Expected: No errors.

**Step 5: Commit**

```bash
git add components/community/CafeMonthlyLeaderboard.tsx components/community/MonthlyLeaderboard.tsx
git commit -m "fix: remove duplicate region filter from CafeMonthlyLeaderboard"
```

---

## Task 4: Add nationwide ranking to cafe leaderboard (both nationwide + local)

Currently when viewing a regional cafe leaderboard, there is no nationwide rank shown. Add a `nationwideRank` field to `CafeLeaderboardEntry` that is populated by also computing/fetching the global (`region = null`) leaderboard and cross-referencing.

**Files:**
- Modify: `utils/types/leaderboard.ts`
- Modify: `app/api/actions/leaderboard.ts`
- Modify: `components/community/CafeMonthlyLeaderboard.tsx`

**Step 1: Add nationwideRank to the type**

In `utils/types/leaderboard.ts`, update `CafeLeaderboardEntry`:
```ts
export interface CafeLeaderboardEntry {
    rank: number
    nationwideRank?: number | null   // rank in the global leaderboard; null if already viewing nationwide
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

**Step 2: Populate nationwideRank in getCafeMonthlyLeaderboard**

In `app/api/actions/leaderboard.ts`, update `getCafeMonthlyLeaderboard`:

When `region` is not null (i.e., the caller wants a regional view), also fetch/compute the nationwide leaderboard (limit=100) and create a lookup map:

```ts
// After computing/reading regional leaderboard:
let nationwideRankMap: Map<string, number> = new Map()
if (region) {
    const nationwideResult = await getCafeMonthlyLeaderboard(null, 100, yearMonth)
    for (const entry of nationwideResult.leaderboard) {
        nationwideRankMap.set(entry.cafeId, entry.rank)
    }
}

// Then when mapping results:
return leaderboard.map((entry) => ({
    ...entry,
    nationwideRank: region ? (nationwideRankMap.get(entry.cafeId) ?? null) : null,
}))
```

**Step 3: Display nationwideRank in CafeMonthlyLeaderboard.tsx**

In the cafe rank card (both the top-3 podium and the ranked list), when `selectedRegion` is set (non-null), show the nationwide rank badge:

```tsx
{entry.nationwideRank && region && (
    <span className="text-xs text-muted">
        #{entry.nationwideRank} nationwide
    </span>
)}
```

**Step 4: Lint and build check**

Run: `bun lint && bun build`
Expected: No errors.

**Step 5: Commit**

```bash
git add utils/types/leaderboard.ts app/api/actions/leaderboard.ts components/community/CafeMonthlyLeaderboard.tsx
git commit -m "feat: add nationwide rank to regional cafe leaderboard entries"
```

---

## Task 5: Add avgRating to leaderboard snapshot schema

The snapshot table does not store `avgRating`, so historical months always show `—`. Add a nullable `avgRating` column (stored as a decimal integer × 100, or a `real` type in Postgres) and update the snapshot write paths.

**Files:**
- Modify: `db/schema/tables.ts`
- Modify: `app/api/cron/leaderboard-snapshots/route.ts`
- Modify: `app/api/actions/admin.ts`
- Modify: `app/api/actions/leaderboard.ts`

**Step 1: Add avgRating column to schema**

In `db/schema/tables.ts`, inside `monthlyLeaderboardSnapshots`, add after `reviewCount`:
```ts
avgRating: doublePrecision("avg_rating"),
```

**Step 2: Push schema to dev DB**

Run: `bun db-push`
Expected: Schema applied; new column `avg_rating` appears in the table.

**Step 3: Update cron snapshot write (leaderboard-snapshots/route.ts)**

When inserting cafe snapshots, include `avgRating: entry.avgRating ?? null`.
When inserting user snapshots, `avgRating` stays `null` (not applicable).

**Step 4: Update admin backfill (admin.ts)**

Same as cron — include `avgRating: entry.avgRating ?? null` in the insert payload for cafe snapshot rows.

**Step 5: Update getCafeMonthlyLeaderboard snapshot read**

When reading from `monthlyLeaderboardSnapshots` for historical months, map the `avgRating` column back to the result:
```ts
avgRating: row.avgRating ?? null,
```

Currently it returns `avgRating: null` unconditionally. Update to use the stored value.

**Step 6: Lint check**

Run: `bun lint`
Expected: No errors.

**Step 7: Commit**

```bash
git add db/schema/tables.ts app/api/cron/leaderboard-snapshots/route.ts app/api/actions/admin.ts app/api/actions/leaderboard.ts
git commit -m "feat: store avgRating in leaderboard snapshots"
```

---

## Task 6: Improve landing page leaderboard — show ratings and score instead of visits

The `CafeLeaderboardSection.tsx` currently shows visit count prominently. Replace with score and average rating. Also ensure the layout is more visually interesting.

**Files:**
- Modify: `components/landing/CafeLeaderboardSection.tsx`
- Modify: `app/page.tsx` (ensure avgRating is available in the fetched data)

**Step 1: Update the data fetch in app/page.tsx**

Confirm that `getCafeMonthlyLeaderboard(null, 3)` returns `avgRating` and `score` in the result. After Task 5, `avgRating` will be populated from the snapshot. Verify the landing page call passes the right limit. No change needed unless the return type needs adjusting.

**Step 2: Update CafeLeaderboardSection.tsx display**

In the first-place hero card and the 2nd/3rd place cards, replace `visitCount` display with:

```tsx
{/* Score badge */}
<div className="flex items-center gap-2">
    <span className="text-sm font-semibold">{entry.score.toLocaleString()} pts</span>
    {entry.avgRating && (
        <span className="flex items-center gap-1 text-sm">
            <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
            {entry.avgRating.toFixed(1)}
        </span>
    )}
</div>
```

Remove or de-emphasise the visit count. You can keep it as a secondary stat if desired:
```tsx
<span className="text-xs text-muted">{entry.visitCount} visits</span>
```

**Step 3: Visual polish**

- Add a small crown icon (🏆 or a `Trophy` icon from lucide-react) to the #1 card header.
- Add rank badge (#1, #2, #3) to each card as an overlay or pill.
- Make the region text appear as a subtle tag:
  ```tsx
  <span className="text-xs bg-background/80 px-2 py-0.5 rounded-full">{entry.region}</span>
  ```

**Step 4: Build check**

Run: `bun build`
Expected: No errors.

**Step 5: Commit**

```bash
git add components/landing/CafeLeaderboardSection.tsx
git commit -m "feat: show score and ratings on landing page leaderboard"
```

---

## Task 7: Overhaul admin backfill tool — month-list view with missing snapshot detection

Replace the current single-month picker + two buttons with a view that:
1. Shows a list of the last N months (e.g., 24 months back from today).
2. For each month, shows whether snapshots exist (both user and cafe), and how many rows.
3. Allows generating snapshots for all missing months in one click.
4. Allows deleting a specific month's snapshots with a confirmation dialog (not `window.confirm()`).
5. Allows generating snapshots for a single missing month.

**Files:**
- Create: `app/api/actions/admin.ts` — add `getLeaderboardSnapshotStatus()` action
- Modify: `components/manage/LeaderboardBackfillClient.tsx`
- Modify: `app/manage/system/leaderboard-backfill/page.tsx`

**Step 1: Add getLeaderboardSnapshotStatus server action**

In `app/api/actions/admin.ts`, add:

```ts
export async function getLeaderboardSnapshotStatus(months: string[]): Promise<{
    success: boolean
    data?: Array<{
        yearMonth: string
        userCount: number
        cafeCount: number
        hasMissing: boolean
    }>
    error?: string
}> {
    "use server"
    const user = await getCurrentUser()
    if (!user || (await getUserRole(user.id)) !== "admin") {
        return { success: false, error: "Unauthorized" }
    }
    try {
        const rows = await db
            .select({
                yearMonth: monthlyLeaderboardSnapshots.yearMonth,
                type: monthlyLeaderboardSnapshots.type,
                count: sql<number>`count(*)::int`,
            })
            .from(monthlyLeaderboardSnapshots)
            .where(inArray(monthlyLeaderboardSnapshots.yearMonth, months))
            .groupBy(monthlyLeaderboardSnapshots.yearMonth, monthlyLeaderboardSnapshots.type)

        const byMonth = new Map<string, { user: number; cafe: number }>()
        for (const row of rows) {
            if (!byMonth.has(row.yearMonth)) byMonth.set(row.yearMonth, { user: 0, cafe: 0 })
            const entry = byMonth.get(row.yearMonth)!
            if (row.type === "user") entry.user = row.count
            if (row.type === "cafe") entry.cafe = row.count
        }

        return {
            success: true,
            data: months.map((ym) => {
                const counts = byMonth.get(ym) ?? { user: 0, cafe: 0 }
                return {
                    yearMonth: ym,
                    userCount: counts.user,
                    cafeCount: counts.cafe,
                    hasMissing: counts.user === 0 || counts.cafe === 0,
                }
            }),
        }
    } catch (e) {
        console.error(e)
        return { success: false, error: "Failed to fetch snapshot status" }
    }
}
```

**Step 2: Add backfillAllMissingLeaderboardSnapshots action**

In `app/api/actions/admin.ts`, add:
```ts
export async function backfillAllMissingLeaderboardSnapshots(months: string[]): Promise<{
    success: boolean
    message: string
    processed?: number
}> {
    "use server"
    // auth check same as above
    // For each month in the list, call backfillLeaderboardSnapshots() if hasMissing
    // collect total processed count
    // return summary
}
```

This can call the existing `backfillLeaderboardSnapshots` in a loop for each month that is missing data.

**Step 3: Rewrite LeaderboardBackfillClient.tsx**

Replace the current single-month picker UI with:

```tsx
"use client"

import { useEffect, useState } from "react"
import { getLeaderboardSnapshotStatus, backfillLeaderboardSnapshots, backfillAllMissingLeaderboardSnapshots, deleteLeaderboardSnapshots } from "@/app/api/actions/admin"
import { getLastNMonths } from "@/utils/date" // or inline month list generation

interface MonthStatus {
    yearMonth: string
    userCount: number
    cafeCount: number
    hasMissing: boolean
}

export function LeaderboardBackfillClient() {
    const [months, setMonths] = useState<MonthStatus[]>([])
    const [loading, setLoading] = useState(true)
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null)   // month being confirmed for deletion
    const [processing, setProcessing] = useState<string | null>(null)       // month currently being processed

    // Generate last 24 months list in YYYY-MM format
    function getLast24Months(): string[] { ... }

    useEffect(() => {
        loadStatus()
    }, [])

    async function loadStatus() {
        setLoading(true)
        const monthList = getLast24Months()
        const result = await getLeaderboardSnapshotStatus(monthList)
        if (result.success && result.data) setMonths(result.data)
        setLoading(false)
    }

    async function handleBackfillMonth(yearMonth: string) {
        setProcessing(yearMonth)
        await backfillLeaderboardSnapshots(yearMonth)
        await loadStatus()
        setProcessing(null)
    }

    async function handleDeleteMonth(yearMonth: string) {
        setProcessing(yearMonth)
        await deleteLeaderboardSnapshots(yearMonth)
        setDeleteTarget(null)
        await loadStatus()
        setProcessing(null)
    }

    async function handleBackfillAll() {
        setProcessing("all")
        const missing = months.filter((m) => m.hasMissing).map((m) => m.yearMonth)
        await backfillAllMissingLeaderboardSnapshots(missing)
        await loadStatus()
        setProcessing(null)
    }

    return (
        <div className="space-y-6">
            {/* Header + Backfill All button */}
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Leaderboard Snapshots</h2>
                <button onClick={handleBackfillAll} disabled={processing !== null}>
                    Generate All Missing
                </button>
            </div>

            {/* Month table */}
            <table>
                <thead>
                    <tr>
                        <th>Month</th>
                        <th>User Rows</th>
                        <th>Cafe Rows</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {months.map((m) => (
                        <tr key={m.yearMonth}>
                            <td>{m.yearMonth}</td>
                            <td>{m.userCount}</td>
                            <td>{m.cafeCount}</td>
                            <td>
                                {m.hasMissing
                                    ? <span className="text-destructive">Missing</span>
                                    : <span className="text-green-600">Complete</span>}
                            </td>
                            <td className="flex gap-2">
                                {m.hasMissing && (
                                    <button
                                        onClick={() => handleBackfillMonth(m.yearMonth)}
                                        disabled={processing !== null}
                                    >
                                        Generate
                                    </button>
                                )}
                                <button
                                    onClick={() => setDeleteTarget(m.yearMonth)}
                                    disabled={processing !== null}
                                    className="text-destructive"
                                >
                                    Delete
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Delete confirmation dialog — NO window.confirm() */}
            {deleteTarget && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-background rounded-xl p-6 space-y-4 max-w-sm w-full">
                        <p className="font-semibold">Delete snapshots for {deleteTarget}?</p>
                        <p className="text-sm text-muted">This will delete all user and cafe snapshots for this month. This action cannot be undone.</p>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setDeleteTarget(null)}>Cancel</button>
                            <button
                                onClick={() => handleDeleteMonth(deleteTarget)}
                                className="text-destructive"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
```

**Step 4: Update page.tsx if needed**

The page currently imports `LeaderboardBackfillClient` — no changes needed to the page itself unless component name changes.

**Step 5: Lint + build check**

Run: `bun lint && bun build`
Expected: No errors.

**Step 6: Commit**

```bash
git add app/api/actions/admin.ts components/manage/LeaderboardBackfillClient.tsx
git commit -m "feat: overhaul leaderboard backfill tool with month-list view"
```

---

## Task 8: Merge daily cron jobs into a single route

Currently there are (at least) three separate cron routes:
- `app/api/cron/check-subscriptions/route.ts`
- `app/api/cron/hidden-gems/route.ts`
- `app/api/cron/leaderboard-snapshots/route.ts`

If these all fire on the same schedule, consolidate them into one `app/api/cron/daily/route.ts` that runs all three jobs sequentially (or in parallel where safe). Keep the old routes as thin redirects or remove them if the external cron config can be updated.

**Files:**
- Read: `app/api/cron/check-subscriptions/route.ts`
- Read: `app/api/cron/hidden-gems/route.ts`
- Read: `app/api/cron/leaderboard-snapshots/route.ts`
- Create: `app/api/cron/daily/route.ts`
- (Optional) Modify old route files to delegate to the new one, or leave them in place with a note.

**Step 1: Read all three existing cron routes**

Understand what each one does, what auth it requires, and whether they have side effects that conflict with each other (e.g., same DB tables). Key questions:
- Do all three use the same `CRON_SECRET` header auth pattern?
- Do any of them write to overlapping tables in a way that could conflict if run simultaneously?
- What is the expected schedule for each?

**Step 2: Create the unified daily cron route**

Create `app/api/cron/daily/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server"
// Import the core logic functions from each existing cron (if they export a handler fn),
// or inline the logic here.

export async function GET(req: NextRequest) {
    // Auth check — same CRON_SECRET pattern
    const authHeader = req.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const results: Record<string, unknown> = {}

    // Run each job. Use Promise.allSettled if they are independent.
    // Use sequential await if order matters (e.g., leaderboard should run after subscriptions are updated).

    try {
        // 1. Check subscriptions
        results.subscriptions = await runCheckSubscriptions()
    } catch (e) {
        console.error("check-subscriptions cron failed:", e)
        results.subscriptions = { error: String(e) }
    }

    try {
        // 2. Hidden gems
        results.hiddenGems = await runHiddenGems()
    } catch (e) {
        console.error("hidden-gems cron failed:", e)
        results.hiddenGems = { error: String(e) }
    }

    try {
        // 3. Leaderboard snapshots (monthly — only runs on 1st of month or as configured)
        results.leaderboard = await runLeaderboardSnapshots()
    } catch (e) {
        console.error("leaderboard-snapshots cron failed:", e)
        results.leaderboard = { error: String(e) }
    }

    return NextResponse.json({ ok: true, results })
}
```

Extract the core logic from each existing route into named functions (e.g., `runCheckSubscriptions`, `runHiddenGems`, `runLeaderboardSnapshots`) that can be imported or defined in the new route.

**Note on leaderboard:** The leaderboard snapshot cron is intentionally monthly (runs the previous month's snapshot). If this is called daily, add the same idempotency guard that already exists in the leaderboard cron (skip if snapshot for that month already exists).

**Step 3: Update external cron config in Dokploy**

Change the external cron service (Dokploy) to call `/api/cron/daily` instead of the three individual routes. Update the documentation/AGENTS.md if there is a reference to the cron URL. **Do not delete the old route files** until the external config is confirmed to be pointing to the new one — leave a comment at the top of each old route noting it has been superseded by `/api/cron/daily`.

**Step 4: Lint + build check**

Run: `bun lint && bun build`
Expected: No errors.

**Step 5: Commit**

```bash
git add app/api/cron/daily/route.ts app/api/cron/check-subscriptions/route.ts app/api/cron/hidden-gems/route.ts app/api/cron/leaderboard-snapshots/route.ts
git commit -m "feat: merge cron jobs into unified daily route"
```

---

## Task 9: Clean up stale types and minor technical debt

Tidy up the leftover issues identified in the codebase audit.

**Files:**
- Modify: `utils/types/leaderboard.ts`
- Modify: `app/api/actions/leaderboard.ts`

**Step 1: Remove stale LeaderboardSnapshotRow interface**

In `utils/types/leaderboard.ts`, delete the `LeaderboardSnapshotRow` interface — it has `entityId` and `breakdown` fields that do not exist in the DB schema, and it is imported nowhere. Also remove any re-exports of it.

**Step 2: Fix copy-paste bug in computeCafeLeaderboardLive**

In `app/api/actions/leaderboard.ts`, find:
```ts
userId: r.cafeId,   // leftover from copy-paste
```
Remove this field entirely (or rename it correctly if it is needed — but `CafeLeaderboardEntry` has no `userId` field so it should just be deleted).

**Step 3: Fix UTC offset in leaderboard action**

In `app/api/actions/leaderboard.ts`, replace the hardcoded `- 8 hours` UTC offset for PH time with:
```ts
import { getPHTime } from "@/utils/date"  // or wherever getPHTime lives

// Instead of:
// const start = new Date(Date.UTC(...) - 8 * 3600 * 1000)

// Use the PH time utility consistently:
const phNow = getPHTime()
```

Verify the existing `getPHTime()` function signature and adapt accordingly.

**Step 4: Lint + build check**

Run: `bun lint && bun build`
Expected: No errors.

**Step 5: Commit**

```bash
git add utils/types/leaderboard.ts app/api/actions/leaderboard.ts
git commit -m "fix: remove stale types and clean up leaderboard action"
```

---

## Execution Order Summary

| Task | Description | Priority |
|------|-------------|----------|
| 1 | Extract PH_REGIONS constant | High (blocks others) |
| 2 | Fix placeholder images | High (visible bug) |
| 3 | Fix duplicate filter UI | High (visible bug) |
| 4 | Add nationwide rank | Medium (new feature) |
| 5 | Add avgRating to snapshots | Medium (schema change, do before 6) |
| 6 | Landing page leaderboard polish | Medium (depends on 5) |
| 7 | Admin backfill tool overhaul | Medium (new feature) |
| 8 | Merge cron jobs | Low (infrastructure) |
| 9 | Clean up stale types | Low (tech debt) |

Tasks 1–3 should be done first as they fix visible bugs. Tasks 5 and 6 are sequentially dependent. All others are independent.
