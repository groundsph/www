# 06: Scan Menu is visible to visitors and sends them to log in

**What to build:** A logged-out visitor on a Cafe page sees that scanning a Menu exists.
Tapping it takes them to login and brings them back to that Cafe afterwards. A logged-in
visitor sees the same affordance and it opens the scan in place.

The affordance is currently removed entirely for anyone without a session, so the feature is
invisible to most visitors — unlike the two neighbouring contribution affordances on the
same page, which render for everyone and route anonymous clicks to login.

**Blocked by:** None (can start immediately)

**Seams:** S1 — the scan affordance, rendered, widened to include the affordance itself and
not only the modal. *Catches:* the affordance disappearing for logged-out visitors again,
and a login link that loses the Cafe. *Misses:* whether the login page returns the visitor
to the right place — the E2E playbook covers that end to end.

**Tracker:** https://git.ranio.xyz/groundsph/www/issues/32
**Status:** done

- [x] A logged-out visitor on a Cafe page sees the Scan Menu affordance
- [x] Tapping it goes to the login page carrying that Cafe as the place to return to
- [x] A logged-in visitor sees the same affordance and tapping it opens the scan without leaving the page
- [x] The scan never opens for a caller without a session
- [x] The affordance behaves the same way wherever it appears, since the Cafe page, the Cafe Menu page and the owner Menu editor share one
- [x] Tests cover both the logged-out and logged-in rendering
