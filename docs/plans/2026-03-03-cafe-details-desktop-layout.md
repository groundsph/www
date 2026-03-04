# CafeDetails Desktop Layout Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve the desktop layout of `CafeDetails.tsx` and its sub-components to follow the grid-based two-column structure from `cafeDetails-new.tsx`, while keeping all existing theme tokens, colors, functionality, and mobile layout unchanged.

**Architecture:** The desktop section (`hidden md:flex`) in `CafeDetails.tsx` becomes a CSS grid layout (`grid-cols-12`) with a narrow 3-col left sidebar (from `CafeSidebar`) and a wider 9-col right content area. The Hero content overlay is repositioned to the bottom. The Hero's quick-glance pills move inline with the city/location row (no separate row). Socials in `CafeSidebar` get auto-detected brand icons. Price Range gets visual emphasis in the sidebar. Amenities + Extras move out of the sidebar and into the main content area (below the gallery). `RatingDistribution` becomes horizontal stacked bars.

**Tech Stack:** Next.js App Router, React, Tailwind CSS v4, `motion/react`, Lucide icons, existing project theme tokens (`primary`, `secondary`, `tertiary`, `background`, `text`, `accent`).

---

## Context & Constraints

### What is kept as-is (DO NOT CHANGE)
- All mobile layout (`md:hidden` section in `CafeDetails.tsx`)
- All modal/action/hook wiring (review, claim, lightbox, history, collection, milestone, check-in)
- All existing theme tokens — use `primary`, `secondary`, `tertiary`, `background`, `text`, `accent` only; no hardcoded hex
- `CafeHero.tsx` action buttons, name, verified/hidden-gem/chain badges, description, claim button — only the **layout structure** changes (bottom-anchored, pills inlined)
- `CafeTabs.tsx`, `CafeMobileContent.tsx` — completely untouched

### What changes (complete list)
1. **`CafeHero.tsx`** — Content pinned to `absolute bottom-0` with a `bg-gradient-to-t` overlay; quick-glance pills (Open/Closed, Price, Coffee Style, WiFi, Smoking, Rating) move **inline** into the location row (beside city • province), removing their separate `mt-4` row
2. **`CafeSidebar.tsx`** — Socials rendered with auto-detected brand icons (Instagram, Facebook, TikTok, X/Twitter, YouTube, etc.); Price Range visually emphasized (larger, bolder, token-colored); Amenities and Extras sections **removed** (they move to main content area in `CafeDetails.tsx`)
3. **`CafeDetails.tsx` desktop section** — Replace `flex-row` with `grid grid-cols-12`; gallery becomes a mosaic grid; scroll state/refs removed; Amenities + Extras card added below gallery in the 9-col main content
4. **`RatingDistribution.tsx`** — Replace vertical bar chart with horizontal stacked rows (5→1)

---

## Files Touched

| File | Change |
|---|---|
| `components/cafe/CafeHero.tsx` | Bottom overlay + pills inlined into location row |
| `components/cafe/CafeSidebar.tsx` | Social icons auto-detected; Price Range emphasized; Amenities + Extras sections removed |
| `components/cafe/CafeDetails.tsx` | Desktop grid layout + mosaic gallery + Amenities/Extras card in main content |
| `components/cafe/RatingDistribution.tsx` | Horizontal bar chart |

---

## Task 1: Reposition CafeHero Content + Inline Pills into Location Row

**Files:**
- Modify: `components/cafe/CafeHero.tsx`

### Current layout structure (lines 186–546)
```
<section> flex flex-col relative
  [background image absolute]
  <div> z-1 flex flex-col px-4 py-10 items-center   ← content block, top-anchored
    <div> max-w-7xl flex flex-col
      <h1> cafe name + badges
      <div> city • province                           ← location row
      <h2> address_display
      <div> mt-4 [Open/Closed] [Price] [Style] [WiFi] [Smoking] [Rating]  ← pills row (separate)
      <div> mt-4 action buttons
      <p>  mt-6 description
      [claim button]
```

### Target layout structure
```
<section> relative   (remove flex flex-col, keep min-h)
  [background image absolute]
  [gradient overlay absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent]
  <div> absolute bottom-0 left-0 right-0 z-10 px-4 pb-10 pt-6   ← content pinned to bottom
    <div> max-w-7xl mx-auto flex flex-col
      <h1> cafe name + badges  (unchanged)
      <div> city • province • [Open/Closed] [Price] [Style] [WiFi] [Smoking] [Rating]  ← pills inlined here
      <h2> address_display     (unchanged, below the row)
      <div> action buttons     (unchanged, mt-4)
      <p>  description         (unchanged, mt-6)
      [claim button]           (unchanged)
```

The pills are **removed from their own `<motion.div>` row** and merged into the location row, separated by a `•` bullet from province.

### Step 1: Add gradient overlay div
After the background image block (`heroImage ?? (...)`, ends around line 207), insert:
```tsx
{/* Bottom gradient overlay */}
<div className='absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none z-0' />
```

### Step 2: Change content container to bottom-anchored absolute
Change:
```tsx
<div className='z-1 w-full h-full flex flex-col px-4 py-10 items-center text-background'>
    <div className='w-full max-w-7xl flex flex-col'>
```
to:
```tsx
<div className='absolute bottom-0 left-0 right-0 z-10 px-4 pb-10 pt-6 text-background'>
    <div className='w-full max-w-7xl mx-auto flex flex-col'>
```

### Step 3: Inline quick-glance pills into the location row
The location row is currently (lines ~254–267):
```tsx
<motion.div
    ...
    className='flex flex-row items-center gap-2 mt-2 font-serif w-full'
>
    <span className='px-2 py-0.5 rounded-md bg-background/20 text-sm font-semibold'>
        {cafe.city_municipality}
    </span>
    <span className='text-background/60'>•</span>
    <span className='font-semibold text-lg'>
        {cafe.province}
    </span>
</motion.div>
```

Replace it with:
```tsx
<motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.5, delay: 0.1 }}
    className='flex flex-row flex-wrap items-center gap-2 mt-2 font-serif w-full'
>
    <span className='px-2 py-0.5 rounded-md bg-background/20 text-sm font-semibold'>
        {cafe.city_municipality}
    </span>
    <span className='text-background/60'>•</span>
    <span className='font-semibold text-lg'>
        {cafe.province}
    </span>
    <span className='text-background/60'>•</span>

    {/* Open/Closed Status */}
    <div
        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold backdrop-blur-sm ${
            openStatus.isOpen
                ? 'bg-green-500/20 text-green-300'
                : 'bg-white/10 text-white/70'
        }`}
    >
        <Clock className='w-3 h-3' />
        {openStatus.isOpen ? 'Open Now' : 'Closed'}
    </div>

    {/* Price Level */}
    <div className='flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-white/10 text-white backdrop-blur-sm'>
        {cafe.price_level === 'low' && '₱'}
        {cafe.price_level === 'medium' && '₱₱'}
        {cafe.price_level === 'high' && '₱₱₱'}
    </div>

    {/* Coffee Style */}
    {cafe.coffee_style && (
        <div className='flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 backdrop-blur-sm'>
            {cafe.coffee_style === 'classic' ? 'Classic' : 'Artisan'}
        </div>
    )}

    {/* WiFi */}
    {cafe.has_wifi && (
        <div className='flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 backdrop-blur-sm'>
            <WifiIcon className='w-3 h-3' />
            WiFi
        </div>
    )}

    {/* Smoking */}
    {cafe.has_smoking && (
        <div className='flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-zinc-500/20 text-zinc-300 backdrop-blur-sm'>
            <Cigarette className='w-3 h-3' />
            Smoking Area
        </div>
    )}

    {/* Rating */}
    {cafe.average_rating && (
        <div className='flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 backdrop-blur-sm'>
            <StarIcon className='w-3 h-3 fill-current' />
            {cafe.average_rating.toFixed(1)}
        </div>
    )}
</motion.div>
```

### Step 4: Delete the old pills `<motion.div>` row
Delete the entire old "Quick Facts Pills" `<motion.div>` block (lines ~280–337) — the one with `className='flex flex-row flex-wrap items-center gap-2 mt-4'` and `transition={{ duration: 0.5, delay: 0.2 }}`. All its content has been merged into the location row above.

### Step 5: Verify
- Desktop: name at bottom of hero, city • province • [pills] on one wrapped row, address below, buttons below that
- Mobile: same bottom-anchored layout; pills readable inline with city/province
- No layout break on long cafe names or many pills (flex-wrap handles overflow)

---

## Task 2: Refactor RatingDistribution to Horizontal Bars

**Files:**
- Modify: `components/cafe/RatingDistribution.tsx`

### Current behavior
Vertical bars in a `flex items-end h-20` container. Bars grow upward. 1–5 left to right.

### Target behavior
Vertical stack of rows, 5 → 1 from top. Each row:
```
[5] ████████████░░░░░░  12
[4] ██████░░░░░░░░░░░░   7
[3] ████░░░░░░░░░░░░░░   4
[2] █░░░░░░░░░░░░░░░░░   1
[1] ░░░░░░░░░░░░░░░░░░   0
```

### Step 1: Rewrite the return block

Replace the entire `return (...)` at lines 63–112 with:
```tsx
return (
    <div className='space-y-1.5'>
        {Array.from({ length: maxRating }, (_, i) => maxRating - i).map((rating) => {
            const count = distribution[rating]
            const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0

            return (
                <div
                    key={rating}
                    className='flex items-center gap-2 text-xs'
                    onMouseEnter={() => setHoveredRating(rating)}
                    onMouseLeave={() => setHoveredRating(null)}
                >
                    {/* Star number */}
                    <span className='w-3 text-right text-text/50 font-medium shrink-0 select-none'>
                        {rating}
                    </span>
                    {/* Bar track */}
                    <div className='flex-1 h-1.5 bg-text/10 rounded-full overflow-hidden'>
                        <div
                            className={`h-full rounded-full transition-all duration-300 ${getBarColor(rating)}`}
                            style={{ width: `${percentage}%` }}
                        />
                    </div>
                    {/* Count — always visible, no tooltip needed */}
                    <span className='w-4 text-right text-text/50 font-medium shrink-0 select-none'>
                        {count}
                    </span>
                </div>
            )
        })}
    </div>
)
```

### Step 2: Simplify the empty state
Replace the outer `bg-text/5 rounded-xl p-4` card empty state (lines 52–61) with:
```tsx
if (reviews.length === 0) {
    return <p className='text-xs text-text/50'>No reviews yet</p>
}
```

### Step 3: Remove the outer wrapper card
The old component wrapped everything in `<div className='bg-text/5 rounded-xl p-4'>` with an inner `<h3>Score Distribution</h3>`. Remove that — the new component is bare rows only. `CafeSidebar` already provides the "Ratings" section heading above `<RatingDistribution>`.

The `hoveredRating` state variable can stay (it's still used for `onMouseEnter`/`onMouseLeave`) but the tooltip `div` inside bars is gone since count is statically shown.

### Step 4: Verify
- Sidebar shows 5 rows, 5 at top, 1 at bottom
- Bar widths scale to count proportions
- Hover changes cursor but no tooltip appears (count is always visible)
- "No reviews yet" text shows instead of empty bars

---

## Task 3: Update CafeSidebar — Social Icons, Price Emphasis, Remove Amenities/Extras

**Files:**
- Modify: `components/cafe/CafeSidebar.tsx`

### 3a: Auto-detected social brand icons

**Current behavior (lines ~219–243):** Socials render as plain text links: `{social.title}` with no icons.

**Target behavior:** Detect the platform from `social.url` or `social.title` and render the matching Lucide icon beside the link text.

#### Step 1: Add a helper function above the component
```ts
function getSocialIcon(social: { title: string; url: string }): React.ReactNode {
    const lower = (social.url + social.title).toLowerCase()
    if (lower.includes('instagram')) return <Instagram className='w-4 h-4 shrink-0' />
    if (lower.includes('facebook') || lower.includes('fb.com')) return <Facebook className='w-4 h-4 shrink-0' />
    if (lower.includes('tiktok')) return <Music2 className='w-4 h-4 shrink-0' />
    if (lower.includes('twitter') || lower.includes('x.com')) return <Twitter className='w-4 h-4 shrink-0' />
    if (lower.includes('youtube') || lower.includes('youtu.be')) return <Youtube className='w-4 h-4 shrink-0' />
    if (lower.includes('grab') || lower.includes('foodpanda') || lower.includes('shopeefood')) return <ShoppingBag className='w-4 h-4 shrink-0' />
    return <Globe className='w-4 h-4 shrink-0' />
}
```

#### Step 2: Add missing Lucide imports to CafeSidebar.tsx
Add these to the existing lucide-react import block (already has `Globe`):
- `Instagram`
- `Facebook`
- `Music2` (TikTok proxy)
- `Twitter`
- `Youtube`
- `ShoppingBag`

`Globe` is already imported.

#### Step 3: Update the socials rendering block (lines ~219–243)
Change from rendering `{social.title}` text links to:
```tsx
{socials && socials.length > 0 && (
    <>
        <p className='text-sm font-semibold text-text/60'>Socials</p>
        <ul className='flex flex-col gap-2'>
            {socials.map((social) => (
                <li key={social.title}>
                    <a
                        href={
                            social.url.startsWith('http://') || social.url.startsWith('https://')
                                ? social.url
                                : `https://${social.url}`
                        }
                        target='_blank'
                        rel='noopener noreferrer'
                        className='flex items-center gap-2 text-sm font-semibold text-text hover:text-primary transition-colors hover:underline'
                    >
                        {getSocialIcon(social)}
                        {social.title}
                    </a>
                </li>
            ))}
        </ul>
    </>
)}
```

Note the layout change: from `flex flex-row` (horizontal) to `flex flex-col` (vertical stack) — this matches the reference sidebar which lists socials vertically with icons.

### 3b: Emphasize Price Range

**Current behavior (lines ~304–313):** Price range shows as a small inline label+value pair:
```tsx
<div className='flex flex-row items-center gap-2'>
    <p className='text-sm font-semibold text-text/60'>Price Range</p>
    <span className='text-sm font-bold text-text'>₱ / ₱₱ / ₱₱₱</span>
</div>
```

**Target behavior:** Price range displayed more prominently — larger symbol in `primary` color with a label above/beside:
```tsx
<div className='flex flex-row items-center justify-between'>
    <p className='text-sm font-semibold text-text/60'>Price Range</p>
    <span className='text-base font-bold text-primary'>
        {cafe.price_level === 'low' && '₱'}
        {cafe.price_level === 'medium' && '₱₱'}
        {cafe.price_level === 'high' && '₱₱₱'}
    </span>
</div>
```

### 3c: Remove Amenities and Extras sections from CafeSidebar

**Current location:** Amenities section lines ~474–644, Extras section lines ~648–743.

**Action:** Delete both sections from `CafeSidebar.tsx` entirely — they will be rendered in the main content area of `CafeDetails.tsx` instead (see Task 4).

Also remove the `border-b` divider before Amenities (the one at ~line 646) and before Extras (line 744).

Remove now-unused Lucide imports that were only used by amenity/extras icons:
- `WifiIcon`, `PlugIcon`, `CarIcon`, `SnowflakeIcon`, `PawPrintIcon`, `SunIcon`, `BriefcaseIcon`, `CoffeeIcon`, `Toilet`, `Droplet`, `MilkOff`, `Armchair`, `Cigarette`, `Coffee`

Keep imports still used by other sidebar sections: `StarIcon`, `UserIcon`, `CalendarIcon`, `History`, `MapPin`, `Globe` (now also used for social fallback).

### Step: Verify
- Socials section shows vertical list with auto-detected icons
- Price Range shows emphasized, right-aligned in `text-primary`
- Amenities and Extras sections are gone from sidebar
- No TypeScript errors from removed imports

---

## Task 4: Redesign CafeDetails Desktop Layout + Amenities/Extras Card

**Files:**
- Modify: `components/cafe/CafeDetails.tsx`

### 4a: Grid layout wrapper

Change the desktop section (lines ~369–372) from:
```tsx
<section
    id='desktop-body'
    className='hidden md:flex w-full flex-row items-start justify-start px-4 py-4 gap-4'
>
```
to:
```tsx
<section
    id='desktop-body'
    className='hidden md:grid md:grid-cols-12 w-full px-6 py-10 gap-10 max-w-[1400px] mx-auto'
>
```

### 4b: Sidebar column wrapper

Wrap the existing `<CafeSidebar .../>` in:
```tsx
<aside className='md:col-span-3'>
    <CafeSidebar
        cafe={cafe}
        reviews={reviews}
        onOpenHistory={() => setIsHistoryOpen(true)}
    />
</aside>
```

### 4c: Main content column

Change:
```tsx
{/* Main Content */}
<div className='flex-1 flex flex-col gap-6'>
```
to:
```tsx
{/* Main Content — 9 cols */}
<div className='md:col-span-9 flex flex-col gap-8'>
```

### 4d: Replace horizontal scroll gallery with mosaic grid

Remove lines ~383–464: the full horizontal gallery block (left/right scroll buttons, `scrollContainerRef`, scroll state, scroll-hint text).

Also remove the scroll-related state, refs, and functions that are no longer used:
- `const scrollContainerRef = useRef<HTMLDivElement>(null)` (line ~147)
- `const [canScrollLeft, setCanScrollLeft] = useState(false)` (line ~148)
- `const [canScrollRight, setCanScrollRight] = useState(true)` (line ~149)
- `const checkScroll = () => { ... }` (lines ~151–158)
- The `useEffect(() => { checkScroll(); window.addEventListener(...) }, [gallery])` (lines ~160–164)
- `const scroll = (direction) => { ... }` (lines ~171–184)

Replace the gallery JSX with the mosaic grid:
```tsx
{/* Gallery — Mosaic Grid (desktop only) */}
{gallery.length > 0 && (
    <section className='w-full'>
        <div
            className={`grid gap-2 rounded-xl overflow-hidden ${
                gallery.length === 1
                    ? 'grid-cols-1'
                    : gallery.length === 2
                      ? 'grid-cols-2'
                      : 'grid-cols-4 grid-rows-2'
            }`}
            style={{ height: gallery.length >= 3 ? '420px' : '300px' }}
        >
            {gallery.length >= 3 ? (
                <>
                    {/* Large featured — 2 cols × 2 rows */}
                    <div
                        className='col-span-2 row-span-2 relative group cursor-pointer overflow-hidden'
                        onClick={() => { setLightboxIndex(0); setIsLightboxOpen(true) }}
                    >
                        <Image
                            src={gallery[0]}
                            alt={`${cafe.name} photo 1`}
                            fill
                            className='object-cover transition-transform duration-500 group-hover:scale-105'
                            sizes='(min-width: 768px) 50vw, 100vw'
                            priority
                        />
                        <div className='absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors' />
                    </div>

                    {/* Smaller photos — up to 4 */}
                    {gallery.slice(1, 5).map((image, idx) => {
                        const isLastVisible = idx === 3 && gallery.length > 5
                        return (
                            <div
                                key={`${cafe.id}-mosaic-${idx + 1}`}
                                className='relative group cursor-pointer overflow-hidden'
                                onClick={() => { setLightboxIndex(idx + 1); setIsLightboxOpen(true) }}
                            >
                                <Image
                                    src={image}
                                    alt={`${cafe.name} photo ${idx + 2}`}
                                    fill
                                    loading='lazy'
                                    className='object-cover transition-transform duration-500 group-hover:scale-110'
                                    sizes='(min-width: 768px) 25vw, 50vw'
                                />
                                <div className='absolute inset-0 bg-black/5 group-hover:bg-black/0 transition-colors' />
                                {isLastVisible && (
                                    <div className='absolute inset-0 bg-black/50 flex items-center justify-center'>
                                        <span className='text-white font-bold text-sm'>
                                            +{gallery.length - 5} more
                                        </span>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </>
            ) : (
                gallery.slice(0, 2).map((image, idx) => (
                    <div
                        key={`${cafe.id}-mosaic-${idx}`}
                        className='relative group cursor-pointer overflow-hidden'
                        onClick={() => { setLightboxIndex(idx); setIsLightboxOpen(true) }}
                    >
                        <Image
                            src={image}
                            alt={`${cafe.name} photo ${idx + 1}`}
                            fill
                            className='object-cover transition-transform duration-500 group-hover:scale-105'
                            sizes='(min-width: 768px) 50vw, 100vw'
                            priority={idx === 0}
                        />
                        <div className='absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors' />
                    </div>
                ))
            )}
        </div>
    </section>
)}
```

### 4e: Add Amenities + Extras card below gallery

After the gallery section (before the story section), insert a new combined Amenities & Extras card. This replaces what was removed from `CafeSidebar`.

The card uses the project's existing amenity rendering logic (copy from what was removed from `CafeSidebar`), displayed as two side-by-side sections inside a white-ish card:

```tsx
{/* Amenities & Extras — moved from sidebar */}
{(cafe.has_wifi || cafe.has_sockets || cafe.has_parking || cafe.has_aircon ||
  cafe.is_pet_friendly || cafe.has_outdoor_seating || cafe.has_indoor_seating ||
  cafe.has_restroom || cafe.has_bidet || cafe.has_non_dairy || cafe.has_decaf ||
  cafe.is_work_friendly || cafe.is_halal_certified || cafe.has_smoking ||
  cafe.serves_food || (cafe.brew_methods && cafe.brew_methods.length > 0) ||
  (cafe.specialty && cafe.specialty.length > 0) ||
  (cafe.tags && cafe.tags.length > 0)) && (
    <div className='grid grid-cols-2 gap-8 p-6 bg-text/5 border border-text/10 rounded-xl'>
        {/* Amenities column */}
        <section>
            <h3 className='text-xs font-bold uppercase tracking-widest text-text/40 mb-4'>
                Amenities
            </h3>
            <ul className='flex flex-row flex-wrap gap-2'>
                {cafe.has_wifi && <AmenityPill icon={<WifiIcon className='w-3.5 h-3.5'/>} label='WiFi' />}
                {cafe.has_sockets && <AmenityPill icon={<PlugIcon className='w-3.5 h-3.5'/>} label='Power Outlets' />}
                {cafe.has_parking && <AmenityPill icon={<CarIcon className='w-3.5 h-3.5'/>} label='Parking' />}
                {cafe.has_aircon && <AmenityPill icon={<SnowflakeIcon className='w-3.5 h-3.5'/>} label='Air Conditioning' />}
                {cafe.is_pet_friendly && <AmenityPill icon={<PawPrintIcon className='w-3.5 h-3.5'/>} label='Pet Friendly' />}
                {cafe.has_outdoor_seating && <AmenityPill icon={<SunIcon className='w-3.5 h-3.5'/>} label='Outdoor Seating' />}
                {cafe.has_indoor_seating && <AmenityPill icon={<Armchair className='w-3.5 h-3.5'/>} label='Indoor Seating' />}
                {cafe.has_restroom && <AmenityPill icon={<Toilet className='w-3.5 h-3.5'/>} label='Restroom' />}
                {cafe.has_bidet && <AmenityPill icon={<Droplet className='w-3.5 h-3.5'/>} label='Bidet' />}
                {cafe.has_non_dairy && <AmenityPill icon={<MilkOff className='w-3.5 h-3.5'/>} label='Non-Dairy Milk' />}
                {cafe.has_decaf && <AmenityPill icon={<Coffee className='w-3.5 h-3.5'/>} label='Decaf Options' />}
                {cafe.is_work_friendly && <AmenityPill icon={<BriefcaseIcon className='w-3.5 h-3.5'/>} label='Work Friendly' />}
                {cafe.is_halal_certified && <AmenityPill label='Halal Certified' />}
                {cafe.has_smoking && <AmenityPill icon={<Cigarette className='w-3.5 h-3.5'/>} label='Smoking Area' />}
            </ul>
        </section>

        {/* Extras / Vibe column */}
        <section>
            <h3 className='text-xs font-bold uppercase tracking-widest text-text/40 mb-4'>
                Vibe & Extras
            </h3>
            <ul className='flex flex-row flex-wrap gap-2'>
                {cafe.serves_food && <AmenityPill label='Serves Food' />}
                {cafe.brew_methods?.map((m) => (
                    <AmenityPill key={m} label={m.split('_').join(' ')} />
                ))}
                {cafe.specialty?.map((s) => (
                    <AmenityPill key={s} label={s.split('_').join(' ')} />
                ))}
                {cafe.tags?.map((t) => (
                    <AmenityPill key={t} label={t.split('_').join(' ')} />
                ))}
            </ul>
        </section>
    </div>
)}
```

**Define `AmenityPill` as a local helper component** (inside `CafeDetails.tsx`, above the `return`):
```tsx
const AmenityPill = ({ icon, label }: { icon?: React.ReactNode; label: string }) => (
    <li className='flex items-center gap-1.5 text-text bg-secondary/40 px-2 py-1 rounded-full text-xs font-semibold cursor-default'>
        {icon}
        {label}
    </li>
)
```

**Import the icon set** — add to the existing imports in `CafeDetails.tsx`:
```ts
import {
    WifiIcon,
    PlugIcon,
    CarIcon,
    SnowflakeIcon,
    PawPrintIcon,
    SunIcon,
    BriefcaseIcon,
    CoffeeIcon,
    Toilet,
    Droplet,
    MilkOff,
    Armchair,
    Cigarette,
    Coffee,
} from "lucide-react"
```

(These are the exact same imports removed from `CafeSidebar.tsx` in Task 3.)

### 4f: Remove `mt-6` from Story, Menu, Reviews sections
The parent `flex flex-col gap-8` handles spacing. Remove any `mt-6` from the story `<section>` and menu `<section>` and reviews `<section>` wrappers inside the desktop main column.

### Step: Verify full desktop layout
- 12-col grid: sidebar 3 cols left, main 9 cols right
- Mosaic gallery renders (1, 2, or 3+ photo variants)
- Amenities + Extras card appears below gallery as two-column grid
- Story, Menu, Reviews sections follow with consistent spacing
- Amenities no longer appear in sidebar

---

## Task 5: Cleanup & Lint

**Files:**
- `components/cafe/CafeDetails.tsx`
- `components/cafe/CafeSidebar.tsx`
- `components/cafe/CafeHero.tsx`

### Step 1: Remove unused imports from CafeDetails.tsx
After adding the new imports and removing scroll logic:
- Remove `ChevronLeft`, `ChevronRight` from lucide-react (was used for scroll buttons)
- Remove `useRef` from react if `scrollContainerRef` was the only ref

### Step 2: Verify CafeSidebar.tsx imports
After removing Amenities and Extras sections, confirm these are no longer used anywhere in `CafeSidebar.tsx` and remove them from the import block:
- `WifiIcon`, `PlugIcon`, `CarIcon`, `SnowflakeIcon`, `PawPrintIcon`, `SunIcon`, `BriefcaseIcon`, `CoffeeIcon`, `Toilet`, `Droplet`, `MilkOff`, `Armchair`, `Cigarette`, `Coffee`

Confirm these ARE still used and must stay:
- `StarIcon` — Ratings section heading
- `UserIcon` — "Scouted by" row, visitors section
- `CalendarIcon` — "Last updated" row
- `History` — View history button
- `MapPin` — Visitors Today row, location pending card
- `Globe` — social icon fallback (new)
- `Instagram`, `Facebook`, `Music2`, `Twitter`, `Youtube`, `ShoppingBag` — social icons (new)

### Step 3: Run lint
```bash
bun lint
```
Fix any ESLint errors (unused vars, missing keys, etc.).

### Step 4: Run build
```bash
bun build
```
Confirm no TypeScript errors or build failures.

---

## Summary of All Changes

| Component | Changes |
|---|---|
| `CafeHero.tsx` | Content bottom-anchored with gradient overlay; quick-glance pills inlined into city/province location row; old pills row removed |
| `CafeSidebar.tsx` | Socials get auto-detected brand icons (vertical list); Price Range visually emphasized; Amenities + Extras sections removed |
| `CafeDetails.tsx` | Desktop grid (12-col); mosaic gallery replaces horizontal scroll; scroll state/refs/functions removed; Amenities+Extras card added in main content below gallery; amenity icon imports added |
| `RatingDistribution.tsx` | Vertical bars → horizontal stacked rows (5→1, count always shown, tooltip removed) |

## What is NOT changed
- All mobile layout (`md:hidden`)
- All modals, hooks, state management
- Theme tokens (no hardcoded hex colors anywhere)
- `CafeTabs.tsx`, `CafeMobileContent.tsx`
- `CafeHero.tsx` action buttons, name, badges, description, claim button (only structure changes)
- `CafeSidebar.tsx` map, address, website, contact, details (price/coffee/payment/roaster), ratings, visitors, operating hours, last updated, scouted by, suggest edit, report
