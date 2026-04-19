# Free Owner Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove all subscription/payment infrastructure and make all cafe owner features universally free.

**Architecture:** Delete HelixPay integration, subscription actions, pricing page, and webhook handler. Strip tier-gating from server actions and UI. Drop membership_tier column, cafe_subscriptions table, featured_slot_requests table, and tier enums from DB schema. Remove premium visual styling. All owner features become unconditionally accessible.

**Tech Stack:** Next.js App Router, Drizzle ORM, PostgreSQL, TypeScript

---

## Phase 1: Delete Files & Clean Up Schema/Types

### Task 1: Delete subscription-related files

**Files:**
- Delete: `utils/helix.ts`
- Delete: `app/api/actions/subscription.ts`
- Delete: `app/api/webhooks/helix/route.ts` (and directory if empty)
- Delete: `app/owner/subscriptions/page.tsx` (and directory if empty)
- Delete: `components/manage/SubscriptionsTable.tsx`
- Delete: `emails/SubscriptionApprovedEmail.tsx`
- Delete: `emails/SubscriptionRejectedEmail.tsx`

**Step 1: Delete the files**

```bash
rm utils/helix.ts
rm app/api/actions/subscription.ts
rm -rf app/api/webhooks/helix/
rm -rf app/owner/subscriptions/
rm components/manage/SubscriptionsTable.tsx
# Only delete email templates if they exist
rm -f emails/SubscriptionApprovedEmail.tsx
rm -f emails/SubscriptionRejectedEmail.tsx
```

**Step 2: Verify deletions**

Run: `ls utils/helix.ts app/api/actions/subscription.ts app/api/webhooks/helix/ app/owner/subscriptions/ 2>&1`
Expected: "No such file or directory" for each

---

### Task 2: Remove membership tier and subscription enums from DB schema

**Files:**
- Modify: `db/schema/enums.ts`

**Step 1: Remove the two enums**

Remove lines 34-38 (`membershipTierEnum`) and lines 40-45 (`subscriptionStatusEnum`) from `db/schema/enums.ts`.

The file should no longer contain these enums. Keep all other enums (badgeCategoryEnum, blogCategoryEnum, etc.).

**Step 2: Verify the file compiles**

Run: `bun run db:generate`
Expected: Migration file generated successfully (may show warnings about removed tables/columns)

---

### Task 3: Remove subscription tables and membership_tier column from DB tables

**Files:**
- Modify: `db/schema/tables.ts`

**Step 1: Remove membershipTier from cafes table**

Remove this line from the `cafes` table definition:
```typescript
membershipTier: enums.membershipTierEnum("membership_tier").default("free"),
```

**Step 2: Remove the entire cafeSubscriptions table**

Remove the `cafeSubscriptions` export and table definition (lines ~214-230):
```typescript
export const cafeSubscriptions = pgTable("cafe_subscriptions", { ... })
```

**Step 3: Remove the entire featuredSlotRequests table**

Remove the `featuredSlotRequests` export and table definition (lines ~464-473):
```typescript
export const featuredSlotRequests = pgTable("featured_slot_requests", { ... })
```

**Step 4: Verify**

Run: `bun run db:generate`
Expected: Migration generated successfully

---

### Task 4: Rewrite owner types — remove all subscription/tier code

**Files:**
- Modify: `utils/types/owner.ts`

**Step 1: Remove subscription-related types and functions**

Remove the following from `utils/types/owner.ts`:
- Lines 3-5: Comment "Subscription Types" and `SubscriptionStatus` type
- Lines 7: `SubscriptionStatus` type alias
- Lines 11-12: `SubscriptionTier` type
- Lines 14-24: `toDisplayTier()` and `toDbTier()` functions
- Lines 26-74: `SUBSCRIPTION_TIERS` constant
- Lines 76-95: `TierFeature` type and "Tier Feature Types & Helpers" section
- Lines 97-124: `BETA_FREE_FEATURES` array and `getBetaNoticeText()` function
- Lines 126-176: `canAccessFeature()`, `getRequiredTier()`, `getTierFeatures()`, `wouldUnlockFeature()`, `getRequiredTierName()` functions
- Lines 179-197: `CafeSubscription` interface
- Lines 326-330: `subscription` field from `OwnedCafe` interface
- Lines 388-390: `SubscriptionCheckoutResult` interface

**Step 2: Clean up the OwnedCafe interface**

The `OwnedCafe` interface should no longer have a `subscription` field. After removal it should look like:

```typescript
export interface OwnedCafe {
    id: string
    name: string
    slug: string
    thumbnail: string
    city_municipality: string
    region: string
    is_verified: boolean | null
    is_published: boolean | null
    average_rating: number | null
    total_reviews: number | null
    pending_reviews: number
}
```

**Step 3: Remove Database import**

Remove the `import { Database } from './database.types'` line at the top (it was used for the tier enums).

**Step 4: Verify**

Run: `bun run typecheck 2>&1 | head -30`
Expected: Type errors referencing removed types (these will be fixed in subsequent tasks)

---

## Phase 2: Modify Server Actions

### Task 5: Clean up owner.ts — remove subscription logic

**Files:**
- Modify: `app/api/actions/owner.ts`

**Step 1: Remove subscription-related imports**

Remove from the import block:
- `cafeSubscriptions` from schema imports
- `featuredSlotRequests` from schema imports
- `CafeSubscription`, `toDisplayTier`, `SUBSCRIPTION_TIERS` from owner type imports

**Step 2: Remove subscription data from getOwnedCafes()**

In the `getOwnedCafes()` function (around lines 88-178):
- Remove the subscription query (lines 123-129)
- Remove `subscriptionMap` usage
- Remove the `subscription` field from the return object (lines 165-175)
- The return should no longer include `subscription`

**Step 3: Remove getCafeSubscription() entirely**

Delete the `getCafeSubscription()` function (around lines 275-312).

**Step 4: Remove membershipTier from getCafeForOwnerManagement()**

Find the line that maps `membership_tier: cafe.membershipTier` and remove it.

**Step 5: Remove tier check from pinReview()**

In the `pinReview()` function (around lines 797-855):
- Remove the tier check query (lines 812-822 that check `cafeSubscriptions.tier`)
- Keep the ownership check and max 3 pinned limit
- The function should only check ownership and pin count

**Step 6: Remove tier check from addMenuItem()**

In the `addMenuItem()` function (around lines 936-983):
- Remove the entire tier limit check block (lines 962-983)
- Keep the admin bypass and ownership check
- Remove `getCafeSubscription` and `SUBSCRIPTION_TIERS` usage

**Step 7: Remove requestFeaturedSlot() and getFeaturedSlotRequests()**

Delete the `requestFeaturedSlot()` function (around lines 1296-1360) and `getFeaturedSlotRequests()` function entirely. These were premium-only features.

**Step 8: Verify**

Run: `bun run typecheck 2>&1 | head -30`

---

### Task 6: Clean up blog.ts — remove tier check

**Files:**
- Modify: `app/api/actions/blog.ts`

**Step 1: Remove cafeSubscriptions import**

Remove `cafeSubscriptions` from the schema imports.

**Step 2: Remove the tier check block**

In the `createBlogPost()` function, remove lines 602-613 (the tier check that blocks free-tier owners):
```typescript
// Tier check for cafe owners (requires cafe_id)
if (!isAdminMod && input.cafe_id) {
    const subResult = await db
        .select({ tier: cafeSubscriptions.tier })
        .from(cafeSubscriptions)
        .where(eq(cafeSubscriptions.cafeId, input.cafe_id))
        .limit(1)
    const tier = subResult[0]?.tier || "free"
    if (tier === "free") {
        return { success: false, error: "Blog posting requires a Pro subscription or higher..." }
    }
}
```

Also remove the now-unused `eq` import if it was only used for this query (check first).

**Step 3: Verify**

Run: `bun run typecheck 2>&1 | head -30`

---

### Task 7: Clean up events.ts — remove tier check

**Files:**
- Modify: `app/api/actions/events.ts`

**Step 1: Remove cafeSubscriptions import**

Remove `cafeSubscriptions` from the schema imports.

**Step 2: Remove the tier check block**

In the `createEvent()` function, remove lines 452-468 (the premium tier check):
```typescript
// Cafe owners need Premium tier
if (!isAdmin && input.cafe_id) {
    ...
    const subResult = await db.select({ tier: cafeSubscriptions.tier })
        .from(cafeSubscriptions)
        ...
    if (tier !== "premium") {
        return { success: false, error: "Event creation is an exclusive Feature for Premium subscribers..." }
    }
}
```

Keep the owner permission check (`isCafeOwner`), just remove the tier restriction.

**Step 3: Verify**

Run: `bun run typecheck 2>&1 | head -30`

---

### Task 8: Clean up admin.ts — remove subscription management

**Files:**
- Modify: `app/api/actions/admin.ts`

**Step 1: Remove subscription-related imports**

Remove:
- `cafeSubscriptions` from schema imports
- `sendSubscriptionApprovedEmail`, `sendSubscriptionRejectedEmail` from email imports
- Any helix-related imports

**Step 2: Remove getManualSubscriptions() function**

Delete the entire `getManualSubscriptions()` function.

**Step 3: Remove verifyManualPayment() function**

Delete the entire `verifyManualPayment()` function.

**Step 4: Remove rejectManualPayment() function**

Delete the entire `rejectManualPayment()` function.

**Step 5: Remove deleteSubscriptionProof() function**

Delete the entire `deleteSubscriptionProof()` function.

**Step 6: Remove subscription creation in approveVerification()**

In the `approveVerification()` function, find any lines that create a `cafeSubscriptions` record and remove them. Also remove any lines that set `membershipTier` or `isVerified` based on subscription.

**Step 7: Remove getAdminCafes() membership_tier mapping**

Find `membership_tier: cafe.membershipTier` in `getAdminCafes()` and remove it.

**Step 8: Remove featured slot admin functions**

Remove `adminGetFeaturedRequests()` and `adminUpdateFeaturedRequestStatus()` functions and their `featuredSlotRequests` import.

**Step 9: Verify**

Run: `bun run typecheck 2>&1 | head -30`

---

### Task 9: Clean up cafe.ts — remove membership_tier

**Files:**
- Modify: `app/api/actions/cafe.ts`

**Step 1: Remove membershipTier from select clauses**

Search for all occurrences of `membershipTier` in cafe.ts and remove them from:
- `select()` clauses (remove the field)
- Object mappings (remove `membership_tier: cafe.membershipTier` or similar)
- `orderBy` clauses that sort by `desc(cafes.membershipTier)` — replace with a neutral sort or remove entirely

**Step 2: Verify**

Run: `bun run typecheck 2>&1 | head -30`

---

### Task 10: Clean up map.ts — remove membership_tier

**Files:**
- Modify: `app/api/actions/map.ts`

**Step 1: Remove membershipTier from select and mapping**

Remove `membershipTier` from the `select()` clause and remove `membership_tier: r.membershipTier` from the mapping.

**Step 2: Verify**

Run: `bun run typecheck 2>&1 | head -30`

---

## Phase 3: Modify UI Components

### Task 11: Rewrite CafeManagement.tsx — remove all subscription gating

**Files:**
- Modify: `components/owner/CafeManagement.tsx`

This is the largest UI change. The component needs:
- Remove `subscription` prop from interface
- Remove `CafeSubscription`, `SUBSCRIPTION_TIERS`, `canAccessFeature`, `BETA_FREE_FEATURES`, `getBetaNoticeText`, `SubscriptionTier` imports
- Remove `tierColors` constant
- Remove all `tier`/`tierConfig` derivation from subscription
- Remove `canAccessFeature()` calls — make all tabs accessible
- Remove menu item limit checks (`tierConfig.menuLimit`)
- Remove premium-only conditional rendering
- Remove subscription status card
- Remove upgrade link
- Remove beta notice
- Remove QR code gating
- All features are now always accessible

**Step 1: Update imports**

Replace the subscription imports:
```typescript
// REMOVE these imports:
CafeSubscription, SUBSCRIPTION_TIERS, canAccessFeature, BETA_FREE_FEATURES, getBetaNoticeText, SubscriptionTier

// KEEP these imports:
CafeMenuItem, MenuItemForm, OwnerReviewResponse
```

**Step 2: Remove subscription prop**

Change interface from:
```typescript
interface CafeManagementProps {
    cafe: CafeWithRatings
    subscription: CafeSubscription | null
    ...
}
```
to:
```typescript
interface CafeManagementProps {
    cafe: CafeWithRatings
    ...
}
```

**Step 3: Remove tier-related constants and state**

Remove:
- `tierColors` constant
- `const tier = subscription?.tier || "free"`
- `const tierConfig = SUBSCRIPTION_TIERS[tier]`
- `const colors = tierColors[tier]`

**Step 4: Remove tab locking**

In the tab definitions, remove all `locked` and `requiredTier` properties:
```typescript
// BEFORE:
{ id: "menu", label: "Menu", icon: UtensilsCrossed, locked: !canAccessFeature(tier, "menu") }
// AFTER:
{ id: "menu", label: "Menu", icon: UtensilsCrossed }
```

Apply to all tabs: menu, analytics, blog, events, inventory.

**Step 5: Remove tier badge rendering**

Remove all tier badge rendering code (the `<span>` with tier colors and Crown/Verified icons).

**Step 6: Remove subscription status card**

Remove the entire subscription status card section that shows current plan, price, features, and upgrade link.

**Step 7: Remove beta notice**

Remove the `{BETA_FREE_FEATURES.length > 0 && (...)}` block that shows the beta notice.

**Step 8: Remove menu item limit enforcement**

In the menu section:
- Remove `tierConfig.menuLimit` references
- Replace `menuItems.length >= tierConfig.menuLimit` checks with simple `false` (no limit)
- Remove the "X / Y items" limit display or change it to just show item count
- Remove "Upgrade to add more items" messaging

**Step 9: Remove premium-only feature conditions**

For the following, remove `tier === "premium"` conditions:
- Review pinning (make available to all owners)
- Featured slots (remove the request UI entirely since the table is being deleted)
- Event creation (make available to all owners)

**Step 10: Remove QR code gating**

Remove `canAccessFeature(tier, "qr_menu")` condition. QR code is always accessible.

**Step 11: Remove featured slot request function imports**

Remove `requestFeaturedSlot` and `getFeaturedSlotRequests` from the owner action imports since those functions are being deleted.

**Step 12: Verify**

Run: `bun run typecheck 2>&1 | head -30`

---

### Task 12: Rewrite OwnerDashboard.tsx — remove tier display

**Files:**
- Modify: `components/owner/OwnerDashboard.tsx`

**Step 1: Remove subscription-related imports**

Remove from imports:
- `SUBSCRIPTION_TIERS`, `SubscriptionTier`, `BETA_FREE_FEATURES`, `getBetaNoticeText`

Keep: `OwnedCafe`

**Step 2: Remove tier badge code**

Remove:
- `tierColors` constant
- `getTierBadge()` function
- Crown and Verified icon imports (if only used for tier badges)

**Step 3: Remove tier display from cafe cards**

Find where `cafe.subscription?.tier` is used to display a tier badge and remove it.

**Step 4: Remove beta notice**

Remove the `{BETA_FREE_FEATURES.length > 0 && (...)}` block.

**Step 5: Remove upgrade CTA**

Remove the entire "Upgrade Your Cafes" section that links to `/owner/subscriptions` (lines 376-406).

**Step 6: Verify**

Run: `bun run typecheck 2>&1 | head -30`

---

### Task 13: Update CafeManagement page — remove subscription prop

**Files:**
- Modify: `app/owner/cafes/[slug]/page.tsx`

**Step 1: Remove getCafeSubscription import**

Remove `getCafeSubscription` from the import.

**Step 2: Remove subscription from data fetching**

Change from:
```typescript
const [subscription, reviews, menuItems] = await Promise.all([
    getCafeSubscription(cafeId),
    getCafeReviewsForOwner(cafeId),
    getCafeMenuItems(cafeId),
])
```
to:
```typescript
const [reviews, menuItems] = await Promise.all([
    getCafeReviewsForOwner(cafeId),
    getCafeMenuItems(cafeId),
])
```

**Step 3: Remove subscription prop from CafeManagement**

Change from:
```tsx
<CafeManagement
    cafe={cafe}
    subscription={subscription}
    reviews={reviews}
    menuItems={menuItems}
/>
```
to:
```tsx
<CafeManagement
    cafe={cafe}
    reviews={reviews}
    menuItems={menuItems}
/>
```

**Step 4: Verify**

Run: `bun run typecheck 2>&1 | head -30`

---

### Task 14: Remove premium marker/styling from CafeMap and CafeCard

**Files:**
- Modify: `components/map/CafeMap.tsx`
- Modify: `components/cafe/CafeCard.tsx`

**Step 1: CafeMap.tsx — Remove premium icon logic**

Find the `cafe.membership_tier === "premium" ? premiumIcon : regularIcon` ternary (line ~167) and change it to always use `regularIcon`.

Remove the `premiumIcon` variable/constant if it's only used here.

Remove `membership_tier` from the cafe data type/interface if defined locally.

**Step 2: CafeCard.tsx — Remove premium styling**

Find the `cafe.membership_tier === "premium"` conditional class (line ~62) and remove the premium shadow/border styling. Keep the base shadow class.

Remove `membership_tier` from the cafe data type/interface if defined locally.

**Step 3: Verify**

Run: `bun run typecheck 2>&1 | head -30`

---

### Task 15: Clean up admin components — remove subscription management

**Files:**
- Modify: `components/manage/CafesManagement.tsx`
- Modify: `app/manage/cafes/page.tsx`

**Step 1: CafesManagement.tsx**

Remove:
- `getManualSubscriptions` import
- The subscriptions tab/section that calls `getManualSubscriptions()`
- Any `SubscriptionsTable` import

**Step 2: app/manage/cafes/page.tsx**

Remove:
- `getManualSubscriptions` import
- The call to `getManualSubscriptions()` in data fetching
- Any subscription-related props passed to components

**Step 3: Verify**

Run: `bun run typecheck 2>&1 | head -30`

---

## Phase 4: Modify Other Files (Cron, Email, Notify, AI, Map)

### Task 16: Rewrite check-subscriptions cron — keep supporter logic, remove cafe sub logic

**Files:**
- Modify: `app/api/cron/daily/check-subscriptions/logic.ts`

**Step 1: Remove cafe subscription imports**

Remove `cafeSubscriptions` from the import. Keep `cafes`, `profiles`, `badgeDefinitions`, `userBadges`.

**Step 2: Update the result type**

Change the result type to remove `cafeSubscriptions`:
```typescript
export interface CheckSubscriptionsResult {
    success: boolean
    supporters: {
        expired: number
        total: number
    }
    errors?: string[]
}
```

**Step 3: Remove the cafe subscription processing block**

Delete the entire block that:
- Queries `cafeSubscriptions` for expired subscriptions
- Updates `cafeSubscriptions` status to "cancelled"
- Downgrades `cafes.membershipTier` to "free" and sets `isVerified: false`

Keep the supporter expiry logic (lines 80-142).

**Step 4: Update the return statement**

Update the return object to not include `cafeSubscriptions`:
```typescript
return {
    success: true,
    supporters: {
        expired: expiredSupportersCount,
        total: expiredSupporters?.length ?? 0,
    },
    errors: errors.length > 0 ? errors : undefined,
}
```

**Step 5: Verify**

Run: `bun run typecheck 2>&1 | head -30`

---

### Task 17: Clean up email.ts — remove subscription emails

**Files:**
- Modify: `utils/email.ts`

**Step 1: Remove subscription email imports**

Remove `SubscriptionApprovedEmail` and `SubscriptionRejectedEmail` component imports.

**Step 2: Remove sendSubscriptionApprovedEmail()**

Delete the entire `sendSubscriptionApprovedEmail()` function.

**Step 3: Remove sendSubscriptionRejectedEmail()**

Delete the entire `sendSubscriptionRejectedEmail()` function.

**Step 4: Verify**

Run: `bun run typecheck 2>&1 | head -30`

---

### Task 18: Clean up notify.ts — remove Discord subscription notification

**Files:**
- Modify: `app/api/actions/notify.ts`

**Step 1: Remove notifyDiscordSubscription()**

Delete the entire `notifyDiscordSubscription()` function.

**Step 2: Verify**

Run: `bun run typecheck 2>&1 | head -30`

---

### Task 19: Clean up AI query tools — remove membership_tier

**Files:**
- Modify: `utils/ai/tools/cafe-query.ts`
- Modify: `utils/ai/tools/cafe-query-runner.ts`
- Modify: `utils/ai/tools/cafe-insights.ts`

**Step 1: cafe-query.ts**

Remove the `membershipTier` parameter from the zod schema:
```typescript
membershipTier: z.enum(["free", "basic", "premium"]).optional()
```

**Step 2: cafe-query-runner.ts**

Remove `membershipTier` from:
- `desc(cafes.membershipTier)` sort orders — replace with another relevant sort (e.g., `desc(cafes.isVerified)` or just `desc(cafes.createdAt)`)
- `conditions.push(eq(cafes.membershipTier, params.membershipTier))` filter
- Any type references to `membershipTier`

**Step 3: cafe-insights.ts**

Remove `membershipTier: cafes.membershipTier` from all `select()` clauses.
Remove `membershipTier: string | null` from type definitions.
Remove `membership_mer: c.membershipTier` from object mappings.

**Step 4: Verify**

Run: `bun run typecheck 2>&1 | head -30`

---

## Phase 5: DB Migration, Type Regeneration, and Test Updates

### Task 20: Generate and review DB migration

**Step 1: Generate the migration**

```bash
bun run db:generate
```

**Step 2: Review the generated migration**

Check that the migration includes:
- DROP TABLE `cafe_subscriptions`
- DROP TABLE `featured_slot_requests`
- ALTER TABLE `cafes` DROP COLUMN `membership_tier`
- DROP TYPE `membership_tier`
- DROP TYPE `subscription_status`

**Step 3: Push the migration (dev)**

```bash
bun run db:push
```

---

### Task 21: Regenerate database types

**Step 1: Regenerate types**

```bash
# However types are generated in this project - check package.json for the command
bun run db:generate  # or the type generation command
```

**Step 2: Check database.types.ts**

Verify that `utils/types/database.types.ts` no longer contains:
- `membership_tier` references in cafes table types
- `cafe_subscriptions` table types
- `membership_tier_enum` type
- `subscription_status_enum` type

If the file is auto-generated, regenerate it. If not, manually remove these references.

---

### Task 22: Update test files — remove membership_tier mocks

**Files:**
- Modify: `components/cafe/__tests__/cafe-hero-owner-claim.test.tsx`
- Modify: `utils/ai/__tests__/cafe-query-tool.test.ts`
- Modify: `utils/ai/__tests__/cafe-insights.test.ts`
- Modify: `utils/map/__tests__/client-filter.test.ts`

**Step 1: Remove membership_tier from mock data**

In each test file, find and remove `membership_tier` properties from mock/test data objects. This includes:
- `membership_tier: null` or `membership_tier: "premium"` etc.
- Any assertions comparing `membership_tier`

**Step 2: Verify tests pass**

```bash
bun test
```

---

## Phase 6: Fix All Lint and Build Errors

### Task 23: Fix all TypeScript compilation errors

**Step 1: Run typecheck**

```bash
bun run typecheck 2>&1
```

**Step 2: Fix each error**

Go through every TypeScript error and fix it. Common patterns:
- Remove imports of deleted types/functions
- Remove props that reference deleted types
- Update function signatures that no longer return subscription data
- Fix any `membership_tier` references that remain

**Step 3: Re-run typecheck until clean**

```bash
bun run typecheck 2>&1
```

Expected: 0 errors

---

### Task 24: Fix all ESLint errors

**Step 1: Run lint**

```bash
bun lint 2>&1
```

**Step 2: Fix each error/warning**

Common lint issues after this change:
- Unused imports (delete removed imports that are no longer referenced)
- Unused variables (tier, tierConfig, etc.)
- Missing props (if components expected subscription prop)

**Step 3: Re-run lint until clean**

```bash
bun lint 2>&1
```

Expected: 0 errors, 0 warnings

---

### Task 25: Fix all build errors

**Step 1: Run production build**

```bash
bun run build 2>&1
```

**Step 2: Fix each build error**

Building will catch:
- Unused exports
- Missing module references
- Server/client boundary issues
- Any remaining references to deleted files

**Step 3: Re-run build until clean**

```bash
bun run build 2>&1
```

Expected: Successful build with no errors

---

### Task 26: Run all tests

**Step 1: Run test suite**

```bash
bun test 2>&1
```

**Step 2: Fix failing tests**

Any test that references:
- `membership_tier`
- `cafeSubscriptions`
- `SUBSCRIPTION_TIERS`
- `canAccessFeature`
- `CafeSubscription`
- `getCafeSubscription`

Needs to be updated to remove those references.

**Step 3: Re-run tests until all pass**

```bash
bun test 2>&1
```

Expected: All tests pass

---

### Task 27: Final verification — full build + lint + tests

**Step 1: Run the complete verification suite**

```bash
bun run typecheck && bun lint && bun run build && bun test
```

Expected: All commands succeed with no errors.

**Step 2: Commit all changes**

```bash
git add -A
git commit -m "feat: remove subscription tiers and make all owner features free

- Remove HelixPay payment integration (utils/helix.ts)
- Remove subscription server actions (subscription.ts)
- Remove webhook handler (webhooks/helix/)
- Remove pricing page (owner/subscriptions/)
- Remove subscription admin table (SubscriptionsTable.tsx)
- Remove subscription email templates
- Drop membership_tier from cafes table
- Drop cafe_subscriptions table
- Drop featured_slot_requests table
- Drop membership_tier_enum and subscription_status_enum
- Remove all tier-gating from server actions (blog, events, owner)
- Remove menu item limits for owners
- Remove review pinning premium restriction
- Remove featured slot request premium restriction
- Remove premium map pin styling
- Remove premium card border styling
- Remove subscription status display from CafeManagement
- Remove upgrade CTAs from OwnerDashboard
- Update cron job to only handle supporter expiry
- Update AI tools to remove membership_tier filtering
- All owner features are now free"
```