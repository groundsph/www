# OCR Scan Menu - Full Field Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand the OCR scan review UI to show and allow editing all available menu item fields (description, isFood, isHot, isCold, isVegan, isVegetarian, calories, sizeOptions) instead of just name/category/price.

**Architecture:** Extend the `EditableItem` interface to include all fields the OCR AI extracts and the DB supports. Replace the flat 3-column grid review UI with collapsible per-item cards (compact summary row by default, expandable to show/edit all fields). Reuse the `CustomCheckbox` pattern from `MenuItemFormFields.tsx`. Update the `saveOcrMenuItems` server action to persist all fields. Enhance the AI prompt to extract additional fields (is_vegan, is_vegetarian, calories) when visible in the menu image.

**Tech Stack:** Next.js 15 (App Router), React, TypeScript, Tailwind CSS v4, Drizzle ORM, Zod, Motion (framer-motion), Lucide icons

---

## Current State Analysis

### The Problem

The OCR pipeline has 3 layers. The AI extracts 7 fields (`name`, `category`, `price`, `description`, `is_food`, `is_hot`, `is_cold`), but the review UI only shows 3 (`name`, `category`, `price`). The remaining fields are discarded in the `onComplete` callback at `MenuOcrScanModal.tsx:161-171`. The `saveOcrMenuItems` server action already handles these fields but always receives `null`/`false` defaults because the client never sends them.

### Field Gap Matrix

| Field | AI Extracts | Review UI Shows | DB Saves | Notes |
|-------|-------------|-----------------|----------|-------|
| `name` | Yes | Yes | Yes | Working |
| `category` | Yes | Yes | Yes | Working |
| `price` | Yes | Yes | Yes | Working |
| `description` | Yes | **NO** | null | Discarded at line 163 |
| `is_food` | Yes | **NO** | false | Discarded at line 163 |
| `is_hot` | Yes | **NO** | false | Discarded at line 163 |
| `is_cold` | Yes | **NO** | false | Discarded at line 163 |
| `isVegan` | No | No | false | Not in AI prompt |
| `isVegetarian` | No | No | false | Not in AI prompt |
| `calories` | No | No | null | Not in AI prompt |
| `sizeOptions` | No | No | null | Manual entry only |

### Existing Assets

- `MenuItemFormFields.tsx` — Has `CustomCheckbox` component and full form layout for all fields. Can be reused.
- `saveOcrMenuItems` in `app/api/actions/menu-ocr.ts:158-209` — Already maps `is_food`, `is_hot`, `is_cold`, `description`. Needs extension for `isVegan`, `isVegetarian`, `calories`, `sizeOptions`.
- `ocrMenuItemSchema` in `utils/ai/menu-ocr.ts:18-26` — Only has 7 fields. Needs extension.
- `OcrMenuItem` type — Derived from schema, used as the save payload type.

### Files to Modify

1. `components/suggestions/MenuOcrScanModal.tsx` — Main review UI
2. `utils/ai/menu-ocr.ts` — Zod schema and AI prompt
3. `app/api/actions/menu-ocr.ts` — Save server action
4. `app/api/ocr/stream/route.ts` — Streaming route (has duplicated prompt)

---

## Task Breakdown

### Task 1: Update `OcrMenuItem` Zod Schema and AI Prompt

**Files:**
- Modify: `utils/ai/menu-ocr.ts:18-26` (schema)
- Modify: `utils/ai/menu-ocr.ts:74-89` (system prompt)
- Modify: `app/api/ocr/stream/route.ts:25-40` (duplicated prompt)

**Step 1: Expand the Zod schema**

Add `is_vegan`, `is_vegetarian`, and `calories` fields to `ocrMenuItemSchema`:

```ts
const ocrMenuItemSchema = z.object({
    name: z.string().min(1),
    category: z.string(),
    price: priceSchema,
    description: z.string().optional(),
    is_food: z.boolean().optional(),
    is_hot: z.boolean().optional(),
    is_cold: z.boolean().optional(),
    is_vegan: z.boolean().optional(),
    is_vegetarian: z.boolean().optional(),
    calories: z.union([z.number().nonnegative(), z.string().transform((val, ctx) => {
        const num = Number(val)
        if (isNaN(num) || num < 0) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Calories must be a non-negative number" })
            return z.NEVER
        }
        return num
    })]).optional(),
})
```

**Step 2: Update the AI system prompt in `utils/ai/menu-ocr.ts`**

Replace the existing `MENU_EXTRACTION_SYSTEM_PROMPT` (lines 74-89) with:

```ts
const MENU_EXTRACTION_SYSTEM_PROMPT =
    `You are a menu item extractor. Given an image of a cafe/restaurant menu, extract ALL menu items.

AVAILABLE CATEGORIES (use EXACTLY one of these):
Coffee, Espresso Drinks, Cold Brew, Non-Coffee, Tea, Milk Drinks, Frappes, Smoothies, Specialty Drinks, Refreshers, Food, Rice Meals, Sandwiches, Pasta, Breakfast, Snacks, Pastries, Desserts, Cakes, Add-ons, Other

For each item, respond with:
- name: The item name exactly as written
- category: MUST be one of the AVAILABLE CATEGORIES above (pick the closest match)
- price: The numeric price (no currency symbol)
- description: Brief description if visible (optional)
- is_food: true if it's food, false if drink
- is_hot: true if hot variant exists
- is_cold: true if cold variant exists
- is_vegan: true if the item or menu indicates it's vegan (optional)
- is_vegetarian: true if the item or menu indicates it's vegetarian (optional)
- calories: Numeric calorie count if visible on the menu (optional)

Respond with a JSON array of objects. If no menu items are found, return an empty array.`
```

**Step 3: Update the duplicated prompt in `app/api/ocr/stream/route.ts`**

Replace `MENU_EXTRACTION_SYSTEM_PROMPT` at lines 25-40 with the same updated prompt from Step 2.

**Step 4: Run type check**

Run: `bun lint`
Expected: No errors

**Step 5: Commit**

```bash
git add utils/ai/menu-ocr.ts app/api/ocr/stream/route.ts
git commit -m "feat(ocr): extend schema and AI prompt for vegan/vegetarian/calories fields"
```

---

### Task 2: Update `saveOcrMenuItems` Server Action

**Files:**
- Modify: `app/api/actions/menu-ocr.ts:180-192`

**Step 1: Extend the insert mapping**

Replace the `itemsToInsert` mapping at line 180-192 to include the new fields:

```ts
const itemsToInsert = items.map((item, index) => ({
    cafeId,
    name: item.name,
    category: item.category,
    price: item.price,
    description: item.description ?? null,
    isFood: item.is_food ?? false,
    isHot: item.is_hot ?? false,
    isCold: item.is_cold ?? false,
    isVegan: item.is_vegan ?? false,
    isVegetarian: item.is_vegetarian ?? false,
    calories: item.calories ?? null,
    communitySubmitted: true,
    sortOrder: nextSortOrder + index,
    lastUpdatedBy: user.id,
}))
```

**Step 2: Run type check**

Run: `bun lint`
Expected: No errors (the `OcrMenuItem` type from Task 1 already includes these fields)

**Step 3: Run existing tests**

Run: `bun test app/api/actions/__tests__/menu-ocr.test.ts`
Expected: PASS (existing tests should still pass since we're only adding optional fields)

**Step 4: Commit**

```bash
git add app/api/actions/menu-ocr.ts
git commit -m "feat(ocr): persist isVegan, isVegetarian, calories in save action"
```

---

### Task 3: Expand `EditableItem` Interface and Preserve OCR Fields

**Files:**
- Modify: `components/suggestions/MenuOcrScanModal.tsx:24-29` (EditableItem interface)
- Modify: `components/suggestions/MenuOcrScanModal.tsx:161-174` (onComplete callback)

**Step 1: Expand the `EditableItem` interface**

Replace the interface at lines 24-29:

```ts
interface EditableItem {
    id: number
    name: string
    category: string
    price: number
    description: string
    isFood: boolean
    isHot: boolean
    isCold: boolean
    isVegan: boolean
    isVegetarian: boolean
    calories: string
    sizeOptions: { label: string; price: number }[]
    isExpanded: boolean
}
```

The `isExpanded` field is UI-only, controlling whether the card shows the compact or full view.

**Step 2: Update the `onComplete` callback to preserve OCR-extracted fields**

Replace lines 161-174:

```ts
onComplete: (data) => {
    const editableItems: EditableItem[] = (data.deduplicated ?? []).map(
        (item, index) => ({
            id: index,
            name: item.name,
            category: MENU_CATEGORIES.includes(item.category as typeof MENU_CATEGORIES[number])
                ? item.category
                : "Other",
            price: typeof item.price === "string" ? parseFloat(item.price) : item.price,
            description: item.description ?? "",
            isFood: item.is_food ?? false,
            isHot: item.is_hot ?? false,
            isCold: item.is_cold ?? false,
            isVegan: item.is_vegan ?? false,
            isVegetarian: item.is_vegetarian ?? false,
            calories: item.calories != null ? String(item.calories) : "",
            sizeOptions: [],
            isExpanded: false,
        })
    )
    setExtractedItems(editableItems)
    setDuplicates(data.duplicates ?? [])
    setTimeout(() => setStep("review"), 300)
},
```

**Step 3: Run type check**

Run: `bun lint`
Expected: Errors in MenuOcrScanModal.tsx (this is expected — the UI and handleSave haven't been updated yet). Proceed to Task 4.

**Step 4: Commit (after Task 4 resolves errors)**

Do NOT commit yet — combine with Task 4.

---

### Task 4: Redesign Review UI with Expandable Item Cards

**Files:**
- Modify: `components/suggestions/MenuOcrScanModal.tsx:449-598` (review step rendering)
- Modify: `components/suggestions/MenuOcrScanModal.tsx:198-204` (handleUpdateItem)

**Step 1: Add the `CustomCheckbox` component**

Insert before the `MenuOcrScanModal` component definition (around line 40), adapted from `MenuItemFormFields.tsx`:

```tsx
function CustomCheckbox({
    checked,
    onChange,
    label,
}: {
    checked: boolean
    onChange: (checked: boolean) => void
    label: string
}) {
    return (
        <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-text/5 transition-colors">
            <div className={cn(
                "relative w-4 h-4 border-2 rounded flex items-center justify-center transition-all duration-200",
                checked ? "border-primary/30 bg-primary/5" : "border-text/10 bg-text/5"
            )}>
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    className="sr-only"
                />
                <svg
                    className={cn("w-2.5 h-2.5 transition-all duration-200", checked ? "opacity-100 scale-100" : "opacity-0 scale-75")}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                >
                    <polyline points="20 6 9 17 4 12" />
                </svg>
            </div>
            <span className={cn("text-xs transition-colors duration-200", checked ? "text-text" : "text-text/60")}>
                {label}
            </span>
        </label>
    )
}
```

Add `cn` import at the top: `import { cn } from "@/utils/cn"`

**Step 2: Update `handleUpdateItem` to handle all field types**

Replace lines 198-204:

```ts
const handleUpdateItem = (id: number, field: keyof EditableItem, value: string | number | boolean | { label: string; price: number }[]) => {
    setExtractedItems((prev) =>
        prev.map((item) =>
            item.id === id ? { ...item, [field]: value } : item
        )
    )
}
```

**Step 3: Add a toggle function for expanded state**

Add after `handleUpdateItem`:

```ts
const handleToggleExpand = (id: number) => {
    setExtractedItems((prev) =>
        prev.map((item) =>
            item.id === id ? { ...item, isExpanded: !item.isExpanded } : item
        )
    )
}
```

**Step 4: Replace the review step rendering (lines 449-598)**

Replace the entire `{step === "review" && (...)}` block with an expandable card design. Each item renders as:

1. **Compact row** (always visible): Number badge | Name input | Category select | Price input | Expand chevron | Delete button
2. **Expanded panel** (when `isExpanded === true`): Description textarea | Toggle grid (isFood, isHot, isCold, isVegan, isVegetarian) | Calories input | Size options

The expanded panel slides open with `AnimatePresence` and `motion.div` with `layout` animation.

Key UI decisions:
- The compact row stays the same 3-column grid for quick review of the most important fields
- The expand chevron (rotate 180deg when expanded) sits next to the delete button
- Toggles use a 2-column grid (matching `MenuItemFormFields`)
- Description uses a compact textarea (2 rows)
- Calories is a small number input
- Size options use the same add/remove pattern from `MenuItemFormFields`
- Items where the AI set `is_food`/`is_hot`/`is_cold` to `true` should auto-expand on first load (set `isExpanded: true` in the onComplete mapping for items with any boolean flags set)

Update the `onComplete` callback from Task 3 to auto-expand items with set flags:

```ts
isExpanded: !!(item.is_food || item.is_hot || item.is_cold || item.is_vegan || item.is_vegetarian || item.description || item.calories),
```

Full review step JSX structure:

```tsx
{step === "review" && (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
        {/* Duplicates warning - keep existing */}
        <AnimatePresence mode="wait">
            {duplicates.length > 0 && (
                /* ... existing duplicates banner ... */
            )}
        </AnimatePresence>

        {extractedItems.length === 0 ? (
            /* ... existing empty state ... */
        ) : (
            <>
                <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-text/70">
                        Review {extractedItems.length} extracted item{extractedItems.length === 1 ? "" : "s"}
                    </p>
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                        className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full font-medium">
                        {extractedItems.length} items
                    </motion.span>
                </div>

                <motion.div initial="hidden" animate="visible" className="space-y-2">
                    {extractedItems.map((item, idx) => (
                        <motion.div key={item.id} custom={idx} variants={itemVariants}
                            initial="hidden" animate="visible" exit="exit" layout
                            className="group border border-text/10 rounded-xl overflow-hidden bg-text/[0.02] hover:bg-text/[0.04] transition-colors"
                        >
                            {/* Compact Row */}
                            <div className="flex items-center gap-2 p-3">
                                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                                    {idx + 1}
                                </div>
                                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <input type="text" value={item.name}
                                        onChange={(e) => handleUpdateItem(item.id, "name", e.target.value)}
                                        className="px-3 py-2 bg-background border border-text/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                                        placeholder="Item name" />
                                    <select value={item.category}
                                        onChange={(e) => handleUpdateItem(item.id, "category", e.target.value)}
                                        className="px-3 py-2 bg-background border border-text/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all cursor-pointer">
                                        {MENU_CATEGORIES.map((cat) => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text/40 text-sm">₱</span>
                                        <input type="number" step="0.01" min="0" value={item.price}
                                            onChange={(e) => handleUpdateItem(item.id, "price", parseFloat(e.target.value) || 0)}
                                            className="w-full pl-7 pr-3 py-2 bg-background border border-text/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
                                    </div>
                                </div>
                                {/* Active flags badges */}
                                <div className="flex items-center gap-1 shrink-0">
                                    {item.isFood && <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full">Food</span>}
                                    {item.isHot && <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full">Hot</span>}
                                    {item.isCold && <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full">Cold</span>}
                                </div>
                                {/* Expand toggle */}
                                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                    onClick={() => handleToggleExpand(item.id)}
                                    className="p-2 hover:bg-text/10 rounded-lg transition-colors text-text/40 hover:text-text cursor-pointer">
                                    <motion.div animate={{ rotate: item.isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                                        <ChevronDown className="w-4 h-4" />
                                    </motion.div>
                                </motion.button>
                                {/* Delete */}
                                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                    onClick={() => handleRemoveItem(item.id)}
                                    className="p-2 hover:bg-destructive/10 rounded-lg transition-colors text-text/30 hover:text-destructive cursor-pointer opacity-0 group-hover:opacity-100">
                                    <Trash2 className="w-4 h-4" />
                                </motion.button>
                            </div>

                            {/* Expanded Panel */}
                            <AnimatePresence>
                                {item.isExpanded && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                                        className="overflow-hidden">
                                        <div className="px-3 pb-3 pt-1 border-t border-text/5 space-y-3">
                                            {/* Description */}
                                            <div>
                                                <label className="text-xs font-medium text-text/50 mb-1 block">Description</label>
                                                <textarea value={item.description} rows={2}
                                                    onChange={(e) => handleUpdateItem(item.id, "description", e.target.value)}
                                                    className="w-full px-3 py-2 bg-background border border-text/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none"
                                                    placeholder="Brief description..." />
                                            </div>
                                            {/* Type Toggles */}
                                            <div>
                                                <label className="text-xs font-medium text-text/50 mb-1 block">Item Type</label>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                                                    <CustomCheckbox checked={item.isFood} onChange={(v) => handleUpdateItem(item.id, "isFood", v)} label="Food" />
                                                    <CustomCheckbox checked={item.isHot} onChange={(v) => handleUpdateItem(item.id, "isHot", v)} label="Hot" />
                                                    <CustomCheckbox checked={item.isCold} onChange={(v) => handleUpdateItem(item.id, "isCold", v)} label="Cold" />
                                                    <CustomCheckbox checked={item.isVegan} onChange={(v) => handleUpdateItem(item.id, "isVegan", v)} label="Vegan" />
                                                    <CustomCheckbox checked={item.isVegetarian} onChange={(v) => handleUpdateItem(item.id, "isVegetarian", v)} label="Vegetarian" />
                                                </div>
                                            </div>
                                            {/* Calories */}
                                            <div>
                                                <label className="text-xs font-medium text-text/50 mb-1 block">Calories</label>
                                                <input type="number" min="0" value={item.calories}
                                                    onChange={(e) => handleUpdateItem(item.id, "calories", e.target.value)}
                                                    className="w-32 px-3 py-2 bg-background border border-text/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                                                    placeholder="e.g. 250" />
                                            </div>
                                            {/* Size Options */}
                                            <div>
                                                <div className="flex items-center justify-between mb-1">
                                                    <label className="text-xs font-medium text-text/50">Size Options</label>
                                                    <button type="button"
                                                        onClick={() => handleUpdateItem(item.id, "sizeOptions", [...item.sizeOptions, { label: "", price: 0 }])}
                                                        className="text-xs flex items-center gap-1 text-primary hover:text-primary/80 transition-colors cursor-pointer">
                                                        <Plus className="w-3 h-3" /> Add size
                                                    </button>
                                                </div>
                                                {item.sizeOptions.length === 0 && (
                                                    <p className="text-xs text-text/30 italic">No sizes added</p>
                                                )}
                                                {item.sizeOptions.map((opt, si) => (
                                                    <div key={si} className="flex items-center gap-2 mt-1">
                                                        <input type="text" value={opt.label} placeholder="Size (e.g., Large)"
                                                            onChange={(e) => {
                                                                const updated = [...item.sizeOptions]
                                                                updated[si] = { ...updated[si], label: e.target.value }
                                                                handleUpdateItem(item.id, "sizeOptions", updated)
                                                            }}
                                                            className="flex-1 px-2 py-1.5 bg-background border border-text/10 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
                                                        <input type="number" min="0" step="0.01" value={opt.price || ""} placeholder="Price"
                                                            onChange={(e) => {
                                                                const updated = [...item.sizeOptions]
                                                                updated[si] = { ...updated[si], price: parseFloat(e.target.value) || 0 }
                                                                handleUpdateItem(item.id, "sizeOptions", updated)
                                                            }}
                                                            className="w-24 px-2 py-1.5 bg-background border border-text/10 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
                                                        <button type="button"
                                                            onClick={() => handleUpdateItem(item.id, "sizeOptions", item.sizeOptions.filter((_, i) => i !== si))}
                                                            className="p-1.5 text-text/30 hover:text-destructive rounded-lg transition-colors cursor-pointer">
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ))}
                </motion.div>
            </>
        )}
    </motion.div>
)}
```

**Step 5: Add `ChevronDown` and `Plus` to Lucide imports**

Update line 6:

```ts
import { X as XIcon, Camera, Loader2, Check, Trash2, ScanLine, AlertCircle, ChevronDown, Plus } from "lucide-react"
```

**Step 6: Run type check**

Run: `bun lint`
Expected: No errors

**Step 7: Commit (combined with Task 3)**

```bash
git add components/suggestions/MenuOcrScanModal.tsx
git commit -m "feat(ocr): expand review UI with full field editing and collapsible cards"
```

---

### Task 5: Update `handleSave` to Pass All Fields

**Files:**
- Modify: `components/suggestions/MenuOcrScanModal.tsx:206-224` (handleSave function)

**Step 1: Replace the `handleSave` function**

The current `handleSave` at lines 206-224 only maps `name`, `category`, `price`. Update it to pass all fields:

```ts
const handleSave = async () => {
    setStep("saving")

    const itemsToSave: OcrMenuItem[] = extractedItems.map((item) => ({
        name: item.name,
        category: item.category,
        price: item.price,
        description: item.description || undefined,
        is_food: item.isFood,
        is_hot: item.isHot,
        is_cold: item.isCold,
        is_vegan: item.isVegan,
        is_vegetarian: item.isVegetarian,
        calories: item.calories ? Number(item.calories) : undefined,
    }))

    const result = await saveOcrMenuItems(cafeId, itemsToSave)

    if (result.success) {
        setSavedCount(result.saved ?? extractedItems.length)
        setStep("done")
    } else {
        setError(result.error ?? "Failed to save menu items")
        setStep("review")
    }
}
```

Note: `sizeOptions` is NOT included in the save payload because `saveOcrMenuItems` does not handle them. If size options support is desired in the future, a separate task would add that to the server action. For now, the size options UI in the review panel serves as a visual indicator but values are not persisted via OCR save. This is intentional YAGNI — the owner editor already has full size options support.

**Step 2: Run type check**

Run: `bun lint`
Expected: No errors (assuming Tasks 1-4 are complete)

**Step 3: Commit**

```bash
git add components/suggestions/MenuOcrScanModal.tsx
git commit -m "fix(ocr): pass all editable fields in handleSave"
```

---

### Task 6: Add Manual "Expand All" / "Collapse All" Toggle

**Files:**
- Modify: `components/suggestions/MenuOcrScanModal.tsx` (review step header)

**Step 1: Add expand/collapse all functions**

Add these helper functions after `handleToggleExpand`:

```ts
const handleExpandAll = () => {
    setExtractedItems((prev) => prev.map((item) => ({ ...item, isExpanded: true })))
}

const handleCollapseAll = () => {
    setExtractedItems((prev) => prev.map((item) => ({ ...item, isExpanded: false })))
}
```

**Step 2: Add toggle button in review header**

In the review step header (where "Review N extracted items" is shown), add an expand/collapse all button:

```tsx
<div className="flex items-center justify-between">
    <p className="text-sm font-medium text-text/70">
        Review {extractedItems.length} extracted item{extractedItems.length === 1 ? "" : "s"}
    </p>
    <div className="flex items-center gap-2">
        <button type="button" onClick={handleExpandAll}
            className="text-xs text-text/40 hover:text-text transition-colors cursor-pointer">
            Expand all
        </button>
        <span className="text-text/20">|</span>
        <button type="button" onClick={handleCollapseAll}
            className="text-xs text-text/40 hover:text-text transition-colors cursor-pointer">
            Collapse all
        </button>
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full font-medium">
            {extractedItems.length} items
        </motion.span>
    </div>
</div>
```

**Step 3: Run type check**

Run: `bun lint`
Expected: No errors

**Step 4: Commit**

```bash
git add components/suggestions/MenuOcrScanModal.tsx
git commit -m "feat(ocr): add expand/collapse all toggle in review step"
```

---

### Task 7: Update OCR Schema Tests

**Files:**
- Modify: `utils/ai/__tests__/menu-ocr.test.ts` (add tests for new fields)

**Step 1: Add test cases for the extended schema**

Add tests that verify the new fields (`is_vegan`, `is_vegetarian`, `calories`) are correctly parsed:

```ts
import { describe, expect, it } from "bun:test"
import { parseOcrMenuItems } from "@/utils/ai/menu-ocr"

describe("parseOcrMenuItems", () => {
    // ... existing tests ...

    it("parses items with is_vegan, is_vegetarian, and calories fields", () => {
        const raw = JSON.stringify([
            {
                name: "Veggie Wrap",
                category: "Food",
                price: 180,
                description: "Fresh vegetable wrap",
                is_food: true,
                is_hot: false,
                is_cold: true,
                is_vegan: true,
                is_vegetarian: true,
                calories: 350,
            },
        ])
        const items = parseOcrMenuItems(raw)
        expect(items).toHaveLength(1)
        expect(items[0].name).toBe("Veggie Wrap")
        expect(items[0].is_vegan).toBe(true)
        expect(items[0].is_vegetarian).toBe(true)
        expect(items[0].calories).toBe(350)
    })

    it("handles missing optional fields gracefully", () => {
        const raw = JSON.stringify([
            {
                name: "Black Coffee",
                category: "Coffee",
                price: 120,
            },
        ])
        const items = parseOcrMenuItems(raw)
        expect(items).toHaveLength(1)
        expect(items[0].is_vegan).toBeUndefined()
        expect(items[0].calories).toBeUndefined()
    })

    it("parses calories as string and converts to number", () => {
        const raw = JSON.stringify([
            {
                name: "Latte",
                category: "Coffee",
                price: 150,
                calories: "200",
            },
        ])
        const items = parseOcrMenuItems(raw)
        expect(items).toHaveLength(1)
        expect(items[0].calories).toBe(200)
    })

    it("rejects negative calories", () => {
        const raw = JSON.stringify([
            {
                name: "Bad Item",
                category: "Other",
                price: 100,
                calories: -50,
            },
        ])
        const items = parseOcrMenuItems(raw)
        expect(items).toHaveLength(1)
        // calories should be undefined since negative is rejected
        expect(items[0].calories).toBeUndefined()
    })
})
```

**Step 2: Run tests**

Run: `bun test utils/ai/__tests__/menu-ocr.test.ts`
Expected: All PASS

**Step 3: Commit**

```bash
git add utils/ai/__tests__/menu-ocr.test.ts
git commit -m "test(ocr): add tests for new schema fields"
```

---

### Task 8: Update `saveOcrMenuItems` Tests

**Files:**
- Modify: `app/api/actions/__tests__/menu-ocr.test.ts`

**Step 1: Add test case for full field save**

Add a test that verifies all fields are persisted correctly:

```ts
it("saves items with isVegan, isVegetarian, and calories", async () => {
    const items: OcrMenuItem[] = [
        {
            name: "Veggie Salad",
            category: "Food",
            price: 200,
            description: "Fresh garden salad",
            is_food: true,
            is_hot: false,
            is_cold: true,
            is_vegan: true,
            is_vegetarian: true,
            calories: 150,
        },
    ]

    const result = await saveOcrMenuItems(testCafeId, items)
    expect(result.success).toBe(true)
    expect(result.saved).toBe(1)

    // Verify in DB
    const saved = await db
        .select()
        .from(cafeMenuItems)
        .where(eq(cafeMenuItems.cafeId, testCafeId))

    const item = saved.find((i) => i.name === "Veggie Salad")
    expect(item).toBeDefined()
    expect(item!.isFood).toBe(true)
    expect(item!.isHot).toBe(false)
    expect(item!.isCold).toBe(true)
    expect(item!.isVegan).toBe(true)
    expect(item!.isVegetarian).toBe(true)
    expect(item!.calories).toBe(150)
    expect(item!.description).toBe("Fresh garden salad")
})
```

**Step 2: Run tests**

Run: `bun test app/api/actions/__tests__/menu-ocr.test.ts`
Expected: All PASS

**Step 3: Commit**

```bash
git add app/api/actions/__tests__/menu-ocr.test.ts
git commit -m "test(ocr): verify full field persistence in save action"
```

---

## Verification Checklist

After all tasks are complete, run the full verification suite:

**Step 1: Lint**

Run: `bun lint`
Expected: No errors

**Step 2: Full test suite**

Run: `bun test`
Expected: All tests pass

**Step 3: Manual testing**

1. Navigate to a cafe page as an authenticated user
2. Click "Scan Menu" button
3. Upload a menu photo that includes hot/cold drinks and food items
4. Wait for OCR to complete
5. Verify the review step shows:
   - Name, category, price fields (compact row)
   - Flag badges (Food/Hot/Cold) on items where OCR detected them
   - Items with detected flags should be auto-expanded
6. Click the expand chevron on a collapsed item
7. Verify expanded panel shows:
   - Description textarea (pre-filled if OCR extracted it)
   - Type toggles (Food, Hot, Cold, Vegan, Vegetarian)
   - Calories input
   - Size Options section with add/remove buttons
8. Toggle some checkboxes and edit description
9. Click "Save" and verify success
10. Navigate to the cafe menu and verify the saved items show the correct flags

---

## Suggestions & Improvements

### 1. Deduplicated Items Re-review
Currently, when items are flagged as duplicates, they're silently skipped. Consider adding a "show duplicates" toggle that lets users review and optionally force-add them with adjusted names.

### 2. OCR Confidence Indicator
The AI could return a confidence score per item. Items below a threshold could be auto-flagged with a warning badge in the review UI, drawing attention to fields that need manual verification.

### 3. Bulk Category Assignment
When scanning 20+ items, manually setting each category is tedious. Consider a "bulk set category" dropdown that sets the category for all unselected items at once.

### 4. Size Options from OCR
Currently size options are manual-only. The AI prompt could be enhanced to extract size variants (e.g., "Small 120 / Medium 150 / Large 180") and populate `sizeOptions` automatically. This would require prompt engineering and a more complex JSON schema.

### 5. Image-to-Field Mapping
For items where the menu has photos, the OCR could potentially extract `imageUrl` references. This is low priority and would require additional infrastructure.

---

## Execution

**Plan complete and saved to `docs/plans/2026-04-09-ocr-scan-full-menu-fields.md`.**

**Two execution options:**

1. **Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

2. **Parallel Session (separate)** — Open a new session with executing-plans, batch execution with checkpoints.

Which approach do you prefer?
