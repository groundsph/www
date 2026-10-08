# GroundsPH — Brand Guidelines

> **Version:** 2026.17.0 · **Last updated:** 2026-10-08 · **Owner:** GroundsPH
> **Source of truth:** `app/globals.css`, `app/layout.tsx`, `public/`, `assets/`
>
> Every value in this document is taken from the shipped codebase. Where the code and
> the intended brand disagree, it is flagged in [§12 Known gaps](#12-known-gaps--decisions-needed)
> rather than silently documented as "the rule".

---

## 0. How to use this document

1. **Tokens, not guesses.** Use the Tailwind token (`bg-primary`, `text-text`) — never a raw
   hex in a component. Raw hexes are how the palette drifts.
2. **Two faces, one voice.** The palette and the tagline are fixed. Layout, imagery and copy
   structure are encouraged to evolve.
3. **When in doubt, ask** before introducing a new colour, a new font, or a new logo lockup.

Quick links: [Brand](#1-brand-at-a-glance) · [Logo](#2-logo-system) · [Colour](#3-colour-palette) ·
[Type](#4-typography) · [Icons](#5-iconography) · [UI](#6-ui-components--patterns) ·
[Imagery](#7-imagery) · [Voice](#8-voice--tone) · [a11y](#10-accessibility) · [Cheat sheet](#11-cheat-sheet)

---

## 1. Brand at a glance

| | |
| :--- | :--- |
| **Name (written)** | **GroundsPH** — one word, capital G, capital PH |
| **Domain** | `grounds.ph` |
| **Primary tagline** | *Discover the finest cafes across the archipelago* |
| **SEO title** | *GroundsPH — Discover the Best Cafes in the Philippines* |
| **Boilerplate** | GroundsPH is a community-driven guide to the best cafes across the Philippines — daily highlights, honest reviews, and hidden gems waiting to be found. |
| **What we are** | A map-first, community-built cafe directory and coffee passport for the Philippines |
| **Not what we are** | Not a review-bombing app, not a paid listing directory, not a reservation platform |

### 1.1 Naming rules

| ✅ Use | ❌ Avoid |
| :--- | :--- |
| GroundsPH | Grounds PH, GroundsPh, groundsph, Grounds PH., GroundsPH™ |
| `grounds.ph` (domain only) | "Grounds.ph" used as the brand name in copy |
| "cafes" | "cafés" (we are accent-free in product copy) |
| "the Philippines", "the archipelago" | "PH" as a standalone noun in body copy |

### 1.2 Brand personality

Five traits, in priority order. If two conflict, the higher one wins.

1. **Warm** — a friend recommending a place, not a platform ranking one.
2. **Community-first** — the community contributes; we curate the edges.
3. **Honest** — "N/A (0 Reviews)" is shown, not hidden. Real stars, real counts.
4. **Local / on-the-ground** — provinces and regions are first-class, not an afterthought.
5. **Playful, but precise** — the winking mug is charming; the data underneath is exact.

---

## 2. Logo system

### 2.1 Primary mark — the Winking Mug

The mascot mark: a hand-drawn coffee mug, tilted a few degrees clockwise, with a **winking
eye**, a small smile, coffee splashing out of the rim, and a chunky handle. Cream body, dark
espresso outline, mocha coffee interior. It is deliberately *illustrated*, not geometric —
that is the brand's warmth in one asset.

| Property | Value |
| :--- | :--- |
| **Source file** | `public/icon.png` — 2048×2048, RGBA |
| **Rendered sizes** | `public/apple-icon-*.png`, `public/android-icon-*.png`, `public/favicon-{16,32,96}.png`, `public/ms-icon-*.png` |
| **Regeneration** | `./scripts/generate-icons.sh public/icon.png` |
| **Palette** | Espresso outline `#543310`, cream body `#F8F4E1`/`#F1DEC9`, mocha interior `#AF8F6F` |

**Minimum sizes**

| Context | Minimum |
| :--- | :--- |
| Favicon / app icon | 16 px (tested down to `favicon-16x16.png`) |
| Standalone mark in UI | 24 px |
| Anywhere with a wordmark | 32 px |

**Clear space:** leave at least the height of the mug's *handle* (≈ 15% of the mark's width)
free on all four sides. Nothing crosses that boundary — no text, no borders, no photos.

### 2.2 Wordmark

Two lockups are in use. Both are two-tone: the "PH" is **always** `secondary` (mocha).

**Interface lockup** — used in the navbar and footer (`components/layout/Navbar.tsx`,
`components/layout/Footer.tsx`):

```
Grounds PH          ← "Grounds" in text (espresso) · "PH" in secondary (mocha)
```

**Hero lockup** — used once per view, on the landing hero (`components/landing/LandingHero.tsx`):

```
GROUNDS.            ← uppercase, bold, espresso; the full stop is text/60
PH                  ← next line, medium weight, text/60
```

| ✅ Do | ❌ Don't |
| :--- | :--- |
| Keep "Grounds" and "PH" on one line in UI lockups | Split the UI lockup across lines |
| Keep the period in the hero lockup, muted | Make the period a brand colour or a graphic element |
| Set it in DM Sans (see §4) | Set the wordmark in the serif fallback |
| Leave the two-tone relationship intact | Recolour "PH" to `primary` or a status colour |

### 2.3 Collectible stamps (Coffee Passport)

Three decorative stamp illustrations, used to mark visited cafes in the profile passport.

| | |
| :--- | :--- |
| **Files** | `assets/stamps/1.svg`, `2.svg`, `3.svg` |
| **Viewbox** | `0 0 346 270.11` |
| **Colours** | Locked to the brand browns only — `#AF8F6F`, `#74512D`, `#543310` |
| **Consumption** | `components/profile/Passport.tsx` — deterministic pick by hashing the cafe name, so a cafe always gets the same stamp |
| **Usage** | Slightly rotated, pressed-on, overlapping the passport page. Never straighten them into a grid |

**Owner-uploaded badge stamps** (`utils/validation/badge-stamp.ts`): **PNG only, ≤ 500 KB**.
Owners design their own cafe stamp, so keep them inside the brand palette — a neon stamp on a
cream passport breaks the collection.

### 2.4 Lockups and don'ts

| ❌ Never |
| :--- |
| Recolour the mug, or apply gradients, drop shadows, bevels or outlines |
| Stretch, squash, rotate beyond the natural tilt, or squash to fit a square |
| Add effects, glows, or a hard stroke of a non-brand colour |
| Place the mark on a busy photo without a cream or espresso scrim behind it |
| Rebuild the mug in CSS, an emoji, or a different coffee icon |
| Use ☕ or any emoji as a stand-in for the mark |

### 2.5 Asset inventory

| Asset | Path | Dimensions | Use |
| :--- | :--- | :--- | :--- |
| Primary mark | `public/icon.png` | 2048×2048 | Source for all icons |
| Favicons | `public/favicon-{16,32,96}x*.png` | 16 / 32 / 96 | Browser tabs |
| Apple touch icons | `public/apple-icon-*.png` | 57–180 | iOS home screen |
| Android icons | `public/android-icon-*.png` | 36–192 | Android, PWA install |
| PWA / Windows tiles | `public/ms-icon-*.png` | 70–310 | Windows tiles |
| Social card | `public/og-image.jpg` | 1200×630 | Open Graph / Twitter |
| Passport stamps | `assets/stamps/{1,2,3}.svg` | 346×270.11 | Profile passport |
| Map pins | `public/marker-icon*.png`, `marker-shadow.png` | — | Leaflet map markers |
| Brand logos (partner) | `assets/logos/devgo-logo.png` | — | Supporter / partner sections only — never as our mark |

---

## 3. Colour palette

The palette is a **single-origin coffee ramp**: espresso → mocha → latte → foam, with one
caramel accent. Six tokens. Nothing else is a brand colour.

### 3.1 Core tokens

Defined once in `app/globals.css` under `@theme`.

| Token | Hex | Name | Role | Live usage |
| :--- | :--- | :--- | :--- | :--- |
| `text` | `#543310` | Espresso | Body text, dark bands, footer surface | 2496 `text-text`, 869 `bg-text` |
| `background` | `#F8F4E1` | Foam | Page surface — the default canvas | 472 `bg-background` |
| `primary` | `#74512D` | Roast | Primary buttons, headings, active states | 555 `bg-primary`, 544 `text-primary` |
| `secondary` | `#AF8F6F` | Mocha | The "PH", accents, the CTA band, highlights | 124 `bg-secondary` |
| `tertiary` | `#F1DEC9` | Latte | Card and panel fills, quiet surfaces | 193 `bg-tertiary` |
| `accent` | `#BC6C25` | Caramel | Sparingly — emphasis inside cream panels | 26 `bg-accent` |

**Derived automatically:**

```css
--color-border: color-mix(in srgb, var(--color-text) 10%, transparent);
/* on the default background this resolves to ≈ #E8E1CC */
```

### 3.2 The opacity ladder

Tinting is done with opacity on `text`, not with new hexes. The convention in the codebase:

| Step | Value | Renders as | Use for |
| :--- | :--- | :--- | :--- |
| Full | `text-text` | `#543310` | Headings, primary body |
| Muted | `text-text/80` | ≈ `#6B4C2E` | Secondary body |
| Quiet | `text-text/60` | ≈ `#968064` | Captions, inactive nav, "PH" in hero |
| Disabled | `text-text/50` | ≈ `#A79478` | Footer links, disabled controls |
| Wash | `bg-text/5`, `bg-text/10` | — | Segmented-control tracks, dividers |

### 3.3 Status and functional colour

Functional colour is allowed **only** for status, never for decoration or emphasis.

| Colour | Hex | Use |
| :--- | :--- | :--- |
| Red | `#ef4444` / `red-500` | Destructive actions, wishlist heart, errors |
| Green | `#22c55e` | Success, open/verified states |
| Amber | `#f59e0b` | Warnings |
| Provider blues | `#4285F4`, `#EA4335`, `#FBBC05`, `#34A853` | Google sign-in button only |
| Discord / brand blues | `#5865F2`, `#007DFE` | Third-party sign-in only |

### 3.4 Legacy colours — do not use

| Hex | Where it lives | Status |
| :--- | :--- | :--- |
| `#D4AF37` (gold) | `components/temp/cafeDetails-new.tsx` (23 occurrences) | **Legacy prototype.** Not a brand colour. Do not copy from this file |
| `#8B4513` (saddle brown) | `app/manifest.ts` `theme_color`, badge default `icon_color` | Brand-adjacent, but **not** a token. See [§12](#12-known-gaps--decisions-needed) |
| `#D2691E`, `#F4A460`, `#FFD700` | `components/ui/MilestoneCelebration.tsx` confetti | Celebration confetti only |
| `#1A1A1A`, `#FF5E5B` | Assorted one-offs | Not brand — remove on touch |

### 3.5 Colour rules

- ✅ Always use the token class (`bg-primary`), never the hex.
- ✅ Cards sit on `background` and are filled with `tertiary`; do not stack `tertiary` on `tertiary`.
- ✅ Dark bands use `bg-text` with `text-background` and `text-background/70` for muted copy (footer, CTA).
- ✅ Icons inherit `currentColor`. Never hard-code an icon colour.
- ❌ Never introduce a new brown, tan or cream. Six tokens is the whole palette.
- ❌ Never use `secondary` for body text under 24 px — it fails contrast (see §10).
- ❌ Never use colour alone to convey state; pair it with an icon or label.

---

## 4. Typography

### 4.1 The typeface

**DM Sans** — geometric, warm, low-contrast. It is the only confirmed brand typeface.

```ts
// app/layout.tsx
const dmSans = DM_Sans({
    variable: "--font-dm-sans",
    display: "swap",
    adjustFontFallback: true,
})
```

| | |
| :--- | :--- |
| **Token** | `--font-sans` → `--font-dm-sans` |
| **Loading** | `next/font/google` (self-hosted at build, no external request) |
| **Weights in use** | 400 regular · 500 medium · 600 semibold · 700 bold |
| **Fallback** | Next.js `adjustFontFallback` — metric-matched, no layout shift |

### 4.2 Type scale

Observed in the shipped UI. Match the nearest row rather than inventing a size.

| Role | Classes | ≈ px | Weight |
| :--- | :--- | :--- | :--- |
| Hero lockup | `text-5xl md:text-6xl lg:text-7xl font-bold` | 48 → 72 | 700 |
| Hero "PH" | `text-4xl md:text-5xl lg:text-6xl font-medium` | 36 → 60 | 500 |
| Section heading | `text-2xl md:text-5xl lg:text-6xl font-bold` | 24 → 60 | 700 |
| Page / card heading | `text-lg sm:text-xl font-semibold` | 18 → 20 | 600 |
| Body | `text-base` | 16 | 400 |
| Body (compact) | `text-sm leading-relaxed` | 14 | 400 |
| Caption / meta | `text-xs` | 12 | 400 |
| Eyebrow / micro-label | `text-[10px] font-bold uppercase tracking-widest` | 10 | 700 |

**Case & tracking**

- Eyebrows, chips and micro-labels: **UPPERCASE**, `tracking-widest`, 10–12 px, muted.
- Everything else: sentence case. We do not shout headings.
- Never letter-space lowercase body copy.

### 4.3 Type specimen

**Complete character set — DM Sans**

```
UPPERCASE   ABCDEFGHIJKLMNOPQRSTUVWXYZ
lowercase   abcdefghijklmnopqrstuvwxyz
NUMERALS    0123456789
Punctuation ! " # $ % & ' ( ) * + , - . / : ; < = > ? @
Brackets    [ \ ] ^ _ ` { | } ~
Currency    ₱ $ € £ ¥
Accents     á à â ä ã å ç é è ê ë í ì î ï ñ ó ò ô ö õ ú ù û ü ý ÿ
Symbols     © ® ° ± × ÷ — – … • · → ← ↑ ↓ ★ ☆ ♥ ✓
```

> DM Sans is **Latin-only**. For non-Latin script (e.g. Filipino regional text, CJK, Arabic),
> specify an explicit fallback rather than relying on the metric-matched `adjustFontFallback`.

**Weight specimen** — each weight carries the same job everywhere in the product.

<span class="spec spec-400">Regular 400 — ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz<br />0123456789 ! ? & @ ₱ · — “quotes”</span>

<span class="spec spec-500">Medium 500 — ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz<br />0123456789 ! ? & @ ₱ · — “quotes”</span>

<span class="spec spec-600">Semibold 600 — ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz<br />0123456789 ! ? & @ ₱ · — “quotes”</span>

<span class="spec spec-700">Bold 700 — ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz<br />0123456789 ! ? & @ ₱ · — “quotes”</span>

| Weight | Assignment | Where it appears |
| :--- | :--- | :--- |
| 400 Regular | Reading text | Body copy, descriptions, footer links |
| 500 Medium | Interface text | Buttons, tabs, nav items, hero "PH" |
| 600 Semibold | Emphasis | Card titles, section labels, wordmark |
| 700 Bold | Structure & shout | Hero lockup, section headings, eyebrow labels |

**Numerals**

```
Proportional   0123456789
Tabular        0123456789   → use tabular-nums for aligned counts
Key figures    7 pts · 114 cafes · 4.8 ★ · 0 Reviews · ₱₱ · 5 km · 2026.17.0
```

Counts, points and ratings are set in whatever weight the surrounding label uses, but they
never drop below 12 px and never use `secondary` colour in a small size (see §10).

**Micro-label specimen** — `text-[10px] font-bold uppercase tracking-widest`

<span class="spec spec-micro">EXPLORE · COMMUNITY · LEGAL · TOP CAFE OF THE MONTH · CAR — CORDILLERA ADMINISTRATIVE REGION</span>

**Full scale specimen** — the same words at every step of the ramp in §4.2.

<span class="spec spec-h1">Discover the finest cafes</span>

<span class="spec spec-h2">Today's Featured</span>

<span class="spec spec-h3">Community Favorites</span>

<span class="spec spec-body">A community-driven guide featuring daily highlights, honest reviews, and hidden gems waiting to be found across the archipelago.</span>

<span class="spec spec-caption">Visited by 1 friend · Mar 22 · Cebu City</span>

### 4.4 ⚠️ The heading face is unresolved

The design clearly wants a **serif display face** for section headings — "Today's Featured",
"Latest Stories", "Community Favorites", "Found a spot we missed?", "Recently Added Cafes" —
and the code asks for it with `font-serif` in `Navbar.tsx`, `Footer.tsx`,
`LandingHero.tsx` and `Passport.tsx`.

**But `--font-serif` is commented out** in `app/globals.css`:

```css
/* --font-serif: var(--font-playfair-display); */
```

So every `font-serif` heading currently falls back to Tailwind's platform stack
(`ui-serif, Georgia, …`) — **New York on macOS, Georgia elsewhere**. The brand's headline
face is therefore different on every device.

This is the single biggest typographic risk in the brand: the specimens above will render
differently on every device the moment `font-serif` is applied to them.

**Until this is resolved:**

- Do **not** add new `font-serif` usages.
- Do **not** set the wordmark in `font-serif` (the navbar and footer currently do).
- Pick from [§12](#12-known-gaps--decisions-needed): ship a real serif, or go sans-only.

---

## 5. Iconography

### 5.1 The icon set

**Lucide** (`lucide-react` ^0.556.0) is the only icon library. No mixing, no bespoke icon
fonts, no emoji as icons.

| | |
| :--- | :--- |
| **Stroke style** | Outline, rounded caps/joins, `stroke-width: 2` (the Lucide default; `3` for tiny/emphasis, `2.5` sparingly) |
| **Colour** | Always `currentColor` — never a hard-coded hex |
| **Alignment** | Optically centred with adjacent text; `shrink-0` in flex rows |

### 5.2 Sizes

| Size | Classes | Use |
| :--- | :--- | :--- |
| 14 px | `w-3.5 h-3.5` | Inline meta (RSS, region labels) |
| 12 px | `w-3 h-3` | Micro chips |
| 16 px | `w-4 h-4` | **Default.** Inline with body text, buttons |
| 20 px | `w-5 h-5` | Navbar, standalone actions |
| 24 px | `w-6 h-6` | Section headers, feature icons |
| 32–48 px | `w-8` → `w-12` | Empty states, hero moments |

Never size an icon by a percentage or `em` — always a fixed Tailwind size step.

### 5.3 Core icon vocabulary

Keep action → icon mapping consistent across the product.

| Meaning | Icon | Meaning | Icon |
| :--- | :--- | :--- | :--- |
| Cafe / coffee | `Coffee`, `Cup` | Visited / passport | `Stamp` |
| Location | `MapPin`, `MapPinIcon` | Favourite | `Heart` |
| Rating | `Star` | Wishlist | `Bookmark` |
| Search | `Search` | Notifications | `Bell` |
| Discover randomly | `Dice` / custom `RandomCafeButton` | Contact | `Mail` |
| Social | `Facebook`, `Rss` (TikTok uses a text label) | Awards | `Award`, `Trophy`, `Medal` |

### 5.4 Badge icon set

Owner-awardable badges draw from a **curated, grouped subset of Lucide** —
`components/badges/iconUtils.ts` (~110 icons in 6 categories):

| Group | Examples |
| :--- | :--- |
| Achievement & awards | `Award`, `Medal`, `Trophy`, `Crown`, `Gem`, `Star`, `Sparkles` |
| Coffee & food | `Coffee`, `Cup`, `Milk`, `Cookie`, `Cake`, `Croissant`, `IceCream`, `Bean`, `Leaf` |
| Social & community | `Heart`, `HeartHandshake`, … |
| …4 further groups | Browse `BADGE_ICONS` in the file |

Add to this list rather than reaching for an arbitrary Lucide import — badge icons appear
next to each other in grids and must share visual weight.

---

## 6. UI components & patterns

### 6.1 Foundations

| | |
| :--- | :--- |
| **Styling** | Tailwind CSS v4, PostCSS plugin only — **no `tailwind.config.js`**. Tokens live in `@theme` in `app/globals.css` |
| **Class helper** | `cn()` from `@/utils/cn` for conditional classes |
| **Motion** | `motion/react` (never `framer-motion`) |
| **Default transition** | `300ms` (set once as `--default-transition-duration`) |
| **Haptics** | `useHaptics()` on mobile for taps, selections, milestones |

### 6.2 Corner radius

| Radius | Classes | Use |
| :--- | :--- | :--- |
| **Default** | `rounded-lg` | Buttons, inputs, small panels |
| Cards | `rounded-xl` (sometimes `rounded-2xl`) | Cafe cards, media containers |
| Pills | `rounded-full` | Chips, avatars, icon buttons, badges |
| Square | `rounded` | Rare — toolbars, dense controls |

Do not use `rounded-sm`/`rounded-md` for new surfaces; they read as unintended.

### 6.3 Buttons

There is **no shared `Button` component** yet — variants are repeated inline. Use these exact
patterns so the repetition stays consistent:

| Variant | Pattern |
| :--- | :--- |
| **Primary** | `bg-primary text-white rounded-lg font-medium hover:bg-primary/90` |
| **Secondary / ghost** | `border border-primary/20 text-primary hover:bg-primary/5` |
| **Tinted (quiet)** | `bg-primary/10 text-primary` |
| **Chip** | `bg-primary/15 text-primary text-sm font-bold px-2.5 py-1 rounded-full` |
| **On dark bands** | `bg-background text-text` |
| **Destructive** | `text-red-500` / `bg-red-500 text-white` |

Every interactive element gets `[&_button]:cursor-pointer` from the root layout — do not add
`cursor-pointer` per button.

### 6.4 Surfaces

| Surface | Treatment | Where |
| :--- | :--- | :--- |
| Page | `bg-background text-text` | Everywhere |
| Card / panel | `bg-tertiary` + `border-border`, `rounded-xl` | Cafe cards, list rows |
| Dark band | `bg-text text-background` | Footer, milestone moments |
| Accent band | `bg-secondary` with cream text | "Found a spot we missed?" CTA |
| Segmented control | `bg-text/5` track, `bg-background` active thumb | Passport tabs |

### 6.5 Motion

| Duration | Use |
| :--- | :--- |
| `200ms` | Micro — hover, colour, icon swaps |
| `300ms` | Default — everything without a reason to differ |
| `500–800ms` | Entrances, hero reveal (`opacity 0 → 1`, `y: 10 → 0`, `easeOut`) |
| Special | `@keyframes shimmer` (1.5 s) for loading skeletons; confetti for milestones |

Entrances stagger by ~0.1 s. Never animate colour-and-motion at the same time on the same
element; never block interaction on an animation.

### 6.6 Scrollbars

`.custom-scrollbar` — 6 px, transparent track, thumb at `text/15` → `text/25` on hover.
Use it on every internally-scrolling panel.

---

## 7. Imagery

### 7.1 Photography

- **Real cafes, real light.** Interiors, latte art, signage, storefronts — shot as found.
- Prefer **warm, low-saturation** images that sit beside the cream palette. Reject
  heavy blue/teal grading.
- Human presence is welcome (a barista's hands, a seated guest) but faces are not the subject.
- Card crops are landscape; the hero media is a wide banner. Keep the subject centred —
  crops happen at multiple breakpoints.
- No stock "business handshake", no generic coffee-bean macro as a hero, no AI-generated
  cafe interiors.

### 7.2 Technical

| | |
| :--- | :--- |
| **CDN** | `cdn.grounds.ph` (Cloudflare R2, presigned uploads) |
| **Allowed remote hosts** | `images.unsplash.com`, `cdn.grounds.ph` (`next.config.ts`) |
| **Optimisation** | `images.unoptimized: true` — images are pre-sized at upload |
| **Placeholder** | `CAFE_PLACEHOLDER_URL` in `utils/extras.ts` |
| **Owner stamp uploads** | PNG only, ≤ 500 KB |

### 7.3 Social card (`og-image.jpg`)

The 1200×630 Open Graph card is a **template**, not a one-off. Keep its composition:

- Cream (`background`) canvas.
- Eyebrow line in espresso: *"Discover the finest cafes across the archipelago"*.
- `GROUNDS.` large and bold, `PH` beneath it in mocha.
- The winking mug **bleeding off the right edge**, cropped — it is a corner mark, not a logo stamp.

---

## 8. Voice & tone

### 8.1 Principles

| We are | We are not |
| :--- | :--- |
| A well-travelled friend | An algorithm |
| Specific ("88th Avenue, Cebu City") | Vague ("a great spot") |
| Honest about gaps ("N/A (0 Reviews)") | Inflating ("1000+ rave reviews!") |
| Inviting ("Found a spot we missed?") | Demanding ("Submit now") |
| Filipino-rooted, plainspoken English | Corporate brand-speak |

### 8.2 Mechanics

- Sentence case for headings and buttons. **UPPERCASE only** for eyebrows, chips and micro-labels.
- Second person for the reader ("your passport", "your favourites"), first person plural for us ("we currently have 114 cafes").
- Numerals for counts and distances; no spelled-out numbers in UI.
- Philippine English spelling: *favourite*, *colour*, *organise*. "Cafe" without the accent.
- No exclamation stacks. One "!" is already loud.

### 8.3 Microcopy patterns

| Situation | Write this |
| :--- | :--- |
| Empty state | Plain statement + next step — *"No stamps yet. Start visiting cafes to fill your passport!"* |
| CTA band | Question + reassurance — *"Found a spot we missed? Help the community grow by sharing your favourite spots."* |
| Unknown data | *"N/A (0 Reviews)"* — never hide the field |
| Milestone | Celebrate the person, not the metric — *"You've visited 5 cafes"* |
| Error | What happened + what to do. No blame, no codes alone. |

### 8.4 Boilerplate copy (copy-paste ready)

- **One line:** GroundsPH is a community-driven guide to the best cafes in the Philippines.
- **Short:** GroundsPH helps you discover and explore the best cafes across the Philippines — daily highlights, honest reviews, and hidden gems waiting to be found.
- **Long:** GroundsPH is a community-driven platform for discovering, reviewing, and supporting cafes across the Philippines. Explore by map, collect stamps in your coffee passport, follow the community's favourites, and share the spots we've missed. Built and maintained in Cebu.

---

## 9. Channels

| Channel | Handle / URL |
| :--- | :--- |
| Website | `https://grounds.ph` |
| Facebook | `facebook.com/grounds.philippines` |
| TikTok | `@grounds.ph` |
| Blog feed | `https://grounds.ph/feed.xml` |
| Email | `noreply@grounds.ph` (transactional), `/contact` (human) |
| Instagram | *planned — not yet linked in the footer* |

**Profile banner:** cream canvas, wordmark, tagline, mug bleeding off one edge — same
hierarchy as the OG card, cropped per platform.

---

## 10. Accessibility

Contrast ratios below are **measured**, not estimated (WCAG 2.1, sRGB).

| Foreground | Background | Ratio | Verdict |
| :--- | :--- | :--- | :--- |
| `text` `#543310` | `background` `#F8F4E1` | **10.24:1** | ✅ AAA |
| `background` `#F8F4E1` | `text` `#543310` | **10.24:1** | ✅ AAA (footer) |
| `text` `#543310` | `tertiary` `#F1DEC9` | **8.63:1** | ✅ AAA (cards) |
| `background` `#F8F4E1` | `primary` `#74512D` | **6.43:1** | ✅ AA (buttons) |
| `primary` `#74512D` | `background` `#F8F4E1` | **6.43:1** | ✅ AA |
| `primary` `#74512D` | `tertiary` `#F1DEC9` | **5.42:1** | ✅ AA |
| `secondary` `#AF8F6F` | `text` `#543310` | 3.76:1 | ⚠️ Large text / UI only |
| `accent` `#BC6C25` | `background` `#F8F4E1` | 3.58:1 | ⚠️ Large text / UI only |
| `text/60` (≈ `#968064`) | `background` | 3.42:1 | ⚠️ Large text / UI only |
| `secondary` `#AF8F6F` | `background` `#F8F4E1` | **2.72:1** | ❌ Fails — never for text |
| `border` (≈ `#E8E1CC`) | `background` | 1.18:1 | Decorative only (correct usage) |

**Non-negotiables**

- `secondary` is a **graphic** colour (the "PH", bands, highlights) — **not** a text colour under 24 px.
- Body copy is `text` or an opacity step down to `text/60`. Below that, it is decoration only.
- Focus: visible, never `outline: none` without a ring replacement.
- Every image needs meaningful `alt`; decorative marks use `alt=""`.
- Motion respects `prefers-reduced-motion`. Never rely on animation to convey state.
- Tap targets ≥ 44×44 px on mobile; icons at 16 px need padded hit areas.

---

## 11. Cheat sheet

```
SURFACE      bg-background              #F8F4E1   Foam
CARD         bg-tertiary                #F1DEC9   Latte
TEXT         text-text                  #543310   Espresso
HEADING/CTA  bg-primary / text-primary  #74512D   Roast
ACCENT       bg-secondary               #AF8F6F   Mocha   ← graphics only
EMPHASIS     bg-accent                  #BC6C25   Caramel ← sparingly

TYPE         DM Sans (--font-sans)  400 · 500 · 600 · 700
             Eyebrow: text-[10px] font-bold uppercase tracking-widest
             Do NOT use font-serif until §12 is resolved

RADIUS       rounded-lg (default) · rounded-xl (cards) · rounded-full (pills)
MOTION       300ms default · 200ms micro · 500–800ms entrances (motion/react)

ICONS        Lucide only · stroke-width 2 · currentColor · w-4 default
BUTTON       bg-primary text-white rounded-lg font-medium hover:bg-primary/90
CHIP         bg-primary/15 text-primary text-sm font-bold px-2.5 py-1 rounded-full

WORDMARK     Grounds (+ PH in mocha)   ·   Hero: GROUNDS. / PH
TAGLINE      Discover the finest cafes across the archipelago
```

---

## 12. Known gaps → decisions needed

| # | Issue | Impact | Recommendation |
| :--- | :--- | :--- | :--- |
| 1 | `--font-serif` is commented out in `app/globals.css` but `font-serif` is used in `Navbar`, `Footer`, `LandingHero`, `Passport` | Every section heading renders in *New York* on macOS and *Georgia* elsewhere. The brand has no consistent headline face | **Ship a serif** (the scaffolded `Playfair Display` is already named) or **remove `font-serif`** and standardise on DM Sans. Then update §4.4 |
| 2 | `components/temp/cafeDetails-new.tsx` uses `#D4AF37` gold 23× and `text-neutral-*` greys | A whole legacy design language is copy-pasteable | Delete the `components/temp/` folder once superseded |
| 3 | `app/manifest.ts` `theme_color: #8B4513`, `background_color: #AF8F6F` | The Android/PWA chrome tint matches no token | Set `theme_color` to `#74512D` (primary) and `background_color` to `#F8F4E1` |
| 4 | No shared `Button`/`Card` primitive; ~39 copies of the primary button class string | Variants drift silently | Extract `components/ui/Button.tsx` from the table in §6.3 |
| 5 | Two wordmark lockups with different casing (`Grounds` / `GROUNDS.`) | Both are fine *in their places* — but there is no documented rule | Rule adopted here: UI lockup = sentence case, hero lockup = uppercase. Keep it that way |
| 6 | Badge default `icon_color` is `#8B4513` | New badges ship off-palette | Default to `#74512D` |

---

## 13. Regenerating assets

```bash
# PWA / favicon / touch icons from the source mark
./scripts/generate-icons.sh public/icon.png

# PWA manifest colours live here
app/manifest.ts

# Palette + type tokens — the single source of truth
app/globals.css

# Rebuild this document's PDF
bun run brand:pdf

# ...or with the intermediate HTML kept for debugging
bun run scripts/build-brand-pdf.ts --keep
```

---

*GroundsPH Brand Guidelines · v2026.17.0 · Made in Cebu, Philippines*
