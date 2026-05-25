# Architectural Spec: Submit, SEO, test-cafe, & Team Management

**Date**: 2025-05-25
**Status**: Design Phase
**Source of Truth**: This document defines constraints, security boundaries, and architectural decisions. No code implementation until approved.

---

## Table of Contents

1. [Objective 1: Submission Improvements](#objective-1-submission-improvements)
2. [Objective 2: SEO Enhancement](#objective-2-seo-enhancement)
3. [Objective 3: test-cafe Filtering](#objective-3-test-cafe-filtering)
4. [Objective 4: Team Management](#objective-4-team-management)
5. [Cross-Cutting Concerns](#cross-cutting-concerns)

---

## Objective 1: Submission Improvements

### 1.1 Current State

The submit flow is at `app/api/actions/submit.ts` with the client form at `components/submit/CafeSubmissionForm.tsx`. Key findings from codebase exploration:

| Component | Path | Notes |
|---|---|---|
| Server action | `app/api/actions/submit.ts` | Manual validation, no Zod. Slug from name only. |
| Client form | `components/submit/CafeSubmissionForm.tsx` | 8-step wizard, 3298 lines. |
| Slug generation | `submit.ts` lines 12-39 | name → lowercase → strip special → spaces→hyphens. **No location in slug.** |
| Uniqueness | `submit.ts` lines 23-36 | `while(true)` DB poll, no bound. |
| Error display | Client `error` state → red banner + toast | Single error string, no field-level errors. |
| Discord notify | `app/api/actions/notify.ts` | Posts rich embed. **No critical-issue severity level.** |
| Duplicate check | `searchCafesSimple()` in Step 0 | UI-only warning; no server-side block. Shows ALL cafes (including pending). |

### 1.2 Issues Identified & Remediation

#### 1.2.1 Error Logging & User-Facing Error Messages

**Problems**:
- Server actions return a single `error: string` — no granularity (field-level, network, validation, DB).
- Client catches errors with a top-level try/catch → shows generic "An unexpected error occurred".
- No structured error types that can inform recovery (retry vs. fix-field vs. contact-support).
- Menu item insertion failures are silently swallowed (logged but submission still succeeds).
- Discord notification failures are silently swallowed.

**Design Decision — Structured Error Result**:

```
SubmitCafeResult =
  { success: true, cafeId, slug }
  | { success: false, error: SubmitError }

SubmitError = {
  code: "VALIDATION" | "AUTH" | "DB" | "UPLOAD" | "NETWORK" | "UNKNOWN"
  message: string              // User-facing
  field?: string               // Optional field-level targeting
  details?: string             // Internal debug info (logged, not shown)
  retryable?: boolean          // Can the user retry immediately?
}
```

**Constraints**:
- NEVER expose internal details (stack traces, SQL errors, env vars) to the client.
- All unexpected errors must hit `console.error` with full context AND trigger the Discord critical webhook.
- Field-level `field` values must match the `SerializableCafeSubmission` field names.
- `message` must be plain English, no technical jargon (e.g., "We couldn't save your cafe right now. Please try again." not "PostgreSQL unique constraint violation").

#### 1.2.2 Discord Critical Issue Webhook

**Problems**:
- The existing `notifyDiscord()` is only called for new submissions — not for failures.
- No severity distinction between "new cafe submitted" and "submission failed critically."
- DB failures, uncaught exceptions, and unexpected states produce only console logs.

**Design Decision — Dual Webhook Severity**:

| Severity | Trigger | Webhook Env Var | Color |
|---|---|---|---|
| `info` | New submission, claim, edit suggestion | `DISCORD_WEBHOOK_URL` | Purple/Amber (existing) |
| `critical` | DB insert failures, unexpected exceptions, slug uniqueness loop > 100 iterations, image upload failures after 3 retries | `DISCORD_WEBHOOK_URL` (same URL, different embed) | Red + ⚠️ prefix |

**Function Signature Addition** (in `notify.ts`):

```
notifyDiscordCritical(
  title: string,              // "Submission DB Insert Failed"
  description: string,         // Detailed context
  errorContext: {
    cafeName?: string
    submitterId?: string
    errorMessage: string
    errorStack?: string       // Truncated to 1000 chars
    failedStep: string        // "db_insert" | "slug_generation" | "menu_insert" | "discord_notify"
  }
): Promise<void>  // Fire-and-forget; failure to notify must not cascade
```

**Constraints**:
- Critical webhook failures must NOT block the error return to the client — always fire-and-forget.
- If the critical webhook URL is not configured, fall back to console logging only (no crash).
- Rate-limit: max 1 critical notification per 5 seconds to avoid flooding.
- If the webhook URL is not configured, fall back to console logging only (no crash).

#### 1.2.3 Slug Normalization with Location

**Problems**:
- Current: `generateSlug("Starbucks")` → `"starbucks"`
- Two cafes named "Starbucks" in different cities produce conflicting slugs (resolved only by `-1`, `-2` suffixes).
- Slugs are not human-readable for disambiguation — `starbucks-1` tells you nothing.

**Design Decision — Location-Enhanced Slug**:

```
New slug format: {normalized_name}-{city_slug}-{province_slug}
Example: "starbucks-makati-metro-manila"

Fallback (if name or city produces empty slug):
  → "{name_slug}-{province_slug}"  (if city is empty/unrecognized)
  → "{name_slug}-{region_slug}"    (if both city and province produce empty)
  → "{name_slug}-{counter}"        (final fallback, as current behavior)
```

**Implementation Points**:
- `generateSlug()` gains a second parameter: `locationSlug?: string`
- `ensureUniqueSlug()` unchanged — still polls DB, but collisions drop dramatically.
- The location slug is built from `cityMunicipality` and `province` using the same slugify logic.
- Maximum slug length: 200 characters (DB-safe). Truncate with `...` if over.
- Add a `MAX_SLUG_ITERATIONS = 100` safety bound; if exceeded, return error.

**Data Migration Note**:
- Existing cafes keep their current slugs (no backfill required).
- Only new submissions use the location-enhanced format.
- DO NOT alter existing slugs — they may be indexed by search engines and linked externally.

#### 1.2.4 Duplicate Detection — Including Pending Cafes

**Problems**:
- Current: `searchCafesSimple()` returns ALL cafes (published + pending). This is actually correct.
- But the warning is UI-only — the user can ignore it and submit anyway.
- No server-side duplicate check before insert. Only the unique slug constraint provides a partial safety net.

**Design Decision — Server-Side Duplicate Guard**:

Before inserting, run a proximity check:

```
1. Name match: ILIKE search for similar names (Levenshtein distance ≤ 3 OR trigram similarity ≥ 0.6)
   → requires pg_trgm extension (already likely available on PostgreSQL)

2. Location match: If lat/lng provided, check for cafes within 100m radius with similar names

3. If duplicates found:
   - If all duplicates are isPublished: false → return error: "DUPLICATE_PENDING"
     with message: "A cafe with a similar name and location has already been submitted and is awaiting review."
   - If any duplicate is isPublished: true → return error: "DUPLICATE_EXISTS"
     with message: "This cafe may already exist on Grounds. Please check: [list of matched cafe links]"

4. Block submission if threshold exceeded (return error, do NOT insert)

5. Log all near-miss submissions to system_logs for admin review
```

**Constraints**:
- The trigram similarity check must NOT block legitimate submissions (unrelated cafes with similar names).
- `pg_trgm` extension availability must be verified before deployment.
- Fallback: If pg_trgm unavailable, use simple ILIKE + distance check only.
- The duplicate check runs AFTER validation but BEFORE image upload (or parallel to upload — check the name+location while images are uploading).

### 1.3 Data Flow (Revised)

```
CLIENT: handleSubmit()
  ├── [1] Compress + upload images (async, parallel)
  ├── [2] Build serializableFormData
  └── [3] Await submitCafe(formData, thumbnailUrl, galleryUrls, menuItems)
              │
              ▼
         SERVER: submit.ts (REVISED)
              ├── [a] Auth check (getCurrentUser)
              ├── [b] Zod validation of full payload
              ├── [c] Name + location duplicate check (with pending awareness)
              ├── [d] generateSlug(name, locationSlug) + ensureUniqueSlug(bounded loop)
              ├── [e] DB transaction: insert cafe + menu items
              ├── [f] Discord notify (info webhook for success)
              ├── [g] Contribution logging
              └── [h] Return structured SubmitCafeResult

         On any failure at [e]:
              ├── Log full context to console.error
              ├── Fire Discord critical webhook (fire-and-forget)
              └── Return structured error to client
```

---

## Objective 2: SEO Enhancement

### 2.1 Current State

The root layout metadata is strong (`app/layout.tsx`). The site has:
- Complete root meta (OpenGraph, Twitter, robots, icons).
- A well-structured sitemap (`app/sitemap.ts` + `utils/seo/sitemap.ts`).
- Robots.txt blocking AI crawlers (`app/robots.ts`).
- JSON-LD on homepage (Organization + WebSite) and cafe pages (CafeOrCoffeeShop).
- `buildPageMetadata()` utility for shared patterns.

**Critical gaps** (as discovered by exploration):

| Gap | Impact |
|---|---|
| **No canonical URLs on cafe pages** | Duplicate content risk. Every cafe at `/cafes/{slug}` has no canonical, meaning search engines might index variants (trailing slash, query params, etc.). |
| **No canonical on cafe menu pages** | Same as above for `/cafes/{slug}/menu`. |
| **No JSON-LD on blog posts** | Missing BlogPosting/Article schema — key for Google's "Top stories" and rich results. |
| **No JSON-LD on events, collections, crawls, profiles** | Missing structured data opportunities. |
| **No BreadcrumbList schema anywhere** | Google displays breadcrumbs in search results when this schema exists. |
| **Most listing pages lack keywords** | `/cafes`, `/blog`, `/community`, `/map` pages have no `keywords` metadata. |
| **No Google/Bing verification meta** | Cannot verify ownership via meta tag (if needed). |
| **Profile pages excluded from sitemap** | User profiles could contribute long-tail SEO. |
| **Blog canonical points to wrong URL** | `/blog` page canonical is `/community?tab=blogs` — outright bug. |
| **No image sitemap** | Gallery images on cafes not indexed via sitemap. |

### 2.2 Keyword Research Strategy

**Target audience**: Coffee enthusiasts, remote workers, students, tourists in the Philippines searching for:
- "best cafes in [city]" / "coffee shops near me [city]"
- "cafes with wifi [city]" / "study cafes [city]" / "work-friendly cafes [city]"
- "specialty coffee [region]" / "third wave coffee philippines"
- "cafe guide [province]" / "hidden gem cafes [city]"
- "cafe events [month] [city]" / "coffee crawl [city]"

**Location-based keyword structure** (implement programmatically):
- Every cafe page builds keywords from: `{cafe_name}`, `{city}`, `{province}`, `{tags}`, `{specialty}`
- City-level listing pages get: `"cafes in {city}"`, `"coffee shops in {city}"`, `"{city} cafe guide"`
- Homepage and global listing: broader terms like `"Philippines cafe finder"`, `"coffee culture Philippines"`
- Blog posts: keyword from post `tags[]` array + `category`

**Design Decision — Location-Specific Landing Pages**:

Create or enhance existing city/province/region landing pages with:
```
URL pattern: /cafes/{province}/{city}
Title: "Best Cafes in {City}, {Province} | Grounds PH"
Description: "Discover {cafe_count}+ cafes in {City}, {Province}. Find WiFi-friendly, pet-friendly, and specialty coffee shops."
JSON-LD: ItemList with all cafes in that location
Keywords: city-specific + amenity-specific
Canonical: self-referencing
```

**Note**: This requires evaluating whether the existing `getAllCafes` already supports city/province filtering at the query level (it does — `filters.city` and `filters.province` params). The pages just need to be created/connected.

### 2.3 Structured Data (JSON-LD) Coverage Plan

| Page | Schema Type | Priority | Notes |
|---|---|---|---|
| `/` (home) | Organization + WebSite | ✅ Done | |
| `/cafes/{slug}` | CafeOrCoffeeShop | ✅ Done | Add `sameAs` for social links |
| `/cafes/{slug}` | BreadcrumbList | 🔴 Critical | Three levels: Home > Cafes > Cafe Name |
| `/cafes/{slug}/menu` | Menu + BreadcrumbList | 🟡 Medium | Schema.org Menu type |
| `/blog/{slug}` | BlogPosting + BreadcrumbList | 🔴 Critical | Author, datePublished, dateModified, image |
| `/community/*/events` | Event | 🟡 Medium | For event detail pages |
| `/community/{slug}` | CollectionPage | 🟢 Low | Collections are lower traffic |
| `/community/crawls/{slug}` | ItemList + BreadcrumbList | 🟢 Low | Crawl itineraries |
| `/profile/{username}` | ProfilePage | 🟢 Low | Public profiles |
| Collection listing | ItemList | 🟢 Low | |
| Search results | SearchResultsPage | 🟢 Low | |

### 2.4 Canonical URL Enforcement

**Design Decision — Canonical at Every Public Page**:

1. **Root layout**: Keep `canonical: "./"` (already there).
2. **`buildPageMetadata()` utility**: Already handles canonical. Ensure ALL dynamic pages use it or inline the pattern.
3. **Cafe pages**: Add `alternates: { canonical: `${siteUrl}/cafes/${slug}` }` to `generateMetadata`.
4. **Cafe menu pages**: Add `alternates: { canonical: `${siteUrl}/cafes/${slug}/menu` }`.
5. **Blog listing**: Fix canonical from `/community?tab=blogs` to `/blog`.
6. **All listing pages** (`/cafes`, `/blog`, `/community`, `/map`): Add canonical via `buildPageMetadata()`.

### 2.5 Sitemap Expansion

**Changes**:
- Include public profiles in sitemap: `profiles: [...]` instead of `profiles: []` in `sitemap.ts`.
- Add image sitemap entries for cafe thumbnails (as `<image:image>` sub-elements). Next.js doesn't natively support this in the `MetadataRoute.Sitemap` type, so it would need a custom XML template or a separate `app/sitemap-images.xml/route.ts`.
- Add city landing pages to sitemap once created.

**Priority**: Low for image sitemap (nice-to-have). Medium for profiles + city pages.

### 2.6 Meta Verification

Add to root layout metadata:
```
verification: {
  google: process.env.GOOGLE_SITE_VERIFICATION,
  yandex: process.env.YANDEX_SITE_VERIFICATION,
  yahoo: process.env.YAHOO_SITE_VERIFICATION,
}
```

Values come from `.env.local` — allows verification without code changes.

---

## Objective 3: test-cafe Filtering

### 3.1 Current State

**There is NO test-cafe feature in the codebase.** The string "test-cafe" appears only in test fixture files. There is no `isTest` column, no environment-based filtering, and no concept of development-only cafes. A "test cafe" in the DB right now is literally just a cafe with `name: "test-cafe"`, indistinguishable from a real one in queries.

### 3.2 Design Decision — `isTest` Column + API-Level Filtering

**Approach**: Add a dedicated column to the `cafes` table with automatic application-level filtering.

#### Schema Change (Additive Migration)

```sql
ALTER TABLE cafes ADD COLUMN is_test BOOLEAN DEFAULT false NOT NULL;
```

**Migration file**: Created via `bun db:generate` (Drizzle). DO NOT run destructive SQL — this is purely additive.

#### API-Level Filtering

All public-facing cafe queries must exclude test cafes in production. The filtering point is at the data-access layer (the query conditions in `cafe.ts`, `map.ts`, `search.ts`, `nearby.ts`, and `admin.ts`).

**Strategy — Centralized Filter Function**:

```
// New file: utils/filters.ts or inline in existing queries

function getProductionFilter() {
  if (process.env.NODE_ENV === "production") {
    return eq(cafes.isTest, false)
  }
  return undefined  // In dev, show everything
}
```

Apply to ALL cafe queries in:
| File | Functions to update |
|---|---|
| `app/api/actions/cafe.ts` | `getAllCafes`, `getCafeBySlug`, `getDailyFeatured`, `getLocationFeatured`, `getAllPublishedCafes`, `getCafesByIds`, `getCafesBySlugs`, `searchCafesSimple`, `searchCafesForBlog`, `getPublishedCafeCount` |
| `app/api/actions/map.ts` | `getCafesInBounds` |
| `app/api/actions/nearby.ts` | `getNearbyCafes` |
| `app/api/actions/search.ts` | `searchCafesAndUsers`, `globalSearch` |
| `app/api/actions/leaderboard.ts` | Leaderboard cafe queries |
| `app/api/actions/hidden-gems.ts` | Hidden gem evaluation |
| `app/sitemap.ts` | Sitemap cafe entries |

**Dev behavior**: In development, test cafes are fully visible (map, search, listings, sitemap). This allows local testing with the `test-cafe` entry in the DB.

**Prod behavior**: All test cafes are invisible to users. They still exist in the DB but are filtered at the query level.

**Admin behavior**: Admins/moderators should always see test cafes (regardless of env) in the manage panel. Use a separate admin-only query or omit the filter in admin functions.

#### `isTest` Toggle

- Set via an admin action: `setCafeTestFlag(cafeId: string, isTest: boolean)`
- Only admins can toggle this.
- Logged to `system_logs` with `action: "update"`, `entityType: "cafe"`, metadata: `{ isTest: true/false }`.

#### Alternative Considered and Rejected

**Rejected**: Filtering by slug pattern (e.g., all slugs starting with `"test-"`). This is fragile — what if a real cafe is named "Test Kitchen"? The explicit column approach is cleaner, more intentional, and query-performant (boolean index).

### 3.3 Implementation Priority

1. Add `is_test` column migration.
2. Update Drizzle schema (`db/schema/tables.ts`).
3. Apply `getProductionFilter()` to all public-facing cafe query functions.
4. Add `setCafeTestFlag` admin action.
5. Verify: in dev, test-cafe is visible on map/search/listings. In prod, hidden.

---

## Objective 4: Team Management

### 4.1 Current State — Already Substantially Built

The exploration revealed that the team management feature in `components/manage/CommunityManagement.tsx` already implements the core of what was requested:

| Requested Feature | Already Implemented? | Details |
|---|---|---|
| Manage existing team members | ✅ Yes | Full member list with role badges, search, filters |
| Change regions for moderators | ✅ Yes | `updateModeratorRegions()` + inline region editor with checkboxes |
| Change roles | ✅ Yes | `updateUserRole()` — promote to writer/moderator/admin, demote to user |
| View activity logs | ✅ Yes | Per-member activity log modal with pagination |
| Permissions matrix | ✅ Yes | Visual matrix in the team tab |
| Search & add new team members | ✅ Yes | `searchUsersForRoleAssignment()` + promote buttons |

### 4.2 Remaining Gaps & Enhancements

Even though the feature is built, several enhancements would improve quality and safety:

#### 4.2.1 Self-Demotion Prevention

**Current**: `updateUserRole` prevents changing your own role:
```
if (targetUserId === currentUser.id) {
  return { success: false, error: "You cannot change your own role" }
}
```
✅ Already implemented. Good.

#### 4.2.2 Bulk Role Operations

**Gap**: No way to promote/demote multiple users at once.

**Design**: Add `bulkUpdateUserRoles(userIds: string[], newRole: UserRole)` — admin only, logged to system_logs per user. Requires action confirmation modal.

**Priority**: Low. Not frequently needed.

#### 4.2.3 Role Synchronization (Better Auth vs Profiles)

**Gap**: The `user.role` column in Better Auth's `user` table is NOT synced with `profiles.role`. The application only reads `profiles.role` for authorization decisions, but `user.role` is part of the session object. While this doesn't cause bugs currently (all auth checks query `profiles` separately), it's a consistency risk.

**Decision — Keep As-Is**: Do NOT sync `user.role`. The `profiles.role` is the single source of truth for application authorization. The `user.role` from Better Auth is unused by the admin plugin (which relies on `ADMIN_USER_IDS`). Document this explicitly.

#### 4.2.4 No Team Invitation System

**Gap**: No email-based invite flow for team members. Roles are assigned directly by admins without notification to the target user.

**Design**: Out of scope for this spec. If needed in the future, file a separate spec.

#### 4.2.5 Granular Moderator Permissions

**Gap**: Moderators have fixed permissions (review moderation, event management, cafe approval). There's no ability to restrict specific moderators to specific actions (e.g., "can approve cafes but not delete reviews").

**Design**: Out of scope for this spec. The current system is adequate for the team size. If the moderation team grows beyond ~20 people, revisit.

### 4.3 Team Management — Spec Summary

**Status**: Feature exists and is functional. No implementation work required for this objective beyond verification that the existing feature works as expected.

**Recommended verification**:
1. Confirm the Team tab appears for admin users at `/manage/community`.
2. Test: promote a user to moderator, assign regions, verify they can only see cafes in those regions.
3. Test: demote a moderator — verify `moderatorRegions` is cleared.
4. Test: role-change logging appears in system_logs.

---

## Cross-Cutting Concerns

### Security Constraints (ALL objectives)

| Constraint | Applies To |
|---|---|
| NEVER expose internal error details to client | Submit error messages |
| Log all unexpected errors with full context | Submit, SEO generation, test-cafe |
| Critical Discord webhook is fire-and-forget | Submit |
| Action confirmation modal for destructive admin actions | Team management |
| No destructive SQL migrations — additive only | test-cafe `is_test` column |
| Rate-limit critical webhook to prevent flooding | Submit |
| Never return raw DB errors to clients | Submit |
| All admin actions logged to `system_logs` | Team management, test-cafe toggle |

### Files That Need Changes (Per Objective)

#### Objective 1 (Submit)
- `app/api/actions/submit.ts` — Zod validation, location slug, duplicate guard, structured errors, critical webhook
- `app/api/actions/notify.ts` — Add `notifyDiscordCritical()`
- `utils/validation/` — New `cafe-submission.ts` Zod schema
- `components/submit/CafeSubmissionForm.tsx` — Field-level error display (optional enhancement)
- `app/api/actions/admin.ts` — `getPendingCafes()` region check already exists; verify integrity
- `.env.example` — No new env var needed (single webhook)

#### Objective 2 (SEO)
- `app/cafes/[slug]/page.tsx` — Add canonical, BreadcrumbList JSON-LD
- `app/cafes/[slug]/menu/page.tsx` — Add canonical, Menu JSON-LD
- `app/blog/[slug]/page.tsx` — Add BlogPosting JSON-LD + BreadcrumbList
- `app/blog/page.tsx` — Fix canonical URL
- `app/cafes/page.tsx` — Add keywords metadata
- `app/community/page.tsx` — Add keywords metadata
- `app/map/page.tsx` — Add metadata export
- `app/sitemap.ts` — Add profiles to sitemap
- `app/layout.tsx` — Add verification metadata
- `utils/seo/metadata.ts` — Add BreadcrumbList generator utility
- **New files**: City/province landing pages (optional, can be separate spec)

#### Objective 3 (test-cafe)
- `db/schema/tables.ts` — Add `isTest` column to cafes
- Migration file — Drizzle-generated
- `app/api/actions/cafe.ts` — Apply production filter to all public queries
- `app/api/actions/map.ts` — Apply production filter
- `app/api/actions/nearby.ts` — Apply production filter
- `app/api/actions/search.ts` — Apply production filter
- `app/api/actions/leaderboard.ts` — Apply production filter
- `app/api/actions/hidden-gems.ts` — Apply production filter
- `app/sitemap.ts` — Apply production filter
- `app/api/actions/admin.ts` — Add `setCafeTestFlag()` action
- `utils/filters.ts` — New centralized filter helper (optional)

#### Objective 4 (Team)
- **No implementation changes needed.** Feature already built.
- Verification checklist (see section 4.3).

### Data Safety

- **All migrations must be additive**: New columns, new tables only. No `DROP`, no column renames, no data deletions.
- **test-cafe migration**: `ALTER TABLE cafes ADD COLUMN is_test BOOLEAN DEFAULT false NOT NULL;` — safe, additive.
- **Slug changes**: Only affect NEW submissions. Existing cafes retain their current slugs. No backfill.
- **Production database is always in use**: Test all queries against a local/staging DB before any migration.

### Order of Implementation

1. **Objective 3 (test-cafe)** — Smallest, most isolated. Add column + filter queries. Can be shipped independently.
2. **Objective 1 (Submit)** — Core user flow improvement. Depends on no other objective.
3. **Objective 2 (SEO)** — Multiple small changes across many files. Can be parallelized.
4. **Objective 4 (Team)** — Verification only. No code changes needed.

---

## Confirmed Decisions

All architectural decisions confirmed via user handshake:

| # | Decision | Choice |
|---|---|---|
| 1 | Slug format | `{name}-{city}-{province}` (e.g., `starbucks-makati-metro-manila`) |
| 2 | Duplicate radius | 200m (balanced — catches mall/plaza scenarios) |
| 3 | SEO landing pages | Include in this phase (city/province pages shipped alongside other SEO fixes) |
| 4 | test-cafe dev visibility | Everywhere in dev (listings, search, map, featured, leaderboards) |
| 5 | Discord critical alerts | Single webhook (`DISCORD_WEBHOOK_URL`), differentiated by embed formatting (red + ⚠️ for critical) |
| 6 | Team management verification | Verified live on 2025-05-25 ✓ — 5 team members, role badges, region display, search/filter controls all functional |
| 7 | pg_trgm availability | Yes — available in `pgvector/pgvector:pg17` (standard PG contrib). Enable via `CREATE EXTENSION IF NOT EXISTS pg_trgm;` |

### Team Management Verification Results

Verified via admin account at `https://grounds.ph/manage/community` → Team tab:

- **5 team members**: isha (Moderator), Mikoto (Moderator), Adrian Bonpin (Admin), RanSauce (Admin), GroundsPH (Admin) ✓
- **Role filters**: All Roles / Admin / Moderator / Writer combobox functional ✓
- **Group by Role** toggle present ✓
- **Permissions matrix** button present ✓
- **List/Grid view** toggles present ✓
- **View activity log** buttons on each member row ✓
- **Add Team Member** search input present ✓
- Region display: "Regions: All regions" shown for moderators ✓

Screenshot saved: `docs/superpowers/specs/team-management-verified.png`

**Conclusion**: Objective 4 (Team Management) requires **no implementation**. Feature is complete and verified.
