# 04: Menu writes are trusted by role

**What to build:** Saving a scan is decided by who is saving. A Cafe's owner and an admin
transcribe straight into the Menu. Anyone else's scan becomes a single pending batch of Menu
suggestions and the modal tells that person their scan is under review, in wording that
cannot be mistaken for a successful save. Nobody can write a Cafe's Menu directly on the
strength of merely having an account.

Today the save path accepts any logged-in caller, so a stranger can bulk-rewrite a Cafe's
prices while a stranger changing one price by hand has to wait for review. The queue already
exists; the highest-volume write path bypasses it.

**Blocked by:** 01 — the direct save must revalidate through the shared helper rather than
the route shape it currently builds.

**Seams:** S3 — the Menu write path. *Catches:* the whole role decision, including a
moderator being treated as neither owner nor admin, and ownership being taken from the
caller instead of stored data. *Misses:* how the queue presents the batch, which is ticket
05.

**Tracker:** https://git.ranio.xyz/groundsph/www/issues/34
**Status:** done

- [x] A Cafe's owner who scans gets Menu items
- [x] An admin who scans gets Menu items
- [x] A logged-in person who is neither the Cafe's owner nor an admin gets pending Menu suggestions and no Menu items
- [x] A moderator who scans is queued, not written directly — moderation is a different permission from trusted writing
- [x] A caller without a session is refused, and the refusal is a returned error rather than a thrown failure
- [x] Every suggestion produced by one scan shares one batch identity; a suggestion made one item at a time keeps none
- [x] The modal tells a queued contributor the scan is under review, using wording distinct from a saved confirmation
- [x] After a direct save the confirmation still reports how many items were added and offers the way to the Cafe's Menu
- [x] A direct save revalidates through the shared helper from ticket 01
- [x] Ownership is re-derived server-side from stored cafe data, never from anything the caller supplies
- [x] The schema change is one nullable addition; no existing row is rewritten or backfilled
- [x] Existing single-item suggestion behaviour is unchanged
- [x] Tests cover the full role matrix and the shared batch identity
