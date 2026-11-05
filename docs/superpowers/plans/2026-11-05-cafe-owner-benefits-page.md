# Cafe Owner Benefits Page Implementation Plan

> For agentic workers: use `subagent-driven-development` or `executing-plans` to implement this plan task by task. Every task is a complete RED → GREEN → REFACTOR → COMMIT cycle. Never skip the RED step — run the test and see it fail before writing implementation code.

**Goal:** Ship a public, statically rendered marketing page at `/for-owners` that a GroundsPH user can send to a cafe owner to convince them to claim their listing — every claim traceable to shipped code, zero client-side JavaScript, zero fabricated statistics.

**Architectural spec:** `docs/superpowers/specs/2026-11-05-architectural-spec.md`
**Branch:** `feat/cafe-owner-benefits-page` (already cut from `prod`)
**Default branch is `prod`.** Commits below land on the feature branch. Do not push to `prod`.

---

## Non-negotiables (read before Task 1)

1. **Route is `/for-owners`.** Never `/owners` and never under `/owner/` — `proxy.ts` (`protectedRoutesPrefixes: ["/owner"]`), `app/robots.ts` (`disallow: "/owner/"`) and `components/chat/ChatWidget.tsx` (`curPath.includes("/owner")`) each break that name. This is verified by E2E Task 14.
2. **The page is a static Server Component.** No `export const dynamic`, no `export const revalidate`, no database access, no server actions, no `cookies()`/`headers()`.
3. **Zero `"use client"`.** `app/for-owners/page.tsx`, `components/owner/OwnerBenefits.tsx` and `components/owner/owner-benefits-content.ts` are all server-side. The FAQ uses native `<details>`/`<summary>`.
4. **Zero statistics.** No cafe counts, no "X owners", no percentages, no testimonials. Feature limits that exist in code (`12` gallery images, `1,000` vouchers per batch, `7/30/90` day analytics, `10 MB` proof upload) **are** allowed because they are verifiable — see spec Appendix A.
5. **Spec Appendix B is a hard block list.** Never write: "verified badge", "0% commission", "unlimited photos", "instant publish", "export your analytics", "approve community menu suggestions". The guard test in Task 12 enforces this.
6. **Styling:** Tailwind tokens only (`primary`, `secondary`, `tertiary`, `accent`, `background`, `text`). `bg-linear-to-*` (not the legacy `bg-gradient-to-*`). `rounded-xl` cards, `rounded-lg` buttons, `rounded-full` pills. Headings `font-serif`. **Never** `text-secondary` for text — 2.72:1 contrast. No `dark:` variants. No `cursor-pointer` on buttons (`app/layout.tsx` applies it globally). No new dependencies.
7. **Quote style:** `className='…'` single quotes in JSX, double-quoted import specifiers — matches `app/roadmap/page.tsx`.

---

## Deviation from spec (documented, one item)

The spec's file table (§4.1) puts the content arrays inside `OwnerBenefits.tsx`. This plan extracts them to a sibling module `components/owner/owner-benefits-content.ts`, for two reasons:

1. `app/for-owners/page.tsx` needs `FAQ_ITEMS` to build the `FAQPage` JSON-LD. Importing content from a component file to feed structured data is the wrong dependency direction.
2. It lets the content be unit-tested as plain data (shape, uniqueness, forbidden phrases) without rendering React, which is what makes Task 2's content-level guard test possible.

This still satisfies the spec's actual constraint — content lives in the `components/owner/` domain, **not** in `utils/` — and satisfies its stated design principle ("smaller, focused files over large monolithic ones"). No other deviation.

---

## File structure

### Create

| Path | Purpose |
|---|---|
| `components/owner/owner-benefits-content.ts` | Single source of truth for all page copy and content data: hero, free pillars, benefit groups, claim steps, inclusions, FAQ, CTAs. Plain data, no JSX. |
| `components/owner/OwnerBenefits.tsx` | Server component rendering every page section from the content module. |
| `app/for-owners/page.tsx` | Route entry. Exports `metadata`, builds `BreadcrumbList` + `FAQPage` JSON-LD, renders `<OwnerBenefits />`. Thin (~70 lines). |
| `components/owner/__tests__/owner-benefits-content.test.ts` | Content shape, href validity, uniqueness, forbidden-phrase scan. |
| `components/owner/__tests__/OwnerBenefits.test.tsx` | Section render tests, CTA hrefs, heading order, forbidden-claims render guard. |
| `app/for-owners/__tests__/for-owners-page.test.tsx` | Page smoke test + JSON-LD parity assertions. |
| `app/__tests__/sitemap.test.ts` | Asserts `/for-owners` is registered in the sitemap. |
| `components/layout/__tests__/Footer.test.tsx` | Asserts the footer exposes the "For Cafe Owners" link. |
| `components/modal/__tests__/ClaimCafeModal.test.tsx` | Asserts the claim modal links to the benefits page and keeps its free-to-claim copy. |
| `docs/superpowers/e2e/for-owners.md` | E2E script, results, screenshot references (Phase 5). |
| `docs/superpowers/e2e/screenshots/for-owners-desktop.png` | E2E evidence (Phase 5). |
| `docs/superpowers/e2e/screenshots/for-owners-mobile.png` | E2E evidence (Phase 5). |

### Modify

| Path | Change |
|---|---|
| `app/sitemap.ts` | Add `{ path: "/for-owners", changeFrequency: "monthly", priority: 0.6 }` to `staticPages`, in the "Community pages" group (after the `/submit` entry, around line 70). |
| `components/layout/Footer.tsx` | Add a "For Cafe Owners" `<Link>` in the "Community" group immediately after "Submit a Cafe" (lines ~108–115). |
| `components/modal/ClaimCafeModal.tsx` | Extend the existing "It is completely free to claim…" paragraph (lines ~195–200) with one sentence linking to `/for-owners`. Copy only, no logic change. |

### Explicitly untouched

`proxy.ts`, `app/robots.ts`, `components/chat/ChatWidget.tsx`, `utils/routes.ts`, every file under `app/api/`, `db/`, `drizzle/`, `emails/`. No database migration. No new dependency.

---

## Phase 1: Foundation

### Task 1: Content contract — hero, pillars, benefit groups, CTAs

**Files:**
- Create: `components/owner/owner-benefits-content.ts`
- Test: `components/owner/__tests__/owner-benefits-content.test.ts`

**Dependencies:** None. This is the root of the dependency graph.

**TDD Cycle:**

- [x] **RED: Write the failing test**

  Create `components/owner/__tests__/owner-benefits-content.test.ts`:

  ```typescript
  import { describe, it, expect } from "bun:test"
  import {
      HERO,
      PRIMARY_CTA,
      SECONDARY_CTA,
      CONTACT_CTA,
      FREE_PILLARS,
      FREE_PILLARS_NOTE,
      BENEFIT_GROUPS,
  } from "@/components/owner/owner-benefits-content"

  describe("owner benefits content — hero and calls to action", () => {
      it("has an eyebrow, a headline and a lede", () => {
          expect(HERO.eyebrow).toBe("For Cafe Owners")
          expect(HERO.heading.length).toBeGreaterThan(10)
          expect(HERO.lede.length).toBeGreaterThan(50)
      })

      it("answers the cost question on the first screen", () => {
          expect(HERO.reassurance).toContain("Free to claim")
          expect(HERO.reassurance.toLowerCase()).toContain("no subscription")
          expect(HERO.reassurance.toLowerCase()).toContain("no commission")
      })

      it("points the primary call to action at the cafe list", () => {
          expect(PRIMARY_CTA.label).toBe("Claim your cafe")
          expect(PRIMARY_CTA.href).toBe("/cafes")
      })

      it("points the secondary call to action at the submit form", () => {
          expect(SECONDARY_CTA.href).toBe("/submit")
      })

      it("only uses internal hrefs", () => {
          for (const cta of [PRIMARY_CTA, SECONDARY_CTA, CONTACT_CTA]) {
              expect(cta.href.startsWith("/")).toBe(true)
          }
      })
  })

  describe("owner benefits content — free pillars", () => {
      it("states the four no-cost pillars in order", () => {
          expect(FREE_PILLARS.length).toBe(4)
          expect(FREE_PILLARS.map((p) => p.title)).toEqual([
              "No subscription",
              "No commission",
              "No tiers",
              "No card",
          ])
      })

      it("gives every pillar a description and an icon", () => {
          for (const pillar of FREE_PILLARS) {
              expect(pillar.description.length).toBeGreaterThan(20)
              expect(pillar.icon).toBeTruthy()
          }
      })

      it("explains that optional donations do not gate access", () => {
          expect(FREE_PILLARS_NOTE.toLowerCase()).toContain("optional")
          expect(FREE_PILLARS_NOTE.toLowerCase()).toContain("changes nothing")
      })
  })

  describe("owner benefits content — benefit groups", () => {
      it("has five groups with unique ids and titles", () => {
          expect(BENEFIT_GROUPS.length).toBe(5)
          expect(new Set(BENEFIT_GROUPS.map((g) => g.id)).size).toBe(5)
          expect(new Set(BENEFIT_GROUPS.map((g) => g.title)).size).toBe(5)
      })

      it("names the five groups in narrative order", () => {
          expect(BENEFIT_GROUPS.map((g) => g.title)).toEqual([
              "Own your listing",
              "Get found",
              "Bring customers in",
              "Hear your customers",
              "Know what is working",
          ])
      })

      it("gives every group at least four benefits with copy and an icon", () => {
          for (const group of BENEFIT_GROUPS) {
              expect(group.items.length).toBeGreaterThanOrEqual(4)
              expect(group.intro.length).toBeGreaterThan(30)
              expect(group.icon).toBeTruthy()
              expect(group.accent.startsWith("bg-")).toBe(true)
              for (const item of group.items) {
                  expect(item.title.length).toBeGreaterThan(5)
                  expect(item.description.length).toBeGreaterThan(40)
                  expect(item.icon).toBeTruthy()
              }
          }
      })

      it("does not repeat a benefit title", () => {
          const titles = BENEFIT_GROUPS.flatMap((g) => g.items.map((i) => i.title))
          expect(new Set(titles).size).toBe(titles.length)
      })
  })
  ```

- [x] **RED: Verify the test fails**

  Run: `bun test --isolate components/owner/__tests__/owner-benefits-content.test.ts`

  Expected: FAIL — `error: Cannot find module "@/components/owner/owner-benefits-content"` (the module does not exist yet).

- [x] **GREEN: Write minimal implementation**

  Create `components/owner/owner-benefits-content.ts` with exactly this content. Every string below is final copy — do not paraphrase it, and do not add statistics.

  ```typescript
  import {
      Wallet,
      ReceiptText,
      Layers,
      CreditCard,
      Store,
      PenLine,
      Images,
      BookOpen,
      Gem,
      Stamp,
      Compass,
      LayoutPanelTop,
      UtensilsCrossed,
      ScanLine,
      CalendarDays,
      QrCode,
      Ticket,
      Percent,
      TicketCheck,
      MousePointerClick,
      ClipboardCheck,
      ShieldCheck,
      MessageSquare,
      Reply,
      PencilLine,
      Pin,
      BellRing,
      LineChart,
      Eye,
      Globe,
      Star,
      Boxes,
  } from "lucide-react"
  import type { LucideIcon } from "lucide-react"

  export interface CtaLink {
      label: string
      href: string
  }

  export interface FreePillar {
      title: string
      description: string
      icon: LucideIcon
  }

  export interface BenefitItem {
      title: string
      description: string
      icon: LucideIcon
  }

  export interface BenefitGroup {
      id: string
      title: string
      intro: string
      icon: LucideIcon
      accent: string
      items: BenefitItem[]
  }

  export const HERO = {
      eyebrow: "For Cafe Owners",
      heading: "Your cafe, finally yours online",
      lede: "Grounds is where people across the Philippines look for their next cafe. Claim your listing and you control what they find — the photos, the menu, the story, and your reply to every review.",
      reassurance:
          "Free to claim. Free to manage. No subscription, no commission, no card.",
  } as const

  export const PRIMARY_CTA: CtaLink = {
      label: "Claim your cafe",
      href: "/cafes",
  }

  export const SECONDARY_CTA: CtaLink = {
      label: "Add a cafe we're missing",
      href: "/submit",
  }

  export const CONTACT_CTA: CtaLink = {
      label: "Contact us",
      href: "/contact",
  }

  export const FREE_PILLARS_HEADING = "Free, and it stays free"

  export const FREE_PILLARS: FreePillar[] = [
      {
          title: "No subscription",
          description:
              "There is no paid plan, no trial period, and no upgrade button. Every owner tool is included.",
          icon: Wallet,
      },
      {
          title: "No commission",
          description:
              "Grounds takes nothing from what you sell, including the discounts and vouchers you run here.",
          icon: ReceiptText,
      },
      {
          title: "No tiers",
          description:
              "Nothing is locked behind a level. A cafe that opened last week gets exactly the same tools as an established one.",
          icon: Layers,
      },
      {
          title: "No card",
          description:
              "You will never be asked for payment details to claim a cafe, or to keep managing it.",
          icon: CreditCard,
      },
  ]

  export const FREE_PILLARS_NOTE =
      "Running Grounds costs money, so there is an optional way to chip in. It is unrelated to owning a cafe and changes nothing about what you can access."

  export const BENEFIT_GROUPS: BenefitGroup[] = [
      {
          id: "listing",
          title: "Own your listing",
          intro:
              "The page people land on is yours to shape, and your edits publish immediately.",
          icon: Store,
          accent: "bg-primary/10 text-primary",
          items: [
              {
                  title: "Edit anything, and it goes live",
                  description:
                      "Name, description, address and map pin, hours, amenities, payment methods, price level, socials, and more. Owner edits are not queued for approval.",
                  icon: PenLine,
              },
              {
                  title: "Up to 12 photos, plus a cover",
                  description:
                      "Drag to reorder, swap the cover, or remove an image. Changes save on their own while you work.",
                  icon: Images,
              },
              {
                  title: "Tell your cafe's story",
                  description:
                      "A longer narrative on your page, for the part a description cannot hold — the roaster, the room, the reason you opened.",
                  icon: BookOpen,
              },
              {
                  title: "Hidden Gem mode",
                  description:
                      "Mark your cafe as a hidden gem with a short finding hint. Its exact location stays approximate, and it graduates out of the mode once enough people have visited.",
                  icon: Gem,
              },
              {
                  title: "A collectible stamp of your own",
                  description:
                      "Upload your own stamp image. It becomes the stamp customers collect when they check in at your cafe, and it is printed into the check-in poster you download.",
                  icon: Stamp,
              },
          ],
      },
      {
          id: "discovery",
          title: "Get found",
          intro:
              "Grounds is a place people browse, search and map. Make sure your listing is the one they pick.",
          icon: Compass,
          accent: "bg-accent/10 text-accent",
          items: [
              {
                  title: "A full page, not a directory entry",
                  description:
                      "Photos, amenities, hours, a map, the menu, reviews and your story on one page built to be shared.",
                  icon: LayoutPanelTop,
              },
              {
                  title: "A menu page of its own",
                  description:
                      "Every item with prices, photos, dietary tags, sizes and in-stock status, on a page a QR code can point straight to.",
                  icon: UtensilsCrossed,
              },
              {
                  title: "Read your menu in from a photo",
                  description:
                      "Photograph the printed menu and the items are read in for you, skipping the ones you already have.",
                  icon: ScanLine,
              },
              {
                  title: "Events and posts",
                  description:
                      "Publish events for your cafe, and write blog posts about it. Posts are read by our team before they appear publicly.",
                  icon: CalendarDays,
              },
              {
                  title: "QR codes you can print",
                  description:
                      "Download a branded check-in code and a menu code as images, ready for the counter or the window.",
                  icon: QrCode,
              },
          ],
      },
      {
          id: "customers",
          title: "Bring customers in",
          intro:
              "Run promotions on your own terms — no fees, no middleman, nothing new for your staff to learn.",
          icon: Ticket,
          accent: "bg-primary/15 text-primary",
          items: [
              {
                  title: "Campaigns you design",
                  description:
                      "Percentage off, a fixed amount, or a free item. Set a total cap, a per-customer limit, a minimum spend and a date window.",
                  icon: Percent,
              },
              {
                  title: "Voucher codes and QR handouts",
                  description:
                      "Generate up to 1,000 codes at once and download them as a CSV, or share a QR that hands a voucher to whoever scans it.",
                  icon: TicketCheck,
              },
              {
                  title: "Claimable straight from your page",
                  description:
                      "Public campaigns show on your cafe page, so someone browsing can pick one up without asking you first.",
                  icon: MousePointerClick,
              },
              {
                  title: "Redeem in seconds",
                  description:
                      "Type the code, see the voucher, confirm. Every redemption is logged and unused codes can be cancelled.",
                  icon: ClipboardCheck,
              },
              {
                  title: "You keep the whole sale",
                  description:
                      "Grounds processes no payments for your vouchers and takes no cut. The transaction happens in your shop, between you and your customer.",
                  icon: ShieldCheck,
              },
          ],
      },
      {
          id: "reviews",
          title: "Hear your customers",
          intro:
              "Reviews are the loudest thing on your page. Answer them where everyone can see.",
          icon: MessageSquare,
          accent: "bg-secondary/15 text-primary",
          items: [
              {
                  title: "Reply publicly",
                  description:
                      "Your response appears under the review with an Owner badge, so anyone reading can see you answered.",
                  icon: Reply,
              },
              {
                  title: "Edit or remove your reply",
                  description:
                      "Made a typo or changed your mind? Update or delete your response at any time.",
                  icon: PencilLine,
              },
              {
                  title: "Pin your best three",
                  description:
                      "Pin up to three reviews to the top of your page so first-time visitors see the strongest ones first.",
                  icon: Pin,
              },
              {
                  title: "Never lose track",
                  description:
                      "Your dashboard shows how many reviews are still waiting for a reply.",
                  icon: BellRing,
              },
          ],
      },
      {
          id: "insight",
          title: "Know what is working",
          intro:
              "Numbers about your own cafe, and the back-of-house work that keeps it running.",
          icon: LineChart,
          accent: "bg-accent/15 text-accent",
          items: [
              {
                  title: "Views and unique visitors",
                  description:
                      "How many people opened your page and how many were distinct visitors, across the last 7, 30 or 90 days.",
                  icon: Eye,
              },
              {
                  title: "Where they came from",
                  description:
                      "A per-day trend, the split between phones, tablets and desktops, and the sites sending you the most traffic.",
                  icon: Globe,
              },
              {
                  title: "How you are rated",
                  description:
                      "Your average next to the full star breakdown, so you can see whether you are winning or losing on the margins.",
                  icon: Star,
              },
              {
                  title: "Stock, without a spreadsheet",
                  description:
                      "Track items with low-stock warnings and a running valuation, log restocks, and export the list as a CSV. This part stays private to you.",
                  icon: Boxes,
              },
          ],
      },
  ]
  ```

  Every lucide icon above was verified present in `lucide-react@0.556`. Do not substitute icon names.

- [x] **GREEN: Verify the test passes**

  Run: `bun test --isolate components/owner/__tests__/owner-benefits-content.test.ts`

  Expected: PASS — 12 tests, 0 failures. Look for `0 fail` in the bun summary.

- [x] **REFACTOR: Clean up**
  - Import order must read: `lucide-react` named imports, then `import type { LucideIcon }`. Confirm no unused icon import remains — `bun run lint` will flag unused imports; remove any it names.
  - Confirm every `description` ends with a period and contains no double spaces.
  - Re-run: `bun test --isolate components/owner/__tests__/owner-benefits-content.test.ts` — still PASS.

- [x] **Commit**

  ```bash
  git add components/owner/owner-benefits-content.ts components/owner/__tests__/owner-benefits-content.test.ts
  git commit -m "feat(owner): add cafe owner benefits content contract (Task 1)"
  ```

---

### Task 2: Content contract — claim steps, inclusions, FAQ, closing

**Files:**
- Modify: `components/owner/owner-benefits-content.ts` (append new exports; do not change Task 1 exports)
- Modify: `components/owner/__tests__/owner-benefits-content.test.ts` (append new `describe` blocks and imports)

**Dependencies:** Task 1

**TDD Cycle:**

- [x] **RED: Write the failing test**

  In `components/owner/__tests__/owner-benefits-content.test.ts`, extend the existing import from `@/components/owner/owner-benefits-content` so it also imports `CLAIM_STEPS`, `INCLUDED_FEATURES`, `FAQ_ITEMS`, and `CLOSING`. The import becomes:

  ```typescript
  import {
      HERO,
      PRIMARY_CTA,
      SECONDARY_CTA,
      CONTACT_CTA,
      FREE_PILLARS,
      FREE_PILLARS_NOTE,
      BENEFIT_GROUPS,
      CLAIM_STEPS,
      INCLUDED_FEATURES,
      FAQ_ITEMS,
      CLOSING,
  } from "@/components/owner/owner-benefits-content"
  ```

  Then append these blocks at the end of the file:

  ```typescript
  describe("owner benefits content — claim steps", () => {
      it("describes the four-step claim flow in order", () => {
          expect(CLAIM_STEPS.length).toBe(4)
          expect(CLAIM_STEPS.map((s) => s.title)).toEqual([
              "Find your cafe",
              "Open its page and claim it",
              "Tell us who you are",
              "We review, then email you",
          ])
      })

      it("says a human reviews every claim", () => {
          const finalStep = CLAIM_STEPS[3]
          expect(finalStep.description.toLowerCase()).toContain(
              "a person reads every claim"
          )
      })
  })

  describe("owner benefits content — inclusions", () => {
      it("lists nine things included from day one", () => {
          expect(INCLUDED_FEATURES.length).toBe(9)
      })

      it("keeps the gallery photos claim at the real limit of twelve", () => {
          const photos = INCLUDED_FEATURES.find((line) =>
              line.toLowerCase().includes("gallery")
          )
          expect(photos).toBeDefined()
          expect(photos as string).toContain("12")
      })

      it("says blog posts are reviewed before publishing", () => {
          const posts = INCLUDED_FEATURES.find((line) =>
              line.toLowerCase().includes("blog post")
          )
          expect(posts).toBeDefined()
          expect((posts as string).toLowerCase()).toContain("reviewed")
      })
  })

  describe("owner benefits content — FAQ", () => {
      it("has at least eight unique questions, each with an answer", () => {
          expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(8)
          expect(new Set(FAQ_ITEMS.map((f) => f.question)).size).toBe(
              FAQ_ITEMS.length
          )
          for (const faq of FAQ_ITEMS) {
              expect(faq.question.endsWith("?")).toBe(true)
              expect(faq.answer.length).toBeGreaterThan(40)
          }
      })

      it("answers whether claiming costs anything", () => {
          const faq = FAQ_ITEMS.find((f) => f.question === "Is it really free?")
          expect(faq).toBeDefined()
          expect((faq as { answer: string }).answer.toLowerCase()).toContain(
              "no subscription"
          )
      })
  })

  describe("owner benefits content — forbidden claims", () => {
      const FORBIDDEN = [
          "verified badge",
          "0% commission",
          "unlimited photos",
          "instant publish",
          "export your analytics",
          "approve community menu suggestions",
      ]

      it("never states a claim the product does not back up", () => {
          const text = [
              HERO.eyebrow,
              HERO.heading,
              HERO.lede,
              HERO.reassurance,
              FREE_PILLARS_NOTE,
              ...FREE_PILLARS.flatMap((p) => [p.title, p.description]),
              ...BENEFIT_GROUPS.flatMap((g) => [
                  g.title,
                  g.intro,
                  ...g.items.flatMap((i) => [i.title, i.description]),
              ]),
              ...CLAIM_STEPS.flatMap((s) => [s.title, s.description]),
              ...INCLUDED_FEATURES,
              ...FAQ_ITEMS.flatMap((f) => [f.question, f.answer]),
              CLOSING.heading,
              CLOSING.body,
              CLOSING.footnote,
          ]
              .join(" ")
              .toLowerCase()

          for (const phrase of FORBIDDEN) {
              expect(text.includes(phrase)).toBe(false)
          }
      })

      it("ships no marketing statistics", () => {
          const text = [
              HERO.lede,
              HERO.reassurance,
              ...BENEFIT_GROUPS.flatMap((g) => g.items.map((i) => i.description)),
              ...FAQ_ITEMS.map((f) => f.answer),
          ]
              .join(" ")
              .toLowerCase()

          for (const banned of [
              "% of",
              "trusted by",
              "owners joined",
              "customers served",
              "increase your",
          ]) {
              expect(text.includes(banned)).toBe(false)
          }
      })
  })
  ```

- [x] **RED: Verify the test fails**

  Run: `bun test --isolate components/owner/__tests__/owner-benefits-content.test.ts`

  Expected: FAIL — `SyntaxError: Export named 'CLAIM_STEPS' not found` (the new exports do not exist yet). The Task 1 tests still pass; the new blocks fail.

- [x] **GREEN: Write minimal implementation**

  Append to `components/owner/owner-benefits-content.ts`. Add these two type declarations next to the existing ones, and these five exports at the end of the file:

  ```typescript
  export interface ClaimStep {
      title: string
      description: string
  }

  export interface FaqItem {
      question: string
      answer: string
  }

  export const CLAIM_STEPS_HEADING = "How claiming works"

  export const CLAIM_STEPS: ClaimStep[] = [
      {
          title: "Find your cafe",
          description:
              "Search Grounds. If your cafe is not listed yet, add it first — it takes a minute and it is the same free account.",
      },
      {
          title: "Open its page and claim it",
          description:
              "Every unclaimed cafe shows a Claim button. You will need to be signed in, which is one tap if you use Google or Discord.",
      },
      {
          title: "Tell us who you are",
          description:
              "A short note about your role, plus a business permit, DTI registration or an ID if you have one handy. PDF, JPG or PNG up to 10 MB.",
      },
      {
          title: "We review, then email you",
          description:
              "A person reads every claim. You get an email either way, and once it is approved your dashboard is ready to use.",
      },
  ]

  export const INCLUDED_HEADING = "Included from day one"

  export const INCLUDED_FEATURES: string[] = [
      "Menu items and categories — as many as your menu needs",
      "12 gallery photos plus a cover image",
      "Review replies, with three pinned to the top of your page",
      "Discount campaigns, with up to 1,000 voucher codes per batch",
      "Page analytics across 7, 30 and 90 days",
      "Inventory tracking with low-stock warnings and CSV export",
      "Events for your cafe, and blog posts you write (reviewed before publishing)",
      "Branded check-in and menu QR codes to print",
      "A custom stamp for your cafe",
  ]

  export const FAQ_HEADING = "Questions cafe owners ask"

  export const FAQ_ITEMS: FaqItem[] = [
      {
          question: "Is it really free?",
          answer:
              "Yes. Claiming and managing a cafe costs nothing. There is no subscription, no paid tier, and no commission on anything you sell. Grounds is supported by optional donations from the community, which are unrelated to owning a cafe.",
      },
      {
          question: "Do you take a cut of my discounts?",
          answer:
              "No. Vouchers are redeemed in your shop by your own staff. Grounds never handles the money and takes nothing from it.",
      },
      {
          question: "How long does claiming take?",
          answer:
              "A person reviews every claim, so it depends on how quickly we can confirm you. You will get an email either way. If you need it moving faster, message us.",
      },
      {
          question: "What proof do you need?",
          answer:
              "A short written explanation of your role is required and is usually enough. A business permit, DTI registration or a government ID makes it faster — PDF, JPG or PNG up to 10 MB. We may contact you before approving.",
      },
      {
          question: "Can I add a cafe that is not on Grounds yet?",
          answer:
              "Yes. Add it through the submit form. New cafes are checked by our team before they go public, and your claim is approved along with the listing.",
      },
      {
          question: "My cafe is already claimed. What now?",
          answer:
              "Get in touch and we will sort it out. If you are a co-owner, or you have taken over the business, we can add you to the listing.",
      },
      {
          question: "Who can edit my cafe once I claim it?",
          answer:
              "You can. Changes suggested by the community arrive as suggestions and are checked by our moderators before anything changes, so nobody can quietly rewrite your listing.",
      },
      {
          question: "Can I publish events and blog posts?",
          answer:
              "Yes. Events you create for your cafe go live when you publish them. Blog posts are read by our team before they appear publicly.",
      },
      {
          question: "Can I use my own photos and menu?",
          answer:
              "Yes. Upload your own photos and build the menu yourself, or photograph your printed menu and have the items read in for you.",
      },
  ]

  export const CLOSING = {
      heading: "Ready to take the keys?",
      body: "Find your cafe, claim it, and start editing today. It takes a few minutes and costs nothing.",
      footnote:
          "Claiming a cafe is subject to our Terms of Service and Content Policy.",
  } as const
  ```

- [x] **GREEN: Verify the test passes**

  Run: `bun test --isolate components/owner/__tests__/owner-benefits-content.test.ts`

  Expected: PASS — 21 tests, 0 failures.

  If the forbidden-claims test fails, do **not** weaken the test. Rewrite the offending copy so the claim is accurate — the block list in spec Appendix B is the rule, not the test.

- [x] **REFACTOR: Clean up**
  - Confirm `INCLUDED_FEATURES` has exactly 9 entries (the test asserts the count; adding a tenth means updating the test deliberately, not by accident).
  - Read all FAQ answers once more against spec Appendix A. Any statement you cannot trace to an Appendix A row must be removed.
  - Re-run: `bun test --isolate components/owner/__tests__/owner-benefits-content.test.ts` — still PASS.

- [x] **Commit**

  ```bash
  git add components/owner/owner-benefits-content.ts components/owner/__tests__/owner-benefits-content.test.ts
  git commit -m "feat(owner): add claim steps, inclusions and FAQ content (Task 2)"
  ```

---

## Phase 2: Core Content Sections

### Task 3: OwnerBenefits — hero and free pillars

**Files:**
- Create: `components/owner/OwnerBenefits.tsx`
- Create: `components/owner/__tests__/OwnerBenefits.test.tsx`

**Dependencies:** Task 1, Task 2

**TDD Cycle:**

- [x] **RED: Write the failing test**

  Create `components/owner/__tests__/OwnerBenefits.test.tsx`:

  ```tsx
  import { describe, it, expect, afterEach } from "bun:test"
  import { render, screen, cleanup } from "@testing-library/react"
  import OwnerBenefits from "@/components/owner/OwnerBenefits"
  import { FREE_PILLARS } from "@/components/owner/owner-benefits-content"

  describe("OwnerBenefits — hero", () => {
      afterEach(() => {
          cleanup()
      })

      it("renders the page headline exactly once as an h1", () => {
          const { container } = render(<OwnerBenefits />)
          const h1s = container.querySelectorAll("h1")
          expect(h1s.length).toBe(1)
          expect(h1s[0].textContent).toBe("Your cafe, finally yours online")
      })

      it("answers the cost question on the first screen", () => {
          render(<OwnerBenefits />)
          expect(screen.getByText(/Free to claim\. Free to manage\./)).toBeTruthy()
      })

      it("links both calls to action to real destinations", () => {
          const { container } = render(<OwnerBenefits />)
          const hrefs = Array.from(container.querySelectorAll("a")).map((a) =>
              a.getAttribute("href")
          )
          expect(hrefs).toContain("/cafes")
          expect(hrefs).toContain("/submit")
      })
  })

  describe("OwnerBenefits — free pillars", () => {
      afterEach(() => {
          cleanup()
      })

      it("renders every pillar with its description", () => {
          render(<OwnerBenefits />)
          for (const pillar of FREE_PILLARS) {
              expect(screen.getByText(pillar.title)).toBeTruthy()
              expect(screen.getByText(pillar.description)).toBeTruthy()
          }
      })

      it("explains the optional donation without gating access", () => {
          render(<OwnerBenefits />)
          expect(screen.getByText(/optional way to chip in/i)).toBeTruthy()
      })
  })
  ```

- [x] **RED: Verify the test fails**

  Run: `bun test --isolate components/owner/__tests__/OwnerBenefits.test.tsx`

  Expected: FAIL — `error: Cannot find module "@/components/owner/OwnerBenefits"`.

- [x] **GREEN: Write minimal implementation**

  Create `components/owner/OwnerBenefits.tsx`. Note it is a **Server Component** — do not add `"use client"`. Quote style is single-quoted `className` to match `app/roadmap/page.tsx`.

  ```tsx
  import Link from "next/link"
  import { Coffee, MapPin, Store } from "lucide-react"
  import {
      FREE_PILLARS,
      FREE_PILLARS_HEADING,
      FREE_PILLARS_NOTE,
      HERO,
      PRIMARY_CTA,
      SECONDARY_CTA,
  } from "@/components/owner/owner-benefits-content"

  export default function OwnerBenefits() {
      return (
          <main className='w-full min-h-screen bg-background'>
              {/* Hero */}
              <section className='relative bg-linear-to-br from-primary/10 via-secondary/5 to-tertiary/10 py-20 overflow-hidden'>
                  <div
                      className='absolute inset-0 pointer-events-none select-none overflow-hidden'
                      aria-hidden='true'
                  >
                      <Coffee className='absolute -top-6 -right-6 w-48 h-48 text-primary/5 rotate-12' />
                      <Store className='absolute -bottom-12 -left-12 w-64 h-64 text-secondary/5 -rotate-12' />
                      <div className='absolute top-1/4 right-1/4 w-32 h-32 bg-accent/5 rounded-full blur-3xl' />
                  </div>

                  <div className='max-w-5xl mx-auto px-4 relative z-10'>
                      <span className='inline-block px-3 py-1 mb-4 bg-background/50 backdrop-blur-sm border border-text/5 rounded-full text-xs font-medium text-text/60 uppercase tracking-wider'>
                          {HERO.eyebrow}
                      </span>
                      <h1 className='text-4xl md:text-6xl font-bold font-serif text-text mb-6 tracking-tight max-w-3xl'>
                          {HERO.heading}
                      </h1>
                      <p className='text-lg md:text-xl text-text/70 max-w-2xl leading-relaxed mb-6'>
                          {HERO.lede}
                      </p>
                      <p className='text-sm font-semibold text-primary mb-8'>
                          {HERO.reassurance}
                      </p>

                      <div className='flex flex-col sm:flex-row gap-3'>
                          <Link
                              href={PRIMARY_CTA.href}
                              className='inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-colors shadow-lg hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
                          >
                              <Store className='w-5 h-5' aria-hidden='true' />
                              {PRIMARY_CTA.label}
                          </Link>
                          <Link
                              href={SECONDARY_CTA.href}
                              className='inline-flex items-center justify-center gap-2 px-6 py-3 bg-text/10 text-text font-semibold rounded-lg hover:bg-text/20 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
                          >
                              <MapPin className='w-5 h-5' aria-hidden='true' />
                              {SECONDARY_CTA.label}
                          </Link>
                      </div>
                  </div>
              </section>

              {/* Free pillars */}
              <section className='w-full py-16 px-4'>
                  <div className='max-w-5xl mx-auto'>
                      <h2 className='text-2xl md:text-3xl font-bold font-serif text-text'>
                          {FREE_PILLARS_HEADING}
                      </h2>

                      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8'>
                          {FREE_PILLARS.map((pillar) => {
                              const Icon = pillar.icon
                              return (
                                  <div
                                      key={pillar.title}
                                      className='p-5 bg-text/5 border border-text/10 rounded-xl'
                                  >
                                      <div className='w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3'>
                                          <Icon
                                              className='w-5 h-5 text-primary'
                                              aria-hidden='true'
                                          />
                                      </div>
                                      <h3 className='font-semibold text-text mb-1'>
                                          {pillar.title}
                                      </h3>
                                      <p className='text-text/60 text-sm leading-relaxed'>
                                          {pillar.description}
                                      </p>
                                  </div>
                              )
                          })}
                      </div>

                      <p className='text-text/50 text-sm mt-6 max-w-2xl leading-relaxed'>
                          {FREE_PILLARS_NOTE}
                      </p>
                  </div>
              </section>
          </main>
      )
  }
  ```

- [x] **GREEN: Verify the test passes**

  Run: `bun test --isolate components/owner/__tests__/OwnerBenefits.test.tsx`

  Expected: PASS — 5 tests, 0 failures.

- [x] **REFACTOR: Clean up**
  - Confirm `grep -c "use client" components/owner/OwnerBenefits.tsx` prints `0`.
  - Confirm no `text-secondary` appears in the file: `grep -n "text-secondary" components/owner/OwnerBenefits.tsx` must print nothing (2.72:1 contrast).
  - Re-run the test file — still PASS.

- [x] **Commit**

  ```bash
  git add components/owner/OwnerBenefits.tsx components/owner/__tests__/OwnerBenefits.test.tsx
  git commit -m "feat(owner): render owner benefits hero and free pillars (Task 3)"
  ```

---

### Task 4: OwnerBenefits — five benefit groups

**Files:**
- Modify: `components/owner/OwnerBenefits.tsx` (add a new section between the free-pillars section and `</main>`)
- Modify: `components/owner/__tests__/OwnerBenefits.test.tsx` (append blocks + extend imports)

**Dependencies:** Task 3

**TDD Cycle:**

- [x] **RED: Write the failing test**

  In `components/owner/__tests__/OwnerBenefits.test.tsx`, replace the content-module import line with:

  ```tsx
  import { BENEFIT_GROUPS, FREE_PILLARS } from "@/components/owner/owner-benefits-content"
  ```

  Then append:

  ```tsx
  describe("OwnerBenefits — benefit groups", () => {
      afterEach(() => {
          cleanup()
      })

      it("renders every group with its heading and intro", () => {
          render(<OwnerBenefits />)
          for (const group of BENEFIT_GROUPS) {
              expect(screen.getByText(group.title)).toBeTruthy()
              expect(screen.getByText(group.intro)).toBeTruthy()
          }
      })

      it("renders every benefit as an h3 with its description", () => {
          const { container } = render(<OwnerBenefits />)
          const h3Texts = Array.from(container.querySelectorAll("h3")).map(
              (heading) => heading.textContent
          )
          for (const group of BENEFIT_GROUPS) {
              for (const item of group.items) {
                  expect(h3Texts).toContain(item.title)
                  expect(screen.getByText(item.description)).toBeTruthy()
              }
          }
      })

      it("keeps group headings at h2 level", () => {
          const { container } = render(<OwnerBenefits />)
          const h2Texts = Array.from(container.querySelectorAll("h2")).map(
              (heading) => heading.textContent
          )
          for (const group of BENEFIT_GROUPS) {
              expect(h2Texts).toContain(group.title)
          }
      })

      it("gives each group an in-page anchor id", () => {
          const { container } = render(<OwnerBenefits />)
          for (const group of BENEFIT_GROUPS) {
              expect(container.querySelector(`#${group.id}`)).toBeTruthy()
          }
      })
  })
  ```

- [x] **RED: Verify the test fails**

  Run: `bun test --isolate components/owner/__tests__/OwnerBenefits.test.tsx`

  Expected: FAIL — `Unable to find an element with the text: Own your listing` (the group sections are not rendered yet).

- [x] **GREEN: Write minimal implementation**

  In `components/owner/OwnerBenefits.tsx`:

  1. Add `BENEFIT_GROUPS` to the existing import from `@/components/owner/owner-benefits-content`.
  2. Insert this section immediately after the free-pillars `</section>` and before `</main>`:

  ```tsx
  {/* Benefit groups */}
  <div className='w-full'>
      {BENEFIT_GROUPS.map((group) => {
          const GroupIcon = group.icon
          return (
              <section
                  key={group.id}
                  id={group.id}
                  className='w-full py-12 px-4'
              >
                  <div className='max-w-5xl mx-auto'>
                      <div className='flex items-start gap-3 mb-6'>
                          <div className={`p-2 rounded-xl ${group.accent}`}>
                              <GroupIcon
                                  className='w-5 h-5'
                                  aria-hidden='true'
                              />
                          </div>
                          <div>
                              <h2 className='text-2xl font-bold font-serif text-text'>
                                  {group.title}
                              </h2>
                              <p className='text-text/60 mt-1 max-w-2xl leading-relaxed'>
                                  {group.intro}
                              </p>
                          </div>
                      </div>

                      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                          {group.items.map((item) => {
                              const ItemIcon = item.icon
                              return (
                                  <div
                                      key={item.title}
                                      className='p-5 bg-text/5 border border-text/10 rounded-xl hover:border-text/20 transition-colors'
                                  >
                                      <div className='flex items-start gap-4'>
                                          <div className='p-2 bg-background rounded-lg text-primary shrink-0'>
                                              <ItemIcon
                                                  className='w-5 h-5'
                                                  aria-hidden='true'
                                              />
                                          </div>
                                          <div>
                                              <h3 className='font-semibold text-text mb-1'>
                                                  {item.title}
                                              </h3>
                                              <p className='text-text/60 text-sm leading-relaxed'>
                                                  {item.description}
                                              </p>
                                          </div>
                                      </div>
                                  </div>
                              )
                          })}
                      </div>
                  </div>
              </section>
          )
      })}
  </div>
  ```

- [x] **GREEN: Verify the test passes**

  Run: `bun test --isolate components/owner/__tests__/OwnerBenefits.test.tsx`

  Expected: PASS — 9 tests, 0 failures.

- [x] **REFACTOR: Clean up**
  - The `group.accent` template literal is the sanctioned way to do conditional/variable classes in pages; do **not** introduce `cn()` here.
  - Confirm both icon destructures (`GroupIcon`, `ItemIcon`) are capitalised — lowercase JSX identifiers are treated as HTML tags and will silently break.
  - Re-run the test file — still PASS.

- [x] **Commit**

  ```bash
  git add components/owner/OwnerBenefits.tsx components/owner/__tests__/OwnerBenefits.test.tsx
  git commit -m "feat(owner): render five benefit groups (Task 4)"
  ```

---

### Task 5: OwnerBenefits — claim steps and inclusions checklist

**Files:**
- Modify: `components/owner/OwnerBenefits.tsx` (two new sections after the benefit groups `<div>`)
- Modify: `components/owner/__tests__/OwnerBenefits.test.tsx` (append blocks + extend imports)

**Dependencies:** Task 4

**TDD Cycle:**

- [x] **RED: Write the failing test**

  Replace the content-module import line in `components/owner/__tests__/OwnerBenefits.test.tsx` with:

  ```tsx
  import {
      BENEFIT_GROUPS,
      CLAIM_STEPS,
      FREE_PILLARS,
      INCLUDED_FEATURES,
  } from "@/components/owner/owner-benefits-content"
  ```

  Then append:

  ```tsx
  describe("OwnerBenefits — claim steps", () => {
      afterEach(() => {
          cleanup()
      })

      it("renders the four claim steps as an ordered list", () => {
          const { container } = render(<OwnerBenefits />)
          const items = container.querySelectorAll("ol > li")
          expect(items.length).toBe(4)
      })

      it("numbers the steps from one to four", () => {
          const { container } = render(<OwnerBenefits />)
          const markers = Array.from(container.querySelectorAll("ol > li > span")).map(
              (span) => span.textContent
          )
          expect(markers).toEqual(["1", "2", "3", "4"])
      })

      it("keeps the claim steps in narrative order", () => {
          const { container } = render(<OwnerBenefits />)
          const h3Texts = Array.from(container.querySelectorAll("h3")).map(
              (heading) => heading.textContent
          )
          const positions = CLAIM_STEPS.map((step) => h3Texts.indexOf(step.title))
          for (const position of positions) {
              expect(position).toBeGreaterThanOrEqual(0)
          }
          const ascending = [...positions].sort((a, b) => a - b)
          expect(positions).toEqual(ascending)
      })
  })

  describe("OwnerBenefits — inclusions", () => {
      afterEach(() => {
          cleanup()
      })

      it("lists every included feature", () => {
          render(<OwnerBenefits />)
          for (const feature of INCLUDED_FEATURES) {
              expect(screen.getByText(feature)).toBeTruthy()
          }
      })

      it("renders the inclusions as a list with nine entries", () => {
          const { container } = render(<OwnerBenefits />)
          const lists = container.querySelectorAll("ul")
          const inclusionList = Array.from(lists).find(
              (list) => list.querySelectorAll("li").length === 9
          )
          expect(inclusionList).toBeTruthy()
      })
  })
  ```

- [x] **RED: Verify the test fails**

  Run: `bun test --isolate components/owner/__tests__/OwnerBenefits.test.tsx`

  Expected: FAIL — `expected 0 to be 4` (no ordered list is rendered yet).

- [x] **GREEN: Write minimal implementation**

  In `components/owner/OwnerBenefits.tsx`:

  1. Add `CLAIM_STEPS`, `CLAIM_STEPS_HEADING`, `INCLUDED_FEATURES`, `INCLUDED_HEADING` to the content import.
  2. Add `Check` to the `lucide-react` import, so the line reads: `import { Check, Coffee, MapPin, Store } from "lucide-react"`.
  3. Insert both sections immediately after the benefit-groups closing `</div>` and before `</main>`:

  ```tsx
  {/* How claiming works */}
  <section className='w-full bg-text/5 py-16 px-4'>
      <div className='max-w-3xl mx-auto'>
          <h2 className='text-2xl md:text-3xl font-bold font-serif text-text mb-8'>
              {CLAIM_STEPS_HEADING}
          </h2>

          <ol className='flex flex-col gap-6'>
              {CLAIM_STEPS.map((step, index) => (
                  <li key={step.title} className='flex items-start gap-4'>
                      <span className='shrink-0 w-8 h-8 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center'>
                          {index + 1}
                      </span>
                      <div>
                          <h3 className='font-semibold text-text mb-1'>
                              {step.title}
                          </h3>
                          <p className='text-text/60 text-sm leading-relaxed'>
                              {step.description}
                          </p>
                      </div>
                  </li>
              ))}
          </ol>
      </div>
  </section>

  {/* Included from day one */}
  <section className='w-full py-16 px-4'>
      <div className='max-w-5xl mx-auto'>
          <h2 className='text-2xl md:text-3xl font-bold font-serif text-text mb-8'>
              {INCLUDED_HEADING}
          </h2>

          <ul className='grid grid-cols-1 md:grid-cols-2 gap-3'>
              {INCLUDED_FEATURES.map((feature) => (
                  <li
                      key={feature}
                      className='flex items-start gap-3 text-text/70'
                  >
                      <Check
                          className='w-5 h-5 text-primary shrink-0 mt-0.5'
                          aria-hidden='true'
                      />
                      <span className='text-sm leading-relaxed'>{feature}</span>
                  </li>
              ))}
          </ul>
      </div>
  </section>
  ```

- [x] **GREEN: Verify the test passes**

  Run: `bun test --isolate components/owner/__tests__/OwnerBenefits.test.tsx`

  Expected: PASS — 14 tests, 0 failures.

- [x] **REFACTOR: Clean up**
  - The `<span>` number badge must be the first child of each `<li>` — the numbering test relies on that selector.
  - Confirm the inclusions list is a `<ul>` and the steps are an `<ol>` (semantics matter for screen readers).
  - Re-run the test file — still PASS.

- [x] **Commit**

  ```bash
  git add components/owner/OwnerBenefits.tsx components/owner/__tests__/OwnerBenefits.test.tsx
  git commit -m "feat(owner): render claim steps and inclusions checklist (Task 5)"
  ```

---

### Task 6: OwnerBenefits — FAQ, closing CTA band, legal footnote

**Files:**
- Modify: `components/owner/OwnerBenefits.tsx` (FAQ + closing band + footnote after the inclusions section)
- Modify: `components/owner/__tests__/OwnerBenefits.test.tsx` (append blocks + extend imports)

**Dependencies:** Task 5

**TDD Cycle:**

- [x] **RED: Write the failing test**

  Replace the content-module import line in `components/owner/__tests__/OwnerBenefits.test.tsx` with:

  ```tsx
  import {
      BENEFIT_GROUPS,
      CLAIM_STEPS,
      CONTACT_CTA,
      FAQ_ITEMS,
      FREE_PILLARS,
      INCLUDED_FEATURES,
  } from "@/components/owner/owner-benefits-content"
  ```

  Then append:

  ```tsx
  describe("OwnerBenefits — FAQ", () => {
      afterEach(() => {
          cleanup()
      })

      it("uses native details elements so the FAQ works without JavaScript", () => {
          const { container } = render(<OwnerBenefits />)
          expect(container.querySelectorAll("details").length).toBe(
              FAQ_ITEMS.length
          )
      })

      it("exposes every question as a summary", () => {
          const { container } = render(<OwnerBenefits />)
          const summaries = Array.from(
              container.querySelectorAll("summary")
          ).map((summary) => summary.textContent ?? "")
          expect(summaries.length).toBe(FAQ_ITEMS.length)
          for (const faq of FAQ_ITEMS) {
              expect(summaries.some((text) => text.includes(faq.question))).toBe(
                  true
              )
          }
      })

      it("renders every answer", () => {
          render(<OwnerBenefits />)
          for (const faq of FAQ_ITEMS) {
              expect(screen.getByText(faq.answer)).toBeTruthy()
          }
      })
  })

  describe("OwnerBenefits — closing", () => {
      afterEach(() => {
          cleanup()
      })

      it("repeats both calls to action at the end of the page", () => {
          const { container } = render(<OwnerBenefits />)
          const hrefs = Array.from(container.querySelectorAll("a")).map((a) =>
              a.getAttribute("href")
          )
          expect(hrefs.filter((href) => href === "/cafes").length).toBe(2)
          expect(hrefs.filter((href) => href === "/submit").length).toBe(2)
      })

      it("offers an escape hatch for already-claimed cafes", () => {
          const { container } = render(<OwnerBenefits />)
          const hrefs = Array.from(container.querySelectorAll("a")).map((a) =>
              a.getAttribute("href")
          )
          expect(hrefs).toContain(CONTACT_CTA.href)
      })

      it("links the legal pages from the footnote", () => {
          const { container } = render(<OwnerBenefits />)
          const hrefs = Array.from(container.querySelectorAll("a")).map((a) =>
              a.getAttribute("href")
          )
          expect(hrefs).toContain("/legal/terms")
          expect(hrefs).toContain("/legal/content-policy")
      })
  })
  ```

- [x] **RED: Verify the test fails**

  Run: `bun test --isolate components/owner/__tests__/OwnerBenefits.test.tsx`

  Expected: FAIL — `expected 0 to be 9` (no `<details>` elements exist yet).

- [x] **GREEN: Write minimal implementation**

  In `components/owner/OwnerBenefits.tsx`:

  1. Extend the `lucide-react` import to: `import { Check, ChevronDown, Coffee, MapPin, Store } from "lucide-react"`
  2. Add `CLOSING`, `CONTACT_CTA`, `FAQ_HEADING`, `FAQ_ITEMS` to the content import.
  3. Insert after the inclusions section and before `</main>`:

  ```tsx
  {/* FAQ */}
  <section className='w-full bg-text/5 py-16 px-4'>
      <div className='max-w-3xl mx-auto'>
          <h2 className='text-2xl md:text-3xl font-bold font-serif text-text mb-8'>
              {FAQ_HEADING}
          </h2>

          <div className='divide-y divide-text/10 border-y border-text/10'>
              {FAQ_ITEMS.map((faq) => (
                  <details key={faq.question} className='group py-4'>
                      <summary className='flex items-center justify-between gap-4 cursor-pointer list-none font-semibold text-text'>
                          <span>{faq.question}</span>
                          <ChevronDown
                              className='w-5 h-5 text-text/40 shrink-0 transition-transform group-open:rotate-180'
                              aria-hidden='true'
                          />
                      </summary>
                      <p className='text-text/60 text-sm leading-relaxed mt-3'>
                          {faq.answer}
                      </p>
                  </details>
              ))}
          </div>
      </div>
  </section>

  {/* Closing call to action */}
  <section className='w-full bg-linear-to-br from-secondary via-primary/80 to-secondary py-16 px-6'>
      <div className='max-w-3xl mx-auto text-center'>
          <h2 className='font-serif text-3xl md:text-4xl font-bold text-background mb-3'>
              {CLOSING.heading}
          </h2>
          <p className='text-background/90 mb-8 max-w-xl mx-auto leading-relaxed'>
              {CLOSING.body}
          </p>

          <div className='flex flex-col sm:flex-row gap-3 justify-center'>
              <Link
                  href={PRIMARY_CTA.href}
                  className='inline-flex items-center justify-center gap-2 px-6 py-3 bg-background text-primary font-semibold rounded-lg hover:bg-background/90 transition-colors shadow-lg hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background'
              >
                  <Store className='w-5 h-5' aria-hidden='true' />
                  {PRIMARY_CTA.label}
              </Link>
              <Link
                  href={SECONDARY_CTA.href}
                  className='inline-flex items-center justify-center gap-2 px-6 py-3 bg-background/20 text-background font-semibold rounded-lg hover:bg-background/30 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background'
              >
                  <MapPin className='w-5 h-5' aria-hidden='true' />
                  {SECONDARY_CTA.label}
              </Link>
          </div>

          <p className='text-background/70 text-sm mt-6'>
              Already claimed by someone else?{" "}
              <Link
                  href={CONTACT_CTA.href}
                  className='underline hover:text-background transition-colors'
              >
                  {CONTACT_CTA.label}
              </Link>{" "}
              and we will sort it out.
          </p>
      </div>
  </section>

  {/* Legal footnote */}
  <footer className='w-full py-8 px-4'>
      <p className='max-w-5xl mx-auto text-text/50 text-xs leading-relaxed'>
          Claiming a cafe is subject to our{" "}
          <Link href='/legal/terms' className='text-primary hover:underline'>
              Terms of Service
          </Link>{" "}
          and{" "}
          <Link
              href='/legal/content-policy'
              className='text-primary hover:underline'
          >
              Content Policy
          </Link>
          .
      </p>
  </footer>
  ```

  Note: `CLOSING.footnote` is intentionally not rendered verbatim — the sentence is composed inline so the legal page names can be links. `CLOSING.footnote` remains in the content module as the canonical wording and is asserted by the content test.

- [x] **GREEN: Verify the test passes**

  Run: `bun test --isolate components/owner/__tests__/OwnerBenefits.test.tsx`

  Expected: PASS — 20 tests, 0 failures.

- [x] **REFACTOR: Clean up**
  - Confirm the chevron icon inside `<summary>` has `aria-hidden='true'` (it is decoration; the question text carries the meaning).
  - Confirm `list-none` is present on `<summary>` so the default disclosure triangle does not double up with the chevron.
  - Confirm the `<summary>` contains a `<span>` around the question, not bare text — the summary-text test depends on stable text content.
  - Re-run the test file — still PASS.

- [x] **Commit**

  ```bash
  git add components/owner/OwnerBenefits.tsx components/owner/__tests__/OwnerBenefits.test.tsx
  git commit -m "feat(owner): render FAQ, closing CTA band and legal footnote (Task 6)"
  ```

---

## Phase 3: Integration

### Task 7: Route `app/for-owners/page.tsx` — metadata and JSON-LD

**Files:**
- Create: `app/for-owners/page.tsx`
- Test: `app/for-owners/__tests__/for-owners-page.test.tsx`

**Dependencies:** Task 6

**TDD Cycle:**

- [x] **RED: Write the failing test**

  Create `app/for-owners/__tests__/for-owners-page.test.tsx`:

  ```tsx
  import { describe, it, expect, afterEach } from "bun:test"
  import { render, screen, cleanup } from "@testing-library/react"
  import { FAQ_ITEMS } from "@/components/owner/owner-benefits-content"
  import ForOwnersPage, { metadata } from "@/app/for-owners/page"

  describe("For owners page", () => {
      afterEach(() => {
          cleanup()
      })

      it("renders the owner benefits content", () => {
          render(<ForOwnersPage />)
          expect(
              screen.getByText(/Free to claim\. Free to manage\./)
          ).toBeTruthy()
      })

      it("titles itself for cafe owners without hardcoding the brand", () => {
          expect(metadata.title).toBe("Cafe Owner Benefits")
          expect(metadata.alternates?.canonical).toBe("/for-owners")
          expect(String(metadata.description).length).toBeGreaterThan(80)
      })

      it("emits two JSON-LD blocks", () => {
          const { container } = render(<ForOwnersPage />)
          const scripts = container.querySelectorAll(
              'script[type="application/ld+json"]'
          )
          expect(scripts.length).toBe(2)
      })

      it("emits a FAQPage block that matches the FAQ exactly", () => {
          const { container } = render(<ForOwnersPage />)
          const scripts = Array.from(
              container.querySelectorAll('script[type="application/ld+json"]')
          )
          const payloads = scripts.map((script) =>
              JSON.parse(script.innerHTML) as Record<string, unknown>
          )
          const faq = payloads.find(
              (payload) => payload["@type"] === "FAQPage"
          ) as { mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }> }

          expect(faq).toBeDefined()
          expect(faq.mainEntity.length).toBe(FAQ_ITEMS.length)
          expect(faq.mainEntity[0].name).toBe(FAQ_ITEMS[0].question)
          expect(faq.mainEntity[0].acceptedAnswer.text).toBe(
              FAQ_ITEMS[0].answer
          )
          expect(faq.mainEntity[FAQ_ITEMS.length - 1].name).toBe(
              FAQ_ITEMS[FAQ_ITEMS.length - 1].question
          )
      })

      it("emits a BreadcrumbList for Home then For Cafe Owners", () => {
          const { container } = render(<ForOwnersPage />)
          const scripts = Array.from(
              container.querySelectorAll('script[type="application/ld+json"]')
          )
          const payloads = scripts.map((script) =>
              JSON.parse(script.innerHTML) as Record<string, unknown>
          )
          const crumbs = payloads.find(
              (payload) => payload["@type"] === "BreadcrumbList"
          ) as { itemListElement: Array<{ name: string; item: string }> }

          expect(crumbs).toBeDefined()
          expect(crumbs.itemListElement.length).toBe(2)
          expect(crumbs.itemListElement[1].name).toBe("For Cafe Owners")
          expect(crumbs.itemListElement[1].item.endsWith("/for-owners")).toBe(
              true
          )
      })
  })
  ```

- [x] **RED: Verify the test fails**

  Run: `bun test --isolate app/for-owners/__tests__/for-owners-page.test.tsx`

  Expected: FAIL — `error: Cannot find module "@/app/for-owners/page"`.

- [x] **GREEN: Write minimal implementation**

  Create `app/for-owners/page.tsx`. Server Component — no directive, and **no** `export const dynamic` / `export const revalidate`. Keep the route-safety comment: it is the only thing standing between a future refactor and three broken guards.

  ```tsx
  import { Metadata } from "next"
  import OwnerBenefits from "@/components/owner/OwnerBenefits"
  import { FAQ_ITEMS } from "@/components/owner/owner-benefits-content"
  import { buildBreadcrumbList } from "@/utils/seo/breadcrumbs"

  // ROUTE SAFETY — do not rename or move this route.
  // `proxy.ts` treats every path starting with "/owner" as protected,
  // `app/robots.ts` disallows "/owner/", and `components/chat/ChatWidget.tsx`
  // hides the chat widget on any path containing "/owner". Keeping the
  // marketing route at "/for-owners" avoids all three.

  export const metadata: Metadata = {
      title: "Cafe Owner Benefits",
      description:
          "Claim your cafe on Grounds for free. Edit your listing, build a menu, run discount vouchers, reply to reviews and see your page analytics — with no subscription and no commission.",
      keywords: [
          "claim cafe listing",
          "cafe owner Philippines",
          "add my cafe to Grounds",
          "free cafe listing",
          "cafe management tools",
          "cafe discounts Philippines",
      ],
      alternates: {
          canonical: "/for-owners",
      },
      openGraph: {
          title: "Cafe Owner Benefits | Grounds",
          description:
              "Everything a cafe owner gets on Grounds: a listing you control, a real menu, discount vouchers, review replies and page analytics. Free to claim, free to manage.",
          type: "website",
      },
      twitter: {
          card: "summary",
          title: "Cafe Owner Benefits | Grounds",
          description:
              "Claim your cafe on Grounds for free. No subscription, no commission, no card.",
      },
  }

  export default function ForOwnersPage() {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://grounds.ph"

      const breadcrumbs = buildBreadcrumbList([
          { name: "GroundsPH", url: siteUrl },
          { name: "For Cafe Owners", url: `${siteUrl}/for-owners` },
      ])

      const faqJsonLd = {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ_ITEMS.map((faq) => ({
              "@type": "Question",
              name: faq.question,
              acceptedAnswer: {
                  "@type": "Answer",
                  text: faq.answer,
              },
          })),
      }

      return (
          <>
              <script
                  type='application/ld+json'
                  dangerouslySetInnerHTML={{
                      __html: JSON.stringify(breadcrumbs),
                  }}
              />
              <script
                  type='application/ld+json'
                  dangerouslySetInnerHTML={{
                      __html: JSON.stringify(faqJsonLd),
                  }}
              />
              <OwnerBenefits />
          </>
      )
  }
  ```

- [x] **GREEN: Verify the test passes**

  Run: `bun test --isolate app/for-owners/__tests__/for-owners-page.test.tsx`

  Expected: PASS — 5 tests, 0 failures.

- [x] **REFACTOR: Clean up**
  - Confirm the file has no `export const dynamic` and no `export const revalidate`: `grep -n "export const" app/for-owners/page.tsx` must show only `metadata`.
  - Confirm `grep -c "use client" app/for-owners/page.tsx` prints `0`.
  - Re-run the test file — still PASS.

- [x] **Commit**

  ```bash
  git add app/for-owners/page.tsx app/for-owners/__tests__/for-owners-page.test.tsx
  git commit -m "feat(for-owners): add owner benefits route with metadata and JSON-LD (Task 7)"
  ```

---

### Task 8: Register `/for-owners` in the sitemap

**Files:**
- Modify: `app/sitemap.ts` (inside `staticPages`, in the `// Community pages` group, immediately after the `/submit` entry)
- Create: `app/__tests__/sitemap.test.ts`

**Dependencies:** Task 7

**TDD Cycle:**

- [x] **RED: Write the failing test**

  Create `app/__tests__/sitemap.test.ts`. `db` is mocked because `app/sitemap.ts` queries it directly and the real module would try to open a `pg` pool.

  ```typescript
  import { describe, it, expect, mock } from "bun:test"

  // Minimal chainable stub: db.select().from().where()
  // and db.select().from().innerJoin().where() both resolve to []
  const emptyChain: Record<string, unknown> = {
      from: () => emptyChain,
      where: () => Promise.resolve([]),
      innerJoin: () => emptyChain,
      limit: () => Promise.resolve([]),
      orderBy: () => Promise.resolve([]),
  }

  mock.module("@/db", () => ({
      db: {
          select: () => emptyChain,
      },
  }))

  import sitemap from "@/app/sitemap"

  describe("sitemap", () => {
      it("registers the for-owners page", async () => {
          const entries = await sitemap()
          const forOwners = entries.find((entry) =>
              entry.url.endsWith("/for-owners")
          )
          expect(forOwners).toBeDefined()
          expect(forOwners?.changeFrequency).toBe("monthly")
          expect(forOwners?.priority).toBe(0.6)
      })

      it("keeps the existing static pages alongside it", async () => {
          const entries = await sitemap()
          const urls = entries.map((entry) => entry.url)
          expect(urls.some((url) => url.endsWith("/cafes"))).toBe(true)
          expect(urls.some((url) => url.endsWith("/roadmap"))).toBe(true)
      })
  })
  ```

- [x] **RED: Verify the test fails**

  Run: `bun test --isolate app/__tests__/sitemap.test.ts`

  Expected: FAIL — `expect(received).toBeDefined()` fails because no entry ends with `/for-owners` yet.

- [x] **GREEN: Write minimal implementation**

  In `app/sitemap.ts`, inside the `staticPages: [...]` array under the `// Community pages` comment, add one line immediately after the `/submit` entry so the block reads:

  ```typescript
              { path: "/submit", changeFrequency: "monthly", priority: 0.6 },
              { path: "/for-owners", changeFrequency: "monthly", priority: 0.6 },
  ```

  Change nothing else in the file.

- [x] **GREEN: Verify the test passes**

  Run: `bun test --isolate app/__tests__/sitemap.test.ts`

  Expected: PASS — 2 tests, 0 failures.

- [x] **REFACTOR: Clean up**
  - Confirm the entry is in the `staticPages` array and not appended to `cafes`/`blogs` (it has no slug).
  - Re-run: `bun test --isolate app/__tests__/sitemap.test.ts` — still PASS.

- [x] **Commit**

  ```bash
  git add app/sitemap.ts app/__tests__/sitemap.test.ts
  git commit -m "feat(seo): register for-owners in the sitemap (Task 8)"
  ```

---

### Task 9: Footer link in the Community group

**Files:**
- Modify: `components/layout/Footer.tsx` (the `// Community` group, immediately after the `Submit a Cafe` link at ~lines 108–115)
- Create: `components/layout/__tests__/Footer.test.tsx`

**Dependencies:** Task 7

**TDD Cycle:**

- [x] **RED: Write the failing test**

  Create `components/layout/__tests__/Footer.test.tsx`:

  ```tsx
  import { describe, it, expect, afterEach } from "bun:test"
  import { render, cleanup } from "@testing-library/react"
  import Footer from "@/components/layout/Footer"

  describe("Footer — cafe owner benefits link", () => {
      afterEach(() => {
          cleanup()
      })

      it("links to the cafe owner benefits page", () => {
          const { container } = render(<Footer />)
          const link = Array.from(container.querySelectorAll("a")).find(
              (anchor) => anchor.getAttribute("href") === "/for-owners"
          )
          expect(link).toBeTruthy()
          expect(link?.textContent?.trim()).toBe("For Cafe Owners")
      })

      it("places the link directly after Submit a Cafe", () => {
          const { container } = render(<Footer />)
          const hrefs = Array.from(container.querySelectorAll("a")).map(
              (anchor) => anchor.getAttribute("href")
          )
          const submitIndex = hrefs.indexOf("/submit")
          const ownersIndex = hrefs.indexOf("/for-owners")
          expect(submitIndex).toBeGreaterThanOrEqual(0)
          expect(ownersIndex).toBe(submitIndex + 1)
      })
  })
  ```

- [x] **RED: Verify the test fails**

  Run: `bun test --isolate components/layout/__tests__/Footer.test.tsx`

  Expected: FAIL — `expect(received).toBeTruthy()` fails, no `/for-owners` anchor exists.

- [x] **GREEN: Write minimal implementation**

  In `components/layout/Footer.tsx`, inside the Community column's `flex flex-col gap-3` wrapper, insert immediately after the existing `Submit a Cafe` `<Link>`:

  ```tsx
  <Link
      href='/for-owners'
      className='text-background/80 hover:text-background transition-colors text-sm'
  >
      For Cafe Owners
  </Link>
  ```

  The class string must match the neighbouring links exactly — that group is styled uniformly.

- [x] **GREEN: Verify the test passes**

  Run: `bun test --isolate components/layout/__tests__/Footer.test.tsx`

  Expected: PASS — 2 tests, 0 failures.

- [x] **REFACTOR: Clean up**
  - Confirm `grep -rn '"/events"' components/layout/Footer.tsx` still shows the pre-existing dead link and that this task did **not** try to fix it (out of scope — spec §3).
  - Re-run the test file — still PASS.

- [x] **Commit**

  ```bash
  git add components/layout/Footer.tsx components/layout/__tests__/Footer.test.tsx
  git commit -m "feat(layout): link cafe owner benefits from the footer (Task 9)"
  ```

---

### Task 10: Contextual link inside the claim modal

**Files:**
- Modify: `components/modal/ClaimCafeModal.tsx` (the free-to-claim paragraph at ~lines 195–200, plus a `next/link` import)
- Create: `components/modal/__tests__/ClaimCafeModal.test.tsx`

**Dependencies:** Task 7

**TDD Cycle:**

- [x] **RED: Write the failing test**

  Create `components/modal/__tests__/ClaimCafeModal.test.tsx`. The mocks are required because the modal imports a server-action module and the storage client, neither of which can run inside a test.

  ```tsx
  import { describe, it, expect, mock, afterEach } from "bun:test"

  mock.module("@/app/api/actions/claim", () => ({
      submitCafeClaim: mock(() => Promise.resolve({ success: true })),
  }))

  mock.module("@/utils/storage/client", () => ({
      uploadOwnershipProofWithProgress: mock(() =>
          Promise.resolve({ success: true, url: "https://cdn.grounds.ph/proof.pdf" })
      ),
  }))

  mock.module("@/hooks/useHaptics", () => ({
      useHaptics: () => ({
          trigger: () => undefined,
          cancel: () => undefined,
          isSupported: false,
      }),
  }))

  import { render, screen, cleanup } from "@testing-library/react"
  import ClaimCafeModal from "@/components/modal/ClaimCafeModal"

  const renderModal = () =>
      render(
          <ClaimCafeModal
              isOpen
              onClose={() => undefined}
              cafeId="cafe-1"
              cafeName="Test Cafe"
          />
      )

  describe("ClaimCafeModal — owner benefits link", () => {
      afterEach(() => {
          cleanup()
      })

      it("keeps the free-to-claim promise", () => {
          renderModal()
          expect(screen.getByText(/completely free to claim/i)).toBeTruthy()
      })

      it("links to the owner benefits page", () => {
          const { container } = renderModal()
          const link = Array.from(container.querySelectorAll("a")).find(
              (anchor) => anchor.getAttribute("href") === "/for-owners"
          )
          expect(link).toBeTruthy()
          expect(link?.textContent?.trim()).toBe("See everything you get")
      })
  })
  ```

- [x] **RED: Verify the test fails**

  Run: `bun test --isolate components/modal/__tests__/ClaimCafeModal.test.tsx`

  Expected: the first test PASSES (the promise already exists); the second FAILS — `expect(received).toBeTruthy()` because no `/for-owners` anchor exists yet.

- [x] **GREEN: Write minimal implementation**

  In `components/modal/ClaimCafeModal.tsx`:

  1. Add the import alongside the other third-party imports, after the `lucide-react` block:

  ```tsx
  import Link from "next/link"
  ```

  2. Replace the free-to-claim paragraph with:

  ```tsx
  <p className='text-text/70 mb-4'>
      To claim ownership of this cafe, please provide proof that you
      are the owner or an authorized representative. It is completely
      free to claim and manage your business on Grounds.{" "}
      <Link
          href='/for-owners'
          className='font-medium text-primary hover:underline'
      >
          See everything you get
      </Link>
      .
  </p>
  ```

  Keep the link text on a single line so the assertion on trimmed `textContent` is stable.

- [x] **GREEN: Verify the test passes**

  Run: `bun test --isolate components/modal/__tests__/ClaimCafeModal.test.tsx`

  Expected: PASS — 2 tests, 0 failures.

- [x] **REFACTOR: Clean up**
  - Confirm no logic changed: the diff for this file must touch only the import block and this one paragraph. Run `git diff components/modal/ClaimCafeModal.tsx` and read it.
  - Re-run the test file — still PASS.

- [x] **Commit**

  ```bash
  git add components/modal/ClaimCafeModal.tsx components/modal/__tests__/ClaimCafeModal.test.tsx
  git commit -m "feat(claim): link owner benefits from the claim modal (Task 10)"
  ```

---

## Phase 4: Presentation & Polish

These tasks are **regression guards**, not new behaviour. A guard test that is green the moment you write it has not been proven to work, so each guard task below includes an explicit **mutation check**: introduce the violation, watch the guard fail, then revert. That is the RED step for this class of test, and it is what proves the guard catches anything at all.

### Task 11: Styling-convention guard

**Files:**
- Create: `components/owner/__tests__/owner-benefits-conventions.test.ts`

**Dependencies:** Task 10

**TDD Cycle:**

- [x] **RED: Write the guard test**

  Create `components/owner/__tests__/owner-benefits-conventions.test.ts`:

  ```typescript
  import { describe, it, expect } from "bun:test"
  import { readFileSync } from "node:fs"
  import { join } from "node:path"

  const read = (path: string) =>
      readFileSync(join(process.cwd(), path), "utf8")

  const PAGE_FILES = [
      "components/owner/OwnerBenefits.tsx",
      "components/owner/owner-benefits-content.ts",
      "app/for-owners/page.tsx",
  ]

  describe("owner benefits page — styling conventions", () => {
      it("ships no client components", () => {
          for (const file of PAGE_FILES) {
              const source = read(file)
              expect(source.includes('"use client"')).toBe(false)
              expect(source.includes("'use client'")).toBe(false)
          }
      })

      it("uses Tailwind v4 gradient utilities only", () => {
          for (const file of PAGE_FILES) {
              expect(read(file).includes("bg-gradient-to-")).toBe(false)
          }
      })

      it("adds no dark mode variants", () => {
          for (const file of PAGE_FILES) {
              expect(read(file).includes("dark:")).toBe(false)
          }
      })

      it("never uses the low-contrast secondary token for text", () => {
          for (const file of PAGE_FILES) {
              expect(read(file).includes("text-secondary")).toBe(false)
          }
      })

      it("does not hand-roll cursor-pointer", () => {
          for (const file of PAGE_FILES) {
              expect(read(file).includes("cursor-pointer")).toBe(false)
          }
      })

      it("uses theme tokens rather than raw hex colours", () => {
          const hex = /#[0-9a-fA-F]{3,8}\b/
          for (const file of PAGE_FILES) {
              expect(hex.test(read(file))).toBe(false)
          }
      })

      it("declares neither dynamic nor revalidate on the route", () => {
          const source = read("app/for-owners/page.tsx")
          expect(source.includes("export const dynamic")).toBe(false)
          expect(source.includes("export const revalidate")).toBe(false)
      })

      it("reads no request state and no user data", () => {
          for (const file of PAGE_FILES) {
              const source = read(file)
              expect(source.includes("searchParams")).toBe(false)
              expect(source.includes("getCurrentUser")).toBe(false)
              expect(source.includes('from "@/lib/auth"')).toBe(false)
              expect(source.includes('from "@/db"')).toBe(false)
          }
      })

      it("includes no images", () => {
          for (const file of PAGE_FILES) {
              const source = read(file)
              expect(source.includes("next/image")).toBe(false)
              expect(source.includes("<img")).toBe(false)
          }
      })
  })
  ```

- [x] **RED: Prove the guard actually fails**

  Run it first to confirm the current code complies:

  ```bash
  bun test --isolate components/owner/__tests__/owner-benefits-conventions.test.ts
  ```

  Expected: PASS — 9 tests. A green guard proves nothing yet, so now mutate the source deliberately.

  Temporarily change the hero section's className in `components/owner/OwnerBenefits.tsx` from `bg-linear-to-br from-primary/10` to `dark:bg-gradient-to-br from-primary/10`, then run the test again.

  Expected: FAIL — two failures at once (`uses Tailwind v4 gradient utilities only` and `adds no dark mode variants`). Confirm you see both, then **revert the mutation exactly** (`git diff` on the file must be empty before you continue).

  Run again: PASS — 9 tests. The guard is now proven.

- [x] **GREEN: Nothing to implement**

  This task adds only a test. The implementation already complies because Tasks 3–7 followed the spec's styling rules.

  Run: `bun test --isolate components/owner/__tests__/owner-benefits-conventions.test.ts`
  Expected: PASS — 9 tests, 0 failures.

- [x] **REFACTOR: Clean up**
  - `PAGE_FILES` must cover every file this plan creates that contains markup or copy — currently `components/owner/OwnerBenefits.tsx`, `components/owner/owner-benefits-content.ts` and `app/for-owners/page.tsx`. If a later change adds such a file, add it here.
  - Re-run the test file — still PASS.

- [x] **Commit**

  ```bash
  git add components/owner/__tests__/owner-benefits-conventions.test.ts
  git commit -m "test(owner): guard owner benefits styling conventions (Task 11)"
  ```

---

### Task 12: Copy-accuracy and accessibility guard on the rendered page

**Files:**
- Modify: `components/owner/__tests__/OwnerBenefits.test.tsx` (append one `describe` block)

**Dependencies:** Task 11

**TDD Cycle:**

- [x] **RED: Write the guard test**

  Append to `components/owner/__tests__/OwnerBenefits.test.tsx`:

  ```tsx
  describe("OwnerBenefits — copy accuracy and accessibility guards", () => {
      afterEach(() => {
          cleanup()
      })

      const BLOCKED_CLAIMS = [
          "verified badge",
          "0% commission",
          "unlimited photos",
          "instant publish",
          "export your analytics",
          "approve community menu suggestions",
      ]

      it("renders none of the blocked claims from the spec", () => {
          const { container } = render(<OwnerBenefits />)
          const text = (container.textContent ?? "").toLowerCase()
          for (const claim of BLOCKED_CLAIMS) {
              expect(text.includes(claim)).toBe(false)
          }
      })

      it("renders no marketing statistics", () => {
          const { container } = render(<OwnerBenefits />)
          const text = container.textContent ?? ""
          expect(/\d+\s*%/.test(text)).toBe(false)
          expect(/thousands of/i.test(text)).toBe(false)
          expect(/trusted by/i.test(text)).toBe(false)
          expect(/customers served/i.test(text)).toBe(false)
      })

      it("has exactly one h1 and never skips a heading level", () => {
          const { container } = render(<OwnerBenefits />)
          const headings = Array.from(
              container.querySelectorAll("h1, h2, h3")
          )
          expect(headings.filter((h) => h.tagName === "H1").length).toBe(1)
          expect(headings[0].tagName).toBe("H1")
          for (const heading of headings) {
              expect(["H1", "H2", "H3"]).toContain(heading.tagName)
          }
      })

      it("hides every icon from assistive technology", () => {
          const { container } = render(<OwnerBenefits />)
          const icons = Array.from(container.querySelectorAll("svg"))
          expect(icons.length).toBeGreaterThan(0)
          for (const icon of icons) {
              const explicitlyHidden =
                  icon.getAttribute("aria-hidden") === "true"
              const insideHiddenRegion =
                  icon.closest('[aria-hidden="true"]') !== null
              expect(explicitlyHidden || insideHiddenRegion).toBe(true)
          }
      })

      it("gives both primary calls to action a visible focus ring", () => {
          const { container } = render(<OwnerBenefits />)
          const ctas = Array.from(
              container.querySelectorAll('a[href="/cafes"]')
          )
          expect(ctas.length).toBe(2)
          for (const cta of ctas) {
              expect(cta.className).toContain("focus-visible:outline")
          }
      })
  })
  ```

- [x] **RED: Prove the guard actually fails**

  Run it first:

  ```bash
  bun test --isolate components/owner/__tests__/OwnerBenefits.test.tsx
  ```

  Expected: PASS — 25 tests. Now mutate `components/owner/owner-benefits-content.ts`: temporarily change one benefit description to include the text `verified badge`, then run again.

  Expected: FAIL — `renders none of the blocked claims from the spec` fails. Also try removing `aria-hidden="true"` from one icon inside the benefit-card grid and confirm `hides every icon from assistive technology` fails. Revert both mutations and confirm `git diff` on those two source files is empty.

  Run again: PASS — 25 tests. Both guards are now proven.

- [x] **GREEN: Nothing to implement**

  Run: `bun test --isolate components/owner/__tests__/OwnerBenefits.test.tsx`
  Expected: PASS — 25 tests, 0 failures.

- [x] **REFACTOR: Clean up**
  - Confirm `BLOCKED_CLAIMS` matches spec Appendix B exactly. If the spec gains a row, add it here in the same commit as the copy change.
  - Re-run the test file — still PASS.

- [x] **Commit**

  ```bash
  git add components/owner/__tests__/OwnerBenefits.test.tsx
  git commit -m "test(owner): guard copy accuracy and icon accessibility (Task 12)"
  ```

---

### Task 13: Verification gate — full suite, lint, types, static-rendering proof

**Files:**
- Modify: none (verification only). If a check fails, fix the offending file from an earlier task and re-run.

**Dependencies:** Task 12

**Note:** this is a verification gate, not a TDD code task — it introduces no source change, so there is no RED step. Do not invent a test to satisfy the shape of the template; the checks below are the deliverable.

- [x] **Run the full test suite**

  ```bash
  bun run test
  ```

  Expected: all tests pass. `bun run test` already passes `--isolate`, which is mandatory because `mock.module` is process-wide (the ClaimCafeModal and sitemap tests both mock modules).

  If anything fails, read the failure, fix it, and re-run the whole suite — not just the failing file.

- [x] **Run the linter**

  ```bash
  bun run lint
  ```

  Expected: no errors. Warnings about unused imports must be fixed, not silenced.

- [x] **Run the type checker**

  ```bash
  bunx tsc --noEmit
  ```

  Expected: no output (exit 0). `tsconfig.json` excludes `**/__tests__/**` from compilation, so a type error inside a test file will not surface here — the test run is the check for those.

- [x] **Prove the route is statically rendered**

  ```bash
  bun run build 2>&1 | tail -40
  ```

  Expected: the route table contains a `/for-owners` line marked as static (`○`). If the build fails for reasons unrelated to this work (for example a missing env var for a different route), record the failure output in the PR description and fall back to the two structural proofs below:

  ```bash
  grep -rn "export const dynamic\|export const revalidate\|use client" app/for-owners/ components/owner/OwnerBenefits.tsx components/owner/owner-benefits-content.ts
  ```

  Expected: no matches at all. Combined with Task 11's guard, that is sufficient evidence the route cannot be dynamically rendered or hydrated.

- [x] **Confirm nothing out of scope was touched**

  ```bash
  git status --short
  git diff --stat prod...HEAD
  ```

  Expected: the changed paths are exactly the ones listed in the File structure section. **No** files under `db/`, `drizzle/`, `app/api/`, `emails/`, and no changes to `proxy.ts`, `app/robots.ts`, `components/chat/ChatWidget.tsx`, or `utils/routes.ts`. If any of those appear, revert them.

- [x] **Commit**

  Only if a fix was required:

  ```bash
  git add -A
  git commit -m "fix(owner): address verification findings (Task 13)"
  ```

  If everything passed first time, there is nothing to commit — proceed to Phase 5.

---

## Phase 5: E2E Browser Testing

### Prerequisites for all E2E tasks

**Start the dev server on plain HTTP, not HTTPS.** The `bun dev` script runs `next dev --experimental-https` with the self-signed cert in `certificates/`. Headless Chromium on macOS shows a certificate interstitial for that cert, and `--ca-cert` only affects the agent-browser CLI's own trust, not the browser's. Bypass the script:

```bash
cd /Users/adrianbonpin/Documents/Code/personal/groundsph
bunx next dev --port 3210 > /tmp/for-owners-e2e.log 2>&1 &
sleep 12
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3210/for-owners
```

Expected: `200`. If you see `000`, the server is not up yet — check `/tmp/for-owners-e2e.log` and wait longer.

**Stop the server when the phase is done:** `lsof -ti:3210 | xargs kill`

**App URL for every task below:** `http://localhost:3210`

**Screenshots:** `docs/superpowers/e2e/screenshots/` — create it once with `mkdir -p docs/superpowers/e2e/screenshots`.

---

### Task 14: E2E — route is public, page renders, CTAs navigate

**Files:**
- Create: `docs/superpowers/e2e/for-owners.md`
- Screenshot: `docs/superpowers/e2e/screenshots/for-owners-desktop.png`

**Dependencies:** Phase 4 complete, dev server running on port 3210

**E2E Cycle:**

- [x] **DEFINE: Write the E2E test script**

  Create `docs/superpowers/e2e/for-owners.md`:

  ```markdown
  # E2E Test: Cafe Owner Benefits Page

  **App URL:** http://localhost:3210
  **Page under test:** /for-owners
  **Server:** `bunx next dev --port 3210` (plain HTTP — the `bun dev` script's self-signed cert triggers a Chromium interstitial)

  ## Flow 1 — Route is public, page renders, CTAs navigate

  ### Steps
  1. `curl -s -o /dev/null -w "%{http_code}" http://localhost:3210/for-owners`
  2. Open http://localhost:3210/for-owners
  3. Snapshot the page and confirm the `<h1>`
  4. Confirm all seven section headings are present
  5. Click the primary CTA and confirm the URL lands on `/cafes`
  6. Return, click the secondary CTA and confirm the auth redirect carries `/submit`
  7. Screenshot: `for-owners-desktop.png`

  ### Acceptance Criteria
  - [ ] Server responds `200`, not `307`/`308` — the page is **not** behind the auth middleware
  - [ ] Exactly one `<h1>`, reading "Your cafe, finally yours online"
  - [ ] All seven headings present: hero, Free and it stays free, Own your listing, Get found, Bring customers in, Hear your customers, Know what is working
  - [ ] Primary CTA resolves to `/cafes`
  - [ ] Secondary CTA resolves to `/auth` with a redirect parameter for `/submit`
  - [ ] No console errors
  - [ ] Desktop screenshot saved

  ## Results

  _Filled in after execution._
  ```

- [x] **EXECUTE: Run the E2E test**

  **Step 1 — the auth-guard check (this is the highest-value assertion in the whole plan).** Run:

  ```bash
  curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3210/for-owners
  ```

  Expected exactly: `200 ` (code 200, empty redirect). A `307` or `308` with `/auth` in the redirect means the route fell under the `/owner` prefix guard — stop and fix the route name before continuing.

  **Step 2 — browser checks.** Using `agent_browser` directly (or dispatch a general-purpose subagent with these exact instructions):

  ```
  agent_browser { args: ["open", "http://localhost:3210/for-owners"] }
  agent_browser { args: ["snapshot", "-i"] }
  ```

  Then run this evaluation to assert structure in one shot:

  ```
  agent_browser { args: ["eval", "--stdin"], stdin: "(() => { const headings = Array.from(document.querySelectorAll('h1,h2')).map(h => h.tagName + ':' + h.textContent.trim()); return { h1Count: document.querySelectorAll('h1').length, headings, ctaHrefs: Array.from(document.querySelectorAll('a')).map(a => a.getAttribute('href')).filter(h => h === '/cafes' || h === '/submit'), detailsCount: document.querySelectorAll('details').length, scripts: document.querySelectorAll('script[type=\"application/ld+json\"]').length }; })()" }
  ```

  Expected:
  - `h1Count: 1`
  - `headings` contains `H2:Free, and it stays free`, `H2:Own your listing`, `H2:Get found`, `H2:Bring customers in`, `H2:Hear your customers`, `H2:Know what is working`, `H2:How claiming works`, `H2:Included from day one`, `H2:Questions cafe owners ask`, `H2:Ready to take the keys?`
  - `ctaHrefs` is `["/cafes","/submit","/cafes","/submit"]`
  - `detailsCount: 9`
  - `scripts: 2`

  **Step 3 — primary CTA navigation.** Snapshot again, then click the first `/cafes` link by ref (from the fresh snapshot), and confirm:

  ```
  agent_browser { args: ["get", "url"] }
  ```

  Expected: URL contains `/cafes`.

  **Step 4 — secondary CTA navigation.** Open `/for-owners` again, click the first `/submit` link, then `get url`.

  Expected: URL contains `/auth` and the query string carries `submit` (percent-encoded as `%2Fsubmit`). This proves the middleware redirect works and the destination survives it.

  **Step 5 — screenshot.**

  ```
  agent_browser { args: ["open", "http://localhost:3210/for-owners"] }
  agent_browser { args: ["screenshot", "docs/superpowers/e2e/screenshots/for-owners-desktop.png"] }
  ```

- [x] **VERIFY: Check results**
  - All acceptance criteria in the markdown pass.
  - Check for console errors: `agent_browser { args: ["errors"] }` — expect none.
  - Confirm the screenshot file exists and is non-empty: `ls -l docs/superpowers/e2e/screenshots/for-owners-desktop.png`
  - **Do not claim success from the tool's return alone** — check `artifactVerification` in the screenshot result, or verify the file size on disk.

- [x] **DOCUMENT: Save evidence**

  Replace the `## Results` section of `docs/superpowers/e2e/for-owners.md` with the real observed values: the curl status line, the `h1Count`/`detailsCount`/`scripts` counts, the resolved CTA URLs, and a reference to `screenshots/for-owners-desktop.png`.

- [x] **Commit**

  ```bash
  git add docs/superpowers/e2e/for-owners.md docs/superpowers/e2e/screenshots/for-owners-desktop.png
  git commit -m "test(e2e): verify for-owners renders publicly and CTAs navigate (Task 14)"
  ```

---

### Task 15: E2E — mobile viewport, FAQ keyboard operability, no-JS resilience

**Files:**
- Modify: `docs/superpowers/e2e/for-owners.md` (append Flow 2)
- Screenshot: `docs/superpowers/e2e/screenshots/for-owners-mobile.png`

**Dependencies:** Task 14

**E2E Cycle:**

- [x] **DEFINE: Write the E2E test script**

  Append to `docs/superpowers/e2e/for-owners.md`:

  ```markdown
  ## Flow 2 — Mobile viewport, FAQ keyboard operability, no-JS resilience

  ### Steps
  1. Launch a fresh browser at 390x844 (phone width)
  2. Open /for-owners
  3. Assert no horizontal overflow
  4. Assert the hero CTA is visible and tappable
  5. Screenshot: `for-owners-mobile.png`
  6. Focus the first FAQ summary, press Enter, confirm it expands
  7. Disable JavaScript, reload, confirm the page and FAQ still render

  ### Acceptance Criteria
  - [ ] `document.documentElement.scrollWidth <= window.innerWidth` at 390px
  - [ ] Both CTAs present in the mobile layout
  - [ ] Mobile screenshot saved
  - [ ] First `<details>` gains the `open` attribute after Enter on its summary
  - [ ] With JS disabled the page still shows the h1 and all nine FAQ items
  ```

- [x] **EXECUTE: Run the E2E test**

  **Step 1 — phone viewport.** Launch a fresh session sized to a phone:

  ```
  agent_browser { sessionMode: "fresh", args: ["--args", "--window-size=390,844", "open", "http://localhost:3210/for-owners"] }
  ```

  **Step 2 — overflow check:**

  ```
  agent_browser { args: ["eval", "--stdin"], stdin: "(() => ({ innerWidth: window.innerWidth, scrollWidth: document.documentElement.scrollWidth, overflows: document.documentElement.scrollWidth > window.innerWidth, ctaCount: document.querySelectorAll('a[href=\"/cafes\"], a[href=\"/submit\"]').length }))()" }
  ```

  Expected: `overflows: false`, `ctaCount: 4`.

  **Step 3 — mobile screenshot:**

  ```
  agent_browser { args: ["screenshot", "docs/superpowers/e2e/screenshots/for-owners-mobile.png"] }
  ```

  **Step 4 — FAQ keyboard.** Snapshot, `scrollintoview` the first `<summary>` ref, click it to focus, then press Enter and re-check:

  ```
  agent_browser { args: ["eval", "--stdin"], stdin: "(() => { const first = document.querySelector('details'); const before = first ? first.hasAttribute('open') : null; if (first) first.querySelector('summary').focus(); return { beforeFocus: before, focused: document.activeElement ? document.activeElement.tagName : null }; })()" }
  ```

  Then activate it with a real key event (not `.click()`):

  ```
  agent_browser { args: ["press", "Enter"] }
  agent_browser { args: ["eval", "--stdin"], stdin: "(() => ({ openAfterEnter: document.querySelector('details').hasAttribute('open') }))()" }
  ```

  Expected: `openAfterEnter: true`. This is what proves the native `<details>` gives keyboard users a working FAQ with zero JavaScript of ours in the path.

  **Step 5 — no-JS resilience.** The decision in the spec was zero client JS, so the page must survive JavaScript being off. Verify structurally rather than by toggling a browser preference, which agent-browser does not expose:

  ```bash
  curl -s http://localhost:3210/for-owners | grep -c '<details'
  curl -s http://localhost:3210/for-owners | grep -o 'Your cafe, finally yours online' | head -1
  curl -s http://localhost:3210/for-owners | grep -c '<script src=' || true
  ```

  Expected: `9` details elements in the raw HTML, the h1 text present, and **zero** external script tags (no hydration bundle is needed for the content to exist). Record the first two numbers in the results section.

  Then close the fresh browser session: `agent_browser { args: ["close"] }`.

- [x] **VERIFY: Check results**
  - Acceptance criteria in Flow 2 pass.
  - `ls -l docs/superpowers/e2e/screenshots/for-owners-mobile.png` — file exists and is non-empty.
  - If `overflows` is `true`, fix the layout (most likely a fixed-width grid) in `components/owner/OwnerBenefits.tsx` and re-run this task. Do not document a failure as a pass.

- [x] **DOCUMENT: Save evidence**

  Fill in Flow 2's results with the measured `scrollWidth`/`innerWidth`, the `openAfterEnter` value, the `<details>` count from raw HTML, and the mobile screenshot reference.

- [x] **Commit**

  ```bash
  git add docs/superpowers/e2e/for-owners.md docs/superpowers/e2e/screenshots/for-owners-mobile.png
  git commit -m "test(e2e): verify for-owners on mobile, FAQ keyboard and no-JS (Task 15)"
  ```

---

### Task 16: E2E — SEO artefacts and footer discoverability

**Files:**
- Modify: `docs/superpowers/e2e/for-owners.md` (append Flow 3)

**Dependencies:** Task 15

**E2E Cycle:**

- [x] **DEFINE: Write the E2E test script**

  Append to `docs/superpowers/e2e/for-owners.md`:

  ```markdown
  ## Flow 3 — SEO artefacts and footer discoverability

  ### Steps
  1. Fetch /sitemap.xml and confirm /for-owners is listed
  2. Fetch /robots.txt and confirm /for-owners is not disallowed while /owner/ still is
  3. Compare the FAQPage JSON-LD entity count against the rendered FAQ count
  4. Load the homepage and confirm the footer exposes the link

  ### Acceptance Criteria
  - [ ] `/sitemap.xml` contains a `<loc>` ending in `/for-owners`
  - [ ] `/robots.txt` does not mention `/for-owners`, and still disallows `/owner/`
  - [ ] FAQPage `mainEntity` count equals the rendered `<details>` count (structured data must match visible content)
  - [ ] The homepage footer links to `/for-owners`
  ```

- [x] **EXECUTE: Run the E2E test**

  **Step 1 — sitemap:**

  ```bash
  curl -s http://localhost:3210/sitemap.xml | grep -o '<loc>[^<]*for-owners</loc>'
  ```

  Expected: `<loc>http://localhost:3210/for-owners</loc>` (or the `https://grounds.ph` equivalent if `NEXT_PUBLIC_SITE_URL` is set in `.env.local`). If nothing prints, the sitemap entry is missing — revisit Task 8.

  **Step 2 — robots:**

  ```bash
  curl -s http://localhost:3210/robots.txt | grep -i 'for-owners' || echo "NOT_DISALLOWED"
  curl -s http://localhost:3210/robots.txt | grep '/owner/'
  ```

  Expected: first command prints `NOT_DISALLOWED`; second prints the `Disallow: /owner/` line, proving the marketing route is indexable while the dashboard prefix stays excluded.

  **Step 3 — structured-data parity:**

  ```
  agent_browser { args: ["open", "http://localhost:3210/for-owners"] }
  agent_browser { args: ["eval", "--stdin"], stdin: "(() => { const blocks = Array.from(document.querySelectorAll('script[type=\"application/ld+json\"]')).map(s => JSON.parse(s.textContent)); const faq = blocks.find(b => b['@type'] === 'FAQPage'); const crumbs = blocks.find(b => b['@type'] === 'BreadcrumbList'); return { blockCount: blocks.length, faqEntityCount: faq ? faq.mainEntity.length : null, renderedFaqCount: document.querySelectorAll('details').length, breadcrumbNames: crumbs ? crumbs.itemListElement.map(i => i.name) : null }; })()" }
  ```

  Expected: `blockCount: 2`, `faqEntityCount: 9`, `renderedFaqCount: 9` (the two must be equal), `breadcrumbNames: ["GroundsPH", "For Cafe Owners"]`.

  **Step 4 — footer discoverability:**

  ```
  agent_browser { args: ["open", "http://localhost:3210/"] }
  agent_browser { args: ["eval", "--stdin"], stdin: "(() => { const link = document.querySelector('footer a[href=\"/for-owners\"]'); return { found: !!link, label: link ? link.textContent.trim() : null }; })()" }
  ```

  Expected: `found: true`, `label: "For Cafe Owners"`.

- [x] **VERIFY: Check results**
  - All Flow 3 acceptance criteria pass.
  - Stop the dev server: `lsof -ti:3210 | xargs kill`
  - Re-run the full suite once more after stopping the server to confirm nothing depended on it: `bun run test`

- [x] **DOCUMENT: Save evidence**

  Fill in Flow 3's results with the sitemap `loc`, the robots output, the parity numbers, and the footer link result. Add a short `## Summary` at the end of the file stating which flows passed.

- [x] **Commit**

  ```bash
  git add docs/superpowers/e2e/for-owners.md
  git commit -m "test(e2e): verify for-owners SEO artefacts and footer link (Task 16)"
  ```

---

## Completion checklist

- [x] `bun run test` — whole suite green, run with `--isolate`
- [x] `bun run lint` — clean
- [x] `bunx tsc --noEmit` — clean
- [x] `/for-owners` renders while logged out (no auth redirect)
- [x] No `"use client"` in any file created by this plan
- [x] `docs/superpowers/e2e/for-owners.md` written with results and screenshot references
- [x] Footer link and sitemap entry present
- [x] PR description carries the `font-serif` inconsistency note from spec §2.4
