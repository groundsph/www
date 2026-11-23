# Grounds PH

A community-run directory of cafes. Visitors discover cafes, check in when they are physically at one, and collect visits; owners claim and maintain their listings; admins curate what the public sees.

## Language

### Catalogue

**Cafe**:
A listed coffee shop. The unit everything else in the product hangs off.
_Avoid_: shop, store, place, listing

**Test cafe**:
A cafe that exists to exercise the product during development and demos, never part of the public catalogue. It is invisible to visitors everywhere: listings, search, maps, nearby lookups, leaderboards, feeds, AI answers, sitemaps, and other people's profiles. Only a developer running the app locally sees it.
_Avoid_: dummy cafe, demo cafe, sandbox cafe, sample cafe

### Menus

**Menu**:
The itemised list of what a cafe sells, held as individual **Menu items**. Every cafe has at most one Menu; it is public and browsable on its own page.
_Avoid_: menu list, price list, catalog, offerings

**Menu item**:
One line on a Menu: a name, a category, a price, and optionally a description, dietary and temperature flags, and a photo. The unit every suggestion and scan operates on.
_Avoid_: dish, product, entry, menu entry

**Menu photo**:
An image of a cafe's printed or posted menu. Source material for a **Menu scan**; it is not itself attached to the cafe and is not kept after the scan.
_Avoid_: menu image, menu upload, menu picture

**Menu scan**:
One OCR pass over a **Menu photo** that transcribes it into proposed **Menu items**. A scan is a proposal, never an edit — it changes nothing until it is accepted.
_Avoid_: OCR upload, menu extraction, auto-import, scan result

**Menu scan batch**:
The set of **Menu items** produced by one **Menu scan**, reviewed and accepted or rejected together. Its members are ordinary **Menu suggestions**.
_Avoid_: bulk import, job, group, scan session

**Menu suggestion**:
A proposed change to a cafe's **Menu** — add, edit, or remove one **Menu item** — waiting for review. A **Menu scan** by anyone other than the cafe's owner or an admin becomes a **Menu scan batch** of Menu suggestions.
_Avoid_: menu edit, contribution, moderation item; and not "submission", which is reserved for a whole **Cafe**

### Visits

**Visit**:
One person's presence at one cafe on one day, recorded by checking in. The unit every count and ranking is built from.
_Avoid_: check-in, log, stamp

**Presence**:
The judgement that a visitor is currently at a particular cafe, inferred from a series of location samples rather than a single one.
_Avoid_: geofence, location match, proximity

**Visit count**:
How many visits a person or cafe accumulated: days out, not taps. Two check-ins at one cafe on one day are one visit.
_Avoid_: check-ins, taps, hits

**Cafes visited**:
How many distinct cafes a person checked in at. A different measure from visit count, and never to be labelled "visits".
_Avoid_: unique visits, spots, places

### Standing

**Score**:
The composite number a monthly leaderboard ranks by, earned within that month. It is a measure of standing for the period, not a lifetime total.
_Avoid_: points total, XP, karma

**Snapshot**:
A month's final leaderboard, frozen once the month is over. Past months are read from snapshots; the current month is always computed fresh.
_Avoid_: archive, history, rollup

**Leaderboard month**:
A calendar month on Philippine time. Every month boundary in the product is a Manila midnight, never a UTC one.
_Avoid_: period, cycle

## Relationships

- A **Cafe** has many **Menu items**, and at most one **Menu**
- A **Menu item** may carry one photo
- A **Menu scan** consumes one **Menu photo** and yields one **Menu scan batch** or a direct set of **Menu items**, depending on who ran it
- A **Menu scan batch** holds many **Menu suggestions**
- A **Menu suggestion** proposes one change to one **Menu item**

## Flagged ambiguities

- "menu" was used to mean both the itemised list and the photograph of it. Resolved: the list is the
  **Menu**; the photograph is a **Menu photo**.
- "scan" was used to mean both the act of transcribing and the transcription it produced. Resolved: the
  act is a **Menu scan**; a set of results awaiting review is a **Menu scan batch**.
