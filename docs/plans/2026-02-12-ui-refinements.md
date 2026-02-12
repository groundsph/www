# UI Refinements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refine three UI interactions: (1) Leaderboard tied ranks display as single expandable cards instead of multiple cards, (2) Search leaderboard quick link navigates directly to the leaderboard tab, and (3) Move featured cafe management from content page to cafes page in admin dashboard.

**Architecture:** Leverage existing state management patterns. For leaderboard, modify the grouped rendering to use a collapsible/expandable card pattern. For search, append query parameter to route. For admin dashboard, relocate FeaturedScheduleManager component and associated data fetching from ContentManagement to CafesManagement.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS v4, Lucide React icons

---

## Phase 1: Leaderboard Tied Ranks - Single Expandable Card

### Task 1.1: Create ExpandableRankCard component

**Files:**
- Create: `components/community/ExpandableRankCard.tsx`
- Modify: `components/community/MonthlyLeaderboard.tsx`

**Step 1: Write the component structure**

Create a new component that displays tied users in a single card with expand/collapse functionality:

```typescript
"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { ChevronDown, Users } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

interface LeaderboardEntry {
    rank: number
    userId: string
    username: string
    displayName: string
    avatarUrl: string | null
    visitCount: number
}

interface ExpandableRankCardProps {
    rank: number
    entries: LeaderboardEntry[]
    rankColor: string
    rankIcon: React.ReactNode
}

export default function ExpandableRankCard({
    rank,
    entries,
    rankColor,
    rankIcon,
}: ExpandableRankCardProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const hasMultiple = entries.length > 1

    return (
        <div className={`relative rounded-2xl p-6 ${rankColor} border-2 border-white/20 shadow-lg`}>
            {/* Rank Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xl">
                        {rankIcon}
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-lg">
                            {rank === 1 ? "1st Place" : rank === 2 ? "2nd Place" : "3rd Place"}
                        </h3>
                        {hasMultiple && (
                            <p className="text-white/80 text-sm flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {entries.length} people tied
                            </p>
                        )}
                    </div>
                </div>
                
                {hasMultiple && (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm transition"
                    >
                        {isExpanded ? "Show Less" : "View All"}
                        <ChevronDown 
                            className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                    </button>
                )}
            </div>

            {/* Primary Entry (always visible) */}
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                <Link
                    href={`/profile/${entries[0].username}`}
                    className="flex items-center gap-4"
                >
                    <div className="relative">
                        {entries[0].avatarUrl ? (
                            <Image
                                src={entries[0].avatarUrl}
                                alt={entries[0].displayName}
                                width={56}
                                height={56}
                                className="w-14 h-14 rounded-full object-cover border-2 border-white/50"
                            />
                        ) : (
                            <div className="w-14 h-14 rounded-full bg-white/30 flex items-center justify-center text-white font-bold text-xl border-2 border-white/50">
                                {entries[0].displayName.charAt(0)}
                            </div>
                        )}
                    </div>
                    <div className="flex-1">
                        <p className="text-white font-semibold text-lg">
                            {entries[0].displayName}
                        </p>
                        <p className="text-white/70 text-sm">@{entries[0].username}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-white font-bold text-2xl">{entries[0].visitCount}</p>
                        <p className="text-white/70 text-sm">visits</p>
                    </div>
                </Link>
            </div>

            {/* Additional Entries (expandable) */}
            <AnimatePresence>
                {isExpanded && hasMultiple && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="pt-3 space-y-2">
                            {entries.slice(1).map((entry) => (
                                <div
                                    key={entry.userId}
                                    className="bg-white/10 rounded-xl p-3 backdrop-blur-sm"
                                >
                                    <Link
                                        href={`/profile/${entry.username}`}
                                        className="flex items-center gap-3"
                                    >
                                        {entry.avatarUrl ? (
                                            <Image
                                                src={entry.avatarUrl}
                                                alt={entry.displayName}
                                                width={40}
                                                height={40}
                                                className="w-10 h-10 rounded-full object-cover border border-white/30"
                                            />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold border border-white/30">
                                                {entry.displayName.charAt(0)}
                                            </div>
                                        )}
                                        <div className="flex-1">
                                            <p className="text-white font-medium">
                                                {entry.displayName}
                                            </p>
                                            <p className="text-white/60 text-sm">
                                                @{entry.username}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-white font-bold">{entry.visitCount}</p>
                                        </div>
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
```

**Step 2: Update MonthlyLeaderboard to use new component**

Replace the current podium rendering section to use ExpandableRankCard for ranks 1-3.

**Step 3: Run build to verify**

Run: `bun run build`
Expected: Successful build

**Step 4: Commit**

```bash
git add components/community/ExpandableRankCard.tsx components/community/MonthlyLeaderboard.tsx
git commit -m "feat(leaderboard): tied ranks display as single expandable card"
```

---

## Phase 2: Search Leaderboard Quick Link - Direct to Tab

### Task 2.1: Update search index to include tab parameter

**Files:**
- Modify: `utils/search-index.ts`

**Step 1: Update the leaderboard quick action href**

Change the href from `/community` to `/community?tab=leaderboard`:

```typescript
{
    id: 'action-leaderboard',
    type: 'action',
    title: 'Quick: Leaderboard',
    subtitle: "Type '>leaderboard' anywhere",
    href: '/community?tab=leaderboard',
    priority: 95,
    keywords: ['>leaderboard', 'leaderboard', 'rankings']
}
```

**Step 2: Verify the change**

Run: `bun run build`
Expected: Successful build

**Step 3: Commit**

```bash
git add utils/search-index.ts
git commit -m "feat(search): leaderboard quick link navigates to leaderboard tab"
```

---

## Phase 3: Move Featured Cafe Tab to Cafes Page

### Task 3.1: Update CafesManagement component

**Files:**
- Modify: `components/manage/CafesManagement.tsx`
- Modify: `app/manage/cafes/page.tsx`

**Step 1: Add featured tab to CafesManagement**

Update the TabType and add featured schedules handling:

```typescript
type TabType =
    | "pending"
    | "published"
    | "suggestions"
    | "claims"
    | "subscriptions"
    | "featured"  // Add this

// Add to props
interface CafesManagementProps {
    // ... existing props
    featuredSchedules: FeaturedSchedule[]
}
```

**Step 2: Add featured tab button and content**

Add the featured tab button in the tabs section and render FeaturedScheduleManager when active.

**Step 3: Update page.tsx to fetch featured schedules**

Add `getFeaturedSchedules` to the data fetching and pass to CafesManagement.

**Step 4: Commit**

```bash
git add components/manage/CafesManagement.tsx app/manage/cafes/page.tsx
git commit -m "feat(admin): add featured cafe tab to cafes management"
```

---

### Task 3.2: Remove featured tab from ContentManagement

**Files:**
- Modify: `components/manage/ContentManagement.tsx`
- Modify: `app/manage/content/page.tsx`

**Step 1: Remove featured from ContentManagement tabs**

Update TabType to remove "featured" and remove the featured tab button and content rendering.

**Step 2: Remove featured schedules from data fetching**

Update the content page.tsx to no longer fetch or pass featuredSchedules.

**Step 3: Commit**

```bash
git add components/manage/ContentManagement.tsx app/manage/content/page.tsx
git commit -m "feat(admin): remove featured cafe tab from content management"
```

---

### Task 3.3: Fix date conversion bug in updateFeaturedSchedule

**Files:**
- Modify: `app/api/actions/admin.ts`

**Bug:** `TypeError: value.toISOString is not a function` when updating featured schedules. The `start_date` and `end_date` values are being passed as strings but Drizzle expects Date objects.

**Step 1: Update the date conversion logic**

In the `updateFeaturedSchedule` function (around line 2747-2748), change:

```typescript
// BEFORE (broken)
if (updates.start_date !== undefined) drizzleUpdates.startDate = updates.start_date
if (updates.end_date !== undefined) drizzleUpdates.endDate = updates.end_date

// AFTER (fixed)
if (updates.start_date !== undefined) {
    const startDate = typeof updates.start_date === 'string' 
        ? new Date(updates.start_date) 
        : updates.start_date
    drizzleUpdates.startDate = startDate
}
if (updates.end_date !== undefined) {
    const endDate = typeof updates.end_date === 'string' 
        ? new Date(updates.end_date) 
        : updates.end_date
    drizzleUpdates.endDate = endDate
}
```

**Step 2: Verify the fix**

Run: `bun run build`
Expected: Successful build

**Step 3: Commit**

```bash
git add app/api/actions/admin.ts
git commit -m "fix(admin): convert string dates to Date objects in featured schedule update"
```

---

## Phase 4: Verification

### Task 4.1: Run final verification

**Step 1: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 2: Run linter**

Run: `bun lint`
Expected: No errors

**Step 3: Build project**

Run: `bun run build`
Expected: Successful build

**Step 4: Summary report**

All three refinements implemented:
- ✓ Leaderboard tied ranks display as expandable cards
- ✓ Search leaderboard link navigates to leaderboard tab
- ✓ Featured cafe management moved to cafes page

---

## Implementation Notes

**Leaderboard Card Pattern:**
- Single card per rank position
- Shows primary user always visible
- "View All" button appears only when 2+ users tied
- Smooth animation on expand/collapse
- Maintains existing color coding (gold/silver/bronze)

**Search Navigation:**
- Uses existing query parameter pattern (`?tab=leaderboard`)
- CommunityPage already handles tab parameter
- No changes needed to CommunityPage component

**Admin Dashboard Reorganization:**
- FeaturedScheduleManager component remains unchanged
- Only relocated from ContentManagement to CafesManagement
- Data fetching moved to appropriate page
- Cleaner separation: cafes-related features in cafes page
