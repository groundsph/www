# 08: The Cafe route returns a real 404 and recovers from errors

**What to build:** A Cafe that does not exist returns a real 404. So does one that exists but
is unpublished, with identical output and no trace of its name — the two are
indistinguishable. A failed render on a Cafe page shows a recoverable screen offering a
retry, instead of the site's outermost error handling.

The Cafe page answers a missing Cafe with hand-rolled markup inside a successful response,
so link checkers and search engines are told the page exists. The Cafe Menu page below it
already asks the framework for a not-found response, but the app's only not-found boundary
redirects home, so the visitor is sent to the homepage instead of being told the page is
gone. No error boundary exists anywhere in the application.

**Blocked by:** 01, 02, 03, 04, 05, 06 — no code dependency. These edges were planned as a
pull request boundary: this was to be the second ticket of `fix/cafe-details-hygiene`, cut from
`prod` once the first PR had merged. As delivered there was a single PR
(`fix/menu-scan-upload`, #38), so the edges were applied as ordering only.

**Seams:** S6 — the Cafe route segment's boundaries. *Catches:* an unpublished Cafe returning
something different from a missing one, and a name leaking into the 404. *Misses:* visual
quality of either boundary.

**Tracker:** https://git.ranio.xyz/groundsph/www/issues/37
**Status:** done

- [x] A Cafe that does not exist answers with a not-found status
- [x] An unpublished Cafe answers identically, with the same status and the same output
- [x] Neither response contains the Cafe's name or anything that distinguishes the two cases
- [x] The Cafe Menu page inherits the same not-found response instead of sending the visitor home
- [x] A failed render on a Cafe page shows a recoverable screen with a way to retry
- [x] The Cafe page no longer renders the missing-Cafe case itself
- [x] No route-level loading fallback is added to the Cafe segment
- [x] Tests assert the status and the absence of the Cafe's name for both cases
