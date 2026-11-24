# Menu Scan Upload and Cafe Page Hygiene

**Spec:** docs/superpowers/specs/2026-11-24-menu-scan-upload-and-cafe-page-hygiene.md
**Baseline:** f30a83eca1d65cb4cde5baa5b18507c385f92330
**Branch:** fix/menu-scan-upload
**Delivered:** one pull request, `fix/menu-scan-upload` → `prod` (PR #38, squash-merged as
`6200c4b`, 2026-11-24). All eight tickets landed together.
**Spec issue:** https://git.ranio.xyz/groundsph/www/issues/29

**Delivery note.** The plan below called for two sequential pull requests: tickets 01–06 on
`fix/menu-scan-upload`, then 07–08 on `fix/cafe-details-hygiene` cut from `prod` after the first
merged. The run delivered everything on one integration branch instead, so
**`fix/cafe-details-hygiene` was never created**. The blocking edges on 07 and 08 were therefore
applied as ordering only: 07 and 08 still waited for 01–06 to be integrated, but the split no
longer marks a PR boundary. Consequence worth knowing before a revert: 07–08 are **not**
separately revertable at PR level; use commit ranges instead (see the spec's rollback note).

## Graph

| Ticket | Blocked by | Delivers |
| --- | --- | --- |
| 01 Cafe page revalidation follows the real routes | None | Saving a scan or reporting a Cafe refreshes its public page |
| 02 Menu scan offers camera and gallery, and honours its limits | None | Two named photo choices on every device; bad files refused with a reason |
| 03 Menu scan sends a legible image and releases its preview | 02 | Dense Menus transcribe; repeated scans do not accumulate memory |
| 04 Menu writes are trusted by role | 01 | Owner and admin scans land in the Menu; everyone else's becomes one pending batch |
| 05 Admins review a Menu scan batch as one decision | 04 | One approval or rejection covers a whole scan, atomically and once |
| 06 Scan Menu is visible to visitors and sends them to log in | None | A logged-out visitor sees the affordance and reaches login with the Cafe as return |
| 07 Owners get an edit affordance on their own Cafe page | 01, 02, 03, 04, 05, 06 | An owner sees Edit on their Cafe; staff keep the moderation preview |
| 08 The Cafe route returns a real 404 and recovers from errors | 01, 02, 03, 04, 05, 06 | Missing and unpublished Cafes 404 identically; a failed render offers a retry |

Initial frontier: **01, 02, 06**.

## Standing constraints for every ticket

- `bun run test` **and** `TZ=UTC bun run test` both pass. There is no CI, so a green suite
  is only as trustworthy as the machine that ran it.
- `bun lint` passes.
- Authorization is decided server-side. Hiding a control is presentation, never the guard.
- No destructive SQL. Schema changes are additive.
- Do not add a route-level loading fallback to the Cafe segment; the page preloads its hero
  image for LCP and a fallback would delay it.
- Existing single-item Menu suggestion behaviour stays frozen: its queue rows, approvals
  and rejections must look and behave exactly as they do today.

## E2E

The spec opted in to a written `agent-browser` playbook at a mobile viewport, recorded
under `docs/superpowers/e2e/`. Ticket 02 and ticket 03 contribute its camera/gallery,
gallery-reaches-review and legible-dense-menu flows; ticket 06 contributes the
logged-out path; ticket 01 contributes the "saved scan is visible without a hard reload"
flow. No automated browser suite is introduced.
