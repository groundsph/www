# E2E verification — remediation sweep

**Target:** `http://localhost:3210` (plain HTTP dev server, already running)
**Runner:** headless Chromium via the native `agent_browser` tool. **No session.** The runner has
no signed-in browser profile, so every authenticated surface is only verifiable in its logged-out
form. Authenticated UI is covered by the unit/component tests named in each flow, not here.

**Corrections to the plan confirmed against the live server before executing** (the plan's prose was
wrong on these; reality is recorded instead):

| Plan said | Reality |
|---|---|
| Entry link to `/for-owners` verifiable on `/submit` while logged out | `/submit` is auth-gated: `307 → /auth?redirect=%2Fsubmit`. Not visible logged out. |
| `/owner`, `/profile` presumably render or redirect | Both auth-gated: `307 → /auth`. The correct redirect *is* the verifiable assertion. |
| Dead `/cafes/<slug>/suggestions` returns `404` | It returns `307 → /` (as does any nonsense sub-path). The route is gone; it does not 404. |
| `/cafes` anchors available in server HTML | `/cafes` is client-rendered; slugs only exist after hydration. |
| `--window-size` on the launch command sizes the viewport | Does not reliably resize managed headless Chromium. `set viewport 390 844` + `reload`, then read back `window.innerWidth`. |

---

## Flow P1 — Security packet: owner edit path still works

### Steps
1. `curl -s -o /dev/null -w "%{http_code}" http://localhost:3210/owner`
2. Open http://localhost:3210/owner in the browser
3. Confirm the logged-out redirect to /auth
4. Open http://localhost:3210/for-owners and confirm 200

### Acceptance Criteria
- [x] GET /owner while logged out returns a redirect to /auth (never 500)
- [x] The browser lands on the auth page, not an error boundary
- [x] /for-owners still returns 200 (no collateral damage)
- [x] No console errors on either page

### EXECUTE — observed

```
$ curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3210/owner
307 http://localhost:3210/auth?redirect=%2Fowner
```

```
agent_browser open http://localhost:3210/owner
Auth | GroundsPH
http://localhost:3210/auth?redirect=%2Fowner
```

Post-navigation DOM probe:

```
agent_browser eval --stdin
{
  "url": "http://localhost:3210/auth?redirect=%2Fowner",
  "title": "Auth | GroundsPH",
  "hasAuthHeading": true,
  "errorBoundary": false,
  "bodyLen": 276
}
```

```
agent_browser errors
No page errors.
```

`/for-owners` after the P1 changes:

```
$ curl -s -o /dev/null -w "for-owners: %{http_code}\n" http://localhost:3210/for-owners
for-owners: 200
$ curl -s http://localhost:3210/for-owners | grep -o "<h1" | wc -l
1
$ curl -s http://localhost:3210/for-owners | grep -o "<details" | wc -l
9
```

Screenshot: `screenshots/remediation-owner-edit.png` — 49 182 bytes (1280×633), showing the
GroundsPH "Login to your Account" form. The browser landed on the auth page, not an error boundary.

### VERIFY

- **PASS (logged-out half).** `/owner` → `307` to `/auth?redirect=%2Fowner`, browser lands on the
  login form, zero console errors, `/for-owners` still `200` with 1 `<h1>` and 9 `<details>`.
- **NOT VERIFIED: the authenticated owner-edit path.** The plan's headline claim — that the Task 2
  key allowlist does not break real owner editing — needs a signed-in session this runner does not
  have: `/owner/cafes/<slug>/edit` was never mounted, no field was edited, no save was performed.
  The allowlist behaviour itself (protected keys rejected, allowed keys written) is proven by
  **Task 2's unit tests**, not by this flow. This flow proves only that the security packet did not
  break route guards or the public `/for-owners` page.

---

## Flow P2 — Owner-facing truth: straw amenity renders, dead danger zone is gone

### DEFINE
Verify a public cafe page renders the straw amenity on desktop at 1280px, and that no page
contains "Remove My Ownership".

### EXECUTE — observed

`/cafes` is client-rendered, so the slug list only exists after hydration. An eval executed
immediately after navigation returned `cafeAnchors: 0, bodyLen: 801` (pre-hydration skeleton); the
same eval re-run against the hydrated DOM returned the real list:

```
agent_browser eval --stdin   (after hydration)
"all": ["/", "/cafes", "/map", "/auth", "/submit",
        "/cafes/the-glebe-coffee-panglao-bohol",
        "/cafes/bark-coffee-tagbilaran-city-bohol",
        "/cafes/common-ground-coffee-other-tings-baguio-city-benguet",
        "/cafes/the-coffee-lab-lounge-angeles-city-pampanga",
        "/cafes/caffeinistry-muntinlupa-metro-manila",
        "/cafes/hola-cafe-pasay-metro-manila",
        "/cafes/ambre-cakes-and-coffee-cebu-city-cebu",
        "/cafes/coastal-ground-coffee-general-luna-surigao-del-norte",
        "/cafes/highway-cravings-bacuag-surigao-del-norte",
        "/cafes/siargao-cornercafe-general-luna-surigao-del-norte", ...]
```

Cafe chosen by querying the dev database directly for a non-null `straw_type` (read-only `SELECT`):

```
$ psql "$DATABASE_URL" -At -F '|' -c "select slug, coalesce(straw_type::text,'NULL') from cafes order by slug;"
ambre-cakes-and-coffee-cebu-city-cebu|plastic
arianas-cafe-surigao-city-surigao-del-norte|plastic
bamboo-surf-cafe-siargao|paper
beracah-cafe|metal
bos-coffee-the-midpoint-surigao-city-surigao-del-norte|paper
...
```

`ambre-cakes-and-coffee-cebu-city-cebu` has `straw_type = plastic` **and** is in the visible
`/cafes` listing, so it was used.

```
agent_browser set viewport 1280 900
agent_browser reload
agent_browser get url
http://localhost:3210/cafes/ambre-cakes-and-coffee-cebu-city-cebu
```

```
agent_browser eval --stdin
{
  "url": "http://localhost:3210/cafes/ambre-cakes-and-coffee-cebu-city-cebu",
  "innerWidth": 1280,
  "innerHeight": 900,
  "hasStraw": false,
  "strawLines": [],
  "hasDangerZone": false,
  "myOwnershipText": false,
  "bodyLen": 2164
}
```

**The plan's `/straw/i` assertion is wrong and cannot pass.** `utils/formatters.ts`
`formatCafeStrawType()` renders the *value* of `straw_type`, not the word "straw", and
`components/cafe/CafeDetails.tsx` passes it straight to `AmenityPill` as `label`. So the DOM never
contains "straw" on this page. Probing the actual pill instead:

```
agent_browser eval --stdin
{
  "bodyHasPlastic": true,
  "plasticHits": 1,
  "hits": [{
    "tag": "LI",
    "cls": "flex items-center gap-1.5 text-text bg-secondary/40 px-2 py-",
    "text": "plastic",
    "ulSiblingTexts": ["WiFi","Power Outlets","Parking","Air Conditioning",
                       "Indoor Seating","Restroom","plastic"]
  }],
  "innerWidth": 1280
}
```

Re-probe after scrolling the pill into view:

```
agent_browser eval --stdin
{
  "url": "http://localhost:3210/cafes/ambre-cakes-and-coffee-cebu-city-cebu",
  "innerWidth": 1280,
  "amenitiesUl": "WiFi|Power Outlets|Parking|Air Conditioning|Indoor Seating|Restroom|plastic",
  "hasDangerZone": false,
  "hasDangerZoneCard": false
}
```

Danger-zone wording is gone from both source and rendered HTML:

```
$ grep -rni "remove my ownership" --include=*.tsx --include=*.ts .
./components/owner/__tests__/lifecycle-disclosure.test.tsx:9:  it("removes the dead Remove My Ownership button"
./components/owner/__tests__/lifecycle-disclosure.test.tsx:10:  expect(managementSource).not.toContain("Remove My Ownership")
(no other matches — the only hits are the guard test asserting its absence)

$ for p in /cafes /for-owners /map; do curl -s "http://localhost:3210$p" | grep -ci "remove my ownership"; done
0
0
0
```

Screenshot: `screenshots/remediation-cafe-straw.png` — 436 360 bytes (1280×900 viewport, scrolled to
y=791 of a 2501 px document). It shows the **AMENITIES** row `WiFi · Power Outlets · Parking ·
Air Conditioning · Indoor Seating · Restroom · plastic` — the `plastic` pill is the straw amenity —
alongside **VIBE & EXTRAS**, and no danger zone anywhere on the page.

### VERIFY / RESULT

- **PASS: straw amenity renders publicly on desktop at 1280px.** Evidence: one `<li>` pill labelled
  `plastic` inside the amenities `<ul>` of `ambre-cakes-and-coffee-cebu-city-cebu` (a cafe with
  `straw_type = 'plastic'`), visible in the screenshot.
- **PASS: no page contains "Remove My Ownership" or "Danger Zone"** — 0 hits in `/cafes`,
  `/for-owners`, `/map` server HTML and 0 in the rendered cafe page; the only source hits are the
  Task 18 guard test asserting its absence.
- **Caveat recorded honestly:** the plan's `/straw/i` check as written is unpassable and was
  replaced by a check for the actual rendered pill label. This is not a weakened assertion — the
  label *is* the straw amenity, and the screenshot shows it. The owner-side editor view of the same
  field (`components/cafe-editor/AmenitiesSection.tsx`) is behind auth and was **NOT VERIFIED** in a
  browser.

---

## Flow P3 — Dead code: the suggestions route is gone and unlinked

### DEFINE
Confirm the dead suggestions route no longer serves a page and that no page links to it.
The plan's acceptance criterion was **`404`**. That is wrong: see below.

### EXECUTE — observed

```
$ for p in "/cafes/ambre-cakes-and-coffee-cebu-city-cebu/suggestions" \
           "/cafes/example-cafe/suggestions" \
           "/cafes/x/nope-nope" \
           "/cafes/ambre-cakes-and-coffee-cebu-city-cebu/suggestions/new"; do
    curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "http://localhost:3210$p"; done
/cafes/ambre-cakes-and-coffee-cebu-city-cebu/suggestions     307 http://localhost:3210/
/cafes/example-cafe/suggestions                              307 http://localhost:3210/
/cafes/x/nope-nope                                           307 http://localhost:3210/
/cafes/ambre-cakes-and-coffee-cebu-city-cebu/suggestions/new 307 http://localhost:3210/

$ curl -sL -o /dev/null -w "%{http_code} final=%{url_effective}\n" \
    "http://localhost:3210/cafes/ambre-cakes-and-coffee-cebu-city-cebu/suggestions"
200 final=http://localhost:3210/
```

**The route does not 404.** It returns `307 → /` — the same response as a nonsense sub-path
(`/cafes/x/nope-nope`), which is the app's catch-all for an unmatched sub-path under `/cafes/[slug]`.
The route is genuinely gone, but it manifests as a redirect home, not `404`. Asserting `404`, as the
plan instructs, would fail. The correct assertion — and what is asserted here — is *redirects to `/`
and is not linked from anywhere*.

Route tree on disk confirms no `suggestions` directory exists:

```
$ find app/cafes -maxdepth 3 -type d | sort
app/cafes
app/cafes/[slug]
app/cafes/[slug]/menu
app/cafes/location
app/cafes/location/[province]
app/cafes/location/[province]/[city]
```

Link sweep — rendered anchors per page (hydrated DOM):

```
agent_browser (6 pages, 190 anchors total)
/                                               anchors: 51  suggestionLinks: 0
/cafes                                          anchors: 25  suggestionLinks: 0
/map                                            anchors: 24  suggestionLinks: 0
/blog                                           anchors: 27  suggestionLinks: 0
/for-owners                                     anchors: 30  suggestionLinks: 0
/cafes/ambre-cakes-and-coffee-cebu-city-cebu    anchors: 33  suggestionLinks: 0
```

Server-HTML cross-check (`href="...suggestions..."`):

```
/            0
/cafes       0
/map         0
/blog        0
/for-owners  0
/contact     0
/events      0
server-HTML total suggestion hrefs: 0
```

Source grep shows the leftover `suggestions` identifiers are the deferred server actions
(`app/api/actions/suggestions.ts`) and unrelated strings, **not** a page route or a link:

```
app/api/actions/suggestions.ts:172:  * Get user's own suggestions with cafe info
app/api/actions/menu-suggestions.ts:44: ...
app/roadmap/page.tsx:157: "Cafe suggestions based on your preferences and visit history"
```

### VERIFY / RESULT

- **PASS: the suggestions page route is dead.** `app/cafes/[slug]/suggestions` does not exist on
  disk and `/cafes/<slug>/suggestions` serves no page — it `307`s to `/`, exactly like a nonsense
  sub-path. Final resolved status is `200` on `/`.
- **PASS: no page links to a suggestions path.** 0 suggestion anchors across 6 public pages (190
  anchors) and 0 in server HTML for 7 pages.
- **Plan deviation recorded:** the plan's expected `404` was not observed; the route redirects
  home. This is recorded as reality, not papered over. No `404` assertion is claimed.

---

## Flow P4 — Analytics: surface is gated correctly when logged out

### DEFINE
The analytics tab lives behind `/owner`, so this flow verifies the authenticated surface is
*reachable* when signed in and *blocked* when not. Chart range and CSV correctness are supposed to be
proven by the Tasks 12–14 unit tests.

### EXECUTE — observed

```
$ for p in /owner/cafes/example-cafe \
           /owner/cafes/ambre-cakes-and-coffee-cebu-city-cebu \
           "/owner/cafes/ambre-cakes-and-coffee-cebu-city-cebu?tab=analytics"; do
    curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "http://localhost:3210$p"; done
/owner/cafes/example-cafe                                        307 http://localhost:3210/auth?redirect=%2Fowner%2Fcafes%2Fexample-cafe
/owner/cafes/ambre-cakes-and-coffee-cebu-city-cebu               307 http://localhost:3210/auth?redirect=%2Fowner%2Fcafes%2Fambre-cakes-and-coffee-cebu-city-cebu
/owner/cafes/ambre-cakes-and-coffee-cebu-city-cebu?tab=analytics 307 http://localhost:3210/auth?tab=analytics&redirect=%2Fowner%2Fcafes%2Fambre-cakes-and-coffee-cebu-city-cebu
```

No 500 on any of the three. The redirect body carries no cafe data — it is a bare `Location`
value:

```
$ curl -s "http://localhost:3210/owner/cafes/ambre-cakes-and-coffee-cebu-city-cebu"
/auth?redirect=%2Fowner%2Fcafes%2Fambre-cakes-and-coffee-cebu-city-cebu
```

Browser:

```
agent_browser open http://localhost:3210/owner/cafes/ambre-cakes-and-coffee-cebu-city-cebu
Auth | GroundsPH
http://localhost:3210/auth?redirect=%2Fowner%2Fcafes%2Fambre-cakes-and-coffee-cebu-city-cebu
```

```
agent_browser eval --stdin
{
  "url": "http://localhost:3210/auth?redirect=%2Fowner%2Fcafes%2Fambre-cakes-and-coffee-cebu-city-cebu",
  "title": "Auth | GroundsPH",
  "hasAnalyticsContent": false,
  "leaksCafeData": false,
  "errorBoundary": false
}
```

```
agent_browser errors
No page errors.
```

Screenshot: `screenshots/remediation-analytics.png` — 49 182 bytes (1280×633), the GroundsPH login
form, no owner chrome and no chart.

Supporting unit evidence that the authenticated chart logic is not merely untested:

```
$ bun test utils/analytics/__tests__/series.test.ts --isolate
 7 pass
 0 fail
 11 expect() calls
Ran 7 tests across 1 file. [171.00ms]
```

### VERIFY / RESULT

- **PASS (logged-out half): the analytics surface is correctly gated.** `307 → /auth` for the cafe
  management route and for the `?tab=analytics` variant, no `500`, browser lands on the login form,
  no analytics markup and no cafe data leaked, no console errors.
- **NOT VERIFIED: the authenticated half — the plan's optional extra was not executed.** This runner
  has no signed-in session and no credentials, so: the analytics tab was never opened, "90 days" was
  never selected, the bar count was never counted, the "Views per week" label was never read, and
  "Download CSV" was never clicked (no row count, no `.csv` file). None of those are claimed.
- **Consequence worth stating plainly:** `components/owner/__tests__/analytics-tab.test.tsx` is a
  *source-scan guard*, and its own header says "render-level proof of the chart lands in the E2E
  phase". That render-level proof did **not** happen here. What exists is the pure series maths
  (`utils/analytics/__tests__/series.test.ts`, 7 pass) plus the source guard — not a rendered chart.

---

## Flow P5 — Discovery and presentation: entry points and `/for-owners` layout

### DEFINE
All four entry points resolve, and `/for-owners` renders correctly at 1280px and 390px after the
width and opacity changes.

### EXECUTE — `/for-owners` at desktop 1280px

```
agent_browser open http://localhost:3210/for-owners      (fresh session)
agent_browser set viewport 1280 900
agent_browser reload
agent_browser get url
http://localhost:3210/for-owners
```

```
agent_browser eval --stdin
{
  "url": "http://localhost:3210/for-owners",
  "h1": 1,
  "h1Text": "Your cafe, finally yours online",
  "details": 9,
  "containerClass": "max-w-7xl mx-auto px-4 relative z-10",
  "innerWidth": 1280,
  "scrollWidth": 1280,
  "authLinks": 2,
  "hasSubmitLink": true,
  "anchorsLength": 32,
  "errorBoundary": false
}
```

Screenshot: `screenshots/remediation-for-owners-desktop.png` — 244 825 bytes (1280×900 viewport,
6 580 px document). Nav, "FOR CAFE OWNERS" badge, the two-line `h1`, body copy, "Free to claim. Free
to manage. No subscription, no commission, no card.", and both CTAs ("Claim your cafe", "Add a cafe
we're missing") all render inside the `max-w-7xl` container with no horizontal overflow.

### EXECUTE — `/for-owners` at mobile 390px

`--window-size` on the launch command was **not** used (it does not resize a managed headless
Chromium). The viewport was set explicitly and verified by reading `window.innerWidth` back:

```
agent_browser open http://localhost:3210/for-owners      (separate fresh session)
agent_browser set viewport 390 844
agent_browser reload
```

```
agent_browser eval --stdin
{
  "url": "http://localhost:3210/for-owners",
  "innerWidth": 390,
  "innerHeight": 844,
  "scrollWidth": 390,
  "overflows": false,
  "h1": 1,
  "details": 9
}
```

Screenshot: `screenshots/remediation-for-owners-mobile.png` — 143 391 bytes (390×844 viewport,
10 376 px document). Single-column layout, compact header with search + menu, stacked full-width
CTAs, no clipping and no horizontal scroll.

### EXECUTE — the four entry points

```
$ for p in /profile /owner /submit; do
    curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "http://localhost:3210$p"; done
/profile   307 http://localhost:3210/auth?redirect=%2Fprofile
/owner     307 http://localhost:3210/auth?redirect=%2Fowner
/submit    307 http://localhost:3210/auth?redirect=%2Fsubmit
```

**`/submit` is auth-gated. The plan's assertion — that a `/for-owners` link is verifiable on
`/submit` while logged out — cannot be executed.** The browser confirms it:

```
agent_browser open http://localhost:3210/submit
Auth | GroundsPH
http://localhost:3210/auth?redirect=%2Fsubmit
```

The link exists in source (the Task 18 source-scan guard in
`components/submit/__tests__/SubmitPage.test.tsx` asserts `"/for-owners"` is present), but no
logged-out browser can see it. **NOT VERIFIED in a browser.**

Cafe page (unclaimed, logged out) — `ambre-cakes-and-coffee-cebu-city-cebu`, which has
`array_length(owner_ids,1) = 0` in the dev database:

```
agent_browser open http://localhost:3210/cafes
agent_browser open http://localhost:3210/cafes/ambre-cakes-and-coffee-cebu-city-cebu
agent_browser eval --stdin
{
  "url": "http://localhost:3210/cafes/ambre-cakes-and-coffee-cebu-city-cebu",
  "anonymousEntry": true,
  "anonymousEntryText": ["Own this cafe? See what you get", "For Cafe Owners"],
  "claimButton": false,
  "errorBoundary": false
}
```

That is the plan's expected pair: `anonymousEntry: true`, `claimButton: false`.

Entry points that need a session (`/owner` dashboard, `/profile` owned-cafes list) are covered by
component tests only:

```
$ bun test components/submit/__tests__/SubmitPage.test.tsx \
           components/profile/__tests__/profile-owned-cafes.test.tsx \
           components/owner/__tests__/owner-dashboard-empty-state.test.tsx \
           components/cafe/__tests__/cafe-hero-owner-claim.test.tsx --isolate
 16 pass, 0 fail, 17 expect() calls
```

### VERIFY / RESULT

- **PASS: `/for-owners` presentation.** 1 `<h1>`, 9 `<details>`, container `max-w-7xl`, no
  horizontal overflow at 1280 px (`scrollWidth 1280 = innerWidth 1280`) or at 390 px
  (`scrollWidth 390 = innerWidth 390`, `overflows: false` — confirmed with `innerWidth` read back,
  not assumed from a launch flag).
- **PASS: anonymous cafe-page entry point.** `a[href="/for-owners"]` present on an unclaimed cafe
  while logged out, no "Claim it" button.
- **NOT VERIFIED: the `/submit` entry link** — `/submit` redirects to `/auth`, so the link is not
  reachable logged out. Backed by source guard only.
- **NOT VERIFIED: the `/owner` and `/profile` entry points** — both redirect to `/auth`. Their
  behaviour is asserted by component tests, not by a browser.
- **Plan correction recorded:** the plan's flow opens `/submit` and asserts
  `submitLink: true`; that eval would run against the login page, where the selector is absent. It
  was not claimed as a pass.

---

## Summary

| Flow | Packet | Result | Evidence |
|---|---|---|---|
| P1 — `/owner` gating | Security | **PASS** (logged-out half) | `307 → /auth?redirect=%2Fowner`; browser lands on login form, 0 console errors; `/for-owners` still `200` (1 `h1`, 9 `details`); screenshot 49 182 B |
| P1 — authenticated owner edit | Security | **NOT VERIFIED** | No session. No cake editor mounted, no field edited, no save. Allowlist proven by Task 2 unit tests only |
| P2 — straw amenity on public cafe page @1280 | Owner-facing truth | **PASS** | `ambre-cakes-and-coffee-cebu-city-cebu` (`straw_type='plastic'`) renders amenities `<ul>` ending in the `plastic` straw pill; `innerWidth 1280`; screenshot 436 360 B |
| P2 — no "Remove My Ownership" | Owner-facing truth | **PASS** | 0 hits in `/cafes`, `/for-owners`, `/map` HTML and in the rendered cafe page; only source hit is the guard test asserting absence |
| P3 — dead suggestions route | Dead code | **PASS** (with plan deviation) | `/cafes/<slug>/suggestions` → `307 → /` (not `404`); no `app/cafes/[slug]/suggestions` on disk; final URL `/` returns `200` |
| P3 — nothing links to suggestions | Dead code | **PASS** | 0 suggestion anchors across 6 public pages (190 anchors); 0 in server HTML for 7 pages |
| P4 — analytics gating | Analytics | **PASS** (logged-out half) | `307 → /auth` for `/owner/cafes/<slug>` and `?tab=analytics`; no `500`; no cafe data leaked; `hasAnalyticsContent: false`; screenshot 49 182 B |
| P4 — analytics tab, 90 days, 13 bars, CSV export | Analytics | **NOT VERIFIED** | No session. Bar count never counted, "Views per week" never read, CSV never downloaded. Only `series.test.ts` (7 pass) + source guard exist |
| P5 — `/for-owners` desktop 1280 | Discovery | **PASS** | 1 `h1`, 9 `details`, `max-w-7xl`, `scrollWidth 1280 = innerWidth 1280`; screenshot 244 825 B |
| P5 — `/for-owners` mobile 390 | Discovery | **PASS** | `set viewport 390 844` → `innerWidth 390`, `scrollWidth 390`, `overflows: false`; screenshot 143 391 B |
| P5 — anonymous cafe entry point | Discovery | **PASS** | Unclaimed cafe page: `a[href="/for-owners"]` present, `claimButton: false` |
| P5 — `/submit` entry link | Discovery | **NOT VERIFIED** | `/submit` → `307 /auth`; link exists in source (SubmitPage source guard) but is not visible logged out |
| P5 — `/owner`, `/profile` entry links | Discovery | **NOT VERIFIED** | Both `307 → /auth`; covered by component tests (16 pass), not by a browser |

**Screenshots** (all non-empty, verified with `ls -l`):

```
 49182  screenshots/remediation-owner-edit.png
436360  screenshots/remediation-cafe-straw.png
 49182  screenshots/remediation-analytics.png
244825  screenshots/remediation-for-owners-desktop.png
143391  screenshots/remediation-for-owners-mobile.png
```

**What could not be verified, and why:** the E2E runner has no browser session and no credentials,
so every authenticated surface is out of reach — the owner cafe editor (P1), the analytics tab with
its 90-day bar count and CSV export (P4), and the `/submit`, `/owner`, `/profile` entry points (P5).
The plan anticipated this for some flows but not all: it assumed `/submit` was public (it is not),
assumed the suggestions route returns `404` (it redirects to `/`), and assumed a `/straw/i` text
match would appear on a cafe page (the amenity renders the raw type, `plastic`). Each of those is
recorded above as the deviation, not as a weakened pass.
