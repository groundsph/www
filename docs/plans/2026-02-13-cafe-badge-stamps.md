# Cafe Badge Stamp Uploads Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow cafe owners to upload a custom transparent PNG stamp that replaces default Coffee Passport stamps in public + private profiles, with full CRUD and storage cleanup.

**Architecture:** Store a single `badge_stamp_url` on `cafes`, upload the PNG to the `badges` bucket via new owner-facing storage actions, and join the stamp URL into passport data so `components/profile/Passport.tsx` renders the custom stamp with fallback to existing SVGs. Reuse shared cafe editor UI for the edit flow, and add a lightweight panel in the owner dashboard settings tab for convenience.

**Tech Stack:** Next.js App Router, Server Actions, Drizzle ORM, Cloudflare R2 via storage abstraction, Tailwind CSS, Bun test runner.

---

### Task 1: Add DB column for cafe badge stamp

**Files:**
- Modify: `db/schema/tables.ts`
- Modify: `utils/types/database.types.ts`
- Create: `drizzle/migrations/0008_add-cafe-badge-stamp.sql`

**Step 1: Write the failing test**

Create a schema test that asserts the new column exists on `cafes`:

```ts
import { describe, it, expect } from "bun:test"
import { cafes } from "@/db/schema"

describe("cafes schema", () => {
    it("includes badge stamp url", () => {
        expect(cafes).toHaveProperty("badgeStampUrl")
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test db/schema/__tests__/inventory-schema.test.ts`

Expected: FAIL with missing `badgeStampUrl` property.

**Step 3: Write minimal implementation**

- Add `badgeStampUrl: text("badge_stamp_url")` to the `cafes` table in `db/schema/tables.ts`.
- Update the generated DB types in `utils/types/database.types.ts` (Row/Insert/Update for `cafes`) to include `badge_stamp_url?: string | null`.
- Create migration `drizzle/migrations/0008_add-cafe-badge-stamp.sql`:

```sql
ALTER TABLE "cafes" ADD COLUMN "badge_stamp_url" text;
```

**Step 4: Run test to verify it passes**

Run: `bun test db/schema/__tests__/inventory-schema.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add db/schema/tables.ts utils/types/database.types.ts drizzle/migrations/0008_add-cafe-badge-stamp.sql db/schema/__tests__/inventory-schema.test.ts
git commit -m "feat: add cafe badge stamp column"
```

---

### Task 2: Extend cafe data types and queries to include badge stamp URL

**Files:**
- Modify: `utils/types/extra.ts`
- Modify: `app/api/actions/owner.ts`
- Modify: `app/api/actions/profile.ts`

**Step 1: Write the failing test**

Add a unit test that verifies passport visited cafes include `badge_stamp_url` when returned from profile actions. Create a small test around the mapping functions (no DB calls) by extracting mapping to a helper if needed:

```ts
import { describe, it, expect } from "bun:test"
import { mapPassportCafe } from "@/utils/passport/map"

describe("passport mapping", () => {
    it("includes badge_stamp_url", () => {
        const result = mapPassportCafe({
            cafeName: "Test",
            cafeSlug: "test",
            cafeThumbnail: null,
            badgeStampUrl: "https://cdn.../stamp.png",
            firstVisit: "2026-02-13T00:00:00.000Z",
        })
        expect(result.badge_stamp_url).toBe("https://cdn.../stamp.png")
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/__tests__/passport-mapping.test.ts`

Expected: FAIL with missing helper or missing field.

**Step 3: Write minimal implementation**

- Update `CafeWithRatings` in `utils/types/extra.ts` to include `badge_stamp_url?: string | null` (snake_case, matching existing pattern).
- Update `getCafeForOwnerManagement` in `app/api/actions/owner.ts` to map `badgeStampUrl` into the response as `badge_stamp_url`.
- Update `getFullProfileData` and `getPublicProfileData` in `app/api/actions/profile.ts` to select `cafes.badgeStampUrl` for visited cafes and include it in the `passportCafes.visited` items. (Add `badge_stamp_url` to the visited type in both return shapes.)
- If needed, add a tiny helper `utils/passport/map.ts` to map the cafe row to the passport view model (makes the test above meaningful).

**Step 4: Run test to verify it passes**

Run: `bun test utils/__tests__/passport-mapping.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add utils/types/extra.ts app/api/actions/owner.ts app/api/actions/profile.ts utils/passport/map.ts utils/__tests__/passport-mapping.test.ts
git commit -m "feat: expose cafe badge stamp in passport data"
```

---

### Task 3: Add storage support for cafe badge stamp uploads

**Files:**
- Modify: `utils/storage/types.ts`
- Modify: `utils/storage/actions.ts`
- Modify: `utils/storage/index.ts`
- Modify: `utils/storage/client.ts`

**Step 1: Write the failing test**

Add a validation test that enforces badge stamp constraints:

```ts
import { describe, it, expect } from "bun:test"
import { validateFile, STORAGE_BUCKETS } from "@/utils/storage"

describe("badge stamps", () => {
    it("rejects non-png", () => {
        const file = new File(["fake"], "stamp.jpg", { type: "image/jpeg" })
        const result = validateFile(file, STORAGE_BUCKETS.BADGES)
        expect(result.valid).toBe(false)
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/__tests__/storage-badges.test.ts`

Expected: FAIL (test file missing or behavior not enforced).

**Step 3: Write minimal implementation**

- Reuse the `badges` bucket for cafe stamps (same size/type constraints). No new bucket needed.
- Add new server actions in `utils/storage/actions.ts`:
  - `uploadCafeBadgeStampAction(formData, cafeId)`
    - Auth required, owner-only via `isOwnerOfCafe` (import from owner actions).
    - Validate PNG only, 512x512, max 500KB (copy badge dimension checks).
    - Generate path with `generateCafeFilePath(cafeId, file.name)` for per-cafe namespace.
  - `deleteCafeBadgeStampAction(imageUrl)`
    - Auth required, owner-only.
    - Delete file from `badges` bucket.
- Re-export actions in `utils/storage/index.ts`.
- Add client wrapper in `utils/storage/client.ts`:
  - `uploadCafeBadgeStamp(file, cafeId)`

**Step 4: Run test to verify it passes**

Run: `bun test utils/__tests__/storage-badges.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add utils/storage/types.ts utils/storage/actions.ts utils/storage/index.ts utils/storage/client.ts utils/__tests__/storage-badges.test.ts
git commit -m "feat: add cafe badge stamp storage actions"
```

---

### Task 4: Owner-side CRUD server actions for badge stamp URL

**Files:**
- Modify: `app/api/actions/owner.ts`
- Modify: `utils/types/owner.ts` (if needed for new action result types)

**Step 1: Write the failing test**

Add owner actions test that validates update flows for `badge_stamp_url` (can be a unit test around update payload mapping if DB integration is heavy):

```ts
import { describe, it, expect } from "bun:test"
import { mapOwnerCafeUpdates } from "@/utils/owner/update-mapping"

describe("owner update mapping", () => {
    it("maps badge_stamp_url", () => {
        const result = mapOwnerCafeUpdates({ badge_stamp_url: "https://..." })
        expect(result.badgeStampUrl).toBe("https://...")
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/__tests__/owner-update-mapping.test.ts`

Expected: FAIL due to missing helper/field.

**Step 3: Write minimal implementation**

- Extend `updateCafeAsOwner` to accept `badge_stamp_url` in its update payload and map it to `badgeStampUrl`.
- Add two dedicated actions in `app/api/actions/owner.ts`:
  - `setCafeBadgeStamp(cafeId, imageUrl)` updates the cafe column and returns `{ success }`.
  - `removeCafeBadgeStamp(cafeId)` clears the column and returns `{ success }`.
- Ensure both actions verify ownership and call `revalidatePath` for the cafe profile/public views and owner pages.

**Step 4: Run test to verify it passes**

Run: `bun test utils/__tests__/owner-update-mapping.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add app/api/actions/owner.ts utils/__tests__/owner-update-mapping.test.ts utils/owner/update-mapping.ts
git commit -m "feat: allow owners to set badge stamp url"
```

---

### Task 5: Add badge stamp UI in Cafe Edit (images section)

**Files:**
- Modify: `components/cafe-editor/ImageSection.tsx`
- Modify: `components/owner/CafeEdit.tsx`

**Step 1: Write the failing test**

Add a basic UI test (if existing setup) or a snapshot-like test in components to ensure the new panel renders when a `badge_stamp_url` is present. If no UI test infra, add a small unit test for a new hook helper (see Step 3).

```ts
import { describe, it, expect } from "bun:test"
import { getStampFallback } from "@/utils/passport/stamp"

describe("stamp helper", () => {
    it("uses custom url when present", () => {
        expect(getStampFallback("Cafe", "https://x")).toBe("https://x")
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/__tests__/stamp-helper.test.ts`

Expected: FAIL (helper missing).

**Step 3: Write minimal implementation**

- Add UI panel in `ImageSection` for "Badge Stamp":
  - Preview (square), file input (PNG only), remove button.
  - Guidance text: 512x512 PNG, transparent, max 500KB.
- Wire upload using `uploadCafeBadgeStamp` client wrapper.
- On success, call new owner action `setCafeBadgeStamp` to persist URL, and update the cafe state in `CafeEdit` with `updateField("badge_stamp_url", url)`.
- On delete, call `deleteCafeBadgeStampAction`, then `removeCafeBadgeStamp` to clear DB field, and update local state.

**Step 4: Run test to verify it passes**

Run: `bun test utils/__tests__/stamp-helper.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add components/cafe-editor/ImageSection.tsx components/owner/CafeEdit.tsx utils/passport/stamp.ts utils/__tests__/stamp-helper.test.ts
git commit -m "feat: add badge stamp upload in cafe edit"
```

---

### Task 6: Add badge stamp UI in Owner Dashboard settings tab

**Files:**
- Modify: `components/owner/CafeManagement.tsx`

**Step 1: Write the failing test**

Add a small unit test for new validation helper that checks PNG + size, used by this UI.

```ts
import { describe, it, expect } from "bun:test"
import { isBadgeStampFileValid } from "@/utils/validation/badge-stamp"

describe("badge stamp validation", () => {
    it("rejects non-png", () => {
        const file = new File([""], "x.jpg", { type: "image/jpeg" })
        expect(isBadgeStampFileValid(file).valid).toBe(false)
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/validation/__tests__/badge-stamp.test.ts`

Expected: FAIL.

**Step 3: Write minimal implementation**

- Add a compact panel in the "Settings" tab that shows:
  - Preview, upload button, remove button.
  - Uses same actions as Cafe Edit (upload/delete + set/remove DB fields).
- Add `isBadgeStampFileValid` in `utils/validation/badge-stamp.ts` that checks size + extension before upload for faster feedback.

**Step 4: Run test to verify it passes**

Run: `bun test utils/validation/__tests__/badge-stamp.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add components/owner/CafeManagement.tsx utils/validation/badge-stamp.ts utils/validation/__tests__/badge-stamp.test.ts
git commit -m "feat: add badge stamp controls in owner settings"
```

---

### Task 7: Render custom stamps in Coffee Passport (public + private)

**Files:**
- Modify: `components/profile/Passport.tsx`
- Modify: `components/profile/Profile.tsx`
- Modify: `components/profile/PublicProfile.tsx`
- Modify: `app/api/actions/profile.ts` (if not already in Task 2)

**Step 1: Write the failing test**

Add a helper test for stamp selection:

```ts
import { describe, it, expect } from "bun:test"
import { selectStampImage } from "@/utils/passport/stamp"

describe("selectStampImage", () => {
    it("uses custom stamp url if provided", () => {
        const result = selectStampImage("Cafe", "https://custom.png")
        expect(result).toBe("https://custom.png")
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/__tests__/stamp-helper.test.ts`

Expected: FAIL (helper missing or not wired).

**Step 3: Write minimal implementation**

- Extend `PassportCafe` type to include `badge_stamp_url?: string | null`.
- Update `Profile` and `PublicProfile` to pass that field when mapping visited cafes into `Passport`.
- In `Passport.tsx`, prefer `badge_stamp_url` over `getStamp` and use `object-contain` for transparent PNGs.
- Keep fallback to existing SVG stamps when no custom URL.

**Step 4: Run test to verify it passes**

Run: `bun test utils/__tests__/stamp-helper.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add components/profile/Passport.tsx components/profile/Profile.tsx components/profile/PublicProfile.tsx utils/passport/stamp.ts utils/__tests__/stamp-helper.test.ts
git commit -m "feat: use custom cafe stamps in passport"
```

---

### Task 8: Storage cleanup integration for badge stamps

**Files:**
- Modify: `utils/storage/actions.ts`

**Step 1: Write the failing test**

Add a unit test that ensures badge stamp URLs are included in cleanup's valid URL set.

```ts
import { describe, it, expect } from "bun:test"
import { collectCafeStampUrls } from "@/utils/storage/cleanup"

describe("storage cleanup", () => {
    it("includes cafe badge stamp urls", () => {
        const urls = collectCafeStampUrls([{ badgeStampUrl: "https://x" }])
        expect(urls.has("https://x")).toBe(true)
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/__tests__/storage-cleanup.test.ts`

Expected: FAIL.

**Step 3: Write minimal implementation**

- Update `cleanupOrphanedImages` to include `cafes.badgeStampUrl` in the valid URL set for the `badges` bucket.
- (Optional) Extract helper `collectCafeStampUrls` for the test.

**Step 4: Run test to verify it passes**

Run: `bun test utils/__tests__/storage-cleanup.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add utils/storage/actions.ts utils/storage/cleanup.ts utils/__tests__/storage-cleanup.test.ts
git commit -m "chore: include cafe stamps in storage cleanup"
```

---

### Task 9: Documentation and manual QA checklist

**Files:**
- Modify: `docs/plans/2026-02-13-cafe-badge-stamps.md`

**Step 1: Write the failing test**

Skip (docs only).

**Step 2: Update plan with QA steps**

Add a QA checklist to the implementation plan:

1. **Upload PNG in Cafe Edit**
   - Navigate to Cafe Edit > Images
   - Upload PNG 512x512 under 500KB
   - Verify preview appears immediately
   - Save and confirm badge stamp URL is persisted in DB

2. **Owner Dashboard Settings Panel**
   - Navigate to Owner Dashboard > Settings tab
   - Verify same stamp shows as in Cafe Edit
   - Upload new stamp and confirm it syncs across both locations

3. **Private Profile Display**
   - Visit user's own profile (private)
   - Verify custom stamp appears on visited cafe badges
   - Confirm stamp renders with correct styling (object-contain for transparency)

4. **Public Profile Display**
   - View public profile URL (incognito or as different user)
   - Verify same custom stamps appear as in private profile
   - Confirm fallback to default SVG stamps if no custom stamp set

5. **Remove Stamp Flow**
   - Remove stamp from either Cafe Edit or Owner Settings
   - Verify preview clears immediately
   - Check that visited cafes fall back to default SVG stamps
   - Confirm DB field is cleared (badge_stamp_url = null)

6. **Storage Cleanup Protection**
   - Run storage cleanup job or orphaned image cleanup
   - Verify currently referenced stamp files are NOT deleted
   - Confirm only truly orphaned files are removed

**Step 3: Commit**

```bash
git add docs/plans/2026-02-13-cafe-badge-stamps.md
git commit -m "docs: add cafe badge stamp QA checklist"
```

---

## Notes / Decisions

- **Replacement scope:** Per-cafe stamp used in both public and private Coffee Passport visited stamps with fallback to existing SVG stamps.
- **Image constraints:** PNG only, transparent, 512x512px, max 500KB.
- **Storage:** Use existing `badges` bucket; enforce ownership checks on upload/delete.
- **CRUD:** Upload + set URL, remove + delete object, update via Cafe Edit and Owner Settings.

## Commands Reference

- DB schema push: `bun db-push`
- Tests: `bun test`
- Lint: `bun lint`
