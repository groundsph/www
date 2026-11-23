# 05: Admins review a Menu scan batch as one decision

**What to build:** An admin opens the suggestion queue and sees a whole scan as one entry —
which Cafe it is for, how many items it carries — and approves or rejects it in a single
action. Accepting puts every item on the Menu together; rejecting puts none on it; doing
either twice changes nothing. Suggestions made one item at a time still appear and behave
exactly as they do today.

Ticket 04 creates batches; without this ticket they are unreviewable, so a community scan
would be a dead end.

**Blocked by:** 04 — there is nothing to group or approve until scans produce batches.

**Seams:** S3 — the Menu write path, now including approval and rejection. *Catches:* items
appearing without their batch status changing or the reverse, a double approval duplicating
a Menu, a rejection that leaks items, and a batch that half-applies. *Misses:* the visual
quality of the grouping.

**Tracker:** https://git.ranio.xyz/groundsph/www/issues/35
**Status:** done

- [x] Suggestions from one scan appear as one group, naming the Cafe and showing how many items it carries
- [x] Suggestions with no batch identity render exactly as they did before this ticket
- [x] Approving a group puts every still-pending item on the Menu in one action
- [x] Approving the same group again adds no items and reports that nothing was left to approve
- [x] Rejecting a group adds no items and marks its pending rows rejected
- [x] A failure partway through approving leaves either the whole group applied or none of it
- [x] The list reflects the outcome without a reload, and falls back to the existing empty state when nothing pending remains
- [x] Only admins or moderators may approve or reject
- [x] The Cafe's price level is recalculated and its pages revalidated through the shared helper after an approval commits
- [x] Tests cover double approval, rejection, and the all-or-nothing property
