# Architectural Specification: Cafe Owner Benefits Page (`/for-owners`)

**Date:** 2026-11-05
**Branch:** `feat/cafe-owner-benefits-page` (cut from `prod`)
**Status:** Awaiting user review before tactical planning (`/2-planning`)

---

## 1. Executive Summary

Build a single public, statically rendered marketing page at `/for-owners` that a GroundsPH user can send to a cafe owner to convince them to claim their listing. It presents the platform's real owner capabilities as a benefit narrative, proves the "free forever" positioning, explains the claim flow, and funnels to two CTAs: browse/claim an existing cafe, or submit a cafe that isn't listed.

The page's hard requirement is **factual accuracy**: every claim must trace to shipped code. A code audit of the owner surface (Appendix A) found twelve real capabilities and eighteen places where the product falls short of what adjacent copy already promises. Those findings are encoded below as mandatory content and as an explicit forbidden-claims list, because a benefits page that overstates is worse than no page at all.

---

## 2. Constraints & Non-Negotiables

### 2.1 Route

The page lives at **`/for-owners`**. This exact path is required, not merely preferred, because three independent guards in the codebase make neighbouring names unsafe:

| Guard | File | Behaviour | Consequence |
|---|---|---|---|
| Auth middleware | `proxy.ts` (`protectedRoutesPrefixes`) | Any path starting with `/owner` requires login | `/owner/benefits` → login wall; `/owners` → login wall |
| Robots | `app/robots.ts` (`disallow`) | `/owner/` disallowed | A benefits page under `/owner/` would be invisible to search |
| Chat widget | `components/chat/ChatWidget.tsx` (`isDisabledForPath`) | Hides chat when the path contains `/owner` | `/owners` would silently lose the chat widget |

`/for-owners` does not match any of the three (`startsWith("/owner")` is false; the string does not contain `/owner`). **`/for-owners` must not be renamed to `/owners` or moved under `/owner/` without also patching all three guards.** Do not add a redirect alias for `/owners`; a config redirect and the middleware interact in a way that is not worth the risk for a vanity URL. Instead, the route's own documentation must carry this warning.

### 2.2 Rendering

- **The page must be a static Server Component.** No `export const dynamic`, no `export const revalidate`, no database access, no server actions, no `cookies()`/`headers()`.
- **Zero client-side JavaScript added for this page.** No `"use client"` components in `app/for-owners/` or `components/owner/OwnerBenefits.tsx`. (This does not restrict edits to *existing* client components such as `ClaimCafeModal.tsx`.) Reason: `next.config.ts` sets `images.unoptimized: true`, so every byte shipped is unoptimised; the page is a shareable link expected to receive bursts of traffic from messaging apps; and the two closest sibling pages (`app/roadmap/page.tsx`, `app/donate/page.tsx`) ship no motion and no client components. The interactive FAQ requirement is satisfied with native `<details>`/`<summary>`, which is accessible by default and works without JS.
- If motion is later requested, the sanctioned recipe is to extract below-the-fold sections into `"use client"` components in `components/owner/` using the `whileInView` + `viewport={{ once: true }}` pattern already used by `components/recent/SubmitCafeSection.tsx`. **v1 does not do this.** CSS `transition-colors` / hover states are permitted and expected.

### 2.3 Factual accuracy (the primary risk)

- **No statistic, number, or testimonial may appear unless it is verifiable.** Specifically forbidden: live cafe counts, "X owners joined", "X% traffic increase", customer quotes, award claims, review scores. The page ships **zero numbers**, which is why it can stay static.
  - Rationale: `getPublishedCafeCount()` exists but requires dynamic rendering, and the homepage already carries that social-proof line. Duplicating it here would force per-request SSR on a marketing page that must never fail.
- **Every benefit statement must map to a line item in Appendix A.** Appendix A is the source of truth. If a statement cannot be traced there, it does not ship.
- **Appendix B is a hard block list.** Those claims are contradicted by current code (or by dead code) and must not appear in any form, including FAQ answers and meta descriptions.

### 2.4 Styling and code conventions

These are drawn from the shipped codebase, not invented:

- Colour: use only the theme tokens from `app/globals.css` — `primary` `#74512D`, `secondary` `#AF8F6F`, `tertiary` `#F1DEC9`, `accent` `#BC6C25`, `background` `#F8F4E1`, `text` `#543310`. No new hex values, except the existing status tints already in use (`emerald`/`amber`/`blue`/`violet` at the `-100`/`-600` steps) for icon chips only.
- **Contrast rule:** `secondary` (#AF8F6F) is a 2.72:1 ratio on `background` and **must never be used for text** — only for graphics (the "PH" in the logo). Body copy uses the `text` opacity ladder: `text-text` → `text-text/70` (lede) → `text-text/60` (body) → `text-text/50` (captions). Minimum body size/contrast must clear WCAG AA.
- Gradients use Tailwind v4 naming: `bg-linear-to-*`. The legacy `bg-gradient-to-*` form is stale in this repo and must not be added.
- Radii: `rounded-lg` for buttons/inputs, `rounded-xl` for cards, `rounded-full` for pills and icon medallions.
- Typography: headings use `font-serif` to match every sibling marketing page (`roadmap`, `donate`, `legal`, `Footer`). Note for the PR description: `docs/brand-guidelines.md` §4.4 says "do not add new `font-serif` usages" because `--font-serif` is commented out in `globals.css`; the entire shipped marketing surface ignores that advisory. **Match the siblings** and carry the inconsistency note into the PR rather than making this page silently divergent.
- There is **no shared `Button`, `Card`, or `Badge` primitive.** Hand-roll markup with the canonical class strings (primary: `bg-primary text-white rounded-lg font-medium hover:bg-primary/90`; quiet/tinted: `bg-primary/10 text-primary`; on-dark: `bg-background text-text`; chip: `bg-primary/15 text-primary` + `rounded-full`).
- Do **not** add `cursor-pointer` to buttons — `app/layout.tsx` applies `[&_button]:cursor-pointer` globally on `<body>`.
- No `dark:` variants. No dark mode exists in this product, and the roadmap lists it as future work.
- Quote style: match the neighbouring marketing page — `className='…'` in single quotes, double-quoted import specifiers. Apostrophes in JSX text use `&apos;` / `{"'"}`.
- Conditional classes inside a page use template literals; `cn()` from `@/utils/cn` is reserved for `components/ui/*` primitives. **Do not introduce a new `components/ui/` primitive as part of this work.**
- Icons: `lucide-react` only, sized `w-4 h-4` (inline), `w-5 h-5` (list items / nav), `w-6 h-6` (feature headers). Feature icons sit in a tinted square/medallion (`w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center`). Decorative background icons are `aria-hidden`.
- Images: **none in v1.** `images.unoptimized: true` means any screenshot would ship at full file size. The page's visual interest comes from icon chips, gradient bands, and typography. If a screenshot is added later, it must be pre-compressed below ~120 KB, imported from `@/assets/`, and given explicit `width`/`height`.
- No new dependencies of any kind.

### 2.5 Accessibility

- One `<h1>`; sections use `<h2>`; benefit cards use `<h3>`.
- Native `<details>`/`<summary>` for the FAQ — keyboard-operable by default, no ARIA plumbing required. Do not reimplement an accordion.
- Decorative icons and background shapes get `aria-hidden` / `pointer-events-none`.
- Visible focus states on both CTAs (the global stylesheet does not guarantee them on hand-rolled anchors).
- The page must be fully readable and actionable with CSS-only and with JS disabled.

### 2.6 SEO

- `metadata` follows the `app/roadmap/page.tsx` shape exactly: `title`, `description`, `keywords` (5–8 long-tail terms a cafe owner would search), `openGraph` (`title`, `description`, `type: "website"`), `twitter` (`card: "summary"`, `title`, `description`).
- Add `alternates: { canonical: "/for-owners" }` — `metadataBase` is already `https://grounds.ph` in `app/layout.tsx`, and `app/blog/page.tsx` establishes the precedent for a relative canonical.
- The root layout title template appends `| GroundsPH`, so the `title` field must not hardcode the brand; the branded variant belongs only in `openGraph.title`.
- Two JSON-LD blocks injected via the established `<script type="application/ld+json" dangerouslySetInnerHTML>` pattern:
  1. `BreadcrumbList` produced by `buildBreadcrumbList()` from `utils/seo/breadcrumbs.ts` (`Home → For Cafe Owners`).
  2. `FAQPage` — **generated from the same data array that renders the FAQ**. Structured data must match visible content exactly; a mismatch is a Google policy violation and an instant source of drift.
- Register the path in `app/sitemap.ts` `staticPages` under the "Community pages" group as `{ path: "/for-owners", changeFrequency: "monthly", priority: 0.6 }`.
- Do not request indexing of `/owner/*`.

---

## 3. System Boundaries

### In scope

1. New route `app/for-owners/page.tsx` (thin: metadata, JSON-LD, composition).
2. New server component `components/owner/OwnerBenefits.tsx` holding all page sections and the content data arrays.
3. Render tests for the component and the page (TDD, red-green-refactor).
4. E2E browser verification of the rendered page and of the route-availability guards.
5. `app/sitemap.ts` entry.
6. Footer link in the "Community" group (see §4.4 / Appendix C).
7. Contextual link from `components/modal/ClaimCafeModal.tsx` (Appendix C, tier 3) — one sentence of additive copy, no logic change.

### Out of scope (explicitly)

- **No database changes.** No migrations, no new tables, no new columns, no schema edits. `docs/superpowers/specs/2026-04-19-free-owner-features-design.md` already removed the pricing infrastructure and this page documents that end state; it does not re-open it.
- **No new server actions** and no changes to `app/api/actions/*`.
- **No auth changes**, no changes to `proxy.ts`, `app/robots.ts`, or `ChatWidget.tsx`.
- **No new navigation item in `utils/routes.ts`.** Rationale in Appendix C — the desktop nav has four items plus search and auth, and a fifth crowds the `md` breakpoint.
- **No fixing of the eighteen product gaps found during the audit** (Appendix A.5). They are recorded here as follow-ups so downstream planning does not absorb them by accident. Two are worth separate tickets: the claim-approval email promising a verified badge that approval does not grant, and the dead "Remove My Ownership" button.
- No i18n, no dark mode, no A/B testing, no analytics instrumentation, no CMS.

### Integration surfaces

| Surface | Direction | Nature |
|---|---|---|
| `app/layout.tsx` | read | Title template, body font, global button cursor |
| `app/globals.css` | read | Theme tokens |
| `utils/seo/breadcrumbs.ts` | read | Breadcrumb JSON-LD |
| `app/sitemap.ts` | modify | One static entry |
| `components/layout/Footer.tsx` | modify | One link |
| `components/modal/ClaimCafeModal.tsx` | modify (optional) | One contextual link |
| Existing public routes `/cafes`, `/submit`, `/auth`, `/contact`, `/legal/terms` | link targets | No changes |

No external services. No third-party scripts. No network calls at render time.

---

## 4. Component Architecture

### 4.1 Files

| File | Kind | Responsibility |
|---|---|---|
| `app/for-owners/page.tsx` | Server Component | Route entry. Exports `metadata`, builds the two JSON-LD payloads, renders the content component. Deliberately thin (~60 lines). |
| `components/owner/OwnerBenefits.tsx` | Server Component (no directive) | All page sections, all content data arrays (benefit groups, steps, FAQ entries) as module-level constants, and local presentational sub-components defined in-file. |
| `components/owner/__tests__/OwnerBenefits.test.tsx` | Test | Primary render tests, including the forbidden-claims guard. |
| `app/for-owners/__tests__/for-owners-page.test.tsx` | Test | Page-level smoke test (h1, CTA hrefs) mirroring `app/roadmap/__tests__/roadmap-page.test.tsx`. |

This split follows the established page→component pattern used by `app/install/page.tsx` → `components/pwa/InstallTutorial.tsx` and `app/contact/page.tsx` → `components/contact/ContactPage.tsx`, and respects `AGENTS.md` ("never place reusable components in `app/`", "add new components to the matching domain folder"). `components/owner/` is the correct domain: the content is owner-specific.

Content data lives with the component (not `utils/`) because it is presentational copy, not a shared helper — matching `app/roadmap/page.tsx`, which keeps its item arrays in-file.

### 4.2 Page composition (section order)

1. **Hero band** — gradient background with decorative `aria-hidden` icons, eyebrow pill ("For Cafe Owners"), `<h1>`, lede, the free-forever reassurance line, and the two primary CTAs.
2. **"Free, and it stays free"** — the positioning block. Four short pillars: no subscription, no commission, no paid tier, no card. This is the single most important section because `ClaimCafeModal` already makes the same promise and the two must not contradict.
3. **Benefit groups** — five groups, each a section header (tinted icon chip + `font-serif` `<h2>`) followed by a card grid. Groups and their contents are fixed by Appendix A.1–A.4.
4. **"How claiming works"** — four numbered steps, with the honest note that a human reviews every claim.
5. **"Included from day one"** — a flat checklist reinforcing that nothing is gated (no tiers exist).
6. **FAQ** — native `<details>` list. Content constrained by Appendix A/B.
7. **Closing CTA band** — the on-accent band treatment (`bg-linear-to-br from-secondary via-primary/80 to-secondary`), primary CTA "Claim your cafe", secondary "Submit a cafe we're missing", and a quiet line inviting contact if the cafe is already claimed.
8. **Footer note** — a quiet line linking Terms and Content Policy. **Omit any "last updated" line**: nothing would maintain it, and a stale date on a marketing page reads as abandonment.

### 4.3 CTA targets and semantics

Two and only two primary destinations, because the visitor is a cafe owner who may not be a GroundsPH user yet:

| CTA | Target | Intent |
|---|---|---|
| Primary — "Claim your cafe" | `/cafes` | Find the listing, then claim from the cafe page. Anonymous-safe. |
| Secondary — "Add a cafe we're missing" | `/submit` | For cafes not yet on Grounds; `/submit` requires auth, and `proxy.ts` handles the redirect with `?redirect=` intact. |

Supporting links: `/contact` (already-claimed handling), `/legal/terms`, `/legal/content-policy`. All must be real routes — verified: `/cafes`, `/submit`, `/contact`, `/legal/*` exist. Do **not** link `/events` (dead link already present in the footer) or `/cafes/[slug]/suggestions` (dead route).

The page must not assume the visitor is signed in. This matters because the in-product claim entry point (`components/cafe/CafeHero.tsx`) renders "Own this cafe? Claim it" **only when `user` is truthy** — so an anonymous cafe owner currently has no in-product path at all. `/for-owners` is that path.

### 4.4 Communication patterns

None. No async boundaries, no events, no client/server messaging. The component receives no props; all content is module constants. This is intentional: a page with no inputs cannot fail at runtime.

---

## 5. Data Flow

### 5.1 Render path

```
Build time (Dokploy)
  └─ Next prerenders /for-owners
        ├─ page.tsx: metadata → <head>
        ├─ page.tsx: BreadcrumbList JSON-LD (from utils/seo/breadcrumbs.ts)
        ├─ page.tsx: FAQPage JSON-LD (from the same array that renders the FAQ)
        └─ <OwnerBenefits />  → static HTML
Request time
  └─ CDN/edge serves prerendered HTML. No server render. No DB. No client hydration.
```

### 5.2 State ownership

| State | Owner | Lifetime |
|---|---|---|
| Page content | Module constants in `OwnerBenefits.tsx` | Compile time |
| FAQ open/closed | Browser, native `<details>` | Session, no persistence |
| Nothing else | — | — |

No client state, no cache, no cookies, no `localStorage`. This page deliberately does not participate in the dismissible-banner pattern (`MiniSubmitCafeBanner`) — that pattern exists for in-app nudges, not public marketing.

### 5.3 Bottlenecks and optimisation targets

The page has no server work to be slow. The remaining budgets, in priority order:

1. **HTML weight.** Target under ~35 KB of markup. Achieved by using no images and no client JS. This is the difference between the page and a screenshot-heavy landing page.
2. **LCP.** With zero images and zero JS, LCP is a text node. Because `images.unoptimized: true` ships unoptimised assets, any future screenshot must be budgeted manually (see §2.4).
3. **Build safety.** Because the page touches no database, it cannot break the Dokploy build the way a data-fetching page could (`app/page.tsx` needs `force-dynamic` precisely because the build environment cannot reach the DB). **This is a load-bearing property: do not add a DB-backed counter to this page.**
4. **Shared-link performance.** The page will be opened from Messenger/Viber on mobile over cellular. First-paint on a prerendered, image-free page is effectively instant; no additional optimisation is required.

Not applicable: pagination, indexing, caching layers, lazy loading.

---

## 6. Security & Error Handling

### 6.1 Threat model

The page is static content with no inputs, no queries, and no user data, which removes the usual classes of risk. Residual surface:

| Risk | Status | Mitigation |
|---|---|---|
| XSS / injection | Not reachable | No user-supplied content, no `searchParams`, no dynamic `dangerouslySetInnerHTML` beyond `JSON.stringify` of static literals. Keep it that way: **never** render `searchParams` or a title into this page. |
| Auth bypass | N/A | Route is intentionally public; it must **not** touch protected data. Adding any owner-identifying content would create a leak — the page must never query per-user data. |
| Data leak | None | Nothing sensitive is referenced. Ownership-proof documents (`getOwnershipProofSignedUrl`) must never be mentioned in a way that suggests public access; they are admin-only, 1-hour signed URLs. |
| Phishing / impersonation | Low | The page must not imply that claiming grants authority to edit others' content or that verification is automatic. See Appendix B. |
| SEO abuse / cloaking | None | Static single version for all agents; no user-agent branching. |
| PII / cookies | None | The page sets no cookies, runs no analytics, embeds no third-party scripts. Do not add a page-view tracker. |
| Content drift | **Highest real risk** | Copy will silently diverge from the product as features change. Mitigation: the forbidden-claims guard test (§8.1) plus the Appendix A traceability requirement. |

Nothing here needs authentication, authorisation, validation, or rate limiting.

### 6.2 Failure philosophy

Fail-closed by construction: the page cannot partially fail, because it has no dependencies at render time. If the build breaks, it breaks loudly and the previously deployed page keeps serving.

### 6.3 Logging and monitoring

None added. There is no server behaviour to observe. Client error tracking is not installed in this project and must not be introduced here.

---

## 7. Migration & Rollback

- **Database migrations:** none. This work is schema-neutral.
- **Backward compatibility:** fully additive. One new route, one sitemap entry, one footer link, one optional in-modal link. No existing route, action, component contract, or export changes. No file is deleted or renamed.
- **Rollback:** single revert of the squashed commit. The route simply 404s afterwards; the footer link must be reverted in the same commit, otherwise it becomes a dead link. Nothing else in the product depends on the page.
- **No redirects** are introduced (see §2.1 on why `/owners` is not aliased).
- **Deploy note:** after the Gitea squash-merge, `prod` must be pushed to the `github` remote or Dokploy will not rebuild, and the page will never reach production. Per `AGENTS.md`, the change is not finished until Dokploy has picked it up.

---

## 8. Testing Strategy

### 8.1 Unit / integration (TDD, mandatory)

Red-green-refactor per file; tests live in `__tests__/` next to the source and are excluded from `tsconfig` compilation. Use `bun:test` with `@testing-library/react` and `expect(...).toBeTruthy()` assertions — `@testing-library/jest-dom` is **not** installed, so no `toBeInTheDocument`. Always `afterEach(cleanup)`. `whileInView` never fires under the JSDOM preload (`IntersectionObserver` is not polyfilled), so assert on static text and attributes only — never on animation state.

Required coverage, in the order it should be written:

1. **Structure** — the `<h1>` renders; each of the five benefit groups renders its heading; each benefit card renders its title and body.
2. **CTAs** — exactly two primary CTAs; "Claim your cafe" resolves to `/cafes`; "Add a cafe we're missing" resolves to `/submit`; every internal href starts with `/` and points at a route that exists.
3. **Free-forever pillar** — the no-subscription / no-commission / no-tier statements are present. This is the promise `ClaimCafeModal` already makes; the test protects the parity.
4. **Claim flow** — all four steps render, including the human-review note.
5. **FAQ** — every question renders as a `<summary>` with a matching answer; the array used for `FAQPage` JSON-LD is the same array rendered.
6. **Forbidden-claims guard (the most valuable test).** Negative assertion over the rendered text content, with a comment pointing at Appendix B. Assert absence of these exact phrases, which are unambiguous and cannot appear in legitimate copy: `verified badge`, `0% commission`, `Unlimited photos`/`unlimited photos`, `instant publish`, `Export your analytics`, `approve community menu suggestions`. **Do not** assert absence of the bare words `commission` or `export` — Appendix B explicitly permits "no commission, no fees", and generic words would create false failures. This is the regression test that keeps marketing honest as the product evolves.
7. **Page-level smoke** — `app/for-owners/__tests__/for-owners-page.test.tsx` renders the page and asserts the brand promise line and CTA present, matching the roadmap test's brevity.

No server actions to mock. No auth to mock. If a test needs a mock for `next/link` or `next/image`, prefer not needing one at all: the component should use plain `next/link`, which renders fine under the existing JSDOM setup (the roadmap page does exactly this).

### 8.2 E2E browser testing — **OPTED-IN**

Verified with the `agent_browser` tool against the local HTTPS dev server (`bun dev`, self-signed cert). Screenshots saved to `docs/superpowers/e2e/`.

Critical flows to cover:

1. **Route is public — the highest-value check.** Navigate directly to `/for-owners` while logged out and confirm HTTP 200 with the `<h1>` present, **not** a redirect to `/auth`. This directly regression-tests the `proxy.ts` `/owner` prefix guard that made `/owners` unusable, and would catch a future guard change.
2. **Full render.** Every section from §4.2 is visible on a desktop viewport; capture `for-owners-desktop.png`.
3. **CTAs navigate.** Click "Claim your cafe" → lands on `/cafes`. Click "Add a cafe we're missing" while logged out → lands on `/auth` carrying a redirect parameter that resolves to `/submit` (accept either encoding of the slash; the assertion is that the auth redirect fires with `/submit` preserved, not a 404 or a broken link).
4. **Mobile viewport.** Re-render at a phone width; confirm no horizontal overflow, the CTA band is tappable, and the hero heading does not clip. Capture `for-owners-mobile.png`.
5. **FAQ keyboard operability.** Focus the first `<summary>`, press Enter/Space, confirm the answer expands (native `<details>` behaviour) and the content is readable.
6. **No-JS resilience (optional but cheap).** With JavaScript disabled, the page and FAQ still fully work. This validates the zero-client-JS decision.
7. **SEO artefacts.** `/sitemap.xml` includes `/for-owners`; `/robots.txt` does not disallow it; the rendered HTML contains both JSON-LD blocks and the canonical link. Assert the `FAQPage` entry count matches the rendered FAQ count.
8. **Footer link.** From `/`, the footer "Community" group exposes "For Cafe Owners" and it resolves to the page.

Screenshot artefacts must be verified against the tool's `artifactVerification` before being reported as captured.

---

## 9. Decisions Recorded (formerly open questions)

These were ambiguous during analysis and are now settled so planning has no gaps:

1. **Live social proof (e.g. "1,200 cafes") — rejected.** It would force dynamic rendering and re-introduce build fragility. The homepage already carries the live count. Documented in §2.3.
2. **Motion/animation — rejected for v1.** Matches the closest siblings and preserves the zero-JS property; the sanctioned opt-in recipe is recorded in §2.2.
3. **Screenshots of the dashboard — rejected for v1.** `images.unoptimized: true` makes screenshots expensive and they rot as the UI changes, becoming a second source of drift.
4. **`/owners` alias redirect — rejected.** The middleware/redirect interaction is not worth the risk. Documented in §2.1.
5. **Top-level nav item — rejected**; footer plus two contextual links instead. Rationale in Appendix C.
6. **Fix the claim-approval email's false "verified badge" promise — deferred.** It is a real defect (`emails/ClaimApprovedEmail.tsx` promises a badge that `approveClaim()` never grants, and `isVerified` is only ever set by admin tooling), but it is a separate change. The benefits page must not repeat the claim. Recommend a follow-up ticket.
7. **Content lives in the component, not `utils/`.** Matches the roadmap precedent; it is copy, not shared logic.

No open questions remain. Anything the planning phase wants to change should be raised as a spec amendment, not absorbed silently.

---

## Appendix A — Verified benefit inventory (source of truth for copy)

Every row was read in code. Line numbers are indicative and may drift; the file/function pair is the durable reference.

### A.1 Own your listing

| Benefit | Detail worth saying out loud | Evidence |
|---|---|---|
| Self-service editing, no approval queue | Name, description, address/pin, region/province/city, price level, roaster, amenities, hours, contact, socials, tags, brew methods, payment methods. Edits go live immediately — unlike community edit suggestions, which are admin-moderated. | `updateCafeAsOwner` in `app/api/actions/owner.ts`; contrast `approveSuggestion` in `app/api/actions/suggestions.ts` |
| Cover + gallery photos | Up to **12** gallery images plus a cover. Drag to reorder, delete, download. Auto-saves ~600 ms after a change. Per-file limit **5 MB**. | `utils/validation/cafe-images.ts` (`MAX_CAFE_GALLERY = 12`), `utils/hooks/useCafeImages.ts`, `components/cafe-editor/ImageSection.tsx` |
| Your story | Long-form markdown narrative on the cafe page. | `updateCafeStory` in `owner.ts`; rendered in `components/cafe/CafeDetails.tsx` |
| Hidden Gem mode | Mark the cafe as a hidden gem with a 200-character finding hint; location is shown approximately; graduates automatically past a unique-visitor threshold. | `CafeEdit.tsx` hidden-gem controls; `app/api/actions/hidden-gems.ts` (`HIDDEN_GEM_VISITOR_THRESHOLD`, default 50) |
| Custom collectible stamp | Upload a PNG stamp (**≤ 500 KB**) that becomes the stamp customers collect in their Passport, and that is composited into the downloadable check-in QR poster. **Not displayed on the cafe page itself.** | `setCafeBadgeStamp` / `removeCafeBadgeStamp` in `owner.ts`; `components/profile/Passport.tsx`; `utils/validation/badge-stamp.ts` |

### A.2 Get found

| Benefit | Detail | Evidence |
|---|---|---|
| A real public page | Full cafe detail page with hero, amenities, hours, gallery, map, reviews. | `app/cafes/[slug]/page.tsx`, `components/cafe/*` |
| A dedicated menu page | `/cafes/[slug]/menu`, reachable by QR. | `app/cafes/[slug]/menu/page.tsx` |
| Full menu control | Categories, prices (₱), photos, descriptions, size options, availability toggle, food/hot/cold, vegan/vegetarian, calories, signature flag. Unlimited items. | `addMenuItem` / `updateMenuItem` / `deleteMenuItem` in `owner.ts`; `components/cafe-editor/MenuItemModal.tsx` |
| Menu photo import | Photograph the printed menu; AI extracts items and skips ones you already have. | `app/api/actions/menu-ocr.ts`; `components/suggestions/MenuOcrScanButton.tsx` |
| Discovery surfaces | Map, search, cafe listings, monthly leaderboard, check-ins. | `app/map`, `app/cafes`, `app/api/actions/leaderboard.ts` |
| Events | Owners can create and publish events for their cafe; owner-created events go live on the owner's action. | `app/api/actions/events.ts` (`createEvent` permits the linked cafe's owner), `components/events/EventEditor.tsx` |
| Blog posts | Owners may write posts attached to their cafe. **Publishing requires review** (non-admin submissions are coerced to pending and content-checked). | `app/api/actions/blog.ts`; `utils/blog/moderation.ts`; `utils/blog/community-posting.ts` |
| Printable QR codes | Branded check-in QR (with the custom stamp composited) and a menu QR, both downloadable as PNG. | `components/owner/CafeManagement.tsx` QR sections |

### A.3 Bring customers in

| Benefit | Detail | Evidence |
|---|---|---|
| Discount campaigns | Percentage, fixed amount, or free item. Caps on total redemptions, per-customer limits, minimum spend, start/end schedule, code prefix, public visibility toggle, QR toggle, terms. Draft → active → paused → archived. | `createCampaign` / `updateCampaign` / `deleteCampaign` in `app/api/actions/discount.ts`; `utils/validation/discount.ts`; `components/owner/CreateCampaignForm.tsx` |
| Voucher generation | Up to **1,000** codes per batch; never exceeds the campaign cap; copy-all and CSV download. Generating on a draft activates it. | `generateVouchers` in `discount.ts`; `components/owner/GenerateVouchersModal.tsx` |
| QR voucher handout | A campaign QR that hands the customer a voucher. | `components/owner/CampaignQRCode.tsx`; `app/api/discount/claim/[campaignId]/route.ts` |
| Public discounts block | Active, in-window public campaigns appear on the cafe page with a claim button. | `getPublicCampaignsForCafe` in `discount.ts`; `components/cafe/CafeDiscounts.tsx` |
| In-store redemption | Look up a code, preview the voucher, confirm redemption; invalid/expired/already-used states handled. | `lookupVoucherByCode` / `redeemVoucher` in `discount.ts`; `components/owner/VoucherRedeemPanel.tsx` |
| Voucher tracking | Status filters, per-campaign counts, cancellation of unused codes, paginated redemption logs. | `components/owner/VoucherTable.tsx`, `RedemptionLogsTable.tsx` |
| No commission | The platform models no fees, no payouts, and moves no money. | No payment code in `discount.ts`; subscription infra removed per the 2026-04-19 spec |

### A.4 Know what's working

| Benefit | Detail | Evidence |
|---|---|---|
| Page analytics | Page views, unique visitors, per-day trend chart, device breakdown (mobile/desktop/tablet), top 5 referrer domains, over **7 / 30 / 90 days**. | `getCafeAnalytics` in `app/api/actions/analytics.ts`; rendered in `components/owner/CafeManagement.tsx` |
| Review responses | Reply publicly as the owner (rendered with an **Owner** badge and avatar); edit or delete the reply. | `respondToReview` / `deleteReviewResponse` in `owner.ts`; `components/reviews/ReviewItem.tsx` |
| Pin reviews | Pin up to **3** reviews; pinned reviews sort to the top of the public list. | `pinReview` / `unpinReview` in `owner.ts` (`Maximum 3 reviews can be pinned`) |
| Pending-response queue | Dashboard surfaces how many reviews are waiting for a reply. | `getOwnedCafes` in `owner.ts`; `components/owner/OwnerDashboard.tsx` |
| Rating distribution | 5★→1★ breakdown alongside the average. | `CafeManagement.tsx` analytics tab |
| Back-of-house inventory | Items with category, stock, low-stock warning threshold, cost price, expiry, link. Valuation total, low-stock count, quick adjust, restock with history, duplicate, archive/restore, filters, **CSV export**. Never shown publicly. | `app/api/actions/inventory.ts`; `components/owner/InventoryDashboard.tsx` |

### A.5 Known product gaps — do not market, and do not fix here

These were found while auditing. They are recorded so planning does not accidentally promise them:

1. The claim-approval email promises "a verified badge on your listing", but `approveClaim()` only sets `ownerIds` and `isClaimed`; `isVerified` is admin-granted only.
2. The owner verification-request flow (`submitVerificationRequest` / `getVerificationStatus`) is orphaned — no UI calls it.
3. The custom badge stamp is not rendered on the cafe page (Passport only).
4. Owners cannot moderate community menu suggestions; admins do, and the "review suggestions" link points at a route that does not exist.
5. The "Remove My Ownership" button has no handler.
6. Amenity edits for decaf/halal/straw are collected in the UI but dropped by the owner save payload.
7. Inventory SKU and description are collected but not persisted; restock supplier/invoice/order-reference are dropped.
8. Two voucher/payout actions (`issueVoucherToUser`, `getOwnerCampaigns`) have no UI.
9. Analytics has no export; the 90-day view's bar chart is capped at 30 bars; a collected country field is not surfaced.
10. Owners cannot publish/unpublish or delete their cafe.

---

## Appendix B — Forbidden claims (hard block list)

Any phrasing that asserts the following must not appear anywhere on the page, including metadata, the ledger of pillars, and FAQ answers:

| Never say | Because |
|---|---|
| "Get verified when you claim" / "verified badge included" / implies a checkmark on claiming | `approveClaim()` never sets `isVerified`; it is admin-only. The existing approval email is already wrong about this. |
| "Your stamp appears on your cafe page" | The badge stamp renders in customers' Passports, not on `components/cafe/*`. |
| "Get verified as an owner" (as a workflow) | The verification-request flow is dead code with no UI. |
| "Moderate/approve community menu suggestions" | Admin-only; the owner sees a read-only count. |
| "Unlimited photos" | Gallery is capped at 12 (plus a cover). |
| "Publish blog posts instantly" | Non-admin posts require review before publishing. Phrase as "write posts for your cafe; our team reviews them before they go live." |
| "Export your analytics" / "download a report" | No export exists. |
| "Track supplier, invoice, or SKU details" | Collected in the UI but not persisted. |
| "We take a 0% commission" stated as a *rate* | True in effect, but the product models no payouts at all; state it as "no commission, no fees" rather than implying a payment pipeline exists. |
| Any customer testimonial, owner count, view count, growth percentage, award, or "trusted by" | Nothing verifiable exists; the page ships zero numbers. |
| "Instant approval" / "< 24 hours" | Approval is manual; no SLA exists. Say "a human reviews every claim". |

Also: do not describe ownership proofs as public or downloadable — they are admin-only, 1-hour signed URLs. Do not imply claiming overrides an existing owner (once claimed, a second claim is blocked; route those visitors to `/contact`).

---

## Appendix C — Link placement recommendation (ranked)

**Tier 1 — Do it now (in this change).**
`components/layout/Footer.tsx`, "Community" group, immediately after "Submit a Cafe". Label: **For Cafe Owners**. Reuses the existing link class string, costs one block, gives every page of the site a permanent indexed path to the page, and requires no nav-layout risk.

**Tier 2 — Do it now (in this change).**
`app/sitemap.ts` static entry, so the page is discoverable by search without any UI link.

**Tier 3 — Small, high-intent, recommended.**
`components/modal/ClaimCafeModal.tsx` — add one quiet line to the existing "It is completely free to claim and manage your business on Grounds." paragraph, linking to `/for-owners` ("See everything you get"). This is the single best placement in the whole product: the person reading it is *already* trying to claim a cafe and deciding whether it's worth it. Additive copy only.

**Tier 4 — Deliberately not in this change; list as follow-ups.**
- `components/cafe/CafeHero.tsx` claim button area: link "Why claim?" for **anonymous** visitors. Note the current guard hides the claim button entirely when logged out, which is precisely the visitor `/for-owners` is built for — worth a separate ticket.
- `components/owner/OwnerDashboard.tsx` empty state ("You haven't claimed any cafes yet"): add a benefits link beside "Browse Cafes to Claim".
- `components/recent/SubmitCafeSection.tsx` (homepage CTA band): add a second, quieter line — "Own a cafe? Claim it free" — linking to `/for-owners`. Zero new layout, and it reaches the whole anonymous homepage audience.
- `components/profile/Profile.tsx` owned-cafes panel.

**Explicitly rejected: a top-level navbar item.** `utils/routes.ts` currently holds four lowercase items and the desktop nav also carries search plus auth controls; a fifth crowds the `md` breakpoint, and the footer already exists to absorb exactly this kind of link. Revisit only if the page proves to be a primary acquisition channel.

**Do not** add the link inside `/owner/*` (owners have already claimed — they are not the audience) or as a homepage hero CTA (it would compete with the cafe-discovery hero, which serves the actual user base).

---

## Appendix D — Content outline with claim-to-evidence mapping

Section-by-section intent, so the copywriter cannot drift. Every bullet names the Appendix A row it draws from.

**Hero.** Audience: a cafe owner who has never heard of Grounds. Promise: your listing, on the platform people in Cebu already use to find cafes, fully in your control, free. CTAs per §4.3. Include the free-forever reassurance inline so the first screen answers the first objection.

**Free, and it stays free.** Four pillars (A.3 "No commission"; §2.3 / 2026-04-19 spec for no subscription/tier/card). Add one honest sentence: optional donations support the platform and are unrelated to owning a cafe.

**Own your listing** (A.1). Lead with "changes go live immediately, no approval queue" — this is the strongest differentiator against community-moderated edits.

**Get found** (A.2). Emphasise the menu page and QR codes; phrase blog publishing as reviewed (Appendix B).

**Bring customers in** (A.3). The headline feature. Say "you keep 100% of the sale"; do not model a payment pipeline.

**Hear what customers think** (A.4 review rows). Owner badge, replies, pin up to three.

**See what's working** (A.4 analytics rows). Name the metrics and the 7/30/90 windows; no export.

**Run the back of house** (A.4 inventory row). Frame as optional internal tooling, not a customer-facing feature.

**How claiming works.** Four steps: find your cafe (or add it) → sign in and hit "Claim this cafe" → tell us who you are, with an optional business permit or ID (PDF/JPG/PNG, 10 MB) → a human reviews it and emails you either way. Include the already-claimed escape hatch to `/contact`.

**Included from day one.** Flat checklist; reinforces that no tier exists.

**FAQ.** Suggested set, each answerable strictly inside Appendix A: Is it really free? Do you take a cut of my discounts? How long does claiming take? What proof do you need? Can I add a cafe that isn't listed? My cafe is already claimed — what now? Who can edit my cafe after I claim it? Can I publish events and blog posts? Can I keep my own photos and menu? What happens to my data? (link Terms + Content Policy, invent no promises).
