# 01: Cafe page revalidation follows the real routes

**What to build:** Saving a Menu scan, or reporting a Cafe, leaves the Cafe's public page
showing the change as soon as the action resolves. Path building for Cafe pages exists in
one place and can only produce routes the app actually serves.

Today the Menu save and the Cafe report both revalidate paths shaped `/cafe/<id>`, which
match no route — the public route is the Cafe's slug. Neither action visibly refreshes the
page it claims to have changed. The batch review, arriving in ticket 05, would inherit the
same defect if it copied the string again.

**Blocked by:** None (can start immediately)

**Seams:** S4 — the revalidation helper. *Catches:* a wrong-shaped path returning through
any call site, including future ones, because every write path goes through one function.
*Misses:* whether the framework actually re-fetched the page — that is what the E2E flow in
the README checks.

**Tracker:** https://git.ranio.xyz/groundsph/www/issues/30
**Status:** done

- [x] Giving the helper a Cafe's stored identity yields exactly the Cafe page path and the Cafe Menu path, and nothing else
- [x] Giving it an identity that matches no Cafe yields nothing to revalidate and raises no error
- [x] Saving a Menu scan leaves the Cafe's public page showing the new items once the action resolves
- [x] Reporting a Cafe leaves its public page reflecting the report once the action resolves
- [x] No code path in the repository builds a Cafe route the app does not serve
- [x] Tests assert the helper's output against paths written in the test, not derived from the helper
