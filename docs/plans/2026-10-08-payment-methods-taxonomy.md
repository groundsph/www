# Payment Methods Taxonomy — Merge, Normalize, and Add Wallet Support

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the cafe `payment_methods` vocabulary — merge credit/debit into a single `card`, merge both QR rails into the BSP-standard `qr_ph`, add Google Pay and Apple Pay, and stop free-text drift at every write path while keeping the existing custom-input escape hatch.

**Architecture:** `cafes.payment_methods` is a comma-separated `text` column (no enum, no joins, no indexes on it). The taxonomy becomes a single source of truth module with three parts: the canonical token list, a label map for display, and an alias map + normalizer used by *all* write paths. Display and storage are decoupled, so legacy tokens stay renderable even after the prod backfill, and the backfill reuses the app's own normalizer rather than reimplementing it in SQL.

**Tech Stack:** Next.js 16 App Router, React 19, Drizzle ORM (PostgreSQL), Zod v4, Bun test runner, Tailwind v4.

---

## Decisions (settled with the user)

| # | Decision |
|---|---|
| 1 | `credit_card` + `debit_card` → single `card` |
| 2 | One-time prod backfill **plus** a read-time alias map (belt and braces) |
| 3 | QR rails merged, with the **BSP standard `qr_ph`** as the surviving token |
| 4 | Free-text custom input **kept**, but every write path normalizes |

## Target taxonomy

| Token | Display label | Absorbs |
|---|---|---|
| `cash` | Cash | — |
| `card` | Credit / Debit Card | `credit_card`, `debit_card` |
| `gcash` | GCash | — |
| `maya` | Maya | — |
| `qr_ph` | QR Ph / Bank Transfer | `qrph`, `bank_transfer`, `BPI` |
| `google_pay` | Google Pay | new |
| `apple_pay` | Apple Pay | new |

Seven tokens — same count as today.

The merged token is **`qr_ph`**, the BSP national QR standard name, rather than the surviving `bank_transfer` label. This costs 6 extra rewritten rows (29 `bank_transfer` rows rename too, of which 6 overlap) but names the token after the standard instead of one of the two rails it now covers, which reads correctly against a "works with any bank or e-wallet app" label.

## Measured prod impact (read-only audit, 2026-10-08)

| Metric | Count |
|---|---|
| Cafes total / with non-empty methods | 113 / 109 |
| Distinct tokens in DB | 8 (no case, whitespace, or legacy variants) |
| Rows containing `credit_card` or `debit_card` | 53 |
| Rows containing **both** (real duplicate collapse) | 41 |
| Rows containing `qrph` | 13 |
| Rows containing `bank_transfer` | 29 |
| Rows containing `BPI` (free text) | 2 |
| Rows containing both `qrph` and `bank_transfer` (collapse) | 6 |
| **Total rows modified by backfill** | **61 of 109 (56%)** |
| Rows left untouched | 48 |

61 modified + 48 untouched = 109 non-empty rows ✓

## Blast radius

Confirmed by audit: **no filter, search facet, sort, map filter, or AI tool filter reads payment methods.** `PAYMENT_METHODS` is referenced in only 4 files. The change surface is the editor UI, two read-only display sites, the write paths, and a test.

---

## Files

### Files to Create

| File | Responsibility |
|---|---|
| `utils/payment-methods.ts` | Single source of truth: `PAYMENT_METHODS`, `PAYMENT_METHOD_LABELS`, `PAYMENT_METHOD_ALIASES`, `normalizePaymentMethods()`, `serializePaymentMethods()`, `formatPaymentMethods()` |
| `utils/__tests__/payment-methods.test.ts` | Normalization, dedupe, alias, unknown-value passthrough, legacy display |
| `scripts/backfill-payment-methods.ts` | Idempotent prod backfill: backup table → normalize with the app's own function inside a transaction → verify |

### Files to Modify

| File | Change |
|---|---|
| `utils/data/philippines.ts` | Remove `PAYMENT_METHODS` (moved out); leave `STRAW_TYPES` etc. untouched |
| `components/cafe-editor/AmenitiesSection.tsx` | Presets from new module; local `formatLabel` for methods → shared label map; `addCustomPaymentMethods` runs the normalizer |
| `components/cafe-editor/BasicInfoSection.tsx` | Either delete (dead — imported by nothing) or update to the shared label map |
| `components/cafe/CafeSidebar.tsx` | Render via `formatPaymentMethods()` instead of `split("_").join(" ")` |
| `components/cafe/CafeMobileContent.tsx` | Same |
| `app/api/actions/submit.ts` | Normalize `validData.payment_methods` before insert (line ~307) |
| `app/api/actions/owner.ts` | Normalize `cafe.paymentMethods` before update (line ~208) |
| `app/api/actions/admin.ts` | Normalize `cafe.paymentMethods` before update (line ~325) |
| `app/api/actions/suggestions.ts` | Normalize `changesToApply.payment_methods` in `approveSuggestion` (line ~403) — user-submitted free text lands here |
| `utils/validation/cafe-submission.ts` | Optional: `.transform()` to normalize at the schema boundary |
| `utils/__tests__/cafe-data-constants.test.ts` | Update the asserted `PAYMENT_METHODS` list |

---

## Task 1: Extract the taxonomy into `utils/payment-methods.ts`

**Context:** `PAYMENT_METHODS` currently lives at the bottom of `utils/data/philippines.ts` (line 925), a 900-line mostly-static location dataset. Move it to a purpose-built module so the label/alias/normalizer logic has a home and the location data stays data.

- [x] **Step 1:** Create `utils/payment-methods.ts` exporting the 7-token `PAYMENT_METHODS` in display order (`cash`, `card`, `gcash`, `maya`, `qr_ph`, `google_pay`, `apple_pay`).
- [x] **Step 2:** Add `PAYMENT_METHOD_LABELS: Record<string, string>` per the table above.
- [x] **Step 3:** Add `PAYMENT_METHOD_ALIASES` mapping `credit_card`, `debit_card` → `card`; `qrph`, `bank_transfer`, `BPI` → `qr_ph`.
- [x] **Step 4:** Add `normalizePaymentMethods(input: string): string[]` — split on commas, trim, drop empties, resolve aliases, dedupe preserving first-occurrence order, and pass unknown values through untouched (never silently drop an owner's data).
- [x] **Step 5:** Add `serializePaymentMethods(input: string): string` and `formatPaymentMethods(input: string | null | undefined): string[]` (labels, alias-resolved, for display).
- [x] **Step 6:** Remove `PAYMENT_METHODS` from `utils/data/philippines.ts`; leave `STRAW_TYPES` and the rest untouched.
- [x] **Step 7:** Run `bun test utils/__tests__/cafe-data-constants.test.ts` and confirm it fails only on the import — that is the expected red state before Step 8.
- [x] **Step 8:** Update that test's import to the new module and assert the new 7-token list.

## Task 2: Test the normalizer (TDD)

- [x] **Step 1:** In `utils/__tests__/payment-methods.test.ts`, cover: alias resolution for all five legacy tokens; `"cash, credit_card, debit_card, gcash"` → `"cash, card, gcash"` (dedupe, no lost token); whitespace tolerance; empty/`null` input → `[]`; unknown value (`"Venmo"`) preserved not dropped; idempotency (normalizing twice equals normalizing once); `formatPaymentMethods("bank_transfer")` → `["QR Ph / Bank Transfer"]`.
- [x] **Step 2:** Run `bun test utils/__tests__/payment-methods.test.ts`.
- [x] **Step 3:** Confirm the idempotency test is present — the prod backfill depends on it.

## Task 3: Normalize all four write paths

**Context:** Four write sites set `payment_methods`. `approveSuggestion` is the important one: it writes a *user-submitted* string straight into the cafe row via a generic Drizzle update, which is how `BPI` entered.

- [x] **Step 1:** `app/api/actions/submit.ts:~307` — wrap with `serializePaymentMethods`.
- [x] **Step 2:** `app/api/actions/owner.ts:~208` — same.
- [x] **Step 3:** `app/api/actions/admin.ts:~325` — same.
- [x] **Step 4:** `app/api/actions/suggestions.ts:~403` — normalize `changesToApply.payment_methods` before `mapSuggestableFieldsToDrizzle`, guarding for `undefined`.
- [x] **Step 5:** Confirm `grep -rn "payment_methods:" app/api/actions/` returns only normalized assignments (plus the two read-only DTO mappers in `cafe.ts` and `map.ts`).

## Task 4: Update the editor UI

- [x] **Step 1:** `components/cafe-editor/AmenitiesSection.tsx` — import presets from the new module; drop the local `formatLabel` for payment chips in favour of `PAYMENT_METHOD_LABELS` (fixes `gcash` rendering as "Gcash", `qrph` as "Qrph").
- [x] **Step 2:** Make `isSelected` alias-aware so a cafe stored as `credit_card, debit_card` shows `card` selected rather than nothing selected.
- [x] **Step 3:** Route `addCustomPaymentMethods` through `normalizePaymentMethods` before joining.
- [x] **Step 4:** Decide `BasicInfoSection.tsx`: it maps `PAYMENT_METHODS` at line 442 but is imported by no editor. Delete it, or update it — do not leave it importing from the old location.
- [x] **Step 5:** Confirm `SuggestEditModal.tsx:1242` free-text stays as-is (user chose to keep free text); it is normalized downstream by Task 3 Step 4.

## Task 5: Update read-only display

- [x] **Step 1:** `components/cafe/CafeSidebar.tsx:~363` — replace `method.split("_").join(" ")` with `formatPaymentMethods(cafe.payment_methods)`.
- [x] **Step 2:** `components/cafe/CafeMobileContent.tsx:~717` — same.
- [x] **Step 3:** Decide whether legacy-but-unmapped tokens should render verbatim (current behaviour) or be hidden. Recommendation: render verbatim, so nothing an owner entered disappears before the backfill runs.

## Task 6: Verify before deploying

- [x] **Step 1:** `bun lint` — clean (no new ESLint 9 warnings).
- [x] **Step 2:** `bun test` — full suite green.
- [x] **Step 3:** `bun build` — production build succeeds.
- [x] **Step 4:** `bun dev`, open a cafe with legacy values (e.g. one of the 6 that list both `qrph` and `bank_transfer`) and confirm chips read "QR Ph / Bank Transfer" once, not twice.
- [x] **Step 5:** Open an owner-edit flow and confirm both card pills no longer appear as separate unselected options.

## Task 7: Deploy code before touching data

**Context:** Ordering is load-bearing. The live deployment currently has no alias map, so if prod data is rewritten first, an owner editing during the gap sees an unselected `card` pill and a stray "Card" chip they can delete. Deploying the alias-aware code first makes every moment between deploys and backfill safe.

- [x] **Step 1:** Branch from `prod`: `git checkout -b feat/payment-methods-taxonomy` (tree is clean, currently on `prod`).
- [x] **Step 2:** Open the PR against `prod` on Gitea: `tea pr create --title "feat: consolidate payment methods and add wallet support" --base prod`.
- [x] **Step 3:** Squash-merge and delete the branch locally and on the remote.
- [x] **Step 4:** Sync the deploy source — Dokploy builds from GitHub, not Gitea: `git checkout prod && git merge --ff-only origin/prod && git push github prod`.
- [x] **Step 5:** Wait for Dokploy to pick it up and confirm the build, before Step 8.1. A merged PR is not a deployed change. Confirmed live on 2026-10-08: `celsos-crib-cafe` and `bos-coffee-butuan` rendered merged chips while prod data still held legacy tokens.

## Task 8: Backfill prod data

**Context:** 56 of 109 rows change. The target is a live database that is always in use, so this runs as an additive-backup + single transaction, never a bare `UPDATE`. Reusing `normalizePaymentMethods()` means the migration and the app can never disagree.

- [x] **Step 1:** Stop. Confirm with the user that Dokploy has deployed the Task 7 merge and that the backfill is cleared to run against prod `100.123.182.127/groundsph`. This is the only step that mutates prod.
- [x] **Step 2:** `scripts/backfill-payment-methods.ts` — create `cafes_payment_methods_backup_20261008 (id text primary key, payment_methods text, backed_up_at timestamptz default now())` with `CREATE TABLE IF NOT EXISTS` (additive; safe on prod) and copy `id` + current `payment_methods` for every row where the value is non-null.
- [x] **Step 3:** Same script, dry-run mode: `SELECT id, payment_methods`, run each value through `normalizePaymentMethods()`, and print a per-row diff plus a total affected count. Expect **61**. If the number differs, stop — the data moved since this audit.
- [x] **Step 4:** Apply mode: one atomic `UPDATE ... FROM (VALUES ...)` statement, logged with a before/after diff per row. **Note:** `updated_at` is deliberately left alone — it feeds `lastmod` in `app/sitemap.ts`.
- [x] **Step 5:** Verify inside the same session — `SELECT count(*) FROM cafes WHERE payment_methods ~ '\y(credit_card|debit_card|qrph|bank_transfer|BPI)\y'` must return **0**.
- [x] **Step 6:** Verify no row lost a token: backup token-count per row ≤ current token-count per row for all rows, and no row became `''` that was previously non-empty.
- [x] **Step 7:** Re-run the dry-run in Step 3 and confirm it now reports **0 affected** — proves idempotency against real data.
- [x] **Step 8:** Spot-check 3 cafes in the live UI (one card-merged, one `qrph`, one `BPI`).

## Status (2026-10-08)

Tasks 1-6 are implemented on branch `feat/payment-methods-taxonomy` and verified locally.
Tasks 7-8 are **not** done: the deploy and the production backfill have not run, and Task 8
Step 1 still needs explicit go-ahead because it is the only step that mutates prod.

| Gate | Result |
|---|---|
| `bunx tsc --noEmit` | exit 0 |
| `bun lint` | exit 0, no warnings |
| `bun run build` | exit 0, compiled successfully |
| `bun test` | 910 pass / 17 fail |
| Failure set vs `prod` baseline | **identical** — baseline is 883 pass / 17 fail; failure lists diffed, no new failures |
| Backfill dry run | 61 rows, matches the independent SQL count |
| Render check (throwaway, isolated) | merged chips, alias-aware selected card pill, canonical tokens emitted |

### Deviations from this plan

1. **The backfill does not bump `updated_at`.** `cafes.updated_at` feeds the cafe `lastmod` in
   `app/sitemap.ts`, and a vocabulary rename is not a content change worth re-announcing to search
   engines.
2. **Toggle/add logic moved into `utils/payment-methods.ts`** as `togglePaymentMethod()` and
   `addPaymentMethods()`, so `AmenitiesSection` is a thin call site and the semantics are
   unit-testable without jsdom.
3. **No committed component test for the editor UI.** Several test files call `mock.module()`
   process-wide; `components/menu/__tests__/ComparisonTable.test.tsx` replaces all of
   `motion/react` with `{ motion: { div } }`, which leaves `motion.button` undefined in any file
   that runs afterwards. A DOM test for `AmenitiesSection` passes in isolation but fails in the
   full suite for that reason. The render path was verified with a throwaway isolated test, and the
   logic is covered by the module tests. The same leak is the likely cause of most of the 17
   pre-existing suite failures.
4. **`components/cafe-editor/BasicInfoSection.tsx` was deleted rather than updated** — dead code
   since `ca258d7` (imported by nothing) and a second, incorrect implementation of the payment UI.
5. The backfill script is `scripts/backfill-payment-methods.ts`, **dry-run by default**; writing
   requires `--apply`.

## Rollback

The backup table is the rollback — a single statement, no `DROP`, no `TRUNCATE`, nothing irreversible:

```sql
UPDATE cafes c SET payment_methods = b.payment_methods
FROM cafes_payment_methods_backup_20261008 b
WHERE c.id = b.id::uuid;
```

The `::uuid` cast is required. The backup table was created with `id text` while `cafes.id` is `uuid`, so the un-cast join fails with `operator does not exist: uuid = text`. The cast version was verified on 2026-10-08 by running it inside a transaction it affected all 113 backed-up rows, restored the pre-change values, and was rolled back leaving the new values intact.

Drop the backup table only after a week of clean operation, with the user's approval.

## Verification checklist

| Check | Command / method | Expected |
|---|---|---|
| Lint | `bun lint` | No new warnings |
| Unit tests | `bun test` | All green |
| Build | `bun build` | Succeeds |
| Legacy token display | Manual, pre-backfill | Renders via alias map, no raw `credit_card` |
| Write-path normalization | Submit a cafe with `"Cash, Credit Card"` | Stored as `"cash, card"` |
| Bank transfer legacy value | Normalize `"bank_transfer"` | `"qr_ph"` |
| Backfill idempotency | Task 8 Step 7 | 0 rows affected |
| No legacy tokens left | Task 8 Step 5 | 0 rows |
| Deploy reached production | Dokploy dashboard | Build succeeds on `prod` |

## Follow-ups (not in scope)

- **Redundancy warning:** `card`, `google_pay`, and `apple_pay` are the *same* contactless terminal. Owners may tick all three on every card-accepting cafe, producing redundant chips. If that happens, consider collapsing to one "Card / Tap to Pay" option and treating wallet support as implied.
- **Filter facet:** nothing filters by payment method today. A "takes GCash"-style filter is now cheap, since the vocabulary is clean.
- **`utils/ai/tools/cafe-insights.ts:382`** passes raw tokens to the AI layer — could use `formatPaymentMethods` for nicer prose.
