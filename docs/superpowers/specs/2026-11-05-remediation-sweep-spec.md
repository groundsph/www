# Architectural Specification: Owner Trust & Dead-Code Remediation Sweep

**Branch:** `fix/remediation-sweep` (cut from `prod` @ `bfc4efd`)
**Date:** 2026-11-05
**Predecessor:** `docs/superpowers/specs/2026-11-05-architectural-spec.md` (the `/for-owners` page, shipped as PR #19)

---

## 1. Executive Summary

This sweep closes the product defects surfaced while building the `/for-owners` page: a privilege-escalation hole in the owner cafe-update funnel, an email that promises a verification badge the system never grants, owner-facing copy that misdescribes where the collectible stamp appears, a dead route linked from a currently-unreachable banner, an owner analytics chart that silently shows 30 days when the user selected 90, and named dead server actions. It also adds the four deferred entry points that make the `/for-owners` page discoverable.

Every item is code or copy. **No database migration is required and none is permitted** — the one item that would have needed schema work (the owner verification workflow) is explicitly deferred.

It also applies two presentation corrections to the `/for-owners` page itself: decorative icons fade by element opacity rather than stroke alpha, and the page container widens from `max-w-5xl` to `max-w-7xl`.

## 2. Constraints & Non-Negotiables

### 2.1 Security

1. **No privilege escalation.** The owner cafe-update path must validate incoming field keys against an explicit runtime allowlist. A TypeScript-only signature is not a boundary: server actions are a public RPC surface.
2. **Ownership is checked server-side, every time.** Any action returning cafe-scoped data must verify the caller owns that cafe before reading. Client-side gating is presentation, not authorization.
3. **No new public endpoints.** All new data operations are server actions under `app/api/actions/`. No route handlers, no public buckets, no signed URLs for exports.
4. **Exports are returned as data, never as hosted URLs.** The CSV is a string in an `ActionResult` payload, matching `exportInventoryToCSV`.

### 2.2 Data integrity

5. **No destructive SQL.** No `DROP`, `TRUNCATE`, or `DELETE` without a `WHERE`. The production database is always live. This sweep must ship with **zero migrations**; if a requirement appears to need one, stop and escalate.
6. The `owner_verification_requests` table and its seven actions remain **untouched** — deferring the feature must not degrade into deleting it.

### 2.3 Correctness

7. **The analytics chart must never display a range other than the one selected.** 7 → 7 points, 30 → 30, 90 → 90 (bucketed, see §4.4). Bar normalisation must be computed over the rendered series only.
8. **Copy must describe shipped behaviour.** No owner-facing string may promise a capability, badge, or display surface that does not exist.

### 2.4 Codebase conventions (inherited, non-negotiable)

9. TypeScript strict; `@/` absolute imports; double-quoted import specifiers.
10. Server actions return `{ success, error?, data? }`. Call `getCurrentUser()` from `@/lib/auth` first; `revalidatePath()` after mutations; wrap DB work in try/catch.
11. Tailwind theme tokens only (`primary`, `secondary`, `tertiary`, `accent`, `background`, `text`). `bg-linear-to-*`, never `bg-gradient-to-*`. `rounded-xl` cards, `rounded-lg` buttons, `rounded-full` pills. **Never `text-secondary` for text.** No `dark:` variants. No `cursor-pointer` (global rule in `app/layout.tsx`). Single-quoted JSX attributes.
12. No new dependencies. No `any` without an adjacent eslint-disable and justification.
13. `/for-owners` stays a static Server Component. Entry-point work adds links *to* it; it must not gain dynamic behaviour.
14. **Decorative icon fading uses element opacity, not stroke opacity.** Fade icons with the `opacity-*` utility, never with an alpha-suffixed colour token (`text-primary/5`). Colour tokens set `currentColor` alpha, which only softens the stroke paint; element opacity composites the whole rendered icon uniformly.
15. **Page containers are `max-w-7xl`.** Text blocks keep their own measure constraints (`max-w-xl`/`2xl`/`3xl`) — those are typographic line-length limits, not the page container, and must not be widened.

## 3. System Boundaries

### 3.1 In scope — five packets

**Packet 1 — Security & data integrity**

| ID | Item | Evidence |
|---|---|---|
| SEC-1 | `updateCafeAsOwner` accepts arbitrary field keys via `fieldMap[key] \|\| key` fallback | `app/api/actions/owner.ts:373-383` |
| SEC-2 | `getMenuItemSuggestionsForCafe` has no ownership check | `app/api/actions/menu-suggestions.ts:68` |
| CACHE-1 | Revalidation targets non-existent paths `/cafe/[slug]` and `/owner/cafe/${id}` | `app/api/actions/owner.ts:1270-1272` |

**Packet 2 — Truth (owner-facing copy)**

| ID | Item | Evidence |
|---|---|---|
| TRUTH-1 | Claim-approved email promises a "verified badge" and addresses the owner as "a verified owner" | `emails/ClaimApprovedEmail.tsx:74,79,86` |
| TRUTH-2 | Stamp copy says "display on your cafe page"; it renders only in Passport | `components/owner/CafeManagement.tsx:633-636`; `components/profile/Passport.tsx:193` |
| TRUTH-3 | Dead "Remove My Ownership" button with no handler; lifecycle is staff-only but undisclosed | `components/owner/CafeManagement.tsx:2267-2273` |
| TRUTH-4 | `straw` amenity renders on mobile but not desktop | `components/cafe/CafeMobileContent.tsx:829`; absent from `components/cafe/CafeDetails.tsx` |

**Packet 3 — Dead code (named items only)**

| ID | Item | Evidence |
|---|---|---|
| DEAD-1 | `issueVoucherToUser` + `issueVoucherToUserSchema`, never called | `app/api/actions/discount.ts:506`; `utils/validation/discount.ts:81` |
| DEAD-2 | `getOwnerCampaigns`, never called | `app/api/actions/discount.ts:1249` |
| DEAD-3 | Unreachable suggestions banner + unused `pendingSuggestionsCount` prop | `components/cafe-editor/MenuSection.tsx:73,81` |

**Packet 4 — Discovery & analytics**

| ID | Item | Evidence |
|---|---|---|
| GAP-1 | 90-day selection renders 30 bars; `maxViews` normalises against hidden bars | `components/owner/CafeManagement.tsx:1864-1874` |
| GAP-2 | No analytics export | `app/api/actions/analytics.ts:35` |
| GAP-3 | No entry point for anonymous visitors on the cafe page | `components/cafe/CafeHero.tsx:521-537` |
| GAP-4 | No entry point in the owner dashboard empty state | `components/owner/OwnerDashboard.tsx:59-93` |
| GAP-5 | No entry point on the submit page | `components/submit/SubmitPage.tsx` (33 lines) |
| GAP-6 | No entry point in the profile owned-cafes section | `components/profile/Profile.tsx:936-990` |

**Packet 5 — `/for-owners` presentation**

| ID | Item | Evidence |
|---|---|---|
| GAP-7 | Decorative hero icons fade via stroke alpha (`text-primary/5`, `text-accent/5`) instead of overall element opacity | `components/owner/OwnerBenefits.tsx:30-31` |
| GAP-8 | Page container is `max-w-5xl`; should be `max-w-7xl` | `components/owner/OwnerBenefits.tsx:35,70,116,200,292` |

### 3.2 Out of scope — explicitly

- **Owner verification workflow UI.** Deferred by decision. Backend, actions, and table stay exactly as they are. See §9.
- **The other 55 orphaned action exports** (~2,000 lines across `admin.ts`, `owner.ts`, `profile.ts`, `user-notifications.ts`, `community.ts`, `map.ts`). Deferred to a separate mechanical cleanup PR.
- **Owner publish / unpublish / delete controls.** Owner lifecycle stays staff-only; this sweep only *discloses* that. No new destructive capability is added.
- **Dropping the `owner_verification_requests` table** or any schema change.
- **Analytics PDF export.** CSV only.
- **decaf / halal amenities** and **inventory SKU / description / supplier fields.** Investigated and confirmed fully wired — no defect. Only the straw parity gap (TRUTH-4) is in scope.
- Redesigning the analytics chart, the cafe page, or the owner dashboard.

### 3.3 Integration surfaces touched

`app/api/actions/owner.ts`, `app/api/actions/menu-suggestions.ts`, `app/api/actions/discount.ts`, `app/api/actions/analytics.ts` (new action), `utils/validation/discount.ts`, `emails/ClaimApprovedEmail.tsx`, `components/owner/CafeManagement.tsx`, `components/owner/OwnerDashboard.tsx`, `components/owner/OwnerBenefits.tsx`, `components/cafe/CafeDetails.tsx`, `components/cafe/CafeHero.tsx`, `components/cafe-editor/MenuSection.tsx`, `components/submit/SubmitPage.tsx`, `components/profile/Profile.tsx`.

Untouched: `proxy.ts`, `app/robots.ts`, `components/chat/ChatWidget.tsx`, `db/schema/`, `drizzle/migrations/`, `app/for-owners/page.tsx`, `components/owner/owner-benefits-content.ts`.

## 4. Component Architecture

### 4.1 SEC-1 — owner field allowlist

A single explicit allowlist governs which keys `updateCafeAsOwner` may write. Requirements:

- **Allowlist, not blocklist.** Enumerated permitted fields only.
- **Unknown keys are rejected, not silently dropped.** The action returns `{ success: false, error }` naming the offending key — silent drops create "I saved it and nothing happened" bug reports.
- **Protected fields are unreachable by construction**, not by exclusion order: `isVerified`, `isClaimed`, `isPublished`, `ownerIds`, `isActive`, `isTest`, `id`, `slug`, `createdAt`.
- Zod may express the shape, but Zod's default `strip` behaviour is **insufficient on its own** — stripping unknown keys silently is the same failure mode as a blocklist. The action must additionally assert that no rejected key was supplied.
- The existing `fieldMap` snake_case→camelCase translation behaviour is preserved for allowed keys, including the `payment_methods` serialisation special case.
- Behaviour for currently-working owner edits must not change.

### 4.2 SEC-2 — suggestion read ownership

- Reuse the existing `checkCafeOwnership(cafeId, userId)` helper (the inventory CSV action already uses it).
- Non-owner authenticated callers receive `{ success: false, error }`. Unauthenticated callers receive the same. Do not distinguish the two responses — that leaks existence information.

### 4.3 TRUTH items

- **TRUTH-1:** remove the "Get a verified badge on your listing" bullet; reword "As a verified owner, you can:" to describe ownership rather than verification; reword the opening sentence so it does not imply the cafe carries a verified badge. Email structure, components, and links stay otherwise byte-identical.
- **TRUTH-2:** reword the editor copy to state the stamp appears in visitors' Passport. Alternative (rendering the stamp on the cafe page) is recorded in §9 as a product question, not implemented here.
- **TRUTH-3:** delete the Danger Zone card containing the dead button; add a short disclosure where lifecycle status is already displayed that only GroundsPH staff can unpublish or remove a listing.
- **TRUTH-4:** render the straw amenity in the desktop amenities block, matching the mobile treatment (including `strawTypeOther` when present). No new amenity fields.

### 4.4 GAP-1 — analytics chart correctness

- **7-day and 30-day selections render one bar per day.**
- **90-day selection renders weekly buckets (13 bars).** 90 daily bars in a `h-40` container with `gap-1` would be sub-pixel and unreadable; weekly aggregation preserves the shape at a legible density.
- `maxViews` is computed **once, outside the map**, over the series actually being rendered.
- Bar heights stay proportional within the rendered series. Y-axis semantics change from "daily max" to "bucket max" for the 90-day view; the label must say so ("per week").
- No change to the data contract from `getCafeAnalytics`. Bucketing is a **chart-only** presentation concern, because bar `views` sum correctly across days. `uniqueVisitors` does **not** sum correctly — a visitor active on three days inside one week would be counted three times — so anything needing true unique counts must stay daily (see §4.5).

### 4.5 GAP-2 — analytics CSV export

- New server action in `app/api/actions/analytics.ts`, modelled exactly on `exportInventoryToCSV` (`inventory.ts:677-700`): `getCurrentUser()` → `checkCafeOwnership` → build CSV → return `ActionResult<{ csv: string; filename: string }>`.
- Period is restricted to the existing `7 | 30 | 90` union. No arbitrary ranges.
- Columns: `date, views, unique_visitors` — exactly the shape `getCafeAnalytics` already returns in `viewsByDay` (`{ date, views, uniqueVisitors }`, `analytics.ts:15-19`). No new query, no derived fields.
- **CSV always emits one row per day for the full period — 7, 30, or 90 rows.** It does **not** follow the chart's weekly bucketing. Per-day `uniqueVisitors` is already computed server-side from a visitor-ID set; aggregating it into weeks would require re-querying raw views to rebuild the union, which is new work for no benefit. The chart buckets for legibility; the CSV reports ground truth.
- **A cafe with zero views must still produce a header row** — an empty file is indistinguishable from a failure.
- Client trigger lives in the existing analytics tab. No new page, no new route.

### 4.6 GAP-3..6 — entry points to `/for-owners`

All four are plain `next/link` links with consistent copy referring to what owners get. Constraints:

- **GAP-3 (CafeHero):** the claim button is gated on `user &&` at `CafeHero.tsx:521-537`. Anonymous visitors must get a link to `/for-owners` in the same slot. **Logged-in behaviour must not change** — the claim button keeps its exact current gating.
- **GAP-4 (OwnerDashboard empty state):** add the link alongside the existing "Submit New Cafe" and "Browse Cafes to Claim" buttons. This is an authenticated surface — the copy should be about *what you get once you claim*, not about whether to claim.
- **GAP-5 (SubmitPage):** the page is a 33-line intro with no existing "already listed?" affordance. Add a short line beneath the intro paragraph for people who are submitting a cafe that already exists.
- **GAP-6 (Profile):** add the link in the owned-cafes section near the existing "Go to Owner Dashboard" link (`Profile.tsx:986-990`), and in the no-owned-cafes case.

No link may appear inside `OwnerBenefits.tsx` itself (it already carries both primary CTAs). No new navbar item — the nav is at four items plus search and auth and a fifth crowds the `md` breakpoint.

### 4.7 GAP-7 / GAP-8 — `/for-owners` presentation

Two purely visual corrections to the page shipped in PR #19.

**GAP-7 — icon fade.** Two decorative background icons in the hero (`OwnerBenefits.tsx:30-31`) currently fade with alpha-suffixed colour tokens:

- `text-primary/5` and `text-accent/5` → keep the colour token, apply `opacity-5`.

Rationale: a `/5` suffix sets the alpha of `currentColor`, which softens only the stroke paint. Lucide renders outline icons, so the visual result is a thin translucent line rather than a uniformly faint mark. Element opacity composites the whole icon. Requirements:

- Applies to **decorative** icons only. Semantic icons inside `bg-primary/10` chips (pillars, benefit cards, claim steps, CTAs) keep full opacity — they carry meaning and must stay legible.
- The `bg-accent/5 ... blur-3xl` blob at line 32 is a background, not an icon — `bg-*/5` is legitimate there and must not be changed.
- No raw hex, no `text-secondary` (the existing guard test enforces both).
- The guard test in `components/owner/__tests__/owner-benefits-conventions.test.ts` must still pass unchanged; if it needs to grow a rule, the rule is "no alpha-suffixed colour token on a lucide element", not a blanket ban on `/N` suffixes.

**GAP-8 — container width.** Five `max-w-5xl` page containers widen to `max-w-7xl` (Tailwind: 64rem → 80rem):

- Line 35 (hero inner container), line 70 (free pillars), line 116 (benefit groups), line 200 (inclusions), line 292 (legal footnote) — every one of these is a page-level container and all move together, so sections stay aligned.
- **Do not touch** `max-w-3xl`, `max-w-2xl`, `max-w-xl`. Those are line-length measures on headings, ledes and the closing paragraph; widening them would produce unreadably long lines, not a wider page.
- The `max-w-3xl` on the hero `<h1>` stays — it is what wraps the headline at a comfortable measure.

Verification requirements for both:

- No horizontal overflow at 390px (`scrollWidth <= innerWidth`).
- Sections remain visually aligned with each other at desktop width.
- Card grids inside the wider container must not stretch text past the measures above.
- The page must remain statically rendered — this changes classNames only.

## 5. Data Flow

### 5.1 Owner cafe update (post-SEC-1)

```
client form submit
  → updateCafeAsOwner(cafeId, updates)          [server action, public RPC surface]
    → getCurrentUser()                           → unauthenticated: reject
    → checkCafeOwnership(cafeId, user.id)        → not owner: reject
    → allowlist validation                       → unknown key: reject with key name
    → fieldMap translation (allowed keys only)
    → db.update(cafes).set(drizzleUpdates)
    → revalidatePath(owner editor, owner list, public cafe page, cafe list)
    → { success: true }
```

The allowlist sits **between ownership check and DB write**. Nothing downstream may broaden it.

### 5.2 Analytics CSV

```
analytics tab → "Download CSV" click
  → exportCafeAnalyticsCSV(cafeId, period)       [server action]
    → getCurrentUser() → checkCafeOwnership()
    → getCafeAnalytics(cafeId, period)           [existing read]
    → serialise viewsByDay as-is (daily, one row per day, full period)
    → { success, data: { csv, filename } }
  → client: Blob + object URL → anchor download → revoke URL
```

State ownership: **server only** for the data; the client holds nothing beyond the download trigger. No caching layer — the existing action is already the single source and is called once per export.

The CSV is serialised from `viewsByDay` **without bucketing**. Chart bucketing (§5.3) is a display decision and must not leak into the export: per-day `uniqueVisitors` cannot be re-aggregated into weeks from the payload, only re-queried, and reporting daily rows is both cheaper and more truthful.

### 5.3 Chart rendering

`getCafeAnalytics` returns `viewsByDay` for the full period. The client derives `renderSeries` (daily for 7/30, weekly for 90) and `maxViews` from `renderSeries`. Chart height is a pure function of `(day.views / maxViews)`. No additional network calls.

### 5.4 Bottlenecks & optimisation targets

- **No new N+1 queries.** GAP-2 reuses the existing analytics read; it must not add a second query for the same data.
- **`maxViews` currently recomputes inside `.map()`** — O(n²) over the series. Moving it outside is both a correctness fix and a trivial perf win.
- **CSV size is bounded by design** (max 90 daily rows or 13 weekly rows). No pagination or streaming needed.
- Entry points are static links — zero runtime cost.

## 6. Security & Error Handling

### 6.1 Authorization model

| Surface | Rule |
|---|---|
| `updateCafeAsOwner` | Authenticated + owner + allowlisted fields only |
| `getMenuItemSuggestionsForCafe` | Authenticated + owner |
| `exportCafeAnalyticsCSV` | Authenticated + owner + period in `{7,30,90}` |
| Owner lifecycle (publish/delete) | Staff only — unchanged, now disclosed |

### 6.2 Input validation

- IDs: existing UUID handling; no change.
- `period`: enum-constrained, never a raw number from the client.
- `updates`: allowlist as described in §4.1.
- CSV: fields containing commas, quotes, or newlines must be escaped. Cafe names and dates reach the CSV; a malformed cell is a data-integrity bug, not cosmetic.

### 6.3 Error philosophy

- **Fail closed.** Every failure path returns `{ success: false, error }` and performs no write.
- **No silent success.** Rejected keys produce a named error; an empty export still produces a header row; a failed export surfaces a message in the UI rather than a no-op.
- **No error detail leakage.** Do not distinguish "cafe does not exist" from "you do not own this cafe".

### 6.4 Logging

Follow the existing `console.error` convention in server actions. SEC-1 rejections should log the offending key name — that is the signal for a probing client or a genuinely broken form. Do not log field values.

## 7. Migration & Rollback

- **Migrations: none.** No schema change, no data change. If implementation discovers a need for one, stop and escalate — the constraint in §2.2 forbids it.
- **Backward compatibility:** every change is either a copy edit, a deletion of unreachable code, a stricter validation of an already-existing action, or an additive UI affordance. No public URL changes, no response-shape changes to retained actions.
- **Rollback:** revert the packet's commits. No data to unwind, no cache to purge beyond what `revalidatePath` already handles.
- **Deployment:** merge to `prod` on Gitea, then **push `prod` to the `github` remote** — Dokploy builds from GitHub, so a Gitea-only merge ships nothing.

## 8. Testing Strategy

### 8.1 Unit / integration — TDD mandatory

Red → Green → Refactor per source file, `bun test --isolate` (module mocks are process-wide). Tests live in `__tests__/` beside source, excluded from `tsconfig.json`. Conventions: `bun:test` + `@testing-library/react`, `expect(...).toBeTruthy()` (**no jest-dom**), `afterEach(cleanup)`, `whileInView` never fires under JSDOM.

Required coverage:

| Area | Must assert |
|---|---|
| SEC-1 | Protected keys rejected; unknown keys rejected with named error; allowed keys still write; `payment_methods` still serialises; non-owner rejected |
| SEC-2 | Owner reads succeed; non-owner and unauthenticated get identical rejection |
| CACHE-1 | Revalidation targets are the real paths (`/cafes/[slug]`, `/owner/cafes/[slug]/edit`) |
| TRUTH-1..4 | Rendered email/text contains no false promise; disclosure copy present; desktop amenities include straw |
| DEAD-1..3 | Deleted symbols are gone from the module's exports; `MenuSection` renders without the banner |
| GAP-1 | 7/30/90 produce 7/30/13 points; `maxViews` equals the rendered-series max, not the hidden max; 90-day label says "per week" |
| GAP-2 | Owner gets CSV with header row; non-owner rejected; **row count is 7/30/90 (daily, never bucketed)**; zero-view cafe still yields a header; commas/quotes/newlines escaped |
| GAP-3..6 | Each entry point renders the correct `href`; CafeHero still hides the claim button when logged out |
| GAP-7 | Decorative hero icons use `opacity-*`, not an alpha colour token; semantic chip icons unchanged; conventions guard still green |
| GAP-8 | All five page containers are `max-w-7xl`; `max-w-3xl`/`2xl`/`xl` measures unchanged |

**Guard-test discipline:** a regression guard that passes on first write proves nothing. Guard-style tests must include a mutation check — introduce the violation, observe the failure, revert, and verify the revert with an empty `git diff`.

### 8.2 E2E Browser Testing — **OPTED-IN** (one task per packet)

Dev server: `bunx next dev --port 3210` (plain HTTP). `bun dev` uses `--experimental-https` with a self-signed cert, which headless Chromium interstitials; `--ca-cert` fixes only the CLI's own trust, not the browser's. Evidence to `docs/superpowers/e2e/`.

| Packet | Flow |
|---|---|
| P1 | Owner edit form saves a legitimate change (regression proof that the allowlist did not break real editing) |
| P2 | Public cafe page renders the straw amenity on desktop; owner cafe editor shows the staff-only lifecycle disclosure and no Danger Zone card |
| P3 | Cafe editor menu section renders with no dead suggestions banner/route link |
| P4 | Analytics 90-day view renders 13 bars and a "per week" label; CSV download yields a non-empty 90-row file; all four `/for-owners` entry points resolve and are visible at 390px |
| P5 | `/for-owners` at 1280px shows the wider container with aligned sections and faint decorative icons; at 390px no horizontal overflow; header/footer links to it still resolve |

Note: the claim-approved email has no browser surface. TRUTH-1 is verified by unit test only (render the template component and assert the badge strings are absent) — do not attempt to E2E an email.

Known-good expectations from the previous phase: `/for-owners` returns **200 with no redirect**; the page has one `<h1>`, 9 `<details>`, 2 JSON-LD blocks.

## 9. Open Questions

Deferred to `/2-planning` or to the user — none block implementation of Packets 1–4.

1. **Should the collectible stamp actually render on the cafe page?** This sweep rewords the copy to match reality (Passport-only). Rendering it on the cafe page is arguably the better product outcome — owners uploaded it as "a mark of authenticity" — but it changes the public cafe payload and layout. Needs a design decision, not a copy fix.
2. **Is 13 weekly buckets the right density for the 90-day chart?** Weekly is the specified decision because it represents the full selected range honestly at a legible width. Confirm during review; if 30 daily bars (labelled as the last 30 days) is preferred for visual consistency with the existing chart, that contradicts the user's period selection and must be relabelled accordingly — it is not a drop-in swap.
3. **Should analytics export also be available as PDF?** CSV only in this sweep.
4. **Should the 55 other orphaned action exports be deleted,** and if so should a CI check prevent new orphans from landing? Deferred to its own PR with per-removal evidence.

## Appendix A — Deferred follow-up work (recorded for the plan)

**A.1 Owner verification workflow — deferred after this sweep.**
Backend is complete and entirely unreachable: `submitVerificationRequest` (`owner.ts:529`), `getVerificationStatus` (`owner.ts:571`), `getPendingVerifications` (`admin.ts:3184`), `getAllVerifications` (`admin.ts:3252`), `approveVerification` (`admin.ts:3323`), `rejectVerification` (`admin.ts:3409`), `sendVerificationEmail` (`admin.ts:3477`), plus the `owner_verification_requests` table (`db/schema/tables.ts:471`) and a `verificationStatusEnum`. There is no owner form and no admin review page anywhere under `app/manage/`.

The eventual work is: an owner-side request form (upload proof, show status) and an admin review queue (approve/reject, send email). Both are additive and require no schema change because the schema already exists. This is the largest unfinished feature in the codebase and should be its own project with its own spec.

**A.2 The other 55 orphaned action exports.** Inventory captured during this phase includes `admin.ts` (`getPendingCafes`, `getPublishedCafes`, `getCafeStory`, `getFlaggedReviews`, `getPaginatedUsers`, `bulkMarkAsChain`), `user-notifications.ts` (all four exports — a fully built notification system with no UI), `profile.ts` (`getPrivacySettings`, `getUserReviews`, `getProfileWithBadges`), `community.ts` (`getFeaturedUsers`), and `map.ts` (`getCafesInBounds`). Two of these are dropped *features*, not dead helpers — notifications in particular has a complete backend and no UI, the same shape as the verification workflow.

## Appendix B — Tickets closed as false during this phase

Recorded so they are not re-opened from the same source notes.

| Original claim | Finding |
|---|---|
| "decaf/halal/straw amenity fields were dropped" | **False.** `hasDecaf`, `strawType`, `strawTypeOther`, `isHalalCertified` exist (`db/schema/tables.ts:135,148-150`, added in migration 0008, never dropped) and are wired end-to-end for set, display, and filter. Only a desktop render parity gap for straw remains (TRUTH-4). |
| "inventory SKU/description/restock supplier fields were dropped" | **False.** Schema and owner UI are in sync: inputs in `InventoryItemModal`/`InventoryRestockModal`, rendered in `InventoryTable`/`InventoryHistoryModal`, `lastRestocked` written server-side on restock. No change needed. |
| "`/cafes/[slug]/suggestions` is a dead route owners can reach" | **Partially false.** The route does not exist and the link exists, but `pendingSuggestionsCount` is never passed by any caller, so the banner is unreachable today. Latent, not live. Fixed by deletion (DEAD-3), not by building a route. |

## Appendix C — Sequencing recommendation

The five packets are independent and each is small enough to review on its own. Recommended order:

1. **P1 Security** — ship first and alone. SEC-1 is a live privilege-escalation path; it should not wait behind copy fixes.
2. **P2 Truth** — pure copy plus one 10-line render fix. Highest trust value per line changed.
3. **P3 Dead code** — deletion only, no behaviour change.
4. **P4 Discovery & analytics** — the only packet with net-new behaviour (CSV export, chart bucketing, four links).
5. **P5 `/for-owners` presentation** — two className-level corrections and nothing else. Independent of P1–P4 and safe to ship at any point; scheduled last only because it carries the least risk.

**Decomposition note for `/2-planning`:** this spec covers roughly 17 work items across 13 files and five packets. It is **not** one atomic change. Either produce five separate plans (recommended — P1 and P2 in particular deserve independent review), or one plan with five sequential phases and a checkpoint after each. Do not interleave packets in a single commit. The two items with genuine design latitude are GAP-1's bucketing and GAP-2's CSV shape; everything else is mechanical. P5 is the one packet a reviewer can approve from a two-file diff alone.
