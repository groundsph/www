# Menu scan — `agent-browser` playbook

Recorded for the spec `docs/superpowers/specs/2026-11-24-menu-scan-upload-and-cafe-page-hygiene.md`
(E2E **OPTED-IN**). No automated browser suite is introduced; this is a written playbook with
screenshots, covering exactly the flows a unit test cannot observe.

- **Viewport:** 390 × 844 (mobile), device scale factor 1
- **Target:** `https://localhost:3000` (`bun dev`, self-signed cert accepted)
- **Database:** local `gph-dev` scratch database. Never run this against prod.
- **Recorded:** on `fix/menu-scan-upload` after `[review] Close out two-axis review findings`
- **Screenshots:** `docs/superpowers/e2e/screenshots/menu-scan-*.png`

## Fixtures

The dev database is empty, so the playbook seeds four accounts and one Cafe before running.
Accounts are created through the real auth API (`POST /api/auth/sign-up/email`), and the session
cookie is imported with `cookies set --curl`, because the email/password sign-in page is only
reachable over the https dev server.

| Thing | Value |
| --- | --- |
| Cafe | `E2E Kapehan`, slug `e2e-kapehan`, published, `owner_ids = [e2e-owner]` |
| Owner | `e2e-owner@example.test` (role `user`, listed in the Cafe's `owner_ids`) |
| Admin | `e2e-admin@example.test` (`profiles.role = admin`, `user.role = admin`) |
| Stranger | `e2e-stranger@example.test` (role `user`, owns nothing) |
| Starting menu | 2 items (`Existing House Blend` ₱120, `Existing Iced Latte` ₱150) |
| Dense menu image | `screenshots/menu-scan-dense-menu-fixture.png` — 1200 × 1700, 40 priced lines in two tight columns, 20 px type |

Re-running the playbook requires reseeding, because flow 5 writes 39 items into the menu.

---

## Flow 1 — The scan modal offers both choices on a mobile viewport

1. Sign in as `e2e-owner`.
2. Open `/cafes/e2e-kapehan/menu`.
3. Activate the header `Scan Menu` button.
4. Inspect the upload step.

**Expected:** two distinctly labelled targets — one that asks for the camera, one that does not —
and the tile's stated limits.

**Observed (pass).** Exactly two `input[type=file]` elements:

| Label | `capture` | `accept` |
| --- | --- | --- |
| `Take photo` | `environment` | `image/jpeg,image/png,image/webp` |
| `Upload from device` | *(absent)* | `image/jpeg,image/png,image/webp` |

Limits copy rendered: `JPEG, PNG, WebP up to 10 MB`. The accepted set and the copy agree, which is
the point of the ticket — the promise on screen is the set the app enforces.

Evidence: `screenshots/menu-scan-flow1-two-choices.png`.
## Flow 2 — Upload from device opens a file chooser, not a camera

Same modal as flow 1. The `Upload from device` target carries **no** `capture` attribute, so the
browser opens its ordinary file chooser; the `Take photo` target carries `capture="environment"`,
so a device that honours it opens the camera.

**Verified structurally, not by observing a native chooser sheet.** `agent-browser` sets files on
the input directly, so no OS chooser appears to photograph. Flow 3 below drives the
`Upload from device` input, which is only reachable because it is a plain file input.

## Flow 3 — A gallery image reaches review with its prices intact

1. From flow 1's modal, choose `Upload from device`.
2. Set `screenshots/menu-scan-dense-menu-fixture.png` on that input.
3. Wait for the stream to finish.

**Expected:** the review step, with the dense menu's small type transcribed and every price
populated.

**Observed (pass).** The route streamed item names as they were parsed, then settled on
**`Review 39 extracted items`** (40 offered, 1 duplicate skipped). The review form carried
**39 numeric price inputs, all non-zero**, matching the source image exactly:

```
90 120 110 130 150 145 165 135 170 180 320 190 160 170 210 250 120 175 165 190 …
```

This is the evidence for ticket 03's resolution-budget criterion. **It is one observation, not a controlled
comparison:** nothing here was run against the old 1024 px budget, so the document shows the prices
survive at the new budget, not that 1024 px would have lost them. That claim is the spec's stated
reasoning, not a measurement (see the spec's open question on OCR accuracy).

Evidence: `screenshots/menu-scan-flow3-review-prices.png`.

## Flow 4 — An anonymous visitor sees Scan Menu and reaches login with the Cafe as return

1. Clear cookies (or use a private context) and open `/cafes/e2e-kapehan`.
2. Read the scan affordance's tag and `href`.

**Observed (pass).**

```
Scan Menu  →  <a href="/auth?redirect=/cafes/e2e-kapehan">  "Scan Menu"
```

The affordance renders for everyone; for an anonymous visitor it is a link, and the return path
carries the Cafe's **slug**. The two sibling affordances on the same page behave the same way:

```
Suggest an Edit  →  /auth?redirect=/cafes/e2e-kapehan
Log an Item      →  /auth?redirect=/cafes/e1c2edc5-…
```

For contrast, the same element for a signed-in owner is a `<button>` with no `href`, and
activating it opens the modal in place rather than navigating.

One correction to that comparison: the sibling affordances share the *shape* of the login link, not
literally identical behaviour. `Log an Item` carries the Cafe **id** (`/auth?redirect=/cafes/e1c2edc5-…`)
while `Suggest an Edit` and `Scan Menu` carry the **slug**, and `getCafeBySlug` resolves slugs only.

**Limitation on this viewport:** the mobile Cafe page renders its sections behind an
About/Details/Menu/Reviews tab bar, and the scan affordance lives inside the hidden Menu panel
until a tab is selected. Synthetic pointer clicks on that tab bar did not switch panels in this
environment, so the mobile rendering was verified through the DOM (present with the correct
`href`) rather than by tapping through. The desktop rendering, where all sections are expanded,
exposed the same element as a normal visible link.

## Flow 5 — A saved owner scan is visible on the menu page immediately

This is the flow that catches the `/cafe/<id>` revalidation defect.

1. Signed in as the Cafe's owner, repeat flow 3 to reach review.
2. Activate `Save (39)`.
3. Read the confirmation step.
4. Follow `View menu`.
5. Count the items on the page.

**Observed (pass), server side:**

```
saveOcrMenuItems("e1c2edc5-…", [ …39 items… ]) in 81ms
cafe_menu_items: 2 → 41
menu_item_suggestions: 0        ← the owner wrote directly, no review batch
```

**Observed (pass), client side:**

```
"39 items added!"
"E2E Kapehan menu has been updated"
View menu → /cafes/e2e-kapehan/menu
```

Following that link renders **41 item headings**, including the scan's output (`Ube Latte` ₱190,
`Nitro Cold Brew` ₱210, `Espresso Doppio` ₱120), without a hard reload of the browser. The
owner-direct-save confirmation still reports the count and offers the way to the Cafe's Menu, and
the trust rule put the scan in the menu rather than in the review queue.

Evidence: `screenshots/menu-scan-flow5-menu-after-save.png`.

**Activation note.** `Save` was activated programmatically (`element.click()` from the page
context) rather than by a trusted pointer event. The modal's `z-50` container is trapped in a
lower stacking context by an animated ancestor on this page, so page controls above it win the
hit test at the button's coordinates even though the button itself is visible and enabled. Every
effect downstream of the handler — the server action call, the direct write, the revalidation, the
confirmation copy, the fresh menu — was exercised for real. The stacking-context trap is
pre-existing, not introduced by this work, and is not fixed here.

**What this flow does and does not prove.** It proves the owner path writes 39 items straight to the
menu, that the confirmation reports the count and offers the way onward, and that the menu rendered
afterwards contains all 41 items. It does **not** by itself discriminate the `/cafe/<id>` revalidation
defect: the menu sub-page was a route the browser had not cached, and a cold navigation fetches
fresh data whether or not `revalidatePath` names the right path. There was no control run against the
pre-fix code. The revalidation fix is therefore verified by its unit seam (S4, `utils/cafe-routes.ts`
asserting `/cafes/<slug>` and `/cafes/<slug>/menu`), with this flow as corroboration rather than proof.

## Flow 5b — The public Cafe page shows the saved menu (story 27)

1. After flow 5, open `/cafes/e2e-kapehan` (the public Cafe page, not the menu sub-page).
2. Read the menu section.

**Observed (pass).** The menu section lists scanned items — `Ube Latte`, `Pandan Latte`,
`Tablea Mocha` visible without scrolling — and `View Full Menu →` points at
`/cafes/e2e-kapehan/menu`. This is the surface story 27 actually names.

The same screenshot incidentally records ticket 07's owner affordance on the public page:
`Owner Access — You can edit E2E Kapehan — [Edit Cafe]`, i.e. the Cafe's owner is offered the owner
editor, which is ticket 07's criterion observed live rather than only unit-tested.

Evidence: `screenshots/menu-scan-flow5-public-cafe-page-after-save.png`.

---

## What this playbook does not cover

- Whether a real handset's gallery sheet appears; that needs a device.
- Measured OCR accuracy beyond this one synthetic menu. The spec records this as an open question,
  with a fixture set of real menu photographs as the proposed answer.
- The community path: a non-owner scan becoming one pending batch, and an admin approving it as a
  single decision. Both are covered by the action tests at seam S3, which is where the atomicity
  and idempotency properties actually live.
