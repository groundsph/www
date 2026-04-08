# Chat Bubble Shrinkwrap + Log an Item Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** (1) Integrate `@chenglou/pretext` to give AI chat bubbles dynamic shrinkwrap widths instead of fixed `max-w-[90%]`, and (2) overhaul the "Suggest Menu Item" feature into "Log an Item" with improved form styling, mobile accessibility, and project-consistent theming.

**Architecture:**
- **Chat bubbles:** Create a `ShrinkwrapBubble` wrapper component that uses pretext's `walkLineRanges()` to binary-search the tightest content width, then renders the bubble at that width. Applied to both user and assistant messages.
- **Log an Item:** Rename the feature across all files, redesign `SuggestMenuItemModal` to follow `SuggestEditModal` patterns (section headers, better checkboxes, theme tokens), and adopt the responsive modal pattern from `ClaimCafeModal` for mobile.
- **Submit Cafe menu form:** Update `CafeSubmissionForm.tsx` Step 5 to share the same input styling, category list (`MENU_CATEGORIES`), type toggles, and size options as the redesigned `SuggestMenuItemModal`. Extract a shared `MenuItemFormFields` component to DRY.

**Tech Stack:** `@chenglou/pretext`, React, Tailwind CSS v4, `motion/react`, Bun

---

## Part 1: AI Chat — Pretext Shrinkwrap Bubbles

### Task 1: Install `@chenglou/pretext`

**Files:**
- Modify: `package.json`

**Step 1: Install the package**

```bash
bun add @chenglou/pretext
```

**Step 2: Verify installation**

Check `package.json` for `"@chenglou/pretext"` in dependencies.

**Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add @chenglou/pretext for chat bubble shrinkwrap"
```

---

### Task 2: Create `ShrinkwrapBubble` component

**Files:**
- Create: `components/chat/ShrinkwrapBubble.tsx`

**Step 1: Write the component**

The component uses pretext's `prepare()` and `walkLineRanges()` to binary-search for the minimum width that preserves the same line count. It measures text via Canvas (no DOM reflow), then sets an inline `maxWidth` style on the bubble.

```tsx
"use client"

import { useRef, useLayoutEffect, useState, ReactNode } from "react"
import { prepare, walkLineRanges } from "@chenglou/pretext"

interface ShrinkwrapBubbleProps {
    text: string
    font: string
    lineHeight: number
    maxWidth: number
    minWidth?: number
    children: ReactNode
    className?: string
}

function measureShrinkwrapWidth(
    text: string,
    font: string,
    lineHeight: number,
    maxWidth: number,
    minWidth: number
): number {
    if (!text.trim()) return maxWidth

    const prepared = prepare(text, font, { whiteSpace: "pre-wrap" })

    // Count lines at maxWidth
    let maxLines = 0
    walkLineRanges(prepared, maxWidth, () => { maxLines++ })
    if (maxLines <= 1) {
        // Single line: measure natural width + small padding
        const naturalWidth = Math.ceil(
            // Walk segments to get total width for single line
            (() => {
                let w = 0
                walkLineRanges(prepared, maxWidth, (range) => {
                    for (let i = range.start; i < range.end; i++) {
                        w += prepared.segments[i].width
                    }
                })
                return w
            })()
        )
        return Math.min(naturalWidth + 1, maxWidth)
    }

    // Binary search for tightest width that keeps same line count
    let low = minWidth
    let high = maxWidth

    while (low < high - 1) {
        const mid = Math.floor((low + high) / 2)
        let lines = 0
        walkLineRanges(prepared, mid, () => { lines++ })

        if (lines <= maxLines) {
            high = mid
        } else {
            low = mid
        }
    }

    return high
}

export default function ShrinkwrapBubble({
    text,
    font,
    lineHeight,
    maxWidth,
    minWidth = 80,
    children,
    className,
}: ShrinkwrapBubbleProps) {
    const [calculatedMaxWidth, setCalculatedMaxWidth] = useState(maxWidth)
    const prevTextRef = useRef(text)

    useLayoutEffect(() => {
        if (!text) return

        const width = measureShrinkwrapWidth(
            text,
            font,
            lineHeight,
            maxWidth,
            minWidth
        )
        setCalculatedMaxWidth(width)
        prevTextRef.current = text
    }, [text, font, lineHeight, maxWidth, minWidth])

    return (
        <div
            className={className}
            style={{ maxWidth: calculatedMaxWidth, width: "fit-content" }}
        >
            {children}
        </div>
    )
}
```

**Step 2: Test the component renders**

Run: `bun test components/chat/__tests__/shrinkwrap-bubble.test.tsx`

**Step 3: Commit**

```bash
git add components/chat/ShrinkwrapBubble.tsx
git commit -m "feat: add ShrinkwrapBubble component using pretext"
```

---

### Task 3: Write tests for `ShrinkwrapBubble`

**Files:**
- Create: `components/chat/__tests__/shrinkwrap-bubble.test.tsx`

**Step 1: Write tests**

```tsx
import { describe, it, expect } from "bun:test"
import { render, screen } from "@testing-library/react"
import ShrinkwrapBubble from "../ShrinkwrapBubble"

describe("ShrinkwrapBubble", () => {
    it("renders children inside the bubble", () => {
        render(
            <ShrinkwrapBubble
                text="Hello world"
                font="14px Inter"
                lineHeight={20}
                maxWidth={300}
            >
                <p>Hello world</p>
            </ShrinkwrapBubble>
        )
        expect(screen.getByText("Hello world")).toBeTruthy()
    })

    it("applies custom className", () => {
        const { container } = render(
            <ShrinkwrapBubble
                text="Test"
                font="14px Inter"
                lineHeight={20}
                maxWidth={300}
                className="custom-class"
            >
                <p>Test</p>
            </ShrinkwrapBubble>
        )
        expect(container.firstChild).toBeTruthy()
    })

    it("handles empty text gracefully", () => {
        const { container } = render(
            <ShrinkwrapBubble
                text=""
                font="14px Inter"
                lineHeight={20}
                maxWidth={300}
            >
                <p>Empty</p>
            </ShrinkwrapBubble>
        )
        expect(container.firstChild).toBeTruthy()
    })
})
```

**Step 2: Run tests**

```bash
bun test components/chat/__tests__/shrinkwrap-bubble.test.tsx
```

**Step 3: Commit**

```bash
git add components/chat/__tests__/shrinkwrap-bubble.test.tsx
git commit -m "test: add ShrinkwrapBubble component tests"
```

---

### Task 4: Integrate ShrinkwrapBubble into ChatMessage

**Files:**
- Modify: `components/chat/ChatMessage.tsx`

**Step 1: Import ShrinkwrapBubble and wrap message content**

Replace the current bubble rendering with `ShrinkwrapBubble` for both user and assistant messages. The pretext font string must match the computed CSS font of the bubble (e.g., `"14px Inter"` for `text-sm`). The `maxWidth` should be the parent's 90% constraint, and `lineHeight` should match `leading-relaxed` (1.625 * 14 = ~23px).

```tsx
import ShrinkwrapBubble from "./ShrinkwrapBubble"

// In the render, replace the inner content wrapper:
// BEFORE:
// <div className="max-w-[90%]">
//   <motion.div className={cn("px-4 py-2.5 rounded-2xl ...")}>
//     {content}
//   </motion.div>
// </div>

// AFTER:
<div className="max-w-[90%]">
    <ShrinkwrapBubble
        text={message.content}
        font="14px Inter, ui-sans-serif, system-ui, sans-serif"
        lineHeight={23}
        maxWidth={380}
        minWidth={80}
        className={cn(
            "px-4 py-2.5 rounded-2xl border text-sm leading-relaxed",
            isUser
                ? "bg-secondary/10 border-secondary/20 rounded-br-md text-right ml-auto"
                : "bg-background border-primary/10 rounded-bl-md"
        )}
    >
        {/* existing content: user <p> or assistant <MarkdownRender> + carousels + feedback */}
    </ShrinkwrapBubble>
</div>
```

**Key details:**
- User bubbles: `text-right ml-auto` so the shrinkwrap-aligned bubble hugs the right edge.
- Assistant bubbles: default left alignment.
- The `maxWidth` of 380px is derived from the chat window's ~450px minus padding (40px each side = 370px, rounded up slightly).
- The `font` string must exactly match the computed CSS font. Verify by checking `getComputedStyle` on a rendered bubble in dev tools.
- For streaming messages, the width will recalculate as `text` changes (via the `useLayoutEffect` dependency).

**Step 2: Handle streaming messages**

During streaming, `message.content` is built up progressively. The `ShrinkwrapBubble` will re-measure on each content update via `useLayoutEffect`. This is acceptable because pretext's `walkLineRanges()` is pure arithmetic (no DOM reflow).

**Step 3: Run existing chat tests to verify no regressions**

```bash
bun test components/chat/__tests__/
```

**Step 4: Commit**

```bash
git add components/chat/ChatMessage.tsx
git commit -m "feat: integrate pretext shrinkwrap into chat bubbles"
```

---

### Task 5: Write integration test for shrinkwrap in ChatMessage

**Files:**
- Create: `components/chat/__tests__/chat-message-shrinkwrap.test.tsx`

**Step 1: Write test verifying ShrinkwrapBubble is used**

```tsx
import { describe, it, expect } from "bun:test"
import { render, screen } from "@testing-library/react"
import ChatMessage from "../ChatMessage"
import type { ChatMessage as ChatMessageType } from "@/utils/types/chat"

describe("ChatMessage with shrinkwrap", () => {
    const baseMessage: ChatMessageType = {
        id: "test-1",
        role: "user",
        content: "Hello world",
        timestamp: new Date(),
    }

    it("renders user message with shrinkwrap bubble", () => {
        render(<ChatMessage message={baseMessage} />)
        expect(screen.getByText("Hello world")).toBeTruthy()
    })

    it("renders assistant message with shrinkwrap bubble", () => {
        render(
            <ChatMessage
                message={{ ...baseMessage, role: "assistant", content: "Hi there!" }}
            />
        )
        expect(screen.getByText("Hi there!")).toBeTruthy()
    })

    it("handles long multiline content", () => {
        const longMessage: ChatMessageType = {
            ...baseMessage,
            role: "assistant",
            content: "Line one\nLine two\nLine three with more text that wraps",
        }
        render(<ChatMessage message={longMessage} />)
        expect(screen.getByText(/Line one/)).toBeTruthy()
    })
})
```

**Step 2: Run test**

```bash
bun test components/chat/__tests__/chat-message-shrinkwrap.test.tsx
```

**Step 3: Commit**

```bash
git add components/chat/__tests__/chat-message-shrinkwrap.test.tsx
git commit -m "test: add shrinkwrap integration test for ChatMessage"
```

---

## Part 2: Log an Item — Rename + Form Overhaul

### Task 6: Rename "Suggest Menu Item" → "Log an Item"

**Files:**
- Modify: `components/suggestions/SuggestMenuItemButton.tsx` (button label + link text)
- Modify: `components/suggestions/SuggestMenuItemModal.tsx` (header label, submit button)
- Modify: `components/cafe/CafeDetails.tsx` (where button text appears in menu section)

**Step 1: Update SuggestMenuItemButton.tsx**

Change the visible label from "Suggest Menu Item" to "Log an Item" in both the logged-in button and the logged-out link (2 occurrences).

```tsx
// Line 35 (logged-out link):
<span>Log an Item</span>

// Line 51 (logged-in button):
<span>Log an Item</span>
```

**Step 2: Update SuggestMenuItemModal.tsx header and submit**

Change the header label and submit button text:

```tsx
// Line 193-195 (header label):
<span className='text-xs font-medium tracking-wide uppercase text-text/50'>
    {mode === "edit" ? "Suggest Edit" : "Log an Item"}
</span>

// Line 548-552 (submit button):
) : (
    "Log Item"
)}
```

**Step 3: Verify no other references remain**

```bash
grep -r "Suggest Menu Item" components/ app/ --include="*.tsx" --include="*.ts"
```

**Step 4: Run existing tests**

```bash
bun test
```

**Step 5: Commit**

```bash
git add components/suggestions/SuggestMenuItemButton.tsx components/suggestions/SuggestMenuItemModal.tsx
git commit -m "refactor: rename 'Suggest Menu Item' to 'Log an Item'"
```

---

### Task 7: Create shared `MenuItemFormFields` component

Extract the form fields (name, category, price, description, type toggles, calories, size options) into a shared component used by both `SuggestMenuItemModal` and `CafeSubmissionForm` Step 5.

**Files:**
- Create: `components/suggestions/MenuItemFormFields.tsx`

**Step 1: Write the component**

This component encapsulates all the menu item form fields with consistent styling. It accepts controlled state via props and renders the form fields with improved styling (custom checkboxes, left-aligned labels, theme tokens).

```tsx
"use client"

import { Plus, Trash2 } from "lucide-react"
import { MENU_CATEGORIES } from "@/utils/types/owner"
import { cn } from "@/utils/cn"

interface SizeOption {
    label: string
    price: number
}

interface MenuItemFormFieldsProps {
    name: string
    onNameChange: (value: string) => void
    category: string
    onCategoryChange: (value: string) => void
    price: string
    onPriceChange: (value: string) => void
    description: string
    onDescriptionChange: (value: string) => void
    isFood: boolean
    onIsFoodChange: (value: boolean) => void
    isHot: boolean
    onIsHotChange: (value: boolean) => void
    isCold: boolean
    onIsColdChange: (value: boolean) => void
    isVegan: boolean
    onIsVeganChange: (value: boolean) => void
    isVegetarian: boolean
    onIsVegetarianChange: (value: boolean) => void
    calories: string
    onCaloriesChange: (value: string) => void
    sizeOptions: SizeOption[]
    onSizeOptionsChange: (options: SizeOption[]) => void
    showImageUpload?: boolean
    imagePreview?: string | null
    onImageChange?: (file: File | null) => void
    descriptionMaxLength?: number
}

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
        <label
            className={cn(
                "flex items-center gap-2.5 cursor-pointer px-3 py-2 rounded-lg border transition-all",
                checked
                    ? "border-primary/30 bg-primary/5 text-text"
                    : "border-text/10 bg-text/5 text-text/60 hover:border-text/20 hover:bg-text/8"
            )}
        >
            <div
                className={cn(
                    "w-4 h-4 rounded border-2 flex items-center justify-center transition-all shrink-0",
                    checked
                        ? "border-primary bg-primary"
                        : "border-text/30 bg-transparent"
                )}
            >
                {checked && (
                    <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                )}
            </div>
            <span className="text-sm">{label}</span>
        </label>
    )
}

export default function MenuItemFormFields(props: MenuItemFormFieldsProps) {
    const addSizeOption = () => {
        props.onSizeOptionsChange([...props.sizeOptions, { label: "", price: 0 }])
    }

    const removeSizeOption = (index: number) => {
        props.onSizeOptionsChange(props.sizeOptions.filter((_, i) => i !== index))
    }

    const updateSizeOption = (index: number, field: keyof SizeOption, value: string | number) => {
        const updated = [...props.sizeOptions]
        updated[index] = { ...updated[index], [field]: value }
        props.onSizeOptionsChange(updated)
    }

    return (
        <div className="space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text/80">
                    Name <span className="text-primary">*</span>
                </label>
                <input
                    type="text"
                    value={props.name}
                    onChange={(e) => props.onNameChange(e.target.value)}
                    placeholder="e.g., Iced Caramel Latte"
                    className="w-full bg-text/5 text-sm placeholder:text-text/30 focus:outline-none p-3 rounded-lg border border-text/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-text"
                />
            </div>

            {/* Category + Price row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-text/80">
                        Category <span className="text-primary">*</span>
                    </label>
                    <select
                        value={props.category}
                        onChange={(e) => props.onCategoryChange(e.target.value)}
                        className="w-full bg-text/5 text-sm focus:outline-none p-3 rounded-lg border border-text/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-text"
                    >
                        <option value="">Select category</option>
                        {MENU_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>
                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-text/80">
                        Price (₱) <span className="text-primary">*</span>
                    </label>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={props.price}
                        onChange={(e) => props.onPriceChange(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-text/5 text-sm placeholder:text-text/30 focus:outline-none p-3 rounded-lg border border-text/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-text"
                    />
                </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text/80">
                    Description <span className="text-text/50 font-normal">(optional)</span>
                </label>
                <textarea
                    value={props.description}
                    onChange={(e) => props.onDescriptionChange(e.target.value)}
                    placeholder="Brief description of the item..."
                    rows={3}
                    maxLength={props.descriptionMaxLength}
                    className="w-full bg-text/5 text-sm leading-relaxed placeholder:text-text/30 focus:outline-none p-3 resize-none rounded-lg border border-text/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-text"
                />
                {props.descriptionMaxLength && (
                    <p className="text-xs text-text/40">
                        {props.descriptionMaxLength - props.description.length} characters remaining
                    </p>
                )}
            </div>

            {/* Type Toggles */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-text/80">Item Type</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <CustomCheckbox checked={props.isFood} onChange={props.onIsFoodChange} label="Food" />
                    <CustomCheckbox checked={props.isHot} onChange={props.onIsHotChange} label="Hot" />
                    <CustomCheckbox checked={props.isCold} onChange={props.onIsColdChange} label="Cold" />
                    <CustomCheckbox checked={props.isVegan} onChange={props.onIsVeganChange} label="Vegan" />
                    <CustomCheckbox checked={props.isVegetarian} onChange={props.onIsVegetarianChange} label="Vegetarian" />
                </div>
            </div>

            {/* Calories */}
            <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text/80">
                    Calories <span className="text-text/50 font-normal">(optional)</span>
                </label>
                <input
                    type="number"
                    min="0"
                    value={props.calories}
                    onChange={(e) => props.onCaloriesChange(e.target.value)}
                    placeholder="e.g., 250"
                    className="w-full bg-text/5 text-sm placeholder:text-text/30 focus:outline-none p-3 rounded-lg border border-text/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-text"
                />
            </div>

            {/* Size Options */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-text/80">
                        Size Options <span className="text-text/50 font-normal">(optional)</span>
                    </label>
                    <button
                        type="button"
                        onClick={addSizeOption}
                        className="text-xs flex items-center gap-1 text-primary hover:text-primary/80 transition-colors cursor-pointer"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add size
                    </button>
                </div>
                {props.sizeOptions.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <input
                            type="text"
                            value={option.label}
                            onChange={(e) => updateSizeOption(index, "label", e.target.value)}
                            placeholder="Size (e.g., Large)"
                            className="flex-1 bg-text/5 text-sm placeholder:text-text/30 focus:outline-none p-2.5 rounded-lg border border-text/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-text"
                        />
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={option.price || ""}
                            onChange={(e) => updateSizeOption(index, "price", parseFloat(e.target.value) || 0)}
                            placeholder="Price"
                            className="w-28 bg-text/5 text-sm placeholder:text-text/30 focus:outline-none p-2.5 rounded-lg border border-text/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-text"
                        />
                        <button
                            type="button"
                            onClick={() => removeSizeOption(index)}
                            className="p-2.5 text-text/40 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))}
                {props.sizeOptions.length === 0 && (
                    <p className="text-sm text-text/40 italic">
                        No size options added. Click &quot;Add size&quot; to add options like Small, Medium, Large.
                    </p>
                )}
            </div>

            {/* Image Upload (optional) */}
            {props.showImageUpload && props.onImageChange && (
                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-text/80">
                        Photo <span className="text-text/50 font-normal">(optional)</span>
                    </label>
                    {props.imagePreview ? (
                        <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-text/10">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={props.imagePreview} alt="Preview" className="w-full h-full object-cover" />
                            <button
                                type="button"
                                onClick={() => props.onImageChange!(null)}
                                className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-black/80 text-white rounded transition-colors"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                    ) : (
                        <label className="flex flex-col items-center justify-center w-24 h-24 rounded-lg border-2 border-dashed border-text/15 bg-text/5 hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer">
                            <Plus className="w-6 h-6 text-text/40" />
                            <span className="text-xs text-text/50 mt-1">Add photo</span>
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) props.onImageChange!(file)
                                }}
                            />
                        </label>
                    )}
                </div>
            )}
        </div>
    )
}
```

**Step 2: Run lint**

```bash
bun lint
```

**Step 3: Commit**

```bash
git add components/suggestions/MenuItemFormFields.tsx
git commit -m "feat: extract shared MenuItemFormFields component with custom checkboxes"
```

---

### Task 8: Redesign `SuggestMenuItemModal` to use `MenuItemFormFields`

**Files:**
- Modify: `components/suggestions/SuggestMenuItemModal.tsx`

**Step 1: Replace inline form fields with MenuItemFormFields**

Replace the entire form content (lines 231-522) with the shared component. The modal keeps its own state management (`useState` hooks) and passes them as props.

```tsx
import MenuItemFormFields from "./MenuItemFormFields"

// Inside the modal content (replacing lines 231-522):
<MenuItemFormFields
    name={name}
    onNameChange={setName}
    category={category}
    onCategoryChange={setCategory}
    price={price}
    onPriceChange={setPrice}
    description={description}
    onDescriptionChange={setDescription}
    isFood={isFood}
    onIsFoodChange={setIsFood}
    isHot={isHot}
    onIsHotChange={setIsHot}
    isCold={isCold}
    onIsColdChange={setIsCold}
    isVegan={isVegan}
    onIsVeganChange={setIsVegan}
    isVegetarian={isVegetarian}
    onIsVegetarianChange={setIsVegetarian}
    calories={calories}
    onCaloriesChange={setCalories}
    sizeOptions={sizeOptions}
    onSizeOptionsChange={setSizeOptions}
/>
```

**Step 2: Remove the amber warning banner**

The "Photo uploads are not available for community suggestions" notice (lines 232-241) adds noise. Remove it since the `showImageUpload` prop defaults to `false` in `MenuItemFormFields`, making the absence self-evident. If a notice is still desired, make it a subtle inline text below the form instead of a prominent banner.

**Step 3: Fix the error banner to use theme tokens**

Replace the hardcoded red colors with theme-aware tokens:

```tsx
// BEFORE:
<div className='bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700'>

// AFTER:
<div className='bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive'>
```

**Step 4: Fix the success state to use theme tokens**

```tsx
// BEFORE:
<div className='w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center'>
    <Check className='w-8 h-8 text-green-500' />

// AFTER:
<div className='w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center'>
    <Check className='w-8 h-8 text-primary' />
```

**Step 5: Run lint + tests**

```bash
bun lint
bun test
```

**Step 6: Commit**

```bash
git add components/suggestions/SuggestMenuItemModal.tsx
git commit -m "refactor: redesign SuggestMenuItemModal with shared form fields and theme tokens"
```

---

### Task 9: Fix mobile accessibility for `SuggestMenuItemModal`

**Files:**
- Modify: `components/suggestions/SuggestMenuItemModal.tsx` (modal container positioning)

**Step 1: Apply the responsive modal pattern from ClaimCafeModal**

Replace the fixed centering transform with the responsive inset pattern:

```tsx
// BEFORE (line 187):
className='fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg mx-4 bg-background text-text rounded-xl shadow-2xl z-50 flex flex-col max-h-[90vh] overflow-hidden border border-text/10'

// AFTER:
className='fixed inset-4 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-lg sm:w-full bg-background text-text rounded-xl shadow-2xl z-50 flex flex-col max-h-[90vh] overflow-hidden border border-text/10'
```

On mobile (`< sm`), the modal uses `inset-4` (16px from all edges), filling the screen. On `sm+`, it centers with the original transform pattern.

**Step 2: Test on mobile viewport**

Open dev tools, set device to iPhone SE (375px) or similar, and verify the modal is fully accessible and scrollable.

**Step 3: Commit**

```bash
git add components/suggestions/SuggestMenuItemModal.tsx
git commit -m "fix: improve SuggestMenuItemModal mobile accessibility with responsive inset pattern"
```

---

### Task 10: Update `CafeSubmissionForm` Step 5 to use `MenuItemFormFields`

**Files:**
- Modify: `components/submit/CafeSubmissionForm.tsx` (Step 5 menu section, lines 2326-2606)

**Step 1: Import MenuItemFormFields**

```tsx
import MenuItemFormFields from "@/components/suggestions/MenuItemFormFields"
```

**Step 2: Expand the local form state to include type toggles, calories, and size options**

The current `menuItemForm` state only has: `name`, `category`, `price`, `description`, `imageFile`, `imagePreview`. Add the missing fields:

```tsx
const [menuItemForm, setMenuItemForm] = useState({
    name: '',
    category: '',
    price: '',
    description: '',
    imageFile: null as File | null,
    imagePreview: null as string | null,
    isFood: false,
    isHot: false,
    isCold: false,
    isVegan: false,
    isVegetarian: false,
    calories: '',
    sizeOptions: [] as { label: string; price: number }[],
})
```

**Step 3: Replace the inline form JSX (lines 2356-2537) with MenuItemFormFields**

```tsx
<div className='p-5 bg-background border border-text/10 rounded-xl space-y-4'>
    <h4 className='font-medium text-sm text-text/70'>
        Add a Menu Item
    </h4>
    <MenuItemFormFields
        name={menuItemForm.name}
        onNameChange={(v) => setMenuItemForm(prev => ({ ...prev, name: v }))}
        category={menuItemForm.category}
        onCategoryChange={(v) => setMenuItemForm(prev => ({ ...prev, category: v }))}
        price={menuItemForm.price}
        onPriceChange={(v) => setMenuItemForm(prev => ({ ...prev, price: v }))}
        description={menuItemForm.description}
        onDescriptionChange={(v) => setMenuItemForm(prev => ({ ...prev, description: v }))}
        isFood={menuItemForm.isFood}
        onIsFoodChange={(v) => setMenuItemForm(prev => ({ ...prev, isFood: v }))}
        isHot={menuItemForm.isHot}
        onIsHotChange={(v) => setMenuItemForm(prev => ({ ...prev, isHot: v }))}
        isCold={menuItemForm.isCold}
        onIsColdChange={(v) => setMenuItemForm(prev => ({ ...prev, isCold: v }))}
        isVegan={menuItemForm.isVegan}
        onIsVeganChange={(v) => setMenuItemForm(prev => ({ ...prev, isVegan: v }))}
        isVegetarian={menuItemForm.isVegetarian}
        onIsVegetarianChange={(v) => setMenuItemForm(prev => ({ ...prev, isVegetarian: v }))}
        calories={menuItemForm.calories}
        onCaloriesChange={(v) => setMenuItemForm(prev => ({ ...prev, calories: v }))}
        sizeOptions={menuItemForm.sizeOptions}
        onSizeOptionsChange={(v) => setMenuItemForm(prev => ({ ...prev, sizeOptions: v }))}
        showImageUpload={true}
        imagePreview={menuItemForm.imagePreview}
        onImageChange={(file) => {
            if (file) {
                setMenuItemForm(prev => ({
                    ...prev,
                    imageFile: file,
                    imagePreview: URL.createObjectURL(file),
                }))
            } else {
                setMenuItemForm(prev => ({ ...prev, imageFile: null, imagePreview: null }))
            }
        }}
        descriptionMaxLength={200}
    />
    <button ...>Add Item</button>
</div>
```

**Step 4: Update the "Add Item" handler to include new fields**

When creating the `MenuItemSubmission`, include the new type/calorie/size fields. Check if `MenuItemSubmission` type needs extending — if so, update `utils/types/extra.ts` to add the new optional fields.

**Step 5: Update the hardcoded category options to use MENU_CATEGORIES**

The shared `MenuItemFormFields` already uses `MENU_CATEGORIES`, so this is handled automatically.

**Step 6: Run lint + tests**

```bash
bun lint
bun test
```

**Step 7: Commit**

```bash
git add components/submit/CafeSubmissionForm.tsx
git commit -m "refactor: use shared MenuItemFormFields in cafe submission Step 5"
```

---

### Task 11: Fix `custom-scrollbar` CSS class

**Files:**
- Modify: `app/globals.css`

The `custom-scrollbar` class is referenced in multiple modals but has no CSS definition. Add a subtle custom scrollbar style:

**Step 1: Add CSS**

```css
.custom-scrollbar::-webkit-scrollbar {
    width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--color-text) 15%, transparent);
    border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: color-mix(in srgb, var(--color-text) 25%, transparent);
}
```

**Step 2: Commit**

```bash
git add app/globals.css
git commit -m "fix: add missing custom-scrollbar CSS definition"
```

---

### Task 12: Final verification

**Step 1: Run full lint**

```bash
bun lint
```

**Step 2: Run all tests**

```bash
bun test
```

**Step 3: Run build to verify no compilation errors**

```bash
bun build
```

**Step 4: Manual testing checklist**

- [ ] Chat bubbles dynamically shrink to content width (no dead space on short lines)
- [ ] Chat bubbles handle long multiline text correctly
- [ ] Streaming messages update bubble width as content arrives
- [ ] "Log an Item" label appears everywhere (button, modal header, submit)
- [ ] SuggestMenuItemModal has custom checkboxes with project theme
- [ ] SuggestMenuItemModal is fully accessible on mobile (375px viewport)
- [ ] CafeSubmissionForm Step 5 uses same styling and fields as SuggestMenuItemModal
- [ ] Error/success states use theme tokens (not hardcoded colors)
- [ ] Custom scrollbar renders in modals

