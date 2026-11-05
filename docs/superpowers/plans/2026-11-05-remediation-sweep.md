# Remediation Sweep Implementation Plan

> For agentic workers: use `subagent-driven-development` or `executing-plans` to implement this plan task by task. Every task is a complete RED → GREEN → REFACTOR → COMMIT cycle. Never skip the RED step — run the test and see it fail before writing implementation code.

**Goal:** Close the owner-trust defects, the privilege-escalation hole, the named dead code, the analytics chart/export gaps, and the deferred `/for-owners` entry points — with zero database migrations and zero new dependencies.

**Architectural spec:** `docs/superpowers/specs/2026-11-05-remediation-sweep-spec.md`
**Branch:** `fix/remediation-sweep` (already cut from `prod` @ `bfc4efd`)
**Default branch is `prod`.** Commits land on the feature branch. Do not push to `prod`.

---

## Non-negotiables (read before Task 1)

1. **Zero migrations.** No `db/schema/**` edit, no `drizzle/migrations/**` file. Every task below is code or copy. If a task appears to need a schema change, stop — the plan is wrong.
2. **No destructive SQL.** Never author `DROP`, `TRUNCATE`, or `DELETE` without a `WHERE`.
3. **The owner verification workflow is untouched.** `owner_verification_requests` and its seven actions stay exactly as they are (spec §3.2, Appendix A.1). Deferred, not deleted.
4. **The allowlist lives in its own module, not in `owner.ts`.** `app/api/actions/owner.ts` starts with `'use server'`, and Next.js requires **every export of a `"use server"` module to be an async function**. Exporting a `const` array from it is a build error. Hence `utils/owner/owner-editable-fields.ts` (Task 1).
5. **`ActionResult` is not a shared type.** `app/api/actions/inventory.ts:52` declares it locally and does not export it. New actions declare their own local interface (Task 14).
6. **Server actions are a public RPC surface.** A TypeScript signature is not an authorization boundary. This is the entire premise of Task 2.
7. **Tests run with `--isolate`.** `mock.module` is process-wide and leaks between files. `bun run test` already passes `--isolate`.
8. **Test conventions:** `bun:test` + `@testing-library/react`, `expect(...).toBeTruthy()` (**no jest-dom**), `afterEach(cleanup)`. Tests live in `__tests__/` beside source and are excluded from `tsconfig.json`.
9. **Styling:** Tailwind theme tokens only; `bg-linear-to-*` never `bg-gradient-to-*`; `rounded-xl` cards / `rounded-lg` buttons / `rounded-full` pills; **never `text-secondary` for text**; no `dark:`; no `cursor-pointer`; single-quoted JSX attributes.
10. **Conventional Commits**, scoped where useful (`fix(owner)`, `chore(discount)`, `feat(analytics)`).

---

## Packet → phase map

The spec defines five packets. They map to phases one-to-one, in the spec's recommended order (security first).

| Phase | Packet | Tasks |
|---|---|---|
| 1 | P1 Security & data integrity | 1–4 |
| 2 | P2 Truth (owner-facing copy) | 5–8 |
| 3 | P3 Dead code | 9–11 |
| 4 | P4a Analytics | 12–15 |
| 5 | P4b + P5 Discovery & presentation | 16–21 |
| 6 | E2E browser verification | 22–26 |

---

## Documented deviations from the spec

Two, both implementation-level. Neither changes a requirement.

1. **TRUTH-3 disclosure appears in two places, not one.** The spec says "add a short disclosure where lifecycle status is already displayed". Lifecycle status is displayed in `components/owner/CafeEdit.tsx` (the `Published` / `Pending review` chip), while the dead button lives in `components/owner/CafeManagement.tsx`. Doing only the `CafeEdit` half leaves a red "Danger Zone" card implying an action that does not exist; doing only the `CafeManagement` half leaves the status chip unexplained. Tasks 7 and 8 do both.
2. **The analytics bucketing logic lives in `utils/analytics/series.ts`, not inline in the component.** The spec is silent on location; a pure function can be unit-tested without rendering a 2,300-line component, and the chart task then only has to prove wiring. Task 12.

---

## File structure

### Create — source

| Path | Purpose |
|---|---|
| `utils/owner/owner-editable-fields.ts` | `OWNER_EDITABLE_FIELDS` (the 42-key allowlist) + `isOwnerEditableField()`. Must live outside `owner.ts` (non-negotiable 4). |
| `utils/analytics/series.ts` | `buildChartSeries(viewsByDay, period)` → daily for 7/30, 13 weekly buckets for 90; `maxViewsOf(series)`. |

### Create — tests

| Path | Task |
|---|---|
| `utils/owner/__tests__/owner-editable-fields.test.ts` | 1 |
| `app/api/actions/__tests__/owner-field-allowlist.test.ts` | 2, 4 |
| `app/api/actions/__tests__/menu-suggestions-ownership.test.ts` | 3 |
| `emails/__tests__/ClaimApprovedEmail.test.tsx` | 5 |
| `components/owner/__tests__/stamp-copy.test.ts` | 6 |
| `components/owner/__tests__/lifecycle-disclosure.test.tsx` | 7 |
| `components/cafe/__tests__/CafeDetails.test.tsx` | 8 |
| `components/cafe-editor/__tests__/MenuSection.test.tsx` | 11 |
| `utils/analytics/__tests__/series.test.ts` | 12 |
| `components/owner/__tests__/analytics-tab.test.tsx` | 13, 15 |
| `app/api/actions/__tests__/analytics-export.test.ts` | 14 |
| `components/owner/__tests__/owner-dashboard-empty-state.test.tsx` | 17 |
| `components/submit/__tests__/SubmitPage.test.tsx` | 18 |
| `components/profile/__tests__/profile-owned-cafes.test.tsx` | 19 |
| `components/owner/__tests__/owner-benefits-presentation.test.ts` | 20, 21 |
| `docs/superpowers/e2e/remediation-sweep.md` | 22–26 |
| `docs/superpowers/e2e/screenshots/remediation-*.png` | 22, 23, 25, 26 |

### Modify

| Path | Change | Task |
|---|---|---|
| `app/api/actions/owner.ts` | allowlist enforcement in `updateCafeAsOwner` (`~:373-383`); fix revalidation paths (`~:1270-1272` and the matching block in `removeCafeBadgeStamp`) | 2, 4 |
| `app/api/actions/menu-suggestions.ts` | ownership check in `getMenuItemSuggestionsForCafe` (`:68`) | 3 |
| `emails/ClaimApprovedEmail.tsx` | remove badge bullet + "verified owner" wording (`:74,79,86`) | 5 |
| `components/owner/CafeManagement.tsx` | stamp copy (`:633-636`); Danger Zone → informational card (`:2266-2278`); chart wiring (`:~1864-1874`); export button | 6, 7, 13, 15 |
| `components/owner/CafeEdit.tsx` | subtitle gains staff-only sentence (`:200`) | 7 |
| `components/cafe/CafeDetails.tsx` | straw amenity pill in the desktop `<ul>` (`~:881`) | 8 |
| `app/api/actions/discount.ts` | delete `issueVoucherToUser` (`:503-585`), `getOwnerCampaigns` (`:1246-1333`) | 9, 10 |
| `utils/validation/discount.ts` | delete `issueVoucherToUserSchema` (`:81-84`) + its inferred type (`:98`) | 9 |
| `components/cafe-editor/MenuSection.tsx` | delete banner (`:71-88`) + `pendingSuggestionsCount` prop | 11 |
| `app/api/actions/analytics.ts` | add `exportCafeAnalyticsCSV` | 14 |
| `components/cafe/CafeHero.tsx` | anonymous `/for-owners` link beside the gated claim button (`:521-542`) | 16 |
| `components/owner/OwnerDashboard.tsx` | entry link in the `cafes.length === 0` block (`:59-93`) | 17 |
| `components/submit/SubmitPage.tsx` | entry line under the intro paragraph | 18 |
| `components/profile/Profile.tsx` | entry link in "My Cafes" near "Go to Owner Dashboard" (`:986-990`) | 19 |
| `components/owner/OwnerBenefits.tsx` | icon opacity (`:30-31`); five `max-w-5xl` → `max-w-7xl` (`:35,70,116,200,292`) | 20, 21 |

### Extend (existing test files)

| Path | Adds | Task |
|---|---|---|
| `app/api/actions/__tests__/discount-actions.test.ts` | assertions that the two deleted symbols are no longer exported | 9, 10 |
| `components/cafe/__tests__/cafe-hero-owner-claim.test.tsx` | anonymous entry-link assertions (this file already renders `CafeHero` with its mocks) | 16 |

**Deliberately not extended:** `app/api/actions/__tests__/owner.test.ts` (it imports the action module on line 2, before any `mock.module` could register — hence the new file in Task 2) and `app/api/actions/__tests__/menu-suggestions.test.ts` (it imports nothing from the real module, so it cannot prove authorization — hence the new file in Task 3).

### Explicitly untouched

`proxy.ts`, `app/robots.ts`, `components/chat/ChatWidget.tsx`, `db/schema/**`, `drizzle/migrations/**`, `app/for-owners/page.tsx`, `components/owner/owner-benefits-content.ts`, `components/owner/OwnerBenefits.tsx` markup beyond Tasks 20–21, and the entire owner-verification feature (`owner.ts` verification actions, `admin.ts` verification actions, `owner_verification_requests`).

---

## Phase 1: Security & Data Integrity (spec packet P1)

Ship this phase alone. SEC-1 is a live privilege-escalation path: an owner can currently set `isVerified`, `isPublished`, `isClaimed`, or `ownerIds` on their own cafe.

### Task 1: The owner-editable field allowlist

**Files:**
- Create: `utils/owner/owner-editable-fields.ts`
- Test: `utils/owner/__tests__/owner-editable-fields.test.ts`

**Dependencies:** None. This is the root of the phase.

**TDD Cycle:**

- [x] **RED: Write the failing test**

  Create `utils/owner/__tests__/owner-editable-fields.test.ts`:

  ```typescript
  import { describe, it, expect } from "bun:test"
  import {
      OWNER_EDITABLE_FIELDS,
      PROTECTED_CAFE_COLUMNS,
      isOwnerEditableField,
  } from "@/utils/owner/owner-editable-fields"

  describe("owner-editable-fields", () => {
      it("allows exactly the 42 fields in updateCafeAsOwner's signature", () => {
          expect(OWNER_EDITABLE_FIELDS.length).toBe(42)
      })

      it("includes identity-mapped fields (no snake_case alias)", () => {
          const keys = [
              "name", "description", "area", "region", "province",
              "lat", "lng", "specialty", "tags", "roaster",
              "phone", "email", "socials", "thumbnail", "gallery",
          ]
          for (const key of keys) {
              expect(OWNER_EDITABLE_FIELDS).toContain(key as never)
          }
      })

      it("includes snake_case fields that fieldMap translates", () => {
          const keys = [
              "address_display", "has_wifi", "payment_methods",
              "operating_hours", "city_municipality", "badge_stamp_url",
              "straw_type_other", "is_halal_certified",
          ]
          for (const key of keys) {
              expect(OWNER_EDITABLE_FIELDS).toContain(key as never)
          }
      })

      it("never contains a protected column", () => {
          for (const column of PROTECTED_CAFE_COLUMNS) {
              expect(OWNER_EDITABLE_FIELDS).not.toContain(column as never)
          }
      })

      it("lists the columns that grant ownership or visibility", () => {
          const columns = ["ownerIds", "isClaimed", "isVerified", "isPublished"]
          for (const column of columns) {
              expect(PROTECTED_CAFE_COLUMNS).toContain(column as never)
          }
      })

      it("isOwnerEditableField accepts allowed keys and rejects everything else", () => {
          expect(isOwnerEditableField("name")).toBe(true)
          expect(isOwnerEditableField("has_wifi")).toBe(true)
          expect(isOwnerEditableField("isVerified")).toBe(false)
          expect(isOwnerEditableField("ownerIds")).toBe(false)
          expect(isOwnerEditableField("is_published")).toBe(false)
          expect(isOwnerEditableField("__proto__")).toBe(false)
          expect(isOwnerEditableField("constructor")).toBe(false)
      })
  })
  ```

- [x] **RED: Verify the test fails**

  Run: `bun test --isolate utils/owner/__tests__/owner-editable-fields.test.ts`
  Expected: FAIL — `Cannot find module '@/utils/owner/owner-editable-fields'`

- [x] **GREEN: Write the allowlist module**

  Create `utils/owner/owner-editable-fields.ts`. **This must not live in `owner.ts`**: that file is `'use server'`, and Next.js requires every export of a `"use server"` module to be an async function — exporting a const array there fails the build.

  ```typescript
  /**
   * Fields a cafe owner is allowed to write through `updateCafeAsOwner`.
   *
   * This is an ALLOWLIST, not a blocklist: anything absent is rejected. It lives
   * outside `app/api/actions/owner.ts` because that module is `'use server'`,
   * and Next.js requires every export of such a module to be an async function.
   *
   * The list is exactly the shape of `updateCafeAsOwner`'s `updates` parameter.
   */
  export const OWNER_EDITABLE_FIELDS = [
      "name",
      "description",
      "address_display",
      "area",
      "region",
      "province",
      "city_municipality",
      "lat",
      "lng",
      "has_wifi",
      "has_smoking",
      "has_sockets",
      "has_parking",
      "has_aircon",
      "is_pet_friendly",
      "has_outdoor_seating",
      "has_indoor_seating",
      "has_restroom",
      "has_bidet",
      "has_non_dairy",
      "milk_options",
      "serves_food",
      "is_work_friendly",
      "price_level",
      "payment_methods",
      "specialty",
      "tags",
      "brew_methods",
      "roaster",
      "operating_hours",
      "website_url",
      "phone",
      "email",
      "socials",
      "is_hidden_gem",
      "finding_hint",
      "thumbnail",
      "gallery",
      "badge_stamp_url",
      "is_halal_certified",
      "straw_type",
      "straw_type_other",
  ] as const

  export type OwnerEditableField = (typeof OWNER_EDITABLE_FIELDS)[number]

  /**
   * Columns no owner edit may ever reach. The allowlist already excludes these;
   * stating them separately keeps the intent reviewable, and the test asserts
   * the two lists never overlap.
   */
  export const PROTECTED_CAFE_COLUMNS = [
      "id",
      "slug",
      "ownerIds",
      "isClaimed",
      "isVerified",
      "isPublished",
      "isActive",
      "isTest",
      "createdAt",
      "updatedAt",
  ] as const

  const OWNER_EDITABLE_FIELD_SET: ReadonlySet<string> = new Set(
      OWNER_EDITABLE_FIELDS
  )

  export function isOwnerEditableField(key: string): boolean {
      return OWNER_EDITABLE_FIELD_SET.has(key)
  }
  ```

- [x] **GREEN: Verify the test passes**

  Run: `bun test --isolate utils/owner/__tests__/owner-editable-fields.test.ts`
  Expected: PASS — 6 tests, 0 failures.

  If the 42-count assertion fails, recount the keys in `updateCafeAsOwner`'s `Partial<{...}>` signature at `app/api/actions/owner.ts:263-310` and reconcile — do **not** change the assertion to match a wrong list.

- [x] **REFACTOR: Clean up**
  - The `as never` casts exist because `OWNER_EDITABLE_FIELDS` is `readonly` with a literal union; they are the cheapest way to assert membership.
  - Confirm the two lists share no element (the test asserts it).

- [x] **Commit**

  ```bash
  git add utils/owner/owner-editable-fields.ts utils/owner/__tests__/owner-editable-fields.test.ts
  git commit -m "feat(owner): add allowlist for owner-editable cafe fields (Task 1)"
  ```

---
### Task 2: Enforce the allowlist in `updateCafeAsOwner`

**Files:**
- Modify: `app/api/actions/owner.ts` (import block; insert guard after the ownership check at `~:313`)
- Create: `app/api/actions/__tests__/owner-field-allowlist.test.ts`

**Dependencies:** Task 1

**Why a new test file instead of extending `owner.test.ts`:** that file imports `* as ownerActions` on line 2, before any `mock.module` could register, so mocks added later would not apply. A new file can mock first and import second.

**TDD Cycle:**

- [x] **RED: Write the failing test**

  Create `app/api/actions/__tests__/owner-field-allowlist.test.ts`:

  ```typescript
  import { describe, it, expect, beforeEach, mock } from "bun:test"

  let mockUser: { id: string } | null = { id: "user-1" }
  let mockOwnerIds: string[] = ["user-1"]
  let capturedSet: Record<string, unknown> | null = null
  const revalidatedPaths: string[] = []

  mock.module("next/headers", () => ({
      headers: () => Promise.resolve({ get: () => null }),
  }))

  mock.module("next/cache", () => ({
      revalidatePath: (path: string) => {
          revalidatedPaths.push(path)
      },
  }))

  mock.module("@/lib/auth", () => ({
      getCurrentUser: () => Promise.resolve(mockUser),
  }))

  mock.module("@/utils/contribution-logging", () => ({
      logContribution: () => Promise.resolve(),
      getChangedFields: () => ["name"],
      generateChangeSummary: () => "Updated name",
  }))

  mock.module("@/db", () => ({
      db: {
          select: () => ({
              from: () => ({
                  where: () => ({
                      limit: () =>
                          Promise.resolve([
                              {
                                  ownerIds: mockOwnerIds,
                                  name: "Test Cafe",
                                  description: null,
                                  addressDisplay: "1 Test St",
                                  area: null,
                              },
                          ]),
                  }),
              }),
          }),
          update: () => ({
              set: (values: Record<string, unknown>) => {
                  capturedSet = values
                  return { where: () => Promise.resolve({ rowsAffected: 1 }) }
              },
          }),
      },
      eq: () => ({}),
  }))

  const { updateCafeAsOwner, setCafeBadgeStamp } = await import(
      "@/app/api/actions/owner"
  )

  describe("updateCafeAsOwner — field allowlist", () => {
      beforeEach(() => {
          mockUser = { id: "user-1" }
          mockOwnerIds = ["user-1"]
          capturedSet = null
      })

      it("rejects isVerified and names the field in the error", async () => {
          const result = await updateCafeAsOwner("cafe-1", {
              isVerified: true,
          } as never)

          expect(result.success).toBe(false)
          expect(result.error).toContain("isVerified")
          expect(capturedSet).toBeNull()
      })

      it("rejects every ownership and visibility column", async () => {
          for (const key of [
              "isClaimed",
              "isPublished",
              "isActive",
              "isTest",
              "ownerIds",
          ]) {
              capturedSet = null
              const result = await updateCafeAsOwner("cafe-1", {
                  [key]: true,
              } as never)
              expect(result.success).toBe(false)
              expect(capturedSet).toBeNull()
          }
      })

      it("rejects an unknown key rather than failing silently", async () => {
          const result = await updateCafeAsOwner("cafe-1", {
              arbitrary_column: "x",
          } as never)

          expect(result.success).toBe(false)
          expect(result.error).toContain("arbitrary_column")
          expect(capturedSet).toBeNull()
      })

      it("still writes allowed fields", async () => {
          const result = await updateCafeAsOwner("cafe-1", {
              name: "Renamed Cafe",
              has_wifi: true,
          } as never)

          expect(result.success).toBe(true)
          expect(capturedSet).toBeTruthy()
          expect(capturedSet?.name).toBe("Renamed Cafe")
          expect(capturedSet?.hasWifi).toBe(true)
      })

      it("rejects a non-owner before reaching the allowlist", async () => {
          mockOwnerIds = ["someone-else"]
          const result = await updateCafeAsOwner("cafe-1", {
              name: "Hijacked",
          } as never)

          expect(result.success).toBe(false)
          expect(result.error).toContain("Not authorized")
          expect(capturedSet).toBeNull()
      })

      it("rejects an unauthenticated caller", async () => {
          mockUser = null
          const result = await updateCafeAsOwner("cafe-1", {
              name: "Anonymous",
          } as never)

          expect(result.success).toBe(false)
          expect(capturedSet).toBeNull()
      })
  })
  ```

- [x] **RED: Verify the test fails**

  Run: `bun test --isolate app/api/actions/__tests__/owner-field-allowlist.test.ts`
  Expected: the rejection tests FAIL — the action currently writes whatever key it is given, so `result.success` is `true`. Capture that output as proof the hole is real.

- [x] **GREEN: Add the guard**

  In `app/api/actions/owner.ts`, add to the import block:

  ```typescript
  import { isOwnerEditableField } from "@/utils/owner/owner-editable-fields"
  ```

  Insert immediately after the ownership check (the `if (!isOwner) { ... }` at `~:313`), before the `currentCafe` fetch:

  ```typescript
      // SECURITY: `updates` arrives from the client and the TypeScript signature
      // disappears at runtime. Without this check, `fieldMap[key] || key` writes
      // any column of that name — including isVerified, isClaimed, isPublished
      // and ownerIds. Reject unknown keys loudly rather than dropping them
      // silently, which would surface as "I saved it and nothing happened".
      const rejectedKeys = Object.entries(updates)
          .filter(([key, value]) => value !== undefined && !isOwnerEditableField(key))
          .map(([key]) => key)

      if (rejectedKeys.length > 0) {
          console.error(
              '[updateCafeAsOwner] rejected non-editable fields:',
              rejectedKeys
          )
          return {
              success: false,
              error: `Cannot update ${rejectedKeys.join(', ')}`,
          }
      }
  ```

  Then change `const drizzleKey = fieldMap[key] || key` (`~:375`) to `const drizzleKey = fieldMap[key] ?? key`. Behaviour is identical; `??` signals that the fallback is an intentional identity map for allowlisted keys, not a catch-all.

- [x] **GREEN: Verify the test passes**

  Run: `bun test --isolate app/api/actions/__tests__/owner-field-allowlist.test.ts`
  Expected: PASS — 6 tests, 0 failures.

  Then confirm no regression: `bun test --isolate app/api/actions/__tests__/owner.test.ts` — expected PASS, unchanged count.

- [x] **REFACTOR: Clean up**
  - `console.error` logs field **names** only — never values, which may include address or contact data.
  - Confirm the guard sits **before** the `currentCafe` DB read so a rejected payload costs one query, not two.

- [x] **Commit**

  ```bash
  git add app/api/actions/owner.ts app/api/actions/__tests__/owner-field-allowlist.test.ts
  git commit -m "fix(owner): enforce field allowlist in updateCafeAsOwner (Task 2)"
  ```

---

<!-- PHASE 2 -->
### Task 3: Ownership check on menu-suggestion reads

**Files:**
- Modify: `app/api/actions/menu-suggestions.ts` (`getMenuItemSuggestionsForCafe`, `:68`)
- Create: `app/api/actions/__tests__/menu-suggestions-ownership.test.ts`

**Dependencies:** Task 2

**Why a new test file:** the existing `menu-suggestions.test.ts` imports nothing from the real module — it re-implements the logic against a local `mockDb`, so it cannot prove the action's authorization behaviour.

**TDD Cycle:**

- [x] **RED: Write the failing test**

  Create `app/api/actions/__tests__/menu-suggestions-ownership.test.ts`:

  ```typescript
  import { describe, it, expect, beforeEach, mock } from "bun:test"

  let mockUser: { id: string; role?: string } | null = { id: "user-1" }
  let mockOwnerIds: string[] = ["user-1"]
  const mockSuggestions = [
      { id: "s1", cafeId: "cafe-1", type: "add", status: "pending" },
  ]

  mock.module("next/headers", () => ({
      headers: () => Promise.resolve({ get: () => null }),
  }))

  mock.module("next/cache", () => ({
      revalidatePath: () => {},
  }))

  mock.module("@/lib/auth", () => ({
      getCurrentUser: () => Promise.resolve(mockUser),
  }))

  mock.module("@/db", () => ({
      db: {
          select: () => ({
              from: () => ({
                  where: () => ({
                      limit: () => Promise.resolve([{ ownerIds: mockOwnerIds }]),
                      orderBy: () => Promise.resolve(mockSuggestions),
                  }),
              }),
          }),
      },
      eq: () => ({}),
      and: () => ({}),
      count: () => ({}),
  }))

  const { getMenuItemSuggestionsForCafe } = await import(
      "@/app/api/actions/menu-suggestions"
  )

  describe("getMenuItemSuggestionsForCafe — ownership gate", () => {
      beforeEach(() => {
          mockUser = { id: "user-1" }
          mockOwnerIds = ["user-1"]
      })

      it("returns suggestions to the cafe owner", async () => {
          const result = await getMenuItemSuggestionsForCafe("cafe-1")
          expect(result.length).toBe(1)
      })

      it("returns an empty list to an authenticated non-owner", async () => {
          mockOwnerIds = ["someone-else"]
          const result = await getMenuItemSuggestionsForCafe("cafe-1")
          expect(result.length).toBe(0)
      })

      it("returns an empty list when the cafe has no owners", async () => {
          mockOwnerIds = []
          const result = await getMenuItemSuggestionsForCafe("cafe-1")
          expect(result.length).toBe(0)
      })

      it("returns an empty list to an unauthenticated caller", async () => {
          mockUser = null
          const result = await getMenuItemSuggestionsForCafe("cafe-1")
          expect(result.length).toBe(0)
      })
  })
  ```

- [x] **RED: Verify the test fails**

  Run: `bun test --isolate app/api/actions/__tests__/menu-suggestions-ownership.test.ts`
  Expected: FAIL — the non-owner and no-owner cases return `1`, because the action only checks that *someone* is signed in.

- [x] **GREEN: Add the ownership check**

  Replace `getMenuItemSuggestionsForCafe` in `app/api/actions/menu-suggestions.ts` (`:68-77`) with:

  ```typescript
  export async function getMenuItemSuggestionsForCafe(cafeId: string) {
      const user = await getCurrentUser()
      if (!user) return []

      // Suggestions are cafe-scoped moderation data. Only the cafe's own owners
      // may read the payload; everyone else gets the same empty result as an
      // anonymous visitor so the response does not disclose that the cafe exists.
      const ownerCheckResult = await db
          .select({ ownerIds: cafes.ownerIds })
          .from(cafes)
          .where(eq(cafes.id, cafeId))
          .limit(1)

      const ownsCafe = ownerCheckResult[0]?.ownerIds?.includes(user.id) ?? false
      if (!ownsCafe) return []

      return db
          .select()
          .from(menuItemSuggestions)
          .where(eq(menuItemSuggestions.cafeId, cafeId))
          .orderBy(menuItemSuggestions.createdAt)
  }
  ```

  `cafes` is already imported at `menu-suggestions.ts:4` — no import change needed.

- [x] **GREEN: Verify the test passes**

  Run: `bun test --isolate app/api/actions/__tests__/menu-suggestions-ownership.test.ts`
  Expected: PASS — 4 tests, 0 failures.

  Then: `bun test --isolate app/api/actions/__tests__/menu-suggestions.test.ts` — expected PASS, unchanged.

- [x] **REFACTOR: Clean up**
  - Rejection returns `[]`, identical to the unauthenticated path. Do **not** return an error object — that would distinguish "not yours" from "not signed in" and leak cafe existence.

- [x] **Commit**

  ```bash
  git add app/api/actions/menu-suggestions.ts app/api/actions/__tests__/menu-suggestions-ownership.test.ts
  git commit -m "fix(menu): require cafe ownership to read menu suggestions (Task 3)"
  ```

---

### Task 4: Correct the badge-stamp revalidation paths

**Files:**
- Modify: `app/api/actions/owner.ts` (`setCafeBadgeStamp` `~:1270-1272`, `removeCafeBadgeStamp` `~:1295-1300`)
- Modify/Test: `app/api/actions/__tests__/owner-field-allowlist.test.ts` (append a `describe`; the `next/cache` mock already records paths into `revalidatedPaths`)

**Dependencies:** Task 2

**TDD Cycle:**

- [x] **RED: Write the failing test**

  Append to `app/api/actions/__tests__/owner-field-allowlist.test.ts`:

  ```typescript
  describe("setCafeBadgeStamp — revalidation paths", () => {
      beforeEach(() => {
          mockUser = { id: "user-1" }
          mockOwnerIds = ["user-1"]
          revalidatedPaths.length = 0
      })

      it("revalidates the real public cafe route, not /cafe/[slug]", async () => {
          await setCafeBadgeStamp("cafe-1", "https://cdn.grounds.ph/stamp.png")

          const paths = revalidatedPaths.join(" ")
          expect(paths).not.toContain("/cafe/[slug]")
          expect(paths).toContain("/cafes/[slug]")
      })

      it("revalidates the real owner editor route, not /owner/cafe/:id", async () => {
          await setCafeBadgeStamp("cafe-1", "https://cdn.grounds.ph/stamp.png")

          const paths = revalidatedPaths.join(" ")
          expect(paths).not.toContain("/owner/cafe/")
          expect(paths).toContain("/owner/cafes/[slug]/edit")
      })
  })
  ```

- [x] **RED: Verify the test fails**

  Run: `bun test --isolate app/api/actions/__tests__/owner-field-allowlist.test.ts`
  Expected: FAIL — both assertions. The action revalidates `/cafe/[slug]` and `/owner/cafe/${cafeId}`; neither route exists, so the stamp change never busts the real cache.

- [x] **GREEN: Fix both call sites**

  In `setCafeBadgeStamp` (`~:1270-1272`), replace:

  ```typescript
          revalidatePath(`/cafe/[slug]`, 'page')
          revalidatePath(`/owner/cafe/${cafeId}`, 'page')
          revalidatePath('/owner', 'page')
  ```

  with:

  ```typescript
          // Real routes only: the public cafe page is /cafes/[slug] (plural) and
          // the owner editor is /owner/cafes/[slug]/edit. The previous targets
          // did not exist, so the stamp change stayed stale in the cache.
          revalidatePath('/cafes/[slug]', 'page')
          revalidatePath('/owner/cafes/[slug]/edit', 'page')
          revalidatePath('/owner/cafes')
          revalidatePath('/owner', 'page')
  ```

  Apply the **identical** change in `removeCafeBadgeStamp` (`~:1295-1300`). Both functions carry the same bug; fixing one leaves the stamp visible after removal.

  Verify nothing stale remains:

  ```bash
  grep -n 'cafe/\[slug\]' app/api/actions/owner.ts | grep -v 'cafes/\[slug\]'
  ```

  Expected: no output.

- [x] **GREEN: Verify the test passes**

  Run: `bun test --isolate app/api/actions/__tests__/owner-field-allowlist.test.ts`
  Expected: PASS — 8 tests, 0 failures.

- [x] **REFACTOR: Clean up**
  - Both functions must end with the same four `revalidatePath` calls in the same order.

- [x] **Commit**

  ```bash
  git add app/api/actions/owner.ts app/api/actions/__tests__/owner-field-allowlist.test.ts
  git commit -m "fix(owner): revalidate real routes after badge stamp changes (Task 4)"
  ```

---

## Phase 2: Owner-Facing Truth (spec packet P2)

Nothing here changes behaviour. Everything here stops the product from promising something it does not do.

**Two guard tests in this phase scan source rather than rendering** (Tasks 6, 7, 9). `CafeManagement.tsx` (2 325 lines) and `CafeDetails.tsx` (~900 lines, client, dynamic imports, haptics) are disproportionate and brittle to mount for a two-sentence copy change. The real render is verified in Phase 6 — E2E flow P2 mounts the actual owner editor and public cafe page. Unit-level source guards catch regressions at edit time; E2E proves the outcome. Each source guard still requires a mutation check, because a guard that passes on first write proves nothing.

### Task 5: Remove the false verified-badge promise from the claim email

**Files:**
- Modify: `emails/ClaimApprovedEmail.tsx` (`:74`, `:79`, `:86`)
- Create: `emails/__tests__/ClaimApprovedEmail.test.tsx`

**Dependencies:** None.

**TDD Cycle:**

- [x] **RED: Write the failing test**

  Create `emails/__tests__/ClaimApprovedEmail.test.tsx`:

  ```tsx
  import { describe, it, expect } from "bun:test"
  import { renderToStaticMarkup } from "react-dom/server"
  import ClaimApprovedEmail from "@/emails/ClaimApprovedEmail"

  const render = () =>
      renderToStaticMarkup(
          <ClaimApprovedEmail cafeName="Kape Ni Juan" cafeSlug="kape-ni-juan" />
      )

  describe("ClaimApprovedEmail", () => {
      it("never promises a verified badge", () => {
          const html = render().toLowerCase()
          expect(html).not.toContain("verified badge")
      })

      it("never calls the owner a verified owner", () => {
          const html = render().toLowerCase()
          expect(html).not.toContain("verified owner")
      })

      it("still tells the owner what they can do", () => {
          const html = render().toLowerCase()
          expect(html).toContain("update your cafe")
          expect(html).toContain("respond to customer reviews")
          expect(html).toContain("share your cafe")
      })

      it("still links to the owner dashboard", () => {
          const html = render()
          expect(html).toContain("/owner")
      })

      it("still names the cafe", () => {
          expect(render()).toContain("Kape Ni Juan")
      })
  })
  ```

- [x] **RED: Verify the test fails**

  Run: `bun test --isolate emails/__tests__/ClaimApprovedEmail.test.tsx`
  Expected: FAIL — 2 failing. The rendered HTML contains "get a verified badge on your listing" and "as a verified owner, you can".

- [x] **GREEN: Fix the copy**

  Three edits in `emails/ClaimApprovedEmail.tsx`, nothing else. Do not restructure the layout, do not touch `Tailwind`, `Container`, or any other component.

  1. `:74` — change the opening sentence so it does not imply the cafe now carries a verified badge. Replace `has been verified and approved` with `has been reviewed and approved`.
  2. `:79` — replace the whole `<Text>` line `As a verified owner, you can:` with `As the owner, you can:`.
  3. `:86` — delete the entire list item `<li>Get a verified badge on your listing</li>`.

  After editing, confirm the diff is exactly these three changes:

  ```bash
  git diff emails/ClaimApprovedEmail.tsx
  ```

  Expected: one hunk around `:74`, one around `:79`, one deletion around `:86`. No whitespace churn, no reordering.

- [x] **GREEN: Verify the test passes**

  Run: `bun test --isolate emails/__tests__/ClaimApprovedEmail.test.tsx`
  Expected: PASS — 5 tests, 0 failures.

- [x] **REFACTOR: Clean up**
  - The remaining three bullets are all true: `approveClaim()` grants management access, review replies, and the story editor.
  - Do **not** add a replacement bullet mentioning verification — that would reintroduce the same promise in different words.

- [x] **Commit**

  ```bash
  git add emails/ClaimApprovedEmail.tsx emails/__tests__/ClaimApprovedEmail.test.tsx
  git commit -m "fix(email): stop promising a verified badge on claim approval (Task 5)"
  ```

---

### Task 6: Fix the badge-stamp copy so it matches where the stamp appears

**Files:**
- Modify: `components/owner/CafeManagement.tsx` (`:633-636`)
- Create: `components/owner/__tests__/stamp-copy.test.ts`

**Dependencies:** None.

**TDD Cycle:**

- [x] **RED: Write the failing test**

  Create `components/owner/__tests__/stamp-copy.test.ts`:

  ```typescript
  import { describe, it, expect } from "bun:test"

  const source = await Bun.file(
      "components/owner/CafeManagement.tsx"
  ).text()

  describe("badge stamp copy", () => {
      it("does not claim the stamp is displayed on the cafe page", () => {
          expect(source).not.toContain("display on")
          expect(source).not.toContain("your cafe page")
      })

      it("tells the owner the stamp appears in visitors' Passport", () => {
          expect(source.toLowerCase()).toContain("passport")
      })
  })
  ```

- [x] **RED: Verify the test fails**

  Run: `bun test --isolate components/owner/__tests__/stamp-copy.test.ts`
  Expected: FAIL — 2 failing. The copy reads "Upload a custom badge stamp to display on your cafe page." and never says Passport.

- [x] **GREEN: Rewrite the paragraph**

  Replace the paragraph at `:633-636`:

  ```tsx
                                  <p className='text-text/60 mb-4'>
                                      Upload a custom badge stamp to display on
                                      your cafe page. This is shown as a mark of
                                      authenticity.
                                  </p>
  ```

  with:

  ```tsx
                                  <p className='text-text/60 mb-4'>
                                      Upload a custom stamp for your cafe. Visitors
                                      who check in collect it in their Passport as
                                      a mark of authenticity. It is not shown on
                                      your public cafe page.
                                  </p>
  ```

  The last sentence is deliberate: owners were uploading a stamp expecting to see it on their listing, so the correction has to say where it *isn't*.

- [x] **GREEN: Verify the test passes**

  Run: `bun test --isolate components/owner/__tests__/stamp-copy.test.ts`
  Expected: PASS — 2 tests, 0 failures.

- [x] **REFACTOR: Clean up**
  - Single-quoted className preserved; `text-text/60` unchanged.

- [x] **Commit**

  ```bash
  git add components/owner/CafeManagement.tsx components/owner/__tests__/stamp-copy.test.ts
  git commit -m "fix(owner): badge stamp copy now matches where it is shown (Task 6)"
  ```

---

### Task 7: Disclose that cafe lifecycle is staff-only, and delete the dead removal button

**Files:**
- Modify: `components/owner/CafeManagement.tsx` (replace the Danger Zone card at `:2266-2278`)
- Modify: `components/owner/CafeEdit.tsx` (`EditorHeader` subtitle at `:200`)
- Create: `components/owner/__tests__/lifecycle-disclosure.test.tsx`

**Dependencies:** Task 6 (same file, sequential edits)

**TDD Cycle:**

- [x] **RED: Write the failing test**

  Create `components/owner/__tests__/lifecycle-disclosure.test.tsx`:

  ```tsx
  import { describe, it, expect } from "bun:test"

  const managementSource = await Bun.file(
      "components/owner/CafeManagement.tsx"
  ).text()
  const editSource = await Bun.file("components/owner/CafeEdit.tsx").text()

  describe("cafe lifecycle disclosure", () => {
      it("removes the dead Remove My Ownership button", () => {
          expect(managementSource).not.toContain("Remove My Ownership")
      })

      it("removes the Danger Zone card entirely", () => {
          expect(managementSource).not.toContain("Danger Zone")
      })

      it("states in the management view that only staff can unpublish or remove", () => {
          expect(managementSource).toContain("Only GroundsPH staff can")
      })

      it("states the same thing next to the publication status chip", () => {
          expect(editSource).toContain("Only GroundsPH staff can")
      })

      it("keeps the publication status chip working", () => {
          expect(editSource).toContain("Published")
          expect(editSource).toContain("Pending review")
      })
  })
  ```

- [x] **RED: Verify the test fails**

  Run: `bun test --isolate components/owner/__tests__/lifecycle-disclosure.test.tsx`
  Expected: FAIL — 4 failing. The button and the Danger Zone card both exist, and neither file mentions staff-only control.

- [x] **GREEN: Replace the card**

  In `components/owner/CafeManagement.tsx`, replace the entire Danger Zone block (`:2266-2278`, from `{/* Danger Zone */}` through its closing `</div>`) with:

  ```tsx
                              {/* Listing visibility — informational, not destructive.
                                  Owners cannot unpublish or remove a listing; that
                                  stays with GroundsPH staff. The previous card
                                  promised a removal button that was never wired. */}
                              <div className='p-6 bg-text/5 rounded-xl border border-text/10'>
                                  <h3 className='font-semibold mb-2'>
                                      Listing visibility
                                  </h3>
                                  <p className='text-text/60 text-sm'>
                                      Only GroundsPH staff can unpublish or remove
                                      a listing. To correct something on your page,
                                      edit it directly or contact us.
                                  </p>
                              </div>
  ```

  Note the red `bg-red-50` / `border-red-200` / `text-red-700` classes are gone: an informational note must not look like a hazard.

- [x] **GREEN: Add the subtitle sentence**

  In `components/owner/CafeEdit.tsx`, change the `subtitle` prop at `:200` from:

  ```tsx
                          subtitle='Update your cafe information'
  ```

  to:

  ```tsx
                          subtitle='Update your cafe information. Only GroundsPH staff can unpublish or remove a listing.'
  ```

- [x] **GREEN: Verify the test passes**

  Run: `bun test --isolate components/owner/__tests__/lifecycle-disclosure.test.tsx`
  Expected: PASS — 5 tests, 0 failures.

- [x] **MUTATION CHECK (mandatory)**

  A source guard that passes immediately proves nothing. Temporarily re-add `<button>Remove My Ownership</button>` anywhere in `CafeManagement.tsx`, run the test, and confirm the first assertion fails. Then revert and confirm `git diff components/owner/CafeManagement.tsx` shows **only** the intended card replacement — no leftover mutation.

- [x] **REFACTOR: Clean up**
  - No `bg-red-*` classes remain in the card.
  - Both messages use the exact phrase `Only GroundsPH staff can` so the test's coupling is explicit.

- [x] **Commit**

  ```bash
  git add components/owner/CafeManagement.tsx components/owner/CafeEdit.tsx components/owner/__tests__/lifecycle-disclosure.test.tsx
  git commit -m "fix(owner): disclose staff-only lifecycle, delete dead removal button (Task 7)"
  ```

---

### Task 8: Render the straw amenity on desktop

**Files:**
- Modify: `components/cafe/CafeDetails.tsx` (amenities `<ul>`, insert before `:881`)
- Create: `components/cafe/__tests__/CafeDetails.test.tsx`

**Dependencies:** Task 7

**TDD Cycle:**

- [x] **RED: Write the failing test**

  Create `components/cafe/__tests__/CafeDetails.test.tsx`:

  ```tsx
  import { describe, it, expect } from "bun:test"

  const source = await Bun.file("components/cafe/CafeDetails.tsx").text()

  describe("CafeDetails amenities", () => {
      it("renders the straw amenity, matching the mobile view", () => {
          expect(source).toContain("straw_type")
      })

      it("formats the straw label with the shared formatter", () => {
          expect(source).toContain("formatCafeStrawType")
      })

      it("keeps the amenities that already worked", () => {
          expect(source).toContain("Decaf Options")
          expect(source).toContain("Halal Certified")
          expect(source).toContain("Non-Dairy Milk")
      })
  })
  ```

- [x] **RED: Verify the test fails**

  Run: `bun test --isolate components/cafe/__tests__/CafeDetails.test.tsx`
  Expected: FAIL — 2 failing. `CafeDetails.tsx` contains no `straw_type` and no `formatCafeStrawType`.

- [x] **GREEN: Add the pill**

  In `components/cafe/CafeDetails.tsx`, add to the lucide import block (`:12-30`) an available icon — `Straw` is not in lucide, so reuse the existing `Droplet` import which is already present. No new import needed for the icon.

  Add the formatter import next to the other `@/utils` imports:

  ```typescript
  import { formatCafeStrawType } from "@/utils/formatters"
  ```

  Then, inside the amenities `<ul>`, immediately after the `{cafe.is_halal_certified && ( ... )}` block and before `{cafe.has_smoking && ( ... )}`, insert:

  ```tsx
                                      {cafe.straw_type && (
                                          <AmenityPill
                                              icon={
                                                  <Droplet className='w-3.5 h-3.5' />
                                              }
                                              label={formatCafeStrawType(
                                                  cafe.straw_type,
                                                  cafe.straw_type_other,
                                              )}
                                          />
                                      )}
  ```

  `formatCafeStrawType(value, other)` is exported from `utils/formatters.ts:7` and is already used the same way by `CafeMobileContent.tsx:834`.

- [x] **GREEN: Verify the test passes**

  Run: `bun test --isolate components/cafe/__tests__/CafeDetails.test.tsx`
  Expected: PASS — 3 tests, 0 failures.

- [x] **MUTATION CHECK (mandatory)**

  Temporarily delete the inserted block, run the test, confirm 2 failures, then restore it and confirm the diff contains only the intended addition.

- [x] **REFACTOR: Clean up**
  - `straw_type` is optional on the cafe type, so the `&&` guard is required — do not use `??` or a default.

- [x] **Commit**

  ```bash
  git add components/cafe/CafeDetails.tsx components/cafe/__tests__/CafeDetails.test.tsx
  git commit -m "fix(cafe): show straw amenity on desktop for mobile parity (Task 8)"
  ```

---

<!-- PHASE 3 -->
## Phase 3: Dead Code (spec packet P3)

Deletion only — no behaviour change. **These tasks invert the usual RED:** the test asserts a symbol is *gone*, so it fails while the symbol still exists. That failure is the RED proof.

Do not delete anything not named here. The 55 other orphaned action exports are explicitly out of scope (spec §3.2) — including the entire owner-verification feature, which must remain intact.

### Task 9: Delete `issueVoucherToUser`

**Files:**
- Modify: `app/api/actions/discount.ts` (delete `:503-585`)
- Modify: `utils/validation/discount.ts` (delete `:81-84` and the inferred type at `:98`)
- Modify/Test: `app/api/actions/__tests__/discount-actions.test.ts` (append a `describe`)

**Dependencies:** None, but ship after Phase 1.

**TDD Cycle:**

- [x] **RED: Write the failing test**

  Append to `app/api/actions/__tests__/discount-actions.test.ts`:

  ```typescript
  import * as discountModule from "@/app/api/actions/discount"

  describe("dead voucher surface is gone", () => {
      it("no longer exports issueVoucherToUser", () => {
          expect(
              (discountModule as Record<string, unknown>).issueVoucherToUser
          ).toBeUndefined()
      })

      it("no longer exports getOwnerCampaigns", () => {
          expect(
              (discountModule as Record<string, unknown>).getOwnerCampaigns
          ).toBeUndefined()
      })
  })
  ```

  If the file already imports `* as discountModule` at the top, reuse that import instead of adding a second one.

- [x] **RED: Verify the test fails**

  Run: `bun test --isolate app/api/actions/__tests__/discount-actions.test.ts`
  Expected: FAIL — 2 failing, both symbols are defined.

- [x] **GREEN: Delete `issueVoucherToUser`**

  In `app/api/actions/discount.ts`, delete from the doc comment `/** Issue a voucher directly to a specific user */` (`:503`) through the function's closing brace (`:585`). The block ends immediately before the `// ===== VOUCHER CLAIMING (User) =====` banner at `:587`.

  In `utils/validation/discount.ts`, delete:

  ```typescript
  export const issueVoucherToUserSchema = z.object({
    campaignId: z.string().uuid(),
    userId: z.string().uuid(),
  })
  ```

  and the inferred type line `export type IssueVoucherToUserInput = z.infer<typeof issueVoucherToUserSchema>`.

  Then remove any now-unused imports this leaves behind in `discount.ts` (check `IssueVoucherToUserInput` and `issueVoucherToUserSchema`).

- [x] **GREEN: Verify the first assertion passes**

  Run: `bun test --isolate app/api/actions/__tests__/discount-actions.test.ts`
  Expected: 1 pass, 1 fail (only `issueVoucherToUser` is gone so far). That partial pass is correct — Task 10 handles the second.

- [x] **REFACTOR: Clean up**

  Confirm nothing dangles:

  ```bash
  grep -rn "issueVoucherToUser" --include=*.ts --include=*.tsx . --exclude-dir=node_modules
  ```

  Expected: no matches.

- [x] **Commit**

  ```bash
  git add app/api/actions/discount.ts utils/validation/discount.ts app/api/actions/__tests__/discount-actions.test.ts
  git commit -m "chore(discount): delete unused issueVoucherToUser action (Task 9)"
  ```

---

### Task 10: Delete `getOwnerCampaigns`

**Files:**
- Modify: `app/api/actions/discount.ts` (delete `:1246-1333`)
- Modify/Test: `app/api/actions/__tests__/discount-actions.test.ts` (test already written in Task 9)

**Dependencies:** Task 9

**TDD Cycle:**

- [x] **RED: Verify the remaining assertion fails**

  Run: `bun test --isolate app/api/actions/__tests__/discount-actions.test.ts`
  Expected: FAIL — 1 failing, `getOwnerCampaigns` is still defined. (The `issueVoucherToUser` assertion from Task 9 now passes.)

- [x] **GREEN: Delete the function**

  In `app/api/actions/discount.ts`, delete from the doc comment `/** Get all campaigns for owner dashboard (across all owned cafes) */` (`:1246`) through the closing brace at `:1333`.

  It is the last export in the file section — after deletion, confirm the file still ends cleanly (no orphaned closing brace).

- [x] **GREEN: Verify the test passes**

  Run: `bun test --isolate app/api/actions/__tests__/discount-actions.test.ts`
  Expected: PASS — all tests green, including the 2 new ones.

- [x] **REFACTOR: Clean up**

  ```bash
  grep -rn "getOwnerCampaigns" --include=*.ts --include=*.tsx . --exclude-dir=node_modules
  bunx tsc --noEmit
  ```

  Expected: no grep matches, and `tsc` clean. If `tsc` reports an unused import (`sql`, `DiscountCampaign`), remove it in this commit.

- [x] **Commit**

  ```bash
  git add app/api/actions/discount.ts
  git commit -m "chore(discount): delete unused getOwnerCampaigns action (Task 10)"
  ```

---

### Task 11: Delete the unreachable suggestions banner

**Files:**
- Modify: `components/cafe-editor/MenuSection.tsx` (delete `:71-88`, remove the `pendingSuggestionsCount` prop, drop the now-unused `AlertCircle` and `Link` imports if nothing else uses them)
- Create: `components/cafe-editor/__tests__/MenuSection.test.tsx`

**Dependencies:** Task 10

**TDD Cycle:**

- [x] **RED: Write the failing test**

  Create `components/cafe-editor/__tests__/MenuSection.test.tsx`:

  ```tsx
  import { describe, it, expect } from "bun:test"

  const source = await Bun.file(
      "components/cafe-editor/MenuSection.tsx"
  ).text()

  describe("MenuSection", () => {
      it("no longer links to the non-existent suggestions route", () => {
          expect(source).not.toContain("/suggestions")
      })

      it("no longer accepts a pendingSuggestionsCount prop", () => {
          expect(source).not.toContain("pendingSuggestionsCount")
      })

      it("still renders the menu filters", () => {
          expect(source).toContain("filterPills")
      })
  })
  ```

- [x] **RED: Verify the test fails**

  Run: `bun test --isolate components/cafe-editor/__tests__/MenuSection.test.tsx`
  Expected: FAIL — 2 failing. The banner renders `href={\`/cafes/${cafeSlug}/suggestions\`}` and the component destructures `pendingSuggestionsCount`.

- [x] **GREEN: Delete the banner and the prop**

  Delete the entire block at `:70-88` — from `{/* Pending Suggestions Notice */}` through its closing `)}`, keeping the `{/* Filters */}` comment that follows.

  Remove `pendingSuggestionsCount` from the component's destructured props and from its props interface. Then remove `AlertCircle` from the `lucide-react` import if it is used nowhere else in the file, and `Link` from `next/link` if likewise unused.

- [x] **GREEN: Verify the test passes**

  Run: `bun test --isolate components/cafe-editor/__tests__/MenuSection.test.tsx`
  Expected: PASS — 3 tests, 0 failures.

- [x] **REFACTOR: Clean up**

  ```bash
  bunx tsc --noEmit
  ```

  Expected: clean. `MenuSection`'s only callers are `CafeEdit.tsx:579` and `CafeEditor.tsx:835`; neither passed the prop, which is exactly why the banner was unreachable. Both compile unchanged.

- [x] **Commit**

  ```bash
  git add components/cafe-editor/MenuSection.tsx components/cafe-editor/__tests__/MenuSection.test.tsx
  git commit -m "chore(menu): delete unreachable suggestions banner (Task 11)"
  ```

---

<!-- PHASE 4 -->
## Phase 4: Analytics Correctness & Export (spec packet P4a)

### Task 12: The chart-series builder

**Files:**
- Create: `utils/analytics/series.ts`
- Test: `utils/analytics/__tests__/series.test.ts`

**Dependencies:** None.

**TDD Cycle:**

- [x] **RED: Write the failing test**

  Create `utils/analytics/__tests__/series.test.ts`:

  ```typescript
  import { describe, it, expect } from "bun:test"
  import { buildChartSeries, maxViewsOf } from "@/utils/analytics/series"

  const day = (date: string, views: number, uniqueVisitors = 1) => ({
      date,
      views,
      uniqueVisitors,
  })

  describe("buildChartSeries", () => {
      it("returns 7 daily points for a 7-day period", () => {
          const days = Array.from({ length: 7 }, (_, i) =>
              day(`2026-01-0${i + 1}`, 1)
          )
          const series = buildChartSeries(days, 7)
          expect(series.length).toBe(7)
          expect(series[0].views).toBe(1)
      })

      it("returns 30 daily points for a 30-day period", () => {
          const days = Array.from({ length: 30 }, (_, i) =>
              day(`2026-01-${String(i + 1).padStart(2, "0")}`, 2)
          )
          const series = buildChartSeries(days, 30)
          expect(series.length).toBe(30)
      })

      it("returns 13 weekly buckets for a 90-day period", () => {
          const days = Array.from({ length: 90 }, (_, i) =>
              day(`d${String(i).padStart(3, "0")}`, 1)
          )
          const series = buildChartSeries(days, 90)
          expect(series.length).toBe(13)
      })

      it("sums views within a weekly bucket", () => {
          const days = [
              day("d0", 1), day("d1", 2), day("d2", 3), day("d3", 4),
              day("d4", 5), day("d5", 6), day("d6", 7),
          ]
          const series = buildChartSeries(days, 90)
          expect(series.length).toBe(1)
          expect(series[0].views).toBe(28)
      })

      it("never returns more buckets than it was given days", () => {
          const series = buildChartSeries([day("d0", 4)], 90)
          expect(series.length).toBe(1)
          expect(series[0].views).toBe(4)
      })
  })

  describe("maxViewsOf", () => {
      it("returns the largest rendered value", () => {
          expect(maxViewsOf([{ label: "a", views: 3 }, { label: "b", views: 9 }])).toBe(9)
      })

      it("floors at 1 so an all-zero series does not divide by zero", () => {
          expect(maxViewsOf([{ label: "a", views: 0 }])).toBe(1)
          expect(maxViewsOf([])).toBe(1)
      })
  })
  ```

- [x] **RED: Verify the test fails**

  Run: `bun test --isolate utils/analytics/__tests__/series.test.ts`
  Expected: FAIL — `Cannot find module '@/utils/analytics/series'`.

- [x] **GREEN: Write the module**

  Create `utils/analytics/series.ts`:

  ```typescript
  export type AnalyticsPeriod = 7 | 30 | 90

  export interface ChartPoint {
      label: string
      views: number
  }

  const WEEK_LENGTH = 7
  const MAX_WEEKS = 13

  /**
   * Shape `viewsByDay` into the series the chart actually draws.
   *
   * 7 and 30 render one bar per day. 90 would be sub-pixel at chart width, so it
   * is bucketed into weeks — 13 bars, which represents the full selected range
   * honestly instead of silently showing the last 30 days.
   *
   * Only `views` is aggregated. `uniqueVisitors` is deliberately not carried
   * into buckets: a visitor active on three days inside one week would be
   * counted three times. Anything needing true uniques stays daily (the CSV).
   */
  export function buildChartSeries(
      viewsByDay: Array<{ date: string; views: number }>,
      period: AnalyticsPeriod
  ): ChartPoint[] {
      const daily: ChartPoint[] = viewsByDay.map((d) => ({
          label: d.date,
          views: d.views,
      }))

      if (period !== 90) {
          return daily.slice(-period)
      }

      const buckets: ChartPoint[] = []
      for (let end = daily.length; end > 0; end -= WEEK_LENGTH) {
          const start = Math.max(0, end - WEEK_LENGTH)
          const week = daily.slice(start, end)
          buckets.unshift({
              label: week[0].label,
              views: week.reduce((sum, point) => sum + point.views, 0),
          })
      }

      return buckets.slice(-MAX_WEEKS)
  }

  export function maxViewsOf(series: ChartPoint[]): number {
      if (series.length === 0) return 1
      return Math.max(...series.map((point) => point.views), 1)
  }
  ```

- [x] **GREEN: Verify the test passes**

  Run: `bun test --isolate utils/analytics/__tests__/series.test.ts`
  Expected: PASS — 7 tests, 0 failures.

- [x] **REFACTOR: Clean up**
  - The 90-day case walks backwards so the most recent week is always whole. A leading partial week is allowed and is the oldest bucket.

- [x] **Commit**

  ```bash
  git add utils/analytics/series.ts utils/analytics/__tests__/series.test.ts
  git commit -m "feat(analytics): add chart series builder with weekly 90-day buckets (Task 12)"
  ```

---

### Task 13: Wire the corrected series into the analytics chart

**Files:**
- Modify: `components/owner/CafeManagement.tsx` (`:~1864-1874`)
- Create: `components/owner/__tests__/analytics-tab.test.tsx`

**Dependencies:** Task 12

**TDD Cycle:**

- [x] **RED: Write the failing test**

  Create `components/owner/__tests__/analytics-tab.test.tsx`:

  ```tsx
  import { describe, it, expect } from "bun:test"

  const source = await Bun.file(
      "components/owner/CafeManagement.tsx"
  ).text()

  describe("analytics chart wiring", () => {
      it("no longer truncates the series to 30 points", () => {
          expect(source).not.toContain("Math.min(")
      })

      it("builds the series with the shared helper", () => {
          expect(source).toContain("buildChartSeries")
          expect(source).toContain("maxViewsOf")
      })

      it("labels the 90-day view as weekly", () => {
          expect(source.toLowerCase()).toContain("per week")
      })
  })
  ```

- [x] **RED: Verify the test fails**

  Run: `bun test --isolate components/owner/__tests__/analytics-tab.test.tsx`
  Expected: FAIL — 3 failing. The chart uses `.slice(-Math.min(analyticsPeriod, 30))`, computes `maxViews` inside the `.map`, and has no "per week" label.

- [x] **GREEN: Replace the chart block**

  Add the import:

  ```typescript
  import { buildChartSeries, maxViewsOf } from "@/utils/analytics/series"
  ```

  Replace the `analytics.viewsByDay.slice(-Math.min(analyticsPeriod, 30)).map(...)` expression (`~:1864`) so the series and max are computed **once** before the JSX returns, not inside `.map`. Introduce, just above the chart's container:

  ```tsx
  const chartSeries = buildChartSeries(
      analytics.viewsByDay,
      analyticsPeriod as 7 | 30 | 90
  )
  const chartMaxViews = maxViewsOf(chartSeries)
  ```

  Then map over `chartSeries`, with the bar height becoming:

  ```tsx
  height: (point.views / chartMaxViews) * 100
  ```

  and the x-axis title gaining the range qualifier:

  ```tsx
  <span className='text-xs text-text/50'>
      {analyticsPeriod === 90 ? "Views per week" : "Views per day"}
  </span>
  ```

  Delete the old `const maxViews = Math.max(...analytics.viewsByDay.map((d) => d.views), 1)` that sat *inside* the map callback.

- [x] **GREEN: Verify the test passes**

  Run: `bun test --isolate components/owner/__tests__/analytics-tab.test.tsx`
  Expected: PASS — 3 tests, 0 failures.

- [x] **MUTATION CHECK (mandatory)**

  Temporarily delete the `buildChartSeries` import and call, run the test, confirm 2 failures, then restore and confirm the diff is limited to the chart block.

- [x] **REFACTOR: Clean up**
  - `analyticsPeriod` is already a `7 | 30 | 90` union in the component; the `as` cast exists only if it was widened by state. If state widened it, type the state as `AnalyticsPeriod` instead of casting.

- [x] **Commit**

  ```bash
  git add components/owner/CafeManagement.tsx components/owner/__tests__/analytics-tab.test.tsx
  git commit -m "fix(owner): render the selected analytics range, bucketed for 90d (Task 13)"
  ```

---

### Task 14: `exportCafeAnalyticsCSV` server action

**Files:**
- Modify: `app/api/actions/analytics.ts` (append action + local result interface)
- Create: `app/api/actions/__tests__/analytics-export.test.ts`

**Dependencies:** Task 12 (uses the same period union)

**TDD Cycle:**

- [x] **RED: Write the failing test**

  Create `app/api/actions/__tests__/analytics-export.test.ts`:

  ```typescript
  import { describe, it, expect, beforeEach, mock } from "bun:test"

  let mockUser: { id: string } | null = { id: "user-1" }
  let mockOwnerIds: string[] = ["user-1"]
  let mockPageViews: Array<Record<string, unknown>> = []

  mock.module("next/headers", () => ({
      headers: () => Promise.resolve({ get: () => null }),
  }))

  mock.module("@/lib/auth", () => ({
      getCurrentUser: () => Promise.resolve(mockUser),
  }))

  mock.module("@/db", () => ({
      db: {
          select: () => ({
              from: () => ({
                  where: () => ({
                      limit: () => Promise.resolve([{ ownerIds: mockOwnerIds }]),
                      then: (resolve: (rows: unknown[]) => unknown) =>
                          resolve(mockPageViews),
                  }),
              }),
          }),
      },
      eq: () => ({}),
      and: () => ({}),
      gte: () => ({}),
      lte: () => ({}),
  }))

  const { exportCafeAnalyticsCSV } = await import(
      "@/app/api/actions/analytics"
  )

  describe("exportCafeAnalyticsCSV", () => {
      beforeEach(() => {
          mockUser = { id: "user-1" }
          mockOwnerIds = ["user-1"]
          mockPageViews = []
      })

      it("emits a header row even when the cafe has no views", async () => {
          const result = await exportCafeAnalyticsCSV("cafe-1", 7)

          expect(result.success).toBe(true)
          const csv = result.data!.csv
          const lines = csv.trim().split("\n")
          expect(lines[0]).toBe("date,views,unique_visitors")
          expect(lines.length).toBe(8)
      })

      it("emits one row per day, never bucketed, even for 90 days", async () => {
          const result = await exportCafeAnalyticsCSV("cafe-1", 90)

          expect(result.success).toBe(true)
          const lines = result.data!.csv.trim().split("\n")
          expect(lines.length).toBe(91)
      })

      it("rejects a non-owner", async () => {
          mockOwnerIds = ["someone-else"]
          const result = await exportCafeAnalyticsCSV("cafe-1", 30)
          expect(result.success).toBe(false)
          expect(result.error).toContain("Not authorized")
      })

      it("rejects an unauthenticated caller", async () => {
          mockUser = null
          const result = await exportCafeAnalyticsCSV("cafe-1", 30)
          expect(result.success).toBe(false)
      })

      it("rejects a period outside 7/30/90", async () => {
          const result = await exportCafeAnalyticsCSV("cafe-1", 45 as never)
          expect(result.success).toBe(false)
      })

      it("names the file after the cafe and today's date", async () => {
          const result = await exportCafeAnalyticsCSV("cafe-1", 7)
          expect(result.data!.filename).toContain("cafe-1")
          expect(result.data!.filename.endsWith(".csv")).toBe(true)
      })
  })
  ```

- [x] **RED: Verify the test fails**

  Run: `bun test --isolate app/api/actions/__tests__/analytics-export.test.ts`
  Expected: FAIL — `exportCafeAnalyticsCSV` is not exported from the module (undefined is not a function).

- [x] **GREEN: Add the action**

  Append to `app/api/actions/analytics.ts`. `ActionResult` is **not** exported from anywhere reusable (`inventory.ts:52` declares its own), so declare a local interface — matching the existing pattern:

  ```typescript
  interface AnalyticsExportResult<T = unknown> {
      success: boolean
      error?: string
      data?: T
  }

  const EXPORT_PERIODS = [7, 30, 90] as const

  /**
   * Export page analytics as CSV.
   *
   * Rows are always daily for the full period — the chart bucketing in
   * `utils/analytics/series.ts` is presentational. Per-day unique visitors come
   * from a server-side visitor-ID set and cannot be re-aggregated into weeks
   * without re-querying raw views, so the export reports ground truth.
   */
  export async function exportCafeAnalyticsCSV(
      cafeId: string,
      days: 7 | 30 | 90
  ): Promise<AnalyticsExportResult<{ csv: string; filename: string }>> {
      if (!EXPORT_PERIODS.includes(days)) {
          return { success: false, error: "Invalid period" }
      }

      const analytics = await getCafeAnalytics(cafeId, days)
      if (!analytics) {
          return { success: false, error: "Not authorized" }
      }

      const escapeCsv = (value: string | number) => {
          const text = String(value)
          return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
      }

      const rows = analytics.viewsByDay.map((point) =>
          [point.date, point.views, point.uniqueVisitors]
              .map(escapeCsv)
              .join(",")
      )

      const csv = ["date,views,unique_visitors", ...rows].join("\n")
      const today = new Date().toISOString().split("T")[0]

      return {
          success: true,
          data: { csv, filename: `analytics-${cafeId}-${days}d-${today}.csv` },
      }
  }
  ```

  **Authorization note:** `getCafeAnalytics` already returns `null` for a non-owner (it checks `ownerIds.includes(user.id)` at `:43-52`) and for an unauthenticated caller (`:39`). Delegating the gate to it means there is exactly one ownership check to keep correct — do not add a second, divergent one.

- [x] **GREEN: Verify the test passes**

  Run: `bun test --isolate app/api/actions/__tests__/analytics-export.test.ts`
  Expected: PASS — 6 tests, 0 failures.

- [x] **REFACTOR: Clean up**
  - The 8-line / 91-line assertions double as the header-row and no-bucketing proofs. Keep them exact.

- [x] **Commit**

  ```bash
  git add app/api/actions/analytics.ts app/api/actions/__tests__/analytics-export.test.ts
  git commit -m "feat(analytics): add owner-gated CSV export action (Task 14)"
  ```

---

### Task 15: Add the CSV download button

**Files:**
- Modify: `components/owner/CafeManagement.tsx` (analytics tab header)
- Modify/Test: `components/owner/__tests__/analytics-tab.test.tsx` (append)

**Dependencies:** Task 14

**TDD Cycle:**

- [x] **RED: Write the failing test**

  Append to `components/owner/__tests__/analytics-tab.test.tsx`:

  ```tsx
  describe("analytics CSV export button", () => {
      it("offers a Download CSV control", () => {
          expect(source).toContain("Download CSV")
      })

      it("calls the export action", () => {
          expect(source).toContain("exportCafeAnalyticsCSV")
      })

      it("surfaces a failure instead of failing silently", () => {
          expect(source).toContain("Failed to export analytics")
      })
  })
  ```

- [x] **RED: Verify the test fails**

  Run: `bun test --isolate components/owner/__tests__/analytics-tab.test.tsx`
  Expected: FAIL — 3 failing.

- [x] **GREEN: Add the button and handler**

  Add the import:

  ```typescript
  import { exportCafeAnalyticsCSV } from "@/app/api/actions/analytics"
  ```

  Add a handler inside the component, beside the existing analytics loading logic:

  ```tsx
  const handleExportAnalytics = async () => {
      const result = await exportCafeAnalyticsCSV(
          cafe.id,
          analyticsPeriod as 7 | 30 | 90
      )
      if (!result.success || !result.data) {
          setAnalyticsError("Failed to export analytics")
          return
      }
      const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = result.data.filename
      anchor.click()
      URL.revokeObjectURL(url)
  }
  ```

  If `setAnalyticsError` does not exist, reuse whatever error state the analytics tab already sets on a failed `getCafeAnalytics` — do not invent a second error channel.

  Render the button next to the period selector:

  ```tsx
  <button
      onClick={handleExportAnalytics}
      className='flex items-center gap-2 px-3 py-2 bg-text/5 hover:bg-text/10 rounded-lg text-sm font-medium transition-colors'
  >
      <Download className='w-4 h-4' />
      Download CSV
  </button>
  ```

  `Download` is already imported (the review-image "Download PNG" uses it at `:930`); if not, add it to the existing `lucide-react` import.

- [x] **GREEN: Verify the test passes**

  Run: `bun test --isolate components/owner/__tests__/analytics-tab.test.tsx`
  Expected: PASS — 6 tests, 0 failures.

- [x] **REFACTOR: Clean up**
  - `URL.revokeObjectURL` must run after `anchor.click()`; leaking blob URLs pins memory across repeated exports.
  - No `cursor-pointer` (global rule already applies it to buttons).

- [x] **Commit**

  ```bash
  git add components/owner/CafeManagement.tsx components/owner/__tests__/analytics-tab.test.tsx
  git commit -m "feat(owner): add analytics CSV download button (Task 15)"
  ```

---

<!-- PHASE 5 -->
## Phase 5: Discovery & Page Presentation (spec packets P4b + P5)

Six small tasks. Tasks 16–19 make `/for-owners` reachable; tasks 20–21 are two className corrections.

Common constraint for 16–19: every link is a plain `next/link` to the literal path `/for-owners`. The target page is a static Server Component — no link may depend on auth state, and none may turn `/for-owners` dynamic.

### Task 16: Anonymous entry point on the cafe page

**Files:**
- Modify: `components/cafe/CafeHero.tsx` (after the gated claim block, `:521-542`)
- Modify/Test: `components/cafe/__tests__/cafe-hero-owner-claim.test.tsx` (append; this file already renders `CafeHero` with its mocks)

**Dependencies:** None.

**TDD Cycle:**

- [x] **RED: Write the failing test**

  Append to `components/cafe/__tests__/cafe-hero-owner-claim.test.tsx`:

  ```tsx
  describe("CafeHero — anonymous owner entry point", () => {
      it("shows a benefits link to a logged-out visitor on an unclaimed cafe", () => {
          const { container } = render(
              <CafeHero {...baseProps} user={null} cafe={{ ...baseCafe, is_claimed: false }} />
          )
          const link = container.querySelector('a[href="/for-owners"]')
          expect(link).toBeTruthy()
      })

      it("still hides the claim button when logged out", () => {
          const { container } = render(
              <CafeHero {...baseProps} user={null} cafe={{ ...baseCafe, is_claimed: false }} />
          )
          expect(container.textContent).not.toContain("Own this cafe? Claim it")
      })

      it("does not show the benefits link on an already-claimed cafe", () => {
          const { container } = render(
              <CafeHero {...baseProps} user={null} cafe={{ ...baseCafe, is_claimed: true }} />
          )
          expect(container.querySelector('a[href="/for-owners"]')).toBeNull()
      })
  })
  ```

  Reuse whatever fixtures the file already defines for `baseProps` / the cafe object — rename them to match the file's actual variables rather than inventing new ones.

- [x] **RED: Verify the test fails**

  Run: `bun test --isolate components/cafe/__tests__/cafe-hero-owner-claim.test.tsx`
  Expected: FAIL — 2 failing. No `/for-owners` link exists, and a logged-out visitor currently sees nothing at all in that slot.

- [x] **GREEN: Add the anonymous branch**

  After the existing claim-button block, add a sibling branch. The claim block keeps its exact gating (`!cafe.is_claimed && !cafe.owner_ids?.length && user && onOpenClaim`) — do not touch it.

  ```tsx
                      {/* Anonymous visitors get no claim button (the modal needs a
                          session), so route them to the benefits page instead. */}
                      {!cafe.is_claimed && !user && (
                          <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.5, delay: 0.28 }}
                              className='mt-4'
                          >
                              <Link
                                  href='/for-owners'
                                  className='inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg text-sm font-medium hover:bg-white/20 transition-all'
                              >
                                  <Store className='w-4 h-4' aria-hidden='true' />
                                  Own this cafe? See what you get
                              </Link>
                          </motion.div>
                      )}
  ```

  `Link` from `next/link` may need adding to the imports; `Store` is already imported (`:536`).

- [x] **GREEN: Verify the test passes**

  Run: `bun test --isolate components/cafe/__tests__/cafe-hero-owner-claim.test.tsx`
  Expected: PASS — all tests, including the 3 new ones.

- [x] **REFACTOR: Clean up**
  - Both branches are mutually exclusive by construction (`user &&` vs `!user`); no visitor sees two CTAs.

- [x] **Commit**

  ```bash
  git add components/cafe/CafeHero.tsx components/cafe/__tests__/cafe-hero-owner-claim.test.tsx
  git commit -m "feat(cafe): add anonymous owner benefits entry point (Task 16)"
  ```

---

### Task 17: Entry point in the owner dashboard empty state

**Files:**
- Modify: `components/owner/OwnerDashboard.tsx` (`:59-93`)
- Create: `components/owner/__tests__/owner-dashboard-empty-state.test.tsx`

**Dependencies:** Task 16

**TDD Cycle:**

- [x] **RED: Write the failing test**

  Create `components/owner/__tests__/owner-dashboard-empty-state.test.tsx`:

  ```tsx
  import { describe, it, expect } from "bun:test"

  const source = await Bun.file(
      "components/owner/OwnerDashboard.tsx"
  ).text()

  describe("OwnerDashboard empty state", () => {
      it("links to the owner benefits page", () => {
          expect(source).toContain("/for-owners")
      })

      it("keeps the existing submit and browse actions", () => {
          expect(source).toContain("Submit New Cafe")
          expect(source).toContain("Browse Cafes to Claim")
      })
  })
  ```

- [x] **RED: Verify the test fails**

  Run: `bun test --isolate components/owner/__tests__/owner-dashboard-empty-state.test.tsx`
  Expected: FAIL — 1 failing, no `/for-owners` reference.

- [x] **GREEN: Add the link**

  Inside the `cafes.length === 0` branch, after the existing two-button `div` (`:80-92`), add:

  ```tsx
                  <Link
                      href='/for-owners'
                      className='inline-block mt-4 text-sm font-medium text-primary hover:underline'
                  >
                      See everything owner tools include
                  </Link>
  ```

- [x] **GREEN: Verify the test passes**

  Run: `bun test --isolate components/owner/__tests__/owner-dashboard-empty-state.test.tsx`
  Expected: PASS — 2 tests, 0 failures.

- [x] **REFACTOR: Clean up**
  - `Link` is already imported in this file (used for both buttons).

- [x] **Commit**

  ```bash
  git add components/owner/OwnerDashboard.tsx components/owner/__tests__/owner-dashboard-empty-state.test.tsx
  git commit -m "feat(owner): link benefits page from dashboard empty state (Task 17)"
  ```

---

### Task 18: Entry point on the submit page

**Files:**
- Modify: `components/submit/SubmitPage.tsx` (after the intro `<p>`)
- Create: `components/submit/__tests__/SubmitPage.test.tsx`

**Dependencies:** Task 17

**TDD Cycle:**

- [x] **RED: Write the failing test**

  Create `components/submit/__tests__/SubmitPage.test.tsx`:

  ```tsx
  import { describe, it, expect } from "bun:test"

  const source = await Bun.file(
      "components/submit/SubmitPage.tsx"
  ).text()

  describe("SubmitPage", () => {
      it("offers a path for owners whose cafe is already listed", () => {
          expect(source).toContain("/for-owners")
      })

      it("keeps the submission form", () => {
          expect(source).toContain("CafeSubmissionForm")
      })
  })
  ```

- [x] **RED: Verify the test fails**

  Run: `bun test --isolate components/submit/__tests__/SubmitPage.test.tsx`
  Expected: FAIL — 1 failing.

- [x] **GREEN: Add the line**

  After the intro `<p className='text-text/70 mb-8'>…</p>`, before `<CafeSubmissionForm …>`, insert:

  ```tsx
                  <p className='text-text/70 mb-8 -mt-4'>
                      Already own a cafe that is on Grounds?{" "}
                      <Link
                          href='/for-owners'
                          className='font-medium text-primary hover:underline'
                      >
                          Claim it instead
                      </Link>{" "}
                      — it is free and you keep control of the listing.
                  </p>
  ```

  Add `import Link from "next/link"` to the imports. `SubmitPage` is a client component (`"use client"` at `:1`); a `Link` is fine inside it.

- [x] **GREEN: Verify the test passes**

  Run: `bun test --isolate components/submit/__tests__/SubmitPage.test.tsx`
  Expected: PASS — 2 tests, 0 failures.

- [x] **REFACTOR: Clean up**
  - `-mt-4` offsets the intro paragraph's `mb-8` so the two lines read as one block; adjust to taste but keep the spacing tighter than a new section.

- [x] **Commit**

  ```bash
  git add components/submit/SubmitPage.tsx components/submit/__tests__/SubmitPage.test.tsx
  git commit -m "feat(submit): offer claim path for already-listed cafes (Task 18)"
  ```

---

### Task 19: Entry point in the profile owned-cafes section

**Files:**
- Modify: `components/profile/Profile.tsx` ("My Cafes" section, `:986-990`)
- Create: `components/profile/__tests__/profile-owned-cafes.test.tsx`

**Dependencies:** Task 18

**TDD Cycle:**

- [x] **RED: Write the failing test**

  Create `components/profile/__tests__/profile-owned-cafes.test.tsx`:

  ```tsx
  import { describe, it, expect } from "bun:test"

  const source = await Bun.file("components/profile/Profile.tsx").text()

  describe("Profile owned-cafes section", () => {
      it("links to the owner benefits page", () => {
          expect(source).toContain("/for-owners")
      })

      it("keeps the dashboard link", () => {
          expect(source).toContain("Go to Owner Dashboard")
      })
  })
  ```

- [x] **RED: Verify the test fails**

  Run: `bun test --isolate components/profile/__tests__/profile-owned-cafes.test.tsx`
  Expected: FAIL — 1 failing.

- [x] **GREEN: Add the link**

  Directly after the `Go to Owner Dashboard` `Link` (which ends at `:990`), add:

  ```tsx
                              <Link
                                  href='/for-owners'
                                  className='mt-2 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-primary hover:underline'
                              >
                                  What owner tools include
                              </Link>
  ```

- [x] **GREEN: Verify the test passes**

  Run: `bun test --isolate components/profile/__tests__/profile-owned-cafes.test.tsx`
  Expected: PASS — 2 tests, 0 failures.

- [x] **REFACTOR: Clean up**
  - Secondary styling: this link must not compete with the primary dashboard button above it.

- [x] **Commit**

  ```bash
  git add components/profile/Profile.tsx components/profile/__tests__/profile-owned-cafes.test.tsx
  git commit -m "feat(profile): link benefits page from owned-cafes section (Task 19)"
  ```

---

### Task 20: Fade the decorative icons with element opacity

**Files:**
- Modify: `components/owner/OwnerBenefits.tsx` (`:30-31`)
- Create: `components/owner/__tests__/owner-benefits-presentation.test.ts`

**Dependencies:** None. Independent of 16–19.

**TDD Cycle:**

- [x] **RED: Write the failing test**

  Create `components/owner/__tests__/owner-benefits-presentation.test.ts`:

  ```typescript
  import { describe, it, expect } from "bun:test"

  const source = await Bun.file(
      "components/owner/OwnerBenefits.tsx"
  ).text()

  describe("OwnerBenefits decorative icons", () => {
      it("does not fade lucide icons with an alpha colour token", () => {
          expect(source).not.toContain("text-primary/5")
          expect(source).not.toContain("text-accent/5")
      })

      it("fades them with element opacity instead", () => {
          expect(source).toContain("opacity-5")
      })

      it("leaves the semantic chip icons at full opacity", () => {
          expect(source).toContain("bg-primary/10")
      })

      it("leaves the background blur blob on its bg token", () => {
          expect(source).toContain("bg-accent/5")
      })
  })
  ```

- [x] **RED: Verify the test fails**

  Run: `bun test --isolate components/owner/__tests__/owner-benefits-presentation.test.ts`
  Expected: FAIL — 2 failing. Both decorative icons use `text-primary/5` and `text-accent/5`.

- [x] **GREEN: Swap alpha for opacity**

  Change the two decorative icons (`:30-31`) from:

  ```tsx
                      <Coffee className='absolute -top-6 -right-6 w-48 h-48 text-primary/5 rotate-12' />
                      <Store className='absolute -bottom-12 -left-12 w-64 h-64 text-accent/5 -rotate-12' />
  ```

  to:

  ```tsx
                      <Coffee className='absolute -top-6 -right-6 w-48 h-48 text-primary opacity-5 rotate-12' />
                      <Store className='absolute -bottom-12 -left-12 w-64 h-64 text-accent opacity-5 -rotate-12' />
  ```

  Rationale to preserve in review: `text-primary/5` sets the alpha of `currentColor`, softening only the stroke paint. Lucide icons are outlines, so the result is a thin translucent line rather than a uniformly faint mark. `opacity-5` composites the whole rendered element.

  **Do not** change line 32 (`bg-accent/5 ... blur-3xl`) — that is a background blob, and `bg-*/5` is legitimate there.

- [x] **GREEN: Verify the test passes**

  Run: `bun test --isolate components/owner/__tests__/owner-benefits-presentation.test.ts`
  Expected: PASS — 4 tests, 0 failures.

  Then confirm the pre-existing guard still passes:
  `bun test --isolate components/owner/__tests__/owner-benefits-conventions.test.ts`
  Expected: PASS — 9 tests. (It bans `text-secondary`, not `/N` suffixes, so this change is safe.)

- [x] **REFACTOR: Clean up**
  - Semantic icons inside `bg-primary/10` chips keep full opacity — they carry meaning.

- [x] **Commit**

  ```bash
  git add components/owner/OwnerBenefits.tsx components/owner/__tests__/owner-benefits-presentation.test.ts
  git commit -m "style(owner): fade decorative icons with element opacity (Task 20)"
  ```

---

### Task 21: Widen the page container to `max-w-7xl`

**Files:**
- Modify: `components/owner/OwnerBenefits.tsx` (`:35, :70, :116, :200, :292`)
- Modify/Test: `components/owner/__tests__/owner-benefits-presentation.test.ts` (append)

**Dependencies:** Task 20

**TDD Cycle:**

- [x] **RED: Write the failing test**

  Append to `components/owner/__tests__/owner-benefits-presentation.test.ts`:

  ```typescript
  describe("OwnerBenefits layout width", () => {
      it("uses max-w-7xl for every page container", () => {
          const containers = source.match(/max-w-7xl/g) ?? []
          expect(containers.length).toBe(5)
      })

      it("no longer uses max-w-5xl", () => {
          expect(source).not.toContain("max-w-5xl")
      })

      it("keeps the narrow text measures", () => {
          expect(source).toContain("max-w-3xl")
          expect(source).toContain("max-w-2xl")
          expect(source).toContain("max-w-xl")
      })
  })
  ```

- [x] **RED: Verify the test fails**

  Run: `bun test --isolate components/owner/__tests__/owner-benefits-presentation.test.ts`
  Expected: FAIL — 2 failing. There are five `max-w-5xl` and zero `max-w-7xl`.

- [x] **GREEN: Widen all five containers**

  Replace `max-w-5xl` with `max-w-7xl` at all five sites: the hero inner container (`:35`), free pillars (`:70`), benefit groups (`:116`), inclusions (`:200`), and the legal footnote (`:292`). They must move together so the sections stay aligned.

  **Do not touch** `max-w-3xl`, `max-w-2xl`, or `max-w-xl` — those are typographic line-length measures on the headline, lede, and closing paragraph. Widening them produces unreadable lines, not a wider page.

- [x] **GREEN: Verify the test passes**

  Run: `bun test --isolate components/owner/__tests__/owner-benefits-presentation.test.ts`
  Expected: PASS — 7 tests, 0 failures.

  Then the full component suite:
  `bun test --isolate components/owner/__tests__/OwnerBenefits.test.tsx`
  Expected: PASS — 25 tests, unchanged.

- [x] **REFACTOR: Clean up**

  ```bash
  grep -c "max-w-5xl" components/owner/OwnerBenefits.tsx
  ```

  Expected: `0`.

- [x] **Commit**

  ```bash
  git add components/owner/OwnerBenefits.tsx components/owner/__tests__/owner-benefits-presentation.test.ts
  git commit -m "style(owner): widen page container to max-w-7xl (Task 21)"
  ```

---

## Phase 6: E2E Browser Verification (spec §8.2 — one task per packet)

### Prerequisites for every task in this phase

**Start the dev server on plain HTTP, not HTTPS.** `bun dev` runs `next dev --experimental-https` with the self-signed cert in `certificates/`; headless Chromium shows a certificate interstitial for it, and `--ca-cert` fixes only the CLI's own trust, not the browser's.

```bash
cd /Users/adrianbonpin/Documents/Code/personal/groundsph
bunx next dev --port 3210 > /tmp/remediation-e2e.log 2>&1 &
sleep 12
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3210/for-owners
```

Expected: `200`. If `000`, read `/tmp/remediation-e2e.log` and wait longer.

**App URL:** `http://localhost:3210`
**Evidence:** `docs/superpowers/e2e/remediation-sweep.md` plus screenshots in `docs/superpowers/e2e/screenshots/`.
**Stop the server when the phase is done:** `lsof -ti:3210 | xargs kill`

**Authentication reality check:** every flow below touches authenticated surfaces (owner dashboard, cafe editor, analytics). The E2E runner has no session. Do **not** fake a session or weaken an assertion — for authenticated surfaces, verify the **logged-out** behaviour (correct redirect, no data leak) and verify the authenticated UI by component test plus, where a screenshot is required, by documenting that the shot needs a signed-in browser. Record precisely which flows were verified logged-out. A flow that cannot be executed must be reported as NOT VERIFIED, never as PASS.

---

### Task 22: E2E — packet P1 (security) does not break real owner editing

**Files:**
- Create: `docs/superpowers/e2e/remediation-sweep.md`
- Screenshot: `docs/superpowers/e2e/screenshots/remediation-owner-edit.png`

**Dependencies:** Phase 1 complete.

**E2E Cycle:**

- [x] **DEFINE: Write the E2E script**

  Create `docs/superpowers/e2e/remediation-sweep.md` with this flow documented (steps + acceptance criteria), ready to receive results:

  ```markdown
  ## Flow P1 — Security packet: owner edit path still works

  ### Steps
  1. `curl -s -o /dev/null -w "%{http_code}" http://localhost:3210/owner`
  2. Open http://localhost:3210/owner in the browser
  3. Confirm the logged-out redirect to /auth
  4. Open http://localhost:3210/for-owners and confirm 200

  ### Acceptance Criteria
  - [x] GET /owner while logged out returns a redirect to /auth (never 500)
  - [x] The browser lands on the auth page, not an error boundary
  - [x] /for-owners still returns 200 (no collateral damage)
  - [x] No console errors on either page
  ```

- [x] **EXECUTE**

  ```
  curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3210/owner
  agent_browser { args: ["open", "http://localhost:3210/owner"] }
  agent_browser { args: ["get", "url"] }
  agent_browser { args: ["screenshot", "docs/superpowers/e2e/screenshots/remediation-owner-edit.png"] }
  agent_browser { args: ["errors"] }
  ```

  Expected: a `307`/`308` with `/auth` in the redirect URL, the browser lands on `/auth`, and `errors` reports none.

- [x] **VERIFY**
  - Logged-out redirect works — this is the only part of P1 that is browser-verifiable without a session.
  - The allowlist itself (protected keys rejected, allowed keys written) is proven by Task 2's unit tests, not here. Say so explicitly in the doc rather than implying browser coverage.
  - Screenshot file is non-empty: `ls -l docs/superpowers/e2e/screenshots/remediation-owner-edit.png`

- [x] **DOCUMENT** — fill in results with observed values and the exact commands.

- [x] **Commit**

  ```bash
  git add docs/superpowers/e2e/remediation-sweep.md docs/superpowers/e2e/screenshots/remediation-owner-edit.png
  git commit -m "test(e2e): verify security packet leaves owner routes intact (Task 22)"
  ```

---

### Task 23: E2E — packet P2 (owner-facing truth)

**Files:**
- Modify: `docs/superpowers/e2e/remediation-sweep.md` (append Flow P2)
- Screenshot: `docs/superpowers/e2e/screenshots/remediation-cafe-straw.png`

**Dependencies:** Phase 2 complete.

**E2E Cycle:**

- [x] **DEFINE** — append: verify a public cafe page renders the straw amenity on desktop at 1280px, and that no page contains "Remove My Ownership".

- [x] **EXECUTE**

  ```
  agent_browser { args: ["--args", "--window-size=1280,900", "open", "http://localhost:3210/cafes"] }
  agent_browser { args: ["snapshot", "-i"] }
  ```

  Pick any cafe with a `straw_type` set — find one by opening a few cafe pages and grepping the rendered text for a straw label. Then:

  ```
  agent_browser { args: ["eval", "--stdin"], stdin: "(() => ({ url: location.href, hasStraw: /straw/i.test(document.body.innerText), hasDangerZone: /Remove My Ownership/i.test(document.body.innerText) }))()" }
  agent_browser { args: ["screenshot", "docs/superpowers/e2e/screenshots/remediation-cafe-straw.png"] }
  ```

  Expected: `hasStraw: true` on a cafe that has one, `hasDangerZone: false` everywhere.

- [x] **VERIFY** — if no cafe in the dev database has `straw_type` set, record that honestly and mark the straw check NOT VERIFIED, with the unit guard (Task 8) as the evidence instead. Do not select a cafe without straw and call it a pass.

- [x] **DOCUMENT** — record the cafe slug tested and the observed booleans.

- [x] **Commit**

  ```bash
  git add docs/superpowers/e2e/remediation-sweep.md docs/superpowers/e2e/screenshots/remediation-cafe-straw.png
  git commit -m "test(e2e): verify straw parity and removed danger zone (Task 23)"
  ```

---

### Task 24: E2E — packet P3 (dead code)

**Files:**
- Modify: `docs/superpowers/e2e/remediation-sweep.md` (append Flow P3)

**Dependencies:** Phase 3 complete.

**E2E Cycle:**

- [x] **DEFINE** — append: confirm the dead suggestions route returns 404 and that no page links to it.

- [x] **EXECUTE**

  ```
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3210/cafes/example-cafe/suggestions
  ```

  Expected: `404`. Then, on the public site, confirm no anchor points at a suggestions path:

  ```
  agent_browser { args: ["open", "http://localhost:3210/cafes"] }
  agent_browser { args: ["eval", "--stdin"], stdin: "(() => ({ deadSuggestionLinks: Array.from(document.querySelectorAll('a')).map(a => a.getAttribute('href') || '').filter(h => h.includes('/suggestions')).length }))()" }
  ```

  Expected: `deadSuggestionLinks: 0`.

- [x] **VERIFY / DOCUMENT** — record both numbers. This flow has no screenshot requirement; a 404 and a zero count are the evidence.

- [x] **Commit**

  ```bash
  git add docs/superpowers/e2e/remediation-sweep.md
  git commit -m "test(e2e): verify dead suggestions route is unlinked (Task 24)"
  ```

---

### Task 25: E2E — packet P4 (analytics)

**Files:**
- Modify: `docs/superpowers/e2e/remediation-sweep.md` (append Flow P4)
- Screenshot: `docs/superpowers/e2e/screenshots/remediation-analytics.png`

**Dependencies:** Phase 4 complete.

**E2E Cycle:**

- [x] **DEFINE** — append: the analytics tab is behind `/owner`, so this flow verifies the authenticated surface is *reachable* when signed in and *blocked* when not. Chart range and CSV correctness are proven by Tasks 12–14 unit tests.

- [x] **EXECUTE**

  ```
  curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3210/owner/cafes/example-cafe
  agent_browser { args: ["open", "http://localhost:3210/owner/cafes/example-cafe"] }
  agent_browser { args: ["get", "url"] }
  agent_browser { args: ["screenshot", "docs/superpowers/e2e/screenshots/remediation-analytics.png"] }
  ```

  Expected: redirect to `/auth`, no 500.

  **If the runner has a signed-in browser profile available**, additionally: open the cafe's analytics tab, select 90 days, confirm 13 bars render, confirm the label reads "Views per week", click "Download CSV", and confirm a non-empty `.csv` file lands. Record the actual row count.

- [x] **VERIFY / DOCUMENT** — state plainly whether the authenticated half was executed or NOT VERIFIED. If executed, record the bar count and the CSV row count.

- [x] **Commit**

  ```bash
  git add docs/superpowers/e2e/remediation-sweep.md docs/superpowers/e2e/screenshots/
  git commit -m "test(e2e): verify analytics surface gating and chart (Task 25)"
  ```

---

### Task 26: E2E — packet P5 (discovery and presentation)

**Files:**
- Modify: `docs/superpowers/e2e/remediation-sweep.md` (append Flow P5 + Summary)
- Screenshots: `remediation-for-owners-desktop.png`, `remediation-for-owners-mobile.png`

**Dependencies:** Phases 5 and 6 tasks 22–25.

**E2E Cycle:**

- [x] **DEFINE** — append: all four entry points resolve, and `/for-owners` renders correctly at 1280px and 390px after the width and opacity changes.

- [x] **EXECUTE**

  ```
  agent_browser { sessionMode: "fresh", args: ["--args", "--window-size=1280,900", "open", "http://localhost:3210/for-owners"] }
  agent_browser { args: ["eval", "--stdin"], stdin: "(() => { const main = document.querySelector('main'); const container = main ? main.querySelector('div[class*=\"max-w-\"]') : null; return { h1: document.querySelectorAll('h1').length, details: document.querySelectorAll('details').length, containerClass: container ? container.className : null, innerWidth: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }; })()" }
  agent_browser { args: ["screenshot", "docs/superpowers/e2e/screenshots/remediation-for-owners-desktop.png"] }
  ```

  Expected: `h1: 1`, `details: 9`, `containerClass` contains `max-w-7xl`, `scrollWidth <= innerWidth`.

  Then the entry points, each reachable while logged out:

  ```
  agent_browser { args: ["open", "http://localhost:3210/submit"] }
  agent_browser { args: ["eval", "--stdin"], stdin: "(() => ({ submitLink: !!document.querySelector('a[href=\"/for-owners\"]') }))()" }
  agent_browser { args: ["open", "http://localhost:3210/cafes"] }
  agent_browser { args: ["snapshot", "-i"] }
  ```

  Open a cafe page and confirm the anonymous entry link exists on an unclaimed cafe:

  ```
  agent_browser { args: ["eval", "--stdin"], stdin: "(() => ({ anonymousEntry: !!document.querySelector('a[href=\"/for-owners\"]'), claimButton: /Claim it/i.test(document.body.innerText) }))()" }
  ```

  Expected on an unclaimed cafe while logged out: `anonymousEntry: true`, `claimButton: false`.

  Then mobile:

  ```
  agent_browser { sessionMode: "fresh", args: ["open", "http://localhost:3210/for-owners"] }
  agent_browser { args: ["set", "viewport", "390", "844"] }
  agent_browser { args: ["reload"] }
  agent_browser { args: ["eval", "--stdin"], stdin: "(() => ({ innerWidth: window.innerWidth, scrollWidth: document.documentElement.scrollWidth, overflows: document.documentElement.scrollWidth > window.innerWidth }))()" }
  agent_browser { args: ["screenshot", "docs/superpowers/e2e/screenshots/remediation-for-owners-mobile.png"] }
  agent_browser { args: ["close"] }
  ```

  Expected: `overflows: false` at 390px. Note: `--window-size` on the launch command does not reliably resize a managed headless Chromium — the previous phase measured 756px that way. Use `set viewport` as above.

- [x] **VERIFY** — profile and dashboard entry points are behind auth; verify those by unit test (Tasks 17, 19) and mark the browser half NOT VERIFIED for logged-out runners.

- [x] **DOCUMENT** — fill results, then add a `## Summary` table listing each flow as PASS / NOT VERIFIED with one line of evidence.

- [x] **Commit**

  ```bash
  git add docs/superpowers/e2e/remediation-sweep.md docs/superpowers/e2e/screenshots/
  git commit -m "test(e2e): verify entry points and for-owners presentation (Task 26)"
  ```

---

## Completion checklist

- [x] `bun run test` green with `--isolate` (baseline 1 139 pass; expect roughly +40)
- [x] `bun run lint` — 0 errors (78 pre-existing warnings are acceptable; no new ones)
- [x] `bunx tsc --noEmit` clean
- [x] `bun run build` green
- [x] `git diff --name-only prod...HEAD` contains **no** path under `db/schema/` or `drizzle/migrations/`
- [x] The seven verification actions still exist and still have no UI (deferred, not deleted)
- [x] `git diff` on `emails/ClaimApprovedEmail.tsx` touches only the badge/wording lines
- [x] E2E evidence committed under `docs/superpowers/e2e/`
- [x] PR description states this branch fixes a privilege-escalation path, and names it
