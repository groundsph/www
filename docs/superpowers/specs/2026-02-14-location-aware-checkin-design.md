# Location-aware check-in and weather-aware Surprise Me

Status: approved, implemented on `feat/location-aware-checkin-and-weather-picks`.

## Problem

The landing page shows a single inline line — "Are you at _Cafe_? Check In" — rendered as soon as
`getNearbyCafes` returns any café within 150 m. Three problems:

1. **It never asks.** The prompt is passive, so most visitors never discover check-ins exist.
2. **It can be wrong.** A single GPS fix with no accuracy check will happily claim you are at the café
   upstairs in the same mall, or that you are at a café you walked past ten minutes ago. There is also
   no way to say "no".
3. **`nearbyCafe` never clears.** `useLandingLocation` sets it and never resets it, so a visitor who
   drives home still sees "Are you at _Cafe_" on the same tab.

Separately, "Surprise Me" picks a random café with no context, missing an obvious angle: in the
Philippines the choice between a hot pour-over and an iced latte is basically a weather question.

## 1. Presence-gated auto-open

New `hooks/useCafePresence.ts` replaces the fire-once nearby lookup in `useLandingLocation`.

### Sampling

`navigator.geolocation.watchPosition` with `enableHighAccuracy: false`, `maximumAge: 10s`,
`timeout: 20s`. One-shot `getCurrentPosition` cannot measure dwell, which is the whole point.

### Presence session

For each café we track `{ cafeId, firstSeenAt, samples: Position[] }`. A session is discarded when
the nearest café changes, or when a new sample lands more than 150 m from the previous one.

### Confidence gate

Auto-open requires **all** of:

| Rule | Threshold | Why |
| --- | --- | --- |
| Source is real GPS | `source === "gps"` | IP geolocation resolves to a city centroid; never interrupt based on it |
| Not an estimate | `isEstimate === false` | Same |
| Fix accuracy | `coords.accuracy <= 60` m | A 200 m fix cannot distinguish adjacent cafés |
| Distance to café | `<= 100` m | Tighter than the 150 m check-in radius |
| Corroborating samples | `>= 2` within 50 m of each other | One sample is noise |
| Implied speed | `<= 1.4` m/s between samples | Rejects "walked past" and "drove by" |
| Dwell | `>= 90` s continuous | Sitting, not passing |
| Page visibility | visible for the whole window | No prompting from a background tab |
| Page load | at most one auto-open | No modal spam |

No geofence can distinguish a café from the shop above it. The honest mitigation is: ask a question
("Are you at X?"), explain the evidence (distance, dwell), and make declining free.

### Suppression ledger

`localStorage`, keyed on café id, with **Philippine-time day boundaries** to match the one-visit-per-day
rule already enforced by `recordVisit` (`getPHTodayStart()`).

| Key | TTL | Set when |
| --- | --- | --- |
| `grounds:checkin:prompted:<cafeId>` | same PH day | auto-open fires |
| `grounds:checkin:dismissed:<cafeId>` | 7 days | user presses "Not here" |
| `grounds:checkin:auto-opened` | session | auto-open fires |

Explicit taps on "Check In" always work regardless of the ledger — suppression only affects
unsolicited modals.

### State shape

```ts
interface CafePresence {
    nearbyCafe: NearbyCafeDetail | null   // nearest café within the check-in radius
    isConfident: boolean                  // gate passed; caller may auto-open once
    reason: string | null                 // diagnostic, e.g. "accuracy 180m"
    accuracy: number | null
    distance: number | null               // metres
}
```

`markPrompted()` and `markDismissed()` are returned so the consumer owns the side effects.

## 2. Rich check-in modal

`GroupCheckInModal` gains an optional `cafe?: NearbyCafeDetail` prop. When present it renders a rich
header; when absent it keeps today's name-only header. One modal, one code path — the café page and
the landing page share it.

Header contents, in emphasis order:

1. Photo (16:9) with bottom gradient, café name and city overlaid
2. Status strip: open/closed now + closing time, price level, rating + review count, walk time
3. Amenity chips — only the ones that are actually true
4. Primary CTA **"Yes, I'm here"**, companions collapsed behind "Add friends"
5. Secondary links: `View café`, and a quiet **"Not here"**

`getNearbyCafes` widens its select to supply `average_rating`, `total_reviews`, `price_level`,
`operating_hours`, `city_municipality`, `has_wifi`, `has_sockets`, `has_aircon`, `is_pet_friendly`,
`has_outdoor_seating`, `is_work_friendly`, and `lat`/`lng`. Rows with null coordinates are filtered
before the distance expression, because `acos()` over null yields NaN and a NaN sort key can float
such a row to the top.

## 3. Weather-aware Surprise Me

### Source

`wttr.in/<lat>,<lng>?format=j1` — no API key, no signup, and it answers with a coordinate path.
Verified reachable from the project's network; Open-Meteo timed out on the same network, so it is not
used. Coordinates are rounded to a 0.05° grid (~5 km) before the request so the Next.js data cache
actually hits across users.

`next: { revalidate: 900 }` (15 minutes), 6 second `AbortController`, `null` on any failure. The
feature degrades to plain random selection, with no error UI and no layout shift.

### Classification

`utils/weather-picks.ts`, pure and unit-tested:

```
rainy  → precipitation > 0 or weather code in the rain/drizzle/thunder set
cool   → temp <= 22
hot    → feels-like >= 32
humid  → humidity >= 75 and felt >= 28
mild   → otherwise
```

### Ranking

Drinks only (`isFood` excluded) unless the café has no drinks at all, then food is allowed. Score:

| Signal | Weight |
| --- | --- |
| matches weather (cold for hot/humid, hot for rainy/cool) | +3 |
| `isSignature` | +2 |
| available | +2 (unavailable items score -5) |
| opposite temperature | -2 |

Ties break on `sortOrder` then name, so the result is deterministic and testable.

Every pick carries a short reason string ("34°C and humid out"), which is what makes the
recommendation feel earned rather than decorative.

### Presentation

`RandomCafeButton` gains a "Today's pick" row under the café's info: item name, price, and the
reason. A weather chip sits in the modal header ("32°C · Humid"). Both disappear silently when weather
or menu data is missing.

## 4. Smaller fixes included

- `formatWalkTime()` in `utils/geo.ts` — "4 min walk" beats "300m" for a check-in decision.
- Hero prompt keeps a stable button shape while status is loading (no width jump).
- Hero prompt gets `aria-live="polite"`, since it appears asynchronously after GPS resolves.
- `useLandingLocation` clears `nearbyCafe` when the visitor leaves the radius.

## Out of scope

- No café re-ranking by weather (the pick stays random; only the drink suggestion is weather-driven).
- No new database tables, no migration.
- No new environment variables.
- No analytics events — `utils/analytics.ts` only models café page views, and adding an event pipeline
  is a separate piece of work.

## Testing

- `utils/__tests__/weather-picks.test.ts` — classification boundaries, ranking preference per weather
  class, food fallback, determinism on ties.
- `utils/__tests__/geo.test.ts` — walk-time formatting.
- `hooks/__tests__/use-cafe-presence.test.ts` — gate rejects poor accuracy, single samples, IP source,
  fast movement and short dwell; accepts a steady 90 s presence; ledger blocks same-day repeat and
  honours a 7-day dismissal.
- Existing `components/checkin/__tests__/hero-location-checkin.test.tsx` must keep passing.
