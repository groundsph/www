# 07: Owners get an edit affordance on their own Cafe page

**What to build:** A Cafe's owner opening their Cafe's public page sees an edit affordance
leading to the owner editor. Admins and moderators keep exactly what they have — an
affordance leading to the moderation preview — and a moderator outside their regions, or a
visitor without a session, still sees nothing.

Owners maintain their listing from a separate area of the site and are not recognised by the
public page's edit permission check, which answers only for staff. So the person most
responsible for a Cafe's accuracy is the one person the page does not offer to help.

**Blocked by:** 01, 02, 03, 04, 05, 06 — no code dependency. These edges were planned as a
pull request boundary: this was to be the first ticket of `fix/cafe-details-hygiene`, cut from
`prod` once the first PR had merged. As delivered there was a single PR
(`fix/menu-scan-upload`, #38), so the edges were applied as ordering only.

**Seams:** S5 — the edit permission check and the banner that renders it. *Catches:* the
permission widening to anyone who is not the owner, the owner's link pointing at the staff
surface, and the region scoping silently dropping out. *Misses:* real routing — that the
owner editor actually loads is an E2E concern.

**Tracker:** https://git.ranio.xyz/groundsph/www/issues/36
**Status:** done

- [x] A Cafe's owner sees an edit affordance on that Cafe's public page
- [x] That affordance leads to the owner editor for that Cafe
- [x] An admin or moderator sees an affordance leading to the moderation preview, unchanged
- [x] A moderator outside their regions sees nothing
- [x] A visitor without a session sees nothing
- [x] Another Cafe's owner sees nothing on this Cafe's page
- [x] The permission is decided server-side, not inferred in the browser
- [x] Tests cover owner, admin, out-of-region moderator, other owner, and logged-out
