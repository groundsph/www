# Cafe Management Refresh: Tabs, Image Auto-save, Upload Pipeline, and AI/Pipeline Fixes

**Date:** 2026-10-17
**Status:** Draft for review
**Branch:** `feat/cafe-manage-ui-images` (cut from `prod`, single PR, folds in the uncommitted `adminDeleteCafeImage` fix)

---

## 1. Context and current state

The cafe management surfaces are four separate tabbed screens that were built at different times and now diverge in layout, feedback, and correctness. The image pipeline has one destructive correctness bug and one guarantee gap. The Scan Menu feature is fully broken by a duplicated URL helper.

Verified facts (file:line anchors are from the current `prod` tree):

### 1.1 Editors

| Surface | File | State |
|---|---|---|
| Admin editor | `components/manage/CafeEditor.tsx` (1007 lines) | 9 sections (`basic, images, location, amenities, hours, contact, story, menu, owners`) driven by `SECTIONS`; hand-rolled `motion.button` pill tabs; Save button lives in the top header and only appears when `hasChanges`; `alert()`/`confirm()` feedback (`confirm()` at :224, :238); full-object `updateCafe`; no `revalidatePath`; no unsaved-changes guard |
| Owner editor | `components/owner/CafeEdit.tsx` (640 lines) | 8 sections, own pill tab row, `activeSection` state; reuses `components/cafe-editor/*` including `ImageSection` (:448); toasts via `useNotification`; full-object `updateCafeAsOwner`; has a mobile-only fixed bottom save bar |
| Admin listing | `components/manage/CafesManagement.tsx` (2036 lines) | 7 tabs inlined in one file, pills, card list, "Load More" pagination, optimistic local state |
| Owner hub | `components/owner/CafeManagement.tsx` (2340 lines) | 8 tabs inlined in one file, underline tab strip; the settings tab just links to `/edit` |

### 1.2 Image handling

- Cover: `utils/hooks/useCoverImageUpload.ts`. When the selected file is already 16:9 it uploads the **raw** file with no compression (:87); only the crop path compresses (`compressCoverImage`).
- Gallery: `components/cafe-editor/ImageSection.tsx` `handleGalleryUpload` (~:70-100) compresses each file (`compressGalleryImage`) then uploads **sequentially** with only a boolean spinner, and appends URLs to local state.
- Persistence: the cover URL and gallery array only reach the database when the user presses the header Save button. On the owner side the save payload **omits `thumbnail` and `gallery` entirely** (`CafeEdit.tsx:98-147`, `updateCafeAsOwner` type at `owner.ts:260-305`), so cover/gallery edits never persist.
- Destructive ordering: replacing a cover deletes the **old** storage object immediately (`onDelete` inside the hook), before any DB write. Combined with the owner bug this loses data: the old file is gone and the new URL is never saved.
- Progress: `uploadWithProgress` / `uploadCafeImageWithProgress` exist (`utils/storage/client.ts:141-190`, XHR `onprogress`) and are used only by `components/submit/CafeSubmissionForm.tsx`. Cafe editing has no progress UI, no queue, no retry.
- Badge stamps: uploaded as raw PNG (`uploadCafeBadgeStamp`), validated only by size/extension.

### 1.3 Storage

- Uploads are server-proxied (there is **no** presigned PUT despite `AGENTS.md` claiming one): client → `app/api/storage/upload/route.ts` or a server action → `validateFile` → `StorageProvider.upload` → R2 `PutObjectCommand` → public URL on `cdn.grounds.ph`.
- `utils/storage/helpers.ts:16` `validateFile` already supports `allowedMimeTypes`, but `utils/storage/types.ts` `BUCKET_CONFIGS` (~:130) sets **none**, so only the extension and size are checked. Badges are the only bucket with a real constraint (PNG, 500 KB, ~:162). Other image buckets allow 5 MB; avatars 2 MB; ownership proofs 10 MB and private.
- No image dimension limits, no magic-byte sniffing, no per-bucket file-count limits.

### 1.4 Scan Menu (OCR) — broken

`app/api/ocr/stream/route.ts` defines its **own** `normalizeBaseUrl` (:21) that only strips a trailing slash, while the shared and tested helper (`utils/ai/openai-compatible.ts:27`) also strips a trailing `/v1`. The configured `OPENAI_COMPATIBLE_BASE_URL` is `https://openrouter.ai/api/v1`, so the route requests `https://openrouter.ai/api/v1/v1/chat/completions` (:86).

Proven by direct probe against the configured provider:

```
POST https://openrouter.ai/api/v1/v1/chat/completions  → 404 {"error":{"message":"Not Found","code":404}}
POST https://openrouter.ai/api/v1/chat/completions     → 200 OK
```

The route maps any non-OK upstream response to `502` with the opaque body `AI service error: 404`, which is what the user sees. `utils/ai/menu-ocr.ts:2` imports the correct helper, so the non-streaming path (`app/api/actions/menu-ocr.ts:126`) works — only streaming is broken. `utils/ai/__tests__/openai-compatible.test.ts:21-22` already asserts the OpenRouter `/v1` case, so the helper is correct and the route simply ignored it. Payload size is not a factor: `components/suggestions/MenuOcrScanModal.tsx:201` compresses to ≤0.5 MB / 1024 px first.

### 1.5 Feedback primitives

`components/layout/NotificationProvider.tsx` provides `useNotification().addNotification(message, type)`. `components/ui/ActionConfirmationModal.tsx` + `hooks/useActionConfirmation.ts` implement **sensitive-action verification** (password/TOTP), not a plain confirm dialog. There is no generic modal or confirm primitive, so `confirm()` is used directly in `CafeEditor.tsx` and many owner components.

---

## 2. Goals and non-goals

### Goals (each with a success criterion)

1. **Consistent navigation shell** on all four surfaces: segmented pill tabs with badges/dirty markers, sticky tab strip, sticky action bar. *Criterion:* all four surfaces render tabs through one component; no hand-rolled tab bars remain in the editors.
2. **Image changes persist automatically** on add / remove / reorder, on both sides. *Criterion:* after adding a gallery image or changing the cover, a reload shows the change without pressing Save.
3. **Visible upload status** with per-file progress, failure, retry, and dismiss. *Criterion:* a 5-file drop shows five labelled tiles with progress; a forced failure shows a retryable error tile.
4. **Every image upload is optimized** and unoptimized/oversized/non-image files are rejected. *Criterion:* all cafe/owner image paths go through one helper; server rejects a renamed non-image and an oversize file for every bucket that defines limits.
5. **Owner image data loss is impossible.** *Criterion:* old files are deleted only after the DB write succeeds; a failed save leaves state and storage untouched.
6. **Scan Menu works** against OpenAI-compatible providers whose base URL ends in `/v1`. *Criterion:* a scan against the configured OpenRouter base returns items; upstream failures surface a diagnosable message.
7. **Consistent feedback**: toasts + confirm dialogs replace `alert()`/`confirm()` in the cafe management surfaces.

### Non-goals

Dark mode. Restructuring the internals of `CafesManagement.tsx` / `CafeManagement.tsx` beyond their tab strip. Presigned direct-to-R2 uploads. Server-side image re-encoding (`sharp`) or responsive variant generation. Database schema changes. Internals of the menu/blog/event/collection editors (only their compression call sites move to the shared helper). Field-level auto-save for non-image sections (explicit Save stays).

---

## 3. Decisions

| # | Decision | Rationale | Rejected alternative |
|---|---|---|---|
| D1 | Single combined spec and PR | User decision | Phased specs |
| D2 | Layout **A**: segmented tabs + sticky action bar, on the two editors | Smallest step from today's design, identical behaviour on mobile, no second responsive code path | Desktop left rail with mobile fallback; single scrolling page with scroll-spy |
| D3 | **Shared shell, per-mode data** (approach 1): presentational shell + shared image hooks; `CafeEditor`/`CafeEdit` keep owning their actions and payloads | One implementation of A; structural cure for the divergence that caused the owner data-loss bug; review surface stays small | One fully unified editor with a capabilities object (+ extracting both 2k-line files); separate implementation per surface |
| D4 | Images auto-save through a dedicated field-level action fired per change (debounced) | Does not resend ~35 fields, cannot race the whole-form Save, and fixes the owner bug as a side effect | Auto-trigger the existing full-cafe save; auto-save the entire form |
| D5 | Upload status as **inline placeholder tiles in the grid** with retry/dismiss | Position in the grid is naturally correct and it doubles as the requested status area | Dedicated queue panel; toast-only progress |
| D6 | Client-side compression guarantee + **server-side MIME/size enforcement** | Removes unoptimized bytes without new infrastructure, and makes the guarantee structural | Adding a `sharp`/cloudflare transform stage; generating responsive variants |
| D7 | All four tabbed surfaces in scope; listing/hub get the tab strip swap only | Consistency without a 4,400-line mechanical refactor | Editors only; full internal restructuring |
| D8 | Tab style: same segmented pills with count badges everywhere | One visual language; user delegated the choice ("do what makes most sense") | Underline stays in the owner hub; leave as-is |
| D9 | Polish included: toasts + confirm dialogs, unsaved-changes guard, shared form primitives, skeletons/empty states, unified editor header, mobile polish, tab a11y | User: "all that makes sense" | Toasts/confirm only |
| D10 | OCR: reuse the shared `normalizeBaseUrl`, surface upstream errors, derive the data-URL MIME from the blob, and de-duplicate the copied prompt + SSE parser | Fixes the proven 404→502 and removes the drift that caused it | Minimal one-line import swap only (leaves the copied prompt/parser to drift again) |
| D11 | Migration relaxing `cafes.thumbnail` to nullable so a cover can really be cleared | `thumbnail` is `text NOT NULL` (`db/schema/tables.ts:103`) and both editors write `url ?? prev.thumbnail`, so "remove cover" deleted the R2 object, changed no state, persisted nothing, and left the DB pointing at a deleted file. Approved by the user on 2026-10-17; relaxing a constraint is non-destructive | No removal (replace-only cover); storing a bundled placeholder URL to satisfy the constraint |
| D12 | Add a read-only diagnostic script that reports cafes whose image URLs 404 on the CDN | Existing broken references need to be found and repaired by a human; the script must not write | Skipping remediation and fixing only going forward |

**Assumptions (confirmed by the user on 2026-10-17 unless noted):** badge stamps are downscaled to a 512 px long edge while staying PNG; gallery is capped at 12 images per cafe; debounce for image auto-save is 600 ms; upload concurrency is 3; the cover cropper still opens only when the image is not already 16:9; `thumbnail` becomes nullable (D11) and a `null` cover is a legitimate state that renders a placeholder.

---

## 4. Architecture: units and interfaces

Six units. Each has one job, a narrow interface, and can be tested without the others.

### 4.1 `components/ui/SegmentedTabs.tsx` (presentational)

```ts
export interface SegmentedTabItem {
    id: string
    label: string
    icon?: LucideIcon
    badge?: string | number   // count badge, e.g. pending 12
    dirty?: boolean           // unsaved-changes dot
    disabled?: boolean
}
export interface SegmentedTabsProps {
    items: SegmentedTabItem[]
    value: string
    onChange: (id: string) => void
    ariaLabel: string
    size?: "sm" | "md"
    sticky?: boolean
    className?: string
}
```

Responsibilities: pill markup and tokens (`bg-accent/20 text-accent border-accent/30` active, `bg-text/5 border-text/10` idle, matching the current admin bar), horizontal overflow with a scroll affordance, `role="tablist"`/`role="tab"`/`aria-selected`, roving tabindex with Left/Right/Home/End. Not responsible for: section content, routing, data, persistence.

### 4.2 `components/cafe-editor/EditorShell.tsx` (presentational)

```ts
export interface EditorSaveState {
    dirty: boolean
    saving: boolean
    lastSavedAt: Date | null
    error: string | null
}
export interface EditorShellProps {
    header: ReactNode            // usually <EditorHeader/>
    tabs: SegmentedTabItem[]
    activeSection: string
    onSectionChange: (id: string) => void
    saveState: EditorSaveState
    onSave: () => void | Promise<void>
    onDiscard: () => void
    discardDisabled?: boolean
    children: ReactNode          // active section
}
```

Responsibilities: sticky tab strip (delegating to `SegmentedTabs`), the active section container with a reserved min-height and per-section scroll memory, and the sticky action bar showing one of `All changes saved · {relative time}` / `{n} unsaved changes` / `Saving…` / an error message with Retry, plus Save and Discard. Not responsible for: fetching, actions, auth, or knowing what a "cafe" is.

### 4.3 `hooks/useUnsavedChanges.ts`

```ts
export function useUnsavedChanges(dirty: boolean): {
    confirmIfDirty: () => Promise<boolean>   // true = safe to navigate
    beforeUnloadHandler: (e: BeforeUnloadEvent) => void
}
```

Registers `beforeunload` while `dirty`. `confirmIfDirty()` is awaited by the editors' own navigation handlers (Back to list, Preview) — this is deliberately explicit rather than a global anchor interceptor, so behaviour stays predictable.

### 4.4 `hooks/useImageUploadQueue.ts`

```ts
export type UploadStatus = "compressing" | "uploading" | "done" | "error"
export interface UploadItem {
    id: string
    fileName: string
    previewUrl: string        // object URL, revoked on removal
    status: UploadStatus
    progress: number          // 0-100, meaningful while uploading
    error?: string
    url?: string              // resulting public URL when done
}
export function useImageUploadQueue(opts: {
    cafeId?: string
    purpose: ImagePurpose
    concurrency?: number             // default 3
    compress?: typeof compressImageFor   // injectable for tests
    upload?: (file: File, onProgress: (p: number) => void) => Promise<ClientUploadResult>
    onComplete?: (item: UploadItem) => void
}): {
    items: UploadItem[]
    enqueue: (files: File[]) => void
    retry: (id: string) => void
    dismiss: (id: string) => void
    clearCompleted: () => void
    isBusy: boolean
}
```

Responsibilities: per-file lifecycle, compression before upload, progress via the existing XHR helper, retry/dismiss, concurrency limit, object-URL lifecycle, and rejecting obviously invalid files (type/size) before they enter the queue with a readable reason. Not responsible for: persistence.

### 4.5 `hooks/useCafeImages.ts`

```ts
export function useCafeImages(opts: {
    cafeId: string
    initial: { thumbnail: string | null; gallery: string[] }
    save: (patch: Partial<{ thumbnail: string | null; gallery: string[] }>) => Promise<ActionResult>
    removeFile: (url: string) => Promise<ActionResult>
    debounceMs?: number           // default 600
    maxGallery?: number           // default 12
}): {
    thumbnail: string | null
    gallery: string[]
    setThumbnail: (url: string | null) => void
    appendGallery: (urls: string[]) => void
    removeGalleryAt: (index: number) => Promise<void>
    moveGallery: (from: number, to: number) => void
    saveState: EditorSaveState
    retrySave: () => void
}
```

Responsibilities: the single owner of image state; debounced, **single-flight** saves (a change during an in-flight save marks pending and re-saves after); the ordering rule (persist first, delete storage only after success); rollback with a toast when a save or delete fails; the gallery cap. Not responsible for: uploading (queue) or rendering.

`moveGallery(from, to)` is the primitive; `ImageSection`'s existing left/right buttons and drag handler translate into it (`moveArrayItem` from `utils/hooks/cafe-form.ts` becomes a thin wrapper or is replaced), so the drag-to-reorder and button-reorder behaviours both keep working.

### 4.6 `utils/image-processing.ts` (extended) and `components/ui/ConfirmDialog.tsx` + `useConfirm()`

- `ImagePurpose = "cafe-cover" | "cafe-gallery" | "cafe-badge-stamp" | "menu-photo" | "review" | "blog-cover" | "event-cover" | "collection-cover" | "avatar"` with `compressImageFor(purpose, file): Promise<File>` implemented over the existing functions, plus a new `compressBadgeStamp` (PNG, long edge ≤512 px, transparency preserved, ≤500 KB) and the fix to `useCoverImageUpload` so the already-16:9 path compresses too.
- `ConfirmDialog` is a promise-based confirm (title, description, destructive variant, Esc, focus trap, returns boolean) and `useConfirm()` exposes `await confirm({...})`. It replaces direct `confirm()` in the surfaces this PR touches.

---

## 5. Data flow: images

**Add (gallery):** `enqueue(files)` → per file: validate → `compressImageFor("cafe-gallery", file)` → XHR upload to `/api/storage/upload` with progress → tile flips to `done` → `appendGallery([url])` → `useCafeImages` marks dirty and starts/extends the 600 ms debounce → `save({gallery})` → `revalidatePath` → state shows "All changes saved".

**Replace (cover):** cropper (only when not already 16:9) → queue with `purpose: "cafe-cover"` → `setThumbnail(newUrl)` → debounced `save({thumbnail})` → **on success** delete the previous storage object → on failure, toast and keep the previous URL so nothing is orphaned in the DB.

**Remove:** `removeGalleryAt(i)` → optimistic removal from state → `save({gallery})` → on success `removeFile(url)`; on failure restore the URL at its index and toast. A storage-delete failure is a warning only (the DB no longer references the file) and remains covered by the existing `cleanupOrphanedImages` sweep (`utils/storage/actions.ts`, admin wrapper `admin.ts:1631`).

**Reorder:** reorder local state → debounced `save({gallery})`. No storage work.

**Race control:** at most one in-flight `save`. A patch that arrives during a save is merged and re-sent after it resolves. Because the patch only ever contains `{thumbnail, gallery}`, it cannot clobber other sections.

**Cap:** the gallery append is refused with a toast beyond `maxGallery`, and the server enforces the same limit.

---

## 6. Server changes (no database migration)

### 6.1 New server actions

```ts
// app/api/actions/admin.ts  (admin or moderator)
export async function updateCafeImages(
    cafeId: string,
    patch: { thumbnail?: string | null; gallery?: string[] }
): Promise<AdminActionResult>

// app/api/actions/owner.ts  (ownership-checked via isOwnerOfCafe)
export async function updateCafeImagesAsOwner(
    cafeId: string,
    patch: { thumbnail?: string | null; gallery?: string[] }
): Promise<OwnerActionResult>
```

Both: zod-validate the patch (`gallery` ≤ 12 entries, every URL matching the public cafe-asset shape and pointing at the `cafes` bucket), update only `thumbnail`/`gallery` + `updatedAt`, `revalidatePath` for `/manage/preview/[id]`, `/owner/cafes/[slug]/edit`, `/cafes/[slug]`, and audit-log through `logSystemAction` using the **cafe id** as `entity_id` (the pattern established by the `adminDeleteCafeImage` fix; `system_logs.entity_id` is a `uuid`, `db/schema/tables.ts:763`).

`revalidatePath` is also added to the existing `updateCafe` (`admin.ts:836`) and `updateCafeAsOwner` (`owner.ts:260`), which are missing it today (`owner.ts` already uses it elsewhere, e.g. :1215).

### 6.2 Storage validation

- `utils/storage/types.ts`: add `allowedMimeTypes` to `BUCKET_CONFIGS` for every image bucket (`image/jpeg`, `image/png`, `image/webp`, `image/avif`), keep `badges` PNG-only, add `application/pdf` to ownership proofs, and add an optional `maxFiles` used by the gallery cap.
- `utils/storage/helpers.ts`: in `validateFile`, keep the existing size/extension/MIME checks and add a magic-byte sniff for image buckets so a renamed non-image is rejected; return the same `{valid, error}` shape.
- `app/api/storage/upload/route.ts` and the per-bucket server actions already call `validateFile`, so the new configuration takes effect for every path without new call sites.

### 6.3 OCR / AI

- `app/api/ocr/stream/route.ts`: delete the local `normalizeBaseUrl` (:21) and import the shared one from `@/utils/ai/openai-compatible`; the request URL (:86) then matches the working non-streaming path.
- Surface the upstream cause in the 502 body and the server log: upstream status, status text, and a truncated sanitized upstream message (never echo the API key or the request body).
- Derive the data-URL MIME from the actual compressed blob type instead of hard-coding `image/jpeg`, and keep `detail: "low"` (cost and latency), so the declared mime type, the actual bytes, and the request are consistent.
- De-duplicate: move the menu-extraction system prompt and a reusable SSE `streamChatCompletion()` helper into `utils/ai/openai-compatible.ts`, consumed by both the streaming route and `extractMenuItemsFromImage` (`utils/ai/menu-ocr.ts:101`). The prompt is currently copy-pasted in two files (`menu-ocr.ts:80-100`, `route.ts:28-50`).
- Distinguish "no items detected" from a failure in `components/suggestions/MenuOcrScanModal.tsx` and `utils/ocr-stream-client.ts` copy.

### 6.4 Migration: nullable cafe cover

`cafes.thumbnail` (`db/schema/tables.ts:103`) drops `notNull()` and the schema becomes `thumbnail: text("thumbnail")`. SQL: `ALTER TABLE "cafes" ALTER COLUMN "thumbnail" DROP NOT NULL;` — a constraint relaxation, not a data change, generated with `bun db:generate` and applied to production by a human with `bun db:migrate`.

Code that must follow the type change: the `thumbnail` field in the `updateCafe` (`admin.ts:874`) and `updateCafeAsOwner` (`owner.ts:263`) update types become `string | null`; the `cafe.thumbnail ?? ''` fallbacks (`admin.ts:1824,1941`) keep working; `ImageSection` already accepts `thumbnail: string | null`. A `null` cover renders the existing placeholder path in the cafe card and hero rather than a broken `<img>`.

---

## 7. UX specification

- **Tab strip:** segmented pills, sticky under the page header; horizontal scroll with edge fade and arrow buttons on narrow screens; each tab may carry a count badge (listing/hub) or a dirty dot (editors).
- **Action bar:** sticky at the bottom on all breakpoints, always visible: state text on the left, `Discard` and `Save changes` on the right, `Saving…` with a spinner while in flight, and a Retry affordance on error.
- **Upload tiles:** in-flight files appear in the gallery grid (cover appears in the cover slot) as a tile with a name label, a progress ring/bar, and Cancel; failures become a red tile with Retry and Dismiss.
- **Feedback:** toasts for success and failure; `ConfirmDialog` for destructive actions (remove image, delete cafe, delete story, unpublish).
- **Unsaved-changes:** `beforeunload` while dirty, plus a confirm dialog when leaving via Back/Preview with pending non-image edits.
- **Loading and empty:** skeletons for the listing/hub tab bodies and editors on first paint; a real empty state (icon + sentence + primary action) instead of "No results" blocks.
- **Header:** `EditorHeader` on both sides — cafe name, status chips (Published / Pending / Verified), and a quick-action slot (admin: approve/unpublish/preview; owner: preview).
- **Mobile:** single-column collapse verified per section, tap targets ≥44 px, tab strip scrolls rather than wrapping.
- **Accessibility:** from `SegmentedTabs` and `ConfirmDialog` — roles, `aria-selected`, roving tabindex, arrow/Home/End keys, visible focus rings, Esc to close.
- **Shared form primitives:** `SectionCard`, `TextField`, `SelectField`, `ToggleRow`, `FormGrid` adopted in the sections this PR already touches (Basic, Contact, Location, Images); remaining sections migrate opportunistically later.

---

## 8. Bugs fixed in this PR

| # | Bug | Location | Fix |
|---|---|---|---|
| B1 | Owner cover/gallery edits never persisted while old files were deleted (data loss) | `components/owner/CafeEdit.tsx:98-147`, `app/api/actions/owner.ts:260-305` | `useCafeImages` + `updateCafeImagesAsOwner`; owner save payload no longer needs to carry images |
| B2 | Old cover deleted from storage before the DB recorded the new URL | `utils/hooks/useCoverImageUpload.ts` `onDelete` path | Persist first, delete after success; rollback on failure |
| B3 | `adminDeleteCafeImage` 500 — image URL logged as a `uuid` `entity_id` | `app/api/actions/admin.ts:1076`, `app/api/actions/system-logs.ts:60` | Already patched in the working tree (cafe id as `entity_id`, URL kept in metadata; `logSystemAction` hardened so logging cannot fail an action) |
| B4 | Scan Menu always fails with 502 | `app/api/ocr/stream/route.ts:21,86` | Use the shared `normalizeBaseUrl`; surface upstream cause; correct data-URL MIME |
| B5 | Raw (uncompressed) upload when the cover is already 16:9 | `utils/hooks/useCoverImageUpload.ts:87` | Compress before upload |
| B6 | Badge stamps uploaded as raw PNG with only a size check | `ImageSection.tsx` badge path, `client.ts` | `compressBadgeStamp` (≤512 px, PNG kept) |
| B7 | No `revalidatePath` after cafe updates, so listing/preview go stale | `admin.ts:836`, `owner.ts:260` | Add revalidation to both |
| B8 | Admin uses `alert()`/`confirm()` while owner uses toasts | `CafeEditor.tsx:224,238` and others | Toasts + `ConfirmDialog` |
| B9 | "Remove cover" deletes the R2 object, is a no-op in state, and never persists — leaving the DB pointing at a deleted file (this is the flow that surfaced B3) | `components/cafe-editor/ImageSection.tsx` `handleRemoveCover`, `CafeEditor.tsx:712`, `CafeEdit.tsx` `onThumbnailChange` | Nullable `thumbnail` (D11) + `useCafeImages`: clear in state, save, delete the object only after the save succeeds |
| B10 | Both editors coerce `url ?? prev.thumbnail`, so a `null` cover can never be represented | `CafeEditor.tsx:712`, `components/owner/CafeEdit.tsx` | Replace the coercion with the `useCafeImages` setter, which accepts `null` |

---

## 9. Testing

Unit tests (bun + JSDOM, colocated `__tests__/`):

| Test file | Asserts |
|---|---|
| `hooks/__tests__/useImageUploadQueue.test.ts` | concurrency limit respected; per-file progress propagates; failed file can be retried and then succeeds; dismiss removes the item and revokes the object URL; invalid type/size rejected before upload with a message; injected fake compressor/uploader means no network |
| `hooks/__tests__/useCafeImages.test.ts` | debounce coalesces bursts; **save happens before any storage delete**; a failed save restores the previous URLs and deletes nothing; single-flight re-sends a merged patch; gallery cap enforced with a toast; reorder persists |
| `components/ui/__tests__/SegmentedTabs.test.tsx` | `role`/`aria-selected` correctness; arrow/Home/End keyboard navigation; badge and dirty dot rendering; disabled tabs skipped |
| `components/ui/__tests__/ConfirmDialog.test.tsx` | resolves true/false; Esc cancels; destructive variant styling; focus moves into the dialog and returns |
| `utils/__tests__/storage-validation.test.ts` (new) and `utils/__tests__/storage-badges.test.ts` (extend) | MIME rejection per bucket; renamed non-image rejected by the magic-byte sniff; badge PNG-only and downscale rule; oversize rejected; PDF allowed for ownership proofs |
| `app/api/ocr/stream/__tests__/route.test.ts` (new) | mocked `fetch` receives **exactly one** `/v1` segment when the base URL ends in `/v1`; a 404 upstream produces a 502 whose body carries the upstream status; a valid SSE body streams tokens and completes |
| `utils/ai/__tests__/menu-ocr.test.ts` (extend) | `streamChatCompletion` and `extractMenuItemsFromImage` share the same prompt and parser output |
| `utils/__tests__/ocr-stream-client.test.ts` (extend) | the upstream error text reaches `onError`, and an empty item list is reported as "no items detected" rather than an error |
| `app/api/actions/__tests__/cafe-images.test.ts` (new) | non-owner/non-moderator rejected; unknown-host or non-`cafes` URL rejected; gallery > 12 rejected; a `null` thumbnail is accepted; `revalidatePath` called; audit log receives the cafe id |
| `scripts/__tests__/report-broken-cafe-images.test.ts` (new) | the URL-collection helper returns only `cdn.grounds.ph` assets and de-duplicates; HEAD failures are reported as broken and a 200 is not |
| `components/manage/__tests__/CafeEditor.test.tsx`, `components/owner/__tests__/CafeEdit.test.tsx` (extend) | editors render the shell and tabs; dirty state drives the action bar; owner editor no longer depends on the main Save for images |

Manual QA (against `bun dev`, both roles, not committed as tests): drop 5 gallery images and watch tiles, progress, and the "saved" state; force a failure (kill the network mid-upload) and confirm Retry; replace a cover and confirm the old object is gone from storage only after the DB update; remove an image and confirm removal survives reload; navigate away with dirty non-image edits and confirm the warning; run a real Scan Menu against the configured OpenRouter base; check the four surfaces at 375 px width.

Existing suite must stay at its current baseline (919 pass / 17 pre-existing failures, unrelated to this work).

---

## 10. Sequencing

One branch, one PR, eight reviewable commits:

1. `feat(ui): add SegmentedTabs, EditorShell, ConfirmDialog primitives` — units 4.1, 4.2, 4.6-confirm + their tests. No behaviour change yet.
2. `fix(ai): use shared base-URL normalizer and surface upstream OCR errors` — B4, the shared prompt, the mime fix, plus the OCR tests. Independently shippable; unblocks Scan Menu.
3. `fix(storage): enforce per-bucket MIME and sniff image content` — 6.2, the async `validateFile`, `maxFiles`.
4. `feat(storage): add the image purpose compression pipeline` — `compressImageFor`, `compressBadgeStamp`, B5, B6.
5. `feat(cafe): allow clearing the cover image (nullable thumbnail)` — 6.4, the drizzle schema change, the generated migration, the update-type follow-ups, B10.
6. `feat(cafe): auto-save images via updateCafeImages actions` — 6.1, `useCafeImages`, `useImageUploadQueue`, `ImageSection` rewiring, B1, B2, B7, B9, plus the action tests.
7. `chore(scripts): report cafes with unreachable image URLs` — D12, the read-only diagnostic script and its test.
8. `refactor(manage,owner): adopt editor shell, tabs and toasts` and `feat(manage,owner): segmented tabs, skeletons and polish on listing and hub` — Plan B: the admin/owner editor adoption (B8), `EditorHeader`, shared form primitives, unsaved-changes guard, then the listing/hub tab strip with count badges, skeletons, empty states and mobile polish.

Each commit must leave `bun lint`, `bunx tsc --noEmit`, and `bun test` green.

---

## 11. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Sticky bar + `AnimatePresence` causes layout jump / scroll loss | Reserve min-height on the section container; store and restore scroll per section; verify at 375 px and 1440 px |
| Auto-save races with the main Save on other sections | Image patches are separate actions containing only `{thumbnail, gallery}`; single-flight queue with merged pending patch |
| Two editors drift again | Shared `EditorShell` + `SegmentedTabs` + `useCafeImages`; the editors keep only data ownership, not layout |
| Large diff on a hot code path (cafe editing) | Commit-by-commit review; editors adopted one at a time; manual QA checklist per side |
| Removing the old cover only after save could orphan a file if the process dies between save and delete | The existing `cleanupOrphanedImages` sweep covers it; deletion failure is a warning, not an error |
| OCR de-duplication touches a working path (`extractMenuItemsFromImage`) | Behaviour-preserving extraction covered by the extended `menu-ocr.test.ts`, shipped as its own commit |

---

## 12. Rollout and verification

One migration is included: relaxing `cafes.thumbnail` to nullable (D11, explicitly approved by the user on 2026-10-17). It is a non-destructive constraint relaxation with no data rewrite, authored with `bun db:generate` and applied to production by a human via `bun db:migrate` — the agent must not run it against production. Flow: feature branch off `prod` (with B3 already applied) → Gitea PR against `prod` → squash-merge → delete the branch locally and on the remote → `git checkout prod && git merge --ff-only origin/prod && git push github prod` so Dokploy rebuilds. Rollback of the code is a revert of the squashed commit; the migration's rollback is `ALTER TABLE "cafes" ALTER COLUMN "thumbnail" SET NOT NULL`, which is only valid while no row has a null cover.

---

## 13. Resolved decisions and remaining questions

Resolved on 2026-10-17:

1. Defaults confirmed: badge 512 px long edge, gallery cap 12, 600 ms debounce, concurrency 3.
2. The cover cropper keeps today's behaviour (opens only when the image is not already 16:9).
3. `app/manage/preview/[id]/page.tsx:29` already redirects when the cafe does not exist, but it redirects to `/admin`, which is not a route in this app (`app/` has `manage`, `owner`, `profile`, no `admin`). The target changes to `/manage/cafes`.
4. Clearing a cover is supported through a nullable `thumbnail` column (D11), and a read-only script reports existing cafes with unreachable image URLs (D12).

Remaining questions: none blocking.
