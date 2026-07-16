# Architectural Specification: Submit & Suggest Edit Overhaul + Test Error Resolution

## 1. Executive Summary

This spec addresses four interconnected subsystems: (1) fixing 34 test failures across the codebase, (2) auditing and improving the cafe submission flow including slug/category validation and pending-submission management, (3) fixing a critical security bug where unpublished cafes are publicly viewable, and (4) consolidating the Suggest-an-Edit flow with the submit form. The result is a more robust, maintainable, and secure cafe contribution pipeline.

---

## 2. Constraints & Non-Negotiables

### Security
- **Unpublished cafes must never be accessible via public routes.** Any query returning cafe data to unauthenticated or non-admin users MUST filter `isPublished = true`. This is a P0 fix.
- User-submitted data (names, descriptions) must be sanitized before storage.
- Server actions must validate ALL input via Zod schemas — no trust of client-side validation.
- The `isTest` flag must continue to filter test data from all public queries.

### Performance Budgets
- Slug generation: <10ms for the common case (no collision). Uniqueness loop: max 3 DB queries before falling back to timestamp suffix.
- Pending submissions page: <200ms p95 load time for users with <20 pending submissions.
- Test suite: <30s total runtime. Failures must be <5 after fixes.

### Database
- **No destructive SQL.** All schema changes must be additive (new columns, new tables). No DROP, TRUNCATE, or DELETE without WHERE.
- Prod database is always in use. Changes to `cafes` or `cafeEditSuggestions` tables must be backward-compatible.

### Technology
- Must stay within existing stack: Next.js 16 App Router, Drizzle ORM, PostgreSQL, Tailwind v4, motion/react, Zod v4.
- Server actions for mutations; API routes for external-facing endpoints.
- No new major dependencies without justification.

---

## 3. System Boundaries

### IN Scope

| Area | Components |
|------|-----------|
| **Test fixes** | ChatWindow tests, ShrinkwrapBubble, CafeHero, CafeEditor, Discount Actions, HeroLocationCheckIn |
| **Slug generation** | `submit.ts` → `generateSlug()` → Unicode normalization; `ensureUniqueSlug()` → optimization |
| **Cafe visibility** | `getCafeBySlug()` in `cafe.ts` → add `isPublished` filter; cafe page rendering |
| **Submit flow** | CafeSubmissionForm, SubmitPage, `submit.ts` action |
| **Pending submissions** | New server action `getUserPendingCafes()`, new profile sub-page `/profile/pending-submissions` |
| **Resubmit flow** | Update duplicate detection error to link to pending submissions |
| **Suggest an Edit** | Refactor `SuggestEditModal.tsx` (extract shared form components, add server-side validation, add diff preview) |
| **Title suggestion system** | Cafe name validation + suggestion hints in the submit form |

### OUT OF Scope (explicitly)
- Redesigning the entire admin approval workflow
- Implementing AI-powered title generation (suggestions are rule-based hints only)
- Rewriting the chat system or replacing `@chenglou/pretext`
- Database migration for existing unpublished cafes (separate data-fix operation)
- Internationalization (i18n) for the submit form

### Integration Surfaces

| Surface | Direction | Protocol |
|---------|-----------|----------|
| Drizzle ORM → PostgreSQL | Read/write | SQL via `db` instance |
| Cloudflare R2 | Write (image upload) | Presigned URLs |
| Resend | Write (emails) | HTTP via SDK |
| Discord Webhook | Write (notifications) | HTTP POST |
| Better Auth | Auth check | Server-side `getCurrentUser()` |
| Zod Validation | Both | Schema `safeParse()` |

---

## 4. Component Architecture

### 4.1 Test Fix Layer

**No new components.** Changes are surgical patches to existing test files and/or their mocked dependencies.

| Test File | Root Cause | Fix Strategy |
|-----------|-----------|--------------|
| `chat-window-location.test.tsx` | `@chenglou/pretext` Canvas crash | Mock `HTMLCanvasElement.getContext` in `test-setup.ts` OR mock ShrinkwrapBubble for these tests |
| `chat-history-clear.test.tsx` | Missing placeholder element | Update placeholder text matcher to match current component |
| `chat-message-crawl-preview.test.tsx` | Canvas crash | Same Canvas mock fix |
| `shrinkwrap-bubble.test.tsx` | Multiple element matches | Use `getAllByText` instead of `getByText` OR scope queries to container |
| `cafe-hero-owner-claim.test.tsx` | Multiple button instances | Use `getAllByText` + assert exactly 1, or add `data-testid` to claim button |
| `cafe-editor-location.test.tsx` (implied) | Missing selector | Update selector to match current component |
| `hero-location-checkin.test.tsx` | Timeout | Reduce `waitFor` timeout or fix component timing |
| `discount-actions.test.ts` | Zod v4 UUID strictness | Change mock ID format to valid UUIDs (e.g., `"00000000-0000-0000-0000-000000000001"`) |

### 4.2 Slug Generation (Module: `app/api/actions/submit.ts`)

**Current** → **Target**:
```
generateSlug("Café & Restaurant!", "Makati", "Metro Manila")
→ "caf-restaurant-makati-metro-manila"  // Fixed: "caf" → "cafe"
```

Strategy:
1. **Unicode normalization**: Use `String.prototype.normalize('NFD').replace(/[\u0300-\u036f]/g, '')` BEFORE the `[^a-z0-9\s-]` character stripping. This decomposes "é" → "e" + combining accent, then strips the accent.
2. **Preserve transliterations**: After normalization, the existing `[^a-z0-9\s-]` strip works correctly since only ASCII remains.
3. **Collision resolution optimization**: Replace the sequential `ensureUniqueSlug` loop (up to 100 DB queries) with a single `SELECT slug FROM cafes WHERE slug LIKE 'base%'` query, find the max suffix, and increment.

### 4.3 Cafe Visibility Fix (Module: `app/api/actions/cafe.ts`)

**Change**: `getCafeBySlug()` must accept an optional `includeUnpublished` flag (default `false`). When `false`, add `eq(cafes.isPublished, true)` to the WHERE clause.

**Affected callers**:
- `app/cafes/[slug]/page.tsx` → must detect unpublished cafe and either show 404 or (for admins/contributors) show a "pending review" banner.
- Admin's `getPendingCafes()` → already queries `isPublished = false`, unaffected.
- Owner's cafe fetch → queries by `ownerIds`, not slug. Unaffected.

**New behavior**:
| Caller | Unpublished Cafe Access? |
|--------|------------------------|
| Public visitor (no auth) | Denied — 404 |
| Authenticated contributor of that cafe | Preview with "Pending Review" banner |
| Admin/Moderator | Full access with admin controls |
| Cafe owner (by ownerIds) | Full access with management UI |

### 4.4 Pending Submissions Feature (New: `app/profile/pending-submissions/`)

**New server action**: `getUserPendingSubmissions()`
- Queries `cafes` WHERE `contributorId = currentUser.id` AND `isPublished = false`
- Returns summary (id, name, slug, thumbnail, createdAt, status)

**New page**: `app/profile/pending-submissions/page.tsx`
- Route: `/profile/pending-submissions`
- Lists all user's pending cafe submissions with status badge
- Each item: thumbnail, name, submitted date, status pill ("Pending Review")
- Empty state: "No pending submissions yet. [Submit a cafe]"

**Integration points**:
- Add "Pending Submissions" navigation link in profile sidebar/tabs
- In duplicate detection error response (`submit.ts:218-223`), include the pending cafe slug in the error message and redirect URL
- Update `DEFAULT_CAFE_SUBMISSION` error handling to show a link: "View your pending submission"

### 4.5 Title Suggestion System (Inline in `CafeSubmissionForm.tsx`)

**No new component.** Add a `useEffect` in the Basic Info step that checks the name against common patterns:

```typescript
// Rule-based title quality checks
const titleWarnings = useMemo(() => {
  const warnings: string[] = []
  if (name.length < 3) warnings.push("Cafe name is very short")
  if (/cafe|coffee|shop/i.test(name) && name.length < 8)
    warnings.push("Consider adding a location or descriptor (e.g., 'Cafe de Manila')")
  if (/^[a-z\s]+$/i.test(name))
    warnings.push("Consider adding variety — names with symbols or phrases are more memorable")
  return warnings
}, [name])
```

Shown as subtle info/warning pills below the name input field. No AI involved.

### 4.6 Suggest an Edit Refactor

**Component extraction**: Break `SuggestEditModal.tsx` into smaller composable pieces that can be shared with `CafeSubmissionForm.tsx`:

| Extracted Component | Used By |
|-------------------|---------|
| `AmenitiesSection` (already exists in `cafe-editor/`) | Submit form, Suggest Edit, Cafe Editor |
| `HoursSection` (already exists in `cafe-editor/`) | Submit form, Suggest Edit, Cafe Editor |
| `LocationSection` (already exists in `cafe-editor/`) | Submit form, Suggest Edit, Cafe Editor |
| `SocialLinksEditor` (already exists in `submit/`) | Submit form, Suggest Edit |
| `BasicInfoFields` (NEW) | Submit form, Suggest Edit |
| `ContactFields` (NEW) | Submit form, Suggest Edit |

**Server-side validation**: Add Zod schema for `SuggestableFields` in `utils/validation/cafe-submission.ts`:
```typescript
export const suggestableFieldsSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  address_display: z.string().max(500).optional(),
  area: z.string().max(100).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  // ... subset of CafeSubmission fields
})
```

**Diff preview for admins**: In the admin review UI (`/manage/cafes/suggestions`), show a side-by-side or inline diff of what changed vs. current cafe values.

---

## 5. Data Flow

### 5.1 Cafe Submission Flow (Updated)

```
User fills form → Client-side validation (Zod on blur)
  → Upload images to R2 (presigned URL flow)
  → Server action `submitCafe(formData, thumbnailUrl, galleryUrls, menuItems)`
    → getCurrentUser() — auth check
    → cafeSubmissionSchema.safeParse() — Zod validation
    → checkDuplicateCafe() — name+lox check
      → IF DUPLICATE found:
        → IF all existing are unpublished:
          → Return error with link: "View your pending submission → /profile/pending-submissions"
        → ELSE:
          → Return error: "This cafe may already exist: [names]. Suggest an edit instead."
    → generateSlug() with Unicode normalization
    → ensureUniqueSlug() — optimized single-query collision check
    → INSERT into cafes (isPublished = false)
    → INSERT menu items (if any)
    → Fire-and-forget: Discord notify, contribution log
    → Return { success, cafeId, slug }
```

### 5.2 Pending Submissions View

```
GET /profile/pending-submissions
  → getCurrentUser() — auth check (redirect to /auth if not authenticated)
  → getUserPendingSubmissions(userId)
    → SELECT id, name, slug, thumbnail, createdAt FROM cafes
      WHERE contributorId = userId AND isPublished = false
      ORDER BY createdAt DESC
  → Render list with status badges
```

### 5.3 Suggest Edit Flow (Updated)

```
User clicks "Suggest an Edit" modal → Form populated with current cafe values
  → User modifies only desired fields
  → Optional: new images (uploaded to R2)
  → Server action `submitEditSuggestion(cafeId, changes, imageChanges)`
    → getCurrentUser() — auth check
    → suggestableFieldsSchema.safeParse(changes) — validate
    → Verify cafe exists
    → INSERT into cafeEditSuggestions (status = 'pending')
    → Discord notification, contribution log
    → Return { success, suggestionId }
```

### 5.4 Cafe Page View Flow (Security Fix)

```
GET /cafes/[slug]
  → getCafeBySlug(slug, includeUnpublished = false)
    → SELECT ... FROM cafes WHERE slug = ? AND isPublished = true
    → If not found, return null
  → IF null → "Cafe not found" (404)
  → ELSE → Render cafe details
    → (For contributors/admins: check if user is contributor and show "Pending" banner)
```

### State Ownership

| State | Location | Owner |
|-------|----------|-------|
| Submission form data | Client (React state) + localStorage (draft backup) | Browser |
| Images | Cloudflare R2 (permanent), local File state (during upload) | Browser → R2 |
| Cafe records | PostgreSQL `cafes` table | Server |
| Edit suggestions | PostgreSQL `cafeEditSuggestions` table | Server |
| User session | Better Auth session + cookies | Server |
| Pending submissions data | Fetched on mount, cached in React state | Browser |

### Caching Strategy

| Data | Strategy | TTL |
|------|----------|-----|
| Pending submissions list | No cache (fresh per visit) | — |
| Cafe page (published) | Next.js full route cache + ISR | Revalidate on update |
| Cafe page (unpublished) | No cache (dynamic) | — |
| User session | Cookie-based, middleware-level | Session duration |

---

## 6. Security & Error Handling

### Authentication/Authorization
- All server actions call `getCurrentUser()` at the top — return `{ success: false, error: auth error }` if null.
- Admin-only actions (`approveCafe`, `rejectCafe`, `getPendingCafes`) check `profile.role` is `admin` or `moderator`.
- Cafe visibility for unpublished: only the contributor, admins, and cafe owners can see it.
- Moderator region scoping already in place for admin queries — extend to pending submissions.

### Input Validation Strategy
- **All server actions**: Zod schema `safeParse()` before any DB operation.
- **SuggestEditModal**: Add Zod schema for `SuggestableFields` (subset of `cafeSubmissionSchema`).
- **File uploads**: Validate MIME type, max file size, and dimensions on client and server.
- **Rate limiting**: Consider adding a simple rate limit (1 submission per 60s per user) via the existing `chatRateLimits` pattern or a new in-memory/deferred check.

### Error Handling Philosophy

| Error Type | Behavior |
|-----------|----------|
| Zod validation failure | Return `{ success: false, error: { code: 'VALIDATION', message, field } }` |
| Auth failure | Return `{ success: false, error: { code: 'AUTH', retryable: false } }` |
| DB failure | Log stack trace, fire critical Discord webhook, return generic `{ code: 'DB' }` |
| Rate limit hit | Return `{ success: false, error: { code: 'RATE_LIMIT', retryable: true } }` |
| Duplicate detected | Return structured error with link to pending submissions page |

### Logging and Monitoring
- All DB errors logged via `console.error` with context.
- Critical failures (slug exhaustion, DB insert failure) fire Discord webhook via `notifyDiscordCritical`.
- Contribution logging is fire-and-forget (non-blocking).
- Add error boundary components for submit form and suggest edit modal.

---

## 7. Migration & Rollback

### Database Changes
**None required.** All changes are code-only:
- `cafes` table already has `isPublished`, `contributorId`, `slug` columns.
- `cafeEditSuggestions` table already has `suggestedChanges`, `suggestedImages`, `status`.
- The `slug` column already has a unique index.

### Backward Compatibility
- `getCafeBySlug()` signature: Add optional parameter `includeUnpublished` with default `false`. Existing callers that pass no second argument get the new safe behavior (published only).
- Admin callers pass `includeUnpublished: true` explicitly.
- Old pending cafes in the database remain unaffected — they were already `isPublished = false`. They will be hidden from public view after the code change.

### Rollback Strategy
| Change | Rollback |
|--------|----------|
| `getCafeBySlug` filter | Revert to old version without `isPublished` filter |
| Slug normalization | Revert `generateSlug` function |
| Pending submissions page | Remove page directory and navigation link |
| Suggest edit validation | Remove Zod schema import in `suggestions.ts` |
| Test fixes | Revert individual test file changes |

---

## 8. Open Questions

1. **Canvas mock strategy for JSDOM**: Should we add `HTMLCanvasElement.prototype.getContext` mock globally in `test-setup.ts`, or mock the `@chenglou/pretext` module in each test file that uses ShrinkwrapBubble? The global mock is DRY-er but may mask real Canvas issues. The module mock is surgical but verbose. **Decision: Global mock in `test-setup.ts`** since `@chenglou/pretext` is a layout utility, not a rendering target.

2. **Unpublished cafe access for contributors**: How should a contributor access their pending submission? Option A: Only via `/profile/pending-submissions`. Option B: Visiting the direct slug shows a "Pending Review" banner but no full details. **Decision: Option A** for simplicity — pending submissions are only accessible through the dedicated page until approved.

3. **SuggestEditModal refactor depth**: Full extraction of shared components vs. surgical fixes? The modal is 2500 lines and shares ~60% of field types with `CafeSubmissionForm`. **Decision: Extract only the form field components that are truly shared** (BasicInfoFields, ContactFields) and leave the modal's layout/section logic as-is. Full consolidation is a future refactor.
