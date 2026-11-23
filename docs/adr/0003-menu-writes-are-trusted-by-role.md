# Menu writes are trusted by role, not by surface

A **Menu suggestion** is reviewed before it touches a cafe's **Menu**. A **Menu scan** is
reviewed the same way — *unless* the person running it is the cafe's owner or an admin, in
which case the transcribed items are written straight into the Menu and marked
`community_submitted` so the provenance survives.

The split is by role and by nothing else: the same modal, the same server action, the same
button. There is no "trusted surface" flag, no per-cafe opt-in, and no scan-size threshold.

Before this decision `saveOcrMenuItems` wrote directly for *any* authenticated user, which
meant a stranger could rewrite a cafe's prices in bulk in one tap while a stranger
changing *one* price had to wait for review. The inconsistency was the bug: the queue
existed, and the highest-volume write path bypassed it.

## Consequences

- A community **Menu scan** becomes one **Menu scan batch** — a group of ordinary Menu
  suggestions tagged with a batch id — reviewed and accepted or rejected together. Forty
  extracted items are one decision, not forty.
- Owners and admins keep the fast path. That is deliberate: they are the people accountable
  for the data, and forcing them through review would tax them for strangers' behaviour.
  Reversing this later means removing an affordance owners will already depend on, which is
  why it is written down.
- The **Cafe submission** flow is unaffected. A scan there stages items into a Cafe that
  has not been created yet, and that whole Cafe goes through submission review; adding a
  second review layer would be redundant.
- `approveMenuItemSuggestion` already revalidates the real routes, `/cafes/<slug>` and
  `/cafes/<slug>/menu`. `saveOcrMenuItems` revalidated `/cafe/<id>`, which matches no route,
  so a direct owner/admin save left the public page serving a stale Menu. Both paths now
  share one revalidation helper so this cannot drift again.

## Considered options

- **Queue every scan, owners included.** Rejected: it punishes the accountable party for
  the behaviour of strangers, and owners would scan less, so menus would go stale.
- **Keep direct writes for everyone and review after the fact.** Rejected: it inverts the
  queue's purpose, leaves a window where visitors read wrong prices, and needs a second
  moderation surface in addition to the existing one.
- **Gate bulk save to owner/admin only, with no community path.** Rejected: transcription is
  exactly the low-skill, high-volume contribution a community is good at, and a disabled
  affordance would be a dead end for everyone else.
- **One suggestion row holding the whole scan as an array.** Rejected: it changes the
  `suggestedData` contract that the queue UI, `approve`, and `reject` all read, to save one
  nullable column.
