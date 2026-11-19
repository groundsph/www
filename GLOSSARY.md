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
