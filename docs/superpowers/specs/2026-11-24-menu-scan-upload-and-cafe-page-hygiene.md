# Menu Scan Upload on Mobile, and Cafe Page Hygiene

**Baseline:** f30a83eca1d65cb4cde5baa5b18507c385f92330   **Branch:** fix/menu-scan-upload   **Date:** 2026-11-24

## Problem Statement

On a phone, tapping "Scan Menu" opens the camera and nothing else. There is no way to
pick a menu photo that is already in the gallery, so a visitor who photographed a menu
yesterday, or who was sent one, cannot use the feature at all. The tile's own copy —
"Tap to take a photo or select an image" — promises a choice the code does not offer.

Auditing the surface around that button turned up further problems that make the feature
untrustworthy even when it works:

- After a failed scan, choosing the *same* photo again does nothing on iOS Safari.
- Every scan leaks the preview blob it created; a few retries on a low-memory phone
  accumulate them.
- The tile promises "JPG, PNG up to 10MB" and validates neither.
- Scans are compressed to 1024 px before OCR, which erases the small type that dense
  menus are made of — the feature is quietly worst at exactly the menus people photograph.
- A logged-in stranger can bulk-write items straight into a cafe's live menu, while
  changing a single price by hand waits in a review queue. The queue exists and the
  highest-volume write path bypasses it.
- Anonymous visitors see no Scan Menu button at all, unlike every neighbouring
  contribution affordance.
- After a scan is saved, the public cafe page keeps serving the old menu, because the
  save revalidates a path that matches no route.
- Cafe owners see no edit affordance on their own cafe's public page.
- The cafe route segment has no 404 or error boundary; unpublished cafes and nonexistent
  ones are handled by hand-rolled inline markup.

## Solution

Tapping Scan Menu offers two named choices — **Take photo** and **Upload from device** —
on every device, with no user-agent sniffing and no custom camera UI. Whichever path a
visitor takes, the photo is checked against what the tile promises (type and size) before
anything is compressed, and it is compressed to a resolution that keeps a menu legible.

Saving a scan is trusted by role. A cafe's owner and admins transcribe straight into the
menu. Everyone else's scan becomes a reviewable **Menu scan batch**: one decision an
admin makes once, in the queue that already exists, rather than forty.

Anonymous visitors see the button and are sent to log in, matching Suggest an Edit and
Log an Item. Owners get an edit affordance on their own public page. The cafe route gains
a real 404 and a recoverable error boundary.

## User Stories

1. As a visitor on an Android phone, I want to upload a menu photo I already have, so that
   I can contribute a menu I photographed earlier.
2. As a visitor on an iPhone, I want the gallery option to be a visible, named choice
   rather than something hidden behind a sheet that only offers the camera, so that I do
   not conclude the feature is broken.
3. As a visitor on a desktop browser, I want the same two choices so that behaviour does
   not change shape depending on the device.
4. As a visitor whose first scan failed, I want to retry with the same photo and have the
   scan actually start, so that a transient model failure costs me one tap.
5. As a visitor, I want to be told in plain words when my photo is too large or the wrong
   format, so that I can fix it rather than watch a scan fail.
6. As a visitor, I want the tile's stated limits to be the limits the app enforces, so
   that I can trust what I read on screen.
7. As a visitor scanning a dense drinks menu, I want the transcription to actually read
   the prices, so that the review step is a check rather than a rewrite.
8. As a visitor, I want repeated scans not to degrade my phone's memory, so that the tool
   keeps working after a few attempts.
9. As an anonymous visitor on a cafe page, I want to see that menu scanning exists and be
   told to log in, so that I understand the feature needs an account instead of assuming
   the cafe has no scanning.
10. As an anonymous visitor who taps it, I want to land on the login page and come back to
    this cafe afterwards, so that logging in does not lose my place.
11. As a logged-in visitor who is not the cafe's owner, I want my scan to be submitted for
    review, so that a misread price cannot reach the public menu on my word alone.
12. As a logged-in visitor submitting a scan, I want a clear confirmation that my scan is
    under review, so that I do not think the save silently failed.
13. As a cafe owner, I want my own scan to write straight into the menu, so that
    maintaining my listing is fast.
14. As a cafe owner, I want to see the correct item count and a link to the menu after
    saving, so that I can verify the result.
15. As an admin, I want a whole scan to appear as one reviewable batch, so that approving a
    forty-item scan is one decision, not forty.
16. As an admin, I want to approve a batch and have all its items appear together, or none
    at all, so that a half-applied batch never goes live.
17. As an admin, I want a rejected batch to leave the menu untouched, so that rejection is
    safe.
18. As an admin, I want approving the same batch twice to be refused rather than to
    duplicate the menu, so that a double tap is harmless.
19. As an admin, I want an empty queue to say so, so that I know there is nothing waiting
    rather than suspecting a load failure.20. As an admin reviewing existing single-item community suggestions, I want them to look
    and behave exactly as they do today, so that the batch feature does not disturb a
    workflow already in use.
21. As a cafe owner viewing my cafe's public page, I want to see an Edit affordance, so
    that I do not have to remember a URL to maintain my listing.
22. As an admin or moderator, I want my Edit affordance to keep pointing at the
    moderation preview, so that my review tools are unchanged.
23. As a moderator restricted to certain regions, I want no edit affordance outside my
    regions, so that the scoping I was given holds.
24. As a visitor, I want a cafe that does not exist or is not published to return a real
    404, so that the response is correct for search engines and link checkers.
25. As a visitor, I want that 404 to be indistinguishable for unpublished and nonexistent
    cafes, so that a hidden listing cannot be discovered by probing URLs.
26. As a visitor hitting an unexpected server error on a cafe page, I want a recoverable
    error screen with a way to retry, so that one failed query does not dump me out of the
    site.
27. As a visitor, I want the cafe page to show the menu that was just saved, so that I am
    not looking at a stale page after contributing.
28. As a maintainer, I want one revalidation helper that builds cafe paths, so that the
    `/cafe/<id>` defect cannot quietly return.
29. As a maintainer, I want every authorization decision asserted server-side, so that
    hiding a button is never the only thing standing between a stranger and a cafe's data.
30. As a maintainer, I want the menu write paths to share one trust rule, so that adding a
    future write path does not reopen the moderation gap.

## Constraints & Non-Negotiables

- **Server-side authorization only.** Hiding the Scan Menu button, or hiding Save, is
  presentation. The role check lives in the write path, and ownership is re-derived from
  the database — never from a client-supplied flag or the caller's word.
- **No user-agent sniffing, no `getUserMedia`, no custom camera UI.** Two labelled targets
  are the whole mechanism.
- **Additive schema change only.** One nullable column. No `DROP`, no `TRUNCATE`, no
  backfill, no rename. Prod is live.
- **Batch approval is atomic and idempotent.** Item rows and batch status change together,
  and a batch that is no longer pending cannot be approved again.
- **Preserve the unpublished-equals-nonexistent rule.** The new 404 must not reveal a
  cafe's name, and unpublished cafes must not become reachable.
- **Do not add a `loading.tsx` to the cafe route segment.** The page preloads its hero
  image for LCP; a route-level fallback would delay the asset being preloaded.
- **Existing single-item suggestion behaviour is frozen.** Its queue rows, approvals and
  rejections must be unaffected by the batch feature.
- **Test discipline.** `bun run test` and `TZ=UTC bun run test` both, because there is no
  CI and the database runs UTC while developers do not.

## Boundaries

**In scope**

- The mobile photo affordance in the menu scan modal, for all four entry points (cafe
  details page, menu sub-page, owner menu editor, new-cafe submission form).
- Client-side validation matching the tile's stated limits.
- The scan image compression budget.
- Input-value reset and preview-blob cleanup.
- Role-based trust for menu writes, and the batch review path for community scans.
- Anonymous access to the Scan Menu affordance.
- The `/cafe/` revalidation defect in the menu save path and in the cafe report path.
- Owners' edit affordance on their cafe's public page.
- 404 and error boundaries for the cafe route segment.

**Out of scope**

- Per-item menu photos for community contributors. The public suggestion path strips
  images deliberately; changing that is a separate trust question.
- Adding `loading.tsx`.
- Any redesign of the scan modal's review step, item fields, or OCR prompt.
- OCR accuracy work beyond the resolution budget: no prompt changes, no model changes, no
  evaluation harness.
- Any cap on items per scan.
- Per-item accept/reject *within* a batch, and any partial-batch review.
- The new-cafe submission flow's review behaviour, which already reviews the whole cafe.
- The duplicated scan-button call sites on the cafe page; their placement is unchanged.

## Implementation Decisions

**Affordance.** The scan modal's single hidden file input becomes two labelled targets: one
carrying `capture="environment"` labelled Take photo, one carrying no `capture` labelled
Upload from device. Both feed the identical selection handler, so validation, compression
and streaming are unchanged by which target was used.

**Validation.** Before compression, the selection handler rejects a file whose type is not
one of the formats the app offers, or whose size exceeds the tile's stated 10 MB, surfacing
a human-readable message on the upload step. The offered and enforced set is exactly what
the tile copy lists — JPEG, PNG and WebP — so the promise on screen and the behaviour
agree. The route keeps its wider accepted set; being tolerant server-side costs nothing and
means a future client change is not blocked by it. The rejected-file path must leave the
input usable — the value is cleared on every selection outcome so that choosing the same
file twice in a row fires the change handler both times.

**Compression budget.** The scan path compresses to a 1600 px long edge and a 1.5 MB
target. The compression is a named, exported constant rather than a literal at the call
site, so the number is assertable and the tile copy can be checked against it.

**Preview lifetime.** The preview object URL is revoked when the modal resets and when the
component unmounts, alongside clearing the preview state.

**Anonymous affordance.** The Scan Menu button renders for everyone. When there is no
session, it is a link to the login page carrying the current cafe as the return path,
matching the two sibling affordances on the page. The modal never opens without a session.

**Trust rule.** One server-side predicate answers "may this caller write this cafe's menu
directly?" and returns true only for the cafe's owner (via the existing ownership lookup
against the cafe's owner list) and for admins. Moderators do not gain this by virtue of
being moderators; they keep their existing moderation powers, which are a different
question.

**Community path.** A scan from anyone else writes a **Menu scan batch**: the extracted
items become ordinary Menu suggestions, one row each, all sharing a newly assigned batch
id. The response tells the caller the scan is under review rather than saved, and the
modal's success step shows that wording.

**Batch review.** The suggestion queue gains batch awareness: suggestions sharing a batch
id are presented together with a scan's total, and can be approved or rejected as one
action. Suggestions with no batch id render exactly as today.

A batch's state is derived from its own rows; it is pending while any of them is pending.
Approval acts only on the rows still pending, inside a database transaction that verifies
at least one pending row exists, inserts every item in one statement, and marks those rows
approved. A second approval therefore finds nothing pending and is refused, so a double tap
cannot duplicate a menu. Rejection marks the pending rows rejected and touches no menu
items. Both actions keep the existing admin-or-moderator gate.

The price-level recalculation and revalidation are not part of the transaction — they read
committed state and call framework caches, both of which are wrong to hold open — and run
immediately after it commits. If they fail, the menu is correct and only a cached page is
stale.

After either action the queue list reflects the change without a reload, and falls back to
the existing empty state when nothing pending remains. That empty state is preserved, not
rebuilt.

**Revalidation.** A single helper turns a cafe id (and slug, when known) into the two paths
that exist, `/cafes/<slug>` and `/cafes/<slug>/menu`, and is the only thing the menu save,
the batch approval and the cafe report paths call. The current `/cafe/<id>` and
`/cafe/<id>/menu` strings are removed rather than corrected in place, so a new write path
cannot copy the wrong shape.

**Edit permission.** The cafe edit permission lookup gains an owner role. It returns the
owner role for the cafe's owner, keeps admin and region-scoped moderator as they are, and
returns nothing for anonymous visitors and out-of-region moderators. The edit banner
renders the owner's link to the owner editor and everyone else's link to the moderation
preview.

**Cafe route boundaries.** The route segment gains a not-found boundary that renders a
neutral "no such cafe" page — no cafe name, no distinguishing copy for unpublished versus
nonexistent — and an error boundary with a retry affordance. The page's inline 404 markup
is removed in favour of the boundary so that response status and metadata are correct.

**Batching of the work.** The spec is delivered as two sequential pull requests off `prod`,
merged in order: upload and OCR reliability first, cafe page hygiene second. They touch
disjoint modules and neither depends on the other's code, only on its presence on `prod`.

> **Delivery note (retrospective).** As delivered this was **one** pull request, not two:
> all eight tickets landed on `fix/menu-scan-upload` and squash-merged to `prod` as
> `6200c4b` (PR #38). `fix/cafe-details-hygiene` was never created. The module-disjointness
> claim above still holds — the two batches touch disjoint modules and neither depends on the
> other's code — but the PR-level split does not, which is why the rollback note below gives
> commit ranges rather than PRs as the revert unit.

## Testing Decisions

### Seams

**S1 — Menu scan modal, rendered.** Asserts the two targets exist with the intended
`capture` split; that an oversized or wrong-typed file is rejected before compression runs;
that the compression budget constant is the one passed to the compressor; and that a
second selection of the same file re-invokes the handler.
*Catches:* a regression that reintroduces camera-only behaviour, an unenforced limit, a
silent budget change, and the iOS no-op retry. *Misses:* whether a real handset offers the
gallery sheet, and real OCR accuracy at 1600 px. The first is covered by E2E; the second is
not covered at all and is accepted.

**S2 — OCR stream route.** Asserts that a payload at the raised budget is accepted and
reaches the model call, and that the MIME enum still rejects an unsupported type.
*Catches:* a size ceiling accidentally reintroduced, or the enum loosened.
*Misses:* anything about model output quality.

**S3 — Menu write actions.** The role matrix, asserted as behaviour: the cafe's owner
produces menu rows; an admin produces menu rows; an unrelated authenticated user produces
suggestion rows sharing one batch id and produces zero menu rows; an anonymous caller is
refused. Batch approval: all pending items appear, their rows are approved, and one
revalidation is requested; rejection adds no items; a second approval of the same batch is
refused with no duplicates; a batch with some rows already processed applies only what is
still pending rather than erroring.
*Catches:* the whole trust decision, the atomicity and idempotency risks, and any future
write path that forgets the rule. *Misses:* how the queue looks.

**S4 — Revalidation helper.** Given a cafe id and slug, returns exactly the two existing
paths, and never a `/cafe/`-shaped path. *Catches:* the defect in J returning through a new
call site. *Misses:* whether the framework actually re-fetched.

**S5 — Edit permission and banner.** The permission lookup returns the owner role and
`canEdit` for an owner, admin for an admin, nothing for an anonymous visitor, and nothing
for a moderator outside their regions. The banner renders the owner editor link for an
owner and the moderation preview link for staff.
*Catches:* the permission widening granting anyone who is not an owner, and the link
branch being wired to the wrong surface. *Misses:* real routing.

**S6 — Cafe route segment boundaries.** An unpublished cafe and a nonexistent one both
resolve through the not-found boundary, and the rendered output contains the cafe's name
in neither case. *Catches:* the leakage risk that would make hiding theatrical.
*Misses:* visual presentation.

### What makes a good test here

Assert observable outcomes at the seam, never the shape of the implementation: rows in the
database, the action's returned result, the rendered output. Expected values are written
independently of the code under test — a test that imports the budget constant and asserts
compression used it proves nothing; the number is written into the test. No mocking of
internal collaborators: the database is faked at the module boundary, as the existing
action tests already do, or exercised through the returned data. Authorization tests must
supply a caller, since the point is who may do what.

### Prior art

`app/api/ocr/stream/__tests__/route.test.ts` builds a real `Request` and calls the handler
directly with `@/lib/auth` and `@/db` mocked at the module boundary — the model for S2 and
S3. `app/api/actions/__tests__/menu-suggestions.test.ts` uses a hand-rolled in-memory store,
which is the right shape for S3's batch atomicity. `components/cafe-editor/__tests__/` shows
the render-and-assert pattern for S1 and S5.

Two anti-patterns present in the repo must not be extended: reading component source with
`Bun.file(...).text()` and substring-asserting it, and `expect(true).toBe(true)`
placeholders. They assert that code still looks a certain way rather than that it behaves.

### E2E — OPTED-IN

No automated browser suite exists and none is added. A written `agent-browser` playbook is
recorded under `docs/superpowers/e2e/`, at a mobile viewport, with screenshots, covering
exactly the flows no unit test can observe:

1. The scan modal shows both Take photo and Upload from device on a mobile viewport.
2. Upload from device opens a file chooser rather than a camera.
3. A chosen gallery image reaches the review step with extracted items.
4. An anonymous visit to a cafe page shows Scan Menu, and tapping it lands on the login
   page with the cafe as the return path.
5. A saved owner scan is visible on the cafe's menu page immediately, with no hard reload.

Flow 5 is the one that would have caught the revalidation defect, and flow 2 is the bug
this work exists for.

## Migration & Rollback

One migration adds a nullable batch-id column to the suggestion table. Nothing is
backfilled; every existing row keeps a null batch id and renders exactly as it does today.
The column is additive and its absence is not fatal to the application, so rollback is a
code revert with the column left in place — reverted code simply never reads it. Because
the column is nullable and unused by old code, the migration can land before, with, or
after the application change.

The two batches are independently revertable, though **not** as separate pull requests — there
was only one PR. Revert by commit range instead: reverting the upload/OCR batch restores
camera-only scanning but leaves the permission and route work intact; reverting the cafe page
hygiene batch touches no menu write path. Neither revert requires a schema change.

No destructive SQL. No rename, no drop, no data rewrite.

## Domain Model

`GLOSSARY.md` gains a **Menus** section defining **Menu**, **Menu item**, **Menu photo**,
**Menu scan**, **Menu scan batch** and **Menu suggestion**, each with its `_Avoid_` line,
plus a **Relationships** block and two flagged ambiguities resolved:

- "menu" meant both the itemised list and the photograph of it — now the **Menu** and the
  **Menu photo**.
- "scan" meant both the act and its output — now the **Menu scan** and the **Menu scan
  batch**.

`docs/adr/0003-menu-writes-are-trusted-by-role.md` records the trust split, why owners are
exempt from review, why the submission flow is unaffected, and the three rejected
alternatives.

## Open Questions

- **Per-item menu photos for community contributors.** The public suggestion path strips
  image data by design. Whether a reviewed batch may include photos is a trust question
  this spec deliberately leaves alone. Owner: product. Resolve before any work on community
  menu photos begins.
- **Partial-batch review.** Admins approve or reject a whole scan. If real queue usage
  shows scans that are mostly right with two wrong prices, per-item accept becomes
  worthwhile. Owner: whoever operates the queue. Resolve after the queue has seen real
  community scans.
- **OCR accuracy evaluation.** The resolution budget is raised on the reasoning that
  1024 px destroys small type, not on measured improvement. A small fixture set of real
  menu photos scored against expected items would turn that into a measurement. Owner:
  maintainer. Resolve if scan accuracy complaints persist.
- **`loading.tsx` for the cafe segment.** Deliberately excluded because of the hero image
  preload. If the route's server queries become slower than a blank frame is acceptable
  for, the LCP trade-off needs re-deciding rather than assuming.
- **Item cap per scan.** None is imposed. A pathological scan of several hundred items
  would create a large batch; a cap becomes worth adding if that occurs. Owner: maintainer.
- **Region scoping of the suggestion queue.** Found during this audit and deliberately left
  out of scope, because it is not part of the confirmed finding list and it affects the
  queue as it exists today, not only batches: the pending menu-suggestion query is gated on
  admin-or-moderator but not filtered by the moderator's regions, unlike cafe edit
  permission and the pending-cafe queues. Moderators therefore see menu suggestions for
  cafes outside their regions. This is pre-existing and needs its own decision about
  whether menu suggestions inherit region scoping at all. Owner: whoever owns moderation
  policy. Resolve before granting another moderator a scoped role.
