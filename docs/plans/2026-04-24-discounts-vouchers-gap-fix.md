# Discounts & Vouchers — Gap Fix & Improvement Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all gaps in the existing discounts/vouchers implementation (missing integrations, unwired components, missing cron), add the edit campaign flow, improve UX, and ensure lint/build/tests pass cleanly.

**Architecture:** The discount system is already fully built at the data layer and server actions layer. This plan focuses on: (1) wiring existing but unintegrated components, (2) adding missing flows (edit campaign, cron), (3) UX improvements, and (4) cleanup.

**Tech Stack:** Next.js App Router, Drizzle ORM (PostgreSQL), Zod, Tailwind CSS v4, motion/react, qrcode.react, lucide-react, Better Auth

---

## Gap Analysis (from 2026-04-19 plan audit)

| # | Gap | Severity | Status |
|---|-----|----------|--------|
| 1 | `CafeDiscounts.tsx` exists but NOT integrated into cafe detail page | High | Missing integration |
| 2 | `CampaignQRCode.tsx` exists but NOT wired into `CampaignDetail.tsx` | High | Missing integration |
| 3 | Feature flag `getDiscountsEnabled()` defined but never called in UI | Low | Not wired |
| 4 | Cron endpoint — already exists at `app/api/cron/daily/expire-vouchers/logic.ts`, wired into daily cron | N/A | Already done |
| 5 | No edit campaign page/form (only create exists) | High | Missing flow |
| 6 | Campaign detail overview tab has no QR code section | Medium | Missing integration |
| 7 | Voucher card QR code uses voucher code string — should use structured data | Low | Improvement |
| 8 | `CafeDiscounts` does not show "Claim" button for logged-in users | Medium | Missing UX |
| 9 | Redemption logs tab shows placeholder text ("available in future update") | Medium | Incomplete |
| 10 | 6 ESLint warnings (unused vars) in discount files | Low | Cleanup |
| 11 | No link from voucher wallet to cafe page | Low | Missing UX |
| 12 | `DiscountDashboard` stats are computed from campaign data, not actual voucher counts | Medium | Inaccurate stats |

---

## File Structure

### Files to Create
| File | Responsibility |
|------|---------------|
| `app/owner/cafes/[slug]/discounts/[campaignId]/edit/page.tsx` | Edit campaign page route |
| `components/owner/EditCampaignForm.tsx` | Edit campaign form component |
| `components/owner/CampaignQRModal.tsx` | Modal to display campaign QR code for owners |

### Files to Modify
| File | Change |
|------|--------|
| `components/cafe/CafeDetails.tsx` | Add `CafeDiscounts` section in desktop and mobile layouts |
| `components/owner/CampaignDetail.tsx` | Add QR code button/section, wire `CampaignQRCode`, fix `_unusedCafeId` |
| `components/owner/DiscountDashboard.tsx` | Fix `_unusedCafeId`, improve stats accuracy |
| `components/owner/VoucherRedeemPanel.tsx` | Fix `_unusedCampaignId` |
| `app/api/actions/__tests__/discount-actions.test.ts` | Fix `_unused*` lint warnings |

---

## Task 1: Integrate CafeDiscounts into Cafe Detail Page

**Files:**
- Modify: `components/cafe/CafeDetails.tsx`

**Context:** `CafeDiscounts` component exists at `components/cafe/CafeDiscounts.tsx` but is never rendered. It needs to be added to the cafe detail page so users can see active discounts. The component accepts `{ cafeId: string; cafeSlug: string }` and auto-hides when there are no active campaigns.

- [ ] **Step 1: Add CafeDiscounts import to CafeDetails.tsx**

Add the import near the top of the file (after existing imports):

```tsx
import CafeDiscounts from "@/components/cafe/CafeDiscounts"
```

- [ ] **Step 2: Add CafeDiscounts to desktop layout**

In the desktop layout section (`<section className='hidden md:grid md:grid-cols-12'>`), insert the CafeDiscounts section between the Menu Section and Reviews Section. Find the `{/* Reviews Section */}` comment (around line 1100) and add before it:

```tsx
{/* Discounts Section */}
<section className='w-full'>
    <CafeDiscounts cafeId={cafe.id} cafeSlug={cafe.slug} />
</section>
```

- [ ] **Step 3: Add CafeDiscounts to mobile layout**

In the mobile layout, the content is rendered through `CafeTabs` with a `tabContent` prop. Add a `discounts` entry to the `tabContent` object:

```tsx
discounts: (
    <CafeDiscounts cafeId={cafe.id} cafeSlug={cafe.slug} />
),
```

Note: Check if `CafeTabs` supports dynamic tab addition or if the discounts should be rendered as a standalone section above/below the tabs instead. If CafeTabs has a fixed set of tabs, add CafeDiscounts as a standalone section above the tabs in the mobile layout.

- [ ] **Step 4: Verify no lint errors**

Run: `bun lint`
Expected: No new warnings related to this change.

- [ ] **Step 5: Commit**

```bash
git add components/cafe/CafeDetails.tsx
git commit -m "feat(discounts): integrate CafeDiscounts into cafe detail page"
```

---

## Task 2: Wire CampaignQRCode into Campaign Detail

**Files:**
- Modify: `components/owner/CampaignDetail.tsx`
- Create: `components/owner/CampaignQRModal.tsx`

**Context:** `CampaignQRCode` exists at `components/owner/CampaignQRCode.tsx` but is never used. The campaign detail page shows QR code status as text but has no way to display the actual QR code. Add a "QR Code" action button that opens a modal with the campaign QR code.

- [ ] **Step 1: Create CampaignQRModal.tsx**

Create a modal wrapper around the existing `CampaignQRCode` component:

```tsx
"use client"

import { motion, AnimatePresence } from "motion/react"
import { X } from "lucide-react"
import CampaignQRCode from "./CampaignQRCode"

interface CampaignQRModalProps {
  isOpen: boolean
  onClose: () => void
  campaignId: string
  campaignName: string
  baseUrl: string
}

export default function CampaignQRModal({
  isOpen,
  onClose,
  campaignId,
  campaignName,
  baseUrl,
}: CampaignQRModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-card rounded-xl border border-border p-6 w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Campaign QR Code</h2>
              <button
                onClick={onClose}
                className="p-1 hover:bg-text/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <CampaignQRCode
              campaignId={campaignId}
              campaignName={campaignName}
              baseUrl={baseUrl}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Add QR Code button to CampaignDetail.tsx action buttons**

Import the modal at the top of `CampaignDetail.tsx`:

```tsx
import CampaignQRModal from "./CampaignQRModal"
```

Add state for the QR modal (near the other state declarations around line 70):

```tsx
const [isQRModalOpen, setIsQRModalOpen] = useState(false)
```

Add a QR Code button in the action buttons area (after the "Generate Vouchers" button, around line 355), only shown when `campaign.qrCodeEnabled` is true:

```tsx
{campaign.qrCodeEnabled && (
  <button
    onClick={() => setIsQRModalOpen(true)}
    className="inline-flex items-center gap-1.5 px-3 py-2 bg-text/10 rounded-lg text-sm font-medium hover:bg-text/20 transition-colors"
  >
    <QrCode className="w-4 h-4" />
    QR Code
  </button>
)}
```

Add `QrCode` to the lucide-react import if not already there.

Add the modal render at the bottom of the component (before the closing `</motion.div>`):

```tsx
<CampaignQRModal
  isOpen={isQRModalOpen}
  onClose={() => setIsQRModalOpen(false)}
  campaignId={campaign.id}
  campaignName={campaign.name}
  baseUrl={typeof window !== "undefined" ? window.location.origin : ""}
/>
```

- [ ] **Step 3: Fix the `_unusedCafeId` lint warning**

Change the destructuring at line 62 from:

```tsx
cafeId: _unusedCafeId,
```

to:

```tsx
cafeId,
```

The `cafeId` prop is passed in but never used in the component. Either use it (e.g., pass to QR modal for constructing URLs) or remove it from the interface. The cleanest fix is to use it — pass `cafeId` to the `CampaignQRModal` if needed, or simply keep it available for future use. If it's truly unused, prefix with underscore: `cafeId: _cafeId`.

- [ ] **Step 4: Verify lint**

Run: `bun lint`
Expected: The `_unusedCafeId` warning in `CampaignDetail.tsx` is resolved.

- [ ] **Step 5: Commit**

```bash
git add components/owner/CampaignDetail.tsx components/owner/CampaignQRModal.tsx
git commit -m "feat(discounts): wire campaign QR code into campaign detail page"
```

---

## Task 3: ~~Create Expire Vouchers Cron Endpoint~~ ALREADY DONE

**Status:** This task is already implemented. The cron logic exists at `app/api/cron/daily/expire-vouchers/logic.ts` and is wired into the unified daily cron at `app/api/cron/daily/route.ts` (line 6, 68-76). No action needed.

---

## Task 4: Add Edit Campaign Page & Form

**Files:**
- Create: `app/owner/cafes/[slug]/discounts/[campaignId]/edit/page.tsx`
- Create: `components/owner/EditCampaignForm.tsx`

**Context:** The campaign detail page has an "Edit" button that currently shows a "coming soon" toast. The create form exists at `components/owner/CreateCampaignForm.tsx` (680 lines). The edit form should reuse the same field structure but pre-populate with existing campaign data and call `updateCampaign` instead of `createCampaign`.

- [ ] **Step 1: Create the edit page route**

Create `app/owner/cafes/[slug]/discounts/[campaignId]/edit/page.tsx`:

```tsx
import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { getCafeForOwnerManagement } from "@/app/api/actions/owner"
import { getCampaignById } from "@/app/api/actions/discount"
import EditCampaignForm from "@/components/owner/EditCampaignForm"

export const metadata: Metadata = {
  title: "Edit Campaign | Grounds",
  description: "Edit your discount campaign.",
}

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ slug: string; campaignId: string }>
}) {
  const { slug, campaignId } = await params
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth?redirect=/owner")
  }

  const cafe = await getCafeForOwnerManagement(slug)
  if (!cafe) {
    redirect("/owner")
  }

  const result = await getCampaignById(campaignId)
  if (!result.success || !result.data) {
    redirect(`/owner/cafes/${slug}/discounts`)
  }

  return (
    <main className="min-h-screen w-full bg-background pt-6 pb-12">
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <EditCampaignForm
          campaign={result.data.campaign}
          cafeId={cafe.id}
          cafeName={cafe.name}
          cafeSlug={slug}
        />
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Create EditCampaignForm.tsx**

Create `components/owner/EditCampaignForm.tsx`. This should follow the same structure as `CreateCampaignForm.tsx` but:
- Accept a `campaign: DiscountCampaign` prop
- Pre-populate the form with existing campaign data
- Call `updateCampaign(campaign.id, data)` instead of `createCampaign`
- Remove fields that shouldn't be editable after creation (like `discountType` — changing type after vouchers exist would be inconsistent)
- Show a "Back to Campaign" link instead of "Back to Discounts"

Key differences from create form:
- Initial form state comes from the existing campaign
- `discountType` field is displayed but disabled (read-only after creation)
- Submit calls `updateCampaign` server action
- Success redirects to `/owner/cafes/${cafeSlug}/discounts/${campaign.id}`

Use the existing `CreateCampaignForm.tsx` as the base template. Copy its structure and adapt.

- [ ] **Step 3: Wire the Edit button in CampaignDetail.tsx**

In `components/owner/CampaignDetail.tsx`, find the Edit button (around line 308-316) that currently shows a "coming soon" toast. Replace it with a Link to the edit page:

```tsx
{!isArchived && (
  <Link
    href={`/owner/cafes/${cafeSlug}/discounts/${campaign.id}/edit`}
    className="inline-flex items-center gap-1.5 px-3 py-2 bg-text/10 rounded-lg text-sm font-medium hover:bg-text/20 transition-colors"
  >
    <Edit className="w-4 h-4" />
    Edit
  </Link>
)}
```

Remove the `handleEdit` callback and the `editDisabled` variable if they exist.

- [ ] **Step 4: Verify lint**

Run: `bun lint`
Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add app/owner/cafes/[slug]/discounts/[campaignId]/edit/ components/owner/EditCampaignForm.tsx components/owner/CampaignDetail.tsx
git commit -m "feat(discounts): add edit campaign page and form"
```

---

## Task 5: Add Claim Button to CafeDiscounts & Link Wallet to Cafe

**Files:**
- Modify: `components/cafe/CafeDiscounts.tsx`
- Modify: `components/profile/VoucherCard.tsx`

**Context:** `CafeDiscounts` shows active campaigns but has no way for users to claim vouchers. Users should see a "Claim" button that triggers the claim flow. Additionally, voucher cards in the wallet should link to the cafe page.

- [ ] **Step 1: Add claim functionality to CafeDiscounts**

Add a "Claim" button to each campaign card in `CafeDiscounts.tsx`. When clicked, it should call `claimVoucherFromCampaign` with the campaign ID. The button should:
- Only show for logged-in users (check via a prop or session)
- Show loading state while claiming
- Show success/error feedback
- Reload the page on success

Import the server action:
```tsx
import { claimVoucherFromCampaign } from "@/app/api/actions/discount"
```

Add state for loading/success per campaign:
```tsx
const [claimingId, setClaimingId] = useState<string | null>(null)
const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set())
```

Add the claim button inside each campaign card (after the expiry date):
```tsx
<button
  onClick={async () => {
    setClaimingId(campaign.id)
    const result = await claimVoucherFromCampaign({ campaignId: campaign.id })
    if (result.success) {
      setClaimedIds((prev) => new Set(prev).add(campaign.id))
    }
    setClaimingId(null)
  }}
  disabled={claimingId === campaign.id || claimedIds.has(campaign.id)}
  className="mt-3 w-full py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
>
  {claimedIds.has(campaign.id)
    ? "Claimed!"
    : claimingId === campaign.id
      ? "Claiming..."
      : "Claim Voucher"}
</button>
```

Note: The component needs to know if the user is logged in. Pass an `isLoggedIn` prop from the parent, or wrap the button in an auth check.

- [ ] **Step 2: Add cafe link to VoucherCard.tsx**

In `components/profile/VoucherCard.tsx`, add a link to the cafe page. Find where the cafe name is displayed and wrap it with a Link:

```tsx
import Link from "next/link"

// In the component, where cafe name is shown:
<Link
  href={`/cafes/${voucher.campaign.cafeSlug}`}
  className="hover:text-primary transition-colors"
>
  {voucher.campaign.cafeName}
</Link>
```

- [ ] **Step 3: Verify lint**

Run: `bun lint`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add components/cafe/CafeDiscounts.tsx components/profile/VoucherCard.tsx
git commit -m "feat(discounts): add claim button to cafe discounts and cafe link to voucher cards"
```

---

## Task 6: Wire Redemption Logs Tab

**Files:**
- Modify: `components/owner/CampaignDetail.tsx`

**Context:** The "Redemption Logs" tab in `CampaignDetail.tsx` shows a placeholder message ("Redemption logs will be available in a future update"). The `getRedemptionLogs` server action already exists and works. Wire it up to display actual logs.

- [ ] **Step 1: Create a RedemptionLogsTable component inline or as a separate file**

In `CampaignDetail.tsx`, the logs tab (around lines 522-538) currently shows a placeholder. Replace it with a component that:
- Calls `getRedemptionLogs(campaign.id)` on mount
- Displays a table with columns: Code, User, Discount, Method, Date, Notes
- Shows pagination if more than 20 logs
- Shows empty state when no logs exist

Either create a new `components/owner/RedemptionLogsTable.tsx` file or implement inline. Follow the same pattern as `VoucherTable.tsx`.

```tsx
// Simple inline implementation in CampaignDetail.tsx logs tab:
const [logs, setLogs] = useState<any[]>([])
const [logsTotal, setLogsTotal] = useState(0)
const [logsPage, setLogsPage] = useState(1)
const [loadingLogs, setLoadingLogs] = useState(false)

const fetchLogs = useCallback(async (page: number) => {
  setLoadingLogs(true)
  const result = await getRedemptionLogs(campaign.id, page)
  if (result.success && result.data) {
    setLogs(result.data.logs)
    setLogsTotal(result.data.total)
  }
  setLoadingLogs(false)
}, [campaign.id])

// Fetch on tab switch to "logs"
useEffect(() => {
  if (activeTab === "logs") {
    fetchLogs(logsPage)
  }
}, [activeTab, logsPage, fetchLogs])
```

Display a table with the logs data, matching the project's existing table styling from `VoucherTable.tsx`.

- [ ] **Step 2: Import getRedemptionLogs**

Add the import at the top of `CampaignDetail.tsx`:

```tsx
import { updateCampaign, deleteCampaign, getRedemptionLogs } from "@/app/api/actions/discount"
```

- [ ] **Step 3: Verify lint**

Run: `bun lint`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add components/owner/CampaignDetail.tsx
git commit -m "feat(discounts): wire redemption logs tab with actual data"
```

---

## Task 7: Fix DiscountDashboard Stats Accuracy

**Files:**
- Modify: `components/owner/DiscountDashboard.tsx`

**Context:** The `DiscountDashboard` computes stats from campaign-level data (`currentRedemptions`, `maxRedemptions`) rather than actual voucher-level counts. This means stats can be inaccurate. The fix is to either:
1. Fetch actual voucher counts from the server (preferred), or
2. Clearly label the stats as campaign-level summaries

Option 1 is better. The `getCampaignsForCafe` action should return aggregate voucher stats alongside campaigns.

- [ ] **Step 1: Add aggregate stats to getCampaignsForCafe**

In `app/api/actions/discount.ts`, modify `getCampaignsForCafe` to also return aggregate voucher counts. After fetching campaigns, run a single aggregate query:

```ts
// After fetching campaigns, get aggregate stats
const campaignIds = filteredCampaigns.map(c => c.id)

if (campaignIds.length > 0) {
  const [statsResult] = await db
    .select({
      total: sql<number>`count(*)::int`,
      claimed: sql<number>`count(*) filter (where ${discountVouchers.status} = 'claimed')::int`,
      redeemed: sql<number>`count(*) filter (where ${discountVouchers.status} = 'redeemed')::int`,
      available: sql<number>`count(*) filter (where ${discountVouchers.status} = 'available')::int`,
    })
    .from(discountVouchers)
    .where(inArray(discountVouchers.campaignId, campaignIds))

  // Return stats alongside campaigns
  return {
    success: true,
    data: {
      campaigns: serialized,
      stats: {
        totalVouchers: statsResult?.total ?? 0,
        claimedVouchers: statsResult?.claimed ?? 0,
        redeemedVouchers: statsResult?.redeemed ?? 0,
        availableVouchers: statsResult?.available ?? 0,
        expiredVouchers: 0, // can add if needed
      }
    }
  }
}
```

- [ ] **Step 2: Update DiscountDashboard to use server-provided stats**

Modify `DiscountDashboard.tsx` to accept stats from the server instead of computing them client-side. Change the props interface:

```tsx
interface DiscountDashboardProps {
  cafeId: string
  cafeName: string
  cafeSlug: string
  campaigns: DiscountCampaign[]
  stats?: CampaignStats  // Optional, falls back to computed
}
```

Use `stats` prop if provided, otherwise fall back to the existing computed stats.

- [ ] **Step 3: Fix the `_unusedCafeId` lint warning**

The `cafeId` prop is destructured but prefixed with `_unused`. Either use it (pass to server action for fetching stats) or remove the `_unused` prefix if it's now used for the stats query. If still unused, change to `cafeId: _cafeId`.

- [ ] **Step 4: Verify lint**

Run: `bun lint`
Expected: The `_unusedCafeId` warning in `DiscountDashboard.tsx` is resolved.

- [ ] **Step 5: Commit**

```bash
git add components/owner/DiscountDashboard.tsx app/api/actions/discount.ts
git commit -m "fix(discounts): improve dashboard stats accuracy with server-side aggregation"
```

---

## Task 8: Fix All Lint Warnings in Discount Files

**Files:**
- Modify: `components/owner/VoucherRedeemPanel.tsx`
- Modify: `app/api/actions/__tests__/discount-actions.test.ts`

**Context:** There are 6 ESLint warnings related to unused variables in discount files. Fix them all.

- [ ] **Step 1: Fix VoucherRedeemPanel.tsx `_unusedCampaignId`**

In `components/owner/VoucherRedeemPanel.tsx` line 29, `campaignId` is destructured as `_unusedCampaignId`. Check if it's used anywhere. If not, either:
- Remove it from the props interface if truly unused
- Or rename to `_campaignId` (single underscore prefix is the project convention)

- [ ] **Step 2: Fix discount-actions.test.ts `_unused*` warnings**

In `app/api/actions/__tests__/discount-actions.test.ts`:
- Line 574: `_unusedGetUserVouchers` — this is likely a destructured import that's not used in a specific test. Either use it or remove the destructuring.
- Line 1460: `_unusedUser` — assigned but never used. Either assert on it or remove.
- Line 1513: `_unusedYesterday` — assigned but never used. Either use it in an assertion or remove.

For each, examine the test context and either:
- Add an assertion using the variable
- Remove the variable assignment
- Prefix with a single underscore if it's intentionally unused (though the linter still warns)

The cleanest fix is to remove truly unused variables.

- [ ] **Step 3: Run lint to verify all warnings resolved**

Run: `bun lint`
Expected: 0 warnings, 0 errors.

- [ ] **Step 4: Commit**

```bash
git add components/owner/VoucherRedeemPanel.tsx app/api/actions/__tests__/discount-actions.test.ts
git commit -m "fix(discounts): resolve all ESLint warnings in discount files"
```

---

## Task 9: Run Full Build, Lint, and Test Verification

**Files:**
- None (verification only)

**Context:** Final verification that everything compiles, lints, and tests pass.

- [ ] **Step 1: Run lint**

Run: `bun lint`
Expected: 0 errors, 0 warnings (after Task 8 fixes).

- [ ] **Step 2: Run Next.js build**

Run: `npx next build`
Expected: Build succeeds with no errors. All discount routes compile:
- `/owner/cafes/[slug]/discounts`
- `/owner/cafes/[slug]/discounts/create`
- `/owner/cafes/[slug]/discounts/[campaignId]`
- `/owner/cafes/[slug]/discounts/[campaignId]/edit`
- `/profile/vouchers`
- `/profile/vouchers/claim`
- `/api/discount/claim/[campaignId]`
- `/api/cron/daily` (includes expire-vouchers)

- [ ] **Step 3: Run all tests**

Run: `bun test`
Expected: All discount-related tests pass. Note: There may be pre-existing test failures in unrelated files (chat, cafe hero, etc.) — these are not caused by this plan.

- [ ] **Step 4: Run discount-specific tests**

Run: `bun test app/api/actions/__tests__/discount-actions.test.ts`
Expected: All 45 tests pass.

Run: `bun test utils/validation/__tests__/discount-validation.test.ts`
Expected: All validation tests pass.

- [ ] **Step 5: Verify no regressions**

Check that existing pages still work by verifying the build output includes all expected routes.

---

## Summary

| Task | Description | Type |
|------|-------------|------|
| 1 | Integrate CafeDiscounts into cafe detail page | Missing integration |
| 2 | Wire CampaignQRCode into campaign detail + QR modal | Missing integration |
| 3 | ~~Create expire vouchers cron endpoint~~ | Already done |
| 4 | Add edit campaign page and form | Missing flow |
| 5 | Add claim button to CafeDiscounts + cafe link in wallet | UX improvement |
| 6 | Wire redemption logs tab with actual data | Incomplete feature |
| 7 | Fix dashboard stats accuracy | Bug fix |
| 8 | Fix all ESLint warnings in discount files | Cleanup |
| 9 | Full build/lint/test verification | Verification |

Total: **8 active tasks** (Task 3 already done, estimated 2-3 hours of implementation work)
