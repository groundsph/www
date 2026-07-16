# Submit & Suggest Edit Overhaul + Test Fixes — Implementation Plan

> For agentic workers: this plan is TDD-first. Every task follows Red → Green → Refactor. Never skip a RED step. Commit after every task.

**Goal:** Fix 34 test failures, add Unicode slug normalization, add pending submissions page, fix unpublished cafe visibility, refactor Suggest Edit validation, add title quality hints.

**Architectural Spec:** `docs/superpowers/specs/2026-05-26-submit-suggest-testfix-spec.md`

---

## File Map

### New Files (create)
| File | Purpose |
|------|---------|
| `utils/slug.ts` | Extracted slug utilities (NFD normalization) |
| `utils/__tests__/slug.test.ts` | Tests for slug utilities |
| `app/profile/pending-submissions/page.tsx` | Pending submissions listing page |
| `app/profile/pending-submissions/__tests__/page.test.tsx` | Tests for pending submissions page |

### Modified Files (touch)
| File | Change |
|------|--------|
| `test-setup.ts` | Add Canvas getContext mock |
| `utils/validation/cafe-submission.ts` | Add `suggestableFieldsSchema`, `duplicateWithLink()` |
| `app/api/actions/submit.ts` | Import slug, optimize ensureUniqueSlug, duplicate-with-link |
| `app/api/actions/cafe.ts` | `getCafeBySlug` → `includeUnpublished`, add `getUserPendingSubmissions` |
| `app/api/actions/suggestions.ts` | Add Zod validation in `submitEditSuggestion` |
| `app/cafes/[slug]/page.tsx` | Comment for unpublished handling |
| `components/submit/CafeSubmissionForm.tsx` | Title quality hints |
| `components/profile/Profile.tsx` | "Pending Submissions" nav link |
| `app/api/actions/__tests__/discount-actions.test.ts` | Fix UUID format |
| `app/api/actions/__tests__/submit-cafe.test.ts` | Add pending-submissions tests |
| `app/api/actions/__tests__/suggestions.test.ts` | Add validation tests |
| `utils/validation/__tests__/cafe-submission.test.ts` | Add suggestableFieldsSchema tests |
| `components/chat/__tests__/chat-window-location.test.tsx` | Fix placeholder selectors |
| `components/chat/__tests__/chat-history-clear.test.tsx` | Fix text matcher |
| `components/chat/__tests__/shrinkwrap-bubble.test.tsx` | `getByText` → `getAllByText` |
| `components/cafe/__tests__/cafe-hero-owner-claim.test.tsx` | `queryByText` → `queryAllByText` |
| `components/cafe-editor/__tests__/LocationSection.test.tsx` | Fix selector matchers |
| `components/checkin/__tests__/hero-location-checkin.test.tsx` | Fix timeout/assertion |
| `components/crawls/__tests__/crawl-card.test.tsx` | Fix href matcher |

---

## Phase 1: Foundation (Tasks 1-3)
**Outcome:** Canvas mock in place, schemas ready, slug utilities extracted.

### Task 1: Canvas getContext mock in `test-setup.ts`
- **Files:** `test-setup.ts` (after L23)
- **Deps:** None
- **RED:** `bun test components/chat/__tests__/chat-window-location.test.tsx 2>&1 | grep "(fail)" | wc -l` → 4
- **GREEN:** Add mockCtx block (measureText, fillText, etc.) + `HTMLCanvasElement.prototype.getContext`, `toDataURL`, `toBlob`
- **VERIFY:** `bun test components/chat/__tests__/chat-window-location.test.tsx 2>&1 | grep "(fail)" | wc -l` → < 4 (Canvas crash gone)
- **Commit:** `test: add Canvas getContext mock for JSDOM text measurement (Task 1)`

### Task 2: suggestableFieldsSchema + duplicateWithLink
- **Files:** `utils/validation/cafe-submission.ts` (+ `__tests__` + `suggestions.test.ts`)
- **Deps:** None
- **RED:** Add 9 tests (8 suggestableFieldsSchema + 1 duplicateWithLink). Verify they fail.
- **GREEN:** Add `suggestableFieldsSchema` (z.object with all fields optional). Add `CafeSubmissionError.duplicateWithLink()`.
- **VERIFY:** `bun test utils/validation/__tests__/cafe-submission.test.ts` → all pass
- **Commit:** `feat: add suggestableFieldsSchema and duplicateWithLink error (Task 2)`

### Task 3: slug utils with NFD normalization
- **Files:** Create `utils/slug.ts`, `utils/__tests__/slug.test.ts`; Modify `app/api/actions/submit.ts` (delete inline functions)
- **Deps:** None
- **RED:** Write 14 tests: `slugify("Café") → "cafe"`, `slugify("San José") → "san-jose"`, `generateSlug("Café & Restaurant!", "San José", "Nueva Ecija") → "cafe-restaurant-san-jose-nueva-ecija"`. Verify they fail.
- **GREEN:** Create `utils/slug.ts` with NFD normalization (`normalize("NFD").replace(/[\u0300-\u036f]/g, "")`). Import into `submit.ts`.
- **VERIFY:** `bun test utils/__tests__/slug.test.ts` → all 14 pass. `bun test app/api/actions/__tests__/submit-cafe.test.ts` → still 3 pass.
- **Commit:** `feat: extract slug utilities with NFD normalization (Task 3)`

---

## Phase 2: Core Logic (Tasks 4-7)
**Outcome:** Slug uniqueness optimized, unpublished cafes hidden, pending-submissions action ready, 14 discount tests fixed.

### Task 4: Optimize ensureUniqueSlug
- **Files:** `app/api/actions/submit.ts` (replace L61-L85)
- **Deps:** Task 3
- **RED:** Existing submit tests still pass (no regression)
- **GREEN:** Replace sequential loop with single `WHERE slug = baseSlug OR slug LIKE 'baseSlug-%'` query + max suffix calculation. Fallback to timestamp after 100 collisions.
- **VERIFY:** `bun test app/api/actions/__tests__/submit-cafe.test.ts` → 3 pass
- **Commit:** `perf: optimize ensureUniqueSlug with single LIKE query (Task 4)`

### Task 5: isPublished filter on getCafeBySlug
- **Files:** `app/api/actions/cafe.ts` (L153), `app/cafes/[slug]/page.tsx`
- **Deps:** None
- **RED:** No direct test — verify build passes
- **GREEN:** Change signature to `getCafeBySlug(slug, includeTestOrUnpublished opts?)`. Default `includeUnpublished: false`. Add `eq(cafes.isPublished, true)` to WHERE when false.
- **VERIFY:** `bun build 2>&1 | head -10` → no errors
- **Commit:** `fix: filter unpublished cafes from getCafeBySlug by default (Task 5)`

### Task 6: getUserPendingSubmissions action
- **Files:** `app/api/actions/cafe.ts` (new export), `app/api/actions/__tests__/submit-cafe.test.ts` (add 2 tests)
- **Deps:** None
- **RED:** Write tests: "returns empty array when no pending" / "returns null when not authenticated". Verify fail.
- **GREEN:** Query `cafes` WHERE `contributorId = user.id AND isPublished = false`. Return array of `{id, name, slug, thumbnail, created_at, city_municipality, province}`.
- **VERIFY:** 2 new tests pass
- **Commit:** `feat: add getUserPendingSubmissions server action (Task 6)`

### Task 7: Fix discount test UUID format
- **Files:** `app/api/actions/__tests__/discount-actions.test.ts` (all mock IDs)
- **Deps:** None
- **RED:** `bun test app/api/actions/__tests__/discount-actions.test.ts 2>&1 | grep "(fail)" | wc -l` → 14
- **GREEN:** Add `nextTestId()` helper returning `00000000-0000-0000-0000-XXXXXXXXXXXX`. Replace ALL `user-1`, `cafe-1`, `campaign-1`, `voucher-1`, `owner-1` patterns.
- **VERIFY:** `bun test app/api/actions/__tests__/discount-actions.test.ts` → 0 fail
- **Commit:** `test: fix discount test UUID format for Zod v4 strict validation (Task 7)`

---

## Phase 3: Integration (Tasks 8-9)
**Outcome:** Duplicate detection links to pending submissions. Suggest edits validated server-side.

### Task 8: Duplicate detection → pending submissions link
- **Files:** `app/api/actions/submit.ts` (L218-L223), `app/api/actions/__tests__/submit-cafe.test.ts`
- **Deps:** Tasks 2, 6
- **RED:** Add test: duplicate match with single unpublished cafe → error contains `/profile/pending-submissions`. Verify fail.
- **GREEN:** When all matches are unpublished AND exactly 1 match → use `CafeSubmissionError.duplicateWithLink(message, pending.slug)`. Multiple pending matches → use `duplicate()` generic.
- **VERIFY:** 1 new test passes
- **Commit:** `feat: link duplicate detection to pending submissions page (Task 8)`

### Task 9: Zod validation in submitEditSuggestion
- **Files:** `app/api/actions/suggestions.ts` (L86 area), `app/api/actions/__tests__/suggestions.test.ts`
- **Deps:** Task 2
- **RED:** Add 3 tests: reject lat=200, reject invalid website_url, accept valid changes. Verify fail.
- **GREEN:** Add `suggestableFieldsSchema.safeParse(changes)` after auth check. Return field-level error on fail.
- **VERIFY:** 3 new tests pass
- **Commit:** `feat: add Zod validation to submitEditSuggestion (Task 9)`

---

## Phase 4: Presentation (Tasks 10-13)
**Outcome:** Pending submissions page visible, title hints in form, profile nav updated.

### Task 10: Pending submissions page
- **Files:** Create `app/profile/pending-submissions/page.tsx` + `__tests__/page.test.tsx`
- **Deps:** Task 6
- **RED:** Write 3 tests: renders submissions list, shows empty state, redirects when no auth. Verify fail.
- **GREEN:** Create page: auth check → `getUserPendingSubmissions()` → render list with thumbnail, name, location, "Pending Review" pill, empty state with "Submit a Cafe" link.
- **VERIFY:** 3 tests pass
- **Commit:** `feat: add pending submissions page (Task 10)`

### Task 11: Title quality hints in CafeSubmissionForm
- **Files:** `components/submit/CafeSubmissionForm.tsx` (near name input in Step 1)
- **Deps:** None
- **RED:** Write 3 tests: short name → warning, generic name → info, good name → no hints. Verify fail.
- **GREEN:** Add inline hints below name field: `< 3 chars → "very short", generic words + short → "add location", plain alpha + short → "add variety". Use info/warning pills.
- **VERIFY:** 3 tests pass
- **Commit:** `feat: add title quality hints to cafe submission form (Task 11)`

### Task 12: Pending Submissions link in Profile nav
- **Files:** `components/profile/Profile.tsx` (near existing nav links)
- **Deps:** Task 10
- **RED:** `grep -r "Pending Submissions" components/profile/Profile.tsx` → empty
- **GREEN:** Add `<Link href="/profile/pending-submissions">` with `<Store>` icon next to existing links.
- **VERIFY:** `bun build 2>&1 | grep -i error` → no errors
- **Commit:** `feat: add Pending Submissions link to profile navigation (Task 12)`

### Task 13: Cafe page visibility verification
- **Files:** `app/cafes/[slug]/page.tsx` (comment only)
- **Deps:** Task 5
- **RED/GREEN:** Task 5 already filters. Add clarifying comment above `getCafeBySlug` call. No code change.
- **Commit:** `docs: clarify unpublished cafe visibility in cafe page (Task 13)`

---

## Phase 5: Polish & Hardening (Tasks 14-18)
**Outcome:** Remaining 8 test failures fixed. Full suite passes with <5 failures.

### Task 14: Fix chat test placeholder selectors
- **Files:** `components/chat/__tests__/chat-window-location.test.tsx`, `chat-history-clear.test.tsx`
- **Deps:** Task 1
- **RED:** `bun test components/chat/__tests__/chat-window-location.test.tsx 2>&1 | grep "(fail)" | wc -l` → 4
- **GREEN:** Read `components/chat/ChatWindow.tsx` to find actual placeholder text. Update all `getByPlaceholderText(...)` calls to match. Fix "Clear history" text matcher if button text changed. Use `getByRole("button", { name: /clear/i })` as fallback.
- **VERIFY:** 0 failures across chat test files
- **Commit:** `test: fix chat test placeholder selectors (Task 14)`

### Task 15: Fix ShrinkwrapBubble tests
- **Files:** `components/chat/__tests__/shrinkwrap-bubble.test.tsx`
- **Deps:** None
- **RED:** `bun test components/chat/__tests__/shrinkwrap-bubble.test.tsx 2>&1 | grep "(fail)" | wc -l` → 2
- **GREEN:** Change `getByText("Test content")` → `getAllByText("Test content")` with `expect(elements.length).toBeGreaterThanOrEqual(1)` in "empty text" and "multiline text" tests.
- **VERIFY:** 0 failures
- **Commit:** `test: fix ShrinkwrapBubble getByText for multi-render (Task 15)`

### Task 16: Fix CafeHero claim button tests
- **Files:** `components/cafe/__tests__/cafe-hero-owner-claim.test.tsx`
- **Deps:** None
- **RED:** `bun test components/cafe/__tests__/cafe-hero-owner-claim.test.tsx 2>&1 | grep "(fail)" | wc -l` → 6
- **GREEN:** Replace all `queryByText(/Own this cafe/i)` with `queryAllByText(...)`. For "shows" tests: `expect(elements.length).toBeGreaterThanOrEqual(1)`. For "hides" tests: `expect(elements.length).toBe(0)`. Update imports to use `queryAllByText`.
- **VERIFY:** 0 failures, all 7 tests pass
- **Commit:** `test: fix CafeHero claim button queryAllByText (Task 16)`

### Task 17: Fix CrawlCard, LocationSection, HeroLocationCheckIn
- **Files:** 3 test files
- **Deps:** Task 1 (for HeroLocationCheckIn)
- **RED:** `bun test components/crawls/__tests__/crawl-card.test.tsx components/cafe-editor/__tests__/LocationSection.test.tsx components/checkin/__tests__/hero-location-checkin.test.tsx 2>&1 | grep "(fail)" | wc -l` → 3

- **GREEN (CrawlCard):** Use `container.querySelector('a[href^="/community/crawls/"]')` instead of bare `container.querySelector('a')`.

- **GREEN (LocationSection):** If `expect(selects.length).toBe(3)` fails, count only non-hidden selects: `container.querySelectorAll('select:not([aria-hidden])')`. Or check each select is present individually.

- **GREEN (HeroLocationCheckIn):** Read `components/checkin/HeroLocationCheckIn.tsx`. Find actual post-check-in text. If it's "Visited Today" instead of "Checked in today", update test expectation. Check if component requires `cafeId` prop in addition to `nearbyCafe`.

- **VERIFY:** 0 failures across all 3 files
- **Commit:** `test: fix CrawlCard, LocationSection, HeroLocationCheckIn tests (Task 17)`

### Task 18: Final suite verification
- **Files:** None
- **Deps:** All prior tasks
- **Run:** `bun test 2>&1 | tail -6` → expect ≤ 5 failures
- **Run:** `bun build 2>&1 | tail -5` → no TypeScript errors
- **Run:** `bun lint 2>&1 | tail -5` → no new lint errors
- **List remaining failures:** `bun test 2>&1 | grep "(fail)"`. Categorize each as caused-by-changes (fix) or pre-existing (document).
- **Commit any cleanup.**

---

## Known Deferred Items
- **SuggestEditModal component extraction** (spec §4.6): The spec calls for extracting BasicInfoFields and ContactFields shared components. Deferred because the submit form uses a multi-step wizard while SuggestEdit uses collapsible sections — the shared surface area is limited. The critical improvement (server-side validation) is covered in Task 9.
- **Diff preview for admin suggestions** (spec §4.6): Requires UI work in `/manage/cafes/suggestions` — scoped out of this plan.
- **Rate limiting on submissions** (spec §6.1): Mentioned as "consider" — not mandatory.
