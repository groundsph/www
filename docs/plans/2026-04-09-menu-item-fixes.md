# Menu Item Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix missing `revalidatePath()` calls in owner menu CRUD actions and add `is_signature` support to community menu item suggestions.

**Architecture:** Two targeted fixes: (1) Add `revalidatePath()` to `addMenuItem`, `updateMenuItem`, and `deleteMenuItem` server actions in `owner.ts` to invalidate public page caches after menu changes. (2) Add `is_signature` toggle to the community suggestion flow across `MenuItemSuggestionData`, `MenuItemFormFields`, `SuggestMenuItemModal`, and the approval handler.

**Tech Stack:** Next.js App Router, Drizzle ORM, React, TypeScript

---

## Background

### Current State
- Admin (`/manage`) and owner (`/owner`) routes already share identical menu editing UI/metadata via shared `useMenuItems` hook, `MenuSection`, and `MenuItemModal` components.
- Both support: name, category, price, description, image, availability, signature, food/hot/cold, vegan/vegetarian, calories, size options.

### Gaps Found
1. **Missing `revalidatePath()`** in `addMenuItem`, `updateMenuItem`, `deleteMenuItem` (owner.ts lines 936-1172). The OCR save function (`saveOcrMenuItems` in menu-ocr.ts) correctly calls `revalidatePath()`, but the CRUD actions do not. This causes stale data on public pages (`/cafes/[slug]/menu`) after owner edits.
2. **Missing `is_signature`** in community suggestions. The `MenuItemSuggestionData` interface, `MenuItemFormFields`, `SuggestMenuItemModal`, and `approveMenuItemSuggestion` all lack the `is_signature` field, preventing community users from suggesting items as signature items.

### No Changes Needed
- Admin and owner UI parity is already correct (same components).
- Public route (`/cafes/[slug]/menu`) is intentionally read-only with suggestion-based edits.

---

## Task 1: Fix missing `revalidatePath()` in owner menu CRUD actions

**Files:**
- Modify: `app/api/actions/owner.ts:1014-1016` (addMenuItem)
- Modify: `app/api/actions/owner.ts:1112-1114` (updateMenuItem)
- Modify: `app/api/actions/owner.ts:1164-1166` (deleteMenuItem)

**Step 1: Add `revalidatePath()` to `addMenuItem`**

In `app/api/actions/owner.ts`, after the `recalculatePriceLevel` call in `addMenuItem` (around line 1014), add:

```ts
revalidatePath(`/cafes/[slug]/menu`)
revalidatePath(`/owner/cafes/[cafeSlug]/edit`)
```

But we need the cafe slug. We need to fetch the cafe slug from the cafe ID. Let's fetch it at the start of the function after the permission check.

Actually, looking at the existing code, the function already has the `cafeId`. We need the slug for the path revalidation. Let's use a pattern similar to what's done in the OCR save function:

```ts
// After recalculatePriceLevel in addMenuItem:
revalidatePath(`/cafes/[slug]/menu`)
revalidatePath(`/owner/cafes/[slug]/edit`)
```

Wait, Next.js `revalidatePath` with dynamic segments uses the literal path pattern. Let's check the existing patterns used in the codebase.

From the grep results:
- `revalidatePath(`/cafes/[slug]`, 'page')` - used in owner.ts for other functions
- `revalidatePath(`/cafes/`)` - used in menu-suggestions.ts

The correct pattern for Next.js App Router is to use the literal segment pattern. So we should use:

```ts
revalidatePath("/cafes/[slug]/menu", "page")
revalidatePath("/owner/cafes/[slug]/edit", "page")
```

**Step 2: Verify the fix**

Run: `bun lint`
Expected: No errors.

**Step 3: Commit**

```bash
git add app/api/actions/owner.ts
git commit -m "fix: add revalidatePath to owner menu CRUD actions"
```

---

## Task 2: Add `is_signature` to community suggestion type

**Files:**
- Modify: `app/api/actions/menu-suggestions.ts:9-21` (MenuItemSuggestionData interface)

**Step 1: Add `is_signature` field to `MenuItemSuggestionData`**

Add `is_signature?: boolean` to the interface:

```ts
export interface MenuItemSuggestionData {
    name: string
    description?: string
    category: string
    price: number
    is_food?: boolean
    is_hot?: boolean
    is_cold?: boolean
    is_signature?: boolean  // <-- add this
    calories?: number | null
    is_vegan?: boolean
    is_vegetarian?: boolean
    size_options?: Array<{ label: string; price: number }> | null
}
```

**Step 2: Add `is_signature` to `approveMenuItemSuggestion` handler**

In the `approveMenuItemSuggestion` function (line 128), the `add` case (line 145) and `edit` case (line 162) need to include `isSignature`:

For the `add` case (line 146-161), add `isSignature: data.is_signature || false,` to the insert values.

For the `edit` case (line 163-179), add `isSignature: data.is_signature,` to the update set.

**Step 3: Verify**

Run: `bun lint`
Expected: No errors.

**Step 4: Commit**

```bash
git add app/api/actions/menu-suggestions.ts
git commit -m "feat: add is_signature to community menu item suggestions"
```

---

## Task 3: Add `isSignature` toggle to `MenuItemFormFields`

**Files:**
- Modify: `components/suggestions/MenuItemFormFields.tsx:13-25` (MenuItemFormData interface)
- Modify: `components/suggestions/MenuItemFormFields.tsx:44-50` (typeToggles array)

**Step 1: Add `isSignature` to `MenuItemFormData` interface**

Add `isSignature: boolean` to the interface:

```ts
export interface MenuItemFormData {
    name: string
    category: string
    price: string
    description: string
    isFood: boolean
    isHot: boolean
    isCold: boolean
    isSignature: boolean  // <-- add this
    isVegan: boolean
    isVegetarian: boolean
    calories: string
    sizeOptions: SizeOption[]
}
```

**Step 2: Add "Signature" to the `typeToggles` array**

Add `{ key: "isSignature", label: "Signature" }` to the typeToggles array. Place it after `isCold`:

```ts
const typeToggles = [
    { key: "isFood", label: "Food" },
    { key: "isHot", label: "Hot" },
    { key: "isCold", label: "Cold" },
    { key: "isSignature", label: "Signature" },  // <-- add this
    { key: "isVegan", label: "Vegan" },
    { key: "isVegetarian", label: "Vegetarian" },
] as const
```

**Step 3: Verify**

Run: `bun lint`
Expected: No errors.

**Step 4: Commit**

```bash
git add components/suggestions/MenuItemFormFields.tsx
git commit -m "feat: add signature toggle to menu item form fields"
```

---

## Task 4: Add `isSignature` to `SuggestMenuItemModal`

**Files:**
- Modify: `components/suggestions/SuggestMenuItemModal.tsx:17-31` (existingItem prop type)
- Modify: `components/suggestions/SuggestMenuItemModal.tsx:46-56` (state variables)
- Modify: `components/suggestions/SuggestMenuItemModal.tsx:59-89` (reset effect)
- Modify: `components/suggestions/SuggestMenuItemModal.tsx:124-147` (handleSubmit data)
- Modify: `components/suggestions/SuggestMenuItemModal.tsx:224-252` (MenuItemFormFields data)

**Step 1: Add `is_signature` to `existingItem` prop type**

Add `is_signature?: boolean` to the existingItem interface (around line 17-31):

```ts
existingItem?: {
    id: string
    name: string
    category: string
    price: number
    description: string | null
    is_food?: boolean
    is_hot?: boolean
    is_cold?: boolean
    is_signature?: boolean  // <-- add this
    is_vegan?: boolean
    is_vegetarian?: boolean
    calories?: number | null
    size_options?: Array<{ label: string; price: number }> | null
}
```

**Step 2: Add `isSignature` state variable**

After `const [isCold, setIsCold] = useState(false)` (around line 53), add:

```ts
const [isSignature, setIsSignature] = useState(false)
```

**Step 3: Update reset effect to include `isSignature`**

In the reset effect (lines 59-89), add `setIsSignature` calls:

- In the `if (existingItem && mode === "edit")` block (around line 62):
  ```ts
  setIsSignature(existingItem.is_signature ?? false)
  ```
- In the `else` block (around line 74):
  ```ts
  setIsSignature(false)
  ```

**Step 4: Add `is_signature` to the submission data**

In `handleSubmit` (lines 124-147), add `is_signature: isSignature,` to the data object.

**Step 5: Pass `isSignature` to `MenuItemFormFields`**

In the `MenuItemFormFields` usage (lines 224-252):
- Add `isSignature,` to the `data` object
- Add `if (updates.isSignature !== undefined) setIsSignature(updates.isSignature)` to the `onChange` handler

**Step 6: Verify**

Run: `bun lint`
Expected: No errors.

**Step 5: Commit**

```bash
git add components/suggestions/SuggestMenuItemModal.tsx
git commit -m "feat: add signature toggle to suggest menu item modal"
```

---

## Task 5: Run lint and typecheck

**Step 1: Run linter**

Run: `bun lint`
Expected: No errors.

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: No type errors.

**Step 3: Verify no test failures**

Run: `bun test`
Expected: All tests pass.

---

## Summary of Changes

| File | Change |
|------|--------|
| `app/api/actions/owner.ts` | Add `revalidatePath()` to `addMenuItem`, `updateMenuItem`, `deleteMenuItem` |
| `app/api/actions/menu-suggestions.ts` | Add `is_signature` to `MenuItemSuggestionData` and `approveMenuItemSuggestion` |
| `components/suggestions/MenuItemFormFields.tsx` | Add `isSignature` to `MenuItemFormData` and `typeToggles` |
| `components/suggestions/SuggestMenuItemModal.tsx` | Add `isSignature` state and pass through to form/submit |
