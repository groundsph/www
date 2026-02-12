# Grounds Website Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve leaderboard behavior (ties + month selection), update landing activity feed grouping and companion display, refresh branding to Grounds.PH, add search quick link to leaderboard, and implement a full inventory system for cafe owners with restock history, soft deletion, and CSV export.

**Architecture:** Add inventory as a first-class domain with Drizzle schema, Zod validation, and server actions guarded by cafe ownership. Keep all UI in `components/owner/` using existing cafe owner layout patterns, and expose it via a server-rendered route under `app/owner/cafes/[slug]/inventory/page.tsx`. Leaderboard improvements are done in server action + small UI updates, and landing feed grouping is implemented via a separate grouped action so only the landing page changes.

**Tech Stack:** Next.js App Router, React, TypeScript, Bun, Drizzle ORM, PostgreSQL, Zod, Tailwind CSS v4, motion/react

---

## Phase 0: Planning & Validation Utilities

### Task 0.1: Add inventory validation schemas

**Files:**
- Create: `utils/validation/inventory.ts`
- Test: `utils/validation/__tests__/inventory.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "bun:test"
import { createInventoryItemSchema } from "@/utils/validation/inventory"

describe("createInventoryItemSchema", () => {
  it("rejects empty name", () => {
    const result = createInventoryItemSchema.safeParse({
      name: "",
      category: "Beans",
      stock: 1,
      warningThreshold: 1,
    })
    expect(result.success).toBe(false)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/validation/__tests__/inventory.test.ts`
Expected: FAIL (schema missing)

**Step 3: Write minimal implementation**

Create Zod schemas for:
- `createInventoryItemSchema`
- `updateInventoryItemSchema`
- `restockInventoryItemSchema`
- `adjustStockSchema`
- `inventoryFiltersSchema`

Validation constraints:
- `name`: non-empty string
- `category`: non-empty string
- `stock`: integer >= 0
- `warningThreshold`: integer >= 0
- `expiryDate`: optional ISO date string
- `link` and `proofUrl`: optional URL
- `quantity`: integer > 0
- `unitCost`, `totalAmount`: number >= 0

**Step 4: Run test to verify it passes**

Run: `bun test utils/validation/__tests__/inventory.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add utils/validation/inventory.ts utils/validation/__tests__/inventory.test.ts
git commit -m "feat(inventory): add zod validation schemas"
```

---

## Phase 1: Leaderboard Improvements

### Task 1.1: Tie-aware leaderboard ranking

**Files:**
- Create: `utils/leaderboard.ts`
- Test: `utils/__tests__/leaderboard-ranking.test.ts`
- Modify: `app/api/actions/profile.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "bun:test"
import { applyTieRanking } from "@/utils/leaderboard"

describe("applyTieRanking", () => {
  it("assigns same rank to equal counts and skips ranks", () => {
    const input = [
      { userId: "a", visitCount: 10 },
      { userId: "b", visitCount: 10 },
      { userId: "c", visitCount: 8 },
    ]
    const result = applyTieRanking(input)
    expect(result.map((r) => r.rank)).toEqual([1, 1, 3])
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/__tests__/leaderboard-ranking.test.ts`
Expected: FAIL (missing helper)

**Step 3: Write minimal implementation**

Create `applyTieRanking` that:
- Assumes input sorted by `visitCount DESC` + stable secondary sort (username asc)
- Assigns equal counts the same rank

**Step 4: Run test to verify it passes**

Run: `bun test utils/__tests__/leaderboard-ranking.test.ts`
Expected: PASS

**Step 5: Wire into server action**

Update `getMonthlyLeaderboard` to:
- Order by `visitCount DESC`, `profiles.username ASC`
- Apply `applyTieRanking` before returning data

**Step 6: Commit**

```bash
git add utils/leaderboard.ts utils/__tests__/leaderboard-ranking.test.ts app/api/actions/profile.ts
git commit -m "feat(leaderboard): support tie-aware ranking"
```

---

### Task 1.2: Month selection (current + previous months)

**Files:**
- Create: `utils/date/leaderboard-months.ts`
- Test: `utils/date/__tests__/leaderboard-months.test.ts`
- Modify: `app/api/actions/profile.ts`
- Modify: `components/community/MonthlyLeaderboard.tsx`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "bun:test"
import { parseYearMonth, getLastNMonths } from "@/utils/date/leaderboard-months"

describe("leaderboard month helpers", () => {
  it("rejects invalid month format", () => {
    expect(parseYearMonth("2024-13")).toBe(null)
  })

  it("returns last N months", () => {
    const months = getLastNMonths(3)
    expect(months.length).toBe(3)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/date/__tests__/leaderboard-months.test.ts`
Expected: FAIL (missing helpers)

**Step 3: Write minimal implementation**

Implement helpers:
- `parseYearMonth(yearMonth: string)` → returns `{ year, month } | null`
- `getLastNMonths(n: number)` → returns array of `YYYY-MM` strings

**Step 4: Run test to verify it passes**

Run: `bun test utils/date/__tests__/leaderboard-months.test.ts`
Expected: PASS

**Step 5: Update server action**

Add `yearMonth?: string | null` param to `getMonthlyLeaderboard`:
- Validate via `parseYearMonth`
- Default to current month
- Prevent future months (fallback to current)
- Query using the selected month range

**Step 6: Update UI**

Add month selector in `components/community/MonthlyLeaderboard.tsx`:
- Populate with `getLastNMonths(12)`
- Pass `yearMonth` to server action
- Show empty state if no data

**Step 7: Commit**

```bash
git add utils/date/leaderboard-months.ts utils/date/__tests__/leaderboard-months.test.ts app/api/actions/profile.ts components/community/MonthlyLeaderboard.tsx
git commit -m "feat(leaderboard): add month selection"
```

---

### Task 1.3: Top 3 ties UI

**Files:**
- Create: `components/community/leaderboard-utils.ts`
- Test: `components/community/__tests__/leaderboard-grouping.test.ts`
- Modify: `components/community/MonthlyLeaderboard.tsx`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "bun:test"
import { groupByRank } from "@/components/community/leaderboard-utils"

describe("groupByRank", () => {
  it("groups entries by rank", () => {
    const input = [{ rank: 1 }, { rank: 1 }, { rank: 3 }]
    const result = groupByRank(input)
    expect(result[1].length).toBe(2)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test components/community/__tests__/leaderboard-grouping.test.ts`
Expected: FAIL (missing helper)

**Step 3: Write minimal implementation**

Create `groupByRank` that returns a record of rank → entries.

**Step 4: Update UI**

Use `groupByRank` to render top ranks 1–3:
- If multiple users share rank 1, render them side-by-side in the top tier
- Keep visuals consistent with existing podium styling

**Step 5: Run test to verify it passes**

Run: `bun test components/community/__tests__/leaderboard-grouping.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add components/community/leaderboard-utils.ts components/community/__tests__/leaderboard-grouping.test.ts components/community/MonthlyLeaderboard.tsx
git commit -m "feat(leaderboard): render tied podium positions"
```

---

## Phase 2: Landing Page Activity Feed Changes

### Task 2.1: Add grouped landing feed server action (by cafe)

**Files:**
- Modify: `app/api/actions/social.ts`
- Test: `app/api/actions/__tests__/social-grouped.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "bun:test"
import { groupCheckInsByCafe } from "@/app/api/actions/social"

describe("groupCheckInsByCafe", () => {
  it("groups check-ins by cafeId", () => {
    const input = [{ cafeId: "1" }, { cafeId: "1" }, { cafeId: "2" }]
    const grouped = groupCheckInsByCafe(input)
    expect(grouped.length).toBe(2)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test app/api/actions/__tests__/social-grouped.test.ts`
Expected: FAIL (missing helper)

**Step 3: Write minimal implementation**

Add a helper `groupCheckInsByCafe` in `social.ts`:
- Group by `cafeId`
- Track `latestVisitedAt`
- Aggregate visitors

**Step 4: Add new server action**

`getLandingFeedGroupedByCafe(limit)`:
- Uses the same auth constraints
- Fetches recent check-ins from followed users
- Groups them by cafe
- Returns top `limit` cafes

**Step 5: Run test to verify it passes**

Run: `bun test app/api/actions/__tests__/social-grouped.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add app/api/actions/social.ts app/api/actions/__tests__/social-grouped.test.ts
git commit -m "feat(feed): add landing grouped check-ins by cafe"
```

---

### Task 2.2: Update landing ActivityFeed UI only

**Files:**
- Modify: `components/feed/ActivityFeedWrapper.tsx`
- Modify: `components/feed/ActivityFeedSection.tsx`

**Step 1: Update wrapper to use grouped landing action**

- Replace `getFollowedUsersCheckIns` with new grouped action
- Adjust state type to grouped response

**Step 2: Update ActivityFeedSection**

Add a prop `variant: "landing" | "full"`:
- `landing`: grouped cards by cafe, show avatars of visitors + count, **no "with" section**
- `full`: existing UI (including companions)

**Step 3: Ensure “with:” shows only 1 companion (non-landing)**

On the `full` variant, render only the first companion + `+N` badge.

**Step 4: Manual verification**

Run: `bun dev`
- Landing feed shows grouped cafes and no “with” line
- Profile activity page remains ungrouped and shows “with” using only one companion

**Step 5: Commit**

```bash
git add components/feed/ActivityFeedWrapper.tsx components/feed/ActivityFeedSection.tsx
git commit -m "feat(feed): group landing feed and trim companions"
```

---

## Phase 3: Branding Updates

### Task 3.1: Update Navbar brand text

**Files:**
- Modify: `components/layout/Navbar.tsx`

**Step 1: Update brand name**

Replace “Grounds” with “Grounds.PH”.

**Step 2: Commit**

```bash
git add components/layout/Navbar.tsx
git commit -m "chore(brand): update navbar to Grounds.PH"
```

---

### Task 3.2: Update Footer brand text

**Files:**
- Modify: `components/layout/Footer.tsx`

**Step 1: Update brand name**

Replace “Grounds” with “Grounds.PH” in:
- Logo text
- Copyright

**Step 2: Commit**

```bash
git add components/layout/Footer.tsx
git commit -m "chore(brand): update footer to Grounds.PH"
```

---

## Phase 4: Inventory System

### Task 4.1: Add inventory schema

**Files:**
- Create: `db/schema/inventory.ts`
- Modify: `db/schema/index.ts`
- Test: `db/schema/__tests__/inventory-schema.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "bun:test"
import { inventoryItems, inventoryRestockHistory } from "@/db/schema/inventory"

describe("inventory schema", () => {
  it("exports inventory tables", () => {
    expect(inventoryItems).toBeDefined()
    expect(inventoryRestockHistory).toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test db/schema/__tests__/inventory-schema.test.ts`
Expected: FAIL (missing schema)

**Step 3: Implement schema**

Add tables with exact fields:
- `inventory_items`
  - `id`, `cafeId`, `name`, `sku`, `description`, `category`, `stock`, `warningThreshold`, `expiryDate`, `costPrice`, `lastRestocked`, `link`, `status` (active/inactive), `createdAt`, `updatedAt`
- `inventory_restock_history`
  - `id`, `itemId`, `date`, `quantity`, `unitCost`, `totalAmount`, `invoiceNumber`, `proofUrl`, `supplierName`, `orderReference`, `createdAt`

Low stock is computed: `stock <= warningThreshold` (no DB column).

**Step 4: Run test to verify it passes**

Run: `bun test db/schema/__tests__/inventory-schema.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add db/schema/inventory.ts db/schema/index.ts db/schema/__tests__/inventory-schema.test.ts
git commit -m "feat(inventory): add inventory schema"
```

---

### Task 4.2: Inventory server actions

**Files:**
- Create: `app/api/actions/inventory.ts`
- Modify: `utils/types/inventory.ts`
- Test: `app/api/actions/__tests__/inventory-actions.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "bun:test"
import { buildInventoryCsv } from "@/app/api/actions/inventory"

describe("buildInventoryCsv", () => {
  it("includes headers", () => {
    const csv = buildInventoryCsv([
      { name: "Beans", category: "Raw", stock: 2, warningThreshold: 1, status: "active" }
    ])
    expect(csv.split("\n")[0]).toContain("Name")
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test app/api/actions/__tests__/inventory-actions.test.ts`
Expected: FAIL (missing action)

**Step 3: Implement server actions**

Actions (all with `getCurrentUser()` + ownership check):
- `getInventoryItems(cafeId, filters)`
- `getInventoryStats(cafeId)`
- `createInventoryItem(cafeId, input)`
- `updateInventoryItem(itemId, input)`
- `softDeleteInventoryItem(itemId)`
- `restoreInventoryItem(itemId)` (set status active)
- `adjustInventoryStock(itemId, input)` (no restock history entry)
- `restockInventoryItem(itemId, input)` (writes history + updates stock)
- `getRestockHistory(itemId)`
- `exportInventoryToCSV(cafeId, filters)`

Implementation notes:
- Use Zod schemas from `utils/validation/inventory.ts`
- Stock update + history insert must be transaction-safe
- `totalAmount` auto-calculated from `quantity * unitCost` if not provided
- `lastRestocked` updates on restock
- `revalidatePath` on `/owner/cafes/[slug]/inventory`

**Step 4: Run test to verify it passes**

Run: `bun test app/api/actions/__tests__/inventory-actions.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/api/actions/inventory.ts utils/types/inventory.ts app/api/actions/__tests__/inventory-actions.test.ts
git commit -m "feat(inventory): add server actions"
```

---

### Task 4.3: Inventory owner route

**Files:**
- Create: `app/owner/cafes/[slug]/inventory/page.tsx`

**Step 1: Implement server page**

- Auth guard
- Owner validation using existing cafe action
- Fetch inventory items + stats in parallel
- Render `InventoryDashboard`

**Step 2: Commit**

```bash
git add app/owner/cafes/[slug]/inventory/page.tsx
git commit -m "feat(inventory): add owner inventory page"
```

---

### Task 4.4: Inventory UI components

**Files:**
- Create: `components/owner/InventoryDashboard.tsx`
- Create: `components/owner/InventoryStatsCards.tsx`
- Create: `components/owner/InventoryFilters.tsx`
- Create: `components/owner/InventoryTable.tsx`
- Create: `components/owner/InventoryItemModal.tsx`
- Create: `components/owner/InventoryRestockModal.tsx`
- Create: `components/owner/InventoryHistoryModal.tsx`

**Step 1: Dashboard**

Layout inspired by existing owner components:
- Top actions: “New Item” and “Restock Item”
- Stats cards: “Total Items”, “Low Stock”, “Inventory Valuation”
- Search input + filters for Category and Low Stock Only
- Status tabs: Active / Inactive / All

**Step 2: Table + row actions**

Each row action menu:
- Edit
- Adjust Stock
- Restock
- Duplicate
- History
- Delete

**Step 3: Modals**

- Create/Edit modal with all fields listed in requirements
- Restock modal with auto-calculated total
- History modal listing restock entries

**Step 4: Commit**

```bash
git add components/owner/InventoryDashboard.tsx components/owner/InventoryStatsCards.tsx components/owner/InventoryFilters.tsx components/owner/InventoryTable.tsx components/owner/InventoryItemModal.tsx components/owner/InventoryRestockModal.tsx components/owner/InventoryHistoryModal.tsx
git commit -m "feat(inventory): add owner inventory UI"
```

---

### Task 4.5: Hook inventory into owner management

**Files:**
- Modify: `components/owner/CafeManagement.tsx`

**Step 1: Add Inventory tab/link**

Add an Inventory tab that links to `/owner/cafes/[slug]/inventory`.

**Step 2: Commit**

```bash
git add components/owner/CafeManagement.tsx
git commit -m "feat(inventory): link from cafe management"
```

---

## Phase 5: Search Quick Link

### Task 5.1: Add leaderboard quick action

**Files:**
- Modify: `utils/search-index.ts`
- Test: `utils/__tests__/search-index.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "bun:test"
import { quickActions } from "@/utils/search-index"

describe("quickActions", () => {
  it("includes leaderboard", () => {
    expect(quickActions.some((a) => a.href === "/community" && a.title.includes("Leaderboard"))).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/__tests__/search-index.test.ts`
Expected: FAIL

**Step 3: Add quick action**

Add to `quickActions`:
- title: `Quick: Leaderboard`
- href: `/community`
- keywords: `>leaderboard`, `leaderboard`, `rankings`

**Step 4: Run test to verify it passes**

Run: `bun test utils/__tests__/search-index.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add utils/search-index.ts utils/__tests__/search-index.test.ts
git commit -m "feat(search): add leaderboard quick action"
```

---

## Phase 6: Verification

### Task 6.1: Lint

Run: `bun lint`
Expected: No lint errors

### Task 6.2: Tests

Run: `bun test`
Expected: All tests pass

### Task 6.3: Build

Run: `bun build`
Expected: Successful build

---

## Notes & Constraints

- UI components must live in `components/` (use `components/owner/` for inventory).
- Inventory is cafe-scoped, not user-scoped.
- Low Stock is computed, not stored.
- Landing activity feed is the only place where grouping happens.
- “with:” should show only a single companion in non-landing feeds.
- Branding updates must include both Navbar and Footer.
