# Cafe Menu Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete cafe menu overhaul enabling community menu contributions, dynamic price levels, menu comparisons, AI chat expansion with persistent storage, and global menu search.

**Architecture:** Extend the existing `cafeMenuItems` schema with new metadata fields (isFood, isHot, isCold, calories, isVegan, sizeOptions). Add a separate "Suggest Menu Item" flow distinct from the existing Suggest Edit modal. Implement dynamic 4-tier price level calculation based on menu item averages. Store AI chat history in a new DB table for future training. Add side-by-side menu comparison modal. Integrate menu items into global search via a dedicated section.

**Tech Stack:** Next.js App Router, Drizzle ORM, PostgreSQL, Better Auth, OpenAI-compatible API, Tailwind CSS v4, motion/react, Fuse.js, Zod

**Current Version:** `2026.15.0` → Target: `2027.0.0`

---

## Part 1: Schema Changes

### Task 1.1: Expand `cafeMenuItems` schema with new metadata fields

**Files:**
- Modify: `db/schema/tables.ts:176-191`
- Modify: `utils/types/owner.ts:260-273`

**Step 1: Add new columns to `cafeMenuItems` table**

Add the following columns to the `cafeMenuItems` table definition in `db/schema/tables.ts` after `isSignature`:

```ts
isFood: boolean("is_food").default(false),
isHot: boolean("is_hot").default(false),
isCold: boolean("is_cold").default(false),
calories: integer("calories"),
isVegan: boolean("is_vegan").default(false),
isVegetarian: boolean("is_vegetarian").default(false),
sizeOptions: jsonb("size_options").$type<Array<{ label: string; price: number }>>(),
lastUpdatedBy: uuid("last_updated_by").references(() => profiles.id),
communitySubmitted: boolean("community_submitted").default(false),
```

**Step 2: Update `CafeMenuItem` type in `utils/types/owner.ts`**

Add matching fields to the `CafeMenuItem` interface:

```ts
is_food: boolean;
is_hot: boolean;
is_cold: boolean;
calories: number | null;
is_vegan: boolean;
is_vegetarian: boolean;
size_options: Array<{ label: string; price: number }> | null;
last_updated_by: string | null;
community_submitted: boolean;
```

**Step 3: Generate migration**

Run: `bun db:generate`
Expected: New migration file created with ALTER TABLE statements

**Step 4: Push to dev database**

Run: `bun db:push`
Expected: Schema applied successfully

**Step 5: Commit**

```bash
git add db/schema/tables.ts utils/types/owner.ts drizzle/
git commit -m "feat: expand cafe menu items schema with metadata fields"
```

---

### Task 1.2: Update price level enum to 4 tiers

**Files:**
- Modify: `db/schema/enums.ts:39`
- Modify: `utils/hooks/cafe-form.ts:127-131`
- Modify: `utils/extras.ts:5-14`

**Step 1: Update the `priceLevelEnum`**

Change from `["low", "medium", "high"]` to `["budget", "mid", "premium", "luxury"]`:

```ts
export const priceLevelEnum = pgEnum("price_level", ["budget", "mid", "premium", "luxury"])
```

**Step 2: Update `PRICE_LEVELS` constant in `utils/hooks/cafe-form.ts`**

```ts
export const PRICE_LEVELS = [
    { value: "budget" as const, level: 1, label: "₱", range: "< ₱150 avg", description: "Budget-friendly" },
    { value: "mid" as const, level: 2, label: "₱₱", range: "₱150 - ₱250 avg", description: "Mid-range" },
    { value: "premium" as const, level: 3, label: "₱₱₱", range: "₱250 - ₱400 avg", description: "Premium" },
    { value: "luxury" as const, level: 4, label: "₱₱₱₱", range: "₱400+ avg", description: "Luxury" },
]
```

**Step 3: Update `getPriceLevel` helper in `utils/extras.ts`**

```ts
export function getPriceLevel(priceLevel: Database["public"]["Enums"]["price_level"]) {
    switch (priceLevel) {
        case "budget": return "₱";
        case "mid": return "₱ ₱";
        case "premium": return "₱ ₱ ₱";
        case "luxury": return "₱ ₱ ₱ ₱";
    }
}
```

**Step 4: Write failing test for price level calculation**

Create `utils/__tests__/price-level.test.ts`:

```ts
import { describe, expect, it } from "bun:test"
import { calculatePriceLevel } from "@/utils/price-level"

describe("calculatePriceLevel", () => {
    it("returns budget for avg price < 150", () => {
        expect(calculatePriceLevel([100, 120, 80, 140])).toBe("budget")
    })
    it("returns mid for avg price 150-250", () => {
        expect(calculatePriceLevel([150, 180, 200, 220])).toBe("mid")
    })
    it("returns premium for avg price 250-400", () => {
        expect(calculatePriceLevel([250, 300, 350, 280])).toBe("premium")
    })
    it("returns luxury for avg price > 400", () => {
        expect(calculatePriceLevel([400, 500, 450, 600])).toBe("luxury")
    })
    it("returns null for fewer than 5 items", () => {
        expect(calculatePriceLevel([100, 200, 300, 400])).toBeNull()
    })
    it("handles empty array", () => {
        expect(calculatePriceLevel([])).toBeNull()
    })
})
```

**Step 5: Create `utils/price-level.ts` utility**

```ts
export type PriceLevel = "budget" | "mid" | "premium" | "luxury"

const PRICE_LEVEL_RANGES: Array<{ min: number; max: number; level: PriceLevel }> = [
    { min: 0, max: 150, level: "budget" },
    { min: 150, max: 250, level: "mid" },
    { min: 250, max: 400, level: "premium" },
    { min: 400, max: Infinity, level: "luxury" },
]

const MIN_ITEMS_FOR_AUTO_CALC = 5

export function calculatePriceLevel(prices: number[]): PriceLevel | null {
    if (prices.length < MIN_ITEMS_FOR_AUTO_CALC) return null
    const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length
    for (const range of PRICE_LEVEL_RANGES) {
        if (avg >= range.min && avg < range.max) return range.level
    }
    return "luxury"
}
```

**Step 6: Run test to verify**

Run: `bun test utils/__tests__/price-level.test.ts`
Expected: All tests pass

**Step 7: Write server action for auto-calculating price level**

Create `app/api/actions/price-level.ts`:

```ts
"use server"

import { db } from "@/db"
import { cafeMenuItems, cafes } from "@/db/schema/tables"
import { eq, and } from "drizzle-orm"
import { calculatePriceLevel } from "@/utils/price-level"

export async function recalculatePriceLevel(cafeId: string): Promise<void> {
    const items = await db
        .select({ price: cafeMenuItems.price })
        .from(cafeMenuItems)
        .where(
            and(
                eq(cafeMenuItems.cafeId, cafeId),
                eq(cafeMenuItems.isAvailable, true)
            )
        )

    const prices = items.map(i => i.price)
    const newLevel = calculatePriceLevel(prices)

    if (newLevel) {
        await db
            .update(cafes)
            .set({ priceLevel: newLevel })
            .where(eq(cafes.id, cafeId))
    }
}
```

**Step 8: Run tests**

Run: `bun test utils/__tests__/price-level.test.ts`
Expected: PASS

**Step 9: Commit**

```bash
git add db/schema/enums.ts utils/hooks/cafe-form.ts utils/extras.ts utils/price-level.ts utils/__tests__/price-level.test.ts app/api/actions/price-level.ts
git commit -m "feat: implement 4-tier price level system with dynamic calculation"
```

---

### Task 1.3: Create chat history and feedback schema

**Files:**
- Create: `db/schema/chat.ts`
- Modify: `db/schema/tables.ts` (add export)
- Modify: `db/schema/index.ts` (add export)

**Step 1: Create `db/schema/chat.ts`**

```ts
import { pgTable, uuid, text, timestamp, jsonb, boolean, integer, real } from "drizzle-orm/pg-core"
import { profiles } from "./tables"

export const chatConversations = pgTable("chat_conversations", {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: text("session_id").notNull(),
    userId: uuid("user_id").references(() => profiles.id),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    metadata: jsonb("metadata"),
})

export const chatMessages = pgTable("chat_messages", {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id").notNull().references(() => chatConversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // 'user' | 'assistant' | 'tool'
    content: text("content"),
    toolCalls: jsonb("tool_calls"), // array of tool call data
    toolCallId: text("tool_call_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

export const chatFeedback = pgTable("chat_feedback", {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id").notNull().references(() => chatMessages.id, { onDelete: "cascade" }),
    sessionId: text("session_id").notNull(),
    userId: uuid("user_id").references(() => profiles.id),
    rating: integer("rating").notNull(), // 1 = thumbs up, -1 = thumbs down
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})
```

**Step 2: Add exports to `db/schema/tables.ts`**

Add at the bottom:
```ts
export { chatConversations, chatMessages, chatFeedback } from "./chat"
```

**Step 3: Add export to `db/schema/index.ts`**

```ts
export { chatConversations, chatMessages, chatFeedback } from "./tables"
```

**Step 4: Generate migration**

Run: `bun db:generate`
Expected: Migration file with CREATE TABLE for chat_conversations, chat_messages, chat_feedback

**Step 5: Push to dev**

Run: `bun db:push`
Expected: Tables created

**Step 6: Commit**

```bash
git add db/schema/chat.ts db/schema/tables.ts db/schema/index.ts drizzle/
git commit -m "feat: add chat history and feedback database schema"
```

---

### Task 1.4: Create menu item edit suggestions schema

**Files:**
- Create: `db/schema/menu-suggestions.ts`
- Modify: `db/schema/tables.ts` (add export)

**Step 1: Create `db/schema/menu-suggestions.ts`**

```ts
import { pgTable, uuid, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core"
import { profiles, cafes } from "./tables"

export const menuItemSuggestions = pgTable("menu_item_suggestions", {
    id: uuid("id").primaryKey().defaultRandom(),
    cafeId: uuid("cafe_id").notNull().references(() => cafes.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // 'add' | 'edit' | 'remove'
    targetItemId: uuid("target_item_id"), // for edit/remove, references cafeMenuItems.id
    suggestedData: jsonb("suggested_data").notNull(), // the proposed menu item data
    status: text("status").default("pending"), // 'pending' | 'approved' | 'rejected'
    adminNotes: text("admin_notes"),
    reviewedBy: uuid("reviewed_by").references(() => profiles.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})
```

**Step 2: Add export and generate migration**

Run: `bun db:generate && bun db:push`

**Step 3: Commit**

```bash
git add db/schema/menu-suggestions.ts db/schema/tables.ts drizzle/
git commit -m "feat: add menu item suggestions schema for community contributions"
```

---

## Part 2: Menu Item Server Actions

### Task 2.1: Create menu item suggestion server actions

**Files:**
- Create: `app/api/actions/menu-suggestions.ts`

**Step 1: Write failing tests**

Create `app/api/actions/__tests__/menu-suggestions.test.ts`:

```ts
import { describe, expect, it, mock } from "bun:test"

describe("submitMenuItemSuggestion", () => {
    it("rejects unauthenticated users", async () => {
        // mock getCurrentUser to return null
        // expect { error: "Authentication required" }
    })
    it("validates required fields for 'add' type", async () => {
        // mock authenticated user
        // submit with missing name/category/price
        // expect { error: "Name, category, and price are required" }
    })
    it("prevents community users from setting imageUrl", async () => {
        // submit with imageUrl set
        // expect imageUrl to be stripped/null
    })
    it("creates pending suggestion for valid 'add' submission", async () => {
        // valid submission
        // expect { success: true, suggestionId: ... }
    })
    it("validates targetItemId for 'edit' type", async () => {
        // edit without targetItemId
        // expect error
    })
    it("validates targetItemId for 'remove' type", async () => {
        // remove without targetItemId
        // expect error
    })
})
```

**Step 2: Run test to verify failures**

Run: `bun test app/api/actions/__tests__/menu-suggestions.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement `app/api/actions/menu-suggestions.ts`**

```ts
"use server"

import { db } from "@/db"
import { menuItemSuggestions, cafeMenuItems, cafes } from "@/db/schema/tables"
import { getCurrentUser } from "@/lib/auth"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export interface MenuItemSuggestionData {
    name: string
    description?: string
    category: string
    price: number
    is_food?: boolean
    is_hot?: boolean
    is_cold?: boolean
    calories?: number | null
    is_vegan?: boolean
    is_vegetarian?: boolean
    size_options?: Array<{ label: string; price: number }> | null
}

export async function submitMenuItemSuggestion(
    cafeId: string,
    type: "add" | "edit" | "remove",
    data: MenuItemSuggestionData,
    targetItemId?: string
) {
    const user = await getCurrentUser()
    if (!user) return { error: "Authentication required" }

    if (type === "add") {
        if (!data.name?.trim() || !data.category || !data.price) {
            return { error: "Name, category, and price are required" }
        }
        // Strip imageUrl from community submissions
        const { imageUrl, ...safeData } = data as any
        data = safeData
    }

    if ((type === "edit" || type === "remove") && !targetItemId) {
        return { error: "Target item ID is required for edit/remove suggestions" }
    }

    try {
        const [suggestion] = await db
            .insert(menuItemSuggestions)
            .values({
                cafeId,
                userId: user.id,
                type,
                targetItemId: targetItemId || null,
                suggestedData: data as any,
                status: "pending",
            })
            .returning({ id: menuItemSuggestions.id })

        revalidatePath(`/cafes/`)
        return { success: true, suggestionId: suggestion.id }
    } catch (error) {
        console.error("Failed to submit menu item suggestion:", error)
        return { error: "Failed to submit suggestion" }
    }
}

export async function getMenuItemSuggestionsForCafe(cafeId: string) {
    const user = await getCurrentUser()
    if (!user) return []

    return db
        .select()
        .from(menuItemSuggestions)
        .where(eq(menuItemSuggestions.cafeId, cafeId))
        .orderBy(menuItemSuggestions.createdAt)
}

export async function getPendingMenuItemSuggestions() {
    const user = await getCurrentUser()
    if (!user || (user.role !== "admin" && user.role !== "moderator")) {
        return []
    }

    return db
        .select()
        .from(menuItemSuggestions)
        .where(eq(menuItemSuggestions.status, "pending"))
        .orderBy(menuItemSuggestions.createdAt)
}

export async function approveMenuItemSuggestion(suggestionId: string) {
    const user = await getCurrentUser()
    if (!user || (user.role !== "admin" && user.role !== "moderator")) {
        return { error: "Unauthorized" }
    }

    try {
        const [suggestion] = await db
            .select()
            .from(menuItemSuggestions)
            .where(eq(menuItemSuggestions.id, suggestionId))

        if (!suggestion) return { error: "Suggestion not found" }
        if (suggestion.status !== "pending") return { error: "Already processed" }

        const data = suggestion.suggestedData as MenuItemSuggestionData

        if (suggestion.type === "add") {
            await db.insert(cafeMenuItems).values({
                cafeId: suggestion.cafeId,
                name: data.name,
                description: data.description || null,
                category: data.category,
                price: data.price,
                isFood: data.is_food || false,
                isHot: data.is_hot || false,
                isCold: data.is_cold || false,
                calories: data.calories || null,
                isVegan: data.is_vegan || false,
                isVegetarian: data.is_vegetarian || false,
                sizeOptions: data.size_options || null,
                communitySubmitted: true,
                lastUpdatedBy: suggestion.userId,
            })
        } else if (suggestion.type === "edit" && suggestion.targetItemId) {
            await db
                .update(cafeMenuItems)
                .set({
                    name: data.name,
                    description: data.description || null,
                    category: data.category,
                    price: data.price,
                    isFood: data.is_food,
                    isHot: data.is_hot,
                    isCold: data.is_cold,
                    calories: data.calories || null,
                    isVegan: data.is_vegan,
                    isVegetarian: data.is_vegetarian,
                    sizeOptions: data.size_options || null,
                    lastUpdatedBy: suggestion.userId,
                })
                .where(eq(cafeMenuItems.id, suggestion.targetItemId))
        } else if (suggestion.type === "remove" && suggestion.targetItemId) {
            await db
                .update(cafeMenuItems)
                .set({ isAvailable: false, lastUpdatedBy: suggestion.userId })
                .where(eq(cafeMenuItems.id, suggestion.targetItemId))
        }

        // Recalculate price level
        const { recalculatePriceLevel } = await import("./price-level")
        await recalculatePriceLevel(suggestion.cafeId)

        await db
            .update(menuItemSuggestions)
            .set({
                status: "approved",
                reviewedBy: user.id,
                reviewedAt: new Date(),
            })
            .where(eq(menuItemSuggestions.id, suggestionId))

        revalidatePath(`/cafes/`)
        return { success: true }
    } catch (error) {
        console.error("Failed to approve suggestion:", error)
        return { error: "Failed to approve suggestion" }
    }
}

export async function rejectMenuItemSuggestion(suggestionId: string, adminNotes?: string) {
    const user = await getCurrentUser()
    if (!user || (user.role !== "admin" && user.role !== "moderator")) {
        return { error: "Unauthorized" }
    }

    await db
        .update(menuItemSuggestions)
        .set({
            status: "rejected",
            adminNotes: adminNotes || null,
            reviewedBy: user.id,
            reviewedAt: new Date(),
        })
        .where(eq(menuItemSuggestions.id, suggestionId))

    return { success: true }
}
```

**Step 4: Run tests**

Run: `bun test app/api/actions/__tests__/menu-suggestions.test.ts`
Expected: Tests pass (after writing actual test implementations)

**Step 5: Commit**

```bash
git add app/api/actions/menu-suggestions.ts app/api/actions/__tests__/menu-suggestions.test.ts
git commit -m "feat: add menu item suggestion server actions for community contributions"
```

---

### Task 2.2: Integrate price level recalculation into existing menu item actions

**Files:**
- Modify: `app/api/actions/owner.ts` (add recalculation calls after menu CRUD)

**Step 1: Add recalculation trigger to owner menu actions**

In `app/api/actions/owner.ts`, after each `addMenuItem`, `updateMenuItem`, and `deleteMenuItem` call, add:

```ts
import { recalculatePriceLevel } from "./price-level"

// After successful menu item mutation:
await recalculatePriceLevel(cafeId)
```

**Step 2: Run lint**

Run: `bun lint`
Expected: No errors

**Step 3: Commit**

```bash
git add app/api/actions/owner.ts
git commit -m "feat: trigger price level recalculation on menu item changes"
```

---

## Part 3: Community Menu Contributions UI

### Task 3.1: Create "Suggest Menu Item" modal component

**Files:**
- Create: `components/suggestions/SuggestMenuItemModal.tsx`

**Step 1: Create the modal component**

```tsx
"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { submitMenuItemSuggestion } from "@/app/api/actions/menu-suggestions"
import { MENU_CATEGORIES } from "@/utils/types/owner"

interface SuggestMenuItemModalProps {
    isOpen: boolean
    onClose: () => void
    cafeId: string
    cafeName: string
    mode?: "add" | "edit"
    existingItem?: {
        id: string
        name: string
        category: string
        price: number
        description: string | null
    }
}

export function SuggestMenuItemModal({
    isOpen,
    onClose,
    cafeId,
    cafeName,
    mode = "add",
    existingItem,
}: SuggestMenuItemModalProps) {
    const [name, setName] = useState(existingItem?.name || "")
    const [category, setCategory] = useState(existingItem?.category || "")
    const [price, setPrice] = useState(existingItem?.price?.toString() || "")
    const [description, setDescription] = useState(existingItem?.description || "")
    const [isFood, setIsFood] = useState(false)
    const [isHot, setIsHot] = useState(false)
    const [isCold, setIsCold] = useState(false)
    const [calories, setCalories] = useState("")
    const [isVegan, setIsVegan] = useState(false)
    const [isVegetarian, setIsVegetarian] = useState(false)
    const [sizeOptions, setSizeOptions] = useState<Array<{ label: string; price: string }>>([])
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState(false)

    // Form implementation with fields:
    // - Name (required)
    // - Category dropdown from MENU_CATEGORIES (required)
    // - Price in PHP (required)
    // - Description (optional)
    // - Toggles: isFood, isHot, isCold, isVegan, isVegetarian
    // - Calories (optional number)
    // - Size options (add/remove rows of label + price)
    // - Notice: "Photo uploads are not available for community suggestions"

    // On submit: calls submitMenuItemSuggestion with stripped imageUrl
    // On success: shows success state, auto-closes after 2s
}
```

**Step 2: Write test for the modal**

Create `components/suggestions/__tests__/SuggestMenuItemModal.test.tsx`:

```ts
import { describe, expect, it } from "bun:test"

describe("SuggestMenuItemModal", () => {
    it("renders add mode with empty fields", () => {
        // Verify modal renders with empty form
    })
    it("renders edit mode with pre-filled fields", () => {
        // Verify modal pre-fills from existingItem
    })
    it("validates required fields on submit", () => {
        // Submit without name/category/price
        // Expect error message shown
    })
    it("strips imageUrl from submission data", () => {
        // Verify community submissions cannot include photos
    })
    it("submits and shows success state", () => {
        // Mock server action, verify success flow
    })
})
```

**Step 3: Commit**

```bash
git add components/suggestions/SuggestMenuItemModal.tsx components/suggestions/__tests__/
git commit -m "feat: add Suggest Menu Item modal for community contributions"
```

---

### Task 3.2: Add "Suggest Menu Item" button to cafe detail menu section

**Files:**
- Modify: `components/cafe/CafeDetails.tsx` (add button to menu section)
- Modify: `components/cafe/CafeMobileContent.tsx` (menu tab content)
- Create: `components/suggestions/SuggestMenuItemButton.tsx`

**Step 1: Create `SuggestMenuItemButton.tsx`**

```tsx
"use client"

import { useState } from "react"
import { useAuth } from "@/components/layout/AuthProvider"
import { SuggestMenuItemModal } from "./SuggestMenuItemModal"

interface SuggestMenuItemButtonProps {
    cafeId: string
    cafeName: string
    variant?: "default" | "compact"
}

// Renders a button that:
// - Checks auth (shows sign-in link if not logged in)
// - Opens SuggestMenuItemModal on click
// - Two variants: full button or compact icon button
```

**Step 2: Add button to menu sections in CafeDetails**

In the menu tab content area, add `<SuggestMenuItemButton>` at the bottom of the menu list.

**Step 3: Commit**

```bash
git add components/suggestions/SuggestMenuItemButton.tsx components/cafe/CafeDetails.tsx
git commit -m "feat: add Suggest Menu Item button to cafe detail page"
```

---

### Task 3.3: Add menu item step to Submit a Cafe form

**Files:**
- Modify: `components/submit/CafeSubmissionForm.tsx` (add step 4.5 or integrate into existing steps)

**Step 1: Add optional menu items step**

Insert a new step between "Hours" (step 4) and "Contact" (step 5) that allows submitters to optionally add initial menu items. This uses the same form fields as the Suggest Menu Item modal but embedded in the wizard.

Key difference from community suggestions: submitter CAN upload photos since they're the initial submitter.

**Step 2: Update submission logic**

In the submit action, if menu items were added during submission, insert them directly (not as suggestions) since this is a new cafe submission.

**Step 3: Run lint**

Run: `bun lint`

**Step 4: Commit**

```bash
git add components/submit/CafeSubmissionForm.tsx
git commit -m "feat: add optional menu items step to cafe submission form"
```

---

### Task 3.4: Add menu item suggestions to admin review queue

**Files:**
- Modify: `components/manage/CafesManagement.tsx` (add menu suggestions tab)
- Modify: `app/manage/cafes/page.tsx` (fetch menu suggestions)

**Step 1: Add "Menu Suggestions" tab to CafesManagement**

Add a new tab alongside existing tabs (Pending, Published, Suggestions, Claims, etc.) that shows pending menu item suggestions with:
- Cafe name
- Suggestion type (add/edit/remove)
- Item details preview
- Approve/Reject buttons

**Step 2: Fetch menu suggestions in page.tsx**

```ts
import { getPendingMenuItemSuggestions } from "@/app/api/actions/menu-suggestions"

// Add to parallel fetch:
const menuSuggestions = await getPendingMenuItemSuggestions()
```

**Step 3: Wire up approve/reject handlers**

Connect to `approveMenuItemSuggestion` and `rejectMenuItemSuggestion` server actions.

**Step 4: Run lint**

Run: `bun lint`

**Step 5: Commit**

```bash
git add components/manage/CafesManagement.tsx app/manage/cafes/page.tsx
git commit -m "feat: add menu item suggestions review queue to admin panel"
```

---

## Part 4: Menu Comparison Feature

### Task 4.1: Create menu comparison utility and types

**Files:**
- Create: `utils/types/menu-comparison.ts`
- Create: `utils/menu-comparison.ts`

**Step 1: Define comparison types**

```ts
// utils/types/menu-comparison.ts
import type { CafeMenuItem } from "./owner"

export interface ComparableMenuItem {
    id: string
    cafeId: string
    cafeName: string
    cafeSlug: string
    name: string
    category: string
    price: number
    description: string | null
    isAvailable: boolean
    isFood: boolean
    isHot: boolean
    isCold: boolean
    calories: number | null
    isVegan: boolean
    isVegetarian: boolean
    sizeOptions: Array<{ label: string; price: number }> | null
    imageUrl: string | null
}

export interface ComparisonResult {
    items: ComparableMenuItem[]
    priceRange: { min: number; max: number } | null
    avgPrice: number | null
}
```

**Step 2: Create comparison utility**

```ts
// utils/menu-comparison.ts
import { db } from "@/db"
import { cafeMenuItems, cafes } from "@/db/schema/tables"
import { eq, ilike, and } from "drizzle-orm"
import type { ComparableMenuItem, ComparisonResult } from "./types/menu-comparison"

export async function searchMenuItemsForComparison(
    query: string,
    limit: number = 20
): Promise<ComparableMenuItem[]> {
    const results = await db
        .select({
            id: cafeMenuItems.id,
            cafeId: cafeMenuItems.cafeId,
            cafeName: cafes.name,
            cafeSlug: cafes.slug,
            name: cafeMenuItems.name,
            category: cafeMenuItems.category,
            price: cafeMenuItems.price,
            description: cafeMenuItems.description,
            isAvailable: cafeMenuItems.isAvailable,
            isFood: cafeMenuItems.isFood,
            isHot: cafeMenuItems.isHot,
            isCold: cafeMenuItems.isCold,
            calories: cafeMenuItems.calories,
            isVegan: cafeMenuItems.isVegan,
            isVegetarian: cafeMenuItems.isVegetarian,
            sizeOptions: cafeMenuItems.sizeOptions,
            imageUrl: cafeMenuItems.imageUrl,
        })
        .from(cafeMenuItems)
        .innerJoin(cafes, eq(cafeMenuItems.cafeId, cafes.id))
        .where(
            and(
                ilike(cafeMenuItems.name, `%${query}%`),
                eq(cafeMenuItems.isAvailable, true),
                eq(cafes.isPublished, true)
            )
        )
        .limit(limit)

    return results.map(r => ({
        ...r,
        sizeOptions: r.sizeOptions as Array<{ label: string; price: number }> | null,
    }))
}

export async function getMenuItemsByCafeSlug(
    slug: string,
    category?: string
): Promise<ComparableMenuItem[]> {
    const conditions = [
        eq(cafes.slug, slug),
        eq(cafeMenuItems.isAvailable, true),
        eq(cafes.isPublished, true),
    ]
    if (category) {
        conditions.push(eq(cafeMenuItems.category, category))
    }

    const results = await db
        .select({
            id: cafeMenuItems.id,
            cafeId: cafeMenuItems.cafeId,
            cafeName: cafes.name,
            cafeSlug: cafes.slug,
            name: cafeMenuItems.name,
            category: cafeMenuItems.category,
            price: cafeMenuItems.price,
            description: cafeMenuItems.description,
            isAvailable: cafeMenuItems.isAvailable,
            isFood: cafeMenuItems.isFood,
            isHot: cafeMenuItems.isHot,
            isCold: cafeMenuItems.isCold,
            calories: cafeMenuItems.calories,
            isVegan: cafeMenuItems.isVegan,
            isVegetarian: cafeMenuItems.isVegetarian,
            sizeOptions: cafeMenuItems.sizeOptions,
            imageUrl: cafeMenuItems.imageUrl,
        })
        .from(cafeMenuItems)
        .innerJoin(cafes, eq(cafeMenuItems.cafeId, cafes.id))
        .where(and(...conditions))
        .orderBy(cafeMenuItems.sortOrder)

    return results.map(r => ({
        ...r,
        sizeOptions: r.sizeOptions as Array<{ label: string; price: number }> | null,
    }))
}

export function buildComparison(items: ComparableMenuItem[]): ComparisonResult {
    if (items.length === 0) {
        return { items: [], priceRange: null, avgPrice: null }
    }
    const prices = items.map(i => i.price)
    return {
        items,
        priceRange: { min: Math.min(...prices), max: Math.max(...prices) },
        avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
    }
}
```

**Step 3: Write tests**

Create `utils/__tests__/menu-comparison.test.ts`:

```ts
import { describe, expect, it } from "bun:test"
import { buildComparison } from "@/utils/menu-comparison"

describe("buildComparison", () => {
    it("returns empty result for no items", () => {
        const result = buildComparison([])
        expect(result.priceRange).toBeNull()
        expect(result.avgPrice).toBeNull()
    })
    it("calculates price range and average", () => {
        const items = [
            { price: 100 } as any,
            { price: 200 } as any,
            { price: 300 } as any,
        ]
        const result = buildComparison(items)
        expect(result.priceRange).toEqual({ min: 100, max: 300 })
        expect(result.avgPrice).toBe(200)
    })
})
```

**Step 4: Commit**

```bash
git add utils/types/menu-comparison.ts utils/menu-comparison.ts utils/__tests__/menu-comparison.test.ts
git commit -m "feat: add menu comparison types and utilities"
```

---

### Task 4.2: Add AI chat tools for menu comparison

**Files:**
- Modify: `utils/ai/tool-definitions.ts` (add search_menu_items and compare_menu_items tools)
- Modify: `utils/ai/tool-executor.ts` (add handlers)

**Step 1: Add tool definitions to `CHAT_TOOLS` array**

```ts
{
    name: "search_menu_items",
    description: "Search for menu items across all cafes by name. Use when the user wants to find specific drinks or food items.",
    parameters: {
        type: "object",
        properties: {
            query: { type: "string", description: "Search query for menu item name (e.g., 'spanish latte', 'croissant')" },
            limit: { type: "number", description: "Max results (default 10, max 20)" },
        },
        required: ["query"],
    },
},
{
    name: "compare_menu_items",
    description: "Compare specific menu items side by side. Use when user asks to compare items from different cafes.",
    parameters: {
        type: "object",
        properties: {
            itemIds: { type: "array", items: { type: "string" }, description: "Array of menu item IDs to compare (2-4 items)" },
        },
        required: ["itemIds"],
    },
},
```

**Step 2: Add handlers in `utils/ai/tool-executor.ts`**

```ts
case "search_menu_items": {
    const { searchMenuItemsForComparison } = await import("@/utils/menu-comparison")
    return searchMenuItemsForComparison(args.query, args.limit || 10)
}
case "compare_menu_items": {
    const { buildComparison } = await import("@/utils/menu-comparison")
    const { db } = await import("@/db")
    const { cafeMenuItems, cafes } = await import("@/db/schema/tables")
    const { inArray, eq } = await import("drizzle-orm")
    const items = await db
        .select({ /* all fields */ })
        .from(cafeMenuItems)
        .innerJoin(cafes, eq(cafeMenuItems.cafeId, cafes.id))
        .where(inArray(cafeMenuItems.id, args.itemIds))
    return buildComparison(items)
}
```

**Step 3: Update system prompt**

Add to `CHAT_SYSTEM_PROMPT` in `tool-definitions.ts`:

```
- Use search_menu_items when users ask about specific drinks or food items across cafes
- Use compare_menu_items to show side-by-side comparisons of specific items
- When comparing items, present results in a clear markdown table format
```

**Step 4: Commit**

```bash
git add utils/ai/tool-definitions.ts utils/ai/tool-executor.ts
git commit -m "feat: add menu search and comparison AI chat tools"
```

---

### Task 4.3: Build side-by-side comparison modal UI

**Files:**
- Create: `components/menu/MenuComparisonModal.tsx`
- Create: `components/menu/MenuComparisonSearch.tsx`
- Create: `components/menu/ComparisonTable.tsx`

**Step 1: Create `MenuComparisonSearch.tsx`**

A search input component that:
- Debounced search (300ms) using `searchMenuItemsForComparison` server action
- Shows results as a dropdown list with cafe name, item name, price
- Click to add item to comparison (max 4 items)
- Shows selected items as removable chips

**Step 2: Create `ComparisonTable.tsx`**

A table component that displays compared items:

| Property | Item 1 | Item 2 | Item 3 | Item 4 |
|----------|--------|--------|--------|--------|
| Cafe | ... | ... | ... | ... |
| Name | ... | ... | ... | ... |
| Price | ... | ... | ... | ... |
| Category | ... | ... | ... | ... |
| Type | Food/Drink | ... | ... | ... |
| Calories | ... | ... | ... | ... |
| Hot/Cold | ... | ... | ... | ... |
| Dietary | ... | ... | ... | ... |
| Sizes | ... | ... | ... | ... |
| Available | ✓/✗ | ... | ... | ... |

**Step 3: Create `MenuComparisonModal.tsx`**

Combines search + table in a modal:
- Triggered from "Compare" button on menu pages
- Or from AI chat results
- Shareable (encode item IDs in URL params)

**Step 4: Write tests**

Create `components/menu/__tests__/ComparisonTable.test.tsx`

**Step 5: Commit**

```bash
git add components/menu/MenuComparisonModal.tsx components/menu/MenuComparisonSearch.tsx components/menu/ComparisonTable.tsx components/menu/__tests__/
git commit -m "feat: add side-by-side menu comparison modal UI"
```

---

### Task 4.4: Add "Compare" button to menu pages

**Files:**
- Modify: `components/menu/MenuContent.tsx` (add compare button)
- Modify: `components/cafe/CafeDetails.tsx` (add compare to menu tab)

**Step 1: Add compare button to MenuContent**

Add a "Compare Items" button at the top of the menu page that opens `MenuComparisonModal`.

**Step 2: Add compare action to individual menu items**

Add a small "compare" icon on each menu item card that adds it to the comparison list.

**Step 3: Commit**

```bash
git add components/menu/MenuContent.tsx components/cafe/CafeDetails.tsx
git commit -m "feat: add compare buttons to menu item displays"
```

---

## Part 5: Global Search - Menu Items

### Task 5.1: Add menu items to global search

**Files:**
- Modify: `app/api/actions/search.ts` (add searchMenuItems function)
- Modify: `utils/types/search.ts` (add 'menu-item' type)
- Modify: `components/search/SearchResults.tsx` (render menu item results)
- Modify: `components/search/search-utils.ts` (add menu items to Fuse index)

**Step 1: Add `searchMenuItems` function to `app/api/actions/search.ts`**

```ts
async function searchMenuItems(query: string): Promise<SearchResult[]> {
    if (!query || query.length < 2) return []

    const items = await db
        .select({
            id: cafeMenuItems.id,
            name: cafeMenuItems.name,
            category: cafeMenuItems.category,
            price: cafeMenuItems.price,
            cafeName: cafes.name,
            cafeSlug: cafes.slug,
        })
        .from(cafeMenuItems)
        .innerJoin(cafes, eq(cafeMenuItems.cafeId, cafes.id))
        .where(
            and(
                ilike(cafeMenuItems.name, `%${query}%`),
                eq(cafeMenuItems.isAvailable, true),
                eq(cafes.isPublished, true)
            )
        )
        .limit(3) // Cap at 3 to not overwhelm results

    return items.map(item => ({
        id: item.id,
        type: "menu-item" as const,
        title: item.name,
        subtitle: `${item.cafeName} · ${item.category} · ₱${item.price.toFixed(2)}`,
        href: `/cafes/${item.cafeSlug}/menu`,
        priority: 6, // Below cafes, above static pages
        keywords: [item.name, item.category, item.cafeName],
    }))
}
```

**Step 2: Include in `globalSearch` parallel fetch**

Add `searchMenuItems(query)` to the `Promise.all()` in `globalSearch()`.

**Step 3: Add `'menu-item'` to `SearchResultType`**

In `utils/types/search.ts`:
```ts
export type SearchResultType = 'page' | 'cafe' | 'user' | 'action' | 'blog' | 'crawl' | 'collection' | 'event' | 'chat' | 'menu-item'
```

**Step 4: Add icon for menu items in search results**

In `SearchResults.tsx`, add a case for `'menu-item'` type with a coffee/food icon.

**Step 5: Write test**

Create `app/api/actions/__tests__/search-menu.test.ts`:

```ts
import { describe, expect, it } from "bun:test"

describe("searchMenuItems", () => {
    it("returns empty for short queries", async () => {
        // query length < 2 should return []
    })
    it("returns max 3 menu item results", async () => {
        // verify limit of 3
    })
    it("filters by isAvailable and isPublished", async () => {
        // verify only available items from published cafes
    })
    it("includes cafe name and price in subtitle", async () => {
        // verify subtitle format
    })
})
```

**Step 6: Run tests**

Run: `bun test app/api/actions/__tests__/search-menu.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add app/api/actions/search.ts utils/types/search.ts components/search/SearchResults.tsx components/search/search-utils.ts app/api/actions/__tests__/search-menu.test.ts
git commit -m "feat: add menu items to global search with dedicated section"
```

---

### Task 5.2: Add `#` prefix shortcut for menu search

**Files:**
- Modify: `app/api/actions/search.ts` (handle `#` prefix)
- Modify: `utils/search-index.ts` (add to quick actions help text)

**Step 1: Add `#` prefix handling in `globalSearch()`**

```ts
if (query.startsWith("#")) {
    const menuQuery = query.slice(1).trim()
    if (menuQuery.length >= 2) {
        const menuResults = await searchMenuItems(menuQuery)
        // Return only menu items, increased limit
        return menuResults.map(r => ({ ...r, priority: 1 }))
    }
    return []
}
```

**Step 2: Update quick action help text**

In `utils/search-index.ts`, update `quickActionHelp`:
```ts
export const quickActionHelp = "> for quick actions, @ for users, # for menu items, ? for AI"
```

**Step 3: Add suggested menu search to empty state**

Add "Search menu: #spanish latte" to `emptyStateSuggestions`.

**Step 4: Commit**

```bash
git add app/api/actions/search.ts utils/search-index.ts
git commit -m "feat: add # prefix shortcut for menu item search"
```

---

## Part 6: AI Chat Expansion

### Task 6.1: Increase chat limit to 30 messages

**Files:**
- Modify: `utils/chat-rate-limit.ts:5`

**Step 1: Update `MAX_USAGE`**

Change from `10` to `30`:
```ts
const MAX_USAGE = process.env.NODE_ENV === "production" ? 30 : Infinity
```

**Step 2: Update remaining messages badge threshold**

In `components/chat/ChatWidget.tsx`, update the badge to show when `< 30` (currently shows when `< 10`):

```ts
// Change threshold from 10 to 30
{currentRemaining < 30 && currentRemaining > 0 && (
    <span>{currentRemaining}</span>
)}
```

**Step 3: Commit**

```bash
git add utils/chat-rate-limit.ts components/chat/ChatWidget.tsx
git commit -m "feat: increase AI chat limit to 30 messages per session"
```

---

### Task 6.2: Implement persistent chat history storage

**Files:**
- Create: `app/api/actions/chat-history.ts`
- Modify: `app/api/chat/stream/route.ts` (save messages to DB)
- Modify: `utils/ai/chat-stream.ts` (track conversation ID)

**Step 1: Create chat history server actions**

```ts
// app/api/actions/chat-history.ts
"use server"

import { db } from "@/db"
import { chatConversations, chatMessages } from "@/db/schema/tables"
import { getCurrentUser } from "@/lib/auth"
import { eq } from "drizzle-orm"

export async function createConversation(sessionId: string): Promise<string> {
    const user = await getCurrentUser()
    const [conv] = await db
        .insert(chatConversations)
        .values({ sessionId, userId: user?.id || null })
        .returning({ id: chatConversations.id })
    return conv.id
}

export async function saveMessage(
    conversationId: string,
    role: string,
    content: string | null,
    toolCalls?: any,
    toolCallId?: string
): Promise<void> {
    await db.insert(chatMessages).values({
        conversationId,
        role,
        content,
        toolCalls: toolCalls || null,
        toolCallId: toolCallId || null,
    })
}

export async function endConversation(conversationId: string): Promise<void> {
    await db
        .update(chatConversations)
        .set({ endedAt: new Date() })
        .where(eq(chatConversations.id, conversationId))
}
```

**Step 2: Integrate into chat stream route**

In `app/api/chat/stream/route.ts`:
- Before streaming: call `createConversation(sessionId)` to get conversationId
- Pass conversationId through the stream handler
- After each message chunk (user + assistant): call `saveMessage()`
- After stream completes: call `endConversation()`

**Step 3: Pass conversation ID through chat-stream.ts**

Update `runChatStream()` to accept and use `conversationId` for saving each message turn.

**Step 4: Write test**

Create `app/api/actions/__tests__/chat-history.test.ts`

**Step 5: Commit**

```bash
git add app/api/actions/chat-history.ts app/api/chat/stream/route.ts utils/ai/chat-stream.ts app/api/actions/__tests__/chat-history.test.ts
git commit -m "feat: implement persistent chat history storage in database"
```

---

### Task 6.3: Implement chat feedback with DB persistence

**Files:**
- Modify: `app/api/actions/chat-feedback.ts` (replace console.log with DB insert)
- Modify: `components/chat/ChatMessage.tsx` (update feedback UI)

**Step 1: Update `chat-feedback.ts` to persist to DB**

Replace the current `console.log` implementation:

```ts
"use server"

import { db } from "@/db"
import { chatFeedback } from "@/db/schema/tables"
import { getCurrentUser } from "@/lib/auth"

export async function submitChatFeedback(
    messageId: string,
    sessionId: string,
    rating: 1 | -1,
    comment?: string
) {
    const user = await getCurrentUser()

    try {
        await db.insert(chatFeedback).values({
            messageId,
            sessionId,
            userId: user?.id || null,
            rating,
            comment: comment || null,
        })
        return { success: true }
    } catch (error) {
        console.error("Failed to save chat feedback:", error)
        return { error: "Failed to save feedback" }
    }
}
```

**Step 2: Update ChatMessage feedback UI**

- Track feedback state (none / up / down) per message
- On thumbs up: call `submitChatFeedback(messageId, sessionId, 1)`
- On thumbs down: call `submitChatFeedback(messageId, sessionId, -1)`
- Visual feedback: filled vs outline icons, subtle animation
- Prevent duplicate feedback on same message

**Step 3: Write test**

Create `app/api/actions/__tests__/chat-feedback-db.test.ts`

**Step 4: Commit**

```bash
git add app/api/actions/chat-feedback.ts components/chat/ChatMessage.tsx app/api/actions/__tests__/chat-feedback-db.test.ts
git commit -m "feat: persist chat feedback to database with thumbs up/down"
```

---

### Task 6.4: Add AI chat disclaimer and privacy notice

**Files:**
- Modify: `components/chat/ChatWindow.tsx` (add disclaimer)

**Step 1: Add disclaimer to chat window**

Add a small disclaimer text at the bottom of the chat window, above the input:

```tsx
<p className="text-[10px] text-muted-foreground text-center px-4 pb-1">
    Conversations are stored to improve our AI. By chatting, you agree to our{" "}
    <a href="/legal/privacy" target="_blank" className="underline hover:text-foreground">
        Privacy Policy
    </a>.
</p>
```

Show this only on first interaction or in the welcome state, not permanently to avoid clutter.

**Step 2: Add welcome message disclaimer**

In the welcome/suggested prompts area, add a subtle notice:

```tsx
<div className="text-xs text-muted-foreground/60 text-center mt-2">
    AI responses may not always be accurate. Menu data is community-contributed.
</div>
```

**Step 3: Commit**

```bash
git add components/chat/ChatWindow.tsx
git commit -m "feat: add privacy disclaimer and AI accuracy notice to chat window"
```

---

## Part 7: Menu UI Updates and Management

### Task 7.1: Update MenuItemModal with new metadata fields

**Files:**
- Modify: `components/cafe-editor/MenuItemModal.tsx` (add new fields)

**Step 1: Add new form fields to MenuItemModal**

Add after existing fields (name, category, price, description, is_signature, is_available):

- **Type toggles row**: isFood, isHot, isCold (as pill/toggle buttons)
- **Dietary row**: isVegan, isVegetarian (toggle buttons)
- **Calories**: number input (optional)
- **Size Options**: dynamic list of {label, price} rows with add/remove

**Step 2: Update the save handler to include new fields**

Pass all new fields to `addMenuItem` / `updateMenuItem` server actions.

**Step 3: Update owner actions to handle new fields**

In `app/api/actions/owner.ts`, update `addMenuItem` and `updateMenuItem` to accept and persist the new metadata fields.

**Step 4: Run lint**

Run: `bun lint`

**Step 5: Commit**

```bash
git add components/cafe-editor/MenuItemModal.tsx app/api/actions/owner.ts
git commit -m "feat: update MenuItemModal with new metadata fields"
```

---

### Task 7.2: Update menu rendering with new metadata

**Files:**
- Modify: `components/menu/MenuContent.tsx` (show new fields)
- Modify: `app/cafes/[slug]/menu/page.tsx` (fetch new fields)

**Step 1: Update menu item cards to show metadata badges**

On each menu item card, show small badges/icons for:
- Food item badge (if is_food)
- Hot/Cold indicator (if is_hot/is_cold)
- Vegan/Vegetarian badge
- Calories display (if set)
- Community submitted indicator (small globe icon)
- Size options display (if set, show "S: ₱120 | M: ₱140 | L: ₱160")

**Step 2: Add filter/tabs to menu page**

Add quick filter pills at the top of the menu page:
- All | Coffee | Food | Cold | Hot | Vegan

**Step 3: Show "last updated by community" indicator**

If an item has `community_submitted: true`, show a subtle "Community contributed" badge.

**Step 4: Commit**

```bash
git add components/menu/MenuContent.tsx app/cafes/[slug]/menu/page.tsx
git commit -m "feat: update menu rendering with new metadata badges and filters"
```

---

### Task 7.3: Update manage cafe menu for owners

**Files:**
- Modify: `components/cafe-editor/MenuSection.tsx` (show new fields, community submissions)
- Modify: `components/owner/CafeManagement.tsx` (integration)

**Step 1: Show community-submitted items with indicator**

In MenuSection, if an item has `community_submitted: true`, show a "Community" badge next to it.

**Step 2: Add pending community suggestions count**

Show a badge/notice: "3 community menu suggestions pending review" linking to the review interface.

**Step 3: Update MenuSection filters**

Add filters matching the public menu page: All, Coffee, Food, etc.

**Step 4: Commit**

```bash
git add components/cafe-editor/MenuSection.tsx components/owner/CafeManagement.tsx
git commit -m "feat: update owner menu management with community contribution indicators"
```

---

## Part 8: Legal Updates

### Task 8.1: Update Privacy Policy for AI chat data

**Files:**
- Modify: `app/legal/privacy/page.tsx`

**Step 1: Add AI Chat section**

Add a new section after the existing "Third-Party Services" section:

```tsx
<h2>AI Chat Feature</h2>
<p>
    Our platform includes an AI-powered chat assistant to help you discover cafes
    and menu items. When you use the chat feature:
</p>
<ul>
    <li>Your messages and conversation history are stored to improve our services
        and may be used for AI model training and fine-tuning in the future.</li>
    <li>We store chat sessions linked to your account (if logged in) or anonymously
        via session identifiers.</li>
    <li>Your feedback on AI responses (thumbs up/down) is recorded to assess
        response quality.</li>
    <li>Chat data is processed through third-party AI providers (OpenAI-compatible
        APIs). Refer to their privacy policies for data handling practices.</li>
    <li>We do not sell or share your chat data with third parties for marketing
        purposes.</li>
</ul>
```

**Step 2: Update "Information We Collect" section**

Add to the data collection list:
- AI chat messages and conversation history
- Chat session identifiers
- AI response feedback ratings

**Step 3: Update "Last Updated" date**

Change from "January 5, 2026" to the current date.

**Step 4: Commit**

```bash
git add app/legal/privacy/page.tsx
git commit -m "docs: update privacy policy to reflect AI chat data collection"
```

---

### Task 8.2: Update Terms of Service if needed

**Files:**
- Modify: `app/legal/terms/page.tsx` (if needed)

**Step 1: Review Terms of Service for AI-related clauses**

Check if user-generated content terms cover:
- Community menu contributions
- AI-generated content disclaimers
- Training data usage consent

**Step 2: Add clauses if missing**

Add section covering:
- Community contributions (menu items, edits) become part of the platform's data
- AI responses are generated and may contain inaccuracies
- Users consent to conversation data being used for service improvement

**Step 3: Commit**

```bash
git add app/legal/terms/page.tsx
git commit -m "docs: update terms of service for community contributions and AI features"
```

---

## Part 9: Version Bump

### Task 9.1: Bump version to 2027.0.0

**Files:**
- Modify: `package.json:3`

**Step 1: Update version**

```json
"version": "2027.0.0",
```

**Step 2: Commit**

```bash
git add package.json
git commit -m "chore: bump version to 2027.0.0"
```

---

## Part 10: Integration and Final Verification

### Task 10.1: End-to-end integration test

**Step 1: Test menu item suggestion flow**

1. Log in as a regular user
2. Navigate to a cafe detail page
3. Click "Suggest Menu Item" on the menu tab
4. Fill in all fields including new metadata
5. Submit suggestion
6. Verify it appears in admin panel under "Menu Suggestions"
7. Approve the suggestion
8. Verify item appears on the cafe menu page with correct metadata

**Step 2: Test price level auto-calculation**

1. Add 5+ menu items to a cafe (via admin or owner)
2. Verify price level updates based on average price
3. Remove items to drop below 5
4. Verify manual price level is preserved

**Step 3: Test menu comparison**

1. Open a cafe menu page
2. Click "Compare Items" button
3. Search for items to compare
4. Add 2-4 items to comparison
5. Verify comparison table renders correctly

**Step 4: Test global search with menu items**

1. Open global search (Cmd+K)
2. Type a menu item name (e.g., "latte")
3. Verify menu item results appear in dedicated section
4. Type `#spanish latte`
5. Verify filtered menu-only results

**Step 5: Test AI chat menu tools**

1. Open AI chat
2. Ask "What coffees does [cafe] have?"
3. Verify get_cafe_menu tool is called
4. Ask "Compare spanish lattes near me"
5. Verify search_menu_items tool is called
6. Ask "Compare Starbucks Americano with Zeus Americano"
6. Verify compare flow works

**Step 6: Test chat history persistence**

1. Have a conversation with the AI chat
2. Give a thumbs up on a response
3. Check database for chat_conversations, chat_messages, chat_feedback records

**Step 7: Test chat limit increase**

1. Verify the chat widget shows 30 remaining messages
2. Send a message and verify count decreases

**Step 8: Run full test suite**

Run: `bun test`
Expected: All tests pass

**Step 9: Run lint**

Run: `bun lint`
Expected: No errors

**Step 10: Build check**

Run: `bun build`
Expected: Build succeeds

**Step 11: Final commit**

```bash
git add -A
git commit -m "feat: complete cafe menu overhaul - v2027.0.0"
```

---

## Summary of All New Files

| File | Purpose |
|------|---------|
| `db/schema/chat.ts` | Chat history and feedback tables |
| `db/schema/menu-suggestions.ts` | Menu item community suggestions table |
| `utils/price-level.ts` | Price level calculation utility |
| `utils/menu-comparison.ts` | Menu comparison search and builder |
| `utils/types/menu-comparison.ts` | Comparison types |
| `app/api/actions/price-level.ts` | Price level recalculation action |
| `app/api/actions/menu-suggestions.ts` | Menu suggestion CRUD actions |
| `app/api/actions/chat-history.ts` | Chat history persistence actions |
| `components/suggestions/SuggestMenuItemModal.tsx` | Community menu item suggestion form |
| `components/suggestions/SuggestMenuItemButton.tsx` | Trigger button for suggestion modal |
| `components/menu/MenuComparisonModal.tsx` | Side-by-side comparison modal |
| `components/menu/MenuComparisonSearch.tsx` | Search input for comparison |
| `components/menu/ComparisonTable.tsx` | Comparison table display |

## Summary of Modified Files

| File | Changes |
|------|---------|
| `db/schema/tables.ts` | Expanded cafeMenuItems columns, added exports |
| `db/schema/enums.ts` | 4-tier price level enum |
| `db/schema/index.ts` | New exports |
| `utils/types/owner.ts` | Updated CafeMenuItem type |
| `utils/types/search.ts` | Added 'menu-item' search type |
| `utils/hooks/cafe-form.ts` | Updated PRICE_LEVELS constant |
| `utils/extras.ts` | Updated getPriceLevel helper |
| `utils/chat-rate-limit.ts` | MAX_USAGE 10 → 30 |
| `utils/search-index.ts` | Added # prefix help text |
| `utils/ai/tool-definitions.ts` | Added search_menu_items, compare_menu_items tools |
| `utils/ai/tool-executor.ts` | Added tool handlers |
| `utils/ai/chat-stream.ts` | Conversation ID tracking |
| `app/api/chat/stream/route.ts` | Chat history persistence |
| `app/api/actions/search.ts` | Added menu item search |
| `app/api/actions/owner.ts` | Updated menu CRUD with new fields |
| `app/api/actions/chat-feedback.ts` | DB persistence instead of console.log |
| `app/legal/privacy/page.tsx` | AI chat data section |
| `app/legal/terms/page.tsx` | Community/AI clauses |
| `app/cafes/[slug]/menu/page.tsx` | Fetch new fields |
| `components/cafe/CafeDetails.tsx` | Suggest Menu Item button |
| `components/cafe/CafeMobileContent.tsx` | Menu tab button |
| `components/menu/MenuContent.tsx` | Metadata badges, filters, compare |
| `components/cafe-editor/MenuItemModal.tsx` | New metadata fields |
| `components/cafe-editor/MenuSection.tsx` | Community indicators |
| `components/manage/CafesManagement.tsx` | Menu suggestions tab |
| `components/owner/CafeManagement.tsx` | Integration |
| `components/submit/CafeSubmissionForm.tsx` | Menu items step |
| `components/suggestions/SuggestEditModal.tsx` | No changes (separate flow) |
| `components/chat/ChatWidget.tsx` | Badge threshold update |
| `components/chat/ChatWindow.tsx` | Disclaimer, privacy notice |
| `components/chat/ChatMessage.tsx` | Feedback DB integration |
| `components/search/SearchResults.tsx` | Menu item result rendering |
| `components/search/search-utils.ts` | Menu items in Fuse index |
| `package.json` | Version 2027.0.0 |
