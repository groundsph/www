# System Logging Audit & Cafe Edit Banner Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Comprehensive audit logging for all 19 unlogged admin/mod actions + dismissible edit banner on cafe detail pages for authorized users.

**Architecture:** Add `logSystemAction` calls to every mutating admin function currently missing them. Add a server-side permission check on the cafe detail page that passes edit capability to a new dismissible banner component.

**Tech Stack:** Next.js App Router, Drizzle ORM, Better Auth, TypeScript, Tailwind CSS v4, motion/react

---

## Part 1: System Logging - Cafe Operations (Task 1-5)

### Task 1: Log `updateCafe` to systemLogs

**Problem:** `updateCafe()` only logs to `contributionLogs` (a separate contribution tracking system), NOT to `systemLogs`. This is the specific issue reported.

**Files:**
- Modify: `app/api/actions/admin.ts:951-960`

**Step 1: Add logSystemAction import verification**

Confirm `logSystemAction` is already imported at the top of `admin.ts` (it is, used by other functions).

**Step 2: Add system log after contribution log**

After the existing `logContribution` call at line 955, add:

```typescript
    // Log to system logs
    await logSystemAction(
        "update",
        "cafe",
        cafeId,
        currentCafe ? { name: currentCafe.name, region: currentCafe.region } : null,
        updates,
        {
            source: "admin_edit",
            cafe_name: updates.name || currentCafe?.name,
            changed_fields: changedFields,
        }
    )
```

**Step 3: Verify**

Run: `bun lint`
Expected: No errors

---

### Task 2: Log `deleteCafe` to systemLogs

**Problem:** `deleteCafe()` performs a destructive delete with no audit trail.

**Files:**
- Modify: `app/api/actions/admin.ts:755-761` (before the return statement)

**Step 1: Add system log before the return**

Insert before `return { success: true }` at line 761:

```typescript
    // Log the cafe deletion
    await logSystemAction(
        "delete",
        "cafe",
        cafeId,
        { name: cafe.name, isPublished: wasPublished, region: cafe.region },
        null,
        { reason: "Cafe permanently deleted by admin", cafeName: cafe.name, contributorId }
    )
```

**Step 2: Verify**

Run: `bun lint`
Expected: No errors

---

### Task 3: Log `unpublishCafe` to systemLogs

**Problem:** `unpublishCafe()` changes cafe visibility with no audit trail.

**Files:**
- Modify: `app/api/actions/admin.ts:1655-1659` (before the return statement)

**Step 1: Add system log**

Insert before `return { success: true }` at line 1659:

```typescript
    // Log the cafe unpublish
    await logSystemAction(
        "update",
        "cafe",
        cafeId,
        { isPublished: true },
        { isPublished: false },
        { reason: "Cafe unpublished by admin" }
    )
```

**Step 2: Verify**

Run: `bun lint`
Expected: No errors

---

### Task 4: Log `bulkMarkAsChain` to systemLogs

**Problem:** Bulk chain marking changes multiple cafes with no audit trail.

**Files:**
- Modify: `app/api/actions/admin.ts:990-999`

**Step 1: Add system log after successful update**

After the `db.update(cafes)` call at line 994, add:

```typescript
        // Log the bulk chain marking
        await logSystemAction(
            "update",
            "cafe",
            cafeIds[0], // Primary entity (bulk op)
            null,
            { isChain },
            {
                reason: `Bulk marked ${cafeIds.length} cafes as ${isChain ? "chain" : "non-chain"}`,
                cafe_count: cafeIds.length,
                cafe_ids: cafeIds,
                is_chain: isChain,
            }
        )
```

**Step 2: Verify**

Run: `bun lint`
Expected: No errors

---

### Task 5: Log `adminDeleteCafeImage` to systemLogs

**Problem:** Individual image deletions by admins are unlogged.

**Files:**
- Modify: `app/api/actions/admin.ts:1020-1021`

**Step 1: Wrap the existing return and add logging**

Replace lines 1020-1021:

```typescript
    // Use the storage action to delete the image
    const result = await deleteSingleCafeImageAction(imageUrl)

    if (result.success) {
        await logSystemAction(
            "delete",
            "cafe",
            imageUrl, // Use URL as entity reference
            { imageUrl },
            null,
            { reason: "Cafe image deleted by admin", image_url: imageUrl }
        )
    }

    return result
```

**Step 2: Verify**

Run: `bun lint`
Expected: No errors

---

## Part 2: System Logging - Cafe Story Operations (Task 6-7)

### Task 6: Log `upsertCafeStory` to systemLogs

**Problem:** Cafe story create/update is unlogged.

**Files:**
- Modify: `app/api/actions/admin.ts:1747-1758`

**Step 1: Add system log after successful upsert**

After the try/catch block at line 1758, before `return { success: true }`:

```typescript
    // Log the story upsert
    await logSystemAction(
        existingResult[0] ? "update" : "create",
        "cafe",
        cafeId,
        existingResult[0] ? { storyExists: true } : null,
        { contentLength: content.length },
        { reason: existingResult[0] ? "Cafe story updated by admin" : "Cafe story created by admin" }
    )
```

**Step 2: Verify**

Run: `bun lint`
Expected: No errors

---

### Task 7: Log `deleteCafeStory` to systemLogs

**Problem:** Cafe story deletion is unlogged.

**Files:**
- Modify: `app/api/actions/admin.ts:1797-1804`

**Step 1: Add system log after successful delete**

After the try/catch at line 1802, before `return { success: true }`:

```typescript
    // Log the story deletion
    await logSystemAction(
        "delete",
        "cafe",
        cafeId,
        { storyExists: true },
        null,
        { reason: "Cafe story deleted by admin" }
    )
```

**Step 2: Verify**

Run: `bun lint`
Expected: No errors

---

## Part 3: System Logging - Featured Schedules (Task 8-10)

### Task 8: Log `createFeaturedSchedule` to systemLogs

**Problem:** Creating featured schedules is unlogged.

**Files:**
- Modify: `app/api/actions/admin.ts:3003-3027` (inside the success return block)

**Step 1: Add system log before the success return**

Insert after the cafe info fetch (line 3001), before `return { success: true, schedule: ... }`:

```typescript
        // Log the featured schedule creation
        await logSystemAction(
            "create",
            "featured",
            newSchedule.id,
            null,
            {
                cafeId: schedule.cafe_id,
                startDate: schedule.start_date,
                endDate: schedule.end_date,
                slotType: "hero",
                cafeName: cafe?.name,
            },
            { reason: "Featured schedule created by admin", cafeName: cafe?.name }
        )
```

**Step 2: Verify**

Run: `bun lint`
Expected: No errors

---

### Task 9: Log `updateFeaturedSchedule` to systemLogs

**Files:**
- Modify: `app/api/actions/admin.ts` - find the success return of `updateFeaturedSchedule`

**Step 1: Find and add system log**

Locate the success return of `updateFeaturedSchedule` and add before it:

```typescript
    // Log the featured schedule update
    await logSystemAction(
        "update",
        "featured",
        scheduleId,
        null,
        updates as Record<string, unknown>,
        { reason: "Featured schedule updated by admin" }
    )
```

**Step 2: Verify**

Run: `bun lint`
Expected: No errors

---

### Task 10: Log `deleteFeaturedSchedule` to systemLogs

**Files:**
- Modify: `app/api/actions/admin.ts` - find the success return of `deleteFeaturedSchedule`

**Step 1: Find and add system log**

Locate the success return of `deleteFeaturedSchedule` and add before it:

```typescript
    // Log the featured schedule deletion
    await logSystemAction(
        "delete",
        "featured",
        scheduleId,
        null,
        null,
        { reason: "Featured schedule deleted by admin" }
    )
```

**Step 2: Verify**

Run: `bun lint`
Expected: No errors

---

## Part 4: System Logging - Subscriptions (Task 11-12)

### Task 11: Log `verifyManualPayment` to systemLogs

**Problem:** Subscription payment verification is unlogged.

**Files:**
- Modify: `app/api/actions/admin.ts:1510`

**Step 1: Add system log before the return**

Insert before `return { success: true, proofInfo }` at line 1510:

```typescript
    // Log the subscription verification
    await logSystemAction(
        "approve",
        "cafe",
        cafeId,
        { paymentVerified: false, status: "pending" },
        { paymentVerified: true, status: "active", tier: sub.tier },
        { reason: "Manual payment verified by admin", cafeName, tier: sub.tier, subscriptionId }
    )
```

**Step 2: Verify**

Run: `bun lint`
Expected: No errors

---

### Task 12: Log `rejectManualPayment` to systemLogs

**Files:**
- Modify: `app/api/actions/admin.ts:1614`

**Step 1: Add system log before the return**

Insert before `return { success: true }` at line 1614:

```typescript
    // Log the subscription rejection
    await logSystemAction(
        "reject",
        "cafe",
        cafeId,
        { tier: sub?.tier },
        { membershipTier: "free", isVerified: false },
        { reason: reason || "Manual payment rejected by admin", cafeName: sub?.cafeName || "cafe", subscriptionId }
    )
```

**Step 2: Verify**

Run: `bun lint`
Expected: No errors

---

## Part 5: System Logging - Badges (Task 13-15)

### Task 13: Log `createBadgeDefinition` to systemLogs

**Files:**
- Modify: `app/api/actions/admin.ts` - find success return of `createBadgeDefinition`

**Step 1: Find and add system log**

After successful badge creation, before return:

```typescript
    await logSystemAction(
        "create",
        "badge",
        result[0].id,
        null,
        { name, description, category, rarity },
        { reason: "Badge definition created by admin" }
    )
```

**Step 2: Verify**

Run: `bun lint`
Expected: No errors

---

### Task 14: Log `updateBadgeDefinition` to systemLogs

**Files:**
- Modify: `app/api/actions/admin.ts` - find success return of `updateBadgeDefinition`

**Step 1: Find and add system log**

Before the success return:

```typescript
    await logSystemAction(
        "update",
        "badge",
        badgeId,
        null,
        updates as Record<string, unknown>,
        { reason: "Badge definition updated by admin" }
    )
```

**Step 2: Verify**

Run: `bun lint`
Expected: No errors

---

### Task 15: Log `deleteBadgeDefinition` to systemLogs

**Files:**
- Modify: `app/api/actions/admin.ts` - find success return of `deleteBadgeDefinition`

**Step 1: Find and add system log**

Before the success return:

```typescript
    await logSystemAction(
        "delete",
        "badge",
        badgeId,
        null,
        null,
        { reason: "Badge definition deleted by admin" }
    )
```

**Step 2: Verify**

Run: `bun lint`
Expected: No errors

---

## Part 6: System Logging - Featured Requests & Other (Task 16-19)

### Task 16: Log `adminUpdateFeaturedRequestStatus` to systemLogs

**Files:**
- Modify: `app/api/actions/admin.ts:3880`

**Step 1: Add system log before return**

Insert before `return { success: true }` at line 3880:

```typescript
    // Log the featured request status update
    await logSystemAction(
        status === "approved" ? "approve" : "reject",
        "featured",
        requestId,
        null,
        { status, adminNotes },
        { reason: `Featured slot request ${status} by admin` }
    )
```

**Step 2: Verify**

Run: `bun lint`
Expected: No errors

---

### Task 17: Log `updateModeratorRegions` to systemLogs

**Problem:** Changing moderator region assignments is a sensitive admin action with no audit trail.

**Files:**
- Modify: `app/api/actions/admin.ts:3742`

**Step 1: Add system log before return**

Insert before `return { success: true }` at line 3742:

```typescript
    // Log the moderator regions update
    await logSystemAction(
        "role_change",
        "user",
        targetUserId,
        null,
        { moderatorRegions: normalized },
        { reason: "Moderator regions updated by admin", targetUserId, regions: normalized }
    )
```

**Step 2: Verify**

Run: `bun lint`
Expected: No errors

---

### Task 18: Log `rejectBlogPost` to systemLogs

**Problem:** Blog post rejection in `moderation.ts` is unlogged (unlike `approveBlogPost` in `blog.ts` which IS logged).

**Files:**
- Modify: `app/api/actions/moderation.ts:180-183`

**Step 1: Import logSystemAction**

Add to imports at top of file:

```typescript
import { logSystemAction } from "./system-logs"
```

**Step 2: Add system log before return**

Insert before `return { success: true }` at line 183:

```typescript
        // Log the blog post rejection
        await logSystemAction(
            "reject",
            "blog",
            postId,
            { status: "pending" },
            { status: "archived", rejectionReason: reason },
            { reason: `Blog post rejected: ${reason}`, postTitle: existing[0].title }
        )
```

**Step 3: Verify**

Run: `bun lint`
Expected: No errors

---

### Task 19: Commit system logging changes

**Step 1: Run lint and typecheck**

```bash
bun lint
```

**Step 2: Run tests**

```bash
bun test
```

**Step 3: Commit**

```bash
git add app/api/actions/admin.ts app/api/actions/moderation.ts
git commit -m "feat: add comprehensive system logging for all admin/mod actions

Audit trail now covers:
- Cafe: update, delete, unpublish, bulk chain, image delete
- Cafe Story: create/update, delete
- Featured Schedules: create, update, delete
- Subscriptions: verify payment, reject payment
- Badges: create, update, delete
- Featured Requests: approve/reject
- Moderator Regions: update assignments
- Blog: reject (moderation.ts)

Previously only 13/32 mutating actions were logged.
Now all 32 actions are logged to system_logs."
```

---

## Part 7: Cafe Edit Banner - Server Component Changes (Task 20-21)

### Task 20: Create `getCafeEditPermission` server action

**Purpose:** Determine if the current user can edit a specific cafe, respecting moderator region scope.

**Files:**
- Create: `app/api/actions/cafe-edit-permission.ts`

**Step 1: Create the server action**

```typescript
"use server"

import { db } from "@/db"
import { cafes, profiles } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
import { getModeratorRegionsForCurrentUser } from "@/utils/moderation/region-access"

export interface CafeEditPermission {
    canEdit: boolean
    role: "admin" | "moderator" | null
}

export async function getCafeEditPermission(cafeId: string): Promise<CafeEditPermission> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return { canEdit: false, role: null }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    const role = profileResult[0]?.role

    if (role !== "admin" && role !== "moderator") {
        return { canEdit: false, role: null }
    }

    // For moderators, check region scope
    if (role === "moderator") {
        const regions = await getModeratorRegionsForCurrentUser()
        if (regions.length > 0) {
            // Moderator has region restrictions - check cafe region
            const cafeResult = await db
                .select({ region: cafes.region })
                .from(cafes)
                .where(eq(cafes.id, cafeId))
                .limit(1)

            const cafeRegion = cafeResult[0]?.region
            if (!cafeRegion || !regions.includes(cafeRegion)) {
                return { canEdit: false, role: "moderator" }
            }
        }
    }

    return { canEdit: true, role: role as "admin" | "moderator" }
}
```

**Step 2: Verify**

Run: `bun lint`
Expected: No errors

---

### Task 21: Update cafe detail page to pass edit permission

**Files:**
- Modify: `app/cafes/[slug]/page.tsx:159-214`

**Step 1: Import the new action**

Add to imports:

```typescript
import { getCafeEditPermission } from "@/app/api/actions/cafe-edit-permission"
```

**Step 2: Fetch edit permission in the page component**

Inside the `CafePage` function, after fetching cafe data, add:

```typescript
    // Check if user can edit this cafe
    const editPermission = cafe
        ? await getCafeEditPermission(cafe.id)
        : { canEdit: false, role: null }
```

**Step 3: Pass to CafeDetails**

Update the `<CafeDetails>` component to accept the new prop:

```typescript
    <CafeDetails
        key={cafe.id}
        cafe={cafe}
        reviews={reviews}
        menuItems={menuItems}
        canEdit={editPermission.canEdit}
        editRole={editPermission.role}
        heroImage={...}
    />
```

**Step 4: Verify**

Run: `bun lint`
Expected: No errors

---

## Part 8: Cafe Edit Banner - Client Component (Task 22-24)

### Task 22: Create `CafeEditBanner` component

**Purpose:** Dismissible banner shown to admin/mod users on cafe detail pages.

**Files:**
- Create: `components/cafe/CafeEditBanner.tsx`

**Step 1: Create the component**

```typescript
"use client"

import Link from "next/link"
import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Pencil, X } from "lucide-react"

interface CafeEditBannerProps {
    cafeId: string
    cafeName: string
    role: "admin" | "moderator"
}

export default function CafeEditBanner({ cafeId, cafeName, role }: CafeEditBannerProps) {
    const [isVisible, setIsVisible] = useState(true)

    const roleLabel = role === "admin" ? "Admin" : "Moderator"

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className='mx-4 lg:mx-0 mt-4'
                >
                    <div className='flex items-center justify-between gap-3 bg-primary/10 border border-primary/20 rounded-xl px-4 py-3'>
                        <div className='flex items-center gap-3 min-w-0'>
                            <div className='flex items-center justify-center w-8 h-8 rounded-lg bg-primary/15 shrink-0'>
                                <Pencil className='w-4 h-4 text-primary' />
                            </div>
                            <div className='min-w-0'>
                                <p className='text-sm font-semibold text-text'>
                                    {roleLabel} Access
                                </p>
                                <p className='text-xs text-text/60 truncate'>
                                    You can edit {cafeName}
                                </p>
                            </div>
                        </div>
                        <div className='flex items-center gap-2 shrink-0'>
                            <Link
                                href={`/manage/preview/${cafeId}`}
                                className='text-xs font-semibold text-primary hover:text-primary/80 transition-colors bg-primary/10 hover:bg-primary/15 px-3 py-1.5 rounded-lg'
                            >
                                Edit Cafe
                            </Link>
                            <button
                                onClick={() => setIsVisible(false)}
                                className='p-1 rounded-lg hover:bg-text/5 transition-colors'
                                aria-label='Dismiss'
                            >
                                <X className='w-4 h-4 text-text/40' />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
```

**Step 2: Verify**

Run: `bun lint`
Expected: No errors

---

### Task 23: Integrate banner into CafeDetails

**Files:**
- Modify: `components/cafe/CafeDetails.tsx:76-87` (props interface and component body)

**Step 1: Update props interface**

Add to the component props:

```typescript
export default function CafeDetails({
    cafe,
    reviews = [],
    menuItems = [],
    heroImage,
    canEdit = false,
    editRole = null,
}: {
    cafe: CafeWithRatings
    reviews?: Review[]
    menuItems?: CafeMenuItem[]
    heroImage?: React.ReactNode
    canEdit?: boolean
    editRole?: "admin" | "moderator" | null
}) {
```

**Step 2: Import the banner component**

Add to imports:

```typescript
import CafeEditBanner from "@/components/cafe/CafeEditBanner"
```

**Step 3: Render the banner**

Find where the main content renders (after the hero section). Add the banner between the hero and the main content. Look for the return JSX and add:

```typescript
{canEdit && editRole && (
    <CafeEditBanner
        cafeId={cafe.id}
        cafeName={cafe.name}
        role={editRole}
    />
)}
```

The exact placement depends on the component's JSX structure. It should appear after the hero section and before the main content/tabs.

**Step 4: Verify**

Run: `bun lint`
Expected: No errors

---

### Task 24: Commit cafe edit banner

**Step 1: Run lint and typecheck**

```bash
bun lint
```

**Step 2: Run tests**

```bash
bun test
```

**Step 3: Commit**

```bash
git add app/api/actions/cafe-edit-permission.ts app/cafes/[slug]/page.tsx components/cafe/CafeEditBanner.tsx components/cafe/CafeDetails.tsx
git commit -m "feat: add dismissible edit banner on cafe detail pages for admin/mod users

- New server action getCafeEditPermission checks role + region scope
- Moderators only see edit option if cafe is in their assigned regions
- Dismissible banner with animated show/hide via motion/react
- Links directly to /manage/preview/[cafeId] editor"
```

---

## Part 9: Schema Updates (Task 25)

### Task 25: Update entityType enum comment in schema

**Files:**
- Modify: `db/schema/tables.ts:778`

**Step 1: Update the comment to reflect new entity types**

The `entityType` column is `text` (not an enum), so no migration needed. But update the comment to document all used types:

```typescript
entityType: text("entity_type").notNull(), // "cafe", "blog", "event", "user", "featured", "review", "verification", "mall_cafe_verification", "badge", "subscription"
```

**Step 2: Update the action column comment**

```typescript
action: text("action").notNull(), // "create", "update", "delete", "approve", "reject", "role_change"
```

(Note: actions are already correct, just verifying)

**Step 3: Verify**

Run: `bun lint`
Expected: No errors

---

## Part 10: Final Verification (Task 26)

### Task 26: Full verification and commit

**Step 1: Run full lint**

```bash
bun lint
```

**Step 2: Run all tests**

```bash
bun test
```

**Step 3: Build check**

```bash
bun build
```

**Step 4: Final commit for schema comment**

```bash
git add db/schema/tables.ts
git commit -m "docs: update system_logs column comments with all entity types"
```

---

## Summary

| Part | Tasks | Description |
|------|-------|-------------|
| 1 | 1-5 | Log cafe operations (update, delete, unpublish, bulk chain, image delete) |
| 2 | 6-7 | Log cafe story operations (upsert, delete) |
| 3 | 8-10 | Log featured schedule CRUD |
| 4 | 11-12 | Log subscription verification/rejection |
| 5 | 13-15 | Log badge CRUD |
| 6 | 16-19 | Log featured requests, moderator regions, blog rejection + commit |
| 7 | 20-21 | Server-side edit permission check |
| 8 | 22-24 | Client-side edit banner component + commit |
| 9 | 25 | Schema comment updates |
| 10 | 26 | Final verification + commit |

**Total: 26 tasks across 10 parts**
