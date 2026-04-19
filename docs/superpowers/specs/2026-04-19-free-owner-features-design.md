# Free Owner Features Design

**Goal:** Remove all subscription/payment infrastructure and make all cafe owner features universally free.

**Architecture:** Delete the entire subscription system (HelixPay, manual payments, pricing page, tier enums, subscription tables, cron enforcement). Strip tier-gating logic from server actions and UI. Remove premium visual distinctions. All owner features become unconditionally accessible.

**Tech Stack:** Next.js App Router, Drizzle ORM, PostgreSQL

---

## Database Changes

1. Drop `membership_tier` column from `cafes` table
2. Drop `cafe_subscriptions` table entirely
3. Drop `featured_slot_requests` table entirely (was premium-only)
4. Drop `membership_tier_enum` from `enums.ts`
5. Drop `subscription_status_enum` from `enums.ts`
6. Keep `owner_verification_requests` and `owner_review_responses` (unrelated to tiers)

## Files to Delete

- `/utils/helix.ts` — HelixPay client
- `/app/api/actions/subscription.ts` — All subscription server actions
- `/app/api/webhooks/helix/route.ts` — Webhook handler
- `/app/owner/subscriptions/page.tsx` — Pricing/subscription page
- `/components/manage/SubscriptionsTable.tsx` — Admin payment review table

## Files to Modify

### Type System
- `/utils/types/owner.ts` — Remove `SUBSCRIPTION_TIERS`, `canAccessFeature()`, `BETA_FREE_FEATURES`, `CafeSubscription`, `TierFeature`, `toDisplayTier()`, `toDbTier()`, tier helpers. Keep owner-only types.

### Database Schema
- `/db/schema/enums.ts` — Remove `membershipTierEnum`, `subscriptionStatusEnum`
- `/db/schema/tables.ts` — Remove `cafeSubscriptions`, `featuredSlotRequests` tables, `membershipTier` column from `cafes`, `isVerified` dependency on tier

### Server Actions
- `/app/api/actions/owner.ts` — Remove tier checks (menu limits, review pinning, featured slots), remove `getCafeSubscription()`, strip tier references from `getOwnedCafes()`
- `/app/api/actions/blog.ts` — Remove `tier !== "free"` check blocking blog posts
- `/app/api/actions/cafe.ts` — Remove `membershipTier` from sorting/ordering
- `/app/api/actions/admin.ts` — Remove manual payment verification/rejection actions, remove `getManualPaymentSubscriptions()`

### Cron
- `/app/api/cron/daily/check-subscriptions/logic.ts` — Remove subscription expiry enforcement (keep supporter expiry if applicable)

### Notifications
- `/utils/email.ts` — Remove `sendSubscriptionApprovedEmail()`, `sendSubscriptionRejectedEmail()`
- `/app/api/actions/notify.ts` — Remove `notifyDiscordSubscription()`

### UI Components
- `/components/owner/CafeManagement.tsx` — Remove subscription status card, upgrade buttons, tab locking, beta notice, menu item limits, QR code gating
- `/components/owner/OwnerDashboard.tsx` — Remove upgrade CTA, beta notice
- `/components/map/CafeMap.tsx` — Remove premium golden pin logic
- `/components/cafe/CafeCard.tsx` — Remove premium golden border styling
- Admin dashboard — Remove payment/subscription management sections

### AI/Query
- `/utils/ai/tools/cafe-query.ts` — Remove membership tier filter
- `/utils/ai/tools/cafe-query-runner.ts` — Remove tier sorting

## Navigation Changes
- Remove `/owner/subscriptions` route (redirect to `/owner`)
- Remove subscription-related nav links

## Key Decisions
- No special handling for existing paid subscribers
- No visual tier distinctions (golden pins/borders removed)
- Feature access is unconditional — no gates, no limits